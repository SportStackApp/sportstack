import {
  normalisePlayerExplorerExpression,
  type PlayerExplorerFilterExpression,
  type PlayerExplorerResult,
} from "@/lib/playerExplorer";
import type {
  PlayerExplorerSortDirection,
  PlayerExplorerSortKey,
} from "@/lib/playerExplorerResults";

const STORAGE_PREFIX = "player-explorer-session:v1:";
const RESULT_PAGE_SIZES = [10, 25, 50] as const;
const SORT_KEYS: PlayerExplorerSortKey[] = [
  "displayName",
  "identityStatus",
  "teamNames",
  "gamesPlayed",
  "goals",
  "greenCards",
  "yellowCards",
  "redCards",
];

export interface PlayerExplorerSessionState {
  expression: PlayerExplorerFilterExpression;
  hasRun: boolean;
  results: PlayerExplorerResult[];
  matchedAppearanceCount: number;
  matchedMatchCount: number;
  resultSearch: string;
  pageSize: (typeof RESULT_PAGE_SIZES)[number];
  page: number;
  sortKey: PlayerExplorerSortKey;
  sortDirection: PlayerExplorerSortDirection;
}

interface StorageLike {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
  key: (index: number) => string | null;
  readonly length: number;
}

const isFiniteCount = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;

export const getPlayerExplorerSessionStorageKey = (userId: string, accessScopeKey: string) =>
  `${STORAGE_PREFIX}${encodeURIComponent(userId)}:${encodeURIComponent(accessScopeKey)}`;

export const readPlayerExplorerSessionState = (
  storage: Pick<StorageLike, "getItem">,
  key: string,
): PlayerExplorerSessionState | null => {
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<PlayerExplorerSessionState>;
    if (
      typeof value.hasRun !== "boolean"
      || !Array.isArray(value.results)
      || !isFiniteCount(value.matchedAppearanceCount)
      || !isFiniteCount(value.matchedMatchCount)
      || typeof value.resultSearch !== "string"
      || !RESULT_PAGE_SIZES.includes(value.pageSize as (typeof RESULT_PAGE_SIZES)[number])
      || !isFiniteCount(value.page)
      || !SORT_KEYS.includes(value.sortKey as PlayerExplorerSortKey)
      || (value.sortDirection !== "asc" && value.sortDirection !== "desc")
    ) return null;

    return {
      expression: normalisePlayerExplorerExpression(value.expression),
      hasRun: value.hasRun,
      results: value.results as PlayerExplorerResult[],
      matchedAppearanceCount: value.matchedAppearanceCount,
      matchedMatchCount: value.matchedMatchCount,
      resultSearch: value.resultSearch,
      pageSize: value.pageSize as (typeof RESULT_PAGE_SIZES)[number],
      page: Math.max(1, Math.floor(value.page)),
      sortKey: value.sortKey as PlayerExplorerSortKey,
      sortDirection: value.sortDirection,
    };
  } catch {
    return null;
  }
};

export const writePlayerExplorerSessionState = (
  storage: Pick<StorageLike, "setItem">,
  key: string,
  state: PlayerExplorerSessionState,
) => {
  try {
    storage.setItem(key, JSON.stringify(state));
  } catch {
    // A full or unavailable browser store must not stop the search itself.
  }
};

export const clearPlayerExplorerSessionState = (
  storage: Pick<StorageLike, "length" | "key" | "removeItem"> = window.sessionStorage,
) => {
  try {
    for (let index = storage.length - 1; index >= 0; index -= 1) {
      const key = storage.key(index);
      if (key?.startsWith(STORAGE_PREFIX)) storage.removeItem(key);
    }
  } catch {
    // Sign-out must continue even if browser storage is unavailable.
  }
};
