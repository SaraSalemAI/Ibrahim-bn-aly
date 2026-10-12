"""Data contracts for the Candidate Record Review Agent.

The agent organises documented information. It never produces a decision
(reject, shortlist, hire); the output enums below deliberately contain no such
values.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from enum import Enum
from typing import Any


class EvidenceStatus(str, Enum):
    DOCUMENTED = "documented"  # term found in an experience, skills, education, certification, project or language section
    WEAK_MENTION = "weak_mention"  # term found only in summary, interests or unsectioned text
    NOT_FOUND = "not_found"  # no usable CV text matches the requirement
    NOT_ASSESSABLE = "not_assessable"  # no match terms, unreadable CV, or non-job-related wording


class Severity(str, Enum):
    BLOCKING = "blocking"  # no reliable record can be produced until a human acts
    REVIEW = "review"  # record is produced, but a human checkpoint is required
    INFO = "info"


class ExceptionCode(str, Enum):
    SCHEMA_INVALID = "SCHEMA_INVALID"
    CV_EMPTY = "CV_EMPTY"
    CV_TOO_SHORT = "CV_TOO_SHORT"
    CV_UNREADABLE = "CV_UNREADABLE"
    SECTIONS_NOT_DETECTED = "SECTIONS_NOT_DETECTED"
    MISSING_CONTACT = "MISSING_CONTACT"
    PROTECTED_CONTENT_EXCLUDED = "PROTECTED_CONTENT_EXCLUDED"
    NON_JOB_RELATED_REQUIREMENT = "NON_JOB_RELATED_REQUIREMENT"
    REQUIREMENT_NOT_ASSESSABLE = "REQUIREMENT_NOT_ASSESSABLE"
    REQUIREMENT_NOT_DOCUMENTED = "REQUIREMENT_NOT_DOCUMENTED"
    DUPLICATE_STRONG = "DUPLICATE_STRONG"
    DUPLICATE_POSSIBLE = "DUPLICATE_POSSIBLE"
    PROCESSING_ERROR = "PROCESSING_ERROR"


class Checkpoint(str, Enum):
    RECRUITER_REVIEW = "recruiter_review"  # always present: a person reads the record before anything else happens
    INPUT_CORRECTION = "input_correction"
    DUPLICATE_REVIEW = "duplicate_review"
    PROTECTED_CONTENT_CHECK = "protected_content_check"
    REQUIREMENT_WORDING_REVIEW = "requirement_wording_review"
    EVIDENCE_CONFIRMATION = "evidence_confirmation"
    PROCESSING_ERROR_REVIEW = "processing_error_review"


class HumanReviewStatus(str, Enum):
    # The agent can only leave a record pending. Approval and any decision
    # are recorded by people outside this agent.
    PENDING = "pending_human_review"


class NextStep(str, Enum):
    OBTAIN_VALID_INPUT = "obtain_valid_input_and_rerun"
    RESOLVE_DUPLICATE = "human_resolve_duplicate_record"
    CONFIRM_EVIDENCE = "request_candidate_or_recruiter_confirmation"
    INVESTIGATE_ERROR = "human_investigate_processing_error"
    RECRUITER_REVIEW = "recruiter_review_of_documented_evidence"


@dataclass(frozen=True)
class Requirement:
    requirement_id: str
    text: str
    required: bool = True
    match_terms: tuple[str, ...] = ()


@dataclass(frozen=True)
class ReviewInput:
    candidate_id: str
    vacancy_id: str
    cv_text: str
    requirements: tuple[Requirement, ...]
    candidate_name: str | None = None
    known_candidates: tuple[dict[str, Any], ...] = ()


@dataclass
class ReviewException:
    code: ExceptionCode
    severity: Severity
    message: str  # templated text only; never CV content
    source_ref: str | None = None


@dataclass
class EvidenceItem:
    excerpt: str  # verbatim line from the CV
    source_ref: str  # e.g. "cv:L12 (section: experience)"


@dataclass
class RequirementReview:
    requirement_id: str
    requirement: str
    required: bool
    evidence_status: EvidenceStatus
    documented_evidence: list[EvidenceItem] = field(default_factory=list)
    weak_mentions: list[EvidenceItem] = field(default_factory=list)
    missing_information: str | None = None


@dataclass
class ReviewRecord:
    candidate_id: str
    vacancy_id: str
    requirement_reviews: list[RequirementReview]
    exceptions: list[ReviewException]
    human_review_status: HumanReviewStatus
    review_checkpoints: list[Checkpoint]
    recommended_next_step: NextStep

    def to_dict(self) -> dict[str, Any]:
        return _plain(asdict(self))


def _plain(value: Any) -> Any:
    """Convert enums to their values so the record serialises to plain JSON."""
    if isinstance(value, Enum):
        return value.value
    if isinstance(value, dict):
        return {k: _plain(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [_plain(v) for v in value]
    return value


def parse_input(payload: Any) -> tuple[ReviewInput | None, list[str]]:
    """Validate the input schema. Returns (input, errors); errors name fields only, never values."""
    errors: list[str] = []
    if not isinstance(payload, dict):
        return None, ["payload must be a JSON object"]

    for key in ("candidate_id", "vacancy_id"):
        if not isinstance(payload.get(key), str) or not payload[key].strip():
            errors.append(f"{key} must be a non-empty string")

    if not isinstance(payload.get("cv_text"), str):
        errors.append("cv_text must be a string (may be empty; the CV checks handle that)")

    name = payload.get("candidate_name")
    if name is not None and not isinstance(name, str):
        errors.append("candidate_name must be a string or omitted")

    known = payload.get("known_candidates", [])
    if not isinstance(known, list) or not all(isinstance(k, dict) and "candidate_id" in k for k in known):
        errors.append("known_candidates must be a list of objects that each have candidate_id")

    requirements: list[Requirement] = []
    raw_reqs = payload.get("requirements")
    if not isinstance(raw_reqs, list) or not raw_reqs:
        errors.append("requirements must be a non-empty list")
    else:
        for i, raw in enumerate(raw_reqs):
            if not isinstance(raw, dict):
                errors.append(f"requirements[{i}] must be an object")
                continue
            rid, text = raw.get("requirement_id"), raw.get("text")
            terms = raw.get("match_terms", [])
            required = raw.get("required", True)
            item_ok = True
            if not isinstance(rid, str) or not rid.strip():
                errors.append(f"requirements[{i}].requirement_id must be a non-empty string")
                item_ok = False
            if not isinstance(text, str) or not text.strip():
                errors.append(f"requirements[{i}].text must be a non-empty string")
                item_ok = False
            if not isinstance(terms, list) or not all(isinstance(t, str) and t.strip() for t in terms):
                errors.append(f"requirements[{i}].match_terms must be a list of non-empty strings")
                item_ok = False
            if not isinstance(required, bool):
                errors.append(f"requirements[{i}].required must be a boolean")
                item_ok = False
            if item_ok:
                requirements.append(
                    Requirement(
                        requirement_id=rid.strip(),
                        text=text.strip(),
                        required=required,
                        match_terms=tuple(t.strip() for t in terms),
                    )
                )

    if errors:
        return None, errors

    return (
        ReviewInput(
            candidate_id=payload["candidate_id"].strip(),
            vacancy_id=payload["vacancy_id"].strip(),
            cv_text=payload["cv_text"],
            requirements=tuple(requirements),
            candidate_name=name.strip() if name else None,
            known_candidates=tuple(known),
        ),
        [],
    )
