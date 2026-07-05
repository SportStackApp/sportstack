export type TemplateQuickPick = {
  id: string;
  code: string;
  name: string;
  iconId?: string | null;
  symbol?: string | null;
};

const PREFIX = "sportstack:formations";

export const formationDraftKey = (draftId: string) => `${PREFIX}:formation-draft:${draftId || "new"}`;
export const templateDraftKey = (draftId: string) => `${PREFIX}:template-draft:${draftId || "new"}`;
export const templateQuickPicksKey = (templateId: string) => `${PREFIX}:template-quick-picks:${templateId || "new"}`;

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

export function loadTemplateQuickPicks(templateId: string) {
  return loadLocalJson<TemplateQuickPick[]>(templateQuickPicksKey(templateId)) || [];
}

export function saveTemplateQuickPicks(templateId: string, quickPicks: TemplateQuickPick[]) {
  saveLocalJson(templateQuickPicksKey(templateId), quickPicks);
}
