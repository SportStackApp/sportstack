import { describe, expect, it } from "vitest";
import {
  aggregatePlayerExplorerRecords,
  createEmptyPlayerExplorerExpression,
  createPlayerExplorerCondition,
  createPlayerExplorerGroup,
  filterPlayerExplorerRecords,
  resolvePlayerExplorerIdentity,
  validatePlayerExplorerExpression,
  type PlayerExplorerFilterExpression,
  type PlayerExplorerProfile,
  type PlayerExplorerRecord,
} from "./playerExplorer";

const baseRecord: PlayerExplorerRecord = {
  appearanceId: "appearance-1",
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

const expressionWith = (
  groups: PlayerExplorerFilterExpression["groups"],
  logic: PlayerExplorerFilterExpression["logic"] = "and",
): PlayerExplorerFilterExpression => ({ groups, logic });

describe("Player Explorer aggregation", () => {
  it("counts distinct matches while summing appearance statistics", () => {
    const records = [
      baseRecord,
      { ...baseRecord, appearanceId: "appearance-2", teamId: "team-2", teamName: "Fill-in team", goals: 1 },
      { ...baseRecord, appearanceId: "appearance-3", matchId: "match-2", roundNumber: 9, goals: 2 },
    ];

    expect(aggregatePlayerExplorerRecords(records)[0]).toMatchObject({
      gamesPlayed: 2,
      goals: 5,
      teamNames: ["Fill-in team", "Pumas"],
      roundsPlayed: [8, 9],
    });
  });

  it("calculates totals inside the dimensions of an AND group", () => {
    const records = [
      { ...baseRecord, appearanceId: "appearance-1", roundNumber: 1, goals: 2 },
      { ...baseRecord, appearanceId: "appearance-2", matchId: "match-2", roundNumber: 8, goals: 2 },
      { ...baseRecord, appearanceId: "appearance-3", matchId: "match-3", roundNumber: 11, goals: 10 },
    ];
    const expression = expressionWith([createPlayerExplorerGroup([
      createPlayerExplorerCondition("round", "between", "1", "10"),
      createPlayerExplorerCondition("goals", "gt", "3"),
    ])]);

    const filtered = filterPlayerExplorerRecords(records, expression);
    expect(filtered.map((record) => record.roundNumber)).toEqual([1, 8]);
    expect(aggregatePlayerExplorerRecords(filtered)[0]).toMatchObject({ gamesPlayed: 2, goals: 4 });
  });

  it("supports OR conditions inside a group", () => {
    const records = [
      baseRecord,
      { ...baseRecord, appearanceId: "appearance-2", matchId: "match-2", roundNumber: 9 },
      {
        ...baseRecord,
        appearanceId: "appearance-3",
        matchId: "match-3",
        revsportsPlayerId: "rev-player-2",
        roundNumber: 9,
        redCards: 1,
      },
    ];
    const expression = expressionWith([createPlayerExplorerGroup([
      createPlayerExplorerCondition("round", "eq", "8"),
      createPlayerExplorerCondition("red_cards", "gt", "0"),
    ], "or")]);

    expect(filterPlayerExplorerRecords(records, expression).map((record) => record.appearanceId)).toEqual([
      "appearance-1",
      "appearance-3",
    ]);
  });

  it("requires ALL groups and accepts ANY matching group", () => {
    const records = [
      baseRecord,
      {
        ...baseRecord,
        appearanceId: "appearance-2",
        matchId: "match-2",
        revsportsPlayerId: "rev-player-2",
        roundNumber: 9,
      },
      {
        ...baseRecord,
        appearanceId: "appearance-3",
        matchId: "match-3",
        revsportsPlayerId: "rev-player-3",
        teamId: "team-2",
        roundNumber: 8,
      },
    ];
    const groups = [
      createPlayerExplorerGroup([createPlayerExplorerCondition("team", "eq", "team-1")]),
      createPlayerExplorerGroup([createPlayerExplorerCondition("round", "eq", "8")]),
    ];

    expect(filterPlayerExplorerRecords(records, expressionWith(groups, "and")).map((record) => record.appearanceId)).toEqual([
      "appearance-1",
    ]);
    expect(filterPlayerExplorerRecords(records, expressionWith(groups, "or")).map((record) => record.appearanceId)).toEqual([
      "appearance-1",
      "appearance-2",
      "appearance-3",
    ]);
  });

  it("does not combine players who share the same name", () => {
    const expression = createEmptyPlayerExplorerExpression();
    const records = [
      baseRecord,
      {
        ...baseRecord,
        appearanceId: "appearance-2",
        revsportsPlayerId: "rev-player-2",
        profileId: "profile-2",
      },
    ];

    expect(aggregatePlayerExplorerRecords(filterPlayerExplorerRecords(records, expression))).toHaveLength(2);
  });

  it("validates both values for a between filter", () => {
    const expression = expressionWith([createPlayerExplorerGroup([
      createPlayerExplorerCondition("round", "between", "1", ""),
    ])]);
    expect(validatePlayerExplorerExpression(expression)).toContain("both From and To");
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
