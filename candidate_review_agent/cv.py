"""CV extraction and validation for plain-text CVs.

Only plain text is implemented and tested here. PDF/DOCX parsing is a design
item (see docs/candidate_review_agent.md) and is not part of this module.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field

from .schemas import ExceptionCode, ReviewException, Severity

MIN_CV_CHARS = 40
UNREADABLE_RATIO = 0.05  # share of non-printable characters above which the text is treated as unreadable

# Heading text (lowercased, colon stripped) -> section name.
SECTION_HEADINGS = {
    "experience": "experience",
    "work experience": "experience",
    "professional experience": "experience",
    "employment": "experience",
    "employment history": "experience",
    "work history": "experience",
    "education": "education",
    "academic background": "education",
    "skills": "skills",
    "technical skills": "skills",
    "core competencies": "skills",
    "certifications": "certifications",
    "certificates": "certifications",
    "licenses": "certifications",
    "projects": "projects",
    "languages": "languages",
    "summary": "summary",
    "profile": "summary",
    "professional summary": "summary",
    "objective": "summary",
    "interests": "interests",
}

# Sections whose text can count as documented evidence. Summary, interests and
# unsectioned text can only produce a "weak mention".
DOCUMENTED_SECTIONS = {"experience", "education", "skills", "certifications", "projects", "languages"}

# Protected-characteristic indicators. These are only used to EXCLUDE a line
# or flag a requirement. The agent never infers any of these characteristics.
PROTECTED_PATTERNS: dict[str, re.Pattern[str]] = {
    "date_of_birth": re.compile(r"\bdate of birth\b|\bd\.o\.b\b", re.IGNORECASE),
    "age": re.compile(r"\bage\b", re.IGNORECASE),
    "gender_or_sex": re.compile(r"\b(gender|sex)\b", re.IGNORECASE),
    "marital_status": re.compile(r"\bmarital\b", re.IGNORECASE),
    "nationality_or_origin": re.compile(r"\b(nationality|ethnicity|ethnic origin)\b", re.IGNORECASE),
    "religion": re.compile(r"\breligio(n|us)\b", re.IGNORECASE),
    "disability": re.compile(r"\bdisabilit(y|ies)\b", re.IGNORECASE),
    "sexual_orientation": re.compile(r"\bsexual orientation\b", re.IGNORECASE),
    "pregnancy_or_family": re.compile(r"\bpregnan(t|cy)\b", re.IGNORECASE),
}

EMAIL_RE = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
PHONE_RE = re.compile(r"\+?\d[\d\s().-]{7,}\d")


@dataclass
class CVLine:
    number: int  # 1-based line number in the original CV text
    section: str
    text: str
    excluded_category: str | None = None  # set when a protected-characteristic indicator is found


@dataclass
class CVDocument:
    lines: list[CVLine] = field(default_factory=list)
    emails: list[str] = field(default_factory=list)  # lowercased
    phones: list[str] = field(default_factory=list)  # digits only

    def usable_lines(self) -> list[CVLine]:
        return [line for line in self.lines if line.excluded_category is None and line.text]


def _heading_section(line: str) -> str | None:
    cleaned = line.strip().strip("#:-= ").lower()
    if len(cleaned) > 40:
        return None
    return SECTION_HEADINGS.get(cleaned)


def _normalise_phone(raw: str) -> str:
    return re.sub(r"\D", "", raw)


def extract_cv(cv_text: str) -> tuple[CVDocument, list[ReviewException]]:
    """Validate and structure CV text. Returns the document and any exceptions raised."""
    exceptions: list[ReviewException] = []
    doc = CVDocument()

    stripped = cv_text.strip()
    if not stripped:
        exceptions.append(ReviewException(ExceptionCode.CV_EMPTY, Severity.BLOCKING, "CV text is empty."))
        return doc, exceptions

    non_printable = sum(1 for ch in cv_text if not ch.isprintable() and ch not in "\n\r\t")
    if "\x00" in cv_text or non_printable / len(cv_text) > UNREADABLE_RATIO:
        exceptions.append(
            ReviewException(ExceptionCode.CV_UNREADABLE, Severity.BLOCKING, "CV text appears to be binary or corrupted.")
        )
        return doc, exceptions

    if len(stripped) < MIN_CV_CHARS:
        exceptions.append(
            ReviewException(
                ExceptionCode.CV_TOO_SHORT,
                Severity.BLOCKING,
                f"CV text has fewer than {MIN_CV_CHARS} characters; it may be incomplete.",
            )
        )
        return doc, exceptions

    current_section = "unsectioned"
    saw_heading = False
    for number, raw_line in enumerate(cv_text.splitlines(), start=1):
        text = raw_line.strip()
        if not text:
            continue
        heading = _heading_section(text)
        if heading:
            current_section = heading
            saw_heading = True
            continue

        category = next((name for name, pat in PROTECTED_PATTERNS.items() if pat.search(text)), None)
        doc.lines.append(CVLine(number=number, section=current_section, text=text, excluded_category=category))
        if category:
            exceptions.append(
                ReviewException(
                    ExceptionCode.PROTECTED_CONTENT_EXCLUDED,
                    Severity.REVIEW,
                    f"Line excluded from matching (indicator category: {category}). Text not stored; "
                    "a human should confirm whether it belongs in the CV at all.",
                    source_ref=f"cv:L{number}",
                )
            )

    doc.emails = sorted({m.lower() for m in EMAIL_RE.findall(cv_text)})
    # 9+ digits: excludes date ranges such as "2019-2024" (8 digits) that the loose pattern also matches.
    doc.phones = sorted({_normalise_phone(m) for m in PHONE_RE.findall(cv_text) if len(_normalise_phone(m)) >= 9})

    if not doc.emails and not doc.phones:
        exceptions.append(
            ReviewException(
                ExceptionCode.MISSING_CONTACT,
                Severity.REVIEW,
                "No email address or phone number found in the CV.",
            )
        )
    if not saw_heading:
        exceptions.append(
            ReviewException(
                ExceptionCode.SECTIONS_NOT_DETECTED,
                Severity.INFO,
                "No standard section headings detected; all text is treated as unsectioned (weak mentions only).",
            )
        )

    return doc, exceptions


def protected_indicator_categories(text: str) -> list[str]:
    """Categories of protected-characteristic indicators present in arbitrary text (used for requirements)."""
    return [name for name, pat in PROTECTED_PATTERNS.items() if pat.search(text)]
