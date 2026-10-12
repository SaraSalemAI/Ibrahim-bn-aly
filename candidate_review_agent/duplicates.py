"""Duplicate record checks. Flags only; never merges or deletes records."""

from __future__ import annotations

from difflib import SequenceMatcher
from typing import Any

from .cv import CVDocument
from .schemas import ExceptionCode, ReviewException, Severity

NAME_SIMILARITY_THRESHOLD = 0.9


def _norm_name(name: str) -> str:
    return " ".join(name.lower().split())


def check_duplicates(
    candidate_id: str,
    candidate_name: str | None,
    doc: CVDocument,
    known_candidates: tuple[dict[str, Any], ...],
) -> list[ReviewException]:
    exceptions: list[ReviewException] = []
    own_emails = set(doc.emails)
    own_phones = set(doc.phones)
    own_name = _norm_name(candidate_name) if candidate_name else None

    for other in known_candidates:
        other_id = str(other.get("candidate_id", ""))
        if not other_id or other_id == candidate_id:
            continue

        other_emails = {str(e).strip().lower() for e in other.get("emails", []) if str(e).strip()}
        if other.get("email"):
            other_emails.add(str(other["email"]).strip().lower())
        other_phones = {"".join(ch for ch in str(p) if ch.isdigit()) for p in other.get("phones", [])}
        if other.get("phone"):
            other_phones.add("".join(ch for ch in str(other["phone"]) if ch.isdigit()))

        shared = []
        if own_emails & other_emails:
            shared.append("email")
        if own_phones & {p for p in other_phones if p}:
            shared.append("phone")
        if shared:
            exceptions.append(
                ReviewException(
                    ExceptionCode.DUPLICATE_STRONG,
                    Severity.REVIEW,
                    f"Shares {' and '.join(shared)} with existing record {other_id}. "
                    "Not merged; a human must decide whether these are the same person.",
                    source_ref=f"record:{other_id}",
                )
            )
            continue

        other_name = other.get("name")
        if own_name and other_name:
            similarity = SequenceMatcher(None, own_name, _norm_name(str(other_name))).ratio()
            if similarity >= NAME_SIMILARITY_THRESHOLD:
                exceptions.append(
                    ReviewException(
                        ExceptionCode.DUPLICATE_POSSIBLE,
                        Severity.REVIEW,
                        f"Name is very similar to existing record {other_id} (no shared contact details). "
                        "Human check recommended.",
                        source_ref=f"record:{other_id}",
                    )
                )

    return exceptions
