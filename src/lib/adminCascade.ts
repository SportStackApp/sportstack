import { compareCompetitionNames, compareNames } from "@/lib/competitionOrder";

export const ALL_CASCADE_VALUE = "ALL";

export interface CascadeAssociation {
  id: string;
  name: string;
}

export interface CascadeClub {
  id: string;
  name: string;
  association_id: string;
}

export interface CascadeDivision {
  id: string;
  name: string;
  association_id: string;
}

export interface CascadeTeam {
  id: string;
  name: string;
  club_id: string;
  division_id: string | null;
}

export interface CascadeValue {
  associationId: string;
  clubId: string;
  divisionId: string;
  teamId: string;
}

export const emptyCascadeValue: CascadeValue = {
  associationId: ALL_CASCADE_VALUE,
  clubId: ALL_CASCADE_VALUE,
  divisionId: ALL_CASCADE_VALUE,
  teamId: ALL_CASCADE_VALUE,
};

interface CascadeOptionsInput {
  associations: CascadeAssociation[];
  clubs: CascadeClub[];
  divisions: CascadeDivision[];
  teams: CascadeTeam[];
  value: CascadeValue;
}

export const getCascadeOptions = ({
  associations,
  clubs,
  divisions,
  teams,
  value,
}: CascadeOptionsInput) => {
  const filteredClubs =
    value.associationId === ALL_CASCADE_VALUE
      ? []
      : clubs
          .filter((club) => club.association_id === value.associationId)
          .sort((left, right) => compareNames(left.name, right.name));

  const filteredDivisions =
    value.clubId === ALL_CASCADE_VALUE
      ? []
      : divisions
          .filter((division) =>
            teams.some((team) => team.club_id === value.clubId && team.division_id === division.id),
          )
          .sort((left, right) => compareCompetitionNames(left.name, right.name));

  const filteredTeams =
    value.clubId === ALL_CASCADE_VALUE || value.divisionId === ALL_CASCADE_VALUE
      ? []
      : teams
          .filter((team) => {
            if (team.division_id !== value.divisionId) return false;
            return team.club_id === value.clubId;
          })
          .sort((left, right) => compareNames(left.name, right.name));

  return {
    associations: [...associations].sort((left, right) => compareNames(left.name, right.name)),
    clubs: filteredClubs,
    divisions: filteredDivisions,
    teams: filteredTeams,
  };
};

export const getTeamNameLabel = (team: CascadeTeam | undefined) => team?.name || "Unknown team";

export const getTeamCascadeLabel = (
  team: CascadeTeam | undefined,
  clubs: CascadeClub[],
  divisions: CascadeDivision[],
) => {
  if (!team) return "Unknown team";
  const club = clubs.find((item) => item.id === team.club_id);
  const division = divisions.find((item) => item.id === team.division_id);
  return [club?.name, team.name, division?.name].filter(Boolean).join(" - ");
};
