import { describe, expect, it } from "vitest";
import { filterClubsForActiveMode } from "@/lib/activeScopeOptions";

const clubs = [
  { id: "blaze", association_id: "hockey-ballarat", name: "Blaze" },
  { id: "grampians", association_id: "hockey-ballarat", name: "Grampians Hockey Club" },
  { id: "other", association_id: "other-association", name: "Other Club" },
];

describe("filterClubsForActiveMode", () => {
  it("shows a Club Admin only their assigned clubs", () => {
    const result = filterClubsForActiveMode(clubs, "club", [], ["grampians"]);

    expect(result.map((club) => club.id)).toEqual(["grampians"]);
  });

  it("shows an Association Admin the clubs in their assigned associations", () => {
    const result = filterClubsForActiveMode(clubs, "association", ["hockey-ballarat"], []);

    expect(result.map((club) => club.id)).toEqual(["blaze", "grampians"]);
  });

  it("does not restrict Super Admin club options", () => {
    expect(filterClubsForActiveMode(clubs, "super_admin", [], [])).toEqual(clubs);
  });
});
