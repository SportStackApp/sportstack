import { describe, expect, it } from "vitest";
import type { DraftStorage } from "@/lib/scopedDraftStorage";
import {
  buildUmpireBallotDraftKey,
  clearUmpireBallotDraft,
  isMeaningfulUmpireBallotDraft,
  loadUmpireBallotDraft,
  retireLegacyUmpireBallotDraft,
  saveUmpireBallotDraft,
  type UmpireBallotDraft,
} from "@/lib/umpireBallotDraft";

const createStorage = (): DraftStorage & { values: Map<string, string> } => {
  const values = new Map<string, string>();
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
    removeItem: (key) => { values.delete(key); },
  };
};

const draft = (fixtureId: string): UmpireBallotDraft => ({
  step: 2,
  isProxy: false,
  proxyUmpireName: "",
  proxyUmpireProfileId: null,
  proxyReason: "",
  selectedAssociationId: "association-a",
  selectedRound: "4",
  selectedDivisionId: "division-a",
  selectedFixtureId: fixtureId,
  selectedSchemeKey: "classic_3_2_1",
  voteCards: [],
  numberOnlyAcknowledged: false,
});

describe("Umpire ballot drafts", () => {
  it("keeps each account on a separate key", () => {
    expect(buildUmpireBallotDraftKey("account-a")).not.toBe(buildUmpireBallotDraftKey("account-b"));
  });

  it("restores the same ballot after a refresh in the same tab", () => {
    const storage = createStorage();
    saveUmpireBallotDraft(buildUmpireBallotDraftKey("account-a"), draft("fixture-a"), storage);
    expect(loadUmpireBallotDraft(buildUmpireBallotDraftKey("account-a"), storage)).toEqual(draft("fixture-a"));
  });

  it("keeps edits and resets independent when a duplicated tab starts with the same snapshot", () => {
    const firstTab = createStorage();
    const secondTab = createStorage();
    const key = buildUmpireBallotDraftKey("account-a");
    saveUmpireBallotDraft(key, draft("fixture-a"), firstTab);
    for (const [storedKey, value] of firstTab.values) secondTab.setItem(storedKey, value);

    saveUmpireBallotDraft(key, draft("fixture-b"), secondTab);
    expect(loadUmpireBallotDraft(key, firstTab)?.selectedFixtureId).toBe("fixture-a");
    clearUmpireBallotDraft(key, firstTab);
    expect(loadUmpireBallotDraft(key, firstTab)).toBeNull();
    expect(loadUmpireBallotDraft(key, secondTab)?.selectedFixtureId).toBe("fixture-b");
  });

  it("does not persist a blank ballot with only an automatically selected association", () => {
    const emptyDraft = { ...draft(""), step: 1 as const, selectedRound: "", selectedDivisionId: "", selectedAssociationId: "association-a" };
    expect(isMeaningfulUmpireBallotDraft(emptyDraft)).toBe(false);
    expect(isMeaningfulUmpireBallotDraft({ ...emptyDraft, selectedRound: "4" })).toBe(true);
  });

  it("does not let one account overwrite or clear another in the same tab", () => {
    const storage = createStorage();
    const firstKey = buildUmpireBallotDraftKey("account-a");
    const secondKey = buildUmpireBallotDraftKey("account-b");
    saveUmpireBallotDraft(firstKey, draft("fixture-a"), storage);
    saveUmpireBallotDraft(secondKey, draft("fixture-b"), storage);
    clearUmpireBallotDraft(firstKey, storage);
    expect(loadUmpireBallotDraft(firstKey, storage)).toBeNull();
    expect(loadUmpireBallotDraft(secondKey, storage)?.selectedFixtureId).toBe("fixture-b");
  });

  it("rejects malformed drafts and retires the old account-only key", () => {
    const storage = createStorage();
    const key = buildUmpireBallotDraftKey("account-a");
    storage.setItem(key, JSON.stringify({ version: 1, savedAt: Date.now(), value: { selectedFixtureId: "fixture-a" } }));
    expect(loadUmpireBallotDraft(key, storage)).toBeNull();

    storage.setItem("sportstack:umpire-ballot:account-a", "legacy");
    expect(retireLegacyUmpireBallotDraft("account-a", storage)).toBe(true);
    expect(storage.getItem("sportstack:umpire-ballot:account-a")).toBeNull();
  });
});
