"""Apply only exact, unique RevSports player matches.

This is stricter than the broader audit script:
- scraped player name must exactly match one SportStack profile name after normalising
- that profile name must not be duplicated in SportStack
- active team context must match association + club and either team or division
- profiles with a different RevSports player ID are skipped
"""

from __future__ import annotations

import os
import re
from collections import Counter, defaultdict
from datetime import datetime, timezone
from typing import Any


def normalise(value: Any) -> str:
    return re.sub(r"[^a-z0-9]+", " ", str(value or "").lower()).strip()


def normalise_division(value: Any) -> str:
    text = normalise(value)
    text = re.sub(r"\bwomens\b", "women", text)
    text = re.sub(r"\bmens\b", "men", text)
    text = re.sub(r"\bmen\b", "open", text)
    return text


def fetch_all(client: Any, table: str, columns: str, filters: list[tuple[str, str, Any]] | None = None) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    page_size = 1000
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


def profile_name(profile: dict[str, Any]) -> str:
    return f"{profile.get('first_name') or ''} {profile.get('last_name') or ''}".strip()


def chunks(rows: list[dict[str, Any]], size: int) -> list[list[dict[str, Any]]]:
    return [rows[index:index + size] for index in range(0, len(rows), size)]


def main() -> None:
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not supabase_url or not supabase_key:
        raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_KEY/SUPABASE_SERVICE_ROLE_KEY are required.")

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
        "id, first_name, last_name, revsports_player_id, is_placeholder",
    )
    memberships = fetch_all(
        client,
        "team_memberships",
        "user_id, membership_type, status, teams(name, division, divisions(name), clubs(name, associations(name)))",
    )

    matched_entity_ids = {
        link["external_entity_id"]
        for link in links
        if link.get("status") == "matched" and link.get("target_id")
    }

    profiles_by_name: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for profile in profiles:
        name_key = normalise(profile_name(profile))
        if name_key:
            profiles_by_name[name_key].append(profile)

    duplicate_name_count = sum(1 for rows in profiles_by_name.values() if len(rows) > 1)

    contexts_by_profile_id: dict[str, list[dict[str, str]]] = defaultdict(list)
    for membership in memberships:
        if membership.get("status") != "ACTIVE":
            continue
        team = membership.get("teams") or {}
        club = team.get("clubs") or {}
        association = club.get("associations") or {}
        division = team.get("divisions") or {}
        contexts_by_profile_id[membership["user_id"]].append(
            {
                "association": normalise(association.get("name")),
                "club": normalise(club.get("name")),
                "team": normalise(team.get("name")),
                "division": normalise_division(team.get("division") or division.get("name")),
            }
        )

    upsert_rows: list[dict[str, Any]] = []
    profile_updates: list[dict[str, str]] = []
    skipped = Counter()
    now = datetime.now(timezone.utc).isoformat()

    for entity in player_entities:
        if entity["id"] in matched_entity_ids:
            skipped["already_mapped"] += 1
            continue

        name_key = normalise(entity.get("external_name"))
        profile_options = profiles_by_name.get(name_key, [])
        if len(profile_options) != 1:
            skipped["duplicate_or_no_name_match"] += 1
            continue

        profile = profile_options[0]
        current_external_id = (profile.get("revsports_player_id") or "").strip()
        entity_external_id = (entity.get("external_id") or "").strip()
        if current_external_id and entity_external_id and current_external_id != entity_external_id:
            skipped["profile_has_different_external_id"] += 1
            continue

        entity_context = {
            "association": normalise(entity.get("association_name")),
            "club": normalise(entity.get("club_name")),
            "team": normalise(entity.get("team_name")),
            "division": normalise_division(entity.get("grade")),
        }
        matching_context = any(
            context["association"] == entity_context["association"]
            and context["club"] == entity_context["club"]
            and (context["team"] == entity_context["team"] or context["division"] == entity_context["division"])
            for context in contexts_by_profile_id.get(profile["id"], [])
        )
        if not matching_context:
            skipped["context_not_strong"] += 1
            continue

        upsert_rows.append(
            {
                "external_entity_id": entity["id"],
                "target_table": "profiles",
                "target_id": profile["id"],
                "status": "matched",
                "confidence": "exact_unique_name_context",
                "matched_by": None,
                "matched_at": now,
                "notes": "Applied exact unique player match: name plus team context.",
            }
        )
        if entity_external_id and not current_external_id:
            profile_updates.append({"id": profile["id"], "revsports_player_id": entity_external_id})

    for batch in chunks(upsert_rows, 100):
        client.table("external_entity_links").upsert(batch, on_conflict="external_entity_id,target_table").execute()

    for update in profile_updates:
        client.table("profiles").update({"revsports_player_id": update["revsports_player_id"]}).eq("id", update["id"]).execute()

    print(f"Applied exact unique player matches: {len(upsert_rows)}")
    print(f"Profiles updated with RevSports ID: {len(profile_updates)}")
    print(f"Duplicate SportStack name groups skipped: {duplicate_name_count}")
    for key, count in sorted(skipped.items()):
        print(f"Skipped {key}: {count}")


if __name__ == "__main__":
    main()
