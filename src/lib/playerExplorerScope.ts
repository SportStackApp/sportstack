import type { AppMode } from "@/contexts/AppModeContext";
import type { PlayerExplorerEntityField } from "@/lib/playerExplorer";

export interface PlayerExplorerLockedFilter {
  field: Extract<PlayerExplorerEntityField, "association" | "club" | "team">;
  label: string;
}

export interface PlayerExplorerScopeDetails {
  associationId: string | null;
  associationName: string | null;
  clubId: string | null;
  clubName: string | null;
  teamId: string | null;
  teamName: string | null;
}

export const getPlayerExplorerAccessScopeKey = ({
  actorMode,
  isSuperAdmin,
  selectedAssociationId,
  selectedClubId,
  selectedTeamId,
}: {
  actorMode: AppMode;
  isSuperAdmin: boolean;
  selectedAssociationId: string | null;
  selectedClubId: string | null;
  selectedTeamId: string | null;
}) => {
  if (isSuperAdmin) return "super_admin";
  if (actorMode === "association" && selectedAssociationId) {
    return `association:${selectedAssociationId}`;
  }
  if (actorMode === "club" && selectedClubId) return `club:${selectedClubId}`;
  if ((actorMode === "team_manager" || actorMode === "coach") && selectedTeamId) {
    return `${actorMode}:${selectedTeamId}`;
  }
  return null;
};

export const getPlayerExplorerLockedFilters = (
  isSuperAdmin: boolean,
  scope: PlayerExplorerScopeDetails,
): PlayerExplorerLockedFilter[] => {
  if (isSuperAdmin) return [];
  const filters: PlayerExplorerLockedFilter[] = [];
  if (scope.associationId) {
    filters.push({ field: "association", label: scope.associationName || "Selected association" });
  }
  if (scope.clubId) {
    filters.push({ field: "club", label: scope.clubName || "Selected club" });
  }
  if (scope.teamId) {
    filters.push({ field: "team", label: scope.teamName || "Selected team" });
  }
  return filters;
};
