import { describe, expect, it } from "vitest";
import type { PlayerHistoryRecord } from "./playerHistory";
import { cardHistoryRows, toggledAssessmentValue } from "./coachingProfile";

const historyRow = (
  id: string,
  cards: Pick<PlayerHistoryRecord, "greenCards" | "yellowCards" | "redCards">,
): PlayerHistoryRecord => ({
  id,
  fixtureId: null,
  date: "2026-08-23",
  teamName: "Pumas",
  clubName: "Grampians Hockey Club",
  associationName: "Hockey Ballarat",
  opponent: "Opponent",
  location: "Venue",
  result: "W 2-1",
  positionName: null,
  goals: 0,
  ...cards,
});

describe("coaching player profile", () => {
  it("clears an active rating when it is selected again", () => {
    expect(toggledAssessmentValue(2, 2)).toBeNull();
    expect(toggledAssessmentValue(null, 2)).toBe(2);
    expect(toggledAssessmentValue(1, 2)).toBe(2);
  });

  it("keeps only games that contain a recorded card", () => {
    const rows = [
      historyRow("green", { greenCards: 1, yellowCards: 0, redCards: 0 }),
      historyRow("none", { greenCards: 0, yellowCards: 0, redCards: 0 }),
      historyRow("red", { greenCards: 0, yellowCards: 0, redCards: 1 }),
    ];

    expect(cardHistoryRows(rows).map((row) => row.id)).toEqual(["green", "red"]);
  });
});
