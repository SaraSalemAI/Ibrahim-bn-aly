#!/usr/bin/env python3
"""Daily Finance Control runner -- reference implementation (fictional company).

Validates a batch of finance input files, performs deterministic calculations,
detects control exceptions, and writes:

  * file identity record           file_identity.json
  * calculation results            calculations.json
  * source-linked exception register  exception_register.csv
  * daily CFO summary              cfo_summary.md
  * reviewer routing outbox        routing_outbox.jsonl   (drafts, NOT sent)
  * human-approval queue           approval_queue.csv     (proposals, NOT executed)
  * structured execution log       <log_dir>/run_<run_id>.jsonl

What this script deliberately does NOT do:
  * schedule itself, watch folders, or run unattended -- an external scheduler
    or file-arrival trigger must invoke it (see DESIGN.md section 3);
  * send email/chat notifications -- it writes an outbox that a separately
    configured delivery service consumes;
  * post journals, place payment holds, or change any system of record --
    it only queues proposed actions for human approval.

Standard library only. Python 3.10+.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import io
import json
import os
import sys
import time
import uuid
from datetime import date, datetime, timezone
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Any, Callable

EXIT_OK = 0
EXIT_ERROR = 1
EXIT_VALIDATION_FAILED = 2
EXIT_LOCKED = 3
EXIT_NOT_READY = 4

CENT = Decimal("0.01")
MANIFEST_NAME = "manifest.json"

REGISTER_COLUMNS = [
    "exception_id", "business_date", "batch_id", "category", "rule_id",
    "severity", "material", "amount", "description", "source_links",
    "source_record_ids", "source_file_sha256", "assigned_to", "status",
    "proposed_action", "action_requires_human_approval",
]
APPROVAL_QUEUE_COLUMNS = [
    "action_key", "exception_id", "proposed_action", "amount", "material",
    "required_approvers", "approval_status", "approved_by", "approved_at",
]


class ValidationError(Exception):
    def __init__(self, errors: list[str]):
        super().__init__(f"{len(errors)} validation error(s)")
        self.errors = errors


# --------------------------------------------------------------------------- #
# Logging, retries, atomic I/O
# --------------------------------------------------------------------------- #

class RunLog:
    """Append-only JSON-lines execution log; also echoes to stderr."""

    def __init__(self, path: Path, run_id: str, quiet: bool = False):
        path.parent.mkdir(parents=True, exist_ok=True)
        self.path = path
        self.run_id = run_id
        self.quiet = quiet

    def event(self, level: str, event: str, **fields: Any) -> None:
        record = {
            "ts": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "run_id": self.run_id,
            "level": level,
            "event": event,
            **fields,
        }
        with self.path.open("a", encoding="utf-8") as fh:
            fh.write(json.dumps(record, default=str) + "\n")
        if not self.quiet:
            print(f"[{level}] {event} {json.dumps(fields, default=str)}", file=sys.stderr)


def with_retries(fn: Callable[[], Any], *, what: str, log: RunLog, attempts: int,
                 base_delay: float, sleep: Callable[[float], None] = time.sleep) -> Any:
    """Retry transient I/O failures (OSError) with exponential backoff.

    Data and validation errors are never retried: rerunning cannot fix them.
    """
    for attempt in range(1, attempts + 1):
        try:
            return fn()
        except OSError as exc:
            if attempt == attempts:
                log.event("ERROR", "RETRY_EXHAUSTED", what=what, attempts=attempts, error=str(exc))
                raise
            delay = base_delay * (2 ** (attempt - 1))
            log.event("WARN", "RETRYING", what=what, attempt=attempt, delay_s=delay, error=str(exc))
            sleep(delay)
    raise AssertionError("unreachable")


def atomic_write_text(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(f".{path.name}.{uuid.uuid4().hex}.tmp")
    tmp.write_text(text, encoding="utf-8", newline="")
    os.replace(tmp, path)


def csv_text(columns: list[str], rows: list[dict[str, Any]]) -> str:
    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=columns, lineterminator="\n")
    writer.writeheader()
    for row in rows:
        writer.writerow({c: row.get(c, "") for c in columns})
    return buf.getvalue()


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def money(value: Decimal) -> str:
    return str(value.quantize(CENT))


def stable_id(prefix: str, *parts: str) -> str:
    return prefix + sha256_bytes("|".join(parts).encode("utf-8"))[:12].upper()


# --------------------------------------------------------------------------- #
# Validation and file identity
# --------------------------------------------------------------------------- #

def parse_amount(text: str) -> Decimal:
    value = Decimal(text.strip())
    if not value.is_finite() or value.as_tuple().exponent < -2:
        raise InvalidOperation(text)
    return value


def load_and_validate(input_dir: Path, config: dict, business_date: date, log: RunLog,
                      retry: dict) -> tuple[dict[str, list[dict]], list[dict]]:
    """Validate every input against the manifest and schema.

    All errors are collected so a reviewer sees the full picture in one pass.
    Returns (tables, file_identities). Raises ValidationError on any failure.
    """
    errors: list[str] = []
    manifest_path = input_dir / MANIFEST_NAME
    if not manifest_path.exists():
        raise ValidationError([f"{MANIFEST_NAME} missing from {input_dir}"])
    manifest_bytes = with_retries(manifest_path.read_bytes, what=MANIFEST_NAME, log=log, **retry)
    try:
        manifest = json.loads(manifest_bytes)
    except json.JSONDecodeError as exc:
        raise ValidationError([f"{MANIFEST_NAME} is not valid JSON: {exc}"])

    if manifest.get("business_date") != business_date.isoformat():
        errors.append(f"manifest business_date {manifest.get('business_date')!r} "
                      f"!= requested {business_date.isoformat()}")

    tables: dict[str, list[dict]] = {}
    identities: list[dict] = []
    declared = manifest.get("files", {})

    for name, spec in config["inputs"].items():
        path = input_dir / name
        if name not in declared:
            errors.append(f"{name}: not declared in manifest")
            continue
        if not path.exists():
            errors.append(f"{name}: declared in manifest but file not found")
            continue
        raw = with_retries(path.read_bytes, what=name, log=log, **retry)
        digest = sha256_bytes(raw)
        expected = declared[name]
        if digest != expected.get("sha256"):
            errors.append(f"{name}: sha256 {digest} does not match manifest {expected.get('sha256')}")
        try:
            text = raw.decode("utf-8")
        except UnicodeDecodeError:
            errors.append(f"{name}: not valid UTF-8")
            continue

        reader = csv.DictReader(io.StringIO(text))
        if reader.fieldnames != spec["columns"]:
            errors.append(f"{name}: header {reader.fieldnames} != expected {spec['columns']}")
            continue

        rows: list[dict] = []
        seen_keys: set[str] = set()
        control_total = Decimal("0")
        for idx, row in enumerate(reader, start=2):  # line 1 is the header
            if None in row or any(v is None for v in row.values()):
                errors.append(f"{name}#L{idx}: wrong number of fields")
                continue
            key = row[spec["key"]].strip()
            if not key:
                errors.append(f"{name}#L{idx}: empty key {spec['key']}")
            elif key in seen_keys:
                errors.append(f"{name}#L{idx}: duplicate key {key}")
            seen_keys.add(key)
            try:
                amount = parse_amount(row[spec["amount_column"]])
                control_total += amount
            except InvalidOperation:
                errors.append(f"{name}#L{idx}: invalid amount {row[spec['amount_column']]!r}")
                continue
            if spec.get("date_column"):
                try:
                    date.fromisoformat(row[spec["date_column"]])
                except ValueError:
                    errors.append(f"{name}#L{idx}: invalid date {row[spec['date_column']]!r}")
            if "currency" in row and row["currency"] != config["base_currency"]:
                errors.append(f"{name}#L{idx}: currency {row['currency']} != {config['base_currency']}")
            rows.append({**row, "_line": idx, "_file": name, "_amount": amount})

        if len(rows) != expected.get("row_count"):
            errors.append(f"{name}: row_count {len(rows)} != manifest {expected.get('row_count')}")
        if money(control_total) != str(expected.get("control_total")):
            errors.append(f"{name}: control_total {money(control_total)} "
                          f"!= manifest {expected.get('control_total')}")

        tables[name] = rows
        identities.append({
            "file": name,
            "sha256": digest,
            "size_bytes": len(raw),
            "row_count": len(rows),
            "control_total": money(control_total),
            "source": manifest.get("source_system", "unknown"),
        })

    extras = sorted(set(declared) - set(config["inputs"]))
    if extras:
        log.event("WARN", "UNEXPECTED_FILES_IN_MANIFEST", files=extras)

    if errors:
        raise ValidationError(errors)
    return tables, identities


def compute_batch_id(business_date: date, identities: list[dict]) -> str:
    parts = [business_date.isoformat()] + sorted(f"{i['file']}:{i['sha256']}" for i in identities)
    return "B-" + sha256_bytes("|".join(parts).encode("utf-8"))[:16].upper()


# --------------------------------------------------------------------------- #
# Deterministic calculations and exception rules
# --------------------------------------------------------------------------- #

def _link(row: dict) -> str:
    return f"{row['_file']}#L{row['_line']}"


def _exception(business_date: date, category: str, rule_id: str, amount: Decimal,
               description: str, rows: list[dict], proposed_action: str,
               record_ids: list[str]) -> dict:
    return {
        "exception_id": stable_id("EX-", business_date.isoformat(), rule_id, *sorted(record_ids)),
        "category": category,
        "rule_id": rule_id,
        "amount": amount,
        "description": description,
        "source_links": ";".join(_link(r) for r in rows),
        "source_record_ids": ";".join(record_ids),
        "source_files": sorted({r["_file"] for r in rows}),
        "proposed_action": proposed_action,
    }


def find_duplicate_candidates(invoices: list[dict], window_days: int, bd: date) -> list[dict]:
    out: list[dict] = []
    by_number: dict[tuple[str, str], list[dict]] = {}
    for inv in invoices:
        norm = "".join(ch for ch in inv["invoice_number"].upper() if ch.isalnum())
        by_number.setdefault((inv["vendor_id"], norm), []).append(inv)
    exact_pairs: set[frozenset] = set()
    for (vendor, number), group in sorted(by_number.items()):
        if len(group) < 2:
            continue
        group = sorted(group, key=lambda r: (r["invoice_date"], r["invoice_id"]))
        exposure = sum((r["_amount"] for r in group[1:]), Decimal("0"))
        ids = [r["invoice_id"] for r in group]
        exact_pairs.update(frozenset((a, b)) for a in ids for b in ids if a != b)
        out.append(_exception(
            bd, "DUPLICATE_CANDIDATE", "DUP-EXACT", exposure,
            f"Vendor {vendor} invoice number {group[0]['invoice_number']} appears {len(group)} times "
            f"({', '.join(ids)}).",
            group, f"Place payment hold on {', '.join(ids[1:])} pending AP duplicate review", ids))

    ordered = sorted(invoices, key=lambda r: (r["vendor_id"], r["invoice_date"], r["invoice_id"]))
    for i, a in enumerate(ordered):
        for b in ordered[i + 1:]:
            if b["vendor_id"] != a["vendor_id"]:
                break
            gap = (date.fromisoformat(b["invoice_date"]) - date.fromisoformat(a["invoice_date"])).days
            if gap > window_days:
                break
            if a["_amount"] != b["_amount"] or frozenset((a["invoice_id"], b["invoice_id"])) in exact_pairs:
                continue
            out.append(_exception(
                bd, "DUPLICATE_CANDIDATE", "DUP-FUZZY", b["_amount"],
                f"Vendor {a['vendor_id']} billed the same amount {money(a['_amount'])} on "
                f"{a['invoice_id']} and {b['invoice_id']} within {gap} day(s) under different "
                f"invoice numbers.",
                [a, b], f"Place payment hold on {b['invoice_id']} pending AP duplicate review",
                [a["invoice_id"], b["invoice_id"]]))
    return out


def find_approval_exceptions(invoices: list[dict], approvals: list[dict],
                             threshold: Decimal, bd: date) -> list[dict]:
    out: list[dict] = []
    by_invoice: dict[str, list[dict]] = {}
    for apr in approvals:
        by_invoice.setdefault(apr["invoice_id"], []).append(apr)

    for inv in sorted(invoices, key=lambda r: r["invoice_id"]):
        if inv["_amount"] < threshold:
            continue
        aprs = sorted(by_invoice.get(inv["invoice_id"], []), key=lambda r: r["approval_id"])
        independent = [a for a in aprs if a["approver_id"] != inv["submitted_by"]]
        block = f"Block {inv['invoice_id']} from payment run until approved by an authorized, independent approver"
        if not aprs:
            out.append(_exception(
                bd, "MISSING_APPROVAL", "APR-MISSING", inv["_amount"],
                f"{inv['invoice_id']} ({inv['vendor_name']}) {money(inv['_amount'])} has no approval; "
                f"threshold is {money(threshold)}.",
                [inv], block, [inv["invoice_id"]]))
        elif not independent:
            out.append(_exception(
                bd, "SEGREGATION_OF_DUTIES", "SOD-SELF-APPROVAL", inv["_amount"],
                f"{inv['invoice_id']} was submitted and approved by the same user ({inv['submitted_by']}).",
                [inv, *aprs], block, [inv["invoice_id"], *(a["approval_id"] for a in aprs)]))
        elif max(a["_amount"] for a in independent) < inv["_amount"]:
            out.append(_exception(
                bd, "APPROVAL_AUTHORITY", "APR-LIMIT", inv["_amount"],
                f"{inv['invoice_id']} {money(inv['_amount'])} exceeds the approver limit "
                f"({', '.join(a['approver_id'] + ' ' + money(a['_amount']) for a in independent)}).",
                [inv, *independent], block, [inv["invoice_id"], *(a["approval_id"] for a in independent)]))
    return out


def reconcile_cash(bank: list[dict], gl: list[dict], tolerance: Decimal,
                   bd: date) -> tuple[dict, list[dict]]:
    day = bd.isoformat()
    bank_day = [r for r in bank if r["value_date"] == day]
    gl_day = [r for r in gl if r["posting_date"] == day]

    def group(rows: list[dict]) -> dict[str, list[dict]]:
        g: dict[str, list[dict]] = {}
        for r in rows:
            g.setdefault(r["reference"].strip().upper(), []).append(r)
        return g

    bank_by_ref, gl_by_ref = group(bank_day), group(gl_day)
    out: list[dict] = []
    explained = Decimal("0")
    matched = 0
    for ref in sorted(set(bank_by_ref) | set(gl_by_ref)):
        b_rows, g_rows = bank_by_ref.get(ref, []), gl_by_ref.get(ref, [])
        b_sum = sum((r["_amount"] for r in b_rows), Decimal("0"))
        g_sum = sum((r["_amount"] for r in g_rows), Decimal("0"))
        diff = b_sum - g_sum
        ids = [r["txn_id"] for r in b_rows] + [r["entry_id"] for r in g_rows]
        if abs(diff) <= tolerance:
            matched += 1
            continue
        explained += diff
        if not g_rows:
            rule, desc, action = ("REC-BANK-ONLY",
                                  f"Bank item {ref} {money(b_sum)} ({b_rows[0]['description']}) has no GL cash entry.",
                                  f"Prepare journal entry to record {ref} {money(b_sum)} in GL cash")
        elif not b_rows:
            rule, desc, action = ("REC-GL-ONLY",
                                  f"GL entry {ref} {money(g_sum)} ({g_rows[0]['description']}) has no bank movement on {day}.",
                                  f"Investigate {ref}: confirm whether the payment cleared; reverse or carry as reconciling item")
        else:
            rule, desc, action = ("REC-AMOUNT",
                                  f"{ref}: bank {money(b_sum)} vs GL {money(g_sum)}, difference {money(diff)}.",
                                  f"Investigate {ref} and prepare correcting entry for {money(diff)}")
        out.append(_exception(bd, "RECONCILIATION_DIFFERENCE", rule, diff, desc,
                              b_rows + g_rows, action, ids))

    bank_net = sum((r["_amount"] for r in bank_day), Decimal("0"))
    gl_net = sum((r["_amount"] for r in gl_day), Decimal("0"))
    summary = {
        "bank_net_movement": money(bank_net),
        "bank_inflows": money(sum((r["_amount"] for r in bank_day if r["_amount"] > 0), Decimal("0"))),
        "bank_outflows": money(sum((r["_amount"] for r in bank_day if r["_amount"] < 0), Decimal("0"))),
        "gl_net_movement": money(gl_net),
        "difference_bank_minus_gl": money(bank_net - gl_net),
        "explained_by_exceptions": money(explained),
        "unexplained_difference": money(bank_net - gl_net - explained),
        "references_matched": matched,
        "references_unmatched": len(out),
    }
    return summary, out


def classify(exc: dict, materiality: Decimal) -> None:
    material = abs(exc["amount"]) >= materiality
    exc["material"] = material
    if material or exc["category"] == "SEGREGATION_OF_DUTIES":
        exc["severity"] = "HIGH"
    elif abs(exc["amount"]) < Decimal("100"):
        exc["severity"] = "LOW"
    else:
        exc["severity"] = "MEDIUM"


def run_calculations(tables: dict[str, list[dict]], config: dict, bd: date) -> tuple[dict, list[dict]]:
    rules = config["rules"]
    threshold = Decimal(rules["approval_required_at_or_above"])
    materiality = Decimal(rules["materiality_threshold"])
    invoices = tables["ap_invoices.csv"]
    approvals = tables["approvals.csv"]

    exceptions = (
        find_duplicate_candidates(invoices, int(rules["duplicate_fuzzy_window_days"]), bd)
        + find_approval_exceptions(invoices, approvals, threshold, bd)
    )
    rec_summary, rec_exceptions = reconcile_cash(
        tables["bank_transactions.csv"], tables["gl_cash_entries.csv"],
        Decimal(rules["reconciliation_tolerance"]), bd)
    exceptions += rec_exceptions
    for exc in exceptions:
        classify(exc, materiality)
    exceptions.sort(key=lambda e: ({"HIGH": 0, "MEDIUM": 1, "LOW": 2}[e["severity"]],
                                   e["category"], e["exception_id"]))

    ap_total = sum((r["_amount"] for r in invoices), Decimal("0"))
    needing = [r for r in invoices if r["_amount"] >= threshold]
    by_cat: dict[str, int] = {}
    for exc in exceptions:
        by_cat[exc["category"]] = by_cat.get(exc["category"], 0) + 1

    metrics = {
        "business_date": bd.isoformat(),
        "ap": {
            "invoice_count": len(invoices),
            "invoice_total": money(ap_total),
            "invoices_requiring_approval": len(needing),
            "amount_requiring_approval": money(sum((r["_amount"] for r in needing), Decimal("0"))),
        },
        "cash_reconciliation": rec_summary,
        "exceptions": {
            "total": len(exceptions),
            "material": sum(1 for e in exceptions if e["material"]),
            "by_category": dict(sorted(by_cat.items())),
            "by_severity": {s: sum(1 for e in exceptions if e["severity"] == s)
                            for s in ("HIGH", "MEDIUM", "LOW")},
            "gross_exposure": money(sum((abs(e["amount"]) for e in exceptions), Decimal("0"))),
        },
        "parameters": {k: v for k, v in rules.items()},
    }
    return metrics, exceptions


# --------------------------------------------------------------------------- #
# Outputs
# --------------------------------------------------------------------------- #

def reviewers_for(exc: dict, routing: dict) -> list[str]:
    who = list(routing.get(exc["category"], []))
    if exc["material"]:
        who += [r for r in routing.get("material_escalation", []) if r not in who]
    return who


def build_register(exceptions: list[dict], identities: list[dict], batch_id: str,
                   bd: date, routing: dict) -> list[dict]:
    sha_by_file = {i["file"]: i["sha256"] for i in identities}
    rows = []
    for exc in exceptions:
        rows.append({
            "exception_id": exc["exception_id"],
            "business_date": bd.isoformat(),
            "batch_id": batch_id,
            "category": exc["category"],
            "rule_id": exc["rule_id"],
            "severity": exc["severity"],
            "material": "Y" if exc["material"] else "N",
            "amount": money(exc["amount"]),
            "description": exc["description"],
            "source_links": exc["source_links"],
            "source_record_ids": exc["source_record_ids"],
            "source_file_sha256": ";".join(f"{f}={sha_by_file[f][:16]}" for f in exc["source_files"]),
            "assigned_to": ";".join(reviewers_for(exc, routing)),
            "status": "OPEN",
            "proposed_action": exc["proposed_action"],
            "action_requires_human_approval": "Y",
        })
    return rows


def build_cfo_summary(metrics: dict, register: list[dict], identities: list[dict],
                      batch_id: str, run_id: str, company: str) -> str:
    ap, rec, ex = metrics["ap"], metrics["cash_reconciliation"], metrics["exceptions"]
    lines = [
        f"# Daily Finance Control Summary -- {metrics['business_date']}",
        "",
        f"**Company:** {company}  ",
        f"**Batch:** `{batch_id}` | **Run:** `{run_id}`  ",
        "**Status:** Generated from validated inputs. Draft for CFO review; no actions have been executed "
        "and no notifications have been sent by this run.",
        "",
        "## Headline",
        "",
        f"- {ex['total']} exceptions ({ex['by_severity']['HIGH']} high, {ex['material']} material); "
        f"gross exposure {ex['gross_exposure']}.",
        f"- Cash: bank net movement {rec['bank_net_movement']} vs GL {rec['gl_net_movement']}; "
        f"difference {rec['difference_bank_minus_gl']}, unexplained {rec['unexplained_difference']}.",
        f"- AP: {ap['invoice_count']} invoices totalling {ap['invoice_total']}; "
        f"{ap['invoices_requiring_approval']} require approval ({ap['amount_requiring_approval']}).",
        "",
        "## Exceptions by category",
        "",
        "| Category | Count |",
        "|---|---:|",
        *[f"| {k} | {v} |" for k, v in ex["by_category"].items()],
        "",
        "## High-severity items",
        "",
        "| ID | Rule | Amount | Description | Source | Owner |",
        "|---|---|---:|---|---|---|",
    ]
    high = [r for r in register if r["severity"] == "HIGH"]
    lines += [f"| {r['exception_id']} | {r['rule_id']} | {r['amount']} | {r['description']} | "
              f"{r['source_links']} | {r['assigned_to']} |" for r in high] or ["| -- | -- | -- | none | -- | -- |"]
    lines += [
        "",
        "## Decisions requested",
        "",
        f"- {sum(1 for r in register if r['material'] == 'Y')} material proposed action(s) await approval "
        "in `approval_queue.csv` (controller sign-off required).",
        "",
        "## Input files (identity)",
        "",
        "| File | Rows | Control total | SHA-256 (prefix) |",
        "|---|---:|---:|---|",
        *[f"| {i['file']} | {i['row_count']} | {i['control_total']} | `{i['sha256'][:16]}` |" for i in identities],
        "",
        "_Every figure above is recomputable from the listed files and `calculations.json`._",
        "",
    ]
    return "\n".join(lines)


# --------------------------------------------------------------------------- #
# Idempotency ledger and lock
# --------------------------------------------------------------------------- #

class Ledger:
    def __init__(self, path: Path):
        self.path = path
        self.data = json.loads(path.read_text("utf-8")) if path.exists() else {
            "batches": {}, "routed": {}, "actions_queued": {}}

    def save(self) -> None:
        atomic_write_text(self.path, json.dumps(self.data, indent=2, sort_keys=True) + "\n")


class RunLock:
    def __init__(self, path: Path):
        self.path = path
        self.fd: int | None = None

    def __enter__(self) -> "RunLock":
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.fd = os.open(self.path, os.O_CREAT | os.O_EXCL | os.O_WRONLY)  # FileExistsError if held
        os.write(self.fd, f"{os.getpid()}\n".encode())
        return self

    def __exit__(self, *exc: Any) -> None:
        if self.fd is not None:
            os.close(self.fd)
            self.path.unlink(missing_ok=True)


# --------------------------------------------------------------------------- #
# Orchestration
# --------------------------------------------------------------------------- #

def run(args: argparse.Namespace, sleep: Callable[[float], None] = time.sleep) -> int:
    config = json.loads(Path(args.config).read_text("utf-8"))
    bd = date.fromisoformat(args.business_date)
    input_dir = Path(args.input_dir)
    out_root = Path(args.output_dir) / bd.isoformat()
    state_dir = Path(args.state_dir)
    run_id = args.run_id or datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ-") + uuid.uuid4().hex[:6]
    log = RunLog(Path(args.log_dir) / f"run_{run_id}.jsonl", run_id, quiet=args.quiet)
    retry = {"attempts": int(config["retries"]["max_attempts"]),
             "base_delay": float(config["retries"]["base_delay_seconds"]), "sleep": sleep}

    log.event("INFO", "RUN_STARTED", business_date=bd.isoformat(), trigger=args.trigger,
              input_dir=str(input_dir), reprocess=args.reprocess)

    if args.trigger == "file_arrival":
        marker = input_dir / config["trigger"]["file_arrival"]["ready_marker"]
        if not marker.exists():
            log.event("INFO", "NOT_READY", missing_marker=str(marker))
            return EXIT_NOT_READY

    try:
        lock = RunLock(state_dir / "run.lock").__enter__()
    except FileExistsError:
        log.event("ERROR", "LOCK_HELD", lock=str(state_dir / "run.lock"))
        return EXIT_LOCKED

    try:
        ledger = Ledger(state_dir / "ledger.json")
        try:
            tables, identities = load_and_validate(input_dir, config, bd, log, retry)
        except ValidationError as exc:
            for err in exc.errors:
                log.event("ERROR", "VALIDATION_FAILED", detail=err)
            _queue_failure(out_root, config, bd, run_id, "VALIDATION_FAILED", exc.errors, log)
            return EXIT_VALIDATION_FAILED

        batch_id = compute_batch_id(bd, identities)
        log.event("INFO", "FILES_VALIDATED", batch_id=batch_id,
                  files={i["file"]: i["sha256"] for i in identities})

        prior = ledger.data["batches"].get(batch_id)
        if prior and prior.get("status") == "COMPLETED" and not args.reprocess:
            log.event("INFO", "DUPLICATE_BATCH_SKIPPED", batch_id=batch_id, prior_run=prior.get("run_id"))
            return EXIT_OK

        metrics, exceptions = run_calculations(tables, config, bd)
        metrics.update({"batch_id": batch_id, "run_id": run_id})
        register = build_register(exceptions, identities, batch_id, bd, config["routing"])
        out_dir = out_root / batch_id

        atomic_write_text(out_dir / "file_identity.json", json.dumps(
            {"business_date": bd.isoformat(), "batch_id": batch_id, "files": identities}, indent=2) + "\n")
        atomic_write_text(out_dir / "calculations.json", json.dumps(metrics, indent=2) + "\n")
        atomic_write_text(out_dir / "exception_register.csv", csv_text(REGISTER_COLUMNS, register))
        atomic_write_text(out_dir / "cfo_summary.md", build_cfo_summary(
            metrics, register, identities, batch_id, run_id, config["company"]))

        routed, skipped = _route(out_dir, register, config, bd, batch_id, run_id, ledger, metrics)
        queued, q_skipped = _queue_approvals(out_dir, register, ledger, batch_id, config)

        ledger.data["batches"][batch_id] = {
            "status": "COMPLETED", "run_id": run_id, "business_date": bd.isoformat(),
            "output_dir": str(out_dir), "exceptions": len(register),
            "completed_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        }
        with_retries(ledger.save, what="ledger.json", log=log, **retry)
        log.event("INFO", "RUN_COMPLETED", batch_id=batch_id, exceptions=len(register),
                  notifications_queued=routed, notifications_skipped_already_routed=skipped,
                  approvals_queued=queued, approvals_skipped_already_queued=q_skipped,
                  output_dir=str(out_dir))
        return EXIT_OK
    except Exception as exc:  # noqa: BLE001 -- top-level guard: log, alert, fail closed
        log.event("ERROR", "RUN_FAILED", error=f"{type(exc).__name__}: {exc}")
        _queue_failure(out_root, config, bd, run_id, "RUN_FAILED", [str(exc)], log)
        return EXIT_ERROR
    finally:
        lock.__exit__(None, None, None)


def _append_jsonl(path: Path, records: list[dict]) -> None:
    if not records:
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as fh:
        for rec in records:
            fh.write(json.dumps(rec) + "\n")


def _route(out_dir: Path, register: list[dict], config: dict, bd: date, batch_id: str,
           run_id: str, ledger: Ledger, metrics: dict) -> tuple[int, int]:
    """Draft one notification per (exception, reviewer). Already-routed keys are skipped."""
    routing = config["routing"]
    drafts, skipped = [], 0
    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    items = [(r["exception_id"], who, r) for r in register for who in r["assigned_to"].split(";") if who]
    # A corrected batch gets a fresh summary; per-exception keys stay batch-independent.
    items += [(f"CFO-SUMMARY-{batch_id}", who, None) for who in routing.get("cfo_summary", [])]
    for subject_id, who, row in items:
        key = stable_id("RT-", subject_id, who)
        if key in ledger.data["routed"]:
            skipped += 1
            continue
        drafts.append({
            "routing_key": key, "to": who, "subject_id": subject_id, "batch_id": batch_id,
            "run_id": run_id, "created_at": now, "delivery_status": "PENDING_DELIVERY",
            "subject": (f"[{row['severity']}] {row['rule_id']} {row['exception_id']} {row['amount']}"
                        if row else f"Daily finance control summary {bd.isoformat()} "
                                    f"({metrics['exceptions']['total']} exceptions)"),
            "body_ref": str(out_dir / ("exception_register.csv" if row else "cfo_summary.md")),
        })
        ledger.data["routed"][key] = batch_id
    _append_jsonl(out_dir / "routing_outbox.jsonl", drafts)
    return len(drafts), skipped


def _queue_approvals(out_dir: Path, register: list[dict], ledger: Ledger, batch_id: str,
                     config: dict) -> tuple[int, int]:
    """Queue proposed actions for human approval. Nothing here executes an action."""
    rows, skipped = [], 0
    for r in register:
        key = stable_id("AC-", r["exception_id"], r["proposed_action"])
        if key in ledger.data["actions_queued"]:
            skipped += 1
            continue
        approvers = list(config["routing"].get(r["category"], []))
        if r["material"] == "Y":
            approvers += config["routing"].get("material_escalation", [])
        rows.append({"action_key": key, "exception_id": r["exception_id"],
                     "proposed_action": r["proposed_action"], "amount": r["amount"],
                     "material": r["material"], "required_approvers": ";".join(approvers),
                     "approval_status": "PENDING", "approved_by": "", "approved_at": ""})
        ledger.data["actions_queued"][key] = batch_id
    path = out_dir / "approval_queue.csv"
    existing = list(csv.DictReader(io.StringIO(path.read_text("utf-8")))) if path.exists() else []
    atomic_write_text(path, csv_text(APPROVAL_QUEUE_COLUMNS, existing + rows))
    return len(rows), skipped


def _queue_failure(out_root: Path, config: dict, bd: date, run_id: str, kind: str,
                   details: list[str], log: RunLog) -> None:
    try:
        _append_jsonl(out_root / "failure_outbox.jsonl", [{
            "to": who, "kind": kind, "business_date": bd.isoformat(), "run_id": run_id,
            "details": details[:50], "delivery_status": "PENDING_DELIVERY",
            "created_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        } for who in config["routing"].get("run_failure", [])])
    except OSError as exc:
        log.event("ERROR", "FAILURE_ALERT_NOT_WRITTEN", error=str(exc))


def write_manifest(input_dir: Path, config: dict, business_date: str, source: str) -> Path:
    """Helper for the sample data: in production the source system produces the manifest."""
    files = {}
    for name, spec in config["inputs"].items():
        raw = (input_dir / name).read_bytes()
        rows = list(csv.DictReader(io.StringIO(raw.decode("utf-8"))))
        total = sum((Decimal(r[spec["amount_column"]]) for r in rows), Decimal("0"))
        files[name] = {"sha256": sha256_bytes(raw), "row_count": len(rows), "control_total": money(total)}
    path = input_dir / MANIFEST_NAME
    path.write_text(json.dumps({"business_date": business_date, "source_system": source,
                                "files": files}, indent=2) + "\n", encoding="utf-8")
    return path


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    sub = p.add_subparsers(dest="cmd", required=True)

    r = sub.add_parser("run", help="validate, calculate, and produce control outputs")
    r.add_argument("--config", required=True)
    r.add_argument("--business-date", required=True)
    r.add_argument("--input-dir", required=True)
    r.add_argument("--output-dir", default="out")
    r.add_argument("--state-dir", default="state")
    r.add_argument("--log-dir", default="logs")
    r.add_argument("--trigger", choices=["schedule", "file_arrival", "manual"], default="manual")
    r.add_argument("--reprocess", action="store_true",
                   help="recompute an already-completed batch; routing/approvals stay de-duplicated")
    r.add_argument("--run-id")
    r.add_argument("--quiet", action="store_true")

    m = sub.add_parser("manifest", help="(sample data only) write manifest.json for an input folder")
    m.add_argument("--config", required=True)
    m.add_argument("--business-date", required=True)
    m.add_argument("--input-dir", required=True)
    m.add_argument("--source", default="sample-data")

    args = p.parse_args(argv)
    if args.cmd == "manifest":
        config = json.loads(Path(args.config).read_text("utf-8"))
        print(write_manifest(Path(args.input_dir), config, args.business_date, args.source))
        return EXIT_OK
    return run(args)


if __name__ == "__main__":
    sys.exit(main())
