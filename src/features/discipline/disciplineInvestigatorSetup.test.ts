import { describe, expect, it } from "vitest";
import {
  EMPTY_INVESTIGATOR_SETUP,
  validateInvestigatorSetup,
  type InvestigatorSetupDraft,
} from "./investigatorSetupLogic";

const validDraft = (): InvestigatorSetupDraft => ({
  ...EMPTY_INVESTIGATOR_SETUP,
  leadUserId: "lead-user",
  appointedDate: "2026-08-13",
  appointedTime: "09:30",
  investigationType: "INTERNAL",
  appointmentAuthority: "Hockey Ballarat Committee",
  trainingExperience: "Relevant investigation training and experience",
  actualConflict: "NO",
  perceivedConflict: "NO",
  conflictDecision: "NO_CONFLICT",
  conflictReason: "All disclosures reviewed and no conflict identified.",
});

describe("validateInvestigatorSetup", () => {
  it("accepts a complete no-conflict appointment", () => {
    expect(validateInvestigatorSetup(validDraft())).toEqual([]);
  });

  it("accepts a perceived conflict with descriptors and safeguards", () => {
    expect(
      validateInvestigatorSetup({
        ...validDraft(),
        perceivedConflict: "YES",
        conflictFactors: ["SAME_CLUB_OR_TEAM"],
        conflictDecision: "MANAGED",
        conflictReason:
          "No direct involvement; work will be independently reviewed.",
      }),
    ).toEqual([]);
  });

  it("requires replacement when an actual conflict is identified", () => {
    const errors = validateInvestigatorSetup({
      ...validDraft(),
      actualConflict: "YES",
      conflictFactors: ["PERSONAL_FAMILY_BUSINESS_RELATIONSHIP"],
      conflictDecision: "MANAGED",
    });
    expect(errors).toContain(
      "An actual conflict requires another investigator to be selected.",
    );
  });

  it("requires a descriptor when a conflict is identified", () => {
    const errors = validateInvestigatorSetup({
      ...validDraft(),
      perceivedConflict: "YES",
      conflictDecision: "MANAGED",
    });
    expect(errors).toContain(
      "Select at least one descriptor for the possible conflict.",
    );
  });

  it("rejects the lead officer as a support investigator", () => {
    const errors = validateInvestigatorSetup({
      ...validDraft(),
      supportUserIds: ["lead-user"],
    });
    expect(errors).toContain(
      "The lead officer cannot also be a support investigator.",
    );
  });
});
