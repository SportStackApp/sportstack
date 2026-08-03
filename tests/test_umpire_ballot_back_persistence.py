from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "src" / "pages" / "umpire" / "UmpireVoteSubmit.tsx"


def test_returning_to_the_ballot_does_not_reinitialise_vote_cards() -> None:
    source = SOURCE.read_text(encoding="utf-8")

    assert "if (voteCards.length === 0)" in source
    assert "initialiseVoteCards(division ||" in source


def test_selecting_a_different_fixture_clears_incompatible_vote_cards() -> None:
    source = SOURCE.read_text(encoding="utf-8")

    assert "if (value !== selectedFixtureId)" in source
    assert "setVoteCards([]);" in source
    assert "setNumberOnlyAcknowledged(false);" in source
