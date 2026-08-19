import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "src" / "pages" / "GameDetail.tsx"


class GameDetailAvailabilityTests(unittest.TestCase):
    def test_availability_styles_cover_the_generated_enum(self) -> None:
        source = SOURCE.read_text(encoding="utf-8")

        self.assertIn(
            "type PlayerAvailabilityStatus = Exclude<AvailabilityStatus, CoordinationAvailabilityStatus>",
            source,
        )
        self.assertIn(
            "const variants: Record<PlayerAvailabilityStatus, { selected: string; default: string }>",
            source,
        )
        for status in ("AVAILABLE", "UNAVAILABLE", "MAYBE", "NO_RESPONSE"):
            self.assertIn(f"{status}: {{", source)

        self.assertNotIn("UNSURE: {", source)
        self.assertNotIn('"PENDING"', source)

    def test_selected_availability_can_be_cleared(self) -> None:
        source = SOURCE.read_text(encoding="utf-8")

        self.assertIn("const isClearing = previous === status;", source)
        self.assertIn('.from("fixture_availability")\n          .delete()', source)
        self.assertIn('title: "Availability cleared"', source)
        self.assertIn('aria-label={`${label}${isSelected ? "; selected; select again to clear" : ""}`}', source)

    def test_maybe_is_presented_consistently_with_readable_unselected_colours(self) -> None:
        source = SOURCE.read_text(encoding="utf-8")

        self.assertIn('if (status === "MAYBE") return "maybe";', source)
        self.assertIn('label="Maybe"', source)
        self.assertIn('MAYBE: { selected: "bg-warning', source)
        self.assertIn('default: "border-warning/70 bg-warning/10 text-foreground', source)


if __name__ == "__main__":
    unittest.main()
