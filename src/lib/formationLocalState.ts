import {
  buildScopedDraftKey,
  loadScopedDraft,
  removeScopedDraft,
  saveScopedDraft,
} from "./scopedDraftStorage";

export type TemplateQuickPick = {
  id: string;
  code: string;
  name: string;
  iconId?: string | null;
  symbol?: string | null;
};

const PREFIX = "sportstack:formations";

export interface FormationDraftKeyParts {
  accountId: string;
  ownerScope: string;
  ownerId: string;
  draftId: string;
}

const scopedFormationKey = (recordType: string, parts: FormationDraftKeyParts) =>
  buildScopedDraftKey({
    accountId: parts.accountId,
    scopeType: parts.ownerScope,
    scopeId: parts.ownerId,
    recordType,
    recordId: parts.draftId || "new",
  });

export const formationDraftKey = (parts: FormationDraftKeyParts) =>
  scopedFormationKey("formation", parts);
export const templateDraftKey = (parts: FormationDraftKeyParts) =>
  scopedFormationKey("formation-template", parts);
export const templateQuickPicksKey = (accountId: string, templateId: string) =>
  buildScopedDraftKey({
    accountId,
    scopeType: "account",
    scopeId: accountId,
    recordType: "template-quick-picks",
    recordId: templateId || "new",
  });

export const loadDraftJson = <T>(key: string, isValid: (value: unknown) => value is T) =>
  loadScopedDraft<T>(key, isValid);
export const saveDraftJson = <T>(key: string, value: T) => saveScopedDraft(key, value);
export const clearDraftJson = (key: string) => removeScopedDraft(key);

export function clearLegacyFormationState(
  kind: "formation-draft" | "template-draft" | "template-quick-picks",
  recordId: string,
) {
  clearLocalJson(`${PREFIX}:${kind}:${recordId || "new"}`);
}

export function loadLocalJson<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : null;
  } catch {
    return null;
  }
}

export function saveLocalJson<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Local drafts are a convenience only. Saving the formation remains the source of truth.
  }
}

export function clearLocalJson(key: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Nothing to do.
  }
}

export function loadTemplateQuickPicks(accountId: string, templateId: string) {
  clearLegacyFormationState("template-quick-picks", templateId);
  return loadScopedDraft<TemplateQuickPick[]>(
    templateQuickPicksKey(accountId, templateId),
    (value): value is TemplateQuickPick[] => Array.isArray(value)
      && value.every((item) => typeof item === "object" && item !== null && typeof item.id === "string"),
  ) || [];
}

export function saveTemplateQuickPicks(accountId: string, templateId: string, quickPicks: TemplateQuickPick[]) {
  saveScopedDraft(templateQuickPicksKey(accountId, templateId), quickPicks);
}
