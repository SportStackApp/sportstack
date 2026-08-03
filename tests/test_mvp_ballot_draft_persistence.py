from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "src" / "pages" / "MvpVoteCast.tsx"


def test_saved_ballot_is_loaded_before_draft_writes_begin() -> None:
    source = SOURCE.read_text(encoding="utf-8")

    assert "const [draftHydrated, setDraftHydrated] = useState(false);" in source
    assert "if (!ballotDraftKey || !draftHydrated || success) return;" in source
    assert "setDraftHydrated(true);" in source


def test_loading_voting_details_does_not_clear_the_hydrated_draft() -> None:
    source = SOURCE.read_text(encoding="utf-8")
    load_effect = source.split("const loadVotingDetails = async () => {", 1)[1].split(
        "try {", 1
    )[0]

    assert 'setVotes({ vote3: "__none__", vote2: "__none__", vote1: "__none__" });' not in load_effect
    assert 'setShoutout("");' not in load_effect
