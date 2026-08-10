from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "src" / "lib" / "umpireLinkedPlayers.ts"
EDGE_SOURCE = ROOT / "supabase" / "functions" / "public-umpire-match-voting" / "index.ts"


def test_umpire_candidates_only_use_fixture_team_memberships() -> None:
    source = SOURCE.read_text(encoding="utf-8")

    membership_query = source[source.index("const memberships ="):source.index("if (memberships.error)")]

    assert '.in("team_id", fixtureTeamIds)' in membership_query
    assert '.in("club_id", clubIds)' not in source


def test_fixture_roster_candidates_remain_available() -> None:
    source = SOURCE.read_text(encoding="utf-8")

    assert '.from("revsports_players")' in source
    assert 'source: "roster"' in source


def test_public_portal_candidates_are_limited_to_the_selected_fixture() -> None:
    source = EDGE_SOURCE.read_text(encoding="utf-8")

    assert 'const fixtureTeamIds = [context.homeTeam.id, context.awayTeam.id]' in source
    assert '.eq("fixture_id", context.fixture.id)' in source
    assert '.in("team_id", fixtureTeamIds)' in source
    assert 'source: "fixture"' in source
    assert 'source: "association"' not in source
