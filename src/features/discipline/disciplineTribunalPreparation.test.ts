import { describe, expect, it } from "vitest";
import {
  EMPTY_TRIBUNAL_PREPARATION,
  emptyTribunalMember,
  tribunalReadinessItems,
  validateTribunalPreparation,
  type TribunalPreparationDraft,
} from "./tribunalPreparationLogic";

const member = (seatNumber: number) => ({
  ...emptyTribunalMember(seatNumber),
  fullName: `Tribunal Member ${seatNumber}`,
  email: `tribunal${seatNumber}@example.test`,
  profileId: `profile-${seatNumber}`,
  invitationStatus: "ACCEPTED" as const,
  isChair: seatNumber === 1,
  legalEligibilityConfirmed: seatNumber === 1,
  conflictDecision: "CLEARED" as const,
  conflictReason: "No Rule 7.17 independence issue was identified.",
  availabilityNotes: "Available for the scheduled Dev exercise.",
});

const draft = (): TribunalPreparationDraft => ({
  ...EMPTY_TRIBUNAL_PREPARATION,
  appointmentAuthority: "HB authorised delegate",
  authorityMappingConfirmed: true,
  receivingBody: "Hockey Ballarat Tribunal",
  receivingContactName: "Tribunal Registrar",
  receivingContactEmail: "registrar@example.test",
  hbPresenterName: "HB Presenter",
  hbPresenterEmail: "presenter@example.test",
  hearingDate: "2026-08-20",
  hearingTime: "19:00",
  hearingLocation: "Dev video meeting",
  chairRequirementTreatment: "HV_REQUIREMENT_CONFIRMED",
  preparationNotes:
    "Dev workflow exercise only; no real appointment or notice.",
  members: [1, 2, 3].map(member),
});

describe("Tribunal preparation", () => {
  it("accepts a fully resolved three-person setup", () => {
    expect(validateTribunalPreparation(draft())).toEqual([]);
    expect(tribunalReadinessItems(draft()).every((item) => item.complete)).toBe(
      true,
    );
  });

  it("requires a formal reference for a local Chair variation", () => {
    const value = draft();
    value.chairRequirementTreatment = "HB_VARIATION_APPROVED";
    value.chairApprovalReference = "";
    expect(validateTribunalPreparation(value)).toContain(
      "Record the formal approval reference for the HB Chair variation.",
    );
  });

  it("blocks an accepted member with an independence issue", () => {
    const value = draft();
    value.members[1].involvedClubRole = true;
    expect(validateTribunalPreparation(value)).toContain(
      "Tribunal member 2: an independence issue prevents acceptance.",
    );
  });

  it("allows two members only when a reason is recorded", () => {
    const value = draft();
    value.members[2].invitationStatus = "DECLINED";
    expect(validateTribunalPreparation(value)).toContain(
      "Explain why the Tribunal uses the minimum of two members rather than the ordinary three.",
    );
  });
});
