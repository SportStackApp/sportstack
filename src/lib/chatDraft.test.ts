import { describe, expect, it } from "vitest";
import type { DraftStorage } from "@/lib/scopedDraftStorage";
import {
  buildChatDraftKey,
  clearChatDraft,
  clearChatDraftIfUnchanged,
  loadChatDraft,
  saveChatDraft,
  takeLegacyChatDraft,
  type ChatDraft,
} from "@/lib/chatDraft";

const createStorage = (): DraftStorage & { values: Map<string, string> } => {
  const values = new Map<string, string>();
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
    removeItem: (key) => { values.delete(key); },
  };
};

const structuredDraft: ChatDraft = {
  text: "@Alex Please check this",
  replyMessageId: "message-a",
  important: true,
  mentionedUserIds: ["member-a"],
};

describe("Chat drafts", () => {
  it("isolates channels and accounts", () => {
    expect(buildChatDraftKey("account-a", "channel-a")).not.toBe(buildChatDraftKey("account-a", "channel-b"));
    expect(buildChatDraftKey("account-a", "channel-a")).not.toBe(buildChatDraftKey("account-b", "channel-a"));
  });

  it("round-trips reply, Important and mention meaning", () => {
    const storage = createStorage();
    const key = buildChatDraftKey("account-a", "channel-a");
    saveChatDraft(key, structuredDraft, storage);
    expect(loadChatDraft(key, storage)).toEqual(structuredDraft);
  });

  it("clears only the exact channel draft", () => {
    const storage = createStorage();
    const firstKey = buildChatDraftKey("account-a", "channel-a");
    const secondKey = buildChatDraftKey("account-a", "channel-b");
    saveChatDraft(firstKey, structuredDraft, storage);
    saveChatDraft(secondKey, { ...structuredDraft, text: "Other" }, storage);
    clearChatDraft(firstKey, storage);
    expect(loadChatDraft(firstKey, storage)).toBeNull();
    expect(loadChatDraft(secondKey, storage)?.text).toBe("Other");
  });

  it("clears a successfully submitted draft when the persisted value is unchanged", () => {
    const storage = createStorage();
    const key = buildChatDraftKey("account-a", "channel-a");
    saveChatDraft(key, structuredDraft, storage);

    expect(clearChatDraftIfUnchanged(key, structuredDraft, storage)).toBe(true);
    expect(loadChatDraft(key, storage)).toBeNull();
  });

  it("preserves a newer same-channel draft written while the submitted message is pending", () => {
    const storage = createStorage();
    const key = buildChatDraftKey("account-a", "channel-a");
    const newerDraft = { ...structuredDraft, text: "Newer text from another tab" };
    saveChatDraft(key, newerDraft, storage);

    expect(clearChatDraftIfUnchanged(key, structuredDraft, storage)).toBe(false);
    expect(loadChatDraft(key, storage)).toEqual(newerDraft);
  });

  it("treats changed reply, Important and mention state as a newer draft", () => {
    const storage = createStorage();
    const key = buildChatDraftKey("account-a", "channel-a");
    const newerDraft: ChatDraft = {
      ...structuredDraft,
      replyMessageId: "message-b",
      important: false,
      mentionedUserIds: ["member-b"],
    };
    saveChatDraft(key, newerDraft, storage);

    expect(clearChatDraftIfUnchanged(key, structuredDraft, storage)).toBe(false);
    expect(loadChatDraft(key, storage)).toEqual(newerDraft);
  });

  it("retires a legacy text-only draft after taking its text", () => {
    const storage = createStorage();
    const legacyKey = "communication-draft:account-a:channel-a";
    storage.setItem(legacyKey, "Old draft");
    expect(takeLegacyChatDraft("account-a", "channel-a", storage)).toBe("Old draft");
    expect(storage.getItem(legacyKey)).toBeNull();
  });
});
