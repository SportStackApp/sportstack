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

        self.assertIn('cron: "7,22,37,52 * * * *"', text)
        self.assertIn('cron: "30 14 * * 1-6"', text)
        self.assertIn('cron: "30 14 * * 0"', text)
        self.assertIn('cron: "0 19 * * 1"', text)
        self.assertIn('cron: "0 19 * * 4"', text)
        self.assertIn('cron: "0 20 * * 1"', text)
        self.assertIn('cron: "0 16 * * 0"', text)
        self.assertNotIn("30 6  * * 5", text)
        self.assertIn("group: production-supabase-scrapers", text)
        self.assertIn("cancel-in-progress: false", text)
        self.assertIn("secrets.SUPABASE_URL", text)
        self.assertNotIn("secrets.DEV_SUPABASE_URL", text)
        self.assertIn("inputs.write_to_production", text)

    def test_due_fixture_jobs_use_an_exact_dynamic_matrix(self) -> None:
        text = (WORKFLOWS / "production-scrapers.yml").read_text(encoding="utf-8")

        self.assertIn("python scripts/select_due_fixture_scrapes.py", text)
        self.assertIn("fromJson(needs.select-due-fixtures.outputs.matrix)", text)
        self.assertIn("python scripts/verify_due_fixture_schedule.py", text)
        self.assertIn("APPLY_SCHEDULE_UPDATE: \"true\"", text)
        self.assertIn("TARGET_ROUND_NUMBER: ${{ matrix.round_number }}", text)
        self.assertEqual(
            2,
            text.count("if: steps.preflight.outputs.should_scrape == 'true'"),
        )
        self.assertIn("TARGET_GAME_DATE: ${{ steps.preflight.outputs.game_date }}", text)
        self.assertIn("TARGET_MATCH_URL: ${{ matrix.match_url }}", text)
        self.assertIn('--match-url "${{ matrix.match_url }}"', text)
        self.assertNotIn("Upload compressed Production backup", text.split("targeted-match-scrapes:", 1)[1].split("match-scrapers:", 1)[0])

    def test_production_retention_apply_requires_every_guard(self) -> None:
        text = (WORKFLOWS / "production-scrapers.yml").read_text(encoding="utf-8")

        self.assertIn("--expected-project-ref svierarfcolhcfjpmwck", text)
        self.assertIn("--expected-delete-count", text)
        self.assertIn("--expected-delete-bytes", text)
        self.assertIn("--expected-plan-sha256", text)
        self.assertIn("--production-approval", text)
        self.assertIn("retention_production_approval", text)

    def test_only_weekly_full_match_run_creates_automatic_backup(self) -> None:
        text = (WORKFLOWS / "production-scrapers.yml").read_text(encoding="utf-8")

        self.assertIn(
            "github.event.schedule == '30 14 * * 0' && 'true'",
            text,
        )
        self.assertIn("inputs.upload_backup", text)

    def test_workflows_use_pinned_scraper_requirements(self) -> None:
        requirements = ROOT / "scraper"
        self.assertIn(
            "supabase==",
            (requirements / "requirements-supabase.txt").read_text(encoding="utf-8"),
        )
        for path in WORKFLOWS.glob("*.yml"):
            with self.subTest(workflow=path.name):
                text = path.read_text(encoding="utf-8")
                self.assertNotIn("pip install requests beautifulsoup4 supabase", text)
                self.assertNotIn("pip install playwright beautifulsoup4 supabase", text)

    def test_active_workflows_use_the_v2_fixture_importer(self) -> None:
        for name in ("dev-scrapers.yml", "production-scrapers.yml"):
            with self.subTest(workflow=name):
                text = (WORKFLOWS / name).read_text(encoding="utf-8")
                self.assertIn("python scripts/import_revsports_fixtures_v2.py", text)
                self.assertNotIn("python scraper/fixture_import.py --apply", text)

        dev_text = (WORKFLOWS / "dev-scrapers.yml").read_text(encoding="utf-8")
        self.assertIn("apply_fixture_import:", dev_text)
        self.assertIn("inputs.apply_fixture_import", dev_text)
        self.assertIn("inputs.task == 'fixture-import'", dev_text)
        self.assertIn("Preview or import all mapped V2 fixtures into Dev", dev_text)


if __name__ == "__main__":
    unittest.main()
