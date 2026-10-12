"""Task sequence for the Candidate Record Review Agent.

Order: validate input -> extract and validate CV -> duplicate checks ->
requirement-to-evidence matching -> choose checkpoints and next step -> record.
Each step is isolated: a failure is logged, turned into a blocking
PROCESSING_ERROR, and routed to a human. The agent never rejects a candidate.
"""

from __future__ import annotations

from typing import Any, Callable, TypeVar

from .audit import AuditLog
from .cv import extract_cv
from .duplicates import check_duplicates
from .matching import match_requirement, not_assessed
from .schemas import (
    Checkpoint,
    EvidenceStatus,
    ExceptionCode,
    HumanReviewStatus,
    NextStep,
    ReviewException,
    ReviewInput,
    ReviewRecord,
    RequirementReview,
    Severity,
    parse_input,
)

T = TypeVar("T")

INPUT_CODES = {ExceptionCode.SCHEMA_INVALID, ExceptionCode.CV_EMPTY, ExceptionCode.CV_TOO_SHORT, ExceptionCode.CV_UNREADABLE}
DUPLICATE_CODES = {ExceptionCode.DUPLICATE_STRONG, ExceptionCode.DUPLICATE_POSSIBLE}
GAP_STATUSES = {EvidenceStatus.NOT_FOUND, EvidenceStatus.WEAK_MENTION, EvidenceStatus.NOT_ASSESSABLE}


def _run_step(
    name: str,
    fn: Callable[[], T],
    audit: AuditLog,
    candidate_id: str,
    vacancy_id: str,
    exceptions: list[ReviewException],
) -> T | None:
    try:
        result = fn()
    except Exception as exc:  # the agent must always return a record; the failure goes to a human
        audit.record(name, "error", candidate_id, vacancy_id, error_type=type(exc).__name__)
        exceptions.append(
            ReviewException(
                ExceptionCode.PROCESSING_ERROR,
                Severity.BLOCKING,
                f"Step '{name}' failed ({type(exc).__name__}). Human investigation required.",
            )
        )
        return None
    audit.record(name, "ok", candidate_id, vacancy_id)
    return result


def _checkpoints(exceptions: list[ReviewException], reviews: list[RequirementReview]) -> list[Checkpoint]:
    codes = {e.code for e in exceptions}
    checkpoints = [Checkpoint.RECRUITER_REVIEW]
    if codes & INPUT_CODES:
        checkpoints.append(Checkpoint.INPUT_CORRECTION)
    if codes & DUPLICATE_CODES:
        checkpoints.append(Checkpoint.DUPLICATE_REVIEW)
    if ExceptionCode.PROTECTED_CONTENT_EXCLUDED in codes:
        checkpoints.append(Checkpoint.PROTECTED_CONTENT_CHECK)
    if ExceptionCode.NON_JOB_RELATED_REQUIREMENT in codes:
        checkpoints.append(Checkpoint.REQUIREMENT_WORDING_REVIEW)
    if any(r.required and r.evidence_status in GAP_STATUSES for r in reviews):
        checkpoints.append(Checkpoint.EVIDENCE_CONFIRMATION)
    if ExceptionCode.PROCESSING_ERROR in codes:
        checkpoints.append(Checkpoint.PROCESSING_ERROR_REVIEW)
    return checkpoints


def _next_step(exceptions: list[ReviewException], reviews: list[RequirementReview]) -> NextStep:
    codes = {e.code for e in exceptions}
    if ExceptionCode.PROCESSING_ERROR in codes:
        return NextStep.INVESTIGATE_ERROR
    if codes & INPUT_CODES:
        return NextStep.OBTAIN_VALID_INPUT
    if ExceptionCode.DUPLICATE_STRONG in codes:
        return NextStep.RESOLVE_DUPLICATE
    if any(r.required and r.evidence_status != EvidenceStatus.DOCUMENTED for r in reviews):
        return NextStep.CONFIRM_EVIDENCE
    return NextStep.RECRUITER_REVIEW


def _ids(payload: Any) -> tuple[str, str]:
    if not isinstance(payload, dict):
        return "UNKNOWN", "UNKNOWN"
    cid = payload.get("candidate_id")
    vid = payload.get("vacancy_id")
    return (
        cid.strip() if isinstance(cid, str) and cid.strip() else "UNKNOWN",
        vid.strip() if isinstance(vid, str) and vid.strip() else "UNKNOWN",
    )


def _blocked_record(candidate_id: str, vacancy_id: str, exceptions: list[ReviewException], review_input: ReviewInput | None = None) -> ReviewRecord:
    reviews = [
        not_assessed(r, "Input or CV could not be validated; requirement was not assessed.")
        for r in (review_input.requirements if review_input else ())
    ]
    return ReviewRecord(
        candidate_id=candidate_id,
        vacancy_id=vacancy_id,
        requirement_reviews=reviews,
        exceptions=exceptions,
        human_review_status=HumanReviewStatus.PENDING,
        review_checkpoints=_checkpoints(exceptions, reviews),
        recommended_next_step=_next_step(exceptions, reviews),
    )


def review_candidate(payload: Any, audit: AuditLog | None = None) -> ReviewRecord:
    audit = audit or AuditLog()
    candidate_id, vacancy_id = _ids(payload)
    exceptions: list[ReviewException] = []

    review_input, errors = parse_input(payload)
    if review_input is None:
        audit.record("validate_input", "rejected", candidate_id, vacancy_id, error_count=len(errors))
        exceptions.append(
            ReviewException(
                ExceptionCode.SCHEMA_INVALID,
                Severity.BLOCKING,
                "Input does not match the schema: " + "; ".join(errors),
            )
        )
        record = _blocked_record(candidate_id, vacancy_id, exceptions)
        _log_outcome(audit, record)
        return record

    candidate_id, vacancy_id = review_input.candidate_id, review_input.vacancy_id
    audit.record("validate_input", "ok", candidate_id, vacancy_id, requirement_count=len(review_input.requirements))

    extraction = _run_step(
        "extract_cv", lambda: extract_cv(review_input.cv_text), audit, candidate_id, vacancy_id, exceptions
    )
    if extraction is None:
        record = _blocked_record(candidate_id, vacancy_id, exceptions, review_input)
        _log_outcome(audit, record)
        return record

    doc, cv_exceptions = extraction
    exceptions.extend(cv_exceptions)
    cv_blocked = any(e.severity is Severity.BLOCKING for e in cv_exceptions)
    if cv_blocked:
        record = _blocked_record(candidate_id, vacancy_id, exceptions, review_input)
        _log_outcome(audit, record)
        return record

    duplicate_exceptions = _run_step(
        "duplicate_check",
        lambda: check_duplicates(candidate_id, review_input.candidate_name, doc, review_input.known_candidates),
        audit,
        candidate_id,
        vacancy_id,
        exceptions,
    )
    if duplicate_exceptions:
        exceptions.extend(duplicate_exceptions)

    matched = _run_step(
        "match_requirements",
        lambda: [match_requirement(doc, r) for r in review_input.requirements],
        audit,
        candidate_id,
        vacancy_id,
        exceptions,
    )
    if matched is None:
        reviews = [not_assessed(r, "Matching failed; requirement was not assessed.") for r in review_input.requirements]
    else:
        reviews = []
        for review, review_exceptions in matched:
            reviews.append(review)
            exceptions.extend(review_exceptions)

    record = ReviewRecord(
        candidate_id=candidate_id,
        vacancy_id=vacancy_id,
        requirement_reviews=reviews,
        exceptions=exceptions,
        human_review_status=HumanReviewStatus.PENDING,
        review_checkpoints=_checkpoints(exceptions, reviews),
        recommended_next_step=_next_step(exceptions, reviews),
    )
    _log_outcome(audit, record)
    return record


def _log_outcome(audit: AuditLog, record: ReviewRecord) -> None:
    audit.record(
        "build_record",
        "ok",
        record.candidate_id,
        record.vacancy_id,
        exception_codes=sorted({e.code.value for e in record.exceptions}),
        checkpoints=[c.value for c in record.review_checkpoints],
        recommended_next_step=record.recommended_next_step.value,
        human_review_status=record.human_review_status.value,
    )
