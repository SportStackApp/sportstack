import { describe, expect, it } from "vitest";
import {
  buildScopedDraftKey,
  loadScopedDraft,
  removeScopedDraft,
  retirePreviousScopedDraftKey,
  saveScopedDraft,
  type DraftStorage,
} from "./scopedDraftStorage";

const memoryStorage = () => {
  const values = new Map<string, string>();
  const storage: DraftStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
    removeItem: (key) => { values.delete(key); },
  };
  return { storage, values };
};

const validTextDraft = (value: unknown): value is { text: string } =>
  typeof value === "object" && value !== null && typeof (value as { text?: unknown }).text === "string";

describe("scoped draft storage", () => {
  it("isolates account, scope and record identities", () => {
    const common = { scopeType: "team", scopeId: "team-1", recordType: "lineup", recordId: "fixture-1" };
    expect(buildScopedDraftKey({ ...common, accountId: "user-1" }))
      .not.toBe(buildScopedDraftKey({ ...common, accountId: "user-2" }));
    expect(buildScopedDraftKey({ ...common, accountId: "user-1" }))
      .not.toBe(buildScopedDraftKey({ ...common, accountId: "user-1", recordId: "fixture-2" }));
  });

  it("round-trips a valid draft and clears only its exact key", () => {
    const { storage, values } = memoryStorage();
    saveScopedDraft("one", { text: "first" }, storage, 1_000);
    saveScopedDraft("two", { text: "second" }, storage, 1_000);

    expect(loadScopedDraft("one", validTextDraft, storage, 1_100)).toEqual({ text: "first" });
    expect(removeScopedDraft("one", storage)).toBe(true);
    expect(values.has("one")).toBe(false);
    expect(values.has("two")).toBe(true);
  });

  it("rejects and removes malformed, invalid and expired drafts", () => {
    const { storage, values } = memoryStorage();
    values.set("malformed", "not-json");
    values.set("invalid", JSON.stringify({ version: 1, savedAt: 1_000, value: { nope: true } }));
    values.set("expired", JSON.stringify({ version: 1, savedAt: 1_000, value: { text: "old" } }));

    expect(loadScopedDraft("malformed", validTextDraft, storage, 1_100)).toBeNull();
    expect(loadScopedDraft("invalid", validTextDraft, storage, 1_100)).toBeNull();
    expect(loadScopedDraft("expired", validTextDraft, storage, 10_000, 1_000)).toBeNull();
    expect(values.size).toBe(0);
  });

  it("retires the old owner or record key without clearing the new draft", () => {
    const { storage, values } = memoryStorage();
    saveScopedDraft("old-scope", { text: "old" }, storage);
    saveScopedDraft("new-scope", { text: "new" }, storage);

    expect(retirePreviousScopedDraftKey("old-scope", "new-scope", storage)).toBe("new-scope");
    expect(values.has("old-scope")).toBe(false);
    expect(values.has("new-scope")).toBe(true);
  });

  it("fails safely when browser storage is unavailable", () => {
    const blocked: DraftStorage = {
      getItem: () => { throw new Error("blocked"); },
      setItem: () => { throw new Error("blocked"); },
      removeItem: () => { throw new Error("blocked"); },
    };
    expect(saveScopedDraft("draft", { text: "work" }, blocked)).toBe(false);
    expect(loadScopedDraft("draft", validTextDraft, blocked)).toBeNull();
    expect(removeScopedDraft("draft", blocked)).toBe(false);
  });
});
