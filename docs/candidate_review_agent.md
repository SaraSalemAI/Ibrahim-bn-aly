# Candidate Record Review Agent

Design and reference implementation for the fictional company's recruitment department.

**Objective:** organise candidate information and compare documented qualifications with approved, job-related requirements, so a recruiter can review a structured record.

**Hard limits:** the agent does not reject candidates, make hiring decisions, infer protected characteristics, or fabricate qualifications.

---

## 1. Status: what is built versus proposed

| Area | Status | Where |
|---|---|---|
| Input validation, schema-level errors | **Implemented, tested** | `schemas.parse_input` (TC-16) |
| Plain-text CV extraction, sections, line references | **Implemented, tested** | `cv.extract_cv` (TC-01) |
| CV validation: empty, unreadable, too short, missing contact | **Implemented, tested** | `cv.extract_cv` (TC-02 to TC-05) |
| Protected-characteristic indicator exclusion | **Implemented, tested** (keyword rules only) | `cv.PROTECTED_PATTERNS` (TC-12, TC-13) |
| Requirement-to-evidence matching (literal terms) | **Implemented, tested** | `matching.py` (TC-06 to TC-09) |
| Duplicate checks (shared email/phone, similar name) | **Implemented, tested** | `duplicates.py` (TC-10, TC-11) |
| Exception classification, checkpoints, next step | **Implemented, tested** | `agent.py`, `schemas.py` |
| Error isolation per step, blocking PROCESSING_ERROR | **Implemented, tested** via injected faults | TC-17, TC-18 |
| JSONL audit log (no CV content) | **Implemented, tested** | `audit.py` (TC-19) |
| CLI for one candidate record | **Implemented, tested** | `__main__.py` (TC-20) |
| PDF and DOCX CV parsing | **Proposed, not built, not tested** | Section 9 |
| Semantic (non-literal) matching, e.g. "k8s" = "Kubernetes" | **Proposed, not built, not tested** | Section 9 |
| Storage of records, batch processing, ATS integration | **Proposed, not built, not tested** | Section 9 |
| Access control, retention policy, bias review of matching terms | **Proposed, requires organisational sign-off** | Section 9 |

Nothing in the "proposed" rows has been executed. Test results cover only the implemented rows.

---

## 2. Scope

**In scope:** one candidate against one vacancy, per run. Structuring documented information, citing sources, listing gaps, and routing the record to humans.

**Out of scope:** scoring, ranking, shortlisting, rejecting, recommending a hire, contacting candidates, inferring anything not written in the CV, and using protected characteristics (age, gender, nationality, religion, disability, marital or family status, pregnancy, sexual orientation, ethnic origin) in any way.

---

## 3. Input schema

```json
{
  "candidate_id": "CND-1001",            // required, non-empty string
  "vacancy_id": "VAC-2026-07",           // required, non-empty string
  "candidate_name": "Jordan Example",    // optional, used only for duplicate checks
  "cv_text": "…plain text…",             // required string; may be empty (checked later)
  "requirements": [                      // required, non-empty list
    {
      "requirement_id": "REQ-01",        // required
      "text": "Hands-on experience with Python",   // required
      "required": true,                  // optional boolean, default true
      "match_terms": ["Python"]          // list of strings; empty = human must assess
    }
  ],
  "known_candidates": [                  // optional; existing records to check for duplicates
    {"candidate_id": "CND-0412", "name": "J. Example", "email": "…", "phone": "…"}
  ]
}
```

Schema errors name the failing field only, never the value, so error messages cannot leak candidate data.

## 4. Output schema: structured candidate review record

| Spec field | Where it appears |
|---|---|
| Candidate ID | `candidate_id` |
| Vacancy ID | `vacancy_id` |
| Requirement | `requirement_reviews[].requirement` (plus `requirement_id`, `required`) |
| Documented evidence | `requirement_reviews[].documented_evidence[]` with `excerpt` and `source_ref` |
| Source reference | `source_ref` on each evidence item, e.g. `cv:L9 (section: experience)` |
| Evidence status | `requirement_reviews[].evidence_status`: `documented`, `weak_mention`, `not_found`, `not_assessable` |
| Missing information | `requirement_reviews[].missing_information` |
| Human review status | `human_review_status`, always `pending_human_review` |
| Recommended next step | `recommended_next_step` |

Supporting fields: `weak_mentions[]` (matches only in summary or interests text), `exceptions[]` (code, severity, templated message, source ref), and `review_checkpoints[]`.

The output enums contain no reject, shortlist, score, rank or hire values. `human_review_status` can only be `pending_human_review`. Approval happens outside the agent.

---

## 5. Task sequence

```
1. validate_input         schema check; on failure -> SCHEMA_INVALID (blocking), stop
2. extract_cv             sections, line numbers, contacts, protected-indicator exclusion
                          blocking CV issue -> skip matching, requirements = not_assessable, stop
3. duplicate_check        shared email/phone -> DUPLICATE_STRONG; similar name -> DUPLICATE_POSSIBLE
4. match_requirements     literal, case-insensitive term matching per requirement
5. build_record           checkpoints, recommended next step, record with pending status
6. audit                  one JSONL entry per step (IDs, outcome, codes, counts only)
```

Each step is isolated. An exception in a step is logged as `error` with only the exception class name, becomes a blocking `PROCESSING_ERROR`, and routes the record to `human_investigate_processing_error`. The agent always returns a record.

## 6. CV extraction and validation

- **Empty** (after trimming): `CV_EMPTY`, blocking. The record does not say "not found", because nothing was read.
- **Unreadable** (NUL bytes, or more than 5% non-printable characters): `CV_UNREADABLE`, blocking.
- **Too short** (under 40 characters): `CV_TOO_SHORT`, blocking.
- **No email and no phone**: `MISSING_CONTACT`, review. Phone numbers need at least 9 digits, which excludes date ranges such as `2019-2024`. This was a real bug caught by TC-05.
- **No headings found**: `SECTIONS_NOT_DETECTED`, info. All text is then "unsectioned", so it can only give weak mentions.
- Recognised headings include Experience, Education, Skills, Certifications, Projects, Languages, Summary, Profile and Interests. Each line keeps its original line number.

**Protected-characteristic indicators.** A line that matches an indicator (for example date of birth, age, gender, marital status, nationality, religion, disability, pregnancy) is excluded from matching. The record stores only the category and line number, never the text. A `PROTECTED_CONTENT_EXCLUDED` review item sends the CV to a human to confirm whether that content belongs there at all. The agent never guesses a characteristic from names, photos or other cues. These are keyword rules and will produce false positives (for example, "age" in an unrelated sentence). A false positive costs a human check, not a wrong decision.

## 7. Requirement-to-evidence matching

- Matching is literal and case-insensitive, on word boundaries (lookarounds, so `C++` and `B.Sc` work).
- Only usable lines (not excluded) are searched.
- Hits in `experience`, `education`, `skills`, `certifications`, `projects` or `languages` are **documented**. Hits only in `summary`, `interests` or unsectioned text are a **weak mention**. No hit is **not_found**. A requirement with no terms, or with protected-characteristic wording, is **not_assessable**.
- At most 5 evidence items per requirement, each excerpt capped at 200 characters. Every excerpt is a verbatim CV line.
- **Requirements must be job-related.** A requirement whose text or terms match a protected indicator (for example "Age under 35") is not matched. It gets a `NON_JOB_RELATED_REQUIREMENT` review item so a human rewrites it.
- A not_found result is a gap to confirm, not a finding against the candidate. Its exception is `REQUIREMENT_NOT_DOCUMENTED` (review if required, info if optional).

## 8. Missing-information handling, duplicates, exceptions and checkpoints

**Duplicates.** Checked against `known_candidates` only, never merged or deleted.
- Shared email or phone: `DUPLICATE_STRONG` (review). Next step: `human_resolve_duplicate_record`.
- Name similarity ≥ 0.9 with no shared contact: `DUPLICATE_POSSIBLE` (review), with a duplicate checkpoint but no change to the next step.
- The record names only the other candidate's ID, not their contact details.

**Exception codes** and severity: `SCHEMA_INVALID`, `CV_EMPTY`, `CV_TOO_SHORT`, `CV_UNREADABLE` (blocking); `PROCESSING_ERROR` (blocking); `DUPLICATE_STRONG`, `DUPLICATE_POSSIBLE`, `PROTECTED_CONTENT_EXCLUDED`, `NON_JOB_RELATED_REQUIREMENT`, `REQUIREMENT_NOT_ASSESSABLE`, `MISSING_CONTACT` (review); `REQUIREMENT_NOT_DOCUMENTED` (review if required, info if optional); `SECTIONS_NOT_DETECTED` (info).

**Review checkpoints:** `recruiter_review` is always present. The others are `input_correction`, `duplicate_review`, `protected_content_check`, `requirement_wording_review`, `evidence_confirmation` (a required requirement is not documented) and `processing_error_review`.

**Recommended next step**, in precedence order:

1. `human_investigate_processing_error`, if a processing error occurred
2. `obtain_valid_input_and_rerun`, if a blocking input or CV issue exists
3. `human_resolve_duplicate_record`, if a strong duplicate exists
4. `request_candidate_or_recruiter_confirmation`, if any required requirement is not documented
5. `recruiter_review_of_documented_evidence`, otherwise

## 9. Error handling, audit logging, and proposed extensions

**Audit log.** JSONL, append-only, one entry per step: `timestamp`, `step`, `outcome`, `candidate_id`, `vacancy_id`, plus codes or counts. CV text, excerpts, emails and phone numbers are never written to it (TC-19 checks this).

**Proposed, not built or tested:**
- **PDF/DOCX extraction.** Candidate tools: `pypdf` or `pdfplumber` for PDF, `python-docx` for DOCX, with OCR (Tesseract) for scanned CVs. Extraction quality would need its own test set.
- **Semantic matching.** An LLM or embedding model could match synonyms. It would need an evidence-only prompt, a rule that every claim cites a CV line, and a check that rejects any citation not present in the CV. Until that exists, literal matching keeps fabrication impossible by construction.
- **Persistence and integration.** Record storage, batch runs, and ATS or HRIS connectors, each with access control and a retention policy.
- **Governance.** Human sign-off on the matching terms and protected-indicator list, since these affect what gets excluded or matched. A bias review of the term lists before live use.

## 10. Test cases and success criteria

Run with `python -m unittest` from the repository root. All 21 cases pass.

| ID | Case | Success criterion |
|---|---|---|
| TC-01 | Sections and line numbers | Sections assigned correctly; line numbers match the source |
| TC-02 | Empty CV | `CV_EMPTY` blocking; requirements not_assessable (not not_found); next step obtain valid input |
| TC-03 | Binary content | `CV_UNREADABLE` blocking |
| TC-04 | Very short CV | `CV_TOO_SHORT` blocking |
| TC-05 | No contact details | `MISSING_CONTACT` review; record still produced |
| TC-06 | Documented requirement | `documented`; `source_ref` points to the cited line, which matches the excerpt |
| TC-07 | Missing required evidence | `not_found`; missing info filled; next step confirm evidence; no decision field |
| TC-08 | Term only in summary | `weak_mention`; no documented evidence |
| TC-09 | Requirement with no terms | `not_assessable`; `REQUIREMENT_NOT_ASSESSABLE` raised |
| TC-10 | Shared email with existing record | `DUPLICATE_STRONG`; next step resolve duplicate; input not mutated |
| TC-11 | Name similarity only | `DUPLICATE_POSSIBLE`; not blocking |
| TC-12 | Protected line in CV | Line excluded; its content never appears in output |
| TC-13 | Non-job-related requirement | Not matched; wording review checkpoint |
| TC-14 | Output contract | Exact key sets; status always pending; no decision-type fields |
| TC-15 | No fabrication | Every excerpt is a verbatim CV line at the cited line number |
| TC-16 | Schema violation | `SCHEMA_INVALID` blocking; message names fields, not values |
| TC-17 | Extraction fault injected | `PROCESSING_ERROR`; record still returned; routed to a human |
| TC-18 | Matching fault injected | Requirements not_assessable, never not_found |
| TC-19 | Audit log | Expected steps present; no CV content in the log |
| TC-20 | CLI on sample input | Exit 0; valid JSON; expected candidate ID |
| TC-21 | Determinism | Same input gives an identical record |

**Overall success criteria:** all 21 cases pass; no output field can carry a rejection or hiring decision; no evidence is produced without a CV citation; every run ends with a pending human review.

**Not yet tested:** real-world CVs (PDF, DOCX, multiple languages), synonym matching, scale, and any integration. The sample candidate in `examples/` is fictional.

## 11. Tools and execution environment

**Used to build and test this version:**
- Python 3.13 (the only version tested). Standard library only: `dataclasses`, `enum`, `re`, `difflib`, `json`, `argparse`, `unittest`, `pathlib`.
- No third-party packages. `pytest` is optional and not required.
- Any OS with a shell. The run needs read access to the input JSON and write access to the audit log directory.

**Required for the proposed extensions (not installed or tested):**
- PDF: `pypdf` or `pdfplumber`. DOCX: `python-docx`. Scanned CVs: Tesseract OCR with `pytesseract`.
- Semantic matching: an LLM API or an embedding model, with an evidence-only prompt and citation validation.
- Storage: a database such as PostgreSQL, with access control and audit retention.

**Operational requirements:** data-protection review before processing real candidate data, a retention policy for audit logs and records, and human owners for the term and protected-indicator lists.

## 12. Running it

```bash
python -m unittest                                              # 21 tests
python -m candidate_review_agent --input examples/sample_input.json \
       --audit-log out/audit.jsonl                              # one record to stdout
```

The sample output for `examples/sample_input.json` recommends `human_resolve_duplicate_record`. The sample candidate shares an email with existing record `CND-0412`, so the duplicate check runs first.
