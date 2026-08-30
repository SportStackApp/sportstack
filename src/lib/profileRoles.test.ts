import { describe, expect, it } from "vitest";
import { getProfileRoleEmoji, getProfileRoleLabel, type ProfileRole } from "./profileRoles";

describe("profile role labels", () => {
  it("renders a label and icon for every database role", () => {
    const roles: ProfileRole[] = [
      "PLAYER", "COACH", "TEAM_MANAGER", "CLUB_ADMIN", "ASSOCIATION_ADMIN",
      "SUPER_ADMIN", "UMPIRE", "UMPIRE_ADMIN", "VOTER",
    ];

    roles.forEach((role) => {
      expect(getProfileRoleLabel(role)).not.toBe("");
      expect(getProfileRoleEmoji(role)).not.toBe("");
    });
    expect(getProfileRoleLabel("UMPIRE_ADMIN")).toBe("Legacy Umpire Admin");
  });
});
