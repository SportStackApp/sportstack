import { describe, expect, it } from "vitest";
import {
  createDisciplineIntakeDraftEnvelope,
  disciplineIntakeDraftKey,
  isRestorableDisciplineIntakeDraft,
} from "./disciplineIntakeDraft";

describe("discipline intake draft", () => {
  it("separates drafts by signed-in person and association", () => {
    expect(disciplineIntakeDraftKey("person-1", "association-1"))
      .toBe("person-1:association-1");
  });

  it("restores a current version-one draft", () => {
    const now = new Date("2026-08-16T10:00:00.000Z");
    const draft = createDisciplineIntakeDraftEnvelope(
      { title: "Neutral incident title" },
      new Date("2026-08-16T09:55:00.000Z"),
    );
    expect(isRestorableDisciplineIntakeDraft(draft, now)).toBe(true);
  });

  it("does not restore a draft older than seven days", () => {
    const now = new Date("2026-08-16T10:00:00.000Z");
    const draft = createDisciplineIntakeDraftEnvelope(
      { title: "Old incident" },
      new Date("2026-08-08T09:59:59.000Z"),
    );
    expect(isRestorableDisciplineIntakeDraft(draft, now)).toBe(false);
  });
});
