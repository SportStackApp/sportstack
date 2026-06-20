"""
Create a read-only RevSports import readiness report.

The report checks:
- mapping completion
- staged fixtures and byes
- fixture import completeness
- player appearance mapping readiness
- recent source change-log activity

It does not write to Supabase.
"""

from __future__ import annotations

import csv
import os
from collections import Counter, defaultdict
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from supabase import create_client

OUTPUT_DIR = Path("data/revsports-readiness")
PAGE_SIZE = 1000

ENTITY_TARGET_TABLE = {
    "competition": "competitions",
    "club": "clubs",
    "team": "teams",
    "player": "profiles",
    "grade": "divisions",
    "venue": "venues",
    "pitch": "pitches",
}


def fetch_all(client: Any, table: str, columns: str = "*") -> list[dict]:
    rows: list[dict] = []
    for start in range(0, 200000, PAGE_SIZE):
        result = client.table(table).select(columns).range(start, start + PAGE_SIZE - 1).execute()
        batch = result.data or []
        rows.extend(batch)
        if len(batch) < PAGE_SIZE:
            break
    return rows


def is_bye_match(row: dict) -> bool:
    raw_data = row.get("raw_data") or {}
    raw_bye = str(raw_data.get("is_bye") or "").strip().lower()
    return str(row.get("match_url") or "").startswith("revsports-bye|") or raw_bye in {"1", "true", "yes", "y"}


def write_csv(path: Path, rows: list[dict]) -> None:
    if not rows:
        path.write_text("", encoding="utf-8")
        return
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)


def pct(part: int, total: int) -> str:
    if total == 0:
        return "0%"
    return f"{part / total:.1%}"


def main() -> None:
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SUPABASE_SERVICE_KEY")
    if not url or not key:
        raise SystemExit("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY/SUPABASE_SERVICE_KEY.")

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    client = create_client(url, key)

    entities = fetch_all(
        client,
        "external_entities",
        "id,entity_type,external_id,external_name,association_name,competition_name,grade,club_name,team_name,last_seen_at,status",
    )
    links = fetch_all(client, "external_entity_links", "external_entity_id,target_table,target_id,status")
    source_matches = fetch_all(
        client,
        "source_revsports_matches",
        "id,association_name,competition_name,grade,round_name,round_number,match_url,game_date,game_time,venue_name,pitch_name,home_team_name,home_revsports_team_id,away_team_name,away_revsports_team_id,home_score,away_score,raw_data,last_seen_at",
    )
    source_appearances = fetch_all(
        client,
        "source_revsports_player_appearances",
        "id,match_id,appearance_key,team_side,club_name,team_name,revsports_team_id,player_name,revsports_player_id,attended,is_removed,goals,green_cards,yellow_cards,red_cards,last_seen_at",
    )
    fixtures = fetch_all(
        client,
        "fixtures",
        "id,revsports_match_url,fixture_date,home_team_id,away_team_id,venue_id,pitch_id,division_id,season_id,status,home_score,away_score,round_number",
    )
    profiles = fetch_all(client, "profiles", "id,first_name,last_name,revsports_player_id,is_placeholder")
    changes = fetch_all(client, "source_revsports_change_log", "source_table,source_key,field_name,detected_at")
    player_registry = fetch_all(
        client,
        "revsports_player_registry",
        "revsports_player_id,association,player_name,season_attended,season_goals,season_green_cards,season_yellow_cards,season_red_cards,profile_id",
    )
    player_history = fetch_all(
        client,
        "revsports_player_history",
        "revsports_player_id,association,player_name,season_year,season_attended,season_goals,season_green_cards,season_yellow_cards,season_red_cards",
    )

    link_by_entity = {
        row["external_entity_id"]: row
        for row in links
        if row.get("status") == "matched" and row.get("target_id")
    }

    mapping_rows = []
    for entity_type, target_table in ENTITY_TARGET_TABLE.items():
        typed_entities = [row for row in entities if row.get("entity_type") == entity_type]
        matched = [
            row for row in typed_entities
            if link_by_entity.get(row["id"], {}).get("target_table") == target_table
        ]
        mapping_rows.append({
            "entity_type": entity_type,
            "target_table": target_table,
            "total": len(typed_entities),
            "matched": len(matched),
            "unmatched": len(typed_entities) - len(matched),
            "matched_percent": pct(len(matched), len(typed_entities)),
        })

    fixture_by_url = {row.get("revsports_match_url"): row for row in fixtures if row.get("revsports_match_url")}
    source_urls = {row.get("match_url") for row in source_matches if row.get("match_url")}
    current_fixtures = [fixture_by_url[url] for url in source_urls if url in fixture_by_url]

    fixture_rows = []
    source_by_association = Counter(row.get("association_name") or "Unknown" for row in source_matches)
    byes_by_association = Counter((row.get("association_name") or "Unknown") for row in source_matches if is_bye_match(row))
    for association, total in sorted(source_by_association.items()):
        association_urls = {row.get("match_url") for row in source_matches if row.get("association_name") == association}
        imported = [fixture_by_url[url] for url in association_urls if url in fixture_by_url]
        missing_key_fields = sum(
            1 for row in imported
            if any(row.get(field) in (None, "") for field in ["home_team_id", "division_id", "season_id"])
        )
        fixture_rows.append({
            "association": association,
            "source_matches": total,
            "source_byes": byes_by_association[association],
            "imported_fixtures": len(imported),
            "missing_fixture_import": total - len(imported),
            "missing_home_division_or_season": missing_key_fields,
        })

    player_entity_by_external_id = {
        row.get("external_id"): row
        for row in entities
        if row.get("entity_type") == "player" and row.get("external_id")
    }
    profile_by_revsports_id = {
        row.get("revsports_player_id"): row
        for row in profiles
        if row.get("revsports_player_id")
    }

    appearance_rows = []
    appearance_by_association: dict[str, Counter] = defaultdict(Counter)
    player_leftovers = []
    match_association_by_id = {row.get("id"): row.get("association_name") or "Unknown" for row in source_matches}

    for appearance in source_appearances:
        association = match_association_by_id.get(appearance.get("match_id"), "Unknown")
        appearance_by_association[association]["total"] += 1
        if appearance.get("is_removed"):
            appearance_by_association[association]["removed"] += 1
        if appearance.get("attended"):
            appearance_by_association[association]["attended"] += 1

        revsports_player_id = appearance.get("revsports_player_id")
        profile = profile_by_revsports_id.get(revsports_player_id)
        entity = player_entity_by_external_id.get(revsports_player_id)
        linked = bool(entity and entity.get("id") in link_by_entity)
        if profile or linked:
            appearance_by_association[association]["mapped_player"] += 1
        else:
            appearance_by_association[association]["unmapped_player"] += 1
            if len(player_leftovers) < 200:
                player_leftovers.append({
                    "association": association,
                    "player_name": appearance.get("player_name"),
                    "revsports_player_id": revsports_player_id,
                    "club_name": appearance.get("club_name"),
                    "team_name": appearance.get("team_name"),
                    "appearance_key": appearance.get("appearance_key"),
                })

    for association, counts in sorted(appearance_by_association.items()):
        total = counts["total"]
        appearance_rows.append({
            "association": association,
            "appearances": total,
            "attended_true": counts["attended"],
            "removed_true": counts["removed"],
            "mapped_player": counts["mapped_player"],
            "unmapped_player": counts["unmapped_player"],
            "mapped_percent": pct(counts["mapped_player"], total),
        })

    old_incomplete_fixtures = [
        row for row in fixtures
        if row.get("revsports_match_url")
        and row.get("revsports_match_url") not in source_urls
        and any(row.get(field) in (None, "") for field in ["division_id", "season_id", "pitch_id"])
    ]

    write_csv(OUTPUT_DIR / "mapping_summary.csv", mapping_rows)
    write_csv(OUTPUT_DIR / "fixture_summary.csv", fixture_rows)
    write_csv(OUTPUT_DIR / "appearance_summary.csv", appearance_rows)
    write_csv(OUTPUT_DIR / "unmapped_player_appearance_samples.csv", player_leftovers)
    write_csv(OUTPUT_DIR / "old_incomplete_fixture_samples.csv", old_incomplete_fixtures[:200])

    registry_rows = []
    registry_by_association = Counter(row.get("association") or "Unknown" for row in player_registry)
    history_by_association = Counter(row.get("association") or "Unknown" for row in player_history)
    registry_profile_by_association = Counter(
        row.get("association") or "Unknown"
        for row in player_registry
        if row.get("profile_id") or profile_by_revsports_id.get(row.get("revsports_player_id"))
    )
    for association in sorted(set(registry_by_association) | set(history_by_association)):
        registry_total = registry_by_association[association]
        registry_mapped = registry_profile_by_association[association]
        registry_rows.append({
            "association": association,
            "registry_players": registry_total,
            "registry_players_mapped": registry_mapped,
            "registry_mapped_percent": pct(registry_mapped, registry_total),
            "history_rows": history_by_association[association],
        })
    write_csv(OUTPUT_DIR / "player_registry_history_summary.csv", registry_rows)

    change_count_by_table = Counter(row.get("source_table") or "Unknown" for row in changes)
    current_missing = sum(
        1 for row in current_fixtures
        if any(row.get(field) in (None, "") for field in ["home_team_id", "division_id", "season_id"])
    )
    current_byes_imported = sum(1 for url, fixture in fixture_by_url.items() if str(url or "").startswith("revsports-bye|") and url in source_urls)

    report_lines = [
        "# RevSports Readiness Report",
        "",
        f"Generated: {datetime.now(UTC).isoformat()}",
        "",
        "## Mapping",
        "",
        "| Entity | Total | Matched | Unmatched |",
        "| --- | ---: | ---: | ---: |",
    ]
    report_lines.extend(
        f"| {row['entity_type']} | {row['total']} | {row['matched']} | {row['unmatched']} |"
        for row in mapping_rows
    )

    report_lines.extend([
        "",
        "## Fixtures",
        "",
        f"- Current source matches: {len(source_matches)}",
        f"- Current source byes: {sum(byes_by_association.values())}",
        f"- Current source fixtures imported: {len(current_fixtures)}",
        f"- Current source byes imported: {current_byes_imported}",
        f"- Current imported fixtures missing home/division/season: {current_missing}",
        f"- Older RevSports fixtures outside current source with missing division/season/pitch: {len(old_incomplete_fixtures)}",
        "",
        "| Association | Source Matches | Source Byes | Imported Fixtures | Missing Import | Missing Core Fields |",
        "| --- | ---: | ---: | ---: | ---: | ---: |",
    ])
    report_lines.extend(
        f"| {row['association']} | {row['source_matches']} | {row['source_byes']} | {row['imported_fixtures']} | {row['missing_fixture_import']} | {row['missing_home_division_or_season']} |"
        for row in fixture_rows
    )

    report_lines.extend([
        "",
        "## Player Appearances",
        "",
        "| Association | Appearances | Mapped Players | Unmapped Players | Mapped % |",
        "| --- | ---: | ---: | ---: | ---: |",
    ])
    report_lines.extend(
        f"| {row['association']} | {row['appearances']} | {row['mapped_player']} | {row['unmapped_player']} | {row['mapped_percent']} |"
        for row in appearance_rows
    )

    report_lines.extend([
        "",
        "## Player Registry And History",
        "",
        "| Association | Registry Players | Registry Mapped | Mapped % | History Rows |",
        "| --- | ---: | ---: | ---: | ---: |",
    ])
    report_lines.extend(
        f"| {row['association']} | {row['registry_players']} | {row['registry_players_mapped']} | {row['registry_mapped_percent']} | {row['history_rows']} |"
        for row in registry_rows
    )

    report_lines.extend([
        "",
        "## Change Log",
        "",
    ])
    if change_count_by_table:
        report_lines.extend(f"- {table}: {count}" for table, count in sorted(change_count_by_table.items()))
    else:
        report_lines.append("- No source change-log rows found.")

    report_lines.extend([
        "",
        "## Files",
        "",
        "- mapping_summary.csv",
        "- fixture_summary.csv",
        "- appearance_summary.csv",
        "- player_registry_history_summary.csv",
        "- unmapped_player_appearance_samples.csv",
        "- old_incomplete_fixture_samples.csv",
    ])

    (OUTPUT_DIR / "readiness_report.md").write_text("\n".join(report_lines) + "\n", encoding="utf-8")

    print(f"Wrote {OUTPUT_DIR / 'readiness_report.md'}")
    print(f"Current source matches: {len(source_matches)}")
    print(f"Current source byes: {sum(byes_by_association.values())}")
    print(f"Current source fixtures imported: {len(current_fixtures)}")
    print(f"Current imported fixtures missing home/division/season: {current_missing}")


if __name__ == "__main__":
    main()
