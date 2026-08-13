export const REVIEW_PANEL_CONFLICT_FACTORS = [
  ["SAME_CLUB_OR_TEAM", "Same club or team"],
  ["COMMITTEE_OR_DECISION_ROLE", "Committee or decision-making role"],
  [
    "PERSONAL_FAMILY_BUSINESS_RELATIONSHIP",
    "Personal, family or business relationship",
  ],
  ["PRIOR_INVOLVEMENT_OR_KNOWLEDGE", "Prior involvement or inside knowledge"],
  ["COMPETITIVE_INTEREST", "Competitive interest in the outcome"],
  ["PUBLICLY_EXPRESSED_VIEW", "Publicly expressed view about the matter"],
  ["OTHER", "Other possible conflict"],
] as const;

export const REVIEW_PANEL_CONFLICT_DECISIONS = [
  ["NO_CONFLICT", "No conflict identified"],
  ["MANAGED", "Perceived conflict can be managed"],
  ["REPLACE_MEMBER", "Do not appoint — replace this member"],
] as const;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type ReviewPanelMemberDraft = {
  seatNumber: number;
  fullName: string;
  email: string;
  profileId: string;
  organisation: string;
  roleOrPosition: string;
  invitationStatus: "NOT_SENT" | "SENT" | "ACCEPTED" | "DECLINED";
  trainingExperience: string;
  clubAffiliation: string;
  committeeRole: string;
  relationshipToParties: string;
  competitiveInterest: string;
  conflictFactors: string[];
  actualConflict: "" | "YES" | "NO";
  perceivedConflict: "" | "YES" | "NO";
  conflictDecision: "" | "NO_CONFLICT" | "MANAGED" | "REPLACE_MEMBER";
  conflictReason: string;
};

export type ReviewPanelDraft = {
  appointmentAuthority: string;
  authorityReference: string;
  processNotes: string;
  members: ReviewPanelMemberDraft[];
};

export function emptyReviewPanelMember(
  seatNumber: number,
): ReviewPanelMemberDraft {
  return {
    seatNumber,
    fullName: "",
    email: "",
    profileId: "",
    organisation: "",
    roleOrPosition: "",
    invitationStatus: "NOT_SENT",
    trainingExperience: "",
    clubAffiliation: "",
    committeeRole: "",
    relationshipToParties: "",
    competitiveInterest: "",
    conflictFactors: [],
    actualConflict: "",
    perceivedConflict: "",
    conflictDecision: "",
    conflictReason: "",
  };
}

export const EMPTY_REVIEW_PANEL: ReviewPanelDraft = {
  appointmentAuthority: "",
  authorityReference: "",
  processNotes: "",
  members: [1, 2, 3].map(emptyReviewPanelMember),
};

export function validateReviewPanel(draft: ReviewPanelDraft) {
  const errors: string[] = [];
  const profileIds = draft.members
    .map((member) => member.profileId)
    .filter(Boolean);

  if (draft.appointmentAuthority.trim().length < 3) {
    errors.push("Record who authorised the panel appointment.");
  }
  if (draft.processNotes.trim().length < 10) {
    errors.push("Explain why this review pathway was selected.");
  }
  if (draft.members.length !== 3) {
    errors.push("Exactly three panel member records are required.");
  }
  if (new Set(profileIds).size !== profileIds.length) {
    errors.push("The same SportStack account cannot occupy two panel seats.");
  }

  draft.members.forEach((member) => {
    const seat = `Panel member ${member.seatNumber}`;
    const actual = member.actualConflict === "YES";
    const perceived = member.perceivedConflict === "YES";

    if (member.fullName.trim().length < 2)
      errors.push(`${seat}: enter a name.`);
    if (!EMAIL_PATTERN.test(member.email.trim())) {
      errors.push(`${seat}: enter a valid email address.`);
    }
    if (member.trainingExperience.trim().length < 10) {
      errors.push(`${seat}: record why the person is suitable.`);
    }
    if (!member.actualConflict || !member.perceivedConflict) {
      errors.push(`${seat}: answer both conflict questions.`);
    }
    if ((actual || perceived) && member.conflictFactors.length === 0) {
      errors.push(`${seat}: select at least one conflict descriptor.`);
    }
    if (!actual && !perceived && member.conflictFactors.length > 0) {
      errors.push(
        `${seat}: remove conflict descriptors or change the answers.`,
      );
    }
    if (!member.conflictDecision)
      errors.push(`${seat}: select a conflict result.`);
    if (actual && member.conflictDecision !== "REPLACE_MEMBER") {
      errors.push(`${seat}: an actual conflict requires replacement.`);
    }
    if (
      !actual &&
      perceived &&
      !["MANAGED", "REPLACE_MEMBER"].includes(member.conflictDecision)
    ) {
      errors.push(
        `${seat}: a perceived conflict must be managed or the member replaced.`,
      );
    }
    if (
      !actual &&
      !perceived &&
      member.conflictDecision &&
      member.conflictDecision !== "NO_CONFLICT"
    ) {
      errors.push(
        `${seat}: use “No conflict identified” when both answers are No.`,
      );
    }
    if (member.conflictReason.trim().length < 10) {
      errors.push(`${seat}: explain the conflict result and safeguards.`);
    }
    if (member.invitationStatus === "ACCEPTED" && !member.profileId) {
      errors.push(
        `${seat}: link a SportStack account before recording acceptance.`,
      );
    }
    if (
      member.invitationStatus === "ACCEPTED" &&
      member.conflictDecision === "REPLACE_MEMBER"
    ) {
      errors.push(
        `${seat}: a member marked for replacement cannot be accepted.`,
      );
    }
  });

  return errors;
}
