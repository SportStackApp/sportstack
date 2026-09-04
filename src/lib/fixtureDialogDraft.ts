import {
  buildScopedDraftKey,
  loadScopedDraft,
  removeScopedDraft,
  saveScopedDraft,
  type DraftStorage,
} from "@/lib/scopedDraftStorage";

export const LEGACY_FIXTURE_DIALOG_KEY = "sportstack:fixtures:active-dialog";

export type FixtureDialogDraft =
  | { type: "add" }
  | { type: "edit" | "details"; fixtureId: string };

interface FixtureDialogScope {
  accountId: string;
  roleMode?: string | null;
  associationId?: string | null;
  clubId?: string | null;
  divisionId?: string | null;
  teamId?: string | null;
}

export function buildFixtureDialogDraftKey(scope: FixtureDialogScope): string {
  const scopeId = [scope.roleMode, scope.associationId, scope.clubId, scope.divisionId, scope.teamId]
    .map((value) => value || "all")
    .join("|");

  return buildScopedDraftKey({
    accountId: scope.accountId,
    scopeType: "admin-fixtures",
    scopeId,
    recordType: "active-dialog",
    recordId: "current",
  });
}

export function isFixtureDialogDraft(value: unknown): value is FixtureDialogDraft {
  if (!value || typeof value !== "object") return false;
  const draft = value as { type?: unknown; fixtureId?: unknown };
  if (draft.type === "add") return draft.fixtureId === undefined;
  return (draft.type === "edit" || draft.type === "details")
    && typeof draft.fixtureId === "string"
    && draft.fixtureId.length > 0;
}

export function saveFixtureDialogDraft(key: string, draft: FixtureDialogDraft, storage: DraftStorage) {
  return saveScopedDraft(key, draft, storage);
}

export function loadFixtureDialogDraft(key: string, storage: DraftStorage) {
  return loadScopedDraft(key, isFixtureDialogDraft, storage);
}

export function clearFixtureDialogDraft(key: string, storage: DraftStorage) {
  return removeScopedDraft(key, storage);
}

export function retireLegacyFixtureDialogDraft(storage: DraftStorage) {
  try {
    storage.removeItem(LEGACY_FIXTURE_DIALOG_KEY);
    return true;
  } catch {
    return false;
  }
}
