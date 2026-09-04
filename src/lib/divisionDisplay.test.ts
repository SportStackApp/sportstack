import { describe, expect, it } from "vitest";
import { stableSortRows } from "@/lib/adminSorting";
import { formatDivisionAgeGroup } from "@/lib/divisionDisplay";

describe("formatDivisionAgeGroup", () => {
  it("keeps visible age bounds in the value used for sorting", () => {
    const rows = [
      { id: "older", age_group: "Junior", min_age: 12, max_age: 16 },
      { id: "younger", age_group: "Junior", min_age: 10, max_age: 14 },
    ];

    const sorted = stableSortRows(
      rows,
      { key: "ageGroup", direction: "asc" },
      (row) => formatDivisionAgeGroup(row),
    );

    expect(sorted.map((row) => row.id)).toEqual(["younger", "older"]);
    expect(formatDivisionAgeGroup(rows[0])).toBe("Junior (U16) (12+)");
  });

  it("shows a dash when no age group is set", () => {
    expect(formatDivisionAgeGroup({ age_group: null, min_age: null, max_age: null })).toBe("-");
  });
});
