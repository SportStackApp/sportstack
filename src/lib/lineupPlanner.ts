import type { FormationPositionRow } from "./formationPlanner";
import { formatPitchPlayerName, type PersonNameParts } from "./profileNames";

export type PitchPositionOverride = { xPercent: number; yPercent: number };
export type PitchBounds = { left: number; top: number; width: number; height: number };
export type PointerOffset = { x: number; y: number };
export type PitchOrientation = "landscape" | "portrait";

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

export function pitchPositionFromPointer(
  clientX: number,
  clientY: number,
  bounds: PitchBounds,
  offset: PointerOffset = { x: 0, y: 0 },
): PitchPositionOverride {
  return {
    xPercent: clampPitchCoordinate((((clientX - offset.x) - bounds.left) / bounds.width) * 100),
    yPercent: clampPitchCoordinate((((clientY - offset.y) - bounds.top) / bounds.height) * 100),
  };
}

export function pitchOrientationFromBounds(bounds: PitchBounds): PitchOrientation {
  return bounds.height > bounds.width ? "portrait" : "landscape";
}

export function orientedPitchPosition(
  position: PitchPositionOverride,
  orientation: PitchOrientation,
): PitchPositionOverride {
  return orientation === "portrait"
    ? { xPercent: position.yPercent, yPercent: 100 - position.xPercent }
    : position;
}

export function mobilePitchPosition(position: PitchPositionOverride): PitchPositionOverride {
  const oriented = orientedPitchPosition(position, "portrait");
  return {
    xPercent: Math.min(92, Math.max(8, oriented.xPercent)),
    yPercent: Math.min(90, Math.max(8, oriented.yPercent)),
  };
}

export function pitchPositionFromOrientedPointer(
  clientX: number,
  clientY: number,
  bounds: PitchBounds,
  offset: PointerOffset,
  orientation: PitchOrientation,
): PitchPositionOverride {
  const displayedPosition = pitchPositionFromPointer(clientX, clientY, bounds, offset);
  return orientation === "portrait"
    ? {
        xPercent: clampPitchCoordinate(100 - displayedPosition.yPercent),
        yPercent: clampPitchCoordinate(displayedPosition.xPercent),
      }
    : displayedPosition;
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

export function requiredRosterProfileIds(
  selectedIds: readonly string[],
  activeMembershipIds: readonly string[],
  previousFillInIds: readonly string[],
): string[] {
  return uniqueRosterIds([...activeMembershipIds, ...previousFillInIds, ...selectedIds]);
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
