import { describe, expect, it } from "vitest";
import {
  EMPTY_REVIEW_PANEL,
  emptyReviewPanelMember,
  validateReviewPanel,
  type ReviewPanelDraft,
} from "./reviewPanelLogic";

const validMember = (seatNumber: number) => ({
  ...emptyReviewPanelMember(seatNumber),
  fullName: `Panel Member ${seatNumber}`,
  email: `panel${seatNumber}@example.test`,
  profileId: `profile-${seatNumber}`,
  invitationStatus: "ACCEPTED" as const,
  trainingExperience: "Good standing and relevant committee review experience.",
  actualConflict: "NO" as const,
  perceivedConflict: "NO" as const,
  conflictDecision: "NO_CONFLICT" as const,
  conflictReason:
    "No connection, prior involvement or competitive interest identified.",
});

const validDraft = (): ReviewPanelDraft => ({
  ...EMPTY_REVIEW_PANEL,
  appointmentAuthority: "Hockey Ballarat Committee",
  processNotes:
    "Three independent people will review the signed investigation report.",
  members: [1, 2, 3].map(validMember),
});

describe("validateReviewPanel", () => {
  it("accepts three eligible accepted members", () => {
    expect(validateReviewPanel(validDraft())).toEqual([]);
  });

  it("requires an account before acceptance", () => {
    const draft = validDraft();
    draft.members[0].profileId = "";
    expect(validateReviewPanel(draft)).toContain(
      "Panel member 1: link a SportStack account before recording acceptance.",
    );
  });

  it("requires replacement for an actual conflict", () => {
    const draft = validDraft();
    draft.members[1] = {
      ...draft.members[1],
      actualConflict: "YES",
      conflictFactors: ["PRIOR_INVOLVEMENT_OR_KNOWLEDGE"],
      conflictDecision: "MANAGED",
    };
    expect(validateReviewPanel(draft)).toContain(
      "Panel member 2: an actual conflict requires replacement.",
    );
  });

  it("prevents one account filling two seats", () => {
    const draft = validDraft();
    draft.members[2].profileId = draft.members[0].profileId;
    expect(validateReviewPanel(draft)).toContain(
      "The same SportStack account cannot occupy two panel seats.",
    );
  });
});
