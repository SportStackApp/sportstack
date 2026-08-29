import { describe, expect, it } from "vitest";
import { nextSortState, stableSortRows } from "./adminSorting";

describe("admin sorting", () => {
  const rows = [
    { id: "a", name: "Venue 10", date: "2026-08-20" },
    { id: "b", name: "venue 2", date: "2026-08-18" },
    { id: "c", name: "Venue 2", date: "2026-08-19" },
  ];

  it("starts ascending and toggles the same column", () => {
    const first = nextSortState(null, "name");
    expect(first).toEqual({ key: "name", direction: "asc" });
    expect(nextSortState(first, "name")).toEqual({ key: "name", direction: "desc" });
  });

  it("uses natural Australian text sorting and remains stable", () => {
    expect(stableSortRows(rows, { key: "name", direction: "asc" }, (row, key) => row[key]).map((row) => row.id))
      .toEqual(["b", "c", "a"]);
  });

  it("sorts ISO dates in both directions", () => {
    expect(stableSortRows(rows, { key: "date", direction: "desc" }, (row, key) => row[key]).map((row) => row.id))
      .toEqual(["a", "c", "b"]);
  });

  console.log("admin sorting tests passed");
});
