"""Tests for the fail-closed exact-fixture schedule preflight."""

from __future__ import annotations

import importlib.util
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path


SCRIPT_PATH = Path(__file__).parents[1] / "scripts" / "verify_due_fixture_schedule.py"


def load_preflight_module():
    spec = importlib.util.spec_from_file_location("verify_due_fixture_schedule", SCRIPT_PATH)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    # Dataclasses expect the module to exist while decorators are evaluated.
    import sys

    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


class FixtureSchedulePreflightTests(unittest.TestCase):
    def setUp(self) -> None:
        self.preflight = load_preflight_module()
        self.portal_url = "https://www.revolutionise.com.au/hockeyballarat"
        self.match_url = f"{self.portal_url}/game/12345"
        self.round_url = f"{self.portal_url}/games/26298/14930/round/12"

    def test_builds_only_the_expected_round_url(self) -> None:
        self.assertEqual(
            self.round_url,
            self.preflight.build_round_url(
                self.portal_url,
                "26298",
                "14930",
                "12",
            ),
        )
        with self.assertRaises(RuntimeError):
            self.preflight.build_round_url(
                self.portal_url,
                "26298",
                "14930",
                "../../admin",
            )

    def test_named_final_uses_the_safe_home_team_page(self) -> None:
        team_url = (
            "https://www.revolutionise.com.au/hockeyballarat/"
            "games/team/26298/417805"
        )

        resolved_url, path_pattern = self.preflight.resolve_schedule_context_url(
            portal_url=self.portal_url,
            competition_id="26298",
            grade_id="14930",
            round_number="",
            home_team_url=team_url,
        )

        self.assertEqual(team_url, resolved_url)
        self.assertEqual(r"/games/team/\d+/\d+", path_pattern)
        with self.assertRaises(RuntimeError):
            self.preflight.resolve_schedule_context_url(
                portal_url=self.portal_url,
                competition_id="26298",
                grade_id="14930",
                round_number="",
                home_team_url="https://example.com/games/team/26298/417805",
            )

    def test_extracts_the_exact_fixture_start_and_fails_when_missing(self) -> None:
        html = f"""
        <div class="fixture-card">
          <div>Sat 01 Aug 2026</div><div>14:00</div>
          <a href="/hockeyballarat/games/team/26298/100">Home</a>
          <a href="/hockeyballarat/games/team/26298/200">Away</a>
          <a href="/hockeyballarat/game/12345">Details</a>
        </div>
        """

        details = self.preflight.extract_fixture_context(
            html,
            self.round_url,
            self.match_url,
        )

        self.assertEqual("2026-08-01", details["round_date"])
        self.assertEqual("14:00", details["round_time"])
        with self.assertRaises(RuntimeError):
            self.preflight.extract_fixture_context(
                html,
                self.round_url,
                f"{self.portal_url}/game/99999",
            )

    def test_moved_later_preserves_an_existing_exact_duration(self) -> None:
        current_start = datetime(2026, 8, 1, 2, 0, tzinfo=timezone.utc)
        exact_end = current_start + timedelta(minutes=70)
        fresh_start = current_start + timedelta(hours=2)

        decision = self.preflight.decide_preflight(
            current_start=current_start,
            current_exact_end=exact_end,
            fresh_start=fresh_start,
            duration_minutes=90,
            as_of=datetime(2026, 8, 1, 3, 22, tzinfo=timezone.utc),
        )

        self.assertTrue(decision.changed)
        self.assertFalse(decision.should_scrape)
        self.assertEqual(fresh_start + timedelta(minutes=70), decision.expected_finish)

    def test_division_duration_becomes_due_after_finish(self) -> None:
        start = datetime(2026, 8, 1, 2, 0, tzinfo=timezone.utc)

        decision = self.preflight.decide_preflight(
            current_start=start,
            current_exact_end=None,
            fresh_start=start,
            duration_minutes=70,
            as_of=datetime(2026, 8, 1, 3, 22, tzinfo=timezone.utc),
        )

        self.assertTrue(decision.should_scrape)
        self.assertEqual(start + timedelta(minutes=70), decision.expected_finish)


if __name__ == "__main__":
    unittest.main()
