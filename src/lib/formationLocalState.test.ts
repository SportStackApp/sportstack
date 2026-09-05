import { describe, expect, it } from "vitest";
import { formationDraftKey, templateDraftKey, templateQuickPicksKey } from "./formationLocalState";

describe("formation local-state keys", () => {
  const base = {
    accountId: "user-1",
    ownerScope: "TEAM",
    ownerId: "team-1",
    draftId: "formation-1",
  };

  it("separates accounts, owner scopes and records", () => {
    const key = formationDraftKey(base);
    expect(key).not.toBe(formationDraftKey({ ...base, accountId: "user-2" }));
    expect(key).not.toBe(formationDraftKey({ ...base, ownerId: "team-2" }));
    expect(key).not.toBe(formationDraftKey({ ...base, draftId: "formation-2" }));
  });

  it("separates formation and template records", () => {
    expect(formationDraftKey(base)).not.toBe(templateDraftKey(base));
  });

  it("scopes quick picks to an account and template", () => {
    expect(templateQuickPicksKey("user-1", "template-1"))
      .not.toBe(templateQuickPicksKey("user-2", "template-1"));
  });
});
