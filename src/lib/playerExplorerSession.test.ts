import { describe, expect, it } from "vitest";
import { createEmptyPlayerExplorerExpression } from "@/lib/playerExplorer";
import {
  clearPlayerExplorerSessionState,
  getPlayerExplorerSessionStorageKey,
  readPlayerExplorerSessionState,
  writePlayerExplorerSessionState,
  type PlayerExplorerSessionState,
} from "@/lib/playerExplorerSession";

class MemoryStorage {
  private values = new Map<string, string>();
  get length() { return this.values.size; }
  getItem(key: string) { return this.values.get(key) || null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
  key(index: number) { return [...this.values.keys()][index] || null; }
}

const state = (): PlayerExplorerSessionState => ({
  expression: createEmptyPlayerExplorerExpression(),
  hasRun: true,
  results: [],
  matchedAppearanceCount: 12,
  matchedMatchCount: 4,
  resultSearch: "blaze",
  pageSize: 25,
  page: 2,
  sortKey: "goals",
  sortDirection: "desc",
});

describe("Player Explorer working-state persistence", () => {
  it("restores a valid scoped session", () => {
    const storage = new MemoryStorage();
    const key = getPlayerExplorerSessionStorageKey("user-1", "association:1");
    writePlayerExplorerSessionState(storage, key, state());

    expect(readPlayerExplorerSessionState(storage, key)).toMatchObject({
      hasRun: true,
      matchedAppearanceCount: 12,
      resultSearch: "blaze",
      page: 2,
      sortKey: "goals",
    });
  });

  it("ignores malformed stored state", () => {
    const storage = new MemoryStorage();
    storage.setItem("bad", "{not-json");
    expect(readPlayerExplorerSessionState(storage, "bad")).toBeNull();
  });

  it("clears only Player Explorer sessions at sign-out", () => {
    const storage = new MemoryStorage();
    storage.setItem(getPlayerExplorerSessionStorageKey("user-1", "scope-1"), "one");
    storage.setItem(getPlayerExplorerSessionStorageKey("user-2", "scope-2"), "two");
    storage.setItem("another-feature", "keep");

    clearPlayerExplorerSessionState(storage);

    expect(storage.length).toBe(1);
    expect(storage.getItem("another-feature")).toBe("keep");
  });
});
