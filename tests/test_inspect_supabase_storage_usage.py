"""Tests for the read-only Supabase Storage usage diagnostic."""

from __future__ import annotations

import importlib.util
import json
import unittest
from pathlib import Path
from unittest import mock

SCRIPT_PATH = Path(__file__).parents[1] / "scripts" / "inspect_supabase_storage_usage.py"
SPEC = importlib.util.spec_from_file_location("inspect_supabase_storage_usage", SCRIPT_PATH)
assert SPEC and SPEC.loader
storage_usage = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(storage_usage)


class SupabaseStorageUsageTests(unittest.TestCase):
    def test_accepts_only_the_exact_dev_project_host(self) -> None:
        self.assertEqual(
            "icqegnpjbizccjebjfhb",
            storage_usage.validate_dev_target(
                "https://icqegnpjbizccjebjfhb.supabase.co"
            ),
        )

    def test_rejects_the_production_project(self) -> None:
        with self.assertRaisesRegex(storage_usage.UnsafeTargetError, "Refusing non-Dev"):
            storage_usage.validate_dev_target(
                "https://svierarfcolhcfjpmwck.supabase.co"
            )

    def test_rejects_a_deceptive_host(self) -> None:
        with self.assertRaises(storage_usage.UnsafeTargetError):
            storage_usage.validate_dev_target(
                "https://icqegnpjbizccjebjfhb.supabase.co.example.com"
            )

    def test_summary_aggregates_sizes_without_object_paths(self) -> None:
        summary = storage_usage.summarise_objects(
            [
                {"top_level_prefix": "hockey-ballarat", "size": 10},
                {"top_level_prefix": "hockey-ballarat", "size": 25},
                {"top_level_prefix": "player-history", "size": 65},
            ]
        )

        self.assertEqual(3, summary["object_count"])
        self.assertEqual(100, summary["bytes"])
        self.assertEqual(
            [
                {"prefix": "player-history", "object_count": 1, "bytes": 65},
                {"prefix": "hockey-ballarat", "object_count": 2, "bytes": 35},
            ],
            summary["top_level_prefixes"],
        )
        self.assertNotIn("path", repr(summary).lower())

    def test_request_guard_rejects_storage_mutations(self) -> None:
        inspector = storage_usage.StorageApi(
            "https://icqegnpjbizccjebjfhb.supabase.co",
            "test-key",
        )

        for method, path in (
            ("DELETE", "/storage/v1/object/scrape-backups/example.json"),
            ("POST", "/storage/v1/object/scrape-backups/example.json"),
            ("PUT", "/storage/v1/bucket/scrape-backups"),
        ):
            with self.subTest(method=method, path=path):
                with self.assertRaisesRegex(
                    RuntimeError,
                    "Refusing non-list Storage API request",
                ):
                    inspector._request_json(method, path)

    def test_recursive_listing_paginates_without_leaking_object_names(self) -> None:
        inspector = storage_usage.StorageApi(
            "https://icqegnpjbizccjebjfhb.supabase.co",
            "test-key",
        )
        pages = {
            ("", 0): [
                {"name": "hockey-ballarat", "metadata": None},
                {"name": "private-root-a.json", "metadata": {"size": 5}},
            ],
            ("", 2): [
                {"name": "private-root-b.json", "metadata": {"size": "7"}},
            ],
            ("hockey-ballarat", 0): [
                {"name": "private-one.json", "metadata": {"size": 11}},
                {"name": "private-two.json", "metadata": {"size": 13}},
            ],
            ("hockey-ballarat", 2): [],
        }
        calls: list[tuple[str, int]] = []

        def fake_request(
            method: str,
            path: str,
            payload: dict[str, object] | None = None,
        ) -> object:
            self.assertEqual("POST", method)
            self.assertEqual(
                "/storage/v1/object/list/scrape-backups",
                path,
            )
            assert payload is not None
            self.assertEqual(2, payload["limit"])
            key = (str(payload["prefix"]), int(payload["offset"]))
            calls.append(key)
            return pages[key]

        with (
            mock.patch.object(storage_usage, "PAGE_SIZE", 2),
            mock.patch.object(inspector, "_request_json", side_effect=fake_request),
        ):
            records = list(inspector.iter_objects("scrape-backups"))

        self.assertEqual(
            [
                ("", 0),
                ("hockey-ballarat", 0),
                ("hockey-ballarat", 2),
                ("", 2),
            ],
            calls,
        )
        self.assertEqual(
            [
                {"top_level_prefix": "hockey-ballarat", "size": 11},
                {"top_level_prefix": "hockey-ballarat", "size": 13},
                {"top_level_prefix": "__root__", "size": 5},
                {"top_level_prefix": "__root__", "size": 7},
            ],
            records,
        )

        test_case = self

        class FakeReportInspector:
            def list_buckets(self) -> list[dict[str, str]]:
                return [{"id": "scrape-backups", "name": "scrape-backups"}]

            def iter_objects(self, bucket_id: str) -> object:
                test_case.assertEqual("scrape-backups", bucket_id)
                return iter(records)

        report_text = json.dumps(
            storage_usage.build_report(
                FakeReportInspector(),
                "icqegnpjbizccjebjfhb",
            ),
            sort_keys=True,
        )
        for object_name in (
            "private-root-a.json",
            "private-root-b.json",
            "private-one.json",
            "private-two.json",
        ):
            self.assertNotIn(object_name, report_text)


if __name__ == "__main__":
    unittest.main()
