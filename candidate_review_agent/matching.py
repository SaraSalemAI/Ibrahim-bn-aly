"""Requirement-to-evidence matching.

Matching is literal and case-insensitive. Every evidence item is a verbatim CV
line with a source reference, so nothing can be fabricated: the agent cites
text or reports that it did not find any.
"""

from __future__ import annotations

import re

from .cv import DOCUMENTED_SECTIONS, CVDocument, CVLine, protected_indicator_categories
from .schemas import (
    EvidenceItem,
    EvidenceStatus,
    ExceptionCode,
    Requirement,
    RequirementReview,
    ReviewException,
    Severity,
)

MAX_EVIDENCE_ITEMS = 5
MAX_EXCERPT_CHARS = 200


def _term_pattern(term: str) -> re.Pattern[str]:
    # Lookarounds instead of \b so terms such as "C++" or "B.Sc" still match correctly.
    return re.compile(rf"(?<![A-Za-z0-9]){re.escape(term)}(?![A-Za-z0-9])", re.IGNORECASE)


def _source_ref(line: CVLine) -> str:
    return f"cv:L{line.number} (section: {line.section})"


def _excerpt(text: str) -> str:
    return text if len(text) <= MAX_EXCERPT_CHARS else text[: MAX_EXCERPT_CHARS - 1] + "…"


def match_requirement(doc: CVDocument, requirement: Requirement) -> tuple[RequirementReview, list[ReviewException]]:
    exceptions: list[ReviewException] = []

    def review(status: EvidenceStatus, missing: str | None, documented=None, weak=None) -> RequirementReview:
        return RequirementReview(
            requirement_id=requirement.requirement_id,
            requirement=requirement.text,
            required=requirement.required,
            evidence_status=status,
            documented_evidence=documented or [],
            weak_mentions=weak or [],
            missing_information=missing,
        )

    # Requirements must be job-related. Wording that touches a protected
    # characteristic is not matched; a human must rewrite it.
    flagged = protected_indicator_categories(requirement.text) + [
        cat for term in requirement.match_terms for cat in protected_indicator_categories(term)
    ]
    if flagged:
        exceptions.append(
            ReviewException(
                ExceptionCode.NON_JOB_RELATED_REQUIREMENT,
                Severity.REVIEW,
                f"Requirement {requirement.requirement_id} contains protected-characteristic wording "
                f"(category: {sorted(set(flagged))[0]}) and was not matched. Rewrite it as a job-related requirement.",
                source_ref=f"requirement:{requirement.requirement_id}",
            )
        )
        return review(
            EvidenceStatus.NOT_ASSESSABLE,
            "Requirement wording is not job-related and was not assessed.",
        ), exceptions

    if not requirement.match_terms:
        exceptions.append(
            ReviewException(
                ExceptionCode.REQUIREMENT_NOT_ASSESSABLE,
                Severity.REVIEW if requirement.required else Severity.INFO,
                f"Requirement {requirement.requirement_id} has no match terms; a human must assess it.",
                source_ref=f"requirement:{requirement.requirement_id}",
            )
        )
        return review(
            EvidenceStatus.NOT_ASSESSABLE,
            "No match terms defined; a reviewer must assess this requirement manually.",
        ), exceptions

    patterns = [_term_pattern(t) for t in requirement.match_terms]
    documented: list[EvidenceItem] = []
    weak: list[EvidenceItem] = []
    for line in doc.usable_lines():
        if not any(p.search(line.text) for p in patterns):
            continue
        item = EvidenceItem(excerpt=_excerpt(line.text), source_ref=_source_ref(line))
        (documented if line.section in DOCUMENTED_SECTIONS else weak).append(item)

    documented = documented[:MAX_EVIDENCE_ITEMS]
    weak = weak[:MAX_EVIDENCE_ITEMS]

    if documented:
        return review(EvidenceStatus.DOCUMENTED, None, documented=documented, weak=weak), exceptions

    terms_text = ", ".join(requirement.match_terms)
    if weak:
        missing = (
            f"Terms ({terms_text}) appear only in summary, interests or unsectioned text. "
            "Confirm the candidate's experience with them."
        )
        status = EvidenceStatus.WEAK_MENTION
    else:
        missing = f"No CV text matches the terms: {terms_text}."
        status = EvidenceStatus.NOT_FOUND

    exceptions.append(
        ReviewException(
            ExceptionCode.REQUIREMENT_NOT_DOCUMENTED,
            Severity.REVIEW if requirement.required else Severity.INFO,
            f"Requirement {requirement.requirement_id} is not documented in a qualifying CV section "
            f"(status: {status.value}). This is a gap to confirm, not a finding against the candidate.",
            source_ref=f"requirement:{requirement.requirement_id}",
        )
    )
    return review(status, missing, weak=weak), exceptions


def not_assessed(requirement: Requirement, reason: str) -> RequirementReview:
    """Placeholder used when the CV itself could not be read, so no 'not found' is claimed."""
    return RequirementReview(
        requirement_id=requirement.requirement_id,
        requirement=requirement.text,
        required=requirement.required,
        evidence_status=EvidenceStatus.NOT_ASSESSABLE,
        missing_information=reason,
    )
