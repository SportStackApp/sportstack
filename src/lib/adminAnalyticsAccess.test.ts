import { describe, expect, it } from "vitest";
import { ANALYTICS_ADMIN_MODES, canViewIndividualPlayerMvpVotes } from "./adminAnalyticsAccess";

describe("Player MVP analytics access", () => {
  it("allows every admin mode to open the analytics route", () => {
    expect(ANALYTICS_ADMIN_MODES).toEqual(["super_admin", "association", "club"]);
  });

  it("restricts individual ballot details to Super Admin and Club Admin", () => {
    expect(canViewIndividualPlayerMvpVotes(true, "SUPER_ADMIN")).toBe(true);
    expect(canViewIndividualPlayerMvpVotes(false, "CLUB_ADMIN")).toBe(true);
    expect(canViewIndividualPlayerMvpVotes(false, "ASSOCIATION_ADMIN")).toBe(false);
    expect(canViewIndividualPlayerMvpVotes(false, "TEAM_MANAGER")).toBe(false);
  });
});
