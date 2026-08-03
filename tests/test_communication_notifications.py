from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
MIGRATION = ROOT / "supabase" / "migrations" / "20260803102000_exclude_broadcast_author_notifications.sql"


def test_broadcast_author_is_excluded_from_in_app_notifications() -> None:
    sql = MIGRATION.read_text(encoding="utf-8")

    recipients_start = sql.index("with recipients as")
    notification_insert = sql.index("insert into public.notifications")
    recipients_sql = sql[recipients_start:notification_insert]

    assert "tm.user_id <> new.author_id" in recipients_sql


def test_broadcast_author_is_excluded_from_email_delivery() -> None:
    sql = MIGRATION.read_text(encoding="utf-8")

    email_insert = sql.index("insert into public.communication_email_deliveries")
    email_sql = sql[email_insert:]

    assert "tm.user_id <> new.author_id" in email_sql
