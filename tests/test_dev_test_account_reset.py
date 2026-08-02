"""Regression checks for the reserved Dev test-account reset boundary."""

from __future__ import annotations

import re
import unittest
from pathlib import Path

ROOT = Path(__file__).parents[1]
MIGRATION = ROOT / "supabase" / "migrations" / "20260802231405_reserved_dev_test_account_lookup.sql"
EDGE_FUNCTION = ROOT / "supabase" / "functions" / "provision-dev-test-account" / "index.ts"
PROVISIONER = ROOT / "src" / "components" / "admin" / "DevTestAccountProvisioner.tsx"


def normalised(path: Path) -> str:
    """Return lower-case source with repeated whitespace collapsed."""

    return re.sub(r"\s+", " ", path.read_text(encoding="utf-8")).lower()


class DevTestAccountResetTests(unittest.TestCase):
    def test_lookup_is_service_only_and_accepts_only_reserved_role_email_pairs(self) -> None:
        sql = normalised(MIGRATION)

        self.assertIn("create or replace function public.get_reserved_dev_test_account_id", sql)
        for slug in (
            "association-admin",
            "club-admin",
            "team-manager",
            "coach",
            "player",
            "umpire",
            "voter",
        ):
            self.assertIn(f"codex.{slug}.dev@sportstackapp.com.au", sql)
        self.assertIn("from auth.users auth_user", sql)
        self.assertIn("sportstack_dev_test", sql)
        self.assertIn("from public, anon, authenticated", sql)
        self.assertIn("to service_role", sql)

    def test_edge_function_revalidates_identity_before_resetting_password(self) -> None:
        source = normalised(EDGE_FUNCTION)

        self.assertIn('operation?: "create" | "reset"', source)
        self.assertIn('"get_reserved_dev_test_account_id"', source)
        self.assertIn(".getuserbyid(existinguserid)", source)
        self.assertIn("app_metadata?.sportstack_dev_test === true", source)
        self.assertIn("auth.admin.updateuserbyid", source)
        self.assertIn("p_created: created", source)
        self.assertIn("if (created) await rollbacknewuser()", source)

    def test_frontend_requires_an_explicit_confirmed_reset(self) -> None:
        source = normalised(PROVISIONER)

        self.assertIn('type accountoperation = "create" | "reset"', source)
        self.assertIn('setpendingoperation("reset")', source)
        self.assertIn("reset this dev test account?", source)
        self.assertIn("this never targets a normal user or production", source)


if __name__ == "__main__":
    unittest.main()
