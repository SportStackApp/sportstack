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
    def test_keeps_current_one_two_four_week_and_monthly_snapshots(self) -> None:
        retention = load_retention_module()
        as_of = datetime(2026, 7, 29, 12, 0, tzinfo=timezone.utc)
        paths = [
            "hockey-ballarat/2026/07/29/080000/recent-first.json",
            "hockey-ballarat/2026/07/29/100000/recent-middle.json",
            "hockey-ballarat/2026/07/29/110000/recent-last.json",
            "hockey-ballarat/2026/07/22/080000/week-one-earlier.json",
            "hockey-ballarat/2026/07/22/110000/week-one.json",
            "hockey-ballarat/2026/07/15/110000/week-two.json",
            "hockey-ballarat/2026/07/08/110000/week-three-delete.json",
            "hockey-ballarat/2026/07/01/110000/week-four.json",
            "hockey-ballarat/2026/06/01/080000/june-earlier.json",
            "hockey-ballarat/2026/06/20/100000/june-latest.json",
            "hockey-ballarat/2026/05/01/080000/monthly-earlier.json",
            "hockey-ballarat/2026/05/20/100000/monthly-latest.json",
            "hockey-ballarat/2025/05/20/100000/expired.json",
        ]

        plan = retention.build_retention_plan(
            [{"path": path, "size": 1} for path in paths],
            as_of=as_of,
        )

        self.assertEqual(
            {
                "hockey-ballarat/2026/07/29/080000/recent-first.json",
                "hockey-ballarat/2026/07/29/100000/recent-middle.json",
                "hockey-ballarat/2026/07/22/080000/week-one-earlier.json",
                "hockey-ballarat/2026/07/08/110000/week-three-delete.json",
                "hockey-ballarat/2026/06/01/080000/june-earlier.json",
                "hockey-ballarat/2026/05/01/080000/monthly-earlier.json",
                "hockey-ballarat/2025/05/20/100000/expired.json",
            },
            set(plan["delete_paths"]),
        )
        self.assertEqual(set(paths) - set(plan["delete_paths"]), set(plan["keep_paths"]))

    def test_sources_are_retained_independently(self) -> None:
        retention = load_retention_module()
        as_of = datetime(2026, 7, 29, 12, 0, tzinfo=timezone.utc)
        paths = [
            "alpha/2026/07/29/080000/alpha-earlier.json",
            "alpha/2026/07/29/100000/alpha-middle.json",
            "alpha/2026/07/29/110000/alpha-latest.json",
            "alpha/2026/07/22/110000/alpha-week-one.json",
            "beta/2026/07/29/080000/beta-earlier.json",
            "beta/2026/07/29/100000/beta-middle.json",
            "beta/2026/07/29/110000/beta-latest.json",
            "beta/2026/07/22/110000/beta-week-one.json",
        ]

        plan = retention.build_retention_plan(
            [{"path": path, "size": 1} for path in paths],
            as_of=as_of,
        )

        self.assertEqual(
            {
                "alpha/2026/07/29/080000/alpha-earlier.json",
                "alpha/2026/07/29/100000/alpha-middle.json",
                "beta/2026/07/29/080000/beta-earlier.json",
                "beta/2026/07/29/100000/beta-middle.json",
            },
            set(plan["delete_paths"]),
        )

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

    def test_future_dated_run_is_retained_for_manual_review(self) -> None:
        retention = load_retention_module()
        as_of = datetime(2026, 7, 29, 12, 0, tzinfo=timezone.utc)
        future_path = "alpha/2026/07/30/080000/future.json"

        plan = retention.build_retention_plan(
            [{"path": future_path, "size": 100}],
            as_of=as_of,
        )

        self.assertEqual([future_path], plan["keep_paths"])
        self.assertEqual([], plan["delete_paths"])

    def test_dry_run_report_is_aggregate_and_omits_object_paths(self) -> None:
        retention = load_retention_module()
        as_of = datetime(2026, 7, 29, 12, 0, tzinfo=timezone.utc)
        records = [
            {
                "path": "sunraysia/2026/07/29/100000/private-recent.json",
                "size": 10,
            },
            {
                "path": "sunraysia/2026/05/01/100000/private-delete.json",
                "size": 20,
            },
            {
                "path": "sunraysia/2026/05/20/100000/private-keep.json",
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

    def test_backup_inventory_fails_closed_on_malformed_entry(self) -> None:
        retention = load_retention_module()

        for malformed_name in ("", "/late.json", "late.json/", "nested/late.json"):
            with self.subTest(name=malformed_name):

                class FakeStorageClient:
                    def _request_json(self, method, path, payload=None):
                        return [
                            {
                                "id": "object-1",
                                "name": malformed_name,
                                "metadata": {"size": 1},
                            }
                        ]

                with self.assertRaisesRegex(RuntimeError, "malformed"):
                    list(retention.iter_backup_objects(FakeStorageClient()))

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

    def test_dry_run_fails_closed_on_duplicate_object_path(self) -> None:
        retention = load_retention_module()
        duplicate = {
            "path": "sunraysia/2026/06/30/100000/backup.json",
            "size": 20,
        }

        with mock.patch.object(
            retention,
            "iter_backup_objects",
            return_value=iter([duplicate, duplicate]),
        ):
            with self.assertRaisesRegex(RuntimeError, "duplicate"):
                retention.run_dry_run(
                    object(),
                    project_ref="icqegnpjbizccjebjfhb",
                    as_of=datetime(2026, 7, 29, 12, 0, tzinfo=timezone.utc),
                )

    def test_apply_count_mismatch_aborts_before_delete(self) -> None:
        retention = load_retention_module()
        as_of = datetime(2026, 7, 29, 12, 0, tzinfo=timezone.utc)
        records = [
            {
                "path": "sunraysia/2026/05/01/100000/delete.json",
                "size": 20,
            },
            {
                "path": "sunraysia/2026/05/20/100000/keep.json",
                "size": 30,
            },
        ]

        class FakeDeleteClient:
            def __init__(self) -> None:
                self.delete_calls: list[list[str]] = []

            def delete_objects(self, paths: list[str]) -> None:
                self.delete_calls.append(paths)

        client = FakeDeleteClient()
        with mock.patch.object(
            retention,
            "iter_backup_objects",
            return_value=iter(records),
        ):
            with self.assertRaisesRegex(RuntimeError, "object count"):
                retention.run_apply(
                    client,
                    project_ref="icqegnpjbizccjebjfhb",
                    as_of=as_of,
                    expected_delete_count=2,
                    expected_delete_bytes=20,
                    expected_plan_sha256="0" * 64,
                )

        self.assertEqual([], client.delete_calls)

    def test_apply_byte_and_digest_mismatches_abort_before_delete(self) -> None:
        retention = load_retention_module()
        as_of = datetime(2026, 7, 29, 12, 0, tzinfo=timezone.utc)
        records = [
            {"path": "sunraysia/2026/05/01/100000/delete.json", "size": 20},
            {"path": "sunraysia/2026/05/20/100000/keep.json", "size": 30},
        ]
        plan = retention.build_retention_plan(records, as_of=as_of)
        approved = retention.build_public_report(records, plan, as_of=as_of)

        cases = [
            (
                "bytes",
                21,
                approved["plan_sha256"],
                "byte count",
            ),
            (
                "digest",
                20,
                "0" * 64,
                "SHA-256",
            ),
        ]
        for label, expected_bytes, expected_digest, error_pattern in cases:
            with self.subTest(label=label):
                client = mock.Mock()
                with mock.patch.object(
                    retention,
                    "iter_backup_objects",
                    return_value=iter(records),
                ):
                    with self.assertRaisesRegex(RuntimeError, error_pattern):
                        retention.run_apply(
                            client,
                            project_ref="icqegnpjbizccjebjfhb",
                            as_of=as_of,
                            expected_delete_count=1,
                            expected_delete_bytes=expected_bytes,
                            expected_plan_sha256=expected_digest,
                        )
                client.delete_objects.assert_not_called()

    def test_apply_verifies_deleted_and_retained_objects(self) -> None:
        retention = load_retention_module()
        as_of = datetime(2026, 7, 29, 12, 0, tzinfo=timezone.utc)
        delete_path = "sunraysia/2026/05/01/100000/delete.json"
        keep_path = "sunraysia/2026/05/20/100000/keep.json"
        before = [
            {"path": delete_path, "size": 20},
            {"path": keep_path, "size": 30},
        ]
        after = [{"path": keep_path, "size": 30}]
        plan = retention.build_retention_plan(before, as_of=as_of)
        approved = retention.build_public_report(before, plan, as_of=as_of)

        class FakeDeleteClient:
            def __init__(self) -> None:
                self.delete_calls: list[list[str]] = []

            def delete_objects(self, paths: list[str]) -> None:
                self.delete_calls.append(paths)

        client = FakeDeleteClient()
        with mock.patch.object(
            retention,
            "iter_backup_objects",
            side_effect=[iter(before), iter(after)],
        ):
            report = retention.run_apply(
                client,
                project_ref="icqegnpjbizccjebjfhb",
                as_of=as_of,
                expected_delete_count=1,
                expected_delete_bytes=20,
                expected_plan_sha256=approved["plan_sha256"],
            )

        self.assertEqual([[delete_path]], client.delete_calls)
        self.assertEqual(
            {
                "objects": 1,
                "bytes": 30,
                "approved_deletion_objects_remaining": 0,
                "approved_keep_objects_missing": 0,
            },
            report["post_delete_verification"],
        )
        report_text = json.dumps(report, sort_keys=True)
        self.assertNotIn(delete_path, report_text)
        self.assertNotIn(keep_path, report_text)

    def test_apply_fails_if_a_deletion_candidate_remains(self) -> None:
        retention = load_retention_module()
        as_of = datetime(2026, 7, 29, 12, 0, tzinfo=timezone.utc)
        before = [
            {"path": "sunraysia/2026/05/01/100000/delete.json", "size": 20},
            {"path": "sunraysia/2026/05/20/100000/keep.json", "size": 30},
        ]
        plan = retention.build_retention_plan(before, as_of=as_of)
        approved = retention.build_public_report(before, plan, as_of=as_of)
        client = mock.Mock()

        with mock.patch.object(
            retention,
            "iter_backup_objects",
            side_effect=[iter(before), iter(before)],
        ):
            with self.assertRaisesRegex(RuntimeError, "post-delete verification"):
                retention.run_apply(
                    client,
                    project_ref="icqegnpjbizccjebjfhb",
                    as_of=as_of,
                    expected_delete_count=1,
                    expected_delete_bytes=20,
                    expected_plan_sha256=approved["plan_sha256"],
                )
        client.delete_objects.assert_called_once()

    def test_apply_fails_if_an_approved_retained_object_is_missing(self) -> None:
        retention = load_retention_module()
        as_of = datetime(2026, 7, 29, 12, 0, tzinfo=timezone.utc)
        before = [
            {"path": "sunraysia/2026/05/01/100000/delete.json", "size": 20},
            {"path": "sunraysia/2026/05/20/100000/keep.json", "size": 30},
        ]
        plan = retention.build_retention_plan(before, as_of=as_of)
        approved = retention.build_public_report(before, plan, as_of=as_of)
        client = mock.Mock()

        with mock.patch.object(
            retention,
            "iter_backup_objects",
            side_effect=[iter(before), iter([])],
        ):
            with self.assertRaisesRegex(RuntimeError, "retained objects are missing"):
                retention.run_apply(
                    client,
                    project_ref="icqegnpjbizccjebjfhb",
                    as_of=as_of,
                    expected_delete_count=1,
                    expected_delete_bytes=20,
                    expected_plan_sha256=approved["plan_sha256"],
                )
        client.delete_objects.assert_called_once()

    def test_apply_verifies_after_uncertain_delete_outcome(self) -> None:
        retention = load_retention_module()
        as_of = datetime(2026, 7, 29, 12, 0, tzinfo=timezone.utc)
        delete_path = "sunraysia/2026/05/01/100000/delete.json"
        keep_path = "sunraysia/2026/05/20/100000/keep.json"
        before = [
            {"path": delete_path, "size": 20},
            {"path": keep_path, "size": 30},
        ]
        after = [{"path": keep_path, "size": 30}]
        plan = retention.build_retention_plan(before, as_of=as_of)
        approved = retention.build_public_report(before, plan, as_of=as_of)
        client = mock.Mock()
        client.delete_objects.side_effect = TimeoutError("simulated uncertain outcome")

        with mock.patch.object(
            retention,
            "iter_backup_objects",
            side_effect=[iter(before), iter(after)],
        ) as inventory:
            report = retention.run_apply(
                client,
                project_ref="icqegnpjbizccjebjfhb",
                as_of=as_of,
                expected_delete_count=1,
                expected_delete_bytes=20,
                expected_plan_sha256=approved["plan_sha256"],
            )

        self.assertEqual(2, inventory.call_count)
        self.assertEqual("verified-after-uncertain-request", report["apply_outcome"])
        self.assertEqual(0, report["post_delete_verification"]["approved_deletion_objects_remaining"])
        self.assertEqual(0, report["post_delete_verification"]["approved_keep_objects_missing"])

    def test_apply_reports_unknown_when_uncertain_delete_cannot_be_verified(self) -> None:
        retention = load_retention_module()
        as_of = datetime(2026, 7, 29, 12, 0, tzinfo=timezone.utc)
        before = [
            {"path": "sunraysia/2026/05/01/100000/delete.json", "size": 20},
            {"path": "sunraysia/2026/05/20/100000/keep.json", "size": 30},
        ]
        plan = retention.build_retention_plan(before, as_of=as_of)
        approved = retention.build_public_report(before, plan, as_of=as_of)
        client = mock.Mock()
        client.delete_objects.side_effect = TimeoutError("simulated uncertain outcome")

        with mock.patch.object(
            retention,
            "iter_backup_objects",
            side_effect=[iter(before), RuntimeError("simulated verification failure")],
        ) as inventory:
            with self.assertRaisesRegex(RuntimeError, "outcome is unknown"):
                retention.run_apply(
                    client,
                    project_ref="icqegnpjbizccjebjfhb",
                    as_of=as_of,
                    expected_delete_count=1,
                    expected_delete_bytes=20,
                    expected_plan_sha256=approved["plan_sha256"],
                )

        self.assertEqual(2, inventory.call_count)
        client.delete_objects.assert_called_once()

    def test_apply_reports_unknown_when_successful_delete_cannot_be_verified(self) -> None:
        retention = load_retention_module()
        as_of = datetime(2026, 7, 29, 12, 0, tzinfo=timezone.utc)
        before = [
            {"path": "sunraysia/2026/05/01/100000/delete.json", "size": 20},
            {"path": "sunraysia/2026/05/20/100000/keep.json", "size": 30},
        ]
        plan = retention.build_retention_plan(before, as_of=as_of)
        approved = retention.build_public_report(before, plan, as_of=as_of)
        client = mock.Mock()

        with mock.patch.object(
            retention,
            "iter_backup_objects",
            side_effect=[iter(before), RuntimeError("simulated post-list failure")],
        ):
            with self.assertRaisesRegex(RuntimeError, "outcome is unknown"):
                retention.run_apply(
                    client,
                    project_ref="icqegnpjbizccjebjfhb",
                    as_of=as_of,
                    expected_delete_count=1,
                    expected_delete_bytes=20,
                    expected_plan_sha256=approved["plan_sha256"],
                )
        client.delete_objects.assert_called_once()

    def test_apply_reports_unknown_for_invalid_post_delete_inventory(self) -> None:
        retention = load_retention_module()
        as_of = datetime(2026, 7, 29, 12, 0, tzinfo=timezone.utc)
        delete_record = {
            "path": "sunraysia/2026/05/01/100000/delete.json",
            "size": 20,
        }
        keep_record = {
            "path": "sunraysia/2026/05/20/100000/keep.json",
            "size": 30,
        }
        before = [delete_record, keep_record]
        plan = retention.build_retention_plan(before, as_of=as_of)
        approved = retention.build_public_report(before, plan, as_of=as_of)
        client = mock.Mock()
        client.delete_objects.side_effect = TimeoutError("simulated uncertain outcome")

        with mock.patch.object(
            retention,
            "iter_backup_objects",
            side_effect=[iter(before), iter([keep_record, keep_record])],
        ):
            with self.assertRaisesRegex(RuntimeError, "outcome is unknown"):
                retention.run_apply(
                    client,
                    project_ref="icqegnpjbizccjebjfhb",
                    as_of=as_of,
                    expected_delete_count=1,
                    expected_delete_bytes=20,
                    expected_plan_sha256=approved["plan_sha256"],
                )
        client.delete_objects.assert_called_once()

    def test_delete_adapter_uses_exact_fixed_bucket_endpoint(self) -> None:
        retention = load_retention_module()
        path = "sunraysia/2026/06/30/100000/backup.json"

        class FakeResponse:
            def __enter__(self):
                return self

            def __exit__(self, *_args):
                return False

            def read(self) -> bytes:
                return b"[]"

        class FakeOpener:
            def __init__(self) -> None:
                self.requests = []

            def open(self, request, timeout: int):
                self.requests.append((request, timeout))
                return FakeResponse()

        class FakeReader:
            base_url = "https://icqegnpjbizccjebjfhb.supabase.co"
            service_key = "fake-test-key"

            def __init__(self) -> None:
                self.opener = FakeOpener()

            def _request_json(self, method, path, payload=None):
                raise AssertionError("listing was not expected")

        reader = FakeReader()
        client = retention.RetentionStorageApi(
            reader,
            retention.EXPECTED_DEV_PROJECT_REF,
        )
        client.delete_objects([path])

        self.assertEqual(1, len(reader.opener.requests))
        request, timeout = reader.opener.requests[0]
        self.assertEqual(60, timeout)
        self.assertEqual("DELETE", request.get_method())
        self.assertEqual(
            "https://icqegnpjbizccjebjfhb.supabase.co/storage/v1/object/scrape-backups",
            request.full_url,
        )
        self.assertEqual({"prefixes": [path]}, json.loads(request.data))

    def test_apply_cli_requires_every_expected_guard(self) -> None:
        retention = load_retention_module()

        with self.assertRaises(SystemExit):
            retention.parse_args(["--apply"])

    def test_production_apply_requires_exact_approval_phrase(self) -> None:
        retention = load_retention_module()
        base_args = [
            "--expected-project-ref",
            retention.EXPECTED_PRODUCTION_PROJECT_REF,
            "--apply",
            "--expected-delete-count",
            "1",
            "--expected-delete-bytes",
            "1",
            "--expected-plan-sha256",
            "0" * 64,
        ]

        with self.assertRaises(SystemExit):
            retention.parse_args(base_args)

        parsed = retention.parse_args(
            base_args
            + [
                "--production-approval",
                retention.PRODUCTION_APPROVAL_PHRASE,
            ]
        )
        self.assertEqual(
            retention.EXPECTED_PRODUCTION_PROJECT_REF,
            parsed.expected_project_ref,
        )

    def test_production_run_apply_checks_phrase_before_inventory(self) -> None:
        retention = load_retention_module()

        with mock.patch.object(retention, "iter_backup_objects") as inventory:
            with self.assertRaisesRegex(RuntimeError, "approval phrase"):
                retention.run_apply(
                    object(),
                    project_ref=retention.EXPECTED_PRODUCTION_PROJECT_REF,
                    as_of=datetime(2026, 7, 29, 12, 0, tzinfo=timezone.utc),
                    expected_delete_count=1,
                    expected_delete_bytes=1,
                    expected_plan_sha256="0" * 64,
                )

        inventory.assert_not_called()


class RetentionWorkflowSafetyTests(unittest.TestCase):
    def test_workflow_guards_manual_dev_retention_apply(self) -> None:
        workflow = WORKFLOW_PATH.read_text(encoding="utf-8")

        self.assertIn("- storage-retention-dry-run", workflow)
        self.assertIn("inputs.task == 'storage-retention-dry-run'", workflow)
        self.assertIn("python scripts/retain_scrape_backups.py", workflow)
        self.assertIn("--expected-project-ref icqegnpjbizccjebjfhb", workflow)
        self.assertIn("SUPABASE_URL: ${{ secrets.DEV_SUPABASE_URL }}", workflow)
        self.assertIn(
            "SUPABASE_SERVICE_KEY: ${{ secrets.DEV_SUPABASE_SERVICE_KEY }}",
            workflow,
        )
        self.assertIn("- storage-retention-apply", workflow)
        self.assertIn("inputs.task == 'storage-retention-apply'", workflow)
        self.assertIn("retain_scrape_backups.py --apply", workflow)
        self.assertIn("--expected-delete-count", workflow)
        self.assertIn("--expected-delete-bytes", workflow)
        self.assertIn("--expected-plan-sha256", workflow)
        self.assertIn("group: dev-supabase-scrapers", workflow)
        self.assertIn("cancel-in-progress: false", workflow)


if __name__ == "__main__":
    unittest.main()
