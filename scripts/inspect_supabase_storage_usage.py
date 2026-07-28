"""Report aggregate Supabase Storage usage for the SportStack Dev project.

The Storage object-list endpoint uses POST for a read operation. This script
allows that one POST path and rejects every mutation endpoint. It never prints
individual object names or service credentials.
"""

from __future__ import annotations

import json
import os
from collections import defaultdict
from collections.abc import Iterable, Iterator
from typing import Any
from urllib.error import HTTPError
from urllib.parse import quote, urlparse
from urllib.request import HTTPRedirectHandler, Request, build_opener

EXPECTED_DEV_PROJECT_REF = "icqegnpjbizccjebjfhb"
EXPECTED_DEV_HOST = f"{EXPECTED_DEV_PROJECT_REF}.supabase.co"
PAGE_SIZE = 1000


class UnsafeTargetError(RuntimeError):
    """Raised when the diagnostic is pointed anywhere except SportStack Dev."""


class RejectRedirects(HTTPRedirectHandler):
    """Stop before a credential-bearing Storage request follows any redirect."""

    def redirect_request(
        self,
        req: Request,
        fp: Any,
        code: int,
        msg: str,
        headers: Any,
        newurl: str,
    ) -> Request | None:
        raise UnsafeTargetError(
            f"Refusing redirected Storage API request (HTTP {code})"
        )


def require_env(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


def validate_dev_target(supabase_url: str) -> str:
    parsed = urlparse(supabase_url)
    is_canonical_dev_url = (
        parsed.scheme == "https"
        and parsed.netloc == EXPECTED_DEV_HOST
        and parsed.hostname == EXPECTED_DEV_HOST
        and parsed.username is None
        and parsed.password is None
        and parsed.path in ("", "/")
        and not parsed.params
        and not parsed.query
        and not parsed.fragment
    )
    if not is_canonical_dev_url:
        raise UnsafeTargetError(
            f"Refusing non-Dev Supabase target; expected https://{EXPECTED_DEV_HOST}"
        )
    return EXPECTED_DEV_PROJECT_REF


def _object_size(record: dict[str, Any]) -> int:
    try:
        return max(0, int(record.get("size") or 0))
    except (TypeError, ValueError):
        return 0


def summarise_objects(records: Iterable[dict[str, Any]]) -> dict[str, Any]:
    prefix_totals: dict[str, dict[str, int]] = defaultdict(
        lambda: {"object_count": 0, "bytes": 0}
    )
    object_count = 0
    total_bytes = 0

    for record in records:
        prefix = str(record.get("top_level_prefix") or "__root__")
        size = _object_size(record)
        object_count += 1
        total_bytes += size
        prefix_totals[prefix]["object_count"] += 1
        prefix_totals[prefix]["bytes"] += size

    top_level_prefixes = [
        {
            "prefix": prefix,
            "object_count": values["object_count"],
            "bytes": values["bytes"],
        }
        for prefix, values in prefix_totals.items()
    ]
    top_level_prefixes.sort(key=lambda row: (-row["bytes"], row["prefix"]))

    return {
        "object_count": object_count,
        "bytes": total_bytes,
        "gib": round(total_bytes / (1024**3), 6),
        "top_level_prefixes": top_level_prefixes,
    }


class StorageApi:
    """Minimal read-only client for Supabase Storage metadata."""

    def __init__(self, supabase_url: str, service_key: str) -> None:
        validate_dev_target(supabase_url)
        self.base_url = f"https://{EXPECTED_DEV_HOST}"
        self.service_key = service_key
        self.opener = build_opener(RejectRedirects())

    def _request_json(
        self,
        method: str,
        path: str,
        payload: dict[str, Any] | None = None,
    ) -> Any:
        is_bucket_list = method == "GET" and path == "/storage/v1/bucket"
        is_object_list = method == "POST" and path.startswith(
            "/storage/v1/object/list/"
        )
        if not (is_bucket_list or is_object_list):
            raise RuntimeError(f"Refusing non-list Storage API request: {method} {path}")

        body = json.dumps(payload).encode("utf-8") if payload is not None else None
        request = Request(
            f"{self.base_url}{path}",
            data=body,
            method=method,
            headers={
                "Authorization": f"Bearer {self.service_key}",
                "apikey": self.service_key,
                "Content-Type": "application/json",
            },
        )
        try:
            with self.opener.open(request, timeout=60) as response:
                return json.loads(response.read().decode("utf-8"))
        except HTTPError as error:
            raise RuntimeError(
                f"Storage API returned HTTP {error.code} for {method} {path}"
            ) from error

    def list_buckets(self) -> list[dict[str, Any]]:
        result = self._request_json("GET", "/storage/v1/bucket")
        if isinstance(result, list):
            return result
        if isinstance(result, dict) and isinstance(result.get("buckets"), list):
            return result["buckets"]
        raise RuntimeError("Unexpected response from Storage bucket list")

    def iter_objects(self, bucket_id: str) -> Iterator[dict[str, Any]]:
        yield from self._iter_folder(bucket_id, prefix="", top_level_prefix=None)

    def _iter_folder(
        self,
        bucket_id: str,
        prefix: str,
        top_level_prefix: str | None,
    ) -> Iterator[dict[str, Any]]:
        offset = 0
        encoded_bucket = quote(bucket_id, safe="")
        while True:
            result = self._request_json(
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
                metadata = entry.get("metadata")
                if entry.get("id") is None:
                    child_prefix = f"{prefix}/{name}".strip("/")
                    child_top_level = top_level_prefix or name
                    yield from self._iter_folder(
                        bucket_id,
                        prefix=child_prefix,
                        top_level_prefix=child_top_level,
                    )
                    continue
                yield {
                    "top_level_prefix": top_level_prefix or "__root__",
                    "size": _object_size(metadata) if isinstance(metadata, dict) else 0,
                }

            if len(result) < PAGE_SIZE:
                break
            offset += len(result)


def build_report(client: StorageApi, project_ref: str) -> dict[str, Any]:
    buckets = []
    total_objects = 0
    total_bytes = 0

    for bucket in client.list_buckets():
        bucket_id = str(bucket.get("id") or bucket.get("name") or "")
        if not bucket_id:
            continue
        summary = summarise_objects(client.iter_objects(bucket_id))
        total_objects += summary["object_count"]
        total_bytes += summary["bytes"]
        bucket_report = {
            "bucket": bucket_id,
            "object_count": summary["object_count"],
            "bytes": summary["bytes"],
            "gib": summary["gib"],
        }
        if bucket_id == "scrape-backups":
            bucket_report["top_level_prefixes"] = summary["top_level_prefixes"]
        buckets.append(bucket_report)

    buckets.sort(key=lambda row: (-row["bytes"], row["bucket"]))
    return {
        "project_ref": project_ref,
        "mode": "read-only-storage-metadata",
        "object_count": total_objects,
        "bytes": total_bytes,
        "gib": round(total_bytes / (1024**3), 6),
        "buckets": buckets,
    }


def main() -> None:
    supabase_url = require_env("SUPABASE_URL")
    service_key = os.getenv("SUPABASE_SERVICE_KEY") or os.getenv(
        "SUPABASE_SERVICE_ROLE_KEY"
    )
    if not service_key:
        raise RuntimeError("Missing SUPABASE_SERVICE_KEY/SUPABASE_SERVICE_ROLE_KEY")

    project_ref = validate_dev_target(supabase_url)
    report = build_report(StorageApi(supabase_url, service_key), project_ref)
    print(json.dumps(report, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
