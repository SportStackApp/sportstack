export type InitialLineupTeamOptions = {
  persistedTeamId?: string | null;
  selectedTeamId?: string | null;
  visibleTeamIds: readonly string[];
  fallbackTeamId: string;
};

export function lineupTeamStorageKey(userId: string | null | undefined, fixtureId: string): string {
  return `sportstack:lineup-team:${userId || "anonymous"}:${fixtureId}`;
}

export function chooseInitialLineupTeam({
  persistedTeamId,
  selectedTeamId,
  visibleTeamIds,
  fallbackTeamId,
}: InitialLineupTeamOptions): string {
  if (persistedTeamId && visibleTeamIds.includes(persistedTeamId)) return persistedTeamId;
  if (selectedTeamId && visibleTeamIds.includes(selectedTeamId)) return selectedTeamId;
  return visibleTeamIds[0] || fallbackTeamId;
}
