export function playerHistoryForCalendarYear<T extends { date: string }>(
  rows: readonly T[],
  year: number,
): T[] {
  return rows.filter((row) => new Date(row.date).getFullYear() === year);
}
