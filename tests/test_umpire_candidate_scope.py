from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "src" / "lib" / "umpireLinkedPlayers.ts"


def test_umpire_candidates_only_use_fixture_team_memberships() -> None:
    source = SOURCE.read_text(encoding="utf-8")

    membership_query = source[source.index("const memberships ="):source.index("if (memberships.error)")]

    assert '.in("team_id", fixtureTeamIds)' in membership_query
    assert '.in("club_id", clubIds)' not in source


def test_fixture_roster_candidates_remain_available() -> None:
    source = SOURCE.read_text(encoding="utf-8")

    assert '.from("revsports_players")' in source
    assert 'source: "roster"' in source
