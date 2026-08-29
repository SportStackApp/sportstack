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

export function mergeRosterProfileRows<T extends { id: string }>(
  eligibleRows: readonly T[],
  selectedRows: readonly T[],
): T[] {
  const rowsById = new Map<string, T>();

  // Keep the normal roster order, then append any saved selections that are
  // deliberately outside the normal candidate filter, such as placeholders.
  [...eligibleRows, ...selectedRows].forEach((row) => {
    if (!rowsById.has(row.id)) rowsById.set(row.id, row);
  });

  return Array.from(rowsById.values());
}

export function missingRosterProfileIds<T extends { id: string }>(
  selectedIds: readonly string[],
  loadedRows: readonly T[],
): string[] {
  const loadedIds = new Set(loadedRows.map((row) => row.id));
  return uniqueRosterIds(selectedIds).filter((id) => !loadedIds.has(id));
}
