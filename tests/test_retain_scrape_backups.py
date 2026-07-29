"""Tests for tiered scrape-backup retention."""

from __future__ import annotations

import importlib.util
import json
import unittest
from datetime import datetime, timezone
from pathlib import Path
from unittest import mock

SCRIPT_PATH = Path(__file__).parents[1] / "scripts" / "retain_scrape_backups.py"
WORKFLOW_PATH = Path(__file__).parents[1] / ".github" / "workflows" / "dev-scrapers.yml"


def load_retention_module():
    if not SCRIPT_PATH.exists():
        raise AssertionError("retention script must exist")
    spec = importlib.util.spec_from_file_location("retain_scrape_backups", SCRIPT_PATH)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class ScrapeBackupRetentionTests(unittest.TestCase):
    def test_keeps_recent_weekly_and_monthly_run_tiers(self) -> None:
        retention = load_retention_module()
        as_of = datetime(2026, 7, 29, 12, 0, tzinfo=timezone.utc)
        paths = [
            "hockey-ballarat/2026/07/29/100000/recent-a.json",
            "hockey-ballarat/2026/07/23/100000/recent-b.json",
            "hockey-ballarat/2026/07/21/100000/week-one-later.json",
            "hockey-ballarat/2026/07/16/100000/week-one-earliest.json",
            "hockey-ballarat/2026/07/13/100000/week-two-later.json",
            "hockey-ballarat/2026/07/09/100000/week-two-earliest.json",
            "hockey-ballarat/2026/06/30/100000/month-later.json",
            "hockey-ballarat/2026/06/01/100000/month-earliest.json",
            "hockey-ballarat/2026/05/20/100000/older-month.json",
        ]

        plan = retention.build_retention_plan(
            [{"path": path, "size": 1} for path in paths],
            as_of=as_of,
        )

        self.assertEqual(
            {
                "hockey-ballarat/2026/07/21/100000/week-one-later.json",
                "hockey-ballarat/2026/07/13/100000/week-two-later.json",
                "hockey-ballarat/2026/06/30/100000/month-later.json",
            },
            set(plan["delete_paths"]),
        )
        self.assertEqual(set(paths) - set(plan["delete_paths"]), set(plan["keep_paths"]))

    def test_keeps_noncanonical_timestamp_paths_as_unparseable(self) -> None:
        retention = load_retention_module()
        as_of = datetime(2026, 7, 29, 12, 0, tzinfo=timezone.utc)
        malformed_path = "sunraysia/2026/6/30/1000/backup.json"
        records = [
            {"path": malformed_path, "size": 10},
            {
                "path": "sunraysia/2026/06/01/100000/backup.json",
                "size": 20,
            },
        ]

        plan = retention.build_retention_plan(records, as_of=as_of)

        self.assertIn(malformed_path, plan["keep_paths"])
        self.assertNotIn(malformed_path, plan["delete_paths"])

    def test_dry_run_report_is_aggregate_and_omits_object_paths(self) -> None:
        retention = load_retention_module()
        as_of = datetime(2026, 7, 29, 12, 0, tzinfo=timezone.utc)
        records = [
            {
                "path": "sunraysia/2026/07/29/100000/private-recent.json",
                "size": 10,
            },
            {
                "path": "sunraysia/2026/06/30/100000/private-delete.json",
                "size": 20,
            },
            {
                "path": "sunraysia/2026/06/01/100000/private-keep.json",
                "size": 30,
            },
            {"path": "unexpected-private-object.json", "size": 40},
        ]
        plan = retention.build_retention_plan(records, as_of=as_of)

        report = retention.build_public_report(records, plan, as_of=as_of)
        report_text = json.dumps(report, sort_keys=True)

        self.assertEqual("dry-run", report["mode"])
        self.assertEqual(
            {"total": 4, "keep": 3, "delete": 1},
            report["objects"],
        )
        self.assertEqual(
            {"total": 100, "keep": 80, "delete": 20},
            report["bytes"],
        )
        self.assertEqual(1, report["unparseable_objects_kept"])
        self.assertRegex(report["plan_sha256"], r"^[0-9a-f]{64}$")
        self.assertEqual(
            [
                {
                    "source": "sunraysia",
                    "objects": {"total": 3, "keep": 2, "delete": 1},
                    "bytes": {"total": 60, "keep": 40, "delete": 20},
                    "runs": {"total": 3, "keep": 2, "delete": 1},
                }
            ],
            report["sources"],
        )
        for record in records:
            self.assertNotIn(record["path"], report_text)

    def test_plan_digest_distinguishes_newline_containing_paths(self) -> None:
        retention = load_retention_module()
        as_of = datetime(2026, 7, 29, 12, 0, tzinfo=timezone.utc)
        first_records = [
            {"path": "a\nb", "size": 1},
            {"path": "c", "size": 1},
        ]
        second_records = [
            {"path": "a", "size": 1},
            {"path": "b\nc", "size": 1},
        ]

        first_report = retention.build_public_report(
            first_records,
            {"keep_paths": [], "delete_paths": ["a\nb", "c"]},
            as_of=as_of,
        )
        second_report = retention.build_public_report(
            second_records,
            {"keep_paths": [], "delete_paths": ["a", "b\nc"]},
            as_of=as_of,
        )

        self.assertNotEqual(
            first_report["plan_sha256"],
            second_report["plan_sha256"],
        )

    def test_backup_inventory_reconstructs_nested_paths_and_paginates(self) -> None:
        retention = load_retention_module()
        pages = {
            ("", 0): [{"id": None, "name": "wimmera", "metadata": None}],
            ("", 1): [],
            ("wimmera", 0): [{"id": None, "name": "2026", "metadata": None}],
            ("wimmera", 1): [],
            ("wimmera/2026", 0): [
                {
                    "id": "one",
                    "name": "first.json",
                    "metadata": {"size": 11},
                }
            ],
            ("wimmera/2026", 1): [
                {
                    "id": "two",
                    "name": "second.json",
                    "metadata": {"size": "13"},
                }
            ],
            ("wimmera/2026", 2): [],
        }
        calls: list[tuple[str, int]] = []

        class FakeClient:
            def _request_json(
                self,
                method: str,
                path: str,
                payload: dict[str, object] | None = None,
            ) -> object:
                self_test.assertEqual("POST", method)
                self_test.assertEqual(
                    "/storage/v1/object/list/scrape-backups",
                    path,
                )
                assert payload is not None
                key = (str(payload["prefix"]), int(payload["offset"]))
                calls.append(key)
                return pages[key]

        self_test = self
        with mock.patch.object(retention, "PAGE_SIZE", 1):
            records = list(retention.iter_backup_objects(FakeClient()))

        self.assertEqual(
            [
                ("", 0),
                ("wimmera", 0),
                ("wimmera/2026", 0),
                ("wimmera/2026", 1),
                ("wimmera/2026", 2),
                ("wimmera", 1),
                ("", 1),
            ],
            calls,
        )
        self.assertEqual(
            [
                {"path": "wimmera/2026/first.json", "size": 11},
                {"path": "wimmera/2026/second.json", "size": 13},
            ],
            records,
        )

    def test_run_dry_run_identifies_dev_project_and_fixed_bucket(self) -> None:
        retention = load_retention_module()
        as_of = datetime(2026, 7, 29, 12, 0, tzinfo=timezone.utc)
        records = [
            {
                "path": "player-history/2026/07/29/100000/history.json",
                "size": 5,
            }
        ]

        with mock.patch.object(
            retention,
            "iter_backup_objects",
            return_value=iter(records),
        ):
            report = retention.run_dry_run(
                object(),
                project_ref="icqegnpjbizccjebjfhb",
                as_of=as_of,
            )

        self.assertEqual("icqegnpjbizccjebjfhb", report["project_ref"])
        self.assertEqual("scrape-backups", report["bucket"])
        self.assertEqual("dry-run", report["mode"])


class RetentionWorkflowSafetyTests(unittest.TestCase):
    def test_workflow_exposes_only_a_manual_dev_retention_dry_run(self) -> None:
        workflow = WORKFLOW_PATH.read_text(encoding="utf-8")

        self.assertIn("- storage-retention-dry-run", workflow)
        self.assertIn("inputs.task == 'storage-retention-dry-run'", workflow)
        self.assertIn("python scripts/retain_scrape_backups.py", workflow)
        self.assertIn("SUPABASE_URL: ${{ secrets.DEV_SUPABASE_URL }}", workflow)
        self.assertIn(
            "SUPABASE_SERVICE_KEY: ${{ secrets.DEV_SUPABASE_SERVICE_KEY }}",
            workflow,
        )
        self.assertNotIn("retain_scrape_backups.py --apply", workflow)


if __name__ == "__main__":
    unittest.main()
