export interface LadderTeam {
  id: string;
  name: string;
  club_id?: string | null;
}

export interface LadderFixture {
  id: string;
  home_team_id: string | null;
  away_team_id: string | null;
  home_score: number | null;
  away_score: number | null;
  status: string | null;
  fixture_date?: string | null;
}

export interface LadderRow {
  teamId: string;
  teamName: string;
  clubId?: string | null;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  pointsPerGame: number;
  position: number;
}

const isCompletedFixture = (fixture: LadderFixture) =>
  fixture.status?.toUpperCase() === "COMPLETED" &&
  fixture.home_team_id &&
  fixture.away_team_id &&
  fixture.home_score !== null &&
  fixture.away_score !== null;

const applyResult = (row: LadderRow, goalsFor: number, goalsAgainst: number) => {
  row.played += 1;
  row.goalsFor += goalsFor;
  row.goalsAgainst += goalsAgainst;
  row.goalDifference = row.goalsFor - row.goalsAgainst;

  if (goalsFor > goalsAgainst) {
    row.wins += 1;
    row.points += 3;
  } else if (goalsFor === goalsAgainst) {
    row.draws += 1;
    row.points += 1;
  } else {
    row.losses += 1;
  }

  row.pointsPerGame = row.played > 0 ? row.points / row.played : 0;
};

const headToHeadScore = (teamId: string, otherTeamId: string, fixtures: LadderFixture[]) => {
  let points = 0;
  let awayGoals = 0;
  let lastResult = 0;

  fixtures
    .filter((fixture) => {
      if (!isCompletedFixture(fixture)) return false;
      const teams = [fixture.home_team_id, fixture.away_team_id];
      return teams.includes(teamId) && teams.includes(otherTeamId);
    })
    .sort((a, b) => new Date(a.fixture_date || 0).getTime() - new Date(b.fixture_date || 0).getTime())
    .forEach((fixture) => {
      const isHome = fixture.home_team_id === teamId;
      const goalsFor = isHome ? fixture.home_score || 0 : fixture.away_score || 0;
      const goalsAgainst = isHome ? fixture.away_score || 0 : fixture.home_score || 0;

      if (!isHome) awayGoals += goalsFor;
      if (goalsFor > goalsAgainst) {
        points += 3;
        lastResult = 1;
      } else if (goalsFor === goalsAgainst) {
        points += 1;
        lastResult = 0;
      } else {
        lastResult = -1;
      }
    });

  return { points, awayGoals, lastResult };
};

export const calculateLadder = (teams: LadderTeam[], fixtures: LadderFixture[]) => {
  const rows = new Map<string, LadderRow>();

  teams.forEach((team) => {
    rows.set(team.id, {
      teamId: team.id,
      teamName: team.name,
      clubId: team.club_id,
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDifference: 0,
      points: 0,
      pointsPerGame: 0,
      position: 0,
    });
  });

  fixtures.filter(isCompletedFixture).forEach((fixture) => {
    const home = rows.get(fixture.home_team_id || "");
    const away = rows.get(fixture.away_team_id || "");
    if (!home || !away) return;

    applyResult(home, fixture.home_score || 0, fixture.away_score || 0);
    applyResult(away, fixture.away_score || 0, fixture.home_score || 0);
  });

  const sorted = Array.from(rows.values()).sort((a, b) => {
    const basic =
      b.pointsPerGame - a.pointsPerGame ||
      b.points - a.points ||
      b.goalDifference - a.goalDifference ||
      b.goalsFor - a.goalsFor ||
      b.wins - a.wins;

    if (basic !== 0) return basic;

    const aHead = headToHeadScore(a.teamId, b.teamId, fixtures);
    const bHead = headToHeadScore(b.teamId, a.teamId, fixtures);

    return (
      bHead.points - aHead.points ||
      bHead.awayGoals - aHead.awayGoals ||
      bHead.lastResult - aHead.lastResult ||
      a.teamName.localeCompare(b.teamName)
    );
  });

  return sorted.map((row, index) => ({ ...row, position: index + 1 }));
};

export const getTeamLadderPosition = (ladder: LadderRow[], teamId: string) =>
  ladder.find((row) => row.teamId === teamId)?.position ?? null;
