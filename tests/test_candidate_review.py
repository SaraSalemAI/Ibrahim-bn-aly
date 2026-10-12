"""Test cases TC-01 to TC-21 from docs/candidate_review_agent.md.

Run from the repository root:  python -m unittest
"""

from __future__ import annotations

import copy
import json
import pathlib
import tempfile
import unittest
from unittest import mock

from candidate_review_agent import AuditLog, review_candidate
from candidate_review_agent.cv import extract_cv
from candidate_review_agent.schemas import (
    Checkpoint,
    EvidenceStatus,
    ExceptionCode,
    HumanReviewStatus,
    NextStep,
)

ROOT = pathlib.Path(__file__).resolve().parent.parent
SAMPLE_PATH = ROOT / "examples" / "sample_input.json"

CV = (
    "Alex Sample\n"
    "alex.sample@mail.example | +44 20 7946 0000\n\n"
    "Experience\n"
    "Data Engineer, Example Logistics (2019-2024)\n"
    "- Wrote Python ETL jobs and scheduled them with cron\n\n"
    "Education\n"
    "BSc Computer Science, Example University (2018)\n\n"
    "Skills\n"
    "Python, SQL, Git\n"
)


def payload(cv_text: str = CV, requirements=None, **overrides):
    base = {
        "candidate_id": "CND-TEST-1",
        "vacancy_id": "VAC-TEST-1",
        "candidate_name": "Alex Sample",
        "cv_text": cv_text,
        "requirements": requirements
        if requirements is not None
        else [
            {"requirement_id": "R1", "text": "Python experience", "match_terms": ["Python"]},
            {"requirement_id": "R2", "text": "Kubernetes experience", "match_terms": ["Kubernetes"]},
        ],
        "known_candidates": [],
    }
    base.update(overrides)
    return base


def codes(record) -> set[ExceptionCode]:
    return {e.code for e in record.exceptions}


class CVExtractionTests(unittest.TestCase):
    def test_tc01_sections_and_line_numbers(self):
        doc, exceptions = extract_cv(CV)
        self.assertEqual(exceptions, [])
        by_text = {line.text: line for line in doc.lines}
        self.assertEqual(by_text["- Wrote Python ETL jobs and scheduled them with cron"].section, "experience")
        self.assertEqual(by_text["Python, SQL, Git"].section, "skills")
        self.assertEqual(by_text["Python, SQL, Git"].number, CV.splitlines().index("Python, SQL, Git") + 1)
        self.assertEqual(doc.emails, ["alex.sample@mail.example"])

    def test_tc02_empty_cv_is_blocking_and_not_reported_as_missing(self):
        record = review_candidate(payload(cv_text="   \n  "))
        self.assertIn(ExceptionCode.CV_EMPTY, codes(record))
        self.assertTrue(all(r.evidence_status is EvidenceStatus.NOT_ASSESSABLE for r in record.requirement_reviews))
        self.assertEqual(record.recommended_next_step, NextStep.OBTAIN_VALID_INPUT)
        self.assertIn(Checkpoint.INPUT_CORRECTION, record.review_checkpoints)

    def test_tc03_binary_content_is_unreadable(self):
        record = review_candidate(payload(cv_text="PK\x00\x03\x04" + "\x01\x02\x03" * 40))
        self.assertIn(ExceptionCode.CV_UNREADABLE, codes(record))
        self.assertEqual(record.recommended_next_step, NextStep.OBTAIN_VALID_INPUT)

    def test_tc04_too_short_cv_is_blocking(self):
        record = review_candidate(payload(cv_text="Alex Sample, Python"))
        self.assertIn(ExceptionCode.CV_TOO_SHORT, codes(record))

    def test_tc05_missing_contact_is_review_not_blocking(self):
        cv = CV.replace("alex.sample@mail.example | +44 20 7946 0000\n", "")
        record = review_candidate(payload(cv_text=cv))
        self.assertIn(ExceptionCode.MISSING_CONTACT, codes(record))
        self.assertTrue(record.requirement_reviews)  # a record is still produced
        self.assertNotEqual(record.recommended_next_step, NextStep.OBTAIN_VALID_INPUT)


class MatchingTests(unittest.TestCase):
    def test_tc06_documented_requirement_cites_real_line(self):
        record = review_candidate(payload())
        r1 = record.requirement_reviews[0]
        self.assertIs(r1.evidence_status, EvidenceStatus.DOCUMENTED)
        self.assertTrue(r1.documented_evidence)
        ref = r1.documented_evidence[0].source_ref
        self.assertTrue(ref.startswith("cv:L"))
        line_no = int(ref.split()[0][4:].rstrip(")"))
        self.assertEqual(CV.splitlines()[line_no - 1].strip(), r1.documented_evidence[0].excerpt)

    def test_tc07_missing_required_evidence_is_gap_not_rejection(self):
        record = review_candidate(payload())
        r2 = record.requirement_reviews[1]
        self.assertIs(r2.evidence_status, EvidenceStatus.NOT_FOUND)
        self.assertIn("Kubernetes", r2.missing_information)
        self.assertEqual(record.recommended_next_step, NextStep.CONFIRM_EVIDENCE)
        self.assertIn(Checkpoint.EVIDENCE_CONFIRMATION, record.review_checkpoints)

    def test_tc08_term_only_in_summary_is_weak_mention(self):
        cv = CV.replace("Experience\n", "Summary\nKeen on Kubernetes in my own time.\n\nExperience\n")
        record = review_candidate(payload(cv_text=cv))
        r2 = record.requirement_reviews[1]
        self.assertIs(r2.evidence_status, EvidenceStatus.WEAK_MENTION)
        self.assertFalse(r2.documented_evidence)
        self.assertTrue(r2.weak_mentions)

    def test_tc09_requirement_without_terms_is_not_assessable(self):
        reqs = [{"requirement_id": "R1", "text": "Team player", "match_terms": []}]
        record = review_candidate(payload(requirements=reqs))
        self.assertIs(record.requirement_reviews[0].evidence_status, EvidenceStatus.NOT_ASSESSABLE)
        self.assertIn(ExceptionCode.REQUIREMENT_NOT_ASSESSABLE, codes(record))


class DuplicateAndExclusionTests(unittest.TestCase):
    def test_tc10_strong_duplicate_by_email_is_flagged_not_merged(self):
        known = [{"candidate_id": "CND-OLD-9", "name": "Someone Else", "email": "ALEX.SAMPLE@mail.example"}]
        before = copy.deepcopy(known)
        record = review_candidate(payload(known_candidates=known))
        self.assertIn(ExceptionCode.DUPLICATE_STRONG, codes(record))
        self.assertEqual(record.recommended_next_step, NextStep.RESOLVE_DUPLICATE)
        self.assertIn(Checkpoint.DUPLICATE_REVIEW, record.review_checkpoints)
        self.assertEqual(known, before)  # input not mutated; nothing merged

    def test_tc11_name_only_similarity_is_possible_duplicate(self):
        known = [{"candidate_id": "CND-OLD-8", "name": "Alex Sample"}]
        record = review_candidate(payload(known_candidates=known))
        self.assertIn(ExceptionCode.DUPLICATE_POSSIBLE, codes(record))
        self.assertNotIn(ExceptionCode.DUPLICATE_STRONG, codes(record))
        self.assertNotEqual(record.recommended_next_step, NextStep.RESOLVE_DUPLICATE)

    def test_tc12_protected_line_excluded_and_content_not_emitted(self):
        cv = CV + "Date of birth: 1 Jan 1990\n"
        record = review_candidate(payload(cv_text=cv))
        self.assertIn(ExceptionCode.PROTECTED_CONTENT_EXCLUDED, codes(record))
        self.assertIn(Checkpoint.PROTECTED_CONTENT_CHECK, record.review_checkpoints)
        self.assertNotIn("1 Jan 1990", json.dumps(record.to_dict()))
        self.assertNotIn("Date of birth", json.dumps(record.to_dict()))

    def test_tc13_non_job_related_requirement_is_not_matched(self):
        reqs = [{"requirement_id": "R9", "text": "Age under 35", "match_terms": ["Python"]}]
        record = review_candidate(payload(requirements=reqs))
        self.assertIs(record.requirement_reviews[0].evidence_status, EvidenceStatus.NOT_ASSESSABLE)
        self.assertIn(ExceptionCode.NON_JOB_RELATED_REQUIREMENT, codes(record))
        self.assertIn(Checkpoint.REQUIREMENT_WORDING_REVIEW, record.review_checkpoints)


class OutputContractTests(unittest.TestCase):
    EXPECTED_RECORD_KEYS = {
        "candidate_id",
        "vacancy_id",
        "requirement_reviews",
        "exceptions",
        "human_review_status",
        "review_checkpoints",
        "recommended_next_step",
    }
    EXPECTED_REVIEW_KEYS = {
        "requirement_id",
        "requirement",
        "required",
        "evidence_status",
        "documented_evidence",
        "weak_mentions",
        "missing_information",
    }

    def test_tc14_contract_has_no_decision_fields_and_is_always_pending(self):
        record = review_candidate(payload())
        data = record.to_dict()
        self.assertEqual(set(data), self.EXPECTED_RECORD_KEYS)
        for review in data["requirement_reviews"]:
            self.assertEqual(set(review), self.EXPECTED_REVIEW_KEYS)
        self.assertEqual(data["human_review_status"], HumanReviewStatus.PENDING.value)
        next_steps = {step.value for step in NextStep}
        self.assertIn(data["recommended_next_step"], next_steps)
        for forbidden in ("reject", "hire", "decision", "shortlist", "score", "rank"):
            self.assertNotIn(forbidden, " ".join(data).lower())

    def test_tc15_no_fabricated_evidence(self):
        record = review_candidate(payload())
        lines = CV.splitlines()
        for review in record.requirement_reviews:
            for item in review.documented_evidence + review.weak_mentions:
                line_no = int(item.source_ref.split()[0][4:])
                self.assertEqual(lines[line_no - 1].strip(), item.excerpt)
                self.assertIn(item.excerpt, CV)

    def test_tc21_same_input_gives_same_record(self):
        first = review_candidate(payload()).to_dict()
        second = review_candidate(payload()).to_dict()
        self.assertEqual(first, second)


class InputAndErrorTests(unittest.TestCase):
    def test_tc16_schema_violation_is_blocking_and_names_fields_only(self):
        bad = payload()
        del bad["candidate_id"]
        bad["requirements"] = [{"requirement_id": "", "text": "x", "match_terms": "Python"}]
        record = review_candidate(bad)
        self.assertIn(ExceptionCode.SCHEMA_INVALID, codes(record))
        message = next(e.message for e in record.exceptions if e.code is ExceptionCode.SCHEMA_INVALID)
        self.assertIn("candidate_id", message)
        self.assertIn("match_terms", message)
        self.assertNotIn("Python", message)
        self.assertEqual(record.recommended_next_step, NextStep.OBTAIN_VALID_INPUT)

    def test_tc17_extraction_failure_produces_record_routed_to_human(self):
        with mock.patch("candidate_review_agent.agent.extract_cv", side_effect=RuntimeError("boom")):
            record = review_candidate(payload())
        self.assertIn(ExceptionCode.PROCESSING_ERROR, codes(record))
        self.assertEqual(record.recommended_next_step, NextStep.INVESTIGATE_ERROR)
        self.assertIn(Checkpoint.PROCESSING_ERROR_REVIEW, record.review_checkpoints)
        self.assertEqual(record.human_review_status, HumanReviewStatus.PENDING)

    def test_tc18_matching_failure_marks_requirements_not_assessed(self):
        with mock.patch("candidate_review_agent.agent.match_requirement", side_effect=ValueError("bad")):
            record = review_candidate(payload())
        self.assertIn(ExceptionCode.PROCESSING_ERROR, codes(record))
        self.assertTrue(all(r.evidence_status is EvidenceStatus.NOT_ASSESSABLE for r in record.requirement_reviews))
        self.assertNotIn("NOT_FOUND", json.dumps(record.to_dict()))


class AuditTests(unittest.TestCase):
    def test_tc19_audit_log_has_steps_and_no_cv_content(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = pathlib.Path(tmp) / "audit.jsonl"
            review_candidate(payload(), AuditLog(path))
            lines = path.read_text(encoding="utf-8").splitlines()
            entries = [json.loads(line) for line in lines]
            steps = [e["step"] for e in entries]
            for expected in ("validate_input", "extract_cv", "duplicate_check", "match_requirements", "build_record"):
                self.assertIn(expected, steps)
            raw = path.read_text(encoding="utf-8")
            for secret in ("alex.sample@mail.example", "Example Logistics", "+44 20 7946 0000", "Wrote Python"):
                self.assertNotIn(secret, raw)

    def test_tc20_cli_runs_on_sample_and_returns_valid_json(self):
        import io
        import contextlib
        from candidate_review_agent.__main__ import main

        out = io.StringIO()
        with contextlib.redirect_stdout(out):
            code = main(["--input", str(SAMPLE_PATH)])
        self.assertEqual(code, 0)
        data = json.loads(out.getvalue())
        self.assertEqual(data["candidate_id"], "CND-1001")
        self.assertEqual(data["recommended_next_step"], NextStep.RESOLVE_DUPLICATE.value)


ARABIC_CV = (
    "نور الدين مثال\n"
    "nour@mail.example\n\n"
    "الخبرة العملية:\n"
    "محلل بيانات في شركة مثال، استخدام Python و SQL\n\n"
    "التعليم\n"
    "بكالوريوس إحصاء، جامعة مثال\n\n"
    "اللغات\n"
    "العربية، English\n\n"
    "البيانات الشخصية\n"
    "العمر: ٣١\n"
    "الجنسية: مثال\n"
    "الحالة الاجتماعية: متزوج\n"
)


class ArabicTests(unittest.TestCase):
    def test_tc22_arabic_headings_give_documented_evidence(self):
        reqs = [
            {"requirement_id": "R1", "text": "Python", "match_terms": ["Python"]},
            {"requirement_id": "R2", "text": "بكالوريوس", "match_terms": ["بكالوريوس"]},
            {"requirement_id": "R3", "text": "العربية", "match_terms": ["العربية"]},
        ]
        record = review_candidate(payload(cv_text=ARABIC_CV, requirements=reqs, candidate_name="نور الدين مثال"))
        refs = {r.requirement_id: (r.evidence_status, r.documented_evidence[0].source_ref if r.documented_evidence else None) for r in record.requirement_reviews}
        self.assertEqual(refs["R1"], (EvidenceStatus.DOCUMENTED, "cv:L5 (section: experience)"))
        self.assertEqual(refs["R2"], (EvidenceStatus.DOCUMENTED, "cv:L8 (section: education)"))
        self.assertEqual(refs["R3"], (EvidenceStatus.DOCUMENTED, "cv:L11 (section: languages)"))
        self.assertNotIn(ExceptionCode.SECTIONS_NOT_DETECTED, codes(record))

    def test_tc23_arabic_protected_lines_excluded_with_categories(self):
        record = review_candidate(payload(cv_text=ARABIC_CV, requirements=[{"requirement_id": "R1", "text": "x", "match_terms": ["مثال"]}]))
        excluded = {e.source_ref: e.message for e in record.exceptions if e.code is ExceptionCode.PROTECTED_CONTENT_EXCLUDED}
        self.assertIn("age", excluded["cv:L14"])
        self.assertIn("nationality_or_origin", excluded["cv:L15"])
        self.assertIn("marital_status", excluded["cv:L16"])
        # A name containing الدين is not treated as religion, and excluded lines never become evidence.
        self.assertNotIn("cv:L1", excluded)
        cited = {item.source_ref for r in record.requirement_reviews for item in r.documented_evidence + r.weak_mentions}
        self.assertFalse(any(ref.startswith(("cv:L14 ", "cv:L15 ", "cv:L16 ")) for ref in cited))
        self.assertNotIn("الجنسية: مثال", json.dumps(record.to_dict(), ensure_ascii=False))

    def test_tc24_arabic_non_job_related_requirement_is_flagged(self):
        reqs = [{"requirement_id": "R1", "text": "العمر أقل من 35 سنة", "match_terms": ["Python"]}]
        record = review_candidate(payload(requirements=reqs))
        self.assertIs(record.requirement_reviews[0].evidence_status, EvidenceStatus.NOT_ASSESSABLE)
        self.assertIn(ExceptionCode.NON_JOB_RELATED_REQUIREMENT, codes(record))


if __name__ == "__main__":
    unittest.main()
