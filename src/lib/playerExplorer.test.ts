import { describe, expect, it } from "vitest";
import {
  buildPlayerExplorerResults,
  cloneEmptyPlayerExplorerQuery,
  resolvePlayerExplorerIdentity,
  type PlayerExplorerProfile,
  type PlayerExplorerRecord,
} from "./playerExplorer";

const baseRecord: PlayerExplorerRecord = {
  matchId: "match-1",
  revsportsPlayerId: "rev-player-1",
  sourcePlayerName: "Alex Player",
  profileId: "profile-1",
  displayName: "Alex Player",
  identityStatus: "linked",
  teamId: "team-1",
  teamName: "Pumas",
  clubId: "club-1",
  associationId: "association-1",
  divisionId: "division-1",
  competitionId: "competition-1",
  seasonId: "season-1",
  roundNumber: 8,
  gameDate: "2026-06-01",
  goals: 2,
  greenCards: 0,
  yellowCards: 0,
  redCards: 0,
};

describe("Player Explorer aggregation", () => {
  it("counts distinct matches while summing appearance statistics", () => {
    const query = cloneEmptyPlayerExplorerQuery();
    const records = [
      baseRecord,
      { ...baseRecord, teamId: "team-2", teamName: "Fill-in team", goals: 1 },
      { ...baseRecord, matchId: "match-2", roundNumber: 9, goals: 2 },
    ];

    expect(buildPlayerExplorerResults(records, query)[0]).toMatchObject({
      gamesPlayed: 2,
      goals: 5,
      teamNames: ["Fill-in team", "Pumas"],
      roundsPlayed: [8, 9],
    });
  });

  it("applies the scope, window and all conditions together", () => {
    const query = cloneEmptyPlayerExplorerQuery();
    query.scope.teamId = "team-1";
    query.window.roundFrom = 1;
    query.window.roundTo = 10;
    query.conditions = [
      { metric: "played_in_round", operator: "includes", value: 8 },
      { metric: "games_played", operator: "gte", value: 2 },
      { metric: "goals", operator: "gt", value: 3 },
      { metric: "green_cards", operator: "eq", value: 0 },
      { metric: "yellow_cards", operator: "eq", value: 0 },
      { metric: "red_cards", operator: "eq", value: 0 },
    ];

    const records = [
      baseRecord,
      { ...baseRecord, matchId: "match-2", roundNumber: 9, goals: 2 },
      { ...baseRecord, matchId: "match-3", roundNumber: 11, goals: 10 },
      { ...baseRecord, matchId: "match-4", teamId: "team-2", goals: 10 },
    ];

    expect(buildPlayerExplorerResults(records, query)).toHaveLength(1);
    expect(buildPlayerExplorerResults(records, query)[0]).toMatchObject({ gamesPlayed: 2, goals: 4 });
  });

  it("does not combine players who share the same name", () => {
    const query = cloneEmptyPlayerExplorerQuery();
    const results = buildPlayerExplorerResults(
      [baseRecord, { ...baseRecord, revsportsPlayerId: "rev-player-2", profileId: "profile-2" }],
      query,
    );

    expect(results).toHaveLength(2);
  });
});

describe("Player Explorer identity", () => {
  const profiles = new Map<string, PlayerExplorerProfile>([
    ["profile-1", { id: "profile-1", firstName: "Alex", lastName: "Player", isPlaceholder: false }],
    ["profile-2", { id: "profile-2", firstName: "Pat", lastName: "Placeholder", isPlaceholder: true }],
  ]);

  it("reports linked and placeholder profiles", () => {
    expect(resolvePlayerExplorerIdentity({
      revsportsPlayerId: "rev-player-1",
      sourcePlayerName: "A Player",
      directProfileId: "profile-1",
      externalProfileId: "profile-1",
      profilesById: profiles,
    })).toMatchObject({ displayName: "Alex Player", identityStatus: "linked" });

    expect(resolvePlayerExplorerIdentity({
      revsportsPlayerId: "rev-player-2",
      sourcePlayerName: "P Placeholder",
      directProfileId: null,
      externalProfileId: "profile-2",
      profilesById: profiles,
    })).toMatchObject({ identityStatus: "placeholder" });
  });

  it("flags conflicting identity paths instead of choosing one", () => {
    expect(resolvePlayerExplorerIdentity({
      revsportsPlayerId: "rev-player-1",
      sourcePlayerName: "Alex Player",
      directProfileId: "profile-1",
      externalProfileId: "profile-2",
      profilesById: profiles,
    })).toMatchObject({ profileId: null, identityStatus: "identity_conflict" });
  });
});
