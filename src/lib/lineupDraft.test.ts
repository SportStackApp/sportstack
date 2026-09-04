import { describe, expect, it } from "vitest";
import {
  isLineupDraft,
  lineupEditorInstanceKey,
  lineupDraftSignature,
  normaliseLineupDraft,
  reconcileLineupDraftFormation,
  shouldPersistLineupDraft,
  type LineupDraft,
} from "./lineupDraft";

const draft = (): LineupDraft => ({
  formationId: "formation-1",
  roster: [
    { playerId: "player-1", displayNickname: true },
    { playerId: "player-2", displayNickname: false },
  ],
  assignments: { left: "player-1" },
  benchIds: ["player-2"],
  positionOverrides: { left: { xPercent: 22, yPercent: 44 } },
});

describe("line-up drafts", () => {
  it("validates and round-trips nickname and position choices", () => {
    const value = draft();
    expect(isLineupDraft(value)).toBe(true);
    expect(normaliseLineupDraft(value)).toEqual(value);
  });

  it("deduplicates roster, assignments and bench players", () => {
    const value = draft();
    value.roster.push({ playerId: "player-1", displayNickname: false });
    value.assignments.right = "player-1";
    value.benchIds = ["player-1", "player-2", "player-2", "missing"];

    expect(normaliseLineupDraft(value)).toMatchObject({
      roster: [
        { playerId: "player-1", displayNickname: true },
        { playerId: "player-2", displayNickname: false },
      ],
      assignments: { left: "player-1" },
      benchIds: ["player-2"],
    });
  });

  it("uses a stable signature for record maps", () => {
    const first = draft();
    const second = draft();
    second.assignments = { right: "player-2", left: "player-1" };
    first.assignments = { left: "player-1", right: "player-2" };
    expect(lineupDraftSignature(first)).toBe(lineupDraftSignature(second));
  });

  it("rejects an incomplete or malformed draft", () => {
    expect(isLineupDraft({ formationId: "formation-1" })).toBe(false);
    expect(isLineupDraft({ ...draft(), benchIds: [42] })).toBe(false);
  });

  it("moves players safely to the bench when a saved formation no longer exists", () => {
    expect(reconcileLineupDraftFormation(draft(), ["formation-2"], "formation-2")).toEqual({
      formationId: "formation-2",
      roster: draft().roster,
      assignments: {},
      benchIds: ["player-1", "player-2"],
      positionOverrides: {},
    });
  });

  it("uses a different editor instance for each team in the fixture", () => {
    expect(lineupEditorInstanceKey("fixture-1", "team-1"))
      .not.toBe(lineupEditorInstanceKey("fixture-1", "team-2"));
  });

  it("never overwrites a local draft after a server or roster load failure", () => {
    expect(shouldPersistLineupDraft({ loading: false, loadError: true, hasUnsavedChanges: true }))
      .toBe(false);
    expect(shouldPersistLineupDraft({ loading: false, loadError: false, hasUnsavedChanges: true }))
      .toBe(true);
  });
});
