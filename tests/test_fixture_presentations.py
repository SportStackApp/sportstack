from __future__ import annotations

import unittest
from pathlib import Path


ROOT = Path(__file__).parents[1]
GAMES = ROOT / "src" / "pages" / "Games.tsx"
DASHBOARD = ROOT / "src" / "pages" / "Dashboard.tsx"


class FixturePresentationTests(unittest.TestCase):
    def test_calendar_mode_has_a_real_month_grid(self) -> None:
        source = GAMES.read_text(encoding="utf-8")

        self.assertIn("<FixtureCalendarView", source)
        self.assertIn("games={games}", source)
        self.assertIn("month={calendarMonth}", source)
        self.assertIn('aria-label="Previous month"', source)
        self.assertIn('aria-label="Next month"', source)
        self.assertIn("Current month", source)
        self.assertIn('grid grid-cols-7', source)
        self.assertIn('month.toLocaleDateString("en-AU"', source)
        self.assertIn('border-slate-300 bg-slate-100', source)

    def test_fixture_and_dashboard_byes_hide_placeholder_details(self) -> None:
        games = GAMES.read_text(encoding="utf-8")
        dashboard = DASHBOARD.read_text(encoding="utf-8")

        for source in (games, dashboard):
            self.assertIn("— Bye", source)
            self.assertIn("const isBye = !", source)

        self.assertNotIn('{homeTeam} vs {awayTeam}', dashboard)
        self.assertNotIn('"Unknown"} vs {fixture.away_team?.name || "Unknown"', dashboard)


if __name__ == "__main__":
    unittest.main()
