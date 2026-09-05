const DRAFT_PREFIX = "sportstack:draft:v1";
export const DEFAULT_DRAFT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export interface ScopedDraftKeyParts {
  accountId: string;
  scopeType: string;
  scopeId: string;
  recordType: string;
  recordId: string;
}

interface DraftEnvelope<T> {
  version: 1;
  savedAt: number;
  value: T;
}

export interface DraftStorage {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}

const encode = (value: string) => encodeURIComponent(value.trim() || "__none__");

export const buildScopedDraftKey = (parts: ScopedDraftKeyParts) => [
  DRAFT_PREFIX,
  encode(parts.accountId),
  encode(parts.scopeType),
  encode(parts.scopeId),
  encode(parts.recordType),
  encode(parts.recordId),
].join(":");

const browserStorage = (): DraftStorage | null =>
  typeof window === "undefined" ? null : window.localStorage;

export function saveScopedDraft<T>(
  key: string,
  value: T,
  storage: DraftStorage | null = browserStorage(),
  now = Date.now(),
) {
  if (!storage) return false;
  try {
    const envelope: DraftEnvelope<T> = { version: 1, savedAt: now, value };
    storage.setItem(key, JSON.stringify(envelope));
    return true;
  } catch {
    return false;
  }
}

export function loadScopedDraft<T>(
  key: string,
  isValid: (value: unknown) => value is T,
  storage: DraftStorage | null = browserStorage(),
  now = Date.now(),
  maxAgeMs = DEFAULT_DRAFT_MAX_AGE_MS,
): T | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<DraftEnvelope<unknown>>;
    const validEnvelope = parsed.version === 1
      && typeof parsed.savedAt === "number"
      && parsed.savedAt <= now
      && now - parsed.savedAt <= maxAgeMs
      && isValid(parsed.value);
    if (!validEnvelope) {
      storage.removeItem(key);
      return null;
    }
    return parsed.value;
  } catch {
    try {
      storage.removeItem(key);
    } catch {
      // A blocked browser store should not stop the application.
    }
    return null;
  }
}

export function removeScopedDraft(
  key: string,
  storage: DraftStorage | null = browserStorage(),
) {
  if (!storage) return false;
  try {
    storage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

export function retirePreviousScopedDraftKey(
  previousKey: string,
  currentKey: string,
  storage: DraftStorage | null = browserStorage(),
) {
  if (previousKey !== currentKey) removeScopedDraft(previousKey, storage);
  return currentKey;
}
