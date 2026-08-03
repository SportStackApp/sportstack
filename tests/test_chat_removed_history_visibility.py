from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "src" / "pages" / "Chat.tsx"


def test_removed_message_history_is_limited_to_moderators() -> None:
    source = SOURCE.read_text(encoding="utf-8")

    assert "message.edited_at && (!message.removed_at || canModerate)" in source
    assert "This content was removed." in source
