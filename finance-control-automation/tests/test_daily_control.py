"""Tests for the reference runner. Run: python3 -m unittest discover -s tests -v"""

import csv
import json
import shutil
import sys
import tempfile
import unittest
from argparse import Namespace
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

import daily_control as dc  # noqa: E402

CONFIG = ROOT / "config" / "control_config.json"
SAMPLE = ROOT / "sample_data" / "2026-10-09"
BD = "2026-10-09"


def read_csv(path):
    return list(csv.DictReader(path.read_text().splitlines()))


class RunnerTest(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())
        self.inputs = self.tmp / "in"
        shutil.copytree(SAMPLE, self.inputs)

    def tearDown(self):
        shutil.rmtree(self.tmp)

    def args(self, **kw):
        base = dict(config=str(CONFIG), business_date=BD, input_dir=str(self.inputs),
                    output_dir=str(self.tmp / "out"), state_dir=str(self.tmp / "state"),
                    log_dir=str(self.tmp / "logs"), trigger="manual", reprocess=False,
                    run_id=None, quiet=True)
        base.update(kw)
        return Namespace(**base)

    def run_ok(self, **kw):
        code = dc.run(self.args(**kw), sleep=lambda s: None)
        self.assertEqual(code, dc.EXIT_OK)

    def batch_dir(self, out="out"):
        dirs = list((self.tmp / out / BD).glob("B-*"))
        self.assertEqual(len(dirs), 1)
        return dirs[0]

    def outbox_lines(self, batch_dir):
        path = batch_dir / "routing_outbox.jsonl"
        return path.read_text().splitlines() if path.exists() else []

    def events(self):
        return [json.loads(l)["event"] for f in sorted((self.tmp / "logs").glob("*.jsonl"))
                for l in f.read_text().splitlines()]

    # -- detection --------------------------------------------------------- #

    def test_expected_exceptions_detected(self):
        self.run_ok()
        rows = (read_csv(self.batch_dir() / "exception_register.csv"))
        self.assertEqual(sorted(r["rule_id"] for r in rows), sorted([
            "DUP-EXACT", "DUP-FUZZY", "APR-MISSING", "SOD-SELF-APPROVAL", "APR-LIMIT",
            "REC-AMOUNT", "REC-BANK-ONLY", "REC-GL-ONLY"]))
        for r in rows:
            self.assertRegex(r["source_links"], r"\.csv#L\d+")
            self.assertTrue(r["source_file_sha256"])
            self.assertTrue(r["assigned_to"])
        calc = json.loads((self.batch_dir() / "calculations.json").read_text())
        rec = calc["cash_reconciliation"]
        self.assertEqual(rec["difference_bank_minus_gl"], "2185.00")
        self.assertEqual(rec["unexplained_difference"], "0.00")
        self.assertEqual(calc["ap"]["invoice_total"], "108980.45")

    def test_material_items_escalate_to_controller(self):
        self.run_ok()
        for r in read_csv(self.batch_dir() / "exception_register.csv"):
            self.assertEqual("controller@example.com" in r["assigned_to"], r["material"] == "Y")

    def test_deterministic_register(self):
        self.run_ok(output_dir=str(self.tmp / "a"), state_dir=str(self.tmp / "sa"))
        self.run_ok(output_dir=str(self.tmp / "b"), state_dir=str(self.tmp / "sb"))
        a = (self.batch_dir("a") / "exception_register.csv").read_bytes()
        b = (self.batch_dir("b") / "exception_register.csv").read_bytes()
        self.assertEqual(a, b)

    # -- idempotency ------------------------------------------------------- #

    def test_rerun_same_batch_is_skipped(self):
        self.run_ok()
        before = self.outbox_lines(self.batch_dir())
        self.run_ok()
        self.assertIn("DUPLICATE_BATCH_SKIPPED", self.events())
        self.assertEqual(self.outbox_lines(self.batch_dir()), before)

    def test_reprocess_does_not_duplicate_routing_or_actions(self):
        self.run_ok()
        d = self.batch_dir()
        outbox, queue = self.outbox_lines(d), (d / "approval_queue.csv").read_text()
        self.run_ok(reprocess=True)
        self.assertEqual(self.outbox_lines(d), outbox)
        self.assertEqual((d / "approval_queue.csv").read_text(), queue)

    def test_corrected_batch_routes_only_new_summary(self):
        self.run_ok()
        first = self.batch_dir()
        # Correct the GL amount for INV-1003 so REC-AMOUNT disappears; everything else unchanged.
        gl = self.inputs / "gl_cash_entries.csv"
        gl.write_text(gl.read_text().replace("-7020.00", "-7200.00"))
        dc.write_manifest(self.inputs, json.loads(CONFIG.read_text()), BD, "test")
        self.run_ok()
        second = [d for d in (self.tmp / "out" / BD).glob("B-*") if d != first]
        self.assertEqual(len(second), 1)
        register = list(read_csv(second[0] / "exception_register.csv"))
        self.assertNotIn("REC-AMOUNT", {r["rule_id"] for r in register})
        # Exceptions already routed from the first batch are not re-sent; only the new CFO summary is.
        drafts = [json.loads(l) for l in self.outbox_lines(second[0])]
        self.assertEqual([d["subject_id"] for d in drafts], [f"CFO-SUMMARY-{second[0].name}"])

    # -- validation and error handling ------------------------------------- #

    def test_tampered_file_fails_validation_closed(self):
        f = self.inputs / "bank_transactions.csv"
        f.write_text(f.read_text().replace("-35.00", "-3500.00"))
        code = dc.run(self.args(), sleep=lambda s: None)
        self.assertEqual(code, dc.EXIT_VALIDATION_FAILED)
        self.assertFalse(list((self.tmp / "out" / BD).glob("B-*")))
        failures = (self.tmp / "out" / BD / "failure_outbox.jsonl").read_text().splitlines()
        details = json.loads(failures[0])["details"]
        self.assertTrue(any("sha256" in d for d in details))
        self.assertTrue(any("control_total" in d for d in details))

    def test_missing_manifest_fails(self):
        (self.inputs / "manifest.json").unlink()
        self.assertEqual(dc.run(self.args(), sleep=lambda s: None), dc.EXIT_VALIDATION_FAILED)

    def test_bad_amount_reported_with_line(self):
        f = self.inputs / "ap_invoices.csv"
        f.write_text(f.read_text().replace("1180.45", "1180.455"))
        code = dc.run(self.args(), sleep=lambda s: None)
        self.assertEqual(code, dc.EXIT_VALIDATION_FAILED)
        log = "\n".join(p.read_text() for p in (self.tmp / "logs").glob("*.jsonl"))
        self.assertIn("ap_invoices.csv#L8: invalid amount", log)

    def test_lock_prevents_concurrent_runs(self):
        (self.tmp / "state").mkdir()
        (self.tmp / "state" / "run.lock").write_text("999\n")
        self.assertEqual(dc.run(self.args(), sleep=lambda s: None), dc.EXIT_LOCKED)

    def test_file_arrival_waits_for_ready_marker(self):
        self.assertEqual(dc.run(self.args(trigger="file_arrival"), sleep=lambda s: None), dc.EXIT_NOT_READY)
        (self.inputs / "_READY").touch()
        self.run_ok(trigger="file_arrival")

    def test_retries_transient_io_then_succeeds(self):
        calls = {"n": 0}
        delays = []

        def flaky():
            calls["n"] += 1
            if calls["n"] < 3:
                raise OSError("share unavailable")
            return "ok"

        log = dc.RunLog(self.tmp / "logs" / "r.jsonl", "t", quiet=True)
        self.assertEqual(dc.with_retries(flaky, what="x", log=log, attempts=3, base_delay=2.0,
                                         sleep=delays.append), "ok")
        self.assertEqual(delays, [2.0, 4.0])

    def test_retries_exhausted_raises(self):
        log = dc.RunLog(self.tmp / "logs" / "r.jsonl", "t", quiet=True)

        def always_fail():
            raise OSError("down")

        with self.assertRaises(OSError):
            dc.with_retries(always_fail, what="x", log=log, attempts=2, base_delay=0, sleep=lambda s: None)
        self.assertIn("RETRY_EXHAUSTED", (self.tmp / "logs" / "r.jsonl").read_text())


if __name__ == "__main__":
    unittest.main()
