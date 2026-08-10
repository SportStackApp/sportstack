import type { AppMode } from "@/contexts/AppModeContext";

interface ScopedClubOption {
  id: string;
  association_id: string;
}

/**
 * Limits organisation selectors to the scope of the active role. Server-side
 * permission checks still remain authoritative for every protected action.
 */
export const filterClubsForActiveMode = <T extends ScopedClubOption>(
  clubs: T[],
  activeMode: AppMode,
  scopedAssociationIds: string[],
  scopedClubIds: string[],
): T[] => {
  if (activeMode === "super_admin") return clubs;
  if (activeMode === "association") {
    return clubs.filter((club) => scopedAssociationIds.includes(club.association_id));
  }
  if (activeMode === "club") {
    return clubs.filter((club) => scopedClubIds.includes(club.id));
  }
  return clubs;
};
