import { describe, expect, it } from "vitest";
import {
  getPlayerExplorerAccessScopeKey,
  getPlayerExplorerLockedFilters,
  type PlayerExplorerScopeDetails,
} from "@/lib/playerExplorerScope";

const scope: PlayerExplorerScopeDetails = {
  associationId: "association-1",
  associationName: "Hockey Ballarat",
  clubId: "club-1",
  clubName: "Grampians Hockey Club",
  teamId: "team-1",
  teamName: "Pumas",
};

describe("Player Explorer access scope", () => {
  it("requires the concrete scope for each lower role mode", () => {
    expect(getPlayerExplorerAccessScopeKey({
      actorMode: "association",
      isSuperAdmin: false,
      selectedAssociationId: scope.associationId,
      selectedClubId: null,
      selectedTeamId: null,
    })).toBe("association:association-1");

    expect(getPlayerExplorerAccessScopeKey({
      actorMode: "coach",
      isSuperAdmin: false,
      selectedAssociationId: scope.associationId,
      selectedClubId: scope.clubId,
      selectedTeamId: null,
    })).toBeNull();
  });

  it("keeps true Super Admin mode global", () => {
    expect(getPlayerExplorerAccessScopeKey({
      actorMode: "super_admin",
      isSuperAdmin: true,
      selectedAssociationId: null,
      selectedClubId: null,
      selectedTeamId: null,
    })).toBe("super_admin");
  });

  it("builds the full locked cascade for a team-scoped user", () => {
    expect(getPlayerExplorerLockedFilters(false, scope)).toEqual([
      { field: "association", label: "Hockey Ballarat" },
      { field: "club", label: "Grampians Hockey Club" },
      { field: "team", label: "Pumas" },
    ]);
    expect(getPlayerExplorerLockedFilters(true, scope)).toEqual([]);
  });
});
