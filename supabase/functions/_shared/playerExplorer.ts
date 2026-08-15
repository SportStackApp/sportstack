export type PlayerExplorerIdentityStatus =
  | "linked"
  | "placeholder"
  | "unlinked"
  | "identity_conflict";

export type PlayerExplorerEntityField =
  | "season"
  | "competition"
  | "association"
  | "club"
  | "division"
  | "team";

export type PlayerExplorerDimensionField =
  | PlayerExplorerEntityField
  | "round"
  | "game_date";

export type PlayerExplorerMeasureField =
  | "games_played"
  | "goals"
  | "green_cards"
  | "yellow_cards"
  | "red_cards";

export type PlayerExplorerFilterField = PlayerExplorerDimensionField | PlayerExplorerMeasureField;
export type PlayerExplorerFilterOperator = "eq" | "gt" | "gte" | "lt" | "lte" | "between";
export type PlayerExplorerFilterLogic = "and" | "or";

export interface PlayerExplorerFilterCondition {
  id: string;
  field: PlayerExplorerFilterField;
  operator: PlayerExplorerFilterOperator;
  value: string;
  toValue: string;
}

export interface PlayerExplorerFilterGroup {
  id: string;
  logic: PlayerExplorerFilterLogic;
  conditions: PlayerExplorerFilterCondition[];
}

export interface PlayerExplorerSequenceRule {
  id: string;
  firstDivisionId: string;
  firstMinimumGames: string;
  nextDivisionId: string;
  nextMinimumGames: string;
}

export interface PlayerExplorerFilterExpression {
  logic: PlayerExplorerFilterLogic;
  groups: PlayerExplorerFilterGroup[];
  sequences: PlayerExplorerSequenceRule[];
}

export interface PlayerExplorerFilterOption {
  value: string;
  label: string;
}

export type PlayerExplorerFilterOptions = Partial<
  Record<PlayerExplorerEntityField, PlayerExplorerFilterOption[]>
>;

export interface PlayerExplorerRecord {
  appearanceId: string;
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
  gameTime: string | null;
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

export const PLAYER_EXPLORER_FIELD_DEFINITIONS: Record<
  PlayerExplorerFilterField,
  { label: string; category: "Scope" | "Match" | "Player totals"; valueType: "entity" | "number" | "date" }
> = {
  season: { label: "Season", category: "Scope", valueType: "entity" },
  competition: { label: "Competition", category: "Scope", valueType: "entity" },
  association: { label: "Association", category: "Scope", valueType: "entity" },
  club: { label: "Club", category: "Scope", valueType: "entity" },
  division: { label: "Division / grade", category: "Scope", valueType: "entity" },
  team: { label: "Team", category: "Scope", valueType: "entity" },
  round: { label: "Round", category: "Match", valueType: "number" },
  game_date: { label: "Game date", category: "Match", valueType: "date" },
  games_played: { label: "Games played", category: "Player totals", valueType: "number" },
  goals: { label: "Goals", category: "Player totals", valueType: "number" },
  green_cards: { label: "Green cards", category: "Player totals", valueType: "number" },
  yellow_cards: { label: "Yellow cards", category: "Player totals", valueType: "number" },
  red_cards: { label: "Red cards", category: "Player totals", valueType: "number" },
};

export const PLAYER_EXPLORER_FIELDS = Object.keys(
  PLAYER_EXPLORER_FIELD_DEFINITIONS,
) as PlayerExplorerFilterField[];

let filterItemId = 0;

export const createPlayerExplorerCondition = (
  field: PlayerExplorerFilterField = "games_played",
  operator: PlayerExplorerFilterOperator = "gt",
  value = "",
  toValue = "",
): PlayerExplorerFilterCondition => ({
  id: `player-explorer-condition-${filterItemId += 1}`,
  field,
  operator,
  value,
  toValue,
});

export const createPlayerExplorerGroup = (
  conditions: PlayerExplorerFilterCondition[] = [],
  logic: PlayerExplorerFilterLogic = "and",
): PlayerExplorerFilterGroup => ({
  id: `player-explorer-group-${filterItemId += 1}`,
  logic,
  conditions,
});

export const createPlayerExplorerSequence = (): PlayerExplorerSequenceRule => ({
  id: `player-explorer-sequence-${filterItemId += 1}`,
  firstDivisionId: "",
  firstMinimumGames: "7",
  nextDivisionId: "",
  nextMinimumGames: "1",
});

export const createEmptyPlayerExplorerExpression = (): PlayerExplorerFilterExpression => ({
  logic: "and",
  groups: [createPlayerExplorerGroup()],
  sequences: [],
});

export const createPlayerExplorerExample = (): PlayerExplorerFilterExpression => ({
  logic: "and",
  groups: [createPlayerExplorerGroup([
    createPlayerExplorerCondition("round", "between", "1", "10"),
    createPlayerExplorerCondition("games_played", "gt", "10"),
    createPlayerExplorerCondition("goals", "gt", "3"),
    createPlayerExplorerCondition("green_cards", "eq", "0"),
    createPlayerExplorerCondition("yellow_cards", "eq", "0"),
    createPlayerExplorerCondition("red_cards", "eq", "0"),
  ])],
  sequences: [],
});

export const createPlayerExplorerMovementExample = (): PlayerExplorerFilterExpression => ({
  logic: "and",
  groups: [createPlayerExplorerGroup()],
  sequences: [createPlayerExplorerSequence()],
});

export const normalisePlayerExplorerExpression = (value: unknown): PlayerExplorerFilterExpression => {
  if (!value || typeof value !== "object") return createEmptyPlayerExplorerExpression();
  const candidate = value as Partial<PlayerExplorerFilterExpression>;
  const groups = Array.isArray(candidate.groups)
    ? candidate.groups.map((rawGroup, groupIndex) => {
      const group = rawGroup && typeof rawGroup === "object"
        ? rawGroup as Partial<PlayerExplorerFilterGroup>
        : {};
      const conditions = Array.isArray(group.conditions)
        ? group.conditions.map((rawCondition, conditionIndex) => {
          const condition = rawCondition && typeof rawCondition === "object"
            ? rawCondition as Partial<PlayerExplorerFilterCondition>
            : {};
          return {
            id: typeof condition.id === "string" ? condition.id : `saved-group-${groupIndex}-condition-${conditionIndex}`,
            field: (typeof condition.field === "string" ? condition.field : "") as PlayerExplorerFilterField,
            operator: (typeof condition.operator === "string" ? condition.operator : "") as PlayerExplorerFilterOperator,
            value: typeof condition.value === "string" ? condition.value : "",
            toValue: typeof condition.toValue === "string" ? condition.toValue : "",
          };
        })
        : [];
      return {
        id: typeof group.id === "string" ? group.id : `saved-group-${groupIndex}`,
        logic: group.logic === "or" ? "or" as const : "and" as const,
        conditions,
      };
    })
    : [createPlayerExplorerGroup()];
  const sequences = Array.isArray(candidate.sequences)
    ? candidate.sequences.map((rawSequence, sequenceIndex) => {
      const sequence = rawSequence && typeof rawSequence === "object"
        ? rawSequence as Partial<PlayerExplorerSequenceRule>
        : {};
      return {
        id: typeof sequence.id === "string" ? sequence.id : `saved-sequence-${sequenceIndex}`,
        firstDivisionId: typeof sequence.firstDivisionId === "string" ? sequence.firstDivisionId : "",
        firstMinimumGames: typeof sequence.firstMinimumGames === "string" ? sequence.firstMinimumGames : "",
        nextDivisionId: typeof sequence.nextDivisionId === "string" ? sequence.nextDivisionId : "",
        nextMinimumGames: typeof sequence.nextMinimumGames === "string" ? sequence.nextMinimumGames : "",
      };
    })
    : [];
  return {
    logic: candidate.logic === "or" ? "or" : "and",
    groups,
    sequences,
  };
};

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

const isMeasureField = (field: PlayerExplorerFilterField): field is PlayerExplorerMeasureField =>
  PLAYER_EXPLORER_FIELD_DEFINITIONS[field].category === "Player totals";

const compareValue = (
  actual: number | string | null,
  condition: PlayerExplorerFilterCondition,
) => {
  if (actual === null) return false;
  const definition = PLAYER_EXPLORER_FIELD_DEFINITIONS[condition.field];
  const expected = definition.valueType === "number" ? Number(condition.value) : condition.value;
  const upper = definition.valueType === "number" ? Number(condition.toValue) : condition.toValue;

  if (condition.operator === "eq") return actual === expected;
  if (condition.operator === "gt") return actual > expected;
  if (condition.operator === "gte") return actual >= expected;
  if (condition.operator === "lt") return actual < expected;
  if (condition.operator === "lte") return actual <= expected;
  return actual >= expected && actual <= upper;
};

const recordValue = (
  record: PlayerExplorerRecord,
  field: PlayerExplorerDimensionField,
): number | string | null => {
  const values: Record<PlayerExplorerDimensionField, number | string | null> = {
    season: record.seasonId,
    competition: record.competitionId,
    association: record.associationId,
    club: record.clubId,
    division: record.divisionId,
    team: record.teamId,
    round: record.roundNumber,
    game_date: record.gameDate,
  };
  return values[field];
};

const aggregateMeasure = (
  records: PlayerExplorerRecord[],
  field: PlayerExplorerMeasureField,
) => {
  if (field === "games_played") return new Set(records.map((record) => record.matchId)).size;
  return records.reduce((total, record) => {
    if (field === "goals") return total + record.goals;
    if (field === "green_cards") return total + record.greenCards;
    if (field === "yellow_cards") return total + record.yellowCards;
    return total + record.redCards;
  }, 0);
};

const uniqueRecords = (records: PlayerExplorerRecord[]) => [
  ...new Map(records.map((record) => [record.appearanceId, record])).values(),
];

const evaluateGroup = (
  playerRecords: PlayerExplorerRecord[],
  group: PlayerExplorerFilterGroup,
) => {
  if (group.conditions.length === 0) return playerRecords;

  if (group.logic === "and") {
    const dimensionConditions = group.conditions.filter((condition) => !isMeasureField(condition.field));
    const measureConditions = group.conditions.filter((condition) => isMeasureField(condition.field));
    const scopedRecords = playerRecords.filter((record) => dimensionConditions.every((condition) =>
      compareValue(recordValue(record, condition.field as PlayerExplorerDimensionField), condition),
    ));
    if (scopedRecords.length === 0) return [];
    const measuresPass = measureConditions.every((condition) =>
      compareValue(aggregateMeasure(scopedRecords, condition.field as PlayerExplorerMeasureField), condition),
    );
    return measuresPass ? scopedRecords : [];
  }

  const matches: PlayerExplorerRecord[] = [];
  for (const condition of group.conditions) {
    if (isMeasureField(condition.field)) {
      if (compareValue(aggregateMeasure(playerRecords, condition.field), condition)) {
        matches.push(...playerRecords);
      }
    } else {
      matches.push(...playerRecords.filter((record) =>
        compareValue(recordValue(record, condition.field), condition),
      ));
    }
  }
  return uniqueRecords(matches);
};

const compareMatchOrder = (left: PlayerExplorerRecord, right: PlayerExplorerRecord) => {
  const leftDate = left.gameDate || "";
  const rightDate = right.gameDate || "";
  if (leftDate !== rightDate) return leftDate.localeCompare(rightDate);
  const leftTime = left.gameTime || "";
  const rightTime = right.gameTime || "";
  if (leftTime !== rightTime) return leftTime.localeCompare(rightTime);
  return left.matchId.localeCompare(right.matchId);
};

const isStrictlyAfter = (candidate: PlayerExplorerRecord, milestone: PlayerExplorerRecord) => {
  if (!candidate.gameDate || !milestone.gameDate) return false;
  if (candidate.gameDate !== milestone.gameDate) return candidate.gameDate > milestone.gameDate;
  if (!candidate.gameTime || !milestone.gameTime) return false;
  return candidate.gameTime > milestone.gameTime;
};

const evaluateSequence = (
  playerRecords: PlayerExplorerRecord[],
  sequence: PlayerExplorerSequenceRule,
) => {
  const distinctMatches = [...new Map(
    playerRecords
      .filter((record) => record.gameDate)
      .sort(compareMatchOrder)
      .map((record) => [record.matchId, record]),
  ).values()];
  const firstMatches = distinctMatches.filter((record) => record.divisionId === sequence.firstDivisionId);
  const minimumFirst = Number(sequence.firstMinimumGames);
  if (firstMatches.length < minimumFirst) return [];

  const milestone = firstMatches[minimumFirst - 1];
  const nextMatches = distinctMatches.filter((record) =>
    record.divisionId === sequence.nextDivisionId && isStrictlyAfter(record, milestone),
  );
  if (nextMatches.length < Number(sequence.nextMinimumGames)) return [];

  const relevantMatchIds = new Set([
    ...firstMatches.map((record) => record.matchId),
    ...nextMatches.map((record) => record.matchId),
  ]);
  return playerRecords.filter((record) => relevantMatchIds.has(record.matchId));
};

export const validatePlayerExplorerExpression = (
  rawExpression: PlayerExplorerFilterExpression,
) => {
  const expression = normalisePlayerExplorerExpression(rawExpression);
  const totalConditions = expression.groups.reduce(
    (total, group) => total + group.conditions.length,
    0,
  );
  if (totalConditions > 0 && expression.groups.some((group) => group.conditions.length === 0)) {
    return "Remove the empty group or add a condition to it.";
  }

  for (const group of expression.groups) {
    for (const condition of group.conditions) {
      const definition = PLAYER_EXPLORER_FIELD_DEFINITIONS[condition.field];
      if (!definition) return "A saved filter uses a field that is no longer supported.";
      if (!condition.value.trim()) return `Enter a value for ${definition.label}.`;
      if (condition.operator === "between" && !condition.toValue.trim()) {
        return `Enter both From and To values for ${definition.label}.`;
      }
      if (definition.valueType === "entity" && condition.operator !== "eq") {
        return `${definition.label} only supports "is" in this version.`;
      }
      if (definition.valueType === "number") {
        const values = condition.operator === "between"
          ? [condition.value, condition.toValue]
          : [condition.value];
        if (values.some((value) => !Number.isInteger(Number(value)) || Number(value) < 0)) {
          return `${definition.label} must use whole numbers of zero or more.`;
        }
      }
      if (
        condition.operator === "between"
        && (definition.valueType === "number"
          ? Number(condition.value) > Number(condition.toValue)
          : condition.value > condition.toValue)
      ) {
        return `${definition.label} From value cannot be after its To value.`;
      }
    }
  }

  for (const sequence of expression.sequences) {
    if (!sequence.firstDivisionId || !sequence.nextDivisionId) {
      return "Choose both divisions in each sequence rule.";
    }
    if (sequence.firstDivisionId === sequence.nextDivisionId) {
      return "The first and next divisions in a sequence must be different.";
    }
    if (
      !Number.isInteger(Number(sequence.firstMinimumGames))
      || Number(sequence.firstMinimumGames) < 1
      || !Number.isInteger(Number(sequence.nextMinimumGames))
      || Number(sequence.nextMinimumGames) < 1
    ) {
      return "Sequence game counts must be whole numbers of one or more.";
    }
  }
  return null;
};

export const filterPlayerExplorerRecords = (
  records: PlayerExplorerRecord[],
  rawExpression: PlayerExplorerFilterExpression,
) => {
  const expression = normalisePlayerExplorerExpression(rawExpression);
  if (expression.groups.length === 0 && expression.sequences.length === 0) return records;
  const byPlayer = new Map<string, PlayerExplorerRecord[]>();
  for (const record of records) {
    const playerRecords = byPlayer.get(record.revsportsPlayerId) || [];
    playerRecords.push(record);
    byPlayer.set(record.revsportsPlayerId, playerRecords);
  }

  const filtered: PlayerExplorerRecord[] = [];
  for (const playerRecords of byPlayer.values()) {
    const groupMatches = expression.groups.map((group) => evaluateGroup(playerRecords, group));
    const groupsPass = expression.groups.length === 0
      || (expression.logic === "and"
        ? groupMatches.every((matches) => matches.length > 0)
        : groupMatches.some((matches) => matches.length > 0));
    if (!groupsPass) continue;

    const sequenceMatches = expression.sequences.map((sequence) => evaluateSequence(playerRecords, sequence));
    if (sequenceMatches.some((matches) => matches.length === 0)) continue;

    const matchedRecords = expression.sequences.length > 0
      ? sequenceMatches.flat()
      : groupMatches.flat();
    filtered.push(...uniqueRecords(matchedRecords));
  }
  return uniqueRecords(filtered);
};

export const aggregatePlayerExplorerRecords = (
  records: PlayerExplorerRecord[],
): PlayerExplorerResult[] => {
  const grouped = new Map<
    string,
    PlayerExplorerResult & { matchIds: Set<string>; teamNameSet: Set<string>; roundSet: Set<number> }
  >();

  for (const record of records) {
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
    .sort((left, right) =>
      right.gamesPlayed - left.gamesPlayed || left.displayName.localeCompare(right.displayName),
    );
};
