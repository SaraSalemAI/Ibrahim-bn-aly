"""CLI: python -m candidate_review_agent --input review.json [--audit-log audit.jsonl]"""

from __future__ import annotations

import argparse
import json
import sys

from .agent import review_candidate
from .audit import AuditLog


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Build a candidate review record from documented CV information.")
    parser.add_argument("--input", required=True, help="Path to a JSON file matching the input schema.")
    parser.add_argument("--audit-log", help="Optional JSONL file to append audit entries to.")
    args = parser.parse_args(argv)

    try:
        with open(args.input, encoding="utf-8") as fh:
            payload = json.load(fh)
    except (OSError, json.JSONDecodeError) as exc:
        print(f"Could not read input file: {type(exc).__name__}", file=sys.stderr)
        return 2

    record = review_candidate(payload, AuditLog(args.audit_log) if args.audit_log else AuditLog())
    print(json.dumps(record.to_dict(), indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
