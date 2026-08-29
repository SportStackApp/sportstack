import type { PlayerHistoryRecord } from "./playerHistory";

export function toggledAssessmentValue(
  current: number | null | undefined,
  selected: number,
): number | null {
  return current === selected ? null : selected;
}

export function cardHistoryRows(
  rows: readonly PlayerHistoryRecord[],
): PlayerHistoryRecord[] {
  return rows.filter((row) => row.greenCards + row.yellowCards + row.redCards > 0);
}
