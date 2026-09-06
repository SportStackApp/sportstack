"""Regression checks for the account-wide Player/Voter administration boundary."""

from pathlib import Path
import unittest


ROOT = Path(__file__).parents[1]
MIGRATION = (
    ROOT
    / "supabase"
    / "migrations"
    / "20260907101500_b1_restrict_account_wide_simple_roles.sql"
)
USERS_PAGE = ROOT / "src" / "pages" / "admin" / "UsersManagement.tsx"


class AccountWideSimpleRoleBoundaryTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.sql = MIGRATION.read_text(encoding="utf-8")
        cls.users_page = USERS_PAGE.read_text(encoding="utf-8")

    def test_database_blocks_non_super_changes(self) -> None:
        self.assertIn("v_mode = 'super_admin'", self.sql)
        self.assertIn(
            "Only a Super Admin can change account-wide Player or Voter roles.",
            self.sql,
        )
        self.assertIn("errcode = '42501'", self.sql)
        self.assertIn("v_has_global_player", self.sql)
        self.assertIn("v_has_global_voter", self.sql)

    def test_both_browser_save_paths_use_the_guard(self) -> None:
        self.assertGreaterEqual(
            self.sql.count("assert_account_wide_simple_roles_unchanged"),
            6,
        )
        self.assertIn("admin_save_user_roles_b1_core", self.sql)
        self.assertIn("admin_save_user_access_b1_core", self.sql)
        self.assertIn("if to_regprocedure(", self.sql)

    def test_internal_implementations_are_not_browser_callable(self) -> None:
        for function_name in (
            "admin_save_user_roles_b1_core",
            "admin_save_user_access_b1_core",
        ):
            self.assertIn(f"revoke all on function public.{function_name}", self.sql)
        self.assertIn("from public, anon, authenticated", self.sql)

    def test_lower_admin_role_lists_exclude_player_and_voter(self) -> None:
        role_gate = self.users_page.split(
            "const canAssignRole = (role: AppRole): boolean => {", 1
        )[1].split("const handleSaveRoles", 1)[0]
        lower_admin_lists = [
            line for line in role_gate.splitlines() if "return [" in line
        ]

        self.assertEqual(2, len(lower_admin_lists))
        for role_list in lower_admin_lists:
            self.assertNotIn('"PLAYER"', role_list)
            self.assertNotIn('"VOTER"', role_list)


if __name__ == "__main__":
    unittest.main()
