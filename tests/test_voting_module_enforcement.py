"""Regression checks for the voting module database and Edge boundaries."""

from __future__ import annotations

import re
import unittest
from pathlib import Path

ROOT = Path(__file__).parents[1]
MIGRATION = ROOT / "supabase" / "migrations" / "20260802115000_enforce_voting_module_access.sql"
MVP_REMINDERS = ROOT / "supabase" / "functions" / "mvp-voting-email-reminders" / "index.ts"
PUBLIC_UMPIRE = ROOT / "supabase" / "functions" / "public-umpire-match-voting" / "index.ts"


def compact(path: Path) -> str:
    """Return lower-case source with repeated whitespace collapsed."""

    return re.sub(r"\s+", " ", path.read_text(encoding="utf-8")).lower()


class VotingModuleEnforcementTests(unittest.TestCase):
    def test_browser_tables_have_restrictive_module_policies(self) -> None:
        sql = compact(MIGRATION)
        for table in (
            "mvp_voting_sessions",
            "mvp_vote_tokens",
            "mvp_votes",
            "mvp_vote_submissions",
            "mvp_vote_audit",
            "mvp_result_checks",
            "mvp_voting_email_events",
            "player_vote_submissions",
            "player_vote_lines",
            "player_vote_edits",
        ):
            self.assertRegex(sql, rf"on public\.{table} as restrictive")

    def test_new_rows_are_checked_from_scope_fields_not_unwritten_ids(self) -> None:
        sql = compact(MIGRATION)
        self.assertIn(
            "with check (private.player_mvp_session_row_allowed_for_current_session(fixture_id, team_id))",
            sql,
        )

    def test_legacy_public_tokens_are_not_enumerable_or_directly_writable(self) -> None:
        sql = compact(MIGRATION)
        self.assertIn(
            'drop policy if exists "public token lookup by value" on public.mvp_vote_tokens',
            sql,
        )
        self.assertIn(
            'drop policy if exists "verified token can submit votes" on public.mvp_votes',
            sql,
        )
        self.assertIn(
            "revoke all privileges on table public.mvp_vote_tokens from anon",
            sql,
        )
        self.assertIn(
            "revoke all privileges on table public.mvp_votes from anon",
            sql,
        )

    def test_token_votes_are_bound_to_the_tokens_own_session(self) -> None:
        sql = compact(MIGRATION)
        self.assertIn(
            "p_session_id is not null and p_session_id is distinct from v_token_session_id",
            sql,
        )
        self.assertIn(
            "create trigger enforce_mvp_vote_token_session before insert or update on public.mvp_votes",
            sql,
        )
        self.assertIn(
            "new.session_id is distinct from v_token_session_id",
            sql,
        )
        self.assertIn(
            "private.umpire_match_submission_row_allowed_for_current_session( fixture_id, association_id, division_id, home_team_id, away_team_id )",
            sql,
        )

    def test_fixture_trigger_skips_session_creation_when_player_mvp_is_off(self) -> None:
        sql = compact(MIGRATION)
        trigger_function = sql.split(
            "create or replace function public.create_mvp_session_for_fixture()",
            1,
        )[1].split(
            "create or replace function private.enforce_mvp_vote_token_session()",
            1,
        )[0]
        module_gate = trigger_function.find(
            "public.player_mvp_public_session_row_enabled(new.id, v_team_id) is not true"
        )
        session_create = trigger_function.find("private.mvp_create_pending_session")
        self.assertGreater(module_gate, -1)
        self.assertGreater(session_create, -1)
        self.assertLess(module_gate, session_create)

    def test_unused_legacy_voting_tables_are_closed_to_browser_roles(self) -> None:
        sql = compact(MIGRATION)
        for table in (
            "mvp_tokens",
            "umpire_vote_submissions",
            "umpire_vote_lines",
            "umpire_vote_edits",
        ):
            self.assertIn(
                f"revoke all privileges on table public.{table} from public, anon, authenticated",
                sql,
            )
        for policy in (
            "mvp_tokens_public_read",
            "mvp_tokens_public_update",
            "umpire_subs_insert",
            "umpire_subs_read",
            "umpire_lines_insert",
            "umpire_lines_read",
            "umpire_edits_read",
        ):
            self.assertIn(f'drop policy if exists "{policy}"', sql)

    def test_browser_rpcs_are_guarded_and_implementations_are_service_only(self) -> None:
        sql = compact(MIGRATION)
        for function_name in (
            "submit_mvp_ballot",
            "get_mvp_session_results",
            "submit_umpire_match_vote",
            "review_umpire_vote_submission",
        ):
            self.assertIn(f"alter function public.{function_name}", sql)
            self.assertIn(f"create or replace function public.{function_name}", sql)
        self.assertIn("from public, anon, authenticated", sql)
        self.assertIn("to service_role", sql)

    def test_service_edge_flows_resolve_scope_module_state(self) -> None:
        reminders = compact(MVP_REMINDERS)
        public_umpire = compact(PUBLIC_UMPIRE)
        self.assertIn('rpc("resolve_module_enabled"', reminders)
        self.assertIn('rpc("current_session_can_access_voting_module"', reminders)
        self.assertIn('rpc( "umpire_match_voting_enabled_fixture_ids"', public_umpire)
        self.assertNotIn('rpc("resolve_module_enabled"', public_umpire)
        self.assertIn("umpire match voting is turned off for this fixture", public_umpire)

    def test_reminder_edge_auth_stays_fail_closed(self) -> None:
        reminders = compact(MVP_REMINDERS)
        self.assertIn('const cronsecret = getenv("sportstack_cron_secret")', reminders)
        self.assertIn('if (action !== "scheduled")', reminders)
        self.assertIn("anonclient.auth.getclaims(token)", reminders)
        self.assertIn("current_session_can_access_voting_module", reminders)

    def test_public_match_options_use_a_batched_service_only_resolver(self) -> None:
        sql = compact(MIGRATION)
        public_umpire = compact(PUBLIC_UMPIRE)
        self.assertIn(
            "create or replace function public.umpire_match_voting_enabled_fixture_ids",
            sql,
        )
        self.assertIn(
            "grant execute on function public.umpire_match_voting_enabled_fixture_ids(uuid[]) to service_role",
            sql,
        )
        self.assertNotIn("fixturemoduleenabled", public_umpire)
        self.assertNotIn("scopemoduleenabled", public_umpire)

    def test_cross_club_fixture_access_accepts_either_managed_side(self) -> None:
        sql = compact(MIGRATION)
        fixture_helper = sql.split(
            "create or replace function private.umpire_match_fixture_allowed_for_current_session",
            1,
        )[1].split(
            "create or replace function private.umpire_match_submission_allowed_for_current_session",
            1,
        )[0]
        self.assertIn("or private.module_allowed_for_current_session", fixture_helper)
        self.assertNotIn("and private.module_allowed_for_current_session", fixture_helper)
        self.assertIn("return v_team_scope_allowed", sql)

    def test_wrapper_parameter_names_remain_postgrest_compatible(self) -> None:
        sql = compact(MIGRATION)
        self.assertIn(
            "create or replace function public.resolve_mvp_result_dispute( p_session_id uuid, p_closes_at timestamptz default null",
            sql,
        )
        self.assertIn(
            "create or replace function public.review_umpire_vote_submission( p_submission_id uuid, p_action text, p_lines jsonb default null",
            sql,
        )
        self.assertNotIn("p_reopen_closes_at", sql)
        self.assertNotIn("p_corrections", sql)

    def test_public_submit_rate_limit_precedes_expensive_context_load(self) -> None:
        public_umpire = compact(PUBLIC_UMPIRE)
        submit_attempt = public_umpire.rfind('"submit_attempt"')
        context_load = public_umpire.rfind("const context = await loadfixturecontext")
        self.assertGreater(submit_attempt, -1)
        self.assertGreater(context_load, -1)
        self.assertLess(submit_attempt, context_load)


if __name__ == "__main__":
    unittest.main()
