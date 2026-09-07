import { describe, expect, it } from "vitest";

import { findPrimaryTeamForAssociation } from "./primaryTeamMemberships";

const primaryTeams = [
  { teamId: "team-a", teamName: "Pumas", associationId: "association-a" },
  { teamId: "team-b", teamName: "Kookaburras", associationId: "association-b" },
];

describe("association-scoped Primary teams", () => {
  it("finds the Primary team only within the selected association", () => {
    expect(findPrimaryTeamForAssociation(primaryTeams, "association-b")).toEqual(primaryTeams[1]);
  });

  it("does not treat another association's Primary as the current team", () => {
    expect(findPrimaryTeamForAssociation(primaryTeams, "association-c")).toBeUndefined();
  });
});
