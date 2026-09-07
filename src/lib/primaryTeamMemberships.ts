export interface AssociationPrimaryTeam {
  teamId: string;
  teamName: string;
  associationId: string;
}

/** Returns the one Primary team for the selected association, if present. */
export const findPrimaryTeamForAssociation = <T extends AssociationPrimaryTeam>(
  primaryTeams: T[],
  associationId: string,
): T | undefined => primaryTeams.find((team) => team.associationId === associationId);
