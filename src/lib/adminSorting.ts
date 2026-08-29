export type SortDirection = "asc" | "desc";

export interface SortState<Key extends string = string> {
  key: Key;
  direction: SortDirection;
}

export function nextSortState<Key extends string>(current: SortState<Key> | null, key: Key): SortState<Key> {
  return current?.key === key
    ? { key, direction: current.direction === "asc" ? "desc" : "asc" }
    : { key, direction: "asc" };
}

function compareValues(left: unknown, right: unknown): number {
  if (left == null && right == null) return 0;
  if (left == null) return 1;
  if (right == null) return -1;
  if (typeof left === "number" && typeof right === "number") return left - right;
  if (left instanceof Date && right instanceof Date) return left.getTime() - right.getTime();
  return String(left).localeCompare(String(right), "en-AU", { numeric: true, sensitivity: "base" });
}

/** Stable sorting helper used by complete, in-memory admin result sets. */
export function stableSortRows<Row, Key extends string>(
  rows: readonly Row[],
  state: SortState<Key>,
  getValue: (row: Row, key: Key) => unknown,
): Row[] {
  const multiplier = state.direction === "asc" ? 1 : -1;
  return rows
    .map((row, index) => ({ row, index }))
    .sort((left, right) => {
      const compared = compareValues(getValue(left.row, state.key), getValue(right.row, state.key));
      return compared === 0 ? left.index - right.index : compared * multiplier;
    })
    .map(({ row }) => row);
}
