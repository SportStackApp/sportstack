"""Plan or apply guarded retention for known SportStack scraper backups.

Backups are grouped by upload-run prefixes of the form
``source/YYYY/MM/DD/HHMMSS``. Dry-run planning is read-only; apply requires
exact approved aggregate guards and verifies the resulting Storage inventory.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
from collections import defaultdict
from collections.abc import Iterable, Iterator
from datetime import datetime, timedelta, timezone
from typing import Any
from urllib.error import HTTPError
from urllib.parse import quote
from urllib.request import Request

RECENT_WINDOW = timedelta(days=3)
DAILY_ARCHIVE_END = timedelta(days=14)
WEEKLY_ARCHIVE_END = timedelta(days=60)
MONTHLY_ARCHIVE_END = timedelta(days=365)
BACKUP_BUCKET = "scrape-backups"
PAGE_SIZE = 1000
EXPECTED_DEV_PROJECT_REF = "icqegnpjbizccjebjfhb"
EXPECTED_PRODUCTION_PROJECT_REF = "svierarfcolhcfjpmwck"
ALLOWED_PROJECT_REFS = {
    EXPECTED_DEV_PROJECT_REF,
    EXPECTED_PRODUCTION_PROJECT_REF,
}
PRODUCTION_APPROVAL_PHRASE = "DELETE PRODUCTION SCRAPE BACKUPS"


class RetentionStorageApi:
    """Known-project adapter that adds one guarded bulk-delete operation."""

    def __init__(self, reader: Any, expected_project_ref: str) -> None:
        if expected_project_ref not in ALLOWED_PROJECT_REFS:
            raise RuntimeError("Refusing unknown retention project reference")
        expected_base_url = f"https://{expected_project_ref}.supabase.co"
        if reader.base_url != expected_base_url:
            raise RuntimeError("Refusing retention client with an unexpected base URL")
        self.reader = reader

    def _request_json(
        self,
        method: str,
        path: str,
        payload: dict[str, Any] | None = None,
    ) -> Any:
        return self.reader._request_json(method, path, payload)

    def delete_objects(self, paths: list[str]) -> None:
        if not paths:
            raise RuntimeError("Refusing an empty retention deletion request")
        if len(paths) != len(set(paths)):
            raise RuntimeError("Refusing duplicate retention deletion paths")
        if any(_parse_run(path) is None for path in paths):
            raise RuntimeError("Refusing non-canonical retention deletion paths")

        body = json.dumps({"prefixes": paths}, separators=(",", ":")).encode("utf-8")
        request = Request(
            f"{self.reader.base_url}/storage/v1/object/{BACKUP_BUCKET}",
            data=body,
            method="DELETE",
            headers={
                "Authorization": f"Bearer {self.reader.service_key}",
                "apikey": self.reader.service_key,
                "Content-Type": "application/json",
            },
        )
        try:
            with self.reader.opener.open(request, timeout=60) as response:
                response.read()
        except HTTPError as error:
            raise RuntimeError(
                f"Storage API returned HTTP {error.code} for guarded retention deletion"
            ) from error


def iter_backup_objects(
    client: Any,
    *,
    bucket_id: str = BACKUP_BUCKET,
) -> Iterator[dict[str, Any]]:
    """Yield full object paths via the hardened client's list-only request API."""

    if bucket_id != BACKUP_BUCKET:
        raise RuntimeError(f"Refusing retention inventory for bucket: {bucket_id}")
    encoded_bucket = quote(bucket_id, safe="")

    def iter_folder(prefix: str) -> Iterator[dict[str, Any]]:
        offset = 0
        while True:
            result = client._request_json(
                "POST",
                f"/storage/v1/object/list/{encoded_bucket}",
                {
                    "prefix": prefix,
                    "limit": PAGE_SIZE,
                    "offset": offset,
                    "sortBy": {"column": "name", "order": "asc"},
                },
            )
            if not isinstance(result, list):
                raise RuntimeError("Unexpected response from Storage object list")
            for entry in result:
                if not isinstance(entry, dict):
                    raise RuntimeError("Storage listing contains a malformed entry")
                raw_name = entry.get("name")
                if not isinstance(raw_name, str):
                    raise RuntimeError("Storage listing contains a malformed object name")
                if not raw_name or "/" in raw_name:
                    raise RuntimeError("Storage listing contains a malformed object name")
                name = raw_name
                path = name if not prefix else f"{prefix}/{name}"
                if entry.get("id") is None:
                    yield from iter_folder(path)
                    continue
                metadata = entry.get("metadata")
                yield {
                    "path": path,
                    "size": _safe_size(metadata) if isinstance(metadata, dict) else 0,
                }
            if len(result) < PAGE_SIZE:
                break
            offset += len(result)

    yield from iter_folder("")


def _parse_run(path: str) -> tuple[str, datetime, str] | None:
    parts = path.split("/")
    if (
        len(parts) < 6
        or not parts[0]
        or path.startswith("/")
        or any(part in ("", ".", "..") for part in parts)
    ):
        return None
    timestamp_parts = parts[1:5]
    if tuple(map(len, timestamp_parts)) != (4, 2, 2, 6) or any(
        any(character not in "0123456789" for character in part)
        for part in timestamp_parts
    ):
        return None
    try:
        run_at = datetime.strptime("/".join(timestamp_parts), "%Y/%m/%d/%H%M%S").replace(
            tzinfo=timezone.utc
        )
    except ValueError:
        return None
    return parts[0], run_at, "/".join(parts[:5])


def build_retention_plan(
    records: Iterable[dict[str, Any]],
    *,
    as_of: datetime,
) -> dict[str, list[str]]:
    """Return object paths to keep and delete under the tiered policy."""

    if as_of.tzinfo is None or as_of.utcoffset() is None:
        raise ValueError("as_of must be timezone-aware")
    as_of = as_of.astimezone(timezone.utc)

    run_objects: dict[str, list[str]] = defaultdict(list)
    run_metadata: dict[str, tuple[str, datetime]] = {}
    unparseable_paths: list[str] = []

    for record in records:
        path = str(record.get("path") or "")
        parsed = _parse_run(path)
        if parsed is None:
            unparseable_paths.append(path)
            continue
        source, run_at, run_prefix = parsed
        run_objects[run_prefix].append(path)
        run_metadata[run_prefix] = (source, run_at)

    keep_runs: set[str] = set()
    recent_candidates: dict[tuple[str, object], list[str]] = defaultdict(list)
    daily_candidates: dict[tuple[str, object], list[str]] = defaultdict(list)
    weekly_candidates: dict[tuple[str, int, int], list[str]] = defaultdict(list)
    monthly_candidates: dict[tuple[str, int, int], list[str]] = defaultdict(list)

    for run_prefix, (source, run_at) in run_metadata.items():
        age = as_of - run_at
        if age <= RECENT_WINDOW:
            recent_candidates[(source, run_at.date())].append(run_prefix)
        elif age <= DAILY_ARCHIVE_END:
            daily_candidates[(source, run_at.date())].append(run_prefix)
        elif age <= WEEKLY_ARCHIVE_END:
            iso_year, iso_week, _ = run_at.isocalendar()
            weekly_candidates[(source, iso_year, iso_week)].append(run_prefix)
        elif age <= MONTHLY_ARCHIVE_END:
            monthly_candidates[(source, run_at.year, run_at.month)].append(run_prefix)

    for candidates in recent_candidates.values():
        ordered = sorted(candidates, key=lambda prefix: run_metadata[prefix][1])
        keep_runs.add(ordered[0])
        keep_runs.add(ordered[-1])
    for candidates in (
        *daily_candidates.values(),
        *weekly_candidates.values(),
        *monthly_candidates.values(),
    ):
        keep_runs.add(max(candidates, key=lambda prefix: run_metadata[prefix][1]))

    keep_paths = list(unparseable_paths)
    delete_paths: list[str] = []
    for run_prefix, paths in run_objects.items():
        target = keep_paths if run_prefix in keep_runs else delete_paths
        target.extend(paths)

    return {
        "keep_paths": sorted(keep_paths),
        "delete_paths": sorted(delete_paths),
    }


def _safe_size(record: dict[str, Any]) -> int:
    try:
        return max(0, int(record.get("size") or 0))
    except (TypeError, ValueError):
        return 0


def build_public_report(
    records: Iterable[dict[str, Any]],
    plan: dict[str, list[str]],
    *,
    as_of: datetime,
) -> dict[str, Any]:
    """Build a path-free dry-run report suitable for CI logs."""

    records = list(records)
    keep_paths = set(plan["keep_paths"])
    delete_paths = set(plan["delete_paths"])
    keep_bytes = 0
    delete_bytes = 0
    all_runs: set[str] = set()
    keep_runs: set[str] = set()
    delete_runs: set[str] = set()
    source_stats: dict[str, dict[str, Any]] = {}
    unparseable_objects_kept = 0

    for record in records:
        path = str(record.get("path") or "")
        size = _safe_size(record)
        parsed = _parse_run(path)
        source: str | None = None
        run_prefix: str | None = None
        if parsed is not None:
            source, _, run_prefix = parsed
            stats = source_stats.setdefault(
                source,
                {
                    "objects": {"total": 0, "keep": 0, "delete": 0},
                    "bytes": {"total": 0, "keep": 0, "delete": 0},
                    "total_runs": set(),
                    "keep_runs": set(),
                    "delete_runs": set(),
                },
            )
            stats["objects"]["total"] += 1
            stats["bytes"]["total"] += size
            stats["total_runs"].add(run_prefix)
        if path in delete_paths:
            delete_bytes += size
            if parsed is not None:
                delete_runs.add(run_prefix)
                stats["objects"]["delete"] += 1
                stats["bytes"]["delete"] += size
                stats["delete_runs"].add(run_prefix)
        else:
            keep_bytes += size
            if parsed is None:
                unparseable_objects_kept += 1
            else:
                keep_runs.add(run_prefix)
                stats["objects"]["keep"] += 1
                stats["bytes"]["keep"] += size
                stats["keep_runs"].add(run_prefix)
        if parsed is not None:
            all_runs.add(run_prefix)

    digest_input = json.dumps(
        sorted(delete_paths),
        ensure_ascii=True,
        separators=(",", ":"),
    ).encode("utf-8")
    sources = [
        {
            "source": source,
            "objects": stats["objects"],
            "bytes": stats["bytes"],
            "runs": {
                "total": len(stats["total_runs"]),
                "keep": len(stats["keep_runs"]),
                "delete": len(stats["delete_runs"]),
            },
        }
        for source, stats in sorted(source_stats.items())
    ]
    return {
        "mode": "dry-run",
        "as_of": as_of.astimezone(timezone.utc).isoformat(),
        "policy": {
            "recent_days": 3,
            "recent_selection": "earliest and latest run per source/day",
            "daily_through_day": 14,
            "daily_selection": "latest run per source/day",
            "weekly_through_day": 60,
            "weekly_selection": "latest run per source/ISO week",
            "monthly_through_day": 365,
            "monthly_selection": "latest run per source/month",
            "older_than_days": "delete after 365 days",
            "unparseable_objects": "keep",
        },
        "objects": {
            "total": len(records),
            "keep": len(keep_paths),
            "delete": len(delete_paths),
        },
        "bytes": {
            "total": keep_bytes + delete_bytes,
            "keep": keep_bytes,
            "delete": delete_bytes,
        },
        "runs": {
            "total": len(all_runs),
            "keep": len(keep_runs),
            "delete": len(delete_runs),
        },
        "unparseable_objects_kept": unparseable_objects_kept,
        "plan_sha256": hashlib.sha256(digest_input).hexdigest(),
        "sources": sources,
    }


def _validated_inventory_paths(
    records: list[dict[str, Any]],
    *,
    context: str,
) -> set[str]:
    paths: list[str] = []
    for record in records:
        path = record.get("path")
        if not isinstance(path, str) or not path:
            raise RuntimeError(f"{context} inventory contains a malformed object path")
        paths.append(path)
    if len(paths) != len(set(paths)):
        raise RuntimeError(f"{context} inventory contains duplicate object paths")
    return set(paths)


def run_dry_run(
    client: Any,
    *,
    project_ref: str,
    as_of: datetime,
) -> dict[str, Any]:
    """Inventory a known project and return an aggregate retention plan."""

    if project_ref not in ALLOWED_PROJECT_REFS:
        raise RuntimeError("Refusing unknown retention target")
    records = list(iter_backup_objects(client))
    _validated_inventory_paths(records, context="Retention dry-run")
    plan = build_retention_plan(records, as_of=as_of)
    report = build_public_report(records, plan, as_of=as_of)
    report.update(
        {
            "project_ref": project_ref,
            "bucket": BACKUP_BUCKET,
        }
    )
    return report


def run_apply(
    client: Any,
    *,
    project_ref: str,
    as_of: datetime,
    expected_delete_count: int,
    expected_delete_bytes: int,
    expected_plan_sha256: str,
    production_approval: str | None = None,
) -> dict[str, Any]:
    """Apply only a retention plan matching every approved aggregate guard."""

    if project_ref not in ALLOWED_PROJECT_REFS:
        raise RuntimeError("Refusing unknown retention target")
    if (
        project_ref == EXPECTED_PRODUCTION_PROJECT_REF
        and production_approval != PRODUCTION_APPROVAL_PHRASE
    ):
        raise RuntimeError("Production retention approval phrase is missing or incorrect")
    records = list(iter_backup_objects(client))
    _validated_inventory_paths(records, context="Retention apply")

    plan = build_retention_plan(records, as_of=as_of)
    report = build_public_report(records, plan, as_of=as_of)
    actual_count = int(report["objects"]["delete"])
    actual_bytes = int(report["bytes"]["delete"])
    actual_digest = str(report["plan_sha256"])

    if actual_count != expected_delete_count:
        raise RuntimeError(
            "Retention apply object count mismatch: "
            f"expected {expected_delete_count}, found {actual_count}"
        )
    if actual_bytes != expected_delete_bytes:
        raise RuntimeError(
            "Retention apply byte count mismatch: "
            f"expected {expected_delete_bytes}, found {actual_bytes}"
        )
    if actual_digest != expected_plan_sha256:
        raise RuntimeError("Retention apply plan SHA-256 mismatch")

    delete_error: Exception | None = None
    try:
        client.delete_objects(list(plan["delete_paths"]))
    except Exception as error:
        delete_error = error

    try:
        after_records = list(iter_backup_objects(client))
        after_paths = _validated_inventory_paths(
            after_records,
            context="Post-delete",
        )
    except Exception as verification_error:
        raise RuntimeError(
            "Retention delete outcome is unknown because post-delete "
            "verification could not complete; do not retry automatically"
        ) from verification_error

    delete_paths = set(plan["delete_paths"])
    keep_paths = set(plan["keep_paths"])
    remaining_delete_count = len(delete_paths & after_paths)
    missing_keep_count = len(keep_paths - after_paths)
    if remaining_delete_count or missing_keep_count:
        raise RuntimeError(
            "Retention post-delete verification failed: "
            f"{remaining_delete_count} deletion candidates remain and "
            f"{missing_keep_count} retained objects are missing"
        )

    report.update(
        {
            "mode": "apply",
            "apply_outcome": (
                "verified-after-uncertain-request" if delete_error else "verified"
            ),
            "project_ref": project_ref,
            "bucket": BACKUP_BUCKET,
            "post_delete_verification": {
                "objects": len(after_records),
                "bytes": sum(_safe_size(record) for record in after_records),
                "approved_deletion_objects_remaining": remaining_delete_count,
                "approved_keep_objects_missing": missing_keep_count,
            },
        }
    )
    return report


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Plan or apply guarded SportStack scrape-backup retention"
    )
    parser.add_argument(
        "--expected-project-ref",
        default=os.getenv("EXPECTED_SUPABASE_PROJECT_REF", EXPECTED_DEV_PROJECT_REF),
        choices=sorted(ALLOWED_PROJECT_REFS),
    )
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--expected-delete-count", type=int)
    parser.add_argument("--expected-delete-bytes", type=int)
    parser.add_argument("--expected-plan-sha256")
    parser.add_argument("--production-approval")
    args = parser.parse_args(argv)

    guards = (
        args.expected_delete_count,
        args.expected_delete_bytes,
        args.expected_plan_sha256,
    )
    if args.apply:
        if any(value is None for value in guards):
            parser.error("--apply requires every expected retention guard")
        if args.expected_delete_count <= 0 or args.expected_delete_bytes <= 0:
            parser.error("expected deletion count and bytes must be positive")
        if not re.fullmatch(r"[0-9a-f]{64}", args.expected_plan_sha256):
            parser.error("expected plan SHA-256 must be 64 lowercase hexadecimal characters")
        if (
            args.expected_project_ref == EXPECTED_PRODUCTION_PROJECT_REF
            and args.production_approval != PRODUCTION_APPROVAL_PHRASE
        ):
            parser.error(
                "Production apply requires the exact production approval phrase"
            )
    elif any(value is not None for value in guards):
        parser.error("expected retention guards are valid only with --apply")
    if (
        args.expected_project_ref != EXPECTED_PRODUCTION_PROJECT_REF
        and args.production_approval is not None
    ):
        parser.error("Production approval is valid only for the Production project")
    return args


def main(argv: list[str] | None = None) -> None:
    args = parse_args(argv)
    try:
        from inspect_supabase_storage_usage import (
            StorageApi,
            require_env,
            validate_target,
        )
    except ModuleNotFoundError:
        from scripts.inspect_supabase_storage_usage import (
            StorageApi,
            require_env,
            validate_target,
        )

    supabase_url = require_env("SUPABASE_URL")
    service_key = os.getenv("SUPABASE_SERVICE_KEY") or os.getenv(
        "SUPABASE_SERVICE_ROLE_KEY"
    )
    if not service_key:
        raise RuntimeError("Missing SUPABASE_SERVICE_KEY/SUPABASE_SERVICE_ROLE_KEY")

    project_ref = validate_target(supabase_url, args.expected_project_ref)
    reader = StorageApi(supabase_url, service_key, args.expected_project_ref)
    as_of = datetime.now(timezone.utc)
    if args.apply:
        report = run_apply(
            RetentionStorageApi(reader, args.expected_project_ref),
            project_ref=project_ref,
            as_of=as_of,
            expected_delete_count=args.expected_delete_count,
            expected_delete_bytes=args.expected_delete_bytes,
            expected_plan_sha256=args.expected_plan_sha256,
            production_approval=args.production_approval,
        )
    else:
        report = run_dry_run(
            reader,
            project_ref=project_ref,
            as_of=as_of,
        )
    print(json.dumps(report, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
