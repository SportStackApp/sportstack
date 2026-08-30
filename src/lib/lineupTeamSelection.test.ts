import { describe, expect, it } from "vitest";
import { chooseInitialLineupTeam, lineupTeamStorageKey } from "./lineupTeamSelection";

describe("line-up team selection", () => {
  const base = { visibleTeamIds: ["blaze", "pumas"], fallbackTeamId: "blaze" };

  it("restores the valid team chosen for this fixture", () => {
    expect(chooseInitialLineupTeam({ ...base, persistedTeamId: "pumas", selectedTeamId: "blaze" })).toBe("pumas");
  });

  it("ignores an inaccessible saved team", () => {
    expect(chooseInitialLineupTeam({ ...base, persistedTeamId: "other", selectedTeamId: "pumas" })).toBe("pumas");
  });

  it("uses the visible scoped team, then the safe fallback", () => {
    expect(chooseInitialLineupTeam({ ...base, selectedTeamId: "pumas" })).toBe("pumas");
    expect(chooseInitialLineupTeam({ visibleTeamIds: [], fallbackTeamId: "home" })).toBe("home");
  });

  it("keeps each user's fixture choice separate", () => {
    expect(lineupTeamStorageKey("user-one", "fixture-one")).toBe("sportstack:lineup-team:user-one:fixture-one");
  });
});
