"""Tests for the read-only RevSports placeholder planner."""

from __future__ import annotations

import copy
import importlib.util
import json
import unittest
from contextlib import redirect_stdout
from io import StringIO
from pathlib import Path

SCRIPT_PATH = Path(__file__).parents[1] / "scripts" / "revsports_placeholder_plan.py"
SPEC = importlib.util.spec_from_file_location("revsports_placeholder_plan", SCRIPT_PATH)
assert SPEC and SPEC.loader
planner = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(planner)


def max_f_data() -> dict[str, list[dict]]:
    """Return a small in-memory version of the Max F. source context."""

    return {
        "external_entities": [
            {
                "id": "player-entity-max",
                "source": "revsports",
                "entity_type": "player",
                "external_id": "XereEs8",
                "external_name": "Max F.",
                "association_name": "Hockey Ballarat",
                "competition_name": "Hockey Ballarat 2026 Winter Competition",
                "grade": "Division 1 Men",
                "club_name": "Blaze",
                "team_name": "Blaze Div 1 Men",
                "status": "pending",
                "last_seen_at": "2026-07-15T12:00:00+00:00",
                "updated_at": "2026-07-15T12:00:00+00:00",
            },
            {
                "id": "team-entity-blaze",
                "source": "revsports",
                "entity_type": "team",
                "external_id": "417788",
                "external_name": "Blaze Div 1 Men",
                "association_name": "Hockey Ballarat",
                "competition_name": "Hockey Ballarat 2026 Winter Competition",
                "grade": "Division 1 Men",
                "club_name": "Blaze",
                "team_name": "Blaze Div 1 Men",
                "status": "matched",
            },
        ],
        "external_entity_links": [
            {
                "external_entity_id": "team-entity-blaze",
                "target_table": "teams",
                "target_id": "d76b45d9-9cc4-42de-a724-de9c0dcd95d6",
                "status": "matched",
            }
        ],
        "source_revsports_player_appearances": [
            {
                "id": "appearance-max-1",
                "scrape_run_id": "run-2026-07-15",
                "match_id": "match-1",
                "appearance_key": "match-1|417788|XereEs8",
                "club_name": "Blaze",
                "team_name": "Blaze Div 1 Men",
                "revsports_team_id": "417788",
                "player_name": "Max F.",
                "revsports_player_id": "XereEs8",
                "is_fillin": True,
                "is_removed": False,
                "last_seen_at": "2026-07-15T12:00:00+00:00",
                "scraped_at": "2026-07-15T12:00:00+00:00",
                "updated_at": "2026-07-15T12:00:00+00:00",
            }
        ],
        "source_revsports_matches": [
            {
                "id": "match-1",
                "scrape_run_id": "run-2026-07-15",
                "association_name": "Hockey Ballarat",
                "competition_name": "Hockey Ballarat 2026 Winter Competition",
                "grade": "Division 1 Men",
                "last_seen_at": "2026-07-15T12:00:00+00:00",
                "scraped_at": "2026-07-15T12:00:00+00:00",
            }
        ],
        "revsports_player_registry": [
            {
                "revsports_player_id": "XereEs8",
                "association": "Hockey Ballarat",
                "player_name": "Max F.",
                "first_name": "Max",
                "last_name": "F",
                "profile_id": None,
                "scraped_at": "2026-07-15T12:00:00+00:00",
            }
        ],
        "revsports_player_mappings": [],
        # This same-name profile deliberately has a different RevSports ID.
        "profiles": [
            {
                "id": "other-max-profile",
                "first_name": "Max",
                "last_name": "F",
                "revsports_player_id": "DIFFERENT-ID",
                "is_placeholder": True,
            }
        ],
        "teams": [
            {
                "id": "d76b45d9-9cc4-42de-a724-de9c0dcd95d6",
                "name": "Blaze",
                "club_id": "club-blaze",
                "division_id": "division-1-open",
                "division": "Division 1 Open",
            }
        ],
        "clubs": [
            {"id": "club-blaze", "name": "Blaze", "association_id": "association-ballarat"}
        ],
        "associations": [
            {"id": "association-ballarat", "name": "Hockey Ballarat"}
        ],
        "divisions": [
            {
                "id": "division-1-open",
                "name": "Division 1 Open",
                "association_id": "association-ballarat",
                "competition_id": "competition-winter",
                "season_id": "season-2026",
            }
        ],
        "competitions": [
            {
                "id": "competition-winter",
                "name": "Winter Competition",
                "association_id": "association-ballarat",
                "season_id": "season-2026",
            }
        ],
        "team_divisions": [],
        "team_memberships": [],
    }


class FakeApplyBackend:
    """In-memory backend used to prove apply behaviour without Supabase writes."""

    def __init__(self, data: dict[str, list[dict]]):
        self.data = data
        self.auth_users: set[str] = set()
        self.auth_create_count = 0
        self.auth_delete_count = 0
        self.membership_create_count = 0
        self.membership_delete_count = 0
        self.link_write_count = 0
        self.fail_profile_update = False
        self.fail_auth_cleanup = False
        self.fail_link_write = False
        self.fail_identity_after_link_attempt = False
        self.link_attempted = False

    def identity_state(self, revsports_player_id: str, external_entity_id: str) -> dict:
        if self.fail_identity_after_link_attempt and self.link_attempted:
            raise RuntimeError("simulated identity verification outage")
        profile_ids = [
            row["id"] for row in self.data["profiles"]
            if row.get("revsports_player_id") == revsports_player_id
        ]
        links = [
            copy.deepcopy(row) for row in self.data["external_entity_links"]
            if row.get("external_entity_id") == external_entity_id
            and row.get("target_table") == "profiles"
        ]
        return {"profile_ids": profile_ids, "links": links}

    def create_auth_user(self, row: dict) -> str:
        self.auth_create_count += 1
        profile_id = f"new-placeholder-{self.auth_create_count}"
        self.auth_users.add(profile_id)
        # The real auth trigger creates this blank profile row.
        self.data["profiles"].append({
            "id": profile_id,
            "first_name": None,
            "last_name": None,
            "revsports_player_id": None,
            "is_placeholder": False,
        })
        return profile_id

    def delete_auth_user(self, user_id: str) -> None:
        if self.fail_auth_cleanup:
            raise RuntimeError("simulated auth cleanup failure")
        self.auth_delete_count += 1
        self.auth_users.discard(user_id)
        self.data["profiles"] = [row for row in self.data["profiles"] if row.get("id") != user_id]
        self.data["team_memberships"] = [
            row for row in self.data["team_memberships"] if row.get("user_id") != user_id
        ]

    def update_placeholder_profile(self, profile_id: str, row: dict) -> None:
        if self.fail_profile_update:
            raise RuntimeError("simulated profile update failure")
        profile = next(item for item in self.data["profiles"] if item["id"] == profile_id)
        profile.update({
            "first_name": row["proposed_first_name"],
            "last_name": row["proposed_last_name"],
            "revsports_player_id": row["revsports_player_id"],
            "is_placeholder": True,
        })

    def find_memberships(self, profile_id: str, team_id: str) -> list[dict]:
        return [
            copy.deepcopy(row) for row in self.data["team_memberships"]
            if row.get("user_id") == profile_id and row.get("team_id") == team_id
        ]

    def insert_membership(self, profile_id: str, row: dict) -> str:
        self.membership_create_count += 1
        membership_id = f"membership-{self.membership_create_count}"
        self.data["team_memberships"].append({
            "id": membership_id,
            "user_id": profile_id,
            "team_id": row["proposed_team_id"],
            "membership_type": row["proposed_membership_type"],
            "status": "ACTIVE",
        })
        return membership_id

    def delete_membership(self, membership_id: str) -> None:
        self.membership_delete_count += 1
        self.data["team_memberships"] = [
            row for row in self.data["team_memberships"] if row.get("id") != membership_id
        ]

    def write_profile_link(self, profile_id: str, row: dict, state: dict) -> str:
        self.link_attempted = True
        if self.fail_link_write:
            raise RuntimeError("simulated link write failure")
        self.link_write_count += 1
        external_entity_id = planner.split_joined(row["external_entity_id"])[0]
        existing = [
            item for item in self.data["external_entity_links"]
            if item.get("external_entity_id") == external_entity_id
            and item.get("target_table") == "profiles"
        ]
        payload = {
            "target_id": profile_id,
            "status": "matched",
            "confidence": "exact_id",
            "notes": planner.link_audit_note(row, existing[0].get("notes") if existing else ""),
        }
        if existing:
            if existing[0].get("status") != "unmatched" or existing[0].get("target_id"):
                raise planner.ApplyRefused("link is not safely writable")
            existing[0].update(payload)
            return "updated"
        self.data["external_entity_links"].append({
            "id": f"profile-link-{self.link_write_count}",
            "external_entity_id": external_entity_id,
            "target_table": "profiles",
            **payload,
        })
        return "created"


class RevsportsPlaceholderPlanTests(unittest.TestCase):
    def plan_one(self, data: dict[str, list[dict]]) -> dict:
        rows = planner.build_plan_rows(data)
        self.assertEqual(1, len(rows))
        return rows[0]

    def run_apply(
        self,
        data: dict[str, list[dict]],
        backend: FakeApplyBackend | None = None,
    ) -> tuple[dict, FakeApplyBackend, int]:
        backend = backend or FakeApplyBackend(data)
        load_count = 0

        def loader(_client: object) -> dict[str, list[dict]]:
            nonlocal load_count
            load_count += 1
            return copy.deepcopy(data)

        with redirect_stdout(StringIO()):
            result = planner.run_guarded_apply(None, "XereEs8", loader, backend)
        return result, backend, load_count

    def test_max_f_is_fill_in_placeholder_candidate(self) -> None:
        row = self.plan_one(max_f_data())

        self.assertEqual("create_placeholder", row["action"])
        self.assertEqual("safe placeholder candidate", row["reason"])
        self.assertEqual("XereEs8", row["revsports_player_id"])
        self.assertEqual("Max", row["proposed_first_name"])
        self.assertEqual("F", row["proposed_last_name"])
        self.assertEqual("last name is an initial", row["name_warning"])
        self.assertEqual("d76b45d9-9cc4-42de-a724-de9c0dcd95d6", row["proposed_team_id"])
        self.assertEqual("FILL_IN", row["proposed_membership_type"])
        self.assertEqual("true", row["all_appearances_fill_in"])

    def test_same_display_name_with_different_id_is_never_linked(self) -> None:
        row = self.plan_one(max_f_data())

        self.assertEqual("create_placeholder", row["action"])
        self.assertEqual("", row["existing_profile_id"])
        self.assertIn("same display name", row["warnings"])

    def test_existing_exact_id_profile_is_link_existing(self) -> None:
        data = max_f_data()
        data["profiles"].append({
            "id": "exact-profile",
            "first_name": "Max",
            "last_name": "F",
            "revsports_player_id": "XereEs8",
            "is_placeholder": False,
        })

        row = self.plan_one(data)
        self.assertEqual("link_existing", row["action"])
        self.assertEqual("exact RevSports ID profile exists", row["reason"])
        self.assertEqual("exact-profile", row["existing_profile_id"])

    def test_existing_matched_profile_link_is_skipped(self) -> None:
        data = max_f_data()
        data["profiles"].append({
            "id": "linked-profile",
            "first_name": "Max",
            "last_name": "F",
            "revsports_player_id": None,
            "is_placeholder": False,
        })
        data["external_entity_links"].append({
            "external_entity_id": "player-entity-max",
            "target_table": "profiles",
            "target_id": "linked-profile",
            "status": "matched",
        })

        row = self.plan_one(data)
        self.assertEqual("skip", row["action"])
        self.assertEqual("already linked", row["reason"])

    def test_ignored_link_is_skipped_and_not_overwritten(self) -> None:
        data = max_f_data()
        data["external_entity_links"].append({
            "external_entity_id": "player-entity-max",
            "target_table": "profiles",
            "target_id": None,
            "status": "ignored",
        })

        row = self.plan_one(data)
        self.assertEqual("skip", row["action"])
        self.assertIn("ignored", row["reason"])
        self.assertEqual("ignored", row["existing_link_status"])

    def test_exact_team_id_requires_valid_context(self) -> None:
        valid_row = self.plan_one(max_f_data())
        self.assertEqual("exact_external_team_id", valid_row["team_match_basis"])

        conflicting = max_f_data()
        conflicting["source_revsports_matches"][0]["association_name"] = "Different Association"
        conflict_row = self.plan_one(conflicting)
        self.assertEqual("needs_review", conflict_row["action"])
        self.assertIn("association context conflicts", conflict_row["reason"])

    def test_multiple_teams_need_review(self) -> None:
        data = max_f_data()
        data["external_entities"].append({
            "id": "team-entity-lakers",
            "source": "revsports",
            "entity_type": "team",
            "external_id": "999999",
            "external_name": "Lakers Div 1 Men",
            "association_name": "Hockey Ballarat",
            "competition_name": "Hockey Ballarat 2026 Winter Competition",
            "grade": "Division 1 Men",
            "club_name": "Lakers",
            "team_name": "Lakers Div 1 Men",
            "status": "matched",
        })
        data["external_entity_links"].append({
            "external_entity_id": "team-entity-lakers",
            "target_table": "teams",
            "target_id": "team-lakers",
            "status": "matched",
        })
        data["teams"].append({
            "id": "team-lakers",
            "name": "Lakers",
            "club_id": "club-lakers",
            "division_id": "division-1-open",
            "division": "Division 1 Open",
        })
        data["clubs"].append({
            "id": "club-lakers",
            "name": "Lakers",
            "association_id": "association-ballarat",
        })
        second_appearance = copy.deepcopy(data["source_revsports_player_appearances"][0])
        second_appearance.update({
            "id": "appearance-max-2",
            "appearance_key": "match-2|999999|XereEs8",
            "match_id": "match-2",
            "club_name": "Lakers",
            "team_name": "Lakers Div 1 Men",
            "revsports_team_id": "999999",
        })
        data["source_revsports_player_appearances"].append(second_appearance)
        second_match = copy.deepcopy(data["source_revsports_matches"][0])
        second_match["id"] = "match-2"
        data["source_revsports_matches"].append(second_match)

        row = self.plan_one(data)
        self.assertEqual("needs_review", row["action"])
        self.assertIn("multiple SportStack teams", row["reason"])
        self.assertEqual("", row["proposed_team_id"])
        self.assertIn("team-lakers", row["distinct_sportstack_team_ids"])

    def test_ambiguous_context_match_needs_review(self) -> None:
        data = max_f_data()
        data["source_revsports_player_appearances"][0]["revsports_team_id"] = None
        duplicate_team = copy.deepcopy(data["teams"][0])
        duplicate_team["id"] = "second-blaze-team"
        data["teams"].append(duplicate_team)

        row = self.plan_one(data)
        self.assertEqual("needs_review", row["action"])
        self.assertIn("matches multiple SportStack teams", row["reason"])
        self.assertEqual("", row["proposed_team_id"])

    def test_normal_appearance_proposes_primary(self) -> None:
        data = max_f_data()
        normal_appearance = copy.deepcopy(data["source_revsports_player_appearances"][0])
        normal_appearance.update({"id": "appearance-max-2", "appearance_key": "normal", "is_fillin": False})
        data["source_revsports_player_appearances"].append(normal_appearance)

        row = self.plan_one(data)
        self.assertEqual("create_placeholder", row["action"])
        self.assertEqual("PRIMARY", row["proposed_membership_type"])
        self.assertEqual("false", row["all_appearances_fill_in"])

    def test_planning_is_repeatable_and_does_not_mutate_input(self) -> None:
        data = max_f_data()
        before = json.dumps(data, sort_keys=True)

        first = planner.build_plan_rows(data)
        second = planner.build_plan_rows(data)

        self.assertEqual(first, second)
        self.assertEqual(before, json.dumps(data, sort_keys=True))

    def test_default_cli_remains_dry_run(self) -> None:
        args = planner.parse_args(["--player-id", "XereEs8"])
        planner.validate_cli_safety(args)

        self.assertFalse(args.apply)
        self.assertFalse(args.confirm_create_placeholder)

    def test_apply_without_player_id_fails(self) -> None:
        args = planner.parse_args(["--apply", "--confirm-create-placeholder"])

        with self.assertRaisesRegex(planner.ApplyRefused, "exactly one --player-id"):
            planner.validate_cli_safety(args)

    def test_apply_without_confirmation_fails(self) -> None:
        args = planner.parse_args(["--apply", "--player-id", "XereEs8"])

        with self.assertRaisesRegex(planner.ApplyRefused, "--confirm-create-placeholder"):
            planner.validate_cli_safety(args)

    def test_apply_with_multiple_player_ids_fails(self) -> None:
        args = planner.parse_args([
            "--apply",
            "--confirm-create-placeholder",
            "--player-id",
            "XereEs8",
            "--player-id",
            "another-id",
        ])

        with self.assertRaisesRegex(planner.ApplyRefused, "exactly one --player-id"):
            planner.validate_cli_safety(args)

    def test_apply_is_disabled_for_live_project(self) -> None:
        with self.assertRaisesRegex(planner.ApplyRefused, "disabled for the live"):
            planner.validate_apply_target(
                "https://svierarfcolhcfjpmwck.supabase.co"
            )

    def test_create_placeholder_writes_one_auth_profile_link_and_membership(self) -> None:
        data = max_f_data()

        result, backend, load_count = self.run_apply(data)

        self.assertEqual("create_placeholder", result["effective_action"])
        self.assertEqual(1, backend.auth_create_count)
        self.assertEqual(1, backend.membership_create_count)
        self.assertEqual(1, backend.link_write_count)
        self.assertEqual(2, load_count, "apply must load immediately before and after writing")
        exact_profiles = [
            row for row in data["profiles"] if row.get("revsports_player_id") == "XereEs8"
        ]
        self.assertEqual(1, len(exact_profiles))
        profile_id = exact_profiles[0]["id"]
        self.assertTrue(exact_profiles[0]["is_placeholder"])
        memberships = [row for row in data["team_memberships"] if row["user_id"] == profile_id]
        self.assertEqual(1, len(memberships))
        self.assertEqual("FILL_IN", memberships[0]["membership_type"])
        self.assertEqual("ACTIVE", memberships[0]["status"])
        links = [
            row for row in data["external_entity_links"]
            if row.get("external_entity_id") == "player-entity-max"
            and row.get("target_table") == "profiles"
        ]
        self.assertEqual(1, len(links))
        self.assertEqual(profile_id, links[0]["target_id"])

    def test_same_name_different_id_does_not_block_apply(self) -> None:
        data = max_f_data()

        result, backend, _ = self.run_apply(data)

        self.assertTrue(result["auth_created"])
        self.assertEqual(1, backend.auth_create_count)
        self.assertEqual(2, len(data["profiles"]))
        self.assertEqual(
            {"DIFFERENT-ID", "XereEs8"},
            {row.get("revsports_player_id") for row in data["profiles"]},
        )

    def test_existing_exact_id_profile_links_without_creating_profile(self) -> None:
        data = max_f_data()
        data["profiles"].append({
            "id": "exact-profile",
            "first_name": "Max",
            "last_name": "F",
            "revsports_player_id": "XereEs8",
            "is_placeholder": False,
        })

        result, backend, _ = self.run_apply(data)

        self.assertEqual("link_existing", result["effective_action"])
        self.assertFalse(result["auth_created"])
        self.assertEqual("exact-profile", result["profile_id"])
        self.assertEqual(0, backend.auth_create_count)
        self.assertEqual(2, len(data["profiles"]))
        self.assertEqual(1, backend.membership_create_count)
        self.assertEqual(1, backend.link_write_count)

    def test_existing_unmatched_link_is_guardedly_updated(self) -> None:
        data = max_f_data()
        data["profiles"].append({
            "id": "exact-profile",
            "first_name": "Max",
            "last_name": "F",
            "revsports_player_id": "XereEs8",
            "is_placeholder": False,
        })
        data["external_entity_links"].append({
            "id": "unmatched-profile-link",
            "external_entity_id": "player-entity-max",
            "target_table": "profiles",
            "target_id": None,
            "status": "unmatched",
            "notes": "Existing review note.",
        })

        result, backend, _ = self.run_apply(data)

        self.assertEqual("updated", result["link_operation"])
        self.assertEqual(1, backend.link_write_count)
        link = next(
            row for row in data["external_entity_links"]
            if row.get("id") == "unmatched-profile-link"
        )
        self.assertEqual("matched", link["status"])
        self.assertEqual("exact-profile", link["target_id"])
        self.assertIn("Existing review note.", link["notes"])
        self.assertIn("RevSports placeholder planner Phase 3", link["notes"])

    def test_existing_relevant_membership_is_not_duplicated(self) -> None:
        data = max_f_data()
        data["profiles"].append({
            "id": "exact-profile",
            "first_name": "Max",
            "last_name": "F",
            "revsports_player_id": "XereEs8",
            "is_placeholder": False,
        })
        data["team_memberships"].append({
            "id": "existing-membership",
            "user_id": "exact-profile",
            "team_id": "d76b45d9-9cc4-42de-a724-de9c0dcd95d6",
            "membership_type": "FILL_IN",
            "status": "ACTIVE",
        })

        result, backend, _ = self.run_apply(data)

        self.assertFalse(result["membership_created"])
        self.assertEqual(0, backend.membership_create_count)
        self.assertEqual(1, len(data["team_memberships"]))

    def test_exact_profile_appearing_after_plan_is_reclassified(self) -> None:
        data = max_f_data()
        planned_row = self.plan_one(copy.deepcopy(data))
        self.assertEqual("create_placeholder", planned_row["action"])
        data["profiles"].append({
            "id": "racing-exact-profile",
            "first_name": "Max",
            "last_name": "F",
            "revsports_player_id": "XereEs8",
            "is_placeholder": False,
        })
        backend = FakeApplyBackend(data)

        result = planner.apply_revalidated_row(planned_row, backend)

        self.assertEqual("link_existing", result["effective_action"])
        self.assertEqual("racing-exact-profile", result["profile_id"])
        self.assertEqual(0, backend.auth_create_count)

    def test_existing_matched_link_apply_fails_without_writes(self) -> None:
        data = max_f_data()
        data["profiles"].append({
            "id": "linked-profile",
            "first_name": "Max",
            "last_name": "F",
            "revsports_player_id": "XereEs8",
            "is_placeholder": False,
        })
        data["external_entity_links"].append({
            "id": "existing-profile-link",
            "external_entity_id": "player-entity-max",
            "target_table": "profiles",
            "target_id": "linked-profile",
            "status": "matched",
        })
        backend = FakeApplyBackend(data)

        with self.assertRaisesRegex(planner.ApplyRefused, "planned action is skip"):
            self.run_apply(data, backend)
        self.assertEqual(0, backend.auth_create_count)
        self.assertEqual(0, backend.membership_create_count)
        self.assertEqual(0, backend.link_write_count)

    def test_ambiguous_team_cannot_apply(self) -> None:
        data = max_f_data()
        data["source_revsports_player_appearances"][0]["revsports_team_id"] = None
        duplicate_team = copy.deepcopy(data["teams"][0])
        duplicate_team["id"] = "second-blaze-team"
        data["teams"].append(duplicate_team)
        backend = FakeApplyBackend(data)

        with self.assertRaisesRegex(planner.ApplyRefused, "planned action is needs_review"):
            self.run_apply(data, backend)
        self.assertEqual(0, backend.auth_create_count)

    def test_multiple_teams_cannot_apply(self) -> None:
        data = max_f_data()
        row = self.plan_one(data)
        row["distinct_sportstack_team_ids"] = (
            "d76b45d9-9cc4-42de-a724-de9c0dcd95d6 | another-team"
        )
        backend = FakeApplyBackend(data)

        with self.assertRaisesRegex(planner.ApplyRefused, "ambiguous or contains multiple"):
            planner.apply_revalidated_row(row, backend)
        self.assertEqual(0, backend.auth_create_count)

    def test_apply_twice_is_idempotent(self) -> None:
        data = max_f_data()
        backend = FakeApplyBackend(data)
        self.run_apply(data, backend)
        counts_after_first = (
            backend.auth_create_count,
            backend.membership_create_count,
            backend.link_write_count,
        )

        with self.assertRaisesRegex(planner.ApplyRefused, "planned action is skip"):
            self.run_apply(data, backend)

        self.assertEqual(
            counts_after_first,
            (
                backend.auth_create_count,
                backend.membership_create_count,
                backend.link_write_count,
            ),
        )

    def test_failure_after_auth_creation_cleans_up_shell(self) -> None:
        data = max_f_data()
        backend = FakeApplyBackend(data)
        backend.fail_profile_update = True

        with self.assertRaisesRegex(planner.ApplyFailed, "shell .* was removed"):
            self.run_apply(data, backend)

        self.assertEqual(1, backend.auth_create_count)
        self.assertEqual(1, backend.auth_delete_count)
        self.assertEqual(set(), backend.auth_users)
        self.assertFalse(
            any(row.get("revsports_player_id") == "XereEs8" for row in data["profiles"])
        )

    def test_failed_auth_cleanup_reports_manual_recovery(self) -> None:
        data = max_f_data()
        backend = FakeApplyBackend(data)
        backend.fail_profile_update = True
        backend.fail_auth_cleanup = True

        with self.assertRaisesRegex(
            planner.ApplyRecoveryRequired,
            "automatic cleanup failed.*review that auth/profile shell",
        ):
            self.run_apply(data, backend)

        self.assertEqual(1, backend.auth_create_count)
        self.assertEqual(1, len(backend.auth_users))

    def test_unknown_link_outcome_keeps_shell_for_manual_recovery(self) -> None:
        data = max_f_data()
        backend = FakeApplyBackend(data)
        backend.fail_link_write = True
        backend.fail_identity_after_link_attempt = True

        with self.assertRaisesRegex(
            planner.ApplyRecoveryRequired,
            "external link outcome is unknown.*do not retry",
        ):
            self.run_apply(data, backend)

        self.assertEqual(1, backend.auth_create_count)
        self.assertEqual(0, backend.auth_delete_count)
        self.assertEqual(1, len(backend.auth_users))
        self.assertEqual(1, len(data["team_memberships"]))


if __name__ == "__main__":
    unittest.main()
