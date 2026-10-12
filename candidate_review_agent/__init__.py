"""Candidate Record Review Agent (fictional recruitment department tooling).

Organises documented candidate information and compares it with approved,
job-related requirements. It never rejects, ranks or hires candidates.
"""

from .agent import review_candidate
from .audit import AuditLog
from .schemas import NextStep, HumanReviewStatus, ReviewRecord

__all__ = ["review_candidate", "AuditLog", "NextStep", "HumanReviewStatus", "ReviewRecord"]
