interface FixtureTeamName {
  name: string;
}

interface FixtureDisplayInput {
  fixtureDate: string | null;
  status: string;
  homeTeam: FixtureTeamName | null;
  awayTeam: FixtureTeamName | null;
}

/** A fixture is a bye when exactly one side has no team. */
export const isByeFixtureDisplay = ({ homeTeam, awayTeam }: FixtureDisplayInput) =>
  Boolean(homeTeam) !== Boolean(awayTeam);

/** Use the same compact matchup wording everywhere a fixture is shown. */
export const getFixtureMatchupLabel = (fixture: FixtureDisplayInput) => {
  if (isByeFixtureDisplay(fixture)) {
    return `${fixture.homeTeam?.name ?? fixture.awayTeam?.name} — Bye`;
  }

  return `${fixture.homeTeam?.name ?? "Unknown"} vs ${fixture.awayTeam?.name ?? "Unknown"}`;
};

/** Past byes are complete for display purposes even when the imported row remains scheduled. */
export const getFixtureDisplayStatus = (fixture: FixtureDisplayInput) => {
  if (
    isByeFixtureDisplay(fixture) &&
    fixture.fixtureDate &&
    new Date(fixture.fixtureDate).getTime() < Date.now()
  ) {
    return "COMPLETED";
  }

  return fixture.status.toUpperCase();
};
