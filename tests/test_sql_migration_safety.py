"""Regression tests for SQL migration definitions that block fixture imports."""

from __future__ import annotations

import re
import unittest
from pathlib import Path

MIGRATIONS_DIR = Path(__file__).parents[1] / "supabase" / "migrations"
FUNCTION_NAME = "private.mvp_initial_close_at"
FUNCTION_PATTERN = re.compile(
    rf"create\s+or\s+replace\s+function\s+{re.escape(FUNCTION_NAME)}\s*\([^)]*\).*?"
    r"as\s+\$function\$(.*?)\$function\$;",
    re.IGNORECASE | re.DOTALL,
)


def latest_function_body() -> tuple[Path, str]:
    definitions: list[tuple[Path, str]] = []
    for migration in sorted(MIGRATIONS_DIR.glob("*.sql")):
        sql = migration.read_text(encoding="utf-8")
        definitions.extend((migration, match.group(1)) for match in FUNCTION_PATTERN.finditer(sql))

    if not definitions:
        raise AssertionError(f"No migration defines {FUNCTION_NAME}")
    return definitions[-1]


class SqlMigrationSafetyTests(unittest.TestCase):
    def test_latest_mvp_close_function_uses_valid_greatest_expression(self) -> None:
        migration, body = latest_function_body()
        normalised = body.lower()

        self.assertNotIn(
            "pg_catalog.greatest",
            normalised,
            f"{migration.name} schema-qualifies GREATEST as though it were a function",
        )
        self.assertRegex(normalised, r"\bgreatest\s*\(")


if __name__ == "__main__":
    unittest.main()
