import type { PitchPositionOverride } from "./lineupPlanner";

export interface LineupDraft {
  formationId: string;
  roster: Array<{ playerId: string; displayNickname: boolean }>;
  assignments: Record<string, string>;
  benchIds: string[];
  positionOverrides: Record<string, PitchPositionOverride>;
}

export const lineupEditorInstanceKey = (fixtureId: string, teamId: string) =>
  `${fixtureId}:${teamId}`;

export const shouldPersistLineupDraft = ({
  loading,
  loadError,
  hasUnsavedChanges,
}: {
  loading: boolean;
  loadError: boolean;
  hasUnsavedChanges: boolean;
}) => !loading && !loadError && hasUnsavedChanges;

const isStringRecord = (value: unknown): value is Record<string, string> =>
  typeof value === "object"
  && value !== null
  && !Array.isArray(value)
  && Object.values(value).every((item) => typeof item === "string");

const isOverrideRecord = (value: unknown): value is Record<string, PitchPositionOverride> =>
  typeof value === "object"
  && value !== null
  && !Array.isArray(value)
  && Object.values(value).every((item) => {
    if (typeof item !== "object" || item === null) return false;
    const override = item as Partial<PitchPositionOverride>;
    return Number.isFinite(override.xPercent) && Number.isFinite(override.yPercent);
  });

export const isLineupDraft = (value: unknown): value is LineupDraft => {
  if (typeof value !== "object" || value === null) return false;
  const draft = value as Partial<LineupDraft>;
  return typeof draft.formationId === "string"
    && Array.isArray(draft.roster)
    && draft.roster.every((item) => (
      typeof item === "object"
      && item !== null
      && typeof item.playerId === "string"
      && typeof item.displayNickname === "boolean"
    ))
    && isStringRecord(draft.assignments)
    && Array.isArray(draft.benchIds)
    && draft.benchIds.every((id) => typeof id === "string")
    && isOverrideRecord(draft.positionOverrides);
};

export const normaliseLineupDraft = (draft: LineupDraft): LineupDraft => {
  const seenRoster = new Set<string>();
  const roster = draft.roster.filter(({ playerId }) => {
    if (!playerId || seenRoster.has(playerId)) return false;
    seenRoster.add(playerId);
    return true;
  });
  const rosterIds = new Set(roster.map(({ playerId }) => playerId));
  const usedPlayers = new Set<string>();
  const assignments = Object.fromEntries(
    Object.entries(draft.assignments).filter(([, playerId]) => {
      if (!rosterIds.has(playerId) || usedPlayers.has(playerId)) return false;
      usedPlayers.add(playerId);
      return true;
    }),
  );
  const benchIds = draft.benchIds.filter((playerId, index, all) => (
    rosterIds.has(playerId)
    && !usedPlayers.has(playerId)
    && all.indexOf(playerId) === index
  ));
  return { ...draft, roster, assignments, benchIds };
};

export const reconcileLineupDraftFormation = (
  draft: LineupDraft,
  availableFormationIds: string[],
  fallbackFormationId: string,
): LineupDraft => {
  if (availableFormationIds.includes(draft.formationId)) return draft;

  return normaliseLineupDraft({
    ...draft,
    formationId: fallbackFormationId,
    assignments: {},
    benchIds: draft.roster.map(({ playerId }) => playerId),
    positionOverrides: {},
  });
};

export const lineupDraftSignature = (draft: LineupDraft) => {
  const normalised = normaliseLineupDraft(draft);
  return JSON.stringify({
    ...normalised,
    assignments: Object.fromEntries(Object.entries(normalised.assignments).sort(([a], [b]) => a.localeCompare(b))),
    positionOverrides: Object.fromEntries(Object.entries(normalised.positionOverrides).sort(([a], [b]) => a.localeCompare(b))),
  });
};
