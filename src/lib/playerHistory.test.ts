import { describe, expect, it } from "vitest";
import type { PlayerHistoryRecord } from "./playerHistory";
import { playerHistoryForCalendarYear } from "./playerHistoryFilters";

const historyRow = (id: string, date: string): PlayerHistoryRecord => ({
  id,
  fixtureId: null,
  date,
  teamName: "Pumas",
  clubName: "Grampians Hockey Club",
  associationName: "Hockey Ballarat",
  opponent: "Opponent",
  location: "Venue",
  result: "W 2-1",
  positionName: null,
  goals: 0,
  greenCards: 0,
  yellowCards: 0,
  redCards: 0,
});

describe("player history", () => {
  it("keeps every game from the fixture calendar year", () => {
    const rows = [
      historyRow("newest", "2026-08-23"),
      historyRow("older", "2026-04-12"),
      historyRow("prior-season", "2025-08-24"),
    ];

    expect(playerHistoryForCalendarYear(rows, 2026).map((row) => row.id)).toEqual([
      "newest",
      "older",
    ]);
  });
});
