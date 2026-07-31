"""Focused tests for the current RevSports fixture promotion path."""

from __future__ import annotations

import unittest

from bs4 import BeautifulSoup

from scraper.scraper import (
    build_external_entity_rows,
    extract_round_card_details,
    infer_bye_round_context,
)
from scripts.import_revsports_fixtures_v2 import build_rows


def complete_mappings() -> dict:
    """Return the smallest fully mapped association used by the tests."""
    return {
        "teams_by_revsports_id": {"home-source": "home-team", "away-source": "away-team"},
        "teams_by_context": {},
        "competitions_by_context": {("test association", "2026 competition"): "competition-id"},
        "divisions_by_context": {("test association", "2026 competition", "open"): "division-id"},
        "venues_by_context": {("test association", "test venue"): "venue-id"},
        "pitches_by_context": {("test association", "test venue", "pitch 1"): "pitch-id"},
        "season_by_competition": {"competition-id": "season-id"},
        "division_ids_by_team": {
            "home-team": {"division-id"},
            "away-team": {"division-id"},
        },
    }


def match_row(**overrides: object) -> dict:
    """Return one complete source match; callers can override individual fields."""
    row = {
        "association_name": "Test Association",
        "competition_name": "2026 Competition",
        "grade": "Open",
        "match_url": "https://example.test/match/1",
        "game_date": "2026-07-31",
        "game_time": "19:30:00",
        "venue_name": "Test Venue",
        "pitch_name": "Pitch 1",
        "home_team_name": "Home",
        "home_revsports_team_id": "home-source",
        "away_team_name": "Away",
        "away_revsports_team_id": "away-source",
        "home_score": 3,
        "away_score": 2,
        "round_number": 4,
        "round_name": "Round 4",
        "raw_data": {},
    }
    row.update(overrides)
    return row


class RevSportsFixtureV2Tests(unittest.TestCase):
    def test_competitions_are_emitted_as_stable_external_entities(self) -> None:
        entities = build_external_entity_rows([
            {
                "association": "Test Association",
                "competition_name": "2026 Competition",
                "match_url": "https://example.test/match/1",
            }
        ])

        competition = next(entity for entity in entities if entity["entity_type"] == "competition")
        self.assertEqual("Test Association|competition|2026 Competition", competition["external_id"])
        self.assertTrue(competition["raw_data"]["synthetic_external_id"])

    def test_complete_match_promotes_fixture_and_result_fields(self) -> None:
        rows, skipped, stats = build_rows([match_row()], complete_mappings())

        self.assertEqual([], skipped)
        self.assertEqual(1, stats["resolved"])
        self.assertEqual("season-id", rows[0]["season_id"])
        self.assertEqual("division-id", rows[0]["division_id"])
        self.assertEqual("pitch-id", rows[0]["pitch_id"])
        self.assertEqual(3, rows[0]["home_score"])
        self.assertEqual(2, rows[0]["away_score"])
        self.assertEqual("COMPLETED", rows[0]["status"])

    def test_required_mapping_gap_blocks_partial_fixture(self) -> None:
        mappings = complete_mappings()
        mappings["season_by_competition"] = {}

        rows, skipped, stats = build_rows([match_row()], mappings)

        self.assertEqual([], rows)
        self.assertEqual(1, len(skipped))
        self.assertIn("missing_season_mapping", skipped[0]["reason"])
        self.assertEqual(1, stats["skipped_missing_season_mapping"])

    def test_known_venue_in_pitch_field_recovers_malformed_location(self) -> None:
        rows, skipped, stats = build_rows([
            match_row(venue_name="Malformed value", pitch_name="Test Venue")
        ], complete_mappings())

        self.assertEqual([], skipped)
        self.assertEqual("venue-id", rows[0]["venue_id"])
        self.assertIsNone(rows[0]["pitch_id"])
        self.assertEqual(1, stats["venue_from_pitch_field"])
        self.assertEqual(0, stats["missing_venue"])
        self.assertEqual(0, stats["missing_pitch"])

    def test_round_card_uses_the_linked_venue_name_over_malformed_text(self) -> None:
        card = BeautifulSoup(
            """
            <div>
              <span>Sun 28 Jun 2026</span><span>15:30</span>
              <span>In8n</span>
              <a href="/hockeyballarat/venues/26298/18277">Prince of Wales Park</a>
              <a href="/hockeyballarat/games/team/26298/417795">Bobcats Women</a>
            </div>
            """,
            "html.parser",
        ).div

        details = extract_round_card_details(
            card,
            "https://www.revolutionise.com.au/hockeyballarat/games/26298/14931",
        )

        self.assertEqual("Prince of Wales Park", details["round_venue"])
        self.assertEqual("", details["round_pitch"])

    def test_bye_context_infers_unique_date_and_location(self) -> None:
        context = infer_bye_round_context([
            {
                "round_date": "2026-08-01",
                "round_venue": "Test Venue",
                "round_pitch": "Pitch 1",
                "round_venue_url": "https://example.test/venue/1",
                "round_venue_id": "venue-source-1",
            },
            {
                "round_date": "2026-08-01",
                "round_venue": "Test Venue",
                "round_pitch": "Pitch 1",
                "round_venue_url": "https://example.test/venue/1",
                "round_venue_id": "venue-source-1",
            },
        ])

        self.assertEqual("2026-08-01", context["round_date"])
        self.assertEqual("Test Venue", context["round_venue"])
        self.assertEqual("Pitch 1", context["round_pitch"])
        self.assertEqual("Test Venue — Pitch 1", context["bye_round_locations"])
        self.assertTrue(context["bye_context_inferred"])

    def test_bye_context_records_ambiguous_locations_without_inventing_one(self) -> None:
        context = infer_bye_round_context([
            {"round_date": "2026-08-01", "round_venue": "Venue A", "round_pitch": "Pitch 1"},
            {"round_date": "2026-08-01", "round_venue": "Venue B", "round_pitch": "Pitch 2"},
        ])

        self.assertEqual("2026-08-01", context["round_date"])
        self.assertEqual("", context["round_venue"])
        self.assertEqual("", context["round_pitch"])
        self.assertEqual("Venue A — Pitch 1; Venue B — Pitch 2", context["bye_round_locations"])

    def test_bye_imports_inferred_date_location_and_round_location_notes(self) -> None:
        rows, skipped, stats = build_rows([
            match_row(
                match_url="revsports-bye|test|round-5",
                game_time=None,
                away_team_name=None,
                away_revsports_team_id=None,
                home_score=None,
                away_score=None,
                raw_data={
                    "is_bye": True,
                    "bye_round_locations": "Test Venue — Pitch 1",
                    "bye_context_inferred": True,
                },
            )
        ], complete_mappings())

        self.assertEqual([], skipped)
        self.assertIsNotNone(rows[0]["fixture_date"])
        self.assertEqual("venue-id", rows[0]["venue_id"])
        self.assertEqual("pitch-id", rows[0]["pitch_id"])
        self.assertEqual("BYE — Round locations: Test Venue — Pitch 1", rows[0]["notes"])
        self.assertEqual(1, stats["bye_date_resolved"])
        self.assertEqual(1, stats["bye_locations_recorded"])

    def test_bye_keeps_home_team_and_allows_no_date_or_away_team(self) -> None:
        rows, skipped, stats = build_rows([
            match_row(
                match_url="revsports-bye|test|round-5",
                game_date=None,
                game_time=None,
                away_team_name=None,
                away_revsports_team_id=None,
                home_score=None,
                away_score=None,
                raw_data={"is_bye": True},
            )
        ], complete_mappings())

        self.assertEqual([], skipped)
        self.assertEqual(1, stats["byes"])
        self.assertIsNone(rows[0]["away_team_id"])
        self.assertIsNone(rows[0]["fixture_date"])
        self.assertEqual("SCHEDULED", rows[0]["status"])


if __name__ == "__main__":
    unittest.main()
