import subprocess
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class B1VerificationSafetyTests(unittest.TestCase):
    def test_runtime_sql_checks_stop_on_first_error(self):
        sql_paths = (
            "scripts/sql/verify-b1-administration-membership-runtime.sql",
            "scripts/sql/verify-b1-membership-runtime.sql",
            "scripts/sql/verify-b1-primary-team-policy-runtime.sql",
        )

        for relative_path in sql_paths:
            with self.subTest(path=relative_path):
                contents = (ROOT / relative_path).read_text(encoding="utf-8")
                self.assertTrue(contents.startswith("\\set ON_ERROR_STOP on"))

    def test_membership_runner_builds_only_the_fixed_repository_check(self):
        runner = (
            ROOT / "scripts/run-b1-membership-dev-compatibility-check.ps1"
        ).read_text(encoding="utf-8")

        self.assertIn("build-b1-membership-dev-compatibility-check.mjs", runner)
        self.assertIn('param()', runner)
        self.assertNotIn('[string]$SqlPath', runner)
        self.assertNotIn('[string]$ExpectedMarker', runner)
        self.assertIn('"icqegnpjbizccjebjfhb"', runner)
        self.assertNotIn('supabase link --project-ref "svierarfcolhcfjpmwck"', runner)

    def test_generated_membership_check_is_fail_fast_and_rollback_only(self):
        builder = ROOT / "scripts/build-b1-membership-dev-compatibility-check.mjs"

        with tempfile.TemporaryDirectory() as temporary_directory:
            output_path = Path(temporary_directory) / "check.sql"
            result = subprocess.run(
                ["node", str(builder), str(output_path)],
                cwd=ROOT,
                capture_output=True,
                text=True,
                check=False,
            )
            self.assertEqual(result.returncode, 0, result.stderr)
            sql = output_path.read_text(encoding="utf-8")

        self.assertTrue(sql.startswith("begin;"))
        self.assertEqual(sql.lower().count("commit;"), 0)
        self.assertTrue(sql.rstrip().endswith("rollback;"))
        self.assertIn("B1_MEMBERSHIP_DEV_COMPATIBILITY_OK", sql)

    def test_historical_inventory_generator_is_disabled(self):
        generator = ROOT / "scripts/build-b1-security-compatibility.mjs"

        with tempfile.TemporaryDirectory() as temporary_directory:
            output_path = Path(temporary_directory) / "unsafe.sql"
            result = subprocess.run(
                ["node", str(generator), "inventory.json", str(output_path)],
                cwd=ROOT,
                capture_output=True,
                text=True,
                check=False,
            )
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("historical generator is disabled", result.stderr)
            self.assertFalse(output_path.exists())

    def test_rehearsal_amendment_verifier_passes(self):
        verifier = ROOT / "scripts/verify-b1-security-rehearsal.mjs"
        result = subprocess.run(
            ["node", str(verifier)],
            cwd=ROOT,
            capture_output=True,
            text=True,
            check=False,
        )

        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn(
            "B1_SECURITY_REHEARSAL_FINGERPRINT_AMENDMENT_OK",
            result.stdout,
        )


if __name__ == "__main__":
    unittest.main()
