import {
  buildScopedDraftKey,
  loadScopedDraft,
  removeScopedDraft,
  saveScopedDraft,
  type DraftStorage,
} from "@/lib/scopedDraftStorage";

export interface ChatDraft {
  text: string;
  replyMessageId: string | null;
  important: boolean;
  mentionedUserIds: string[];
}

export function buildChatDraftKey(accountId: string, channelId: string): string {
  return buildScopedDraftKey({
    accountId,
    scopeType: "communications",
    scopeId: channelId,
    recordType: "composer",
    recordId: "new-message",
  });
}

export function isChatDraft(value: unknown): value is ChatDraft {
  if (!value || typeof value !== "object") return false;
  const draft = value as Partial<ChatDraft>;
  return typeof draft.text === "string"
    && (draft.replyMessageId === null || typeof draft.replyMessageId === "string")
    && typeof draft.important === "boolean"
    && Array.isArray(draft.mentionedUserIds)
    && draft.mentionedUserIds.every((id) => typeof id === "string");
}

export function saveChatDraft(key: string, draft: ChatDraft, storage: DraftStorage) {
  return saveScopedDraft(key, draft, storage);
}

export function loadChatDraft(key: string, storage: DraftStorage) {
  return loadScopedDraft(key, isChatDraft, storage);
}

export function clearChatDraft(key: string, storage: DraftStorage) {
  return removeScopedDraft(key, storage);
}

export function getChatDraftFingerprint(draft: ChatDraft): string {
  return JSON.stringify({
    text: draft.text,
    replyMessageId: draft.replyMessageId,
    important: draft.important,
    mentionedUserIds: draft.mentionedUserIds,
  });
}

export function clearChatDraftIfUnchanged(
  key: string,
  expectedDraft: ChatDraft,
  storage: DraftStorage,
): boolean {
  const persistedDraft = loadChatDraft(key, storage);
  if (!persistedDraft) return false;
  if (getChatDraftFingerprint(persistedDraft) !== getChatDraftFingerprint(expectedDraft)) return false;
  return clearChatDraft(key, storage);
}

export function takeLegacyChatDraft(accountId: string, channelId: string, storage: DraftStorage) {
  const legacyKey = `communication-draft:${accountId}:${channelId}`;
  try {
    const text = storage.getItem(legacyKey);
    storage.removeItem(legacyKey);
    return text || null;
  } catch {
    return null;
  }
}
