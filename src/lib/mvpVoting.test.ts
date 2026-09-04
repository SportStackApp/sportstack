import { describe, expect, it } from "vitest";
import { filterEligibleMvpCandidates } from "./mvpVoting";

describe("filterEligibleMvpCandidates", () => {
  const voter = { rowId: "voter-row", profileId: "voter-profile", teamSide: "home" as const };

  it("keeps an attended teammate whose imported row has no linked profile", () => {
    const players = [
      { id: "unmatched-teammate", team_side: "home" as const, profile_id: null },
    ];

    expect(filterEligibleMvpCandidates(players, voter)).toEqual(players);
  });

  it("excludes the voter and players from the opposing side", () => {
    const eligible = filterEligibleMvpCandidates([
      { id: "voter-row", team_side: "home" as const, profile_id: "voter-profile" },
      { id: "duplicate-voter", team_side: "home" as const, profile_id: "voter-profile" },
      { id: "opponent", team_side: "away" as const, profile_id: "opponent-profile" },
      { id: "teammate", team_side: "home" as const, profile_id: "teammate-profile" },
    ], voter);

    expect(eligible).toEqual([
      { id: "teammate", team_side: "home", profile_id: "teammate-profile" },
    ]);
  });
});
