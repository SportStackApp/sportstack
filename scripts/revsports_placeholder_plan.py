"""Build a read-only plan for unmatched RevSports player placeholders.

The script reads existing Supabase rows and writes a local CSV report. It has
no database write mode and does not create auth users, profiles, links, or team
memberships.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import os
import re
import secrets
import sys
import unicodedata
from collections import Counter, defaultdict
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Iterable

PAGE_SIZE = 1000
DEFAULT_OUTPUT = Path("data/revsports-placeholder-plan/revsports_placeholder_plan.csv")
LIVE_SPORTSTACK_PROJECT_REF = "svierarfcolhcfjpmwck"

# Keep the CSV columns stable so that two runs can be compared directly.
CSV_FIELDS = [
    "action",
    "reason",
    "warnings",
    "revsports_player_id",
    "scraped_player_name",
    "proposed_first_name",
    "proposed_last_name",
    "name_warning",
    "association",
    "competition",
    "division_or_grade",
    "club",
    "team",
    "external_team_id",
    "proposed_team_id",
    "proposed_team_name",
    "team_match_basis",
    "proposed_membership_type",
    "all_appearances_fill_in",
    "appearance_count",
    "distinct_external_team_ids",
    "distinct_sportstack_team_ids",
    "external_entity_id",
    "existing_profile_id",
    "existing_link_status",
    "scrape_run_id",
    "latest_source_timestamp",
]


def clean_text(value: Any) -> str:
    """Return a trimmed string with repeated whitespace removed."""

    return re.sub(r"\s+", " ", str(value or "")).strip()


def normalise_text(value: Any) -> str:
    """Normalise ordinary names for context comparison, never for identity."""

    text = unicodedata.normalize("NFKD", clean_text(value)).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", " ", text.lower()).strip()


def normalise_division(value: Any) -> str:
    """Normalise common RevSports and SportStack grade wording."""

    text = f" {normalise_text(value)} "
    replacements = (
        (r"\bdiv\b", "division"),
        (r"\bu\s*(\d{1,2})\b", r"under \1"),
        (r"\bmens?\b", "open"),
        (r"\bmale\b", "open"),
        (r"\bwomens?\b", "women"),
        (r"\bfemale\b", "women"),
    )
    for pattern, replacement in replacements:
        text = re.sub(pattern, replacement, text)
    return re.sub(r"\s+", " ", text).strip()


def normalise_competition(value: Any) -> str:
    """Remove a season year while retaining the competition wording."""

    return re.sub(r"\b(?:19|20)\d{2}\b", "", normalise_text(value)).strip()


def values_compatible(source: Any, target: Any, *, kind: str = "name") -> bool:
    """Compare context values using exact or whole-token containment."""

    if kind == "division":
        left, right = normalise_division(source), normalise_division(target)
    elif kind == "competition":
        left, right = normalise_competition(source), normalise_competition(target)
    else:
        left, right = normalise_text(source), normalise_text(target)

    if not left or not right:
        return False
    if left == right:
        return True

    left_tokens = set(left.split())
    right_tokens = set(right.split())
    return left_tokens.issubset(right_tokens) or right_tokens.issubset(left_tokens)


def joined(values: Iterable[Any]) -> str:
    """Return unique non-empty values in a deterministic display order."""

    cleaned = {clean_text(value) for value in values if clean_text(value)}
    return " | ".join(sorted(cleaned, key=lambda value: value.casefold()))


def bool_text(value: bool | None) -> str:
    if value is None:
        return ""
    return "true" if value else "false"


def latest_row(rows: list[dict], timestamp_fields: tuple[str, ...]) -> dict:
    """Select the latest row without depending on database return order."""

    def key(row: dict) -> tuple[str, ...]:
        return tuple(clean_text(row.get(field)) for field in timestamp_fields)

    return max(rows, key=key, default={})


def parse_player_name(player_name: Any) -> tuple[str, str, str]:
    """Parse a display name conservatively into first and last names."""

    raw = clean_text(player_name)
    if not raw:
        return "", "", "missing player name"

    if "," in raw:
        last_part, first_part = (clean_text(part) for part in raw.split(",", 1))
        first_name = first_part.strip(" .")
        last_name = last_part.strip(" .")
    else:
        parts = raw.split()
        if len(parts) < 2:
            return "", "", "player name does not contain both first and last names"
        first_name = " ".join(parts[:-1]).strip(" .")
        last_name = parts[-1].strip(" .")

    if not first_name or not last_name:
        return "", "", "player name does not contain both first and last names"
    if not any(character.isalpha() for character in first_name + last_name):
        return "", "", "player name does not contain letters"

    warning = "last name is an initial" if len(re.sub(r"[^A-Za-z]", "", last_name)) == 1 else ""
    return first_name, last_name, warning


def source_name_key(value: Any) -> str:
    """Treat harmless punctuation changes as the same scraped name."""

    return normalise_text(value)


def resolve_player_name(
    appearances: list[dict],
    entities: list[dict],
    registry_rows: list[dict],
) -> tuple[str, str, str, str, list[str]]:
    """Choose a name while rejecting materially conflicting source names."""

    latest_appearance = latest_row(appearances, ("last_seen_at", "scraped_at", "updated_at"))
    latest_entity = latest_row(entities, ("last_seen_at", "updated_at"))
    latest_registry = latest_row(registry_rows, ("scraped_at",))
    display_name = (
        clean_text(latest_appearance.get("player_name"))
        or clean_text(latest_entity.get("external_name"))
        or clean_text(latest_registry.get("player_name"))
    )

    source_names = [
        clean_text(row.get("player_name")) for row in appearances + registry_rows
        if clean_text(row.get("player_name"))
    ]
    source_names.extend(
        clean_text(row.get("external_name")) for row in entities
        if clean_text(row.get("external_name"))
    )
    distinct_name_keys = {source_name_key(name) for name in source_names if source_name_key(name)}
    warnings: list[str] = []
    if len(distinct_name_keys) > 1:
        return display_name, "", "", "conflicting scraped names for this RevSports ID", warnings

    # Prefer explicit registry fields when they form one consistent pair.
    registry_pairs = {
        (clean_text(row.get("first_name")).strip(" ."), clean_text(row.get("last_name")).strip(" ."))
        for row in registry_rows
        if clean_text(row.get("first_name")) and clean_text(row.get("last_name"))
    }
    if len(registry_pairs) > 1:
        return display_name, "", "", "conflicting registry names for this RevSports ID", warnings
    if len(registry_pairs) == 1:
        first_name, last_name = next(iter(registry_pairs))
        name_warning = (
            "last name is an initial"
            if len(re.sub(r"[^A-Za-z]", "", last_name)) == 1
            else ""
        )
        return display_name, first_name, last_name, name_warning, warnings

    first_name, last_name, name_warning = parse_player_name(display_name)
    return display_name, first_name, last_name, name_warning, warnings


def build_team_contexts(data: dict[str, list[dict]]) -> dict[str, dict]:
    """Build complete SportStack team context from normalised live tables."""

    associations = {row.get("id"): row for row in data.get("associations", [])}
    clubs = {row.get("id"): row for row in data.get("clubs", [])}
    divisions = {row.get("id"): row for row in data.get("divisions", [])}
    competitions = {row.get("id"): row for row in data.get("competitions", [])}
    division_ids_by_team: dict[str, set[str]] = defaultdict(set)
    for row in data.get("team_divisions", []):
        if row.get("team_id") and row.get("division_id"):
            division_ids_by_team[row["team_id"]].add(row["division_id"])

    contexts: dict[str, dict] = {}
    for team in data.get("teams", []):
        team_id = clean_text(team.get("id"))
        if not team_id:
            continue
        club = clubs.get(team.get("club_id"), {})
        association = associations.get(club.get("association_id"), {})
        division_ids = set(division_ids_by_team.get(team_id, set()))
        if team.get("division_id"):
            division_ids.add(team["division_id"])

        division_options = []
        for division_id in sorted(division_ids):
            division = divisions.get(division_id, {})
            competition = competitions.get(division.get("competition_id"), {})
            division_options.append({
                "division_name": clean_text(division.get("name")),
                "competition_name": clean_text(competition.get("name")),
                "association_id": clean_text(division.get("association_id")),
            })
        if not division_options and clean_text(team.get("division")):
            division_options.append({
                "division_name": clean_text(team.get("division")),
                "competition_name": "",
                "association_id": clean_text(club.get("association_id")),
            })

        contexts[team_id] = {
            "id": team_id,
            "name": clean_text(team.get("name")),
            "club_name": clean_text(club.get("name")),
            "association_name": clean_text(association.get("name")),
            "association_id": clean_text(association.get("id")),
            "division_options": division_options,
        }
    return contexts


def appearance_context(appearance: dict, source_match: dict) -> dict[str, str]:
    return {
        "association": clean_text(source_match.get("association_name")),
        "competition": clean_text(source_match.get("competition_name")),
        "division": clean_text(source_match.get("grade")),
        "club": clean_text(appearance.get("club_name")),
        "team": clean_text(appearance.get("team_name")),
    }


def validate_team_context(source: dict[str, str], target: dict) -> list[str]:
    """Return context problems that make a team unsafe to select."""

    labels = {
        "association": "association",
        "competition": "competition",
        "division": "division or grade",
        "club": "club",
        "team": "team",
    }
    problems = [f"missing source {labels[key]}" for key in labels if not source.get(key)]
    if problems:
        return problems

    direct_checks = (
        ("association", target.get("association_name"), "association"),
        ("club", target.get("club_name"), "club"),
        ("team", target.get("name"), "team"),
    )
    for source_key, target_value, label in direct_checks:
        if not values_compatible(source[source_key], target_value):
            problems.append(
                f"{label} context conflicts ({source[source_key]} vs {clean_text(target_value) or 'missing'})"
            )

    matching_division = False
    for option in target.get("division_options", []):
        division_matches = values_compatible(
            source["division"], option.get("division_name"), kind="division"
        )
        competition_matches = values_compatible(
            source["competition"], option.get("competition_name"), kind="competition"
        )
        association_matches = (
            not option.get("association_id")
            or option.get("association_id") == target.get("association_id")
        )
        if division_matches and competition_matches and association_matches:
            matching_division = True
            break
    if not matching_division:
        problems.append("competition or division context conflicts")
    return problems


def team_entity_context(entity: dict) -> dict[str, str]:
    return {
        "association": clean_text(entity.get("association_name")),
        "competition": clean_text(entity.get("competition_name")),
        "division": clean_text(entity.get("grade")),
        "club": clean_text(entity.get("club_name")),
        "team": clean_text(entity.get("team_name")) or clean_text(entity.get("external_name")),
    }


def resolve_teams(
    appearances: list[dict],
    source_matches_by_id: dict[str, dict],
    team_contexts: dict[str, dict],
    team_entities_by_external_id: dict[str, list[dict]],
    links_by_entity_id: dict[str, list[dict]],
) -> dict[str, Any]:
    """Resolve every appearance, preferring exact RevSports team IDs."""

    validated_team_ids: set[str] = set()
    candidate_team_ids: set[str] = set()
    match_bases: set[str] = set()
    problems: list[str] = []
    warnings: list[str] = []

    if not appearances:
        problems.append("no source player appearances")
    if appearances and all(row.get("is_removed") is True for row in appearances):
        problems.append("all source appearances are removed")
    elif any(row.get("is_removed") is True for row in appearances):
        warnings.append("includes removed source appearances")

    for appearance in appearances:
        appearance_key = clean_text(appearance.get("appearance_key")) or clean_text(appearance.get("id"))
        source_match = source_matches_by_id.get(appearance.get("match_id"), {})
        source = appearance_context(appearance, source_match)
        external_team_id = clean_text(appearance.get("revsports_team_id"))

        if external_team_id:
            team_entities = team_entities_by_external_id.get(external_team_id, [])
            if not team_entities:
                problems.append(f"external team ID {external_team_id} has no external team entity")
                continue

            matched_targets: set[str] = set()
            link_states: set[str] = set()
            linked_entity_rows: list[dict] = []
            for team_entity in team_entities:
                team_links = [
                    row for row in links_by_entity_id.get(team_entity.get("id"), [])
                    if clean_text(row.get("target_table")) == "teams"
                ]
                if not team_links:
                    link_states.add("unlinked")
                for link in team_links:
                    status = clean_text(link.get("status")).lower() or "unknown"
                    link_states.add(status)
                    if status == "matched" and clean_text(link.get("target_id")):
                        matched_targets.add(clean_text(link.get("target_id")))
                        linked_entity_rows.append(team_entity)

            candidate_team_ids.update(matched_targets)
            if link_states != {"matched"}:
                problems.append(
                    f"external team ID {external_team_id} link status is {joined(link_states)}"
                )
                continue
            if len(matched_targets) != 1:
                problems.append(
                    f"external team ID {external_team_id} maps to {len(matched_targets)} SportStack teams"
                )
                continue

            target_id = next(iter(matched_targets))
            target = team_contexts.get(target_id)
            if not target:
                problems.append(f"linked SportStack team {target_id} was not found")
                continue

            context_problems = validate_team_context(source, target)
            for team_entity in linked_entity_rows:
                entity_source = team_entity_context(team_entity)
                # Only validate an entity context when it contains the full context.
                if all(entity_source.values()):
                    context_problems.extend(validate_team_context(entity_source, target))
            if context_problems:
                problems.extend(
                    f"{external_team_id}: {problem}" for problem in context_problems
                )
                continue

            validated_team_ids.add(target_id)
            match_bases.add("exact_external_team_id")
            continue

        # Without an external team ID, require exactly one full-context match.
        context_matches = {
            team_id for team_id, target in team_contexts.items()
            if not validate_team_context(source, target)
        }
        candidate_team_ids.update(context_matches)
        if len(context_matches) == 1:
            validated_team_ids.update(context_matches)
            match_bases.add("validated_context")
            warnings.append(f"appearance {appearance_key} has no external team ID")
        elif not context_matches:
            problems.append(f"appearance {appearance_key} has no validated SportStack team")
        else:
            problems.append(
                f"appearance {appearance_key} matches multiple SportStack teams"
            )

    if len(validated_team_ids) > 1:
        problems.append("player appears for multiple SportStack teams")

    safe_team_id = ""
    if len(validated_team_ids) == 1 and not problems:
        safe_team_id = next(iter(validated_team_ids))

    return {
        "safe_team_id": safe_team_id,
        "validated_team_ids": validated_team_ids,
        "candidate_team_ids": candidate_team_ids,
        "match_bases": match_bases,
        "problems": sorted(set(problems)),
        "warnings": sorted(set(warnings)),
    }


def membership_plan(appearances: list[dict]) -> tuple[str, bool | None, str]:
    """Derive the proposed membership only when fill-in flags are complete."""

    if not appearances:
        return "", None, "no appearances available for membership classification"
    flags = [row.get("is_fillin") for row in appearances]
    if any(flag is False for flag in flags):
        return "PRIMARY", False, ""
    if all(flag is True for flag in flags):
        return "FILL_IN", True, ""
    return "", None, "one or more appearances have an unknown fill-in status"


def base_output_row() -> dict[str, Any]:
    return {field: "" for field in CSV_FIELDS}


def build_plan_rows(data: dict[str, list[dict]], player_ids: set[str] | None = None) -> list[dict]:
    """Create deterministic plan rows from already-loaded data."""

    revsports_entities = [
        row for row in data.get("external_entities", [])
        if clean_text(row.get("entity_type")).lower() == "player"
        and clean_text(row.get("source")).lower() == "revsports"
    ]
    player_entities_by_id: dict[str, list[dict]] = defaultdict(list)
    missing_id_entities: list[dict] = []
    for entity in revsports_entities:
        revsports_id = clean_text(entity.get("external_id"))
        if revsports_id:
            player_entities_by_id[revsports_id].append(entity)
        else:
            missing_id_entities.append(entity)

    appearances_by_player_id: dict[str, list[dict]] = defaultdict(list)
    for appearance in data.get("source_revsports_player_appearances", []):
        revsports_id = clean_text(appearance.get("revsports_player_id"))
        if revsports_id:
            appearances_by_player_id[revsports_id].append(appearance)

    registry_by_player_id: dict[str, list[dict]] = defaultdict(list)
    for registry in data.get("revsports_player_registry", []):
        revsports_id = clean_text(registry.get("revsports_player_id"))
        if revsports_id:
            registry_by_player_id[revsports_id].append(registry)

    profiles_by_revsports_id: dict[str, list[dict]] = defaultdict(list)
    profiles_by_name: dict[str, list[dict]] = defaultdict(list)
    profiles_by_id = {}
    for profile in data.get("profiles", []):
        profile_id = clean_text(profile.get("id"))
        if profile_id:
            profiles_by_id[profile_id] = profile
        revsports_id = clean_text(profile.get("revsports_player_id"))
        if revsports_id:
            profiles_by_revsports_id[revsports_id].append(profile)
        name_key = normalise_text(
            f"{clean_text(profile.get('first_name'))} {clean_text(profile.get('last_name'))}"
        )
        if name_key:
            profiles_by_name[name_key].append(profile)

    links_by_entity_id: dict[str, list[dict]] = defaultdict(list)
    for link in data.get("external_entity_links", []):
        if link.get("external_entity_id"):
            links_by_entity_id[link["external_entity_id"]].append(link)

    team_entities_by_external_id: dict[str, list[dict]] = defaultdict(list)
    for entity in data.get("external_entities", []):
        if (
            clean_text(entity.get("entity_type")).lower() == "team"
            and clean_text(entity.get("source")).lower() == "revsports"
            and clean_text(entity.get("external_id"))
        ):
            team_entities_by_external_id[clean_text(entity.get("external_id"))].append(entity)

    legacy_profiles_by_player_id: dict[str, set[str]] = defaultdict(set)
    for table_name in ("revsports_player_registry", "revsports_player_mappings"):
        for row in data.get(table_name, []):
            revsports_id = clean_text(row.get("revsports_player_id"))
            profile_id = clean_text(row.get("profile_id"))
            if revsports_id and profile_id:
                legacy_profiles_by_player_id[revsports_id].add(profile_id)

    memberships_by_profile_team: dict[tuple[str, str], list[dict]] = defaultdict(list)
    for membership in data.get("team_memberships", []):
        profile_id = clean_text(membership.get("user_id"))
        team_id = clean_text(membership.get("team_id"))
        if profile_id and team_id:
            memberships_by_profile_team[(profile_id, team_id)].append(membership)

    source_matches_by_id = {
        row.get("id"): row for row in data.get("source_revsports_matches", []) if row.get("id")
    }
    team_contexts = build_team_contexts(data)
    rows: list[dict] = []

    def build_one(revsports_id: str, entities: list[dict]) -> dict:
        appearances = appearances_by_player_id.get(revsports_id, [])
        registry_rows = registry_by_player_id.get(revsports_id, [])
        display_name, first_name, last_name, name_warning, name_warnings = resolve_player_name(
            appearances, entities, registry_rows
        )
        team_result = resolve_teams(
            appearances,
            source_matches_by_id,
            team_contexts,
            team_entities_by_external_id,
            links_by_entity_id,
        )
        membership_type, all_fill_in, membership_problem = membership_plan(appearances)

        latest_appearance = latest_row(appearances, ("last_seen_at", "scraped_at", "updated_at"))
        latest_entity = latest_row(entities, ("last_seen_at", "updated_at"))
        latest_match = source_matches_by_id.get(latest_appearance.get("match_id"), {})
        contexts = [
            appearance_context(appearance, source_matches_by_id.get(appearance.get("match_id"), {}))
            for appearance in appearances
        ]
        if not contexts:
            contexts = [{
                "association": clean_text(latest_entity.get("association_name")),
                "competition": clean_text(latest_entity.get("competition_name")),
                "division": clean_text(latest_entity.get("grade")),
                "club": clean_text(latest_entity.get("club_name")),
                "team": clean_text(latest_entity.get("team_name")),
            }]

        profile_links = []
        for entity in entities:
            profile_links.extend(
                link for link in links_by_entity_id.get(entity.get("id"), [])
                if clean_text(link.get("target_table")) == "profiles"
            )
        link_statuses = {
            clean_text(link.get("status")).lower() or "unknown" for link in profile_links
        }
        matched_links = [
            link for link in profile_links
            if clean_text(link.get("status")).lower() == "matched"
            and clean_text(link.get("target_id"))
        ]
        exact_profiles = profiles_by_revsports_id.get(revsports_id, [])
        legacy_profile_ids = legacy_profiles_by_player_id.get(revsports_id, set())

        warnings = list(name_warnings) + list(team_result["warnings"])
        proposed_name_key = normalise_text(f"{first_name} {last_name}")
        same_name_profiles = profiles_by_name.get(proposed_name_key, []) if proposed_name_key else []
        unrelated_same_name_profiles = [
            profile for profile in same_name_profiles
            if clean_text(profile.get("revsports_player_id")) != revsports_id
        ]
        if unrelated_same_name_profiles:
            warnings.append("same display name exists with a different or missing RevSports ID; ignored")

        existing_profile_id = ""
        action = "needs_review"
        reason = "unable to classify safely"
        entity_statuses = {
            clean_text(entity.get("status")).lower() for entity in entities
            if clean_text(entity.get("status"))
        }

        # Link state has priority so ignored records are never reconsidered.
        if matched_links:
            action = "skip"
            reason = "already linked"
            existing_profile_id = joined(link.get("target_id") for link in matched_links)
            if any(profile_id not in profiles_by_id for profile_id in existing_profile_id.split(" | ")):
                warnings.append("linked profile was not present in the profiles query")
        elif "ignored" in link_statuses or "ignored" in entity_statuses:
            action = "skip"
            reason = "external profile link or player entity is ignored"
        elif len(exact_profiles) == 1 and (
            not profile_links
            or all(
                clean_text(link.get("status")).lower() == "unmatched"
                and not clean_text(link.get("target_id"))
                for link in profile_links
            )
        ):
            action = "link_existing"
            reason = "exact RevSports ID profile exists"
            existing_profile_id = clean_text(exact_profiles[0].get("id"))
        elif len(exact_profiles) > 1:
            action = "needs_review"
            reason = "multiple profiles contain the same RevSports ID"
            existing_profile_id = joined(profile.get("id") for profile in exact_profiles)
        elif profile_links:
            action = "needs_review"
            reason = f"external profile link status is {joined(link_statuses)}"
        elif legacy_profile_ids:
            action = "needs_review"
            reason = "legacy RevSports mapping already references a profile"
            existing_profile_id = joined(legacy_profile_ids)
        elif (
            not first_name
            or not last_name
            or name_warning.startswith("missing")
            or name_warning.startswith("conflicting")
            or name_warning.startswith("player name")
        ):
            action = "needs_review"
            reason = name_warning or "unusable player name"
        elif team_result["problems"]:
            action = "needs_review"
            reason = "; ".join(team_result["problems"])
        elif membership_problem:
            action = "needs_review"
            reason = membership_problem
        elif team_result["safe_team_id"]:
            action = "create_placeholder"
            reason = "safe placeholder candidate"

        safe_team_id = team_result["safe_team_id"]
        safe_team = team_contexts.get(safe_team_id, {})
        if existing_profile_id and safe_team_id:
            membership_rows = []
            for profile_id in existing_profile_id.split(" | "):
                membership_rows.extend(memberships_by_profile_team.get((profile_id, safe_team_id), []))
            if membership_rows:
                warnings.append(
                    "existing profile already has this team membership: "
                    + joined(row.get("membership_type") for row in membership_rows)
                )

        all_candidate_ids = team_result["candidate_team_ids"] | team_result["validated_team_ids"]
        row = base_output_row()
        row.update({
            "action": action,
            "reason": reason,
            "warnings": "; ".join(sorted(set(warnings))),
            "revsports_player_id": revsports_id,
            "scraped_player_name": display_name,
            "proposed_first_name": first_name,
            "proposed_last_name": last_name,
            "name_warning": name_warning,
            "association": joined(context.get("association") for context in contexts),
            "competition": joined(context.get("competition") for context in contexts),
            "division_or_grade": joined(context.get("division") for context in contexts),
            "club": joined(context.get("club") for context in contexts),
            "team": joined(context.get("team") for context in contexts),
            "external_team_id": joined(
                appearance.get("revsports_team_id") for appearance in appearances
            ),
            "proposed_team_id": safe_team_id,
            "proposed_team_name": clean_text(safe_team.get("name")),
            "team_match_basis": joined(team_result["match_bases"]),
            "proposed_membership_type": membership_type if safe_team_id else "",
            "all_appearances_fill_in": bool_text(all_fill_in),
            "appearance_count": len(appearances),
            "distinct_external_team_ids": joined(
                appearance.get("revsports_team_id") for appearance in appearances
            ),
            "distinct_sportstack_team_ids": joined(all_candidate_ids),
            "external_entity_id": joined(entity.get("id") for entity in entities),
            "existing_profile_id": existing_profile_id,
            "existing_link_status": joined(link_statuses) or "none",
            "scrape_run_id": clean_text(latest_appearance.get("scrape_run_id"))
            or clean_text(latest_match.get("scrape_run_id")),
            "latest_source_timestamp": max(
                [
                    clean_text(latest_appearance.get("last_seen_at")),
                    clean_text(latest_appearance.get("scraped_at")),
                    clean_text(latest_entity.get("last_seen_at")),
                    clean_text(latest_match.get("last_seen_at")),
                    clean_text(latest_match.get("scraped_at")),
                ]
                or [""]
            ),
        })
        return row

    for revsports_id, entities in player_entities_by_id.items():
        if player_ids is None or revsports_id in player_ids:
            rows.append(build_one(revsports_id, entities))

    if player_ids is None:
        for entity in missing_id_entities:
            row = base_output_row()
            display_name, first_name, last_name, name_warning, _ = resolve_player_name([], [entity], [])
            row.update({
                "action": "skip",
                "reason": "missing RevSports ID",
                "scraped_player_name": display_name,
                "proposed_first_name": first_name,
                "proposed_last_name": last_name,
                "name_warning": name_warning,
                "association": clean_text(entity.get("association_name")),
                "competition": clean_text(entity.get("competition_name")),
                "division_or_grade": clean_text(entity.get("grade")),
                "club": clean_text(entity.get("club_name")),
                "team": clean_text(entity.get("team_name")),
                "external_entity_id": clean_text(entity.get("id")),
                "existing_link_status": "none",
                "latest_source_timestamp": clean_text(entity.get("last_seen_at")),
                "appearance_count": 0,
            })
            rows.append(row)

    action_order = {"create_placeholder": 0, "link_existing": 1, "needs_review": 2, "skip": 3}
    rows.sort(key=lambda row: (
        action_order.get(row["action"], 99),
        row["association"].casefold(),
        row["club"].casefold(),
        row["team"].casefold(),
        row["scraped_player_name"].casefold(),
        row["revsports_player_id"],
    ))
    return rows


def fetch_all(client: Any, table: str, columns: str) -> list[dict]:
    """Fetch a table in read-only pages using Supabase select queries."""

    rows: list[dict] = []
    for start in range(0, 200_000, PAGE_SIZE):
        result = client.table(table).select(columns).range(start, start + PAGE_SIZE - 1).execute()
        batch = result.data or []
        rows.extend(batch)
        if len(batch) < PAGE_SIZE:
            break
    return rows


def load_data(client: Any) -> dict[str, list[dict]]:
    """Read only the columns required by the planner."""

    queries = {
        "external_entities": (
            "id,source,entity_type,external_id,external_name,association_name,"
            "competition_name,grade,club_name,team_name,status,last_seen_at,updated_at"
        ),
        "external_entity_links": "external_entity_id,target_table,target_id,status,notes,updated_at",
        "source_revsports_player_appearances": (
            "id,scrape_run_id,match_id,appearance_key,club_name,team_name,"
            "revsports_team_id,player_name,revsports_player_id,is_fillin,is_removed,"
            "last_seen_at,scraped_at,updated_at"
        ),
        "source_revsports_matches": "id,scrape_run_id,association_name,competition_name,grade,last_seen_at,scraped_at",
        "revsports_player_registry": (
            "revsports_player_id,association,player_name,first_name,last_name,"
            "profile_id,scraped_at"
        ),
        "revsports_player_mappings": "revsports_player_id,profile_id",
        "profiles": "id,first_name,last_name,revsports_player_id,is_placeholder",
        "teams": "id,name,club_id,division_id,division",
        "clubs": "id,name,association_id",
        "associations": "id,name",
        "divisions": "id,name,association_id,competition_id,season_id",
        "competitions": "id,name,association_id,season_id",
        "team_divisions": "team_id,division_id,season_id",
        "team_memberships": "id,user_id,team_id,membership_type,status",
    }
    return {table: fetch_all(client, table, columns) for table, columns in queries.items()}


def write_csv(output_path: Path, rows: list[dict]) -> None:
    """Write the local planning report."""

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", newline="", encoding="utf-8-sig") as handle:
        writer = csv.DictWriter(handle, fieldnames=CSV_FIELDS, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)


class ApplyRefused(RuntimeError):
    """Raised before writes when a row is not safe to apply."""


class ApplyFailed(RuntimeError):
    """Raised when an apply operation fails but cleanup succeeds."""


class ApplyRecoveryRequired(RuntimeError):
    """Raised when a partial apply needs manual recovery."""


def split_joined(value: Any) -> list[str]:
    return [part.strip() for part in clean_text(value).split(" | ") if part.strip()]


def validate_cli_safety(args: argparse.Namespace) -> None:
    """Require the complete single-player confirmation gate for apply mode."""

    player_ids = [clean_text(value) for value in args.player_id if clean_text(value)]
    if args.confirm_create_placeholder and not args.apply:
        raise ApplyRefused("--confirm-create-placeholder is only valid with --apply.")
    if not args.apply:
        return
    if len(args.player_id) != 1 or len(player_ids) != 1:
        raise ApplyRefused("--apply requires exactly one --player-id value.")
    if not args.confirm_create_placeholder:
        raise ApplyRefused("--apply also requires --confirm-create-placeholder.")


def validate_apply_target(url: str) -> None:
    """Never permit this local apply path to target the known live project."""

    if LIVE_SPORTSTACK_PROJECT_REF in url.lower():
        raise ApplyRefused(
            "apply is disabled for the live SportStack Supabase project; use a separate dev/test project"
        )


def validate_apply_row(row: dict) -> None:
    """Fail closed unless the refreshed plan proves one safe write target."""

    action = clean_text(row.get("action"))
    if action not in {"create_placeholder", "link_existing"}:
        raise ApplyRefused(
            f"planned action is {action or 'missing'}, not create_placeholder or link_existing"
        )
    expected_reason = {
        "create_placeholder": "safe placeholder candidate",
        "link_existing": "exact RevSports ID profile exists",
    }[action]
    if clean_text(row.get("reason")) != expected_reason:
        raise ApplyRefused("the refreshed plan reason is not an approved safe reason")

    if not clean_text(row.get("revsports_player_id")):
        raise ApplyRefused("RevSports player ID is missing")
    if len(split_joined(row.get("external_entity_id"))) != 1:
        raise ApplyRefused("exactly one external player entity is required")
    if not clean_text(row.get("proposed_first_name")) or not clean_text(row.get("proposed_last_name")):
        raise ApplyRefused("the parsed player name is unusable")
    if clean_text(row.get("name_warning")) not in {"", "last name is an initial"}:
        raise ApplyRefused(f"unsafe name warning: {clean_text(row.get('name_warning'))}")
    if int(row.get("appearance_count") or 0) < 1:
        raise ApplyRefused("no source appearances are available")

    team_id = clean_text(row.get("proposed_team_id"))
    candidate_team_ids = set(split_joined(row.get("distinct_sportstack_team_ids")))
    if not team_id:
        raise ApplyRefused("a single validated SportStack team is required")
    if candidate_team_ids != {team_id}:
        raise ApplyRefused("the team result is ambiguous or contains multiple teams")
    match_bases = set(split_joined(row.get("team_match_basis")))
    if not match_bases or not match_bases.issubset(
        {"exact_external_team_id", "validated_context"}
    ):
        raise ApplyRefused("the team match basis is not safe")

    membership_type = clean_text(row.get("proposed_membership_type"))
    all_fill_in = clean_text(row.get("all_appearances_fill_in")).lower()
    if membership_type == "FILL_IN" and all_fill_in != "true":
        raise ApplyRefused("FILL_IN requires every appearance to be a fill-in")
    if membership_type == "PRIMARY" and all_fill_in != "false":
        raise ApplyRefused("PRIMARY requires at least one normal appearance")
    if membership_type not in {"FILL_IN", "PRIMARY"}:
        raise ApplyRefused("membership type is missing or unsafe")

    link_statuses = set(split_joined(row.get("existing_link_status")))
    if link_statuses - {"none", "unmatched"}:
        raise ApplyRefused("the external player link is already matched, ignored, or under review")
    if action == "create_placeholder" and clean_text(row.get("existing_profile_id")):
        raise ApplyRefused("an exact-ID profile already exists")
    if action == "link_existing" and len(split_joined(row.get("existing_profile_id"))) != 1:
        raise ApplyRefused("link_existing requires exactly one exact-ID profile")


def placeholder_email(revsports_player_id: str) -> str:
    """Create a deterministic synthetic address without exposing a password."""

    token = re.sub(r"[^a-z0-9]+", "-", revsports_player_id.lower()).strip("-")[:50]
    digest = hashlib.sha256(revsports_player_id.encode("utf-8")).hexdigest()[:12]
    return f"placeholder+revsports-{token or 'player'}-{digest}@sportstackapp.com"


def link_audit_note(row: dict, previous_notes: Any = "") -> str:
    note = (
        "RevSports placeholder planner Phase 3; "
        f"player_id={clean_text(row.get('revsports_player_id'))}; "
        f"team_id={clean_text(row.get('proposed_team_id'))}; "
        f"membership_type={clean_text(row.get('proposed_membership_type'))}; "
        f"team_match_basis={clean_text(row.get('team_match_basis'))}; "
        f"applied_at={datetime.now(UTC).isoformat()}"
    )
    existing = clean_text(previous_notes)
    return f"{existing}\n{note}" if existing else note


class SupabasePlaceholderBackend:
    """Small, testable wrapper around the privileged Supabase write calls."""

    def __init__(self, client: Any):
        self.client = client

    @staticmethod
    def _rows(result: Any) -> list[dict]:
        return list(getattr(result, "data", None) or [])

    def identity_state(self, revsports_player_id: str, external_entity_id: str) -> dict:
        profiles = self._rows(
            self.client.table("profiles")
            .select("id")
            .eq("revsports_player_id", revsports_player_id)
            .limit(3)
            .execute()
        )
        links = self._rows(
            self.client.table("external_entity_links")
            .select("id,status,target_id,notes")
            .eq("external_entity_id", external_entity_id)
            .eq("target_table", "profiles")
            .limit(3)
            .execute()
        )
        return {
            "profile_ids": [clean_text(row.get("id")) for row in profiles if row.get("id")],
            "links": links,
        }

    def create_auth_user(self, row: dict) -> str:
        response = self.client.auth.admin.create_user({
            "email": placeholder_email(clean_text(row.get("revsports_player_id"))),
            "email_confirm": True,
            "password": secrets.token_urlsafe(48),
            "user_metadata": {
                "first_name": clean_text(row.get("proposed_first_name")),
                "last_name": clean_text(row.get("proposed_last_name")),
            },
            "app_metadata": {
                "is_placeholder": True,
                "source": "revsports_placeholder_planner",
                "revsports_player_id": clean_text(row.get("revsports_player_id")),
            },
        })
        user = getattr(response, "user", None)
        user_id = clean_text(getattr(user, "id", None))
        if not user_id:
            raise ApplyFailed("Supabase Auth did not return the new user ID")
        return user_id

    def delete_auth_user(self, user_id: str) -> None:
        self.client.auth.admin.delete_user(user_id)

    def update_placeholder_profile(self, profile_id: str, row: dict) -> None:
        self.client.table("profiles").update({
            "first_name": clean_text(row.get("proposed_first_name")),
            "last_name": clean_text(row.get("proposed_last_name")),
            "revsports_player_id": clean_text(row.get("revsports_player_id")),
            "is_placeholder": True,
        }).eq("id", profile_id).execute()
        profiles = self._rows(
            self.client.table("profiles")
            .select("id,revsports_player_id,is_placeholder")
            .eq("id", profile_id)
            .limit(1)
            .execute()
        )
        if not profiles or clean_text(profiles[0].get("revsports_player_id")) != clean_text(
            row.get("revsports_player_id")
        ) or profiles[0].get("is_placeholder") is not True:
            raise ApplyFailed("the auth-triggered profile could not be updated and verified")

    def find_memberships(self, profile_id: str, team_id: str) -> list[dict]:
        return self._rows(
            self.client.table("team_memberships")
            .select("id,membership_type,status")
            .eq("user_id", profile_id)
            .eq("team_id", team_id)
            .execute()
        )

    def insert_membership(self, profile_id: str, row: dict) -> str:
        result = self.client.table("team_memberships").insert({
            "user_id": profile_id,
            "team_id": clean_text(row.get("proposed_team_id")),
            "membership_type": clean_text(row.get("proposed_membership_type")),
            "status": "ACTIVE",
        }).execute()
        rows = self._rows(result)
        membership_id = clean_text(rows[0].get("id")) if rows else ""
        if not membership_id:
            matches = self.find_memberships(profile_id, clean_text(row.get("proposed_team_id")))
            membership_id = clean_text(matches[0].get("id")) if len(matches) == 1 else ""
        if not membership_id:
            raise ApplyFailed("team membership was not returned or verified")
        return membership_id

    def delete_membership(self, membership_id: str) -> None:
        self.client.table("team_memberships").delete().eq("id", membership_id).execute()
        remaining = self._rows(
            self.client.table("team_memberships")
            .select("id")
            .eq("id", membership_id)
            .limit(1)
            .execute()
        )
        if remaining:
            raise ApplyFailed(f"membership cleanup did not remove {membership_id}")

    def write_profile_link(self, profile_id: str, row: dict, state: dict) -> str:
        external_entity_id = split_joined(row.get("external_entity_id"))[0]
        links = state.get("links", [])
        payload = {
            "target_id": profile_id,
            "status": "matched",
            "confidence": "exact_id",
            "matched_at": datetime.now(UTC).isoformat(),
            "notes": link_audit_note(row, links[0].get("notes") if len(links) == 1 else ""),
        }
        if not links:
            self.client.table("external_entity_links").insert({
                "external_entity_id": external_entity_id,
                "target_table": "profiles",
                **payload,
            }).execute()
            operation = "created"
        elif (
            len(links) == 1
            and clean_text(links[0].get("status")).lower() == "unmatched"
            and not clean_text(links[0].get("target_id"))
        ):
            result = (
                self.client.table("external_entity_links")
                .update(payload)
                .eq("id", links[0]["id"])
                .eq("status", "unmatched")
                .is_("target_id", "null")
                .execute()
            )
            if not self._rows(result):
                raise ApplyFailed("the unmatched link changed before its guarded update")
            operation = "updated"
        else:
            raise ApplyRefused("the external profile link is no longer safely writable")

        refreshed = self.identity_state(clean_text(row.get("revsports_player_id")), external_entity_id)
        if not link_matches_profile(refreshed, profile_id):
            raise ApplyFailed("the external profile link could not be verified")
        return operation


def link_matches_profile(state: dict, profile_id: str) -> bool:
    return any(
        clean_text(link.get("status")).lower() == "matched"
        and clean_text(link.get("target_id")) == profile_id
        for link in state.get("links", [])
    )


def safely_reclassify_identity(row: dict, state: dict) -> tuple[str, str]:
    """Reclassify an exact-ID race immediately before any write."""

    links = state.get("links", [])
    matched_targets = {
        clean_text(link.get("target_id")) for link in links
        if clean_text(link.get("status")).lower() == "matched"
        and clean_text(link.get("target_id"))
    }
    if matched_targets:
        raise ApplyRefused("the external player became linked before apply; no writes were made")
    blocked_statuses = {
        clean_text(link.get("status")).lower() for link in links
        if clean_text(link.get("status")).lower() not in {"", "unmatched"}
    }
    if blocked_statuses:
        raise ApplyRefused(
            f"the external link changed to {joined(blocked_statuses)} before apply"
        )
    if any(clean_text(link.get("target_id")) for link in links):
        raise ApplyRefused("the unmatched external link now has a target profile")

    profile_ids = sorted(set(state.get("profile_ids", [])))
    if len(profile_ids) > 1:
        raise ApplyRefused("multiple exact-ID profiles exist; no writes were made")
    if len(profile_ids) == 1:
        return "link_existing", profile_ids[0]
    if clean_text(row.get("action")) == "link_existing":
        raise ApplyRefused("the exact-ID profile disappeared before apply")
    return "create_placeholder", ""


def ensure_membership(backend: Any, profile_id: str, row: dict) -> tuple[bool, str, str]:
    """Create one membership, or reuse an existing user/team membership."""

    team_id = clean_text(row.get("proposed_team_id"))
    existing = backend.find_memberships(profile_id, team_id)
    if len(existing) > 1:
        raise ApplyRefused("multiple existing memberships need manual review")
    if existing:
        return False, clean_text(existing[0].get("id")), clean_text(existing[0].get("membership_type"))
    try:
        return True, backend.insert_membership(profile_id, row), clean_text(
            row.get("proposed_membership_type")
        )
    except Exception as insert_error:
        # A concurrent insert is safe to reuse; any other failure is re-raised.
        try:
            existing = backend.find_memberships(profile_id, team_id)
        except Exception as verification_error:
            raise ApplyRecoveryRequired(
                f"membership outcome is unknown for profile {profile_id} and team {team_id}; "
                "review it manually before retrying"
            ) from verification_error
        if len(existing) == 1:
            return False, clean_text(existing[0].get("id")), clean_text(
                existing[0].get("membership_type")
            )
        raise insert_error


def cleanup_membership_or_raise(backend: Any, membership_id: str, original_error: Exception) -> None:
    try:
        backend.delete_membership(membership_id)
    except Exception as cleanup_error:
        raise ApplyRecoveryRequired(
            f"link failed and membership {membership_id} could not be removed; "
            "review that membership manually before retrying"
        ) from cleanup_error
    raise ApplyFailed(f"link write failed and the new membership was removed: {original_error}") from original_error


def cleanup_auth_or_raise(backend: Any, profile_id: str, original_error: Exception) -> None:
    try:
        backend.delete_auth_user(profile_id)
    except Exception as cleanup_error:
        raise ApplyRecoveryRequired(
            f"apply failed after auth user {profile_id} was created and automatic cleanup failed; "
            "remove or review that auth/profile shell before retrying"
        ) from cleanup_error
    raise ApplyFailed(
        f"apply failed after auth creation; auth/profile shell {profile_id} was removed: {original_error}"
    ) from original_error


def apply_revalidated_row(row: dict, backend: Any) -> dict:
    """Apply one safe row after a final exact-ID/link state check."""

    validate_apply_row(row)
    revsports_player_id = clean_text(row.get("revsports_player_id"))
    external_entity_id = split_joined(row.get("external_entity_id"))[0]
    try:
        identity = backend.identity_state(revsports_player_id, external_entity_id)
    except Exception as identity_error:
        raise ApplyFailed("final exact-ID and external-link check failed; no writes were made") from identity_error
    effective_action, existing_profile_id = safely_reclassify_identity(row, identity)

    if effective_action == "create_placeholder":
        profile_id = ""
        try:
            profile_id = backend.create_auth_user(row)
            backend.update_placeholder_profile(profile_id, row)
            membership_created, membership_id, membership_type = ensure_membership(
                backend, profile_id, row
            )
        except Exception as apply_error:
            if profile_id:
                cleanup_auth_or_raise(backend, profile_id, apply_error)
            raise ApplyFailed(
                "auth creation failed or its response was incomplete; check the deterministic "
                f"placeholder email {placeholder_email(revsports_player_id)} before retrying"
            ) from apply_error

        try:
            link_operation = backend.write_profile_link(profile_id, row, identity)
        except Exception as link_error:
            try:
                latest_identity = backend.identity_state(revsports_player_id, external_entity_id)
            except Exception as verification_error:
                raise ApplyRecoveryRequired(
                    f"external link outcome is unknown for new profile {profile_id}; "
                    "do not retry until its profile link and membership are reviewed manually"
                ) from verification_error
            if link_matches_profile(latest_identity, profile_id):
                link_operation = "already_matched"
            else:
                cleanup_auth_or_raise(backend, profile_id, link_error)
        return {
            "effective_action": effective_action,
            "profile_id": profile_id,
            "auth_created": True,
            "membership_created": membership_created,
            "membership_id": membership_id,
            "membership_type": membership_type,
            "link_operation": link_operation,
        }

    profile_id = existing_profile_id
    try:
        membership_created, membership_id, membership_type = ensure_membership(
            backend, profile_id, row
        )
    except (ApplyRefused, ApplyRecoveryRequired):
        raise
    except Exception as membership_error:
        raise ApplyFailed(
            f"membership write failed before the external link was changed: {membership_error}"
        ) from membership_error
    try:
        link_operation = backend.write_profile_link(profile_id, row, identity)
    except Exception as link_error:
        try:
            latest_identity = backend.identity_state(revsports_player_id, external_entity_id)
        except Exception as verification_error:
            raise ApplyRecoveryRequired(
                f"external link outcome is unknown for existing profile {profile_id}; "
                "do not retry until its link and membership are reviewed manually"
            ) from verification_error
        if link_matches_profile(latest_identity, profile_id):
            link_operation = "already_matched"
        elif membership_created:
            cleanup_membership_or_raise(backend, membership_id, link_error)
        else:
            raise ApplyFailed(f"external link write failed: {link_error}") from link_error
    return {
        "effective_action": effective_action,
        "profile_id": profile_id,
        "auth_created": False,
        "membership_created": membership_created,
        "membership_id": membership_id,
        "membership_type": membership_type,
        "link_operation": link_operation,
    }


def verify_applied_state(result: dict, row: dict, data: dict[str, list[dict]]) -> dict:
    """Verify the exact profile, link, and relevant membership after writing."""

    profile_id = clean_text(result.get("profile_id"))
    revsports_player_id = clean_text(row.get("revsports_player_id"))
    external_entity_id = split_joined(row.get("external_entity_id"))[0]
    exact_profiles = [
        profile for profile in data.get("profiles", [])
        if clean_text(profile.get("revsports_player_id")) == revsports_player_id
    ]
    matched_links = [
        link for link in data.get("external_entity_links", [])
        if clean_text(link.get("external_entity_id")) == external_entity_id
        and clean_text(link.get("target_table")) == "profiles"
        and clean_text(link.get("status")).lower() == "matched"
        and clean_text(link.get("target_id")) == profile_id
    ]
    memberships = [
        membership for membership in data.get("team_memberships", [])
        if clean_text(membership.get("user_id")) == profile_id
        and clean_text(membership.get("team_id")) == clean_text(row.get("proposed_team_id"))
    ]
    if len(exact_profiles) != 1 or clean_text(exact_profiles[0].get("id")) != profile_id:
        raise ApplyRecoveryRequired(
            f"post-apply verification could not confirm exact profile {profile_id}; review it manually"
        )
    if len(matched_links) != 1:
        raise ApplyRecoveryRequired(
            f"post-apply verification could not confirm the external link to {profile_id}; review it manually"
        )
    if len(memberships) != 1:
        raise ApplyRecoveryRequired(
            f"post-apply verification could not confirm one team membership for {profile_id}; review it manually"
        )
    if result.get("auth_created") and clean_text(memberships[0].get("membership_type")) != clean_text(
        row.get("proposed_membership_type")
    ):
        raise ApplyRecoveryRequired(
            f"new placeholder {profile_id} has the wrong membership type; review it manually"
        )
    after_rows = build_plan_rows(data, {revsports_player_id})
    if (
        len(after_rows) != 1
        or after_rows[0].get("action") != "skip"
        or after_rows[0].get("reason") != "already linked"
    ):
        raise ApplyRecoveryRequired(
            f"post-apply planner did not reclassify {profile_id} as already linked; review it manually"
        )
    return after_rows[0]


def print_apply_row(label: str, row: dict) -> None:
    print(label)
    print(f"  action: {clean_text(row.get('action'))}")
    print(f"  RevSports player ID: {clean_text(row.get('revsports_player_id'))}")
    print(f"  name: {clean_text(row.get('scraped_player_name'))}")
    print(f"  team: {clean_text(row.get('proposed_team_name'))} ({clean_text(row.get('proposed_team_id'))})")
    print(f"  membership: {clean_text(row.get('proposed_membership_type'))}")
    if clean_text(row.get("warnings")):
        print(f"  warnings: {clean_text(row.get('warnings'))}")


def run_guarded_apply(client: Any, player_id: str, data_loader: Any = load_data, backend: Any = None) -> dict:
    """Re-read, apply one player, then re-read and verify the final state."""

    refreshed_data = data_loader(client)
    refreshed_rows = build_plan_rows(refreshed_data, {player_id})
    if len(refreshed_rows) != 1:
        raise ApplyRefused("the refreshed source did not return exactly one player row")
    refreshed_row = refreshed_rows[0]
    validate_apply_row(refreshed_row)
    print_apply_row("Before apply:", refreshed_row)

    write_backend = backend or SupabasePlaceholderBackend(client)
    try:
        result = apply_revalidated_row(refreshed_row, write_backend)
    except ApplyFailed as apply_error:
        # After successful compensation, report the latest safe classification.
        try:
            changed_data = data_loader(client)
            changed_rows = build_plan_rows(changed_data, {player_id})
        except Exception:
            raise apply_error
        if len(changed_rows) == 1:
            changed_row = changed_rows[0]
            raise ApplyFailed(
                f"{apply_error}; refreshed action is {changed_row['action']}: {changed_row['reason']}"
            ) from apply_error
        raise
    try:
        after_data = data_loader(client)
        after_row = verify_applied_state(result, refreshed_row, after_data)
    except ApplyRecoveryRequired:
        raise
    except Exception as verification_error:
        raise ApplyRecoveryRequired(
            f"writes completed for profile {result['profile_id']}, but final verification failed; "
            "review the profile, link, and membership manually"
        ) from verification_error
    result["before_row"] = refreshed_row
    result["after_row"] = after_row
    return result


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Create a RevSports placeholder plan; default mode is read-only."
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=DEFAULT_OUTPUT,
        help=f"Local CSV path (default: {DEFAULT_OUTPUT}).",
    )
    parser.add_argument(
        "--player-id",
        action="append",
        default=[],
        help="Limit the report to one RevSports player ID. May be repeated.",
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Apply exactly one safe row. Disabled for the live SportStack project.",
    )
    parser.add_argument(
        "--confirm-create-placeholder",
        action="store_true",
        help="Required acknowledgement for --apply, including link_existing.",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    try:
        validate_cli_safety(args)
    except ApplyRefused as error:
        raise SystemExit(f"Apply refused: {error}") from error

    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SUPABASE_SERVICE_KEY")
    if not url or not key:
        raise SystemExit(
            "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY/SUPABASE_SERVICE_KEY."
        )
    if args.apply:
        try:
            validate_apply_target(url)
        except ApplyRefused as error:
            raise SystemExit(f"Apply refused: {error}") from error

    # Import here so pure planner tests do not require the Supabase package.
    from supabase import create_client

    client = create_client(url, key)
    data = load_data(client)
    player_ids = {clean_text(value) for value in args.player_id if clean_text(value)} or None
    rows = build_plan_rows(data, player_ids)
    write_csv(args.output, rows)

    counts = Counter(row["action"] for row in rows)
    print(f"Wrote read-only plan: {args.output}")
    print(f"Rows: {len(rows)}")
    for action in ("create_placeholder", "link_existing", "needs_review", "skip"):
        print(f"{action}: {counts[action]}")
    if not args.apply:
        print("No Supabase records were changed.")
        return 0

    player_id = clean_text(args.player_id[0])
    try:
        result = run_guarded_apply(client, player_id)
    except (ApplyRefused, ApplyFailed, ApplyRecoveryRequired) as error:
        raise SystemExit(f"Apply stopped: {error}") from error

    print("After apply:")
    print(f"  effective action: {result['effective_action']}")
    print(f"  profile ID: {result['profile_id']}")
    print(f"  auth shell created: {bool_text(result['auth_created'])}")
    print(f"  membership created: {bool_text(result['membership_created'])}")
    print(f"  membership type: {result['membership_type']}")
    print(f"  external link: {result['link_operation']}")
    print("  final planner action: skip (already linked)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
