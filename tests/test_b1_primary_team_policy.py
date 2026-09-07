"""Static regression checks for association-scoped Primary team policy."""

from pathlib import Path
import unittest


ROOT = Path(__file__).parents[1]
MIGRATION = ROOT / "supabase" / "migrations" / "20260907103000_b1_primary_team_per_association.sql"
LINT_FIX = ROOT / "supabase" / "migrations" / "20260907104500_b1_primary_team_per_association_lint_fix.sql"
PROFILE = ROOT / "src" / "pages" / "Profile.tsx"
REQUESTS = ROOT / "src" / "pages" / "admin" / "Requests.tsx"
APP = ROOT / "src" / "App.tsx"
APP_LAYOUT = ROOT / "src" / "components" / "layout" / "AppLayout.tsx"
TEAM_SECTION = ROOT / "src" / "components" / "profile" / "TeamMembershipSection.tsx"


class PrimaryTeamPolicyTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.sql = MIGRATION.read_text(encoding="utf-8")
        cls.lint_fix = LINT_FIX.read_text(encoding="utf-8")
        cls.profile = PROFILE.read_text(encoding="utf-8")
        cls.requests = REQUESTS.read_text(encoding="utf-8")
        cls.app = APP.read_text(encoding="utf-8")
        cls.app_layout = APP_LAYOUT.read_text(encoding="utf-8")
        cls.team_section = TEAM_SECTION.read_text(encoding="utf-8")

    @classmethod
    def tearDownClass(cls) -> None:
        print("B1_PRIMARY_POLICY_STATIC_OK")

    def test_guard_scopes_primary_uniqueness_to_association(self) -> None:
        self.assertIn("club.association_id = v_association_id", self.sql)
        self.assertIn("active primary team in that association", self.sql)
        self.assertIn("MULTIPLE_ACTIVE_PRIMARY_IN_ASSOCIATION", self.sql)

    def test_player_request_and_admin_approval_use_atomic_helper(self) -> None:
        approval = self.sql.split(
            "create or replace function public.approve_primary_team_change", 1
        )[1].split("create or replace function public.confirm_primary_team_change", 1)[0]
        self.assertIn("private.apply_primary_team_for_association", approval)
        self.assertIn("status = 'COMPLETED'", approval)
        self.assertNotIn("ADMIN_APPROVED", approval)

    def test_destination_team_manager_and_club_admin_can_review(self) -> None:
        review = self.sql.split(
            "create or replace function public.can_review_primary_team_change", 1
        )[1].split("create or replace function public.request_primary_team_change", 1)[0]
        self.assertIn("role_row.role::text = 'TEAM_MANAGER'", review)
        self.assertIn("role_row.team_id = team.id", review)
        self.assertIn("role_row.role::text = 'CLUB_ADMIN'", review)
        self.assertIn("role_row.club_id = team.club_id", review)

    def test_internal_helper_is_not_browser_callable(self) -> None:
        self.assertIn(
            "revoke all on function private.apply_primary_team_for_association(uuid, uuid, uuid)",
            self.sql,
        )
        self.assertIn("from public, anon, authenticated", self.sql)

    def test_later_additive_migration_corrects_action_normaliser(self) -> None:
        self.assertIn("pg_catalog.btrim", self.lint_fix)
        self.assertNotIn("pg_catalog.trim", self.lint_fix)

    def test_profile_displays_all_primary_teams(self) -> None:
        self.assertIn("const primaryMemberships = approvedMemberships.filter", self.profile)
        self.assertIn("primaryTeams={primaryTeams}", self.profile)
        self.assertIn("primaryTeams.map((primaryTeam)", self.profile)
        self.assertNotIn("{primaryTeam && (", self.profile)
        self.assertIn("primaryTeams.map", self.team_section)

    def test_request_screen_explains_approval_completion(self) -> None:
        self.assertIn("approval completed it immediately", self.requests)
        self.assertNotIn("User must confirm", self.requests)

    def test_team_manager_can_open_and_find_scoped_requests(self) -> None:
        self.assertIn(
            'const REQUEST_REVIEW_MODES = ["super_admin", "association", "club", "team_manager"]',
            self.app,
        )
        self.assertIn('allowedModes={REQUEST_REVIEW_MODES}', self.app)
        team_manager_nav = self.app_layout.split("  team_manager: [", 1)[1].split("  coach: [", 1)[0]
        self.assertIn('{ path: "/admin/requests", label: "Requests"', team_manager_nav)
        self.assertIn('|| activeMode === "team_manager";', self.app_layout)


if __name__ == "__main__":
    unittest.main()
