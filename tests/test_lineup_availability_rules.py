from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "src" / "components" / "lineup" / "LineupView.tsx"


def test_suggested_starters_exclude_unavailable_players() -> None:
    source = SOURCE.read_text(encoding="utf-8")

    assert '.filter((player) => !used.has(player.id) && player.availability !== "UNAVAILABLE")' in source


def test_suggested_bench_also_excludes_unavailable_players() -> None:
    source = SOURCE.read_text(encoding="utf-8")

    suggest_block = source[source.index("const suggestLineup ="):source.index("const changeFormation =")]
    assert suggest_block.count('player.availability !== "UNAVAILABLE"') == 2
