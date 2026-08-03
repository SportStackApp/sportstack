from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "src" / "pages" / "umpire" / "UmpireVoteSubmit.tsx"


def test_loading_guards_do_not_clear_restored_cascade_selections() -> None:
    source = SOURCE.read_text(encoding="utf-8")

    rounds_guard = source.split("// Step 1 - Load unique rounds filtered by association", 1)[1].split(
        "const fetchRounds", 1
    )[0]
    divisions_guard = source.split("// Step 1 - Fetch divisions when round is chosen", 1)[1].split(
        "const fetchDivisions", 1
    )[0]
    fixtures_guard = source.split("// Step 1 - Fetch fixtures & teams", 1)[1].split(
        "const fetchFixturesAndTeams", 1
    )[0]

    assert 'setSelectedRound("")' not in rounds_guard
    assert 'setSelectedDivisionId("")' not in divisions_guard
    assert 'setSelectedFixtureId("")' not in fixtures_guard


def test_unresolved_saved_fixture_has_a_recoverable_loading_state() -> None:
    source = SOURCE.read_text(encoding="utf-8")

    assert "step > 1 && !selectedFixture" in source
    assert "Restoring saved ballot" in source
    assert "Your entered votes are being kept while the fixture reloads." in source
    assert "Choose another fixture" in source
