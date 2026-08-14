export type PlayerExplorerIdentityStatus =
  | "linked"
  | "placeholder"
  | "unlinked"
  | "identity_conflict";

export type PlayerExplorerNumericMetric =
  | "games_played"
  | "goals"
  | "green_cards"
  | "yellow_cards"
  | "red_cards";

export type PlayerExplorerMetric = PlayerExplorerNumericMetric | "played_in_round";
export type PlayerExplorerNumericOperator = "eq" | "gt" | "gte" | "lt" | "lte";
export type PlayerExplorerOperator = PlayerExplorerNumericOperator | "includes";

export interface PlayerExplorerCondition {
  metric: PlayerExplorerMetric;
  operator: PlayerExplorerOperator;
  value: number;
}

export interface PlayerExplorerQuery {
  scope: {
    seasonId: string | null;
    competitionId: string | null;
    associationId: string | null;
    clubId: string | null;
    divisionId: string | null;
    teamId: string | null;
  };
  window: {
    roundFrom: number | null;
    roundTo: number | null;
    dateFrom: string | null;
    dateTo: string | null;
  };
  conditions: PlayerExplorerCondition[];
  logic: "and";
}

export interface PlayerExplorerRecord {
  matchId: string;
  revsportsPlayerId: string;
  sourcePlayerName: string;
  profileId: string | null;
  displayName: string;
  identityStatus: PlayerExplorerIdentityStatus;
  teamId: string | null;
  teamName: string | null;
  clubId: string | null;
  associationId: string | null;
  divisionId: string | null;
  competitionId: string | null;
  seasonId: string | null;
  roundNumber: number | null;
  gameDate: string | null;
  goals: number;
  greenCards: number;
  yellowCards: number;
  redCards: number;
}

export interface PlayerExplorerResult {
  revsportsPlayerId: string;
  profileId: string | null;
  displayName: string;
  sourcePlayerName: string;
  identityStatus: PlayerExplorerIdentityStatus;
  teamNames: string[];
  gamesPlayed: number;
  goals: number;
  greenCards: number;
  yellowCards: number;
  redCards: number;
  roundsPlayed: number[];
  latestGameDate: string | null;
}

export interface PlayerExplorerProfile {
  id: string;
  firstName: string | null;
  lastName: string | null;
  isPlaceholder: boolean;
}

export const PLAYER_EXPLORER_METRIC_LABELS: Record<PlayerExplorerMetric, string> = {
  played_in_round: "Played in round",
  games_played: "Games played",
  goals: "Goals",
  green_cards: "Green cards",
  yellow_cards: "Yellow cards",
  red_cards: "Red cards",
};

export const PLAYER_EXPLORER_OPERATOR_LABELS: Record<PlayerExplorerOperator, string> = {
  includes: "includes",
  eq: "equals",
  gt: "more than",
  gte: "at least",
  lt: "less than",
  lte: "at most",
};

export const EMPTY_PLAYER_EXPLORER_QUERY: PlayerExplorerQuery = {
  scope: {
    seasonId: null,
    competitionId: null,
    associationId: null,
    clubId: null,
    divisionId: null,
    teamId: null,
  },
  window: {
    roundFrom: null,
    roundTo: null,
    dateFrom: null,
    dateTo: null,
  },
  conditions: [],
  logic: "and",
};

export const cloneEmptyPlayerExplorerQuery = (): PlayerExplorerQuery => ({
  scope: { ...EMPTY_PLAYER_EXPLORER_QUERY.scope },
  window: { ...EMPTY_PLAYER_EXPLORER_QUERY.window },
  conditions: [],
  logic: "and",
});

export const resolvePlayerExplorerIdentity = ({
  revsportsPlayerId,
  sourcePlayerName,
  directProfileId,
  externalProfileId,
  profilesById,
}: {
  revsportsPlayerId: string;
  sourcePlayerName: string;
  directProfileId: string | null;
  externalProfileId: string | null;
  profilesById: Map<string, PlayerExplorerProfile>;
}) => {
  if (directProfileId && externalProfileId && directProfileId !== externalProfileId) {
    return {
      profileId: null,
      displayName: sourcePlayerName || revsportsPlayerId,
      identityStatus: "identity_conflict" as const,
    };
  }

  const profileId = directProfileId || externalProfileId;
  if (!profileId) {
    return {
      profileId: null,
      displayName: sourcePlayerName || revsportsPlayerId,
      identityStatus: "unlinked" as const,
    };
  }

  const profile = profilesById.get(profileId);
  if (!profile) {
    return {
      profileId: null,
      displayName: sourcePlayerName || revsportsPlayerId,
      identityStatus: "identity_conflict" as const,
    };
  }

  const profileName = [profile.firstName, profile.lastName].filter(Boolean).join(" ").trim();
  return {
    profileId,
    displayName: profileName || sourcePlayerName || revsportsPlayerId,
    identityStatus: profile.isPlaceholder ? ("placeholder" as const) : ("linked" as const),
  };
};

const matchesOptionalId = (selectedId: string | null, recordId: string | null) =>
  !selectedId || selectedId === recordId;

export const recordMatchesPlayerExplorerQuery = (
  record: PlayerExplorerRecord,
  query: PlayerExplorerQuery,
) => {
  const { scope, window } = query;
  if (!matchesOptionalId(scope.seasonId, record.seasonId)) return false;
  if (!matchesOptionalId(scope.competitionId, record.competitionId)) return false;
  if (!matchesOptionalId(scope.associationId, record.associationId)) return false;
  if (!matchesOptionalId(scope.clubId, record.clubId)) return false;
  if (!matchesOptionalId(scope.divisionId, record.divisionId)) return false;
  if (!matchesOptionalId(scope.teamId, record.teamId)) return false;

  if (window.roundFrom !== null && (record.roundNumber === null || record.roundNumber < window.roundFrom)) {
    return false;
  }
  if (window.roundTo !== null && (record.roundNumber === null || record.roundNumber > window.roundTo)) {
    return false;
  }
  if (window.dateFrom && (!record.gameDate || record.gameDate < window.dateFrom)) return false;
  if (window.dateTo && (!record.gameDate || record.gameDate > window.dateTo)) return false;

  return true;
};

const compareNumericValue = (
  actual: number,
  operator: PlayerExplorerOperator,
  expected: number,
) => {
  if (operator === "eq") return actual === expected;
  if (operator === "gt") return actual > expected;
  if (operator === "gte") return actual >= expected;
  if (operator === "lt") return actual < expected;
  if (operator === "lte") return actual <= expected;
  return false;
};

const resultMatchesCondition = (
  result: PlayerExplorerResult,
  condition: PlayerExplorerCondition,
) => {
  if (condition.metric === "played_in_round") {
    return condition.operator === "includes" && result.roundsPlayed.includes(condition.value);
  }

  const metricValue: Record<PlayerExplorerNumericMetric, number> = {
    games_played: result.gamesPlayed,
    goals: result.goals,
    green_cards: result.greenCards,
    yellow_cards: result.yellowCards,
    red_cards: result.redCards,
  };
  return compareNumericValue(metricValue[condition.metric], condition.operator, condition.value);
};

export const buildPlayerExplorerResults = (
  records: PlayerExplorerRecord[],
  query: PlayerExplorerQuery,
): PlayerExplorerResult[] => {
  const grouped = new Map<
    string,
    PlayerExplorerResult & { matchIds: Set<string>; teamNameSet: Set<string>; roundSet: Set<number> }
  >();

  for (const record of records) {
    if (!recordMatchesPlayerExplorerQuery(record, query)) continue;

    const existing = grouped.get(record.revsportsPlayerId);
    const result = existing || {
      revsportsPlayerId: record.revsportsPlayerId,
      profileId: record.profileId,
      displayName: record.displayName,
      sourcePlayerName: record.sourcePlayerName,
      identityStatus: record.identityStatus,
      teamNames: [],
      gamesPlayed: 0,
      goals: 0,
      greenCards: 0,
      yellowCards: 0,
      redCards: 0,
      roundsPlayed: [],
      latestGameDate: null,
      matchIds: new Set<string>(),
      teamNameSet: new Set<string>(),
      roundSet: new Set<number>(),
    };

    result.matchIds.add(record.matchId);
    if (record.teamName) result.teamNameSet.add(record.teamName);
    if (record.roundNumber !== null) result.roundSet.add(record.roundNumber);
    result.goals += record.goals;
    result.greenCards += record.greenCards;
    result.yellowCards += record.yellowCards;
    result.redCards += record.redCards;
    if (record.gameDate && (!result.latestGameDate || record.gameDate > result.latestGameDate)) {
      result.latestGameDate = record.gameDate;
    }

    grouped.set(record.revsportsPlayerId, result);
  }

  return [...grouped.values()]
    .map(({ matchIds, teamNameSet, roundSet, ...result }) => ({
      ...result,
      gamesPlayed: matchIds.size,
      teamNames: [...teamNameSet].sort((left, right) => left.localeCompare(right)),
      roundsPlayed: [...roundSet].sort((left, right) => left - right),
    }))
    .filter((result) => query.conditions.every((condition) => resultMatchesCondition(result, condition)))
    .sort((left, right) =>
      right.gamesPlayed - left.gamesPlayed || left.displayName.localeCompare(right.displayName),
    );
};
