from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "src" / "pages" / "GameDetail.tsx"


def test_game_detail_deduplicates_historical_memberships_before_rendering() -> None:
    source = SOURCE.read_text(encoding="utf-8")

    assert "const uniqueMembers = Array.from(" in source
    assert "new Map<string, (typeof members)[number]>()" in source
    assert "const merged: TeamMember[] = uniqueMembers.map" in source


def test_game_detail_preserves_useful_membership_details() -> None:
    source = SOURCE.read_text(encoding="utf-8")

    assert "existing?.position || member.position" in source
    assert "existing?.jersey_number || member.jersey_number" in source
