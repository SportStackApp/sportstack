import { describe, expect, it } from "vitest";
import { combineZonedDateTime, splitZonedDateTime } from "./timezoneDateTime";

describe("timezone date and time conversion", () => {
  it("round-trips a Melbourne fixture during standard time", () => {
    const storedValue = combineZonedDateTime(
      "2026-08-23",
      "12:15",
      "Australia/Melbourne",
    );

    expect(storedValue).toBe("2026-08-23T02:15:00.000Z");
    expect(splitZonedDateTime(storedValue, "Australia/Melbourne")).toEqual({
      fixture_date: "2026-08-23",
      game_time: "12:15",
    });
  });

  it("round-trips a Melbourne fixture during daylight-saving time", () => {
    const storedValue = combineZonedDateTime(
      "2026-12-06",
      "14:30",
      "Australia/Melbourne",
    );

    expect(storedValue).toBe("2026-12-06T03:30:00.000Z");
    expect(splitZonedDateTime(storedValue, "Australia/Melbourne")).toEqual({
      fixture_date: "2026-12-06",
      game_time: "14:30",
    });
  });
});
