import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "src" / "pages" / "GameDetail.tsx"


class GameDetailAvailabilityTests(unittest.TestCase):
    def test_availability_styles_cover_the_generated_enum(self) -> None:
        source = SOURCE.read_text(encoding="utf-8")

        self.assertIn(
            "const variants: Record<AvailabilityStatus, { selected: string; default: string }>",
            source,
        )
        for status in ("AVAILABLE", "UNAVAILABLE", "MAYBE", "NO_RESPONSE"):
            self.assertIn(f"{status}: {{", source)

        self.assertNotIn("UNSURE: {", source)
        self.assertNotIn('"PENDING"', source)


if __name__ == "__main__":
    unittest.main()
