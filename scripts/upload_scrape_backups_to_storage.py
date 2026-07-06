"""Upload scraper backup files to Supabase Storage.

This keeps regularly changing scraper output out of Git history while still
preserving downloadable CSV/TXT/JSON backups from each workflow run.
"""

from __future__ import annotations

import argparse
import mimetypes
import os
from datetime import datetime, timezone
from pathlib import Path

from supabase import create_client


DEFAULT_BUCKET = "scrape-backups"
DEFAULT_EXTENSIONS = {".csv", ".json", ".txt"}


def require_env(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


def ensure_bucket(client, bucket_name: str) -> None:
    """Create a private bucket if it does not already exist."""

    try:
        client.storage.get_bucket(bucket_name)
        return
    except Exception as error:
        message = str(error).lower()
        if "not found" not in message and "does not exist" not in message:
            raise

    client.storage.create_bucket(bucket_name, {"public": False})


def collect_files(source_dir: Path) -> list[Path]:
    if not source_dir.exists():
        raise RuntimeError(f"Source directory does not exist: {source_dir}")

    files = [
        path
        for path in source_dir.rglob("*")
        if path.is_file() and path.suffix.lower() in DEFAULT_EXTENSIONS
    ]
    return sorted(files)


def upload_file(client, bucket_name: str, source_dir: Path, path: Path, prefix: str) -> str:
    relative_path = path.relative_to(source_dir).as_posix()
    storage_path = f"{prefix}/{relative_path}"
    content_type = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
    file_options = {"content-type": content_type}

    with path.open("rb") as handle:
        try:
            client.storage.from_(bucket_name).upload(storage_path, handle, file_options)
        except Exception as error:
            # Supabase Storage upload does not replace existing files by default.
            # If this path already exists, update it instead.
            if "already exists" not in str(error).lower():
                raise
            handle.seek(0)
            client.storage.from_(bucket_name).update(storage_path, handle, file_options)

    return storage_path


def main() -> None:
    parser = argparse.ArgumentParser(description="Upload scraper backup files to Supabase Storage.")
    parser.add_argument("--source-dir", required=True, help="Local scraper output directory to upload.")
    parser.add_argument("--source-name", required=True, help="Short source name, such as hockey-ballarat.")
    parser.add_argument("--bucket", default=os.getenv("SCRAPE_BACKUP_BUCKET", DEFAULT_BUCKET))
    args = parser.parse_args()

    supabase_url = require_env("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not supabase_key:
        raise RuntimeError("Missing required environment variable: SUPABASE_SERVICE_KEY")

    source_dir = Path(args.source_dir)
    files = collect_files(source_dir)
    if not files:
        print(f"No backup files found in {source_dir}.")
        return

    client = create_client(supabase_url, supabase_key)
    ensure_bucket(client, args.bucket)

    run_stamp = datetime.now(timezone.utc).strftime("%Y/%m/%d/%H%M%S")
    prefix = f"{args.source_name}/{run_stamp}"

    uploaded = [
        upload_file(client, args.bucket, source_dir, path, prefix)
        for path in files
    ]

    print(f"Uploaded {len(uploaded)} backup file(s) to Supabase Storage bucket '{args.bucket}':")
    for storage_path in uploaded:
        print(f"- {storage_path}")


if __name__ == "__main__":
    main()
