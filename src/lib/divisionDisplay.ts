interface DivisionAgeGroupFields {
  age_group: string | null;
  min_age: number | null;
  max_age: number | null;
}

/** Keep the visible Age Group value and its alphabetical sort value identical. */
export function formatDivisionAgeGroup(division: DivisionAgeGroupFields): string {
  if (!division.age_group) return "-";

  const maximum = division.max_age ? ` (U${division.max_age})` : "";
  const minimum = division.min_age ? ` (${division.min_age}+)` : "";
  return `${division.age_group}${maximum}${minimum}`;
}
