"""
Dry-run plan for promoting RevSports player appearances into lineups.

This does not write to Supabase. It answers:
- which attended appearances can be linked to a fixture and profile
- which rows already exist in lineups
- which rows are blocked by missing fixture/profile
"""

from __future__ import annotations

import argparse
import csv
import os
from collections import Counter, defaultdict
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from supabase import create_client

OUTPUT_DIR = Path("data/revsports-readiness")
PAGE_SIZE = 1000


def fetch_all(client: Any, table: str, columns: str = "*") -> list[dict]:
    rows: list[dict] = []
    for start in range(0, 200000, PAGE_SIZE):
        result = client.table(table).select(columns).range(start, start + PAGE_SIZE - 1).execute()
        batch = result.data or []
        rows.extend(batch)
        if len(batch) < PAGE_SIZE:
            break
    return rows


def write_csv(path: Path, rows: list[dict]) -> None:
    if not rows:
        path.write_text("", encoding="utf-8")
        return
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)


def bool_value(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    return str(value or "").strip().lower() in {"1", "true", "yes", "y"}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true", help="Insert ready lineup rows. Default is dry-run only.")
    args = parser.parse_args()

    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SUPABASE_SERVICE_KEY")
    if not url or not key:
        raise SystemExit("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY/SUPABASE_SERVICE_KEY.")

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    client = create_client(url, key)

    source_matches = fetch_all(
        client,
        "source_revsports_matches",
        "id,association_name,match_url,grade,round_name,game_date,home_team_name,away_team_name",
    )
    appearances = fetch_all(
        client,
        "source_revsports_player_appearances",
        "id,match_id,appearance_key,team_side,club_name,team_name,revsports_team_id,player_name,revsports_player_id,attended,is_removed",
    )
    fixtures = fetch_all(client, "fixtures", "id,revsports_match_url,home_team_id,away_team_id")
    profiles = fetch_all(client, "profiles", "id,first_name,last_name,revsports_player_id,is_placeholder")
    lineups = fetch_all(client, "lineups", "id,fixture_id,player_id,position,is_starting")

    match_by_id = {row["id"]: row for row in source_matches if row.get("id")}
    fixture_by_match_url = {
        row.get("revsports_match_url"): row
        for row in fixtures
        if row.get("revsports_match_url")
    }
    profile_by_revsports_id = {
        row.get("revsports_player_id"): row
        for row in profiles
        if row.get("revsports_player_id")
    }
    existing_lineup_keys = {
        (row.get("fixture_id"), row.get("player_id"))
        for row in lineups
        if row.get("fixture_id") and row.get("player_id")
    }

    stats: Counter = Counter(total_appearances=len(appearances))
    stats_by_association: dict[str, Counter] = defaultdict(Counter)
    ready_rows: list[dict] = []
    blocker_rows: list[dict] = []

    for appearance in appearances:
        match = match_by_id.get(appearance.get("match_id"))
        association = (match or {}).get("association_name") or "Unknown"
        stats_by_association[association]["total"] += 1

        if not bool_value(appearance.get("attended")):
            stats["skipped_not_attended"] += 1
            stats_by_association[association]["skipped_not_attended"] += 1
            continue
        if bool_value(appearance.get("is_removed")):
            stats["skipped_removed"] += 1
            stats_by_association[association]["skipped_removed"] += 1
            continue

        fixture = fixture_by_match_url.get((match or {}).get("match_url"))
        profile = profile_by_revsports_id.get(appearance.get("revsports_player_id"))
        row = {
            "association": association,
            "match_url": (match or {}).get("match_url"),
            "fixture_id": (fixture or {}).get("id"),
            "team_id": (fixture or {}).get("home_team_id") if appearance.get("team_side") == "home" else (fixture or {}).get("away_team_id"),
            "profile_id": (profile or {}).get("id"),
            "player_name": appearance.get("player_name"),
            "revsports_player_id": appearance.get("revsports_player_id"),
            "team_name": appearance.get("team_name"),
            "grade": (match or {}).get("grade"),
            "round_name": (match or {}).get("round_name"),
            "appearance_key": appearance.get("appearance_key"),
        }

        if not fixture:
            stats["blocked_missing_fixture"] += 1
            stats_by_association[association]["blocked_missing_fixture"] += 1
            row["blocker"] = "missing_fixture"
            blocker_rows.append(row)
            continue
        if not profile:
            stats["blocked_missing_profile"] += 1
            stats_by_association[association]["blocked_missing_profile"] += 1
            row["blocker"] = "missing_profile"
            blocker_rows.append(row)
            continue

        team_id = row.get("team_id")
        if not team_id:
            stats["blocked_missing_team"] += 1
            stats_by_association[association]["blocked_missing_team"] += 1
            row["blocker"] = "missing_team"
            blocker_rows.append(row)
            continue

        if (fixture["id"], profile["id"]) in existing_lineup_keys:
            stats["already_exists"] += 1
            stats_by_association[association]["already_exists"] += 1
            row["action"] = "already_exists"
        else:
            stats["ready_to_insert"] += 1
            stats_by_association[association]["ready_to_insert"] += 1
            row["action"] = "insert_lineup"
        ready_rows.append(row)

    summary_rows = []
    for association, counts in sorted(stats_by_association.items()):
        summary_rows.append({
            "association": association,
            "total": counts["total"],
            "ready_to_insert": counts["ready_to_insert"],
            "already_exists": counts["already_exists"],
            "blocked_missing_fixture": counts["blocked_missing_fixture"],
            "blocked_missing_profile": counts["blocked_missing_profile"],
            "blocked_missing_team": counts["blocked_missing_team"],
            "skipped_not_attended": counts["skipped_not_attended"],
            "skipped_removed": counts["skipped_removed"],
        })

    write_csv(OUTPUT_DIR / "lineup_promotion_summary.csv", summary_rows)
    write_csv(OUTPUT_DIR / "lineup_promotion_ready.csv", ready_rows)
    write_csv(OUTPUT_DIR / "lineup_promotion_blockers.csv", blocker_rows)

    report_lines = [
        "# RevSports Lineup Promotion Plan",
        "",
        f"Generated: {datetime.now(UTC).isoformat()}",
        "",
        "This is a dry-run report only. It does not insert or update lineups.",
        "",
        "## Summary",
        "",
        f"Mode: {'APPLY' if args.apply else 'DRY RUN'}",
        "",
        "| Association | Total | Ready | Existing | Missing Fixture | Missing Profile | Missing Team | Not Attended | Removed |",
        "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
    ]
    report_lines.extend(
        f"| {row['association']} | {row['total']} | {row['ready_to_insert']} | {row['already_exists']} | {row['blocked_missing_fixture']} | {row['blocked_missing_profile']} | {row['blocked_missing_team']} | {row['skipped_not_attended']} | {row['skipped_removed']} |"
        for row in summary_rows
    )
    report_lines.extend([
        "",
        "## Files",
        "",
        "- lineup_promotion_summary.csv",
        "- lineup_promotion_ready.csv",
        "- lineup_promotion_blockers.csv",
    ])
    (OUTPUT_DIR / "lineup_promotion_plan.md").write_text("\n".join(report_lines) + "\n", encoding="utf-8")

    if args.apply:
        insert_rows = [
            {
                "fixture_id": row["fixture_id"],
                "team_id": row["team_id"],
                "player_id": row["profile_id"],
                "position": "Player",
                "is_starting": True,
            }
            for row in ready_rows
            if row.get("action") == "insert_lineup"
        ]
        for start in range(0, len(insert_rows), 200):
            client.table("lineups").upsert(
                insert_rows[start:start + 200],
                on_conflict="fixture_id,player_id",
            ).execute()
        print(f"Inserted/upserted lineup rows: {len(insert_rows)}")

    print(f"Wrote {OUTPUT_DIR / 'lineup_promotion_plan.md'}")
    print(dict(stats))


if __name__ == "__main__":
    main()
