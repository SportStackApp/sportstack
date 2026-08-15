"""Tests for compressed scraper backup uploads."""

from __future__ import annotations

import importlib.util
import tarfile
import tempfile
import unittest
from pathlib import Path

SCRIPT_PATH = (
    Path(__file__).parents[1] / "scripts" / "upload_scrape_backups_to_storage.py"
)
SPEC = importlib.util.spec_from_file_location("upload_scrape_backups", SCRIPT_PATH)
assert SPEC and SPEC.loader
uploader = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(uploader)


class ScrapeBackupUploadTests(unittest.TestCase):
    def test_builds_one_archive_with_only_supported_files(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            source_dir = Path(directory)
            (source_dir / "nested").mkdir()
            (source_dir / "results.csv").write_text("a,b\n1,2\n", encoding="utf-8")
            (source_dir / "nested" / "results.json").write_text(
                '{"ok": true}',
                encoding="utf-8",
            )
            (source_dir / "ignore.bin").write_bytes(b"ignore")

            files = uploader.collect_files(source_dir)
            archive_path = source_dir / "backup.tar.gz"
            uploader.build_compressed_archive(source_dir, files, archive_path)
            with tarfile.open(archive_path, mode="r:gz") as compressed:
                members = sorted(compressed.getnames())

            self.assertEqual(
                ["nested/results.json", "results.csv"],
                members,
            )

    def test_upload_uses_one_timestamped_gzip_object(self) -> None:
        class FakeBucket:
            def __init__(self) -> None:
                self.uploads = []

            def upload(self, path, archive_path, options):
                resolved_path = Path(archive_path)
                test_case.assertTrue(resolved_path.exists())
                self.uploads.append((path, resolved_path.read_bytes(), options))

        class FakeStorage:
            def __init__(self) -> None:
                self.bucket = FakeBucket()

            def from_(self, bucket_name):
                test_case.assertEqual("scrape-backups", bucket_name)
                return self.bucket

        class FakeClient:
            def __init__(self) -> None:
                self.storage = FakeStorage()

        test_case = self
        client = FakeClient()
        with tempfile.TemporaryDirectory() as directory:
            archive_path = Path(directory) / "backup.tar.gz"
            archive_path.write_bytes(b"gzip-data")
            path = uploader.upload_archive(
                client,
                "scrape-backups",
                archive_path,
                "hockey-ballarat/2026/07/30/010203",
                "hockey-ballarat",
            )

        self.assertEqual(
            "hockey-ballarat/2026/07/30/010203/hockey-ballarat.tar.gz",
            path,
        )
        self.assertEqual(1, len(client.storage.bucket.uploads))
        self.assertEqual(b"gzip-data", client.storage.bucket.uploads[0][1])
        self.assertEqual(
            {"content-type": "application/gzip"},
            client.storage.bucket.uploads[0][2],
        )


if __name__ == "__main__":
    unittest.main()
