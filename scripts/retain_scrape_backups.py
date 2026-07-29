"""Plan tiered retention for SportStack Dev scraper backups.

Backups are grouped by upload-run prefixes of the form
``source/YYYY/MM/DD/HHMMSS``. Planning is pure and performs no Storage I/O.
"""

from __future__ import annotations

import hashlib
import json
import os
from collections import defaultdict
from collections.abc import Iterable, Iterator
from datetime import datetime, timedelta, timezone
from typing import Any
from urllib.parse import quote

RECENT_WINDOW = timedelta(days=7)
WEEKLY_ARCHIVE_END = timedelta(days=21)
BACKUP_BUCKET = "scrape-backups"
PAGE_SIZE = 1000
EXPECTED_DEV_PROJECT_REF = "icqegnpjbizccjebjfhb"


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
                    continue
                name = str(entry.get("name") or "").strip("/")
                if not name:
                    continue
                path = f"{prefix}/{name}".strip("/")
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
    weekly_candidates: dict[tuple[str, int], list[str]] = defaultdict(list)
    monthly_candidates: dict[tuple[str, int, int], list[str]] = defaultdict(list)

    for run_prefix, (source, run_at) in run_metadata.items():
        age = as_of - run_at
        if age <= RECENT_WINDOW:
            keep_runs.add(run_prefix)
        elif age <= WEEKLY_ARCHIVE_END:
            weekly_band = 1 if age <= timedelta(days=14) else 2
            weekly_candidates[(source, weekly_band)].append(run_prefix)
        else:
            monthly_candidates[(source, run_at.year, run_at.month)].append(run_prefix)

    for candidates in (*weekly_candidates.values(), *monthly_candidates.values()):
        keep_runs.add(min(candidates, key=lambda prefix: run_metadata[prefix][1]))

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
            "recent_days_keep_all": 7,
            "prior_weekly_bands": 2,
            "older_monthly_selection": "earliest available run per source/month",
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


def run_dry_run(
    client: Any,
    *,
    project_ref: str,
    as_of: datetime,
) -> dict[str, Any]:
    """Inventory Dev backups and return an aggregate retention plan."""

    if project_ref != EXPECTED_DEV_PROJECT_REF:
        raise RuntimeError(
            f"Refusing non-Dev retention target; expected {EXPECTED_DEV_PROJECT_REF}"
        )
    records = list(iter_backup_objects(client))
    plan = build_retention_plan(records, as_of=as_of)
    report = build_public_report(records, plan, as_of=as_of)
    report.update(
        {
            "project_ref": project_ref,
            "bucket": BACKUP_BUCKET,
        }
    )
    return report


def main() -> None:
    try:
        from inspect_supabase_storage_usage import (
            StorageApi,
            require_env,
            validate_dev_target,
        )
    except ModuleNotFoundError:
        from scripts.inspect_supabase_storage_usage import (
            StorageApi,
            require_env,
            validate_dev_target,
        )

    supabase_url = require_env("SUPABASE_URL")
    service_key = os.getenv("SUPABASE_SERVICE_KEY") or os.getenv(
        "SUPABASE_SERVICE_ROLE_KEY"
    )
    if not service_key:
        raise RuntimeError("Missing SUPABASE_SERVICE_KEY/SUPABASE_SERVICE_ROLE_KEY")

    project_ref = validate_dev_target(supabase_url)
    report = run_dry_run(
        StorageApi(supabase_url, service_key),
        project_ref=project_ref,
        as_of=datetime.now(timezone.utc),
    )
    print(json.dumps(report, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
