"""Regression checks for committee and Safety Hub database boundaries."""

from __future__ import annotations

import re
import unittest
from pathlib import Path

MIGRATIONS_DIR = Path(__file__).parents[1] / "supabase" / "migrations"
COMMITTEE_OPERATIONS = MIGRATIONS_DIR / "20260801070000_committee_operations.sql"
COMMITTEE_HARDENING = MIGRATIONS_DIR / "20260801071000_committee_operations_hardening.sql"
SAFETY_SCOPE_FIX = MIGRATIONS_DIR / "20260801081000_safety_hub_linked_scope_fix.sql"
COMMITTEE_SAFETY_LINKS = MIGRATIONS_DIR / "20260801082000_committee_safety_links.sql"


def normalised_sql(path: Path) -> str:
    """Return lower-case SQL with repeated whitespace collapsed."""

    return re.sub(r"\s+", " ", path.read_text(encoding="utf-8")).lower()


class CommitteeSafetyMigrationTests(unittest.TestCase):
    def test_committee_vote_and_chat_need_current_explicit_permission(self) -> None:
        sql = normalised_sql(COMMITTEE_OPERATIONS)

        self.assertIn("member_row.start_date <= current_date", sql)
        self.assertIn(
            "member_row.end_date is null or member_row.end_date >= current_date", sql
        )
        self.assertIn("position.permissions -> p_permission_key = 'true'::jsonb", sql)
        self.assertIn("public.has_committee_permission(v_poll.committee_id, 'vote'", sql)
        self.assertIn("public.has_committee_permission(committee_id, 'chat'", sql)

    def test_committee_poll_response_is_unique_and_question_types_are_bounded(self) -> None:
        sql = normalised_sql(COMMITTEE_OPERATIONS)

        self.assertIn("unique (poll_id, user_id)", sql)
        for question_type in (
            "free_text",
            "single_choice",
            "multiple_choice",
            "yes_no_abstain",
        ):
            self.assertIn(f"'{question_type}'", sql)

    def test_committee_tables_and_rpc_functions_are_not_available_to_anon(self) -> None:
        sql = normalised_sql(COMMITTEE_OPERATIONS)

        self.assertIn(
            "revoke all on table public.committee_polls, public.committee_poll_questions",
            sql,
        )
        self.assertIn("from public, anon", sql)
        for function_name in (
            "create_committee_poll",
            "submit_committee_poll_response",
            "create_committee_agenda_template",
            "create_committee_meeting_from_template",
        ):
            self.assertRegex(
                sql,
                rf"revoke all on function public\.{function_name}\([^;]+from public, anon;",
            )

    def test_committee_trigger_helpers_are_internal(self) -> None:
        sql = normalised_sql(COMMITTEE_HARDENING)

        self.assertIn(
            "revoke all on function public.audit_committee_activity() from public, anon, authenticated",
            sql,
        )
        self.assertIn(
            "revoke all on function public.set_committee_updated_at() from public, anon, authenticated",
            sql,
        )

    def test_latest_safety_save_rpc_uses_invoker_rls_and_source_scope(self) -> None:
        sql = normalised_sql(SAFETY_SCOPE_FIX)

        self.assertIn("security invoker set search_path = ''", sql)
        self.assertIn("if auth.uid() is null", sql)
        self.assertIn(
            "select association_id, club_id, team_id into v_association_id, v_club_id, v_team_id",
            sql,
        )
        self.assertIn(
            "revoke all on function public.save_safety_hub_form(text, uuid, uuid, uuid, uuid, jsonb) from public, anon",
            sql,
        )
        self.assertIn(
            "grant execute on function public.save_safety_hub_form(text, uuid, uuid, uuid, uuid, jsonb) to authenticated",
            sql,
        )

    def test_committee_safety_links_require_a_real_same_scope_record(self) -> None:
        sql = normalised_sql(COMMITTEE_SAFETY_LINKS)

        self.assertIn("security definer set search_path = ''", sql)
        self.assertIn("the selected safety hub record does not exist", sql)
        self.assertIn(
            "v_record_association_id is distinct from v_committee_association_id", sql
        )
        self.assertIn(
            "v_record_club_id is distinct from v_committee_club_id", sql
        )
        self.assertIn(
            "before insert or update of meeting_id, linked_record_type, linked_record_id",
            sql,
        )
        self.assertIn("from public, anon, authenticated", sql)


if __name__ == "__main__":
    unittest.main()
