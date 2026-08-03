from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
MIGRATION = ROOT / "supabase" / "migrations" / "20260803103000_notify_selected_player_availability_changes.sql"


def test_selected_player_notification_is_database_triggered() -> None:
    sql = MIGRATION.read_text(encoding="utf-8")

    assert "after insert or update of status or delete" in sql
    assert "fixture_lineup_assignments" in sql
    assert "fl.published_at is not null" in sql
    assert "LINEUP_AVAILABILITY_CHANGED" in sql


def test_selected_player_notification_is_scoped_to_team_staff() -> None:
    sql = MIGRATION.read_text(encoding="utf-8")

    assert "ur.team_id = lineup.team_id" in sql
    assert "'COACH'::public.user_role_enum" in sql
    assert "'TEAM_MANAGER'::public.user_role_enum" in sql
    assert "ur.user_id <> v_player_id" in sql
