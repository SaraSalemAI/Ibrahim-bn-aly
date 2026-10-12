"""Append-only JSONL audit log.

Entries carry step names, outcomes, IDs and counts only. CV text, contact
details and excerpts are never written here.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


class AuditLog:
    def __init__(self, path: str | Path | None = None) -> None:
        self.path = Path(path) if path else None
        self.entries: list[dict[str, Any]] = []
        if self.path:
            self.path.parent.mkdir(parents=True, exist_ok=True)

    def record(self, step: str, outcome: str, candidate_id: str, vacancy_id: str, **details: Any) -> None:
        entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "step": step,
            "outcome": outcome,
            "candidate_id": candidate_id,
            "vacancy_id": vacancy_id,
            **details,
        }
        self.entries.append(entry)
        if self.path:
            with self.path.open("a", encoding="utf-8") as fh:
                fh.write(json.dumps(entry, ensure_ascii=False) + "\n")
