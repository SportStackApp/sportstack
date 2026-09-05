import { describe, expect, it } from "vitest";
import {
  buildFixtureDialogDraftKey,
  LEGACY_FIXTURE_DIALOG_KEY,
  loadFixtureDialogDraft,
  retireLegacyFixtureDialogDraft,
  saveFixtureDialogDraft,
} from "@/lib/fixtureDialogDraft";
import type { DraftStorage } from "@/lib/scopedDraftStorage";

const createStorage = (): DraftStorage & { values: Map<string, string> } => {
  const values = new Map<string, string>();
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
    removeItem: (key) => { values.delete(key); },
  };
};

describe("fixture dialog drafts", () => {
  it("isolates remembered dialogs by account and working scope", () => {
    const base = { accountId: "account-a", roleMode: "club", associationId: "association-a", clubId: "club-a", divisionId: "division-a", teamId: "team-a" };
    expect(buildFixtureDialogDraftKey(base)).not.toBe(buildFixtureDialogDraftKey({ ...base, accountId: "account-b" }));
    expect(buildFixtureDialogDraftKey(base)).not.toBe(buildFixtureDialogDraftKey({ ...base, roleMode: "team_manager" }));
    expect(buildFixtureDialogDraftKey(base)).not.toBe(buildFixtureDialogDraftKey({ ...base, teamId: "team-b" }));
  });

  it("round-trips non-destructive dialogs but rejects a legacy delete target", () => {
    const storage = createStorage();
    const key = buildFixtureDialogDraftKey({ accountId: "account-a", teamId: "team-a" });
    expect(saveFixtureDialogDraft(key, { type: "edit", fixtureId: "fixture-a" }, storage)).toBe(true);
    expect(loadFixtureDialogDraft(key, storage)).toEqual({ type: "edit", fixtureId: "fixture-a" });

    storage.setItem(key, JSON.stringify({ version: 1, savedAt: Date.now(), value: { type: "delete", fixtureId: "fixture-a" } }));
    expect(loadFixtureDialogDraft(key, storage)).toBeNull();
    expect(storage.getItem(key)).toBeNull();
  });

  it("retires the old browser-wide key without restoring it", () => {
    const storage = createStorage();
    storage.setItem(LEGACY_FIXTURE_DIALOG_KEY, JSON.stringify({ type: "delete", fixtureId: "fixture-a" }));
    expect(retireLegacyFixtureDialogDraft(storage)).toBe(true);
    expect(storage.getItem(LEGACY_FIXTURE_DIALOG_KEY)).toBeNull();
  });
});
