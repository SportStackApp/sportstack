import { describe, expect, it } from "vitest";
import {
  applyPurposePreset,
  buildCommitteeCreatePayload,
  committeeWizardStepIsValid,
  MAIN_COMMITTEE_PURPOSES,
  permissionsForAccessPreset,
  type CommitteeWizardDraft,
} from "./committeeWorkflow";

const draft = (): CommitteeWizardDraft => ({
  kind: "COMMITTEE",
  purposeId: "",
  scopeType: "CLUB",
  associationId: "association-1",
  clubId: "club-1",
  parentCommitteeId: "",
  lifecycleType: "STANDING",
  startsOn: "2026-08-11",
  targetEndOn: "",
  name: "",
  description: "",
  positions: [],
  skipSetup: false,
});

describe("committee workflow", () => {
  it("prefills editable purpose, name and suggested positions", () => {
    const executive = MAIN_COMMITTEE_PURPOSES.find((item) => item.id === "executive")!;
    const result = applyPurposePreset(draft(), executive);
    expect(result.name).toBe("Executive Committee");
    expect(result.description).toContain("governance");
    expect(result.positions.some((item) => item.title === "President" && item.isPresident)).toBe(true);
  });

  it("maps safe access presets to the existing permission keys", () => {
    expect(permissionsForAccessPreset("MEMBER")).toMatchObject({ vote: true, chat: true, manage_members: false });
    expect(Object.values(permissionsForAccessPreset("ADMIN")).every(Boolean)).toBe(true);
    expect(Object.values(permissionsForAccessPreset("VIEW_ONLY")).some(Boolean)).toBe(false);
  });

  it("removes optional setup and standing target dates from the create payload", () => {
    const result = buildCommitteeCreatePayload({ ...draft(), name: "Test", description: "Purpose", skipSetup: true, targetEndOn: "2026-09-01" });
    expect(result.positions).toEqual([]);
    expect(result.committee.target_end_on).toBe("");
  });

  it("validates organisation and temporary date order", () => {
    expect(committeeWizardStepIsValid({ ...draft(), clubId: "" }, 1)).toBe(false);
    const subcommittee = { ...draft(), kind: "SUBCOMMITTEE" as const, parentCommitteeId: "parent-1", lifecycleType: "TEMPORARY" as const, targetEndOn: "2026-08-10" };
    expect(committeeWizardStepIsValid(subcommittee, 1)).toBe(false);
    expect(committeeWizardStepIsValid({ ...subcommittee, targetEndOn: "2026-08-12" }, 1)).toBe(true);
  });
});
