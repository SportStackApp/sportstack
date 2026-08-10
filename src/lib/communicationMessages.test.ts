import { describe, expect, it } from "vitest";
import {
  hasOlderMessagePage,
  mergeLatestMessages,
  prependOlderMessages,
} from "./communicationMessages";

type TestMessage = { id: string; created_at: string; content: string };

const message = (number: number): TestMessage => ({
  id: `message-${String(number).padStart(2, "0")}`,
  created_at: new Date(Date.UTC(2026, 7, 9, 0, number)).toISOString(),
  content: `Message ${number}`,
});

describe("communication message pagination", () => {
  it("keeps the newest page in chronological order and refreshes existing rows", () => {
    const current = [message(49), message(50)];
    const refreshed = { ...message(50), content: "Edited message 50" };

    const merged = mergeLatestMessages(current, [message(51), refreshed], true);

    expect(merged.map((item) => item.id)).toEqual(["message-49", "message-50", "message-51"]);
    expect(merged[1].content).toBe("Edited message 50");
  });

  it("prepends an older batch without duplicates", () => {
    const newestFifty = Array.from({ length: 50 }, (_, index) => message(index + 2));
    const allMessages = prependOlderMessages(newestFifty, [message(1), message(2)]);

    expect(allMessages).toHaveLength(51);
    expect(allMessages[0].id).toBe("message-01");
    expect(allMessages.at(-1)?.id).toBe("message-51");
  });

  it("requests another page only after a full batch", () => {
    expect(hasOlderMessagePage(50, 50)).toBe(true);
    expect(hasOlderMessagePage(1, 50)).toBe(false);
  });
});
