import { describe, expect, it } from "vitest";
import {
  clampPitchCoordinate,
  displayedFormationPosition,
  mergeRosterProfileRows,
  missingRosterProfileIds,
  mobilePitchPosition,
  orientedPitchPosition,
  pitchOrientationFromBounds,
  pitchPositionFromOrientedPointer,
  pitchPositionFromPointer,
  pitchPlayerLabel,
  requiredRosterProfileIds,
  uniqueRosterIds,
} from "./lineupPlanner";

describe("line-up planner", () => {
  it("deduplicates selected roster players without changing their order", () => {
    expect(uniqueRosterIds(["one", "two", "one", "three"])).toEqual(["one", "two", "three"]);
  });

  it("keeps already-selected placeholder-linked profiles visible in the roster picker", () => {
    const eligible = [
      { id: "real-one", isPlaceholder: false },
      { id: "real-two", isPlaceholder: false },
    ];
    const selected = [
      { id: "real-two", isPlaceholder: false },
      { id: "selected-placeholder", isPlaceholder: true },
    ];

    expect(mergeRosterProfileRows(eligible, selected)).toEqual([
      { id: "real-one", isPlaceholder: false },
      { id: "real-two", isPlaceholder: false },
      { id: "selected-placeholder", isPlaceholder: true },
    ]);
  });

  it("loads active and previous fill-in placeholders as roster candidates", () => {
    expect(requiredRosterProfileIds(
      ["selected-placeholder"],
      ["active-real", "active-placeholder"],
      ["previous-fill-in", "active-placeholder"],
    )).toEqual(["active-real", "active-placeholder", "previous-fill-in", "selected-placeholder"]);
  });

  it("detects unresolved saved selections before roster changes are applied", () => {
    expect(missingRosterProfileIds(
      ["loaded", "missing", "missing"],
      [{ id: "loaded" }],
    )).toEqual(["missing"]);
  });

  it("clamps fixture-only marker movement to the pitch", () => {
    expect(clampPitchCoordinate(-4)).toBe(0);
    expect(clampPitchCoordinate(105)).toBe(100);
  });

  it("applies and resets a fixture-only marker override", () => {
    const position = { id: "p", formation_id: "f", name: "Left Half", code: "LH", icon_id: null, zone: null, grid_x: 1, grid_y: 1, x_percent: 25, y_percent: 30, sort_order: 1, is_starting_slot: true };
    expect(displayedFormationPosition(position, { xPercent: 40, yPercent: 45 })).toMatchObject({ x_percent: 40, y_percent: 45 });
    expect(displayedFormationPosition(position, null)).toMatchObject({ x_percent: 25, y_percent: 30 });
  });

  it("keeps the marker under the same grabbed point while it moves", () => {
    expect(pitchPositionFromPointer(
      180,
      260,
      { left: 100, top: 100, width: 400, height: 400 },
      { x: 20, y: -10 },
    )).toEqual({ xPercent: 15, yPercent: 42.5 });
  });

  it("rotates landscape formation positions for a portrait phone pitch", () => {
    expect(orientedPitchPosition({ xPercent: 20, yPercent: 35 }, "portrait"))
      .toEqual({ xPercent: 35, yPercent: 80 });
    expect(pitchOrientationFromBounds({ left: 0, top: 0, width: 390, height: 629 })).toBe("portrait");
  });

  it("keeps portrait markers and their labels inside the mobile pitch", () => {
    expect(mobilePitchPosition({ xPercent: 5, yPercent: 50 }))
      .toEqual({ xPercent: 50, yPercent: 90 });
    expect(mobilePitchPosition({ xPercent: 95, yPercent: 2 }))
      .toEqual({ xPercent: 8, yPercent: 8 });
  });

  it("converts portrait dragging back to canonical landscape coordinates", () => {
    expect(pitchPositionFromOrientedPointer(
      195,
      157.25,
      { left: 0, top: 0, width: 390, height: 629 },
      { x: 0, y: 0 },
      "portrait",
    )).toEqual({ xPercent: 75, yPercent: 50 });
  });

  it("uses nickname only when the fixture selection enables it", () => {
    const person = { firstName: "Hugh", lastName: "Cullen", nickname: "H" };
    expect(pitchPlayerLabel(person, false)).toBe("H. Cullen");
    expect(pitchPlayerLabel(person, true)).toBe("H");
  });

  console.log("line-up planner tests passed");
});
