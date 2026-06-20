"""Apply strong RevSports player matches from the audit CSV.

This writes only external_entity_links for rows classified as "strong".
It leaves review/no_likely_match rows untouched and writes a leftover CSV.
"""

from __future__ import annotations

import csv
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


AUDIT_PATH = Path("data/revsports-player-match-audit/player_match_audit.csv")
LEFTOVER_PATH = Path("data/revsports-player-match-audit/player_match_leftovers_after_strong_apply.csv")


def require_env(name: str, fallback: str | None = None) -> str:
    value = os.getenv(name) or fallback
    if not value:
        raise RuntimeError(f"{name} is required.")
    return value


def chunks(rows: list[dict[str, Any]], size: int) -> list[list[dict[str, Any]]]:
    return [rows[index:index + size] for index in range(0, len(rows), size)]


def main() -> None:
    if not AUDIT_PATH.exists():
        raise RuntimeError(f"Audit CSV not found: {AUDIT_PATH}")

    supabase_url = require_env("SUPABASE_URL")
    supabase_key = require_env("SUPABASE_SERVICE_KEY", os.getenv("SUPABASE_SERVICE_ROLE_KEY"))

    from supabase import create_client

    client = create_client(supabase_url, supabase_key)

    rows = list(csv.DictReader(AUDIT_PATH.open("r", encoding="utf-8", newline="")))
    strong_rows = [
        row for row in rows
        if row.get("classification") == "strong"
        and row.get("external_entity_id")
        and row.get("top_profile_id")
    ]

    now = datetime.now(timezone.utc).isoformat()
    upsert_rows = [
        {
            "external_entity_id": row["external_entity_id"],
            "target_table": "profiles",
            "target_id": row["top_profile_id"],
            "status": "matched",
            "confidence": "name_context",
            "matched_by": None,
            "matched_at": now,
            "notes": f"Applied from player_match_audit.csv strong match; score {row.get('top_score') or ''}.",
        }
        for row in strong_rows
    ]

    for batch in chunks(upsert_rows, 100):
        client.table("external_entity_links").upsert(
            batch,
            on_conflict="external_entity_id,target_table",
        ).execute()

    leftover_rows = [
        row for row in rows
        if row.get("classification") in {"review", "no_likely_match", "weak"}
    ]
    with LEFTOVER_PATH.open("w", encoding="utf-8", newline="") as csv_file:
        writer = csv.DictWriter(csv_file, fieldnames=rows[0].keys())
        writer.writeheader()
        writer.writerows(leftover_rows)

    print(f"Applied strong matches: {len(upsert_rows)}")
    print(f"Leftover rows written: {len(leftover_rows)}")
    print(f"Leftover CSV: {LEFTOVER_PATH}")


if __name__ == "__main__":
    main()
