"""Create a read-only RevSports player matching audit.

The script reads staged RevSports player entities and SportStack profiles,
scores likely profile matches, and writes local CSV/text reports. It does not
write any mappings back to Supabase.
"""

from __future__ import annotations

import csv
import os
import re
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path
from typing import Any


OUTPUT_DIR = Path("data/revsports-player-match-audit")
CSV_PATH = OUTPUT_DIR / "player_match_audit.csv"
SUMMARY_PATH = OUTPUT_DIR / "player_match_audit_summary.txt"


def normalise_text(value: Any) -> str:
    return re.sub(r"[^a-z0-9]+", " ", str(value or "").lower()).strip()


def normalise_division(value: Any) -> str:
    text = normalise_text(value)
    text = re.sub(r"\bwomens\b", "women", text)
    text = re.sub(r"\bmens\b", "men", text)
    text = re.sub(r"\bmen\b", "open", text)
    return text


def text_matches(left: Any, right: Any) -> bool:
    left_text = normalise_text(left)
    right_text = normalise_text(right)
    if not left_text or not right_text:
        return False
    return left_text == right_text or left_text in right_text or right_text in left_text


def division_matches(left: Any, right: Any) -> bool:
    left_text = normalise_division(left)
    right_text = normalise_division(right)
    if not left_text or not right_text:
        return False
    return left_text == right_text or left_text in right_text or right_text in left_text


def player_name_score(scraped_name: str, profile_name: str) -> int:
    scraped = normalise_text(scraped_name)
    target = normalise_text(profile_name)
    if not scraped or not target:
        return 0
    if scraped == target:
        return 300
    if target in scraped or scraped in target:
        return 220

    scraped_parts = scraped.split()
    target_parts = target.split()
    if len(scraped_parts) >= 2 and len(target_parts) >= 2:
        scraped_first = scraped_parts[0]
        scraped_last = scraped_parts[-1]
        target_first = target_parts[0]
        target_last = target_parts[-1]
        if scraped_first == target_first and target_last.startswith(scraped_last[0]):
            return 180

    return 0


def get_profile_name(profile: dict[str, Any]) -> str:
    return f"{profile.get('first_name') or ''} {profile.get('last_name') or ''}".strip() or "Unnamed profile"


def fetch_all(client: Any, table: str, columns: str, filters: list[tuple[str, str, Any]] | None = None) -> list[dict[str, Any]]:
    page_size = 1000
    rows: list[dict[str, Any]] = []

    for start in range(0, 1000000, page_size):
        query = client.table(table).select(columns)
        for method, column, value in filters or []:
            query = getattr(query, method)(column, value)
        response = query.range(start, start + page_size - 1).execute()
        data = response.data or []
        rows.extend(data)
        if len(data) < page_size:
            return rows

    raise RuntimeError(f"Stopped fetching {table}; pagination limit reached.")


def context_score(entity: dict[str, Any], contexts: list[dict[str, str]]) -> tuple[int, list[str]]:
    score = 0
    reasons: list[str] = []

    for context in contexts:
        context_points = 0
        context_reasons: list[str] = []

        if normalise_text(context.get("association_name")) == normalise_text(entity.get("association_name")):
            context_points += 20
            context_reasons.append("association")
        if normalise_text(context.get("club_name")) == normalise_text(entity.get("club_name")):
            context_points += 80
            context_reasons.append("club")
        if normalise_text(context.get("team_name")) == normalise_text(entity.get("team_name")):
            context_points += 60
            context_reasons.append("team")
        if division_matches(context.get("division_name"), entity.get("grade")):
            context_points += 35
            context_reasons.append("division")

        if context_points > score:
            score = context_points
            reasons = context_reasons

    return score, reasons


def classify(score: int, top_gap: int, candidate_count: int) -> str:
    if score >= 360 and (top_gap >= 35 or candidate_count == 1):
        return "strong"
    if score >= 260:
        return "review"
    if score >= 180:
        return "weak"
    return "no_likely_match"


def main() -> None:
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("SUPABASE_SERVICE_ROLE_KEY")

    if not supabase_url or not supabase_key:
        raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_KEY/SUPABASE_SERVICE_ROLE_KEY must be available in the environment.")

    from supabase import create_client

    client = create_client(supabase_url, supabase_key)

    player_entities = fetch_all(
        client,
        "external_entities",
        "id, external_id, external_name, association_name, competition_name, grade, club_name, team_name, source_url, last_seen_at, status",
        [("eq", "source", "revsports"), ("eq", "entity_type", "player")],
    )
    links = fetch_all(
        client,
        "external_entity_links",
        "external_entity_id, target_table, target_id, status",
        [("eq", "target_table", "profiles")],
    )
    profiles = fetch_all(
        client,
        "profiles",
        "id, first_name, last_name, is_placeholder",
    )
    memberships = fetch_all(
        client,
        "team_memberships",
        "user_id, membership_type, status, teams(name, division, clubs(name, associations(name)))",
    )

    link_by_entity_id = {link["external_entity_id"]: link for link in links}

    contexts_by_profile_id: dict[str, list[dict[str, str]]] = defaultdict(list)
    for membership in memberships:
        if membership.get("status") != "ACTIVE":
            continue
        team = membership.get("teams") or {}
        club = team.get("clubs") or {}
        association = club.get("associations") or {}
        contexts_by_profile_id[membership["user_id"]].append(
            {
                "association_name": association.get("name") or "",
                "club_name": club.get("name") or "",
                "team_name": team.get("name") or "",
                "division_name": team.get("division") or "",
                "membership_type": membership.get("membership_type") or "",
            }
        )

    profile_rows = []
    for profile in profiles:
        profile_rows.append(
            {
                "id": profile["id"],
                "name": get_profile_name(profile),
                "is_placeholder": bool(profile.get("is_placeholder")),
                "contexts": contexts_by_profile_id.get(profile["id"], []),
            }
        )

    audit_rows: list[dict[str, Any]] = []
    for entity in player_entities:
        link = link_by_entity_id.get(entity["id"])
        mapped = bool(link and link.get("target_id") and link.get("status") == "matched")

        scored_candidates = []
        for profile in profile_rows:
            name_points = player_name_score(entity.get("external_name") or "", profile["name"])
            if not name_points:
                continue

            extra_points, context_reasons = context_score(entity, profile["contexts"])
            placeholder_points = 5 if profile["is_placeholder"] else 0
            total = name_points + extra_points + placeholder_points
            scored_candidates.append(
                {
                    "profile_id": profile["id"],
                    "profile_name": profile["name"],
                    "score": total,
                    "name_score": name_points,
                    "context_score": extra_points,
                    "context_reasons": ", ".join(context_reasons),
                    "is_placeholder": profile["is_placeholder"],
                    "context_count": len(profile["contexts"]),
                }
            )

        scored_candidates.sort(key=lambda candidate: (-candidate["score"], candidate["profile_name"]))
        top = scored_candidates[0] if scored_candidates else None
        second = scored_candidates[1] if len(scored_candidates) > 1 else None
        top_gap = (top["score"] - second["score"]) if top and second else (top["score"] if top else 0)
        match_class = "already_mapped" if mapped else classify(top["score"] if top else 0, top_gap, len(scored_candidates))

        audit_rows.append(
            {
                "classification": match_class,
                "scraped_player": entity.get("external_name") or "",
                "association": entity.get("association_name") or "",
                "competition": entity.get("competition_name") or "",
                "grade": entity.get("grade") or "",
                "club": entity.get("club_name") or "",
                "team": entity.get("team_name") or "",
                "revsports_player_id": entity.get("external_id") or "",
                "external_entity_id": entity["id"],
                "source_url": entity.get("source_url") or "",
                "mapped_profile_id": link.get("target_id") if link else "",
                "mapped_status": link.get("status") if link else "",
                "top_profile": top["profile_name"] if top else "",
                "top_profile_id": top["profile_id"] if top else "",
                "top_score": top["score"] if top else 0,
                "top_name_score": top["name_score"] if top else 0,
                "top_context_score": top["context_score"] if top else 0,
                "top_context_reasons": top["context_reasons"] if top else "",
                "top_is_placeholder": top["is_placeholder"] if top else "",
                "second_profile": second["profile_name"] if second else "",
                "second_profile_id": second["profile_id"] if second else "",
                "second_score": second["score"] if second else 0,
                "candidate_count": len(scored_candidates),
                "last_seen_at": entity.get("last_seen_at") or "",
            }
        )

    audit_rows.sort(
        key=lambda row: (
            row["classification"],
            row["association"],
            row["club"],
            row["team"],
            row["scraped_player"],
        )
    )

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    fieldnames = list(audit_rows[0].keys()) if audit_rows else [
        "classification",
        "scraped_player",
        "association",
        "competition",
        "grade",
        "club",
        "team",
    ]

    with CSV_PATH.open("w", newline="", encoding="utf-8") as csv_file:
        writer = csv.DictWriter(csv_file, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(audit_rows)

    by_class = Counter(row["classification"] for row in audit_rows)
    by_association = Counter(row["association"] for row in audit_rows)
    unmatched_by_association = Counter(
        row["association"]
        for row in audit_rows
        if row["classification"] != "already_mapped"
    )

    summary_lines = [
        "RevSports player match audit",
        f"Generated: {datetime.now().isoformat(timespec='seconds')}",
        "",
        f"Player entities checked: {len(audit_rows)}",
        f"SportStack profiles checked: {len(profile_rows)}",
        f"Active team membership contexts used: {sum(len(profile['contexts']) for profile in profile_rows)}",
        "",
        "By classification:",
    ]
    for key, count in sorted(by_class.items()):
        summary_lines.append(f"- {key}: {count}")

    summary_lines.extend(["", "By association:"])
    for key, count in sorted(by_association.items()):
        summary_lines.append(f"- {key}: {count} total, {unmatched_by_association.get(key, 0)} not already mapped")

    summary_lines.extend(
        [
            "",
            "Notes:",
            "- This report is read-only. It does not create or update external_entity_links.",
            "- Strong means the name and context line up well.",
            "- Review means there is a reasonable candidate but Aaron should check it.",
            "- Weak/no_likely_match should not be mapped without manual checking.",
        ]
    )

    SUMMARY_PATH.write_text("\n".join(summary_lines) + "\n", encoding="utf-8")

    print(f"OK: wrote {CSV_PATH}")
    print(f"OK: wrote {SUMMARY_PATH}")
    print(f"Rows: {len(audit_rows)}")
    for key, count in sorted(by_class.items()):
        print(f"{key}: {count}")


if __name__ == "__main__":
    main()
