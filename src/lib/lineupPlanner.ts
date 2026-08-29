import type { FormationPositionRow } from "./formationPlanner";
import { formatPitchPlayerName, type PersonNameParts } from "./profileNames";

export type PitchPositionOverride = { xPercent: number; yPercent: number };

export function clampPitchCoordinate(value: number): number {
  return Math.min(100, Math.max(0, Number(value.toFixed(3))));
}

export function displayedFormationPosition(
  position: FormationPositionRow,
  override?: PitchPositionOverride | null,
): FormationPositionRow {
  return override
    ? { ...position, x_percent: clampPitchCoordinate(override.xPercent), y_percent: clampPitchCoordinate(override.yPercent) }
    : position;
}

export function pitchPlayerLabel(
  person: PersonNameParts,
  displayNickname: boolean,
): string {
  return formatPitchPlayerName(person, displayNickname);
}

export function uniqueRosterIds(ids: readonly string[]): string[] {
  return Array.from(new Set(ids.filter(Boolean)));
}
