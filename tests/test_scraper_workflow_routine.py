"""Safety checks for the consolidated scraper schedule."""

from __future__ import annotations

import unittest
from pathlib import Path

ROOT = Path(__file__).parents[1]
WORKFLOWS = ROOT / ".github" / "workflows"


class ScraperWorkflowRoutineTests(unittest.TestCase):
    def test_legacy_production_workflows_are_manual_only(self) -> None:
        for name in (
            "scrape-hb.yml",
            "scrape-sunraysia.yml",
            "scrape-wha.yml",
            "player-registry.yml",
            "player-history.yml",
        ):
            with self.subTest(workflow=name):
                text = (WORKFLOWS / name).read_text(encoding="utf-8")
                self.assertIn("workflow_dispatch:", text)
                self.assertNotIn("\n  schedule:\n", text)
                self.assertIn("production-scrapers.yml", text)

    def test_production_schedule_is_bounded_and_guarded(self) -> None:
        text = (WORKFLOWS / "production-scrapers.yml").read_text(encoding="utf-8")

        self.assertIn('cron: "0 18 * * *"', text)
        self.assertIn('cron: "0 8,12 * * 5"', text)
        self.assertIn('cron: "0 2,6,10 * * 6,0"', text)
        self.assertIn('cron: "0 19 * * 1,4"', text)
        self.assertIn('cron: "0 20 * * 1"', text)
        self.assertIn('cron: "0 21 * * 1"', text)
        self.assertNotIn("30 6  * * 5", text)
        self.assertIn("group: production-supabase-scrapers", text)
        self.assertIn("cancel-in-progress: false", text)
        self.assertIn("secrets.SUPABASE_URL", text)
        self.assertNotIn("secrets.DEV_SUPABASE_URL", text)
        self.assertIn("inputs.write_to_production", text)

    def test_friday_extra_refresh_selects_only_sunraysia(self) -> None:
        text = (WORKFLOWS / "production-scrapers.yml").read_text(encoding="utf-8")

        self.assertIn(
            "github.event.schedule != '0 8,12 * * 5' || matrix.task == 'sunraysia'",
            text,
        )

    def test_production_retention_apply_requires_every_guard(self) -> None:
        text = (WORKFLOWS / "production-scrapers.yml").read_text(encoding="utf-8")

        self.assertIn("--expected-project-ref svierarfcolhcfjpmwck", text)
        self.assertIn("--expected-delete-count", text)
        self.assertIn("--expected-delete-bytes", text)
        self.assertIn("--expected-plan-sha256", text)
        self.assertIn("--production-approval", text)
        self.assertIn("retention_production_approval", text)

    def test_only_daily_match_run_creates_automatic_backup(self) -> None:
        text = (WORKFLOWS / "production-scrapers.yml").read_text(encoding="utf-8")

        self.assertIn(
            "github.event.schedule == '0 18 * * *' && 'true'",
            text,
        )
        self.assertIn("inputs.upload_backup", text)


if __name__ == "__main__":
    unittest.main()
