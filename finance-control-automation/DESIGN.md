# Daily Finance Control Automation — Design Specification

**Company:** Cedar Ridge Supply Co. *(fictional; every name, vendor, reviewer address and figure is invented)*
**Document status:** Design + tested reference implementation. **Not deployed.**

---

## 0. What is real today, and what isn't

| Capability | Status |
|---|---|
| Validation, file identity, deterministic calculations, exception rules, exception register, CFO summary, routing drafts, approval queue, idempotency ledger, retries, execution log | **Implemented and tested locally** in `src/daily_control.py` (13 unit tests, sample data). |
| Scheduled execution (cron) | **Not configured.** `control_config.json → trigger` only *describes* the schedule. Nothing runs on a timer. |
| File-arrival trigger | **Not configured.** The runner honours a `_READY` marker when invoked with `--trigger file_arrival`, but no storage event or watcher exists yet. |
| Email / Teams / Slack notifications | **Not configured.** The runner writes `routing_outbox.jsonl` / `failure_outbox.jsonl` with `delivery_status: PENDING_DELIVERY`. Nothing is sent. |
| Approval workflow, payment holds, journal postings | **Not configured, and intentionally not implemented in the runner.** It only writes `approval_queue.csv`. |
| Connections to an ERP, bank, identity provider or secret store | **None.** Inputs are local CSV files. |

Each "not configured" row becomes active only after the go-live gates in §15 are completed **and tested** in the target environment.

---

## 1. Architecture

```
 ┌────────────── Trigger (external, §3) ──────────────┐
 │ Scheduler: cron 07:15 America/Chicago Mon–Fri      │
 │   or  storage event: _READY marker in approved path│
 └───────────────────────┬────────────────────────────┘
                         ▼
 ┌──────────── Control runner (container job) ─────────────┐
 │ 1 acquire lock ─► 2 validate vs manifest ─► 3 batch_id  │
 │   └─ fail ► failure_outbox + log, exit 2 (fail closed)  │
 │ 4 ledger: batch already COMPLETED? ─► skip, exit 0      │
 │ 5 deterministic calcs (Decimal) ─► 6 exception rules    │
 │ 7 register + CFO summary + calculations + identity      │
 │ 8 routing drafts (dedup by routing_key)                 │
 │ 9 approval queue (dedup by action_key)                  │
 │ 10 ledger COMPLETED ─► release lock                     │
 └───────┬───────────────────┬─────────────────┬───────────┘
         ▼                   ▼                 ▼
  Immutable output     Outbox (drafts)    Approval queue
  store (WORM)              │                  │
                            ▼                  ▼
                 Delivery service (§4)   Approval workflow (§4)
                 email / Teams / ticket  human decides; a separate
                 idempotent on key       identity executes in ERP
```

Design principle: **the runner reads and reports; it never changes a system of record.** Anything that moves money or changes the books goes through a human approval step run by a different identity.

---

## 2. Requirement traceability

| # | Requirement | How it is met | Code | Test |
|---|---|---|---|---|
| 1 | Configurable schedule or approved file-arrival trigger | `trigger` block in config (cron, timezone, approved drop path, `_READY` marker, allowed senders). Runner accepts `--trigger schedule\|file_arrival\|manual` and exits `4` (NOT_READY) if the marker is missing. External scheduler required (§3). | `run()` | `test_file_arrival_waits_for_ready_marker` |
| 2 | Validate each input file and record its identity | Manifest required; per file: SHA-256 vs manifest, UTF-8, exact header, unique non-empty keys, amounts (≤2 dp), ISO dates, base currency, row count, control total. All errors collected; any error fails the run closed. `file_identity.json` records name, SHA-256, bytes, rows, control total, source. `batch_id` = hash of business date + all file hashes. | `load_and_validate`, `compute_batch_id` | `test_tampered_file_fails_validation_closed`, `test_bad_amount_reported_with_line`, `test_missing_manifest_fails` |
| 3 | Deterministic financial calculations | `Decimal` arithmetic only (no floats), sorted inputs, rule parameters from config and echoed in `calculations.json`. Same inputs ⇒ byte-identical register. | `run_calculations`, `reconcile_cash` | `test_deterministic_register` |
| 4 | Duplicates, missing approvals, reconciliation differences | Rule catalogue §6. | `find_duplicate_candidates`, `find_approval_exceptions`, `reconcile_cash` | `test_expected_exceptions_detected` |
| 5 | Source-linked exception register | Every row carries `source_links` (`file#L<line>`), `source_record_ids`, and the SHA-256 prefix of each source file. | `build_register` | `test_expected_exceptions_detected` |
| 6 | Daily CFO summary | `cfo_summary.md`: headline, cash recon, AP activity, exceptions by category, high-severity table with source links, decisions requested, input file identities. | `build_cfo_summary` | sample in `examples/` |
| 7 | Route exceptions to designated reviewers | Category → reviewer map; material items add the controller. One draft per (exception, reviewer) in `routing_outbox.jsonl`. | `reviewers_for`, `_route` | `test_material_items_escalate_to_controller` |
| 8 | No duplicate actions on rerun | Batch ledger skip; stable `exception_id`, `routing_key`, `action_key`; run lock. §8. | `Ledger`, `RunLock`, `_route`, `_queue_approvals` | `test_rerun_same_batch_is_skipped`, `test_reprocess_does_not_duplicate_routing_or_actions`, `test_corrected_batch_routes_only_new_summary`, `test_lock_prevents_concurrent_runs` |
| 9 | Retries, error handling, notifications, logs | Exponential backoff for transient I/O only; fail-closed validation; top-level guard; failure alerts to on-call outbox; JSON-lines execution log; exit codes. §9. | `with_retries`, `run`, `_queue_failure`, `RunLog` | `test_retries_*` |
| 10 | Least privilege + human approval for material actions | Runner has read-only inputs and append-only outputs; no ERP/bank write credentials exist in its environment. Every proposed action is `PENDING` in `approval_queue.csv`; material ones (≥ 10,000.00) require controller sign-off. §10–11. | `_queue_approvals` | `test_material_items_escalate_to_controller` |

---

## 3. Trigger design

Two supported modes; pick one per environment in config.

| Mode | Configuration | Behaviour |
|---|---|---|
| **Schedule** | `schedule_cron: "15 7 * * 1-5"`, `schedule_timezone: "America/Chicago"` | Scheduler invokes `run --trigger schedule --business-date <previous business day>`. If files are absent, validation fails and on-call is alerted. |
| **File arrival** | `approved_drop_path`, `ready_marker: "_READY"`, `allowed_senders`, `latest_arrival_local_time: "09:00"` | Storage event fires only for the approved path and only when the sender identity is allowed. Source system writes all files + `manifest.json`, then `_READY` last. A separate late-arrival check at 09:00 alerts if no completed run exists for the date. |

The business-date calculation (previous business day, holiday calendar) belongs in the scheduler wrapper, not in the runner, so the runner stays deterministic for a given `--business-date`.

---

## 4. Required platform and integrations

### 4.1 Recommended platform (primary)

Any equivalent stack works; this is one concrete, consistent choice.

| Need | Recommended service | Alternative (AWS) | Alternative (self-hosted) |
|---|---|---|---|
| Runtime | Azure Container Apps **Job** (Python 3.12 image, this repo) | ECS Fargate task / Lambda container | Docker on a hardened VM |
| Schedule trigger | Container Apps Job *schedule* trigger | EventBridge Scheduler | Airflow / cron |
| File-arrival trigger | Event Grid on Blob `BlobCreated` filtered to `_READY` | S3 Event → EventBridge rule | inotify watcher / Airflow sensor |
| Input landing zone | Blob Storage container per environment | S3 bucket | SFTP + local volume |
| Output store | Blob Storage with **immutability policy** (WORM, 7-year retention) | S3 Object Lock (compliance mode) | Write-once share + backups |
| Ledger / state | Blob (lease-based lock) or Azure SQL table with unique keys | DynamoDB with conditional writes | PostgreSQL |
| Secrets | Key Vault + managed identity (no secrets in config) | Secrets Manager + IAM role | Vault |
| Notification delivery | Logic Apps / Power Automate reading the outbox → Outlook / Teams | Step Functions → SES / SNS / Slack | SMTP relay worker |
| Approval workflow | Power Automate Approvals or ServiceNow / Jira Service Management | Same | Same |
| Logs & monitoring | Log Analytics + alert rules on `RUN_FAILED`, `VALIDATION_FAILED`, missing `RUN_COMPLETED` by 09:30 | CloudWatch Logs + alarms | ELK / Grafana |
| Identity | Entra ID groups per role (§10) | IAM Identity Center | AD / LDAP |

### 4.2 Integrations

| System | Direction | Interface | Notes |
|---|---|---|---|
| ERP (AP sub-ledger, approvals, GL cash) | ERP → landing zone | Scheduled export to CSV + `manifest.json` (hashes, rows, control totals), service account `svc-erp-export` | Manifest must be produced by the source system, not by the runner (the `manifest` sub-command exists only for sample data). |
| Bank | Bank → landing zone | SFTP (BAI2 or ISO 20022 camt.053) → normaliser script → `bank_transactions.csv` + manifest | Normaliser is a separate, tested script (not yet written). |
| Notification channel | Outbox → people | Delivery service reads outbox, sends, writes back delivery receipts | **Must de-duplicate on `routing_key`** (see §8). |
| Approval / ticketing | Approval queue → workflow | Workflow creates one task per `action_key` | Approved actions executed in ERP by a **different** identity under existing ERP approval rules. |
| Monitoring | Logs → alerting | Structured JSON lines | Alert on failure events and on absence of success. |

---

## 5. Data contracts

**`manifest.json`** (produced by the source system):

```json
{ "business_date": "2026-10-09", "source_system": "ERP export",
  "files": { "ap_invoices.csv": { "sha256": "…", "row_count": 9, "control_total": "108980.45" }, … } }
```

**Input schemas** — exact headers enforced from `config.inputs.*.columns`:

| File | Key | Amount column | Date column |
|---|---|---|---|
| `ap_invoices.csv` | `invoice_id` | `amount` | `invoice_date` |
| `approvals.csv` | `approval_id` | `approver_limit` | — |
| `bank_transactions.csv` | `txn_id` | `amount` (signed; outflows negative) | `value_date` |
| `gl_cash_entries.csv` | `entry_id` | `amount` (signed) | `posting_date` |

---

## 6. Control rule catalogue

Parameters live in `config.rules` and are copied into every `calculations.json`.

| Rule | Category | Logic | Proposed action (never executed by runner) |
|---|---|---|---|
| `DUP-EXACT` | DUPLICATE_CANDIDATE | Same vendor + normalised invoice number (alphanumerics, upper-case) appears >1 time. Exposure = all but the earliest. | Payment hold on later invoice(s) |
| `DUP-FUZZY` | DUPLICATE_CANDIDATE | Same vendor, same amount, different invoice number, dates within `duplicate_fuzzy_window_days` (7). | Payment hold on later invoice |
| `APR-MISSING` | MISSING_APPROVAL | Amount ≥ `approval_required_at_or_above` (2,500.00) and no approval record. | Block from payment run |
| `SOD-SELF-APPROVAL` | SEGREGATION_OF_DUTIES | Only approvals are by the submitter. Always HIGH. | Block from payment run |
| `APR-LIMIT` | APPROVAL_AUTHORITY | Independent approval exists but no approver limit ≥ invoice amount. | Block from payment run |
| `REC-AMOUNT` | RECONCILIATION_DIFFERENCE | Reference present in bank and GL, net difference > `reconciliation_tolerance` (0.00). | Investigate; correcting entry |
| `REC-BANK-ONLY` | RECONCILIATION_DIFFERENCE | Bank movement with no GL entry (e.g., bank fee). | Journal entry to record |
| `REC-GL-ONLY` | RECONCILIATION_DIFFERENCE | GL cash entry with no bank movement that day. | Investigate / reconciling item |

**Reconciliation proof:** `calculations.json` shows bank net, GL net, difference, amount explained by exceptions, and `unexplained_difference`, which must be `0.00`.

**Severity:** HIGH if `|amount| ≥ materiality_threshold` (10,000.00) or SoD; LOW if `< 100.00`; otherwise MEDIUM. `material = Y` when `|amount| ≥ materiality_threshold`.

### Sample-data result (2026-10-09)

8 exceptions, 3 material, unexplained cash difference 0.00 — see `examples/sample_run/`.

| Rule | Item | Amount |
|---|---|---:|
| DUP-FUZZY | INV-1002 / INV-1006 Brightline, same amount 5 days apart | 18,900.00 |
| APR-MISSING | INV-1005 Delta Facilities | 32,500.00 |
| SOD-SELF-APPROVAL | INV-1008 submitted & approved by u.khan | 12,000.00 |
| APR-LIMIT | INV-1009 vs j.park limit 5,000.00 | 9,800.00 |
| DUP-EXACT | INV-1001 / INV-1004 Atlas AP-5531 | 4,250.00 |
| REC-GL-ONLY | JE-506 INV-0990 | 2,400.00 |
| REC-AMOUNT | INV-1003 bank −7,200.00 vs GL −7,020.00 | −180.00 |
| REC-BANK-ONLY | BT-9005 wire fee | −35.00 |

---

## 7. Outputs

Written atomically (temp file + rename) to `out/<business_date>/<batch_id>/`:

| File | Contents |
|---|---|
| `file_identity.json` | Per-file SHA-256, size, rows, control total, source; batch ID |
| `calculations.json` | AP metrics, cash reconciliation proof, exception counts, rule parameters, run/batch IDs |
| `exception_register.csv` | `exception_id, business_date, batch_id, category, rule_id, severity, material, amount, description, source_links, source_record_ids, source_file_sha256, assigned_to, status, proposed_action, action_requires_human_approval` |
| `cfo_summary.md` | Daily CFO summary (§2 row 6) |
| `routing_outbox.jsonl` | One draft per (exception, reviewer) + CFO summary, `PENDING_DELIVERY` |
| `approval_queue.csv` | One row per proposed action, `PENDING`, required approvers |
| `../failure_outbox.jsonl` | On-call alerts for validation/run failures |
| `logs/run_<run_id>.jsonl` | Execution log |

---

## 8. Idempotency (rerun safety)

| Mechanism | Key | Effect |
|---|---|---|
| Batch ledger | `batch_id` = SHA-256(business date + sorted file hashes) | Same files rerun ⇒ `DUPLICATE_BATCH_SKIPPED`, exit 0, nothing written or routed. |
| Explicit reprocess | `--reprocess` | Recomputes outputs; routing and approval queue stay de-duplicated. |
| Stable exception ID | SHA-256(business date + rule + sorted record IDs) | A corrected batch for the same day keeps IDs for unchanged exceptions. |
| Routing key | SHA-256(exception ID + recipient) | A reviewer is never re-notified for the same exception, even across corrected batches. CFO summary key includes `batch_id`, so a corrected batch does send a fresh summary. |
| Action key | SHA-256(exception ID + proposed action) | Same action is never queued twice. |
| Run lock | Exclusive-create lock file (cloud: blob lease / DB row lock) | Concurrent triggers (schedule + file event) cannot both run; second exits `3`. |

**Residual risk:** outbox and queue are written before the ledger save. A crash between them gives *at-least-once* drafts on the next reprocess, so the delivery service and approval workflow **must** treat `routing_key` / `action_key` as idempotency keys. In production, move the ledger to a transactional store and write keys and drafts in one transaction.

---

## 9. Retries, error handling, notifications, logs

| Situation | Handling | Exit code | Alert |
|---|---|---|---|
| Transient I/O (share/blob unavailable) | Retry `max_attempts` (3) with backoff 2 s, 4 s; then fail | 1 | on-call |
| Missing manifest / hash mismatch / schema / amount / date / currency / row count / control total | **No retry** (data won't fix itself). All errors collected with `file#L<line>`; no outputs produced. | 2 | on-call + source-system owner |
| Batch already completed | Skip | 0 | none |
| Lock held | Skip | 3 | warn if repeated |
| File-arrival trigger without `_READY` | Wait | 4 | late-arrival check at 09:00 |
| Unexpected exception | Top-level guard logs `RUN_FAILED`, writes failure alert, releases lock | 1 | on-call |
| Unexpected files in manifest | Logged `WARN`, processing continues | — | none |

Log events: `RUN_STARTED`, `FILES_VALIDATED`, `VALIDATION_FAILED`, `RETRYING`, `RETRY_EXHAUSTED`, `DUPLICATE_BATCH_SKIPPED`, `LOCK_HELD`, `NOT_READY`, `RUN_COMPLETED`, `RUN_FAILED`. Each line has UTC timestamp, `run_id`, level and fields. Monitoring should alert on failure events **and** on the absence of `RUN_COMPLETED` by a cut-off.

---

## 10. Least-privilege permission model

| Identity | May | May not |
|---|---|---|
| `svc-erp-export` / `svc-bank-sftp` | Write to own landing-zone prefix | Read outputs, read other prefixes |
| `svc-finance-control` (runner, managed identity) | **Read** landing zone; **create** objects in output store (no overwrite/delete — WORM); read/write ledger; read own Key Vault secrets | Any ERP or bank API; send mail; modify inputs; delete outputs |
| `svc-notify` (delivery service) | Read outbox; send from one shared mailbox/channel; write delivery receipts | Read input files; approve anything |
| AP / Treasury / Controls reviewers (groups) | Read register & summary; comment; decide on queue items for their category | Approve material items alone; change config |
| Controller | Approve material actions (≥ 10,000.00) | Approve own submissions |
| CFO | Read everything | — |
| Finance systems admin | Change config & deploy via pull request with second-person review | Approve finance actions |
| `svc-erp-action` (separate, optional) | Execute **only** approved `action_key`s (e.g., set payment hold) | Anything not approved; runs only from the approval workflow |

---

## 11. Human approval for material actions

* The runner never executes an action; every proposal lands in `approval_queue.csv` as `PENDING`.
* Non-material actions: one approver from the category's reviewer group.
* Material actions (`material = Y`): category reviewer **and** controller (two people).
* Approver ≠ invoice submitter ≠ action executor (segregation of duties).
* Approval record stores approver, timestamp and `action_key`; the executor checks the key has not already been executed.
* Changes to thresholds, routing or rules are themselves material: pull request + second reviewer + deployment record.

---

## 12. Deployment environment

| Item | Specification |
|---|---|
| Runtime | Python 3.10+ (tested on 3.13), **standard library only**; container image built from this folder |
| Environments | `dev` (synthetic data), `test` (masked/synthetic data, end-to-end with real triggers & delivery to a test mailbox), `prod` |
| Config | `control_config.json` per environment, version-controlled; secrets only via managed identity / Key Vault |
| CI | Run `python3 -m unittest discover -s tests` on every change; block merge on failure |
| Storage | Separate landing, output (WORM), ledger and log locations per environment |
| Time | Business date passed explicitly; scheduler timezone `America/Chicago`; logs in UTC |
| Retention | Inputs, outputs and logs retained per finance record policy (e.g., 7 years) |

---

## 13. Who does what: Claude vs. scripts vs. external services vs. people

### Claude can do (in a conversation or coding session, with files provided)
* Write and revise this design, the rule catalogue, configs and schemas.
* Write and test the runner and its unit tests (done here, against fictional data).
* Run the runner **on demand** against files supplied in the session and explain the results.
* Review an exception register or CFO summary and draft reviewer notes or commentary.
* Draft notification text, approval-request wording, runbooks and the go-live checklist.

### Claude cannot do on its own
* Run on a schedule or react to file arrivals unattended.
* Hold production credentials, connect to the ERP or bank, or send notifications as part of this design.
* Approve, execute or post any financial action.
* Act as the system of record for the ledger, approvals or audit trail.

### Requires scripts (code that runs without Claude)
* `src/daily_control.py` — validation, calculations, register, summary, outbox, approval queue, ledger (**written & tested locally**).
* Bank file normaliser (BAI2 / camt.053 → CSV + manifest) — **not written**.
* Scheduler wrapper computing previous business day with a holiday calendar — **not written**.
* Transactional ledger adapter (SQL/DynamoDB) — **not written**.

### Requires external automation services (must be configured and tested)
* Scheduler and/or storage-event trigger.
* Container runtime with managed identity.
* WORM output storage, secret store, log analytics and alerting.
* Notification delivery service consuming the outbox idempotently.
* Approval workflow / ticketing and the separate action-executor identity.
* ERP and bank export jobs producing files + manifest.

### Requires people
* Reviewers resolve exceptions; controller approves material actions; CFO reviews summary.
* Finance systems admin owns config changes (with second reviewer).
* Internal audit signs off rule design and permission model before go-live.

---

## 14. Testing strategy

| Level | Coverage | Status |
|---|---|---|
| Unit (local) | 13 tests: detection, determinism, rerun skip, reprocess dedup, corrected batch, tampered file, bad amount, missing manifest, lock, ready marker, retry success/exhaustion | **Passing** |
| Integration (test env) | Real trigger → runner → WORM store → delivery to test mailbox → approval workflow, using synthetic files | Not done |
| Failure drills | Late files, corrupted file, duplicate trigger, storage outage, delivery outage | Not done |
| Parallel run | 2–4 weeks alongside the manual control; reconcile results daily | Not done |

---

## 15. Go-live gates (activate nothing until each is checked and evidenced)

- [ ] Source-system manifest export built and validated against `config.inputs`
- [ ] Bank normaliser written, unit-tested, reconciled to statement totals
- [ ] Runner image built in CI, tests green
- [ ] Managed identities and permissions created exactly as §10; access review recorded
- [ ] WORM retention, ledger store and lock verified in test environment
- [ ] **Trigger** (schedule or file arrival) configured in test and observed firing; duplicate-trigger drill passes
- [ ] **Delivery service** configured; test notification received; resend drill shows no duplicate on same `routing_key`
- [ ] **Approval workflow** configured; material item requires two approvers; executor rejects unapproved key
- [ ] Alerts fire for `RUN_FAILED`, `VALIDATION_FAILED`, and missing `RUN_COMPLETED`
- [ ] Parallel run completed; differences explained; internal audit sign-off
- [ ] Production enablement change approved

Until the relevant box is ticked, documentation and status reports should say the capability is **designed but not active**.

---

## 16. Known limitations of the reference implementation

* Single currency (USD); multi-currency needs FX rates as a validated input.
* Fuzzy duplicate rule is amount-and-window only; no OCR or vendor-name similarity.
* Reconciliation matches by reference on the business date only; timing differences carried from prior days are not tracked yet.
* File-based ledger/lock is suitable for one runner instance; production needs a transactional store (§8).
* Stale lock after a hard kill must be cleared manually (logged as `LOCK_HELD`).
