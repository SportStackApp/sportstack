"""Focused tests for the current RevSports fixture promotion path."""

from __future__ import annotations

import unittest

from scraper.scraper import build_external_entity_rows
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
