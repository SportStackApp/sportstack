"""Tests for selecting exact fixtures after their expected finish."""

from __future__ import annotations

import importlib.util
import unittest
from copy import deepcopy
from datetime import datetime, timezone
from pathlib import Path

SCRIPT_PATH = (
    Path(__file__).parents[1] / "scripts" / "select_due_fixture_scrapes.py"
)


def load_selector_module():
    spec = importlib.util.spec_from_file_location(
        "select_due_fixture_scrapes",
        SCRIPT_PATH,
    )
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class DueFixtureSelectorTests(unittest.TestCase):
    def setUp(self) -> None:
        self.as_of = datetime(2026, 8, 1, 4, 0, tzinfo=timezone.utc)
        self.fixture = {
            "id": "fixture-1",
            "fixture_date": "2026-08-01T01:00:00+00:00",
            "scheduled_end_at": None,
            "status": "SCHEDULED",
            "revsports_match_url": (
                "https://www.revolutionise.com.au/hockeyballarat/game/12345"
            ),
        }
        self.source = {
            "match_url": self.fixture["revsports_match_url"],
            "association_name": "Hockey Ballarat",
            "competition_name": "2026 Winter",
            "grade": "Division 1 Men",
            "round_name": "Round 12",
            "game_date": "2026-08-01",
            "game_time": "11:00:00",
            "venue_name": "Prince of Wales Park",
            "pitch_name": "Pitch 1",
            "home_team_name": "Home",
            "away_team_name": "Away",
            "last_seen_at": "2026-08-01T00:00:00+00:00",
            "raw_data": {
                "revsports_competition_id": "26298",
                "revsports_grade_id": "14930",
                "home_team_url": (
                    "https://www.revolutionise.com.au/hockeyballarat/"
                    "games/team/26298/100"
                ),
                "away_team_url": (
                    "https://www.revolutionise.com.au/hockeyballarat/"
                    "games/team/26298/200"
                ),
                "home_team_label": "Home Club",
                "away_team_label": "Away Club",
                "revsports_venue_url": (
                    "https://www.revolutionise.com.au/hockeyballarat/"
                    "venues/26298/300"
                ),
                "revsports_venue_id": "300",
            },
        }
        self.associations = [
            {
                "name": "Hockey Ballarat",
                "default_match_duration_minutes": 90,
            }
        ]

    def select(self, fixture=None, source=None):
        selector = load_selector_module()
        return selector.select_due_targets(
            [fixture or self.fixture],
            [source or self.source],
            self.associations,
            as_of=self.as_of,
        )

    def test_selects_one_exact_fixture_after_default_duration(self) -> None:
        targets = self.select()

        self.assertEqual(1, len(targets))
        self.assertEqual("12345", targets[0]["game_id"])
        self.assertEqual("fixture-1", targets[0]["fixture_id"])
        self.assertEqual("Hockey Ballarat", targets[0]["association_name"])
        self.assertEqual("14930", targets[0]["grade_id"])
        self.assertEqual("300", targets[0]["venue_id"])

    def test_waits_until_expected_finish_and_honours_exact_end(self) -> None:
        selector = load_selector_module()
        before_finish = selector.select_due_targets(
            [self.fixture],
            [self.source],
            self.associations,
            as_of=datetime(2026, 8, 1, 2, 0, tzinfo=timezone.utc),
        )
        exact_end_fixture = deepcopy(self.fixture)
        exact_end_fixture["scheduled_end_at"] = "2026-08-01T04:30:00+00:00"

        self.assertEqual([], before_finish)
        self.assertEqual([], self.select(fixture=exact_end_fixture))

    def test_completed_recently_scraped_and_old_fixtures_are_skipped(self) -> None:
        completed = deepcopy(self.fixture)
        completed["status"] = "COMPLETED"
        recently_seen = deepcopy(self.source)
        recently_seen["last_seen_at"] = "2026-08-01T03:30:00+00:00"
        old = deepcopy(self.fixture)
        old["fixture_date"] = "2026-07-31T12:00:00+00:00"

        self.assertEqual([], self.select(fixture=completed))
        self.assertEqual([], self.select(source=recently_seen))
        self.assertEqual([], self.select(fixture=old))

    def test_retry_becomes_due_after_45_minutes(self) -> None:
        retry = deepcopy(self.source)
        retry["last_seen_at"] = "2026-08-01T03:00:00+00:00"

        self.assertEqual(1, len(self.select(source=retry)))

    def test_rejects_cross_origin_match_and_team_urls(self) -> None:
        unsafe_match = deepcopy(self.fixture)
        unsafe_match["revsports_match_url"] = "https://example.com/game/12345"
        unsafe_source = deepcopy(self.source)
        unsafe_source["match_url"] = unsafe_match["revsports_match_url"]
        unsafe_team = deepcopy(self.source)
        unsafe_team["raw_data"]["home_team_url"] = (
            "https://example.com/hockeyballarat/games/team/26298/100"
        )

        self.assertEqual([], self.select(fixture=unsafe_match, source=unsafe_source))
        self.assertEqual([], self.select(source=unsafe_team))

    def test_malformed_port_is_rejected_without_crashing(self) -> None:
        selector = load_selector_module()

        self.assertEqual(
            "",
            selector.validate_source_url(
                "https://www.revolutionise.com.au:bad/hockeyballarat/game/12345",
                portal_url="https://www.revolutionise.com.au/hockeyballarat",
                path_suffix_pattern=r"/game/\d+",
            ),
        )


if __name__ == "__main__":
    unittest.main()
