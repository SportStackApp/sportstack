const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const TRIBUNAL_CONFLICT_FACTORS = [
  ["INVOLVED_CLUB", "Current member, officer or official of an involved club"],
  ["HB_GOVERNANCE_ROLE", "Current Hockey Ballarat Committee or staff role"],
  ["DIRECT_INTEREST", "Party to, or directly interested in, the matter"],
  ["RELATIONSHIP", "Relationship that could reasonably affect independence"],
  ["PRIOR_INVOLVEMENT", "Prior involvement in this case"],
  ["OTHER", "Other possible independence concern"],
] as const;

export type TribunalMemberDraft = {
  seatNumber: number;
  fullName: string;
  email: string;
  profileId: string;
  organisation: string;
  roleOrPosition: string;
  invitationStatus: "NOT_SENT" | "SENT" | "ACCEPTED" | "DECLINED";
  isChair: boolean;
  legalEligibilityConfirmed: boolean;
  involvedClubRole: boolean;
  hbGovernanceRole: boolean;
  directInterest: boolean;
  relationshipAffectingIndependence: boolean;
  conflictFactors: string[];
  conflictDecision: "" | "CLEARED" | "MANAGED" | "REPLACE_MEMBER";
  conflictReason: string;
  availabilityNotes: string;
};

export type TribunalPreparationDraft = {
  referralBasis: string;
  appointmentAuthority: string;
  authorityReference: string;
  authorityMappingConfirmed: boolean;
  receivingBody: string;
  receivingContactName: string;
  receivingContactEmail: string;
  hbPresenterName: string;
  hbPresenterEmail: string;
  hearingMode: string;
  hearingDate: string;
  hearingTime: string;
  hearingLocation: string;
  chairRequirementTreatment: string;
  chairApprovalReference: string;
  twoMemberReason: string;
  preparationNotes: string;
  members: TribunalMemberDraft[];
};

export function emptyTribunalMember(seatNumber: number): TribunalMemberDraft {
  return {
    seatNumber,
    fullName: "",
    email: "",
    profileId: "",
    organisation: "",
    roleOrPosition: "",
    invitationStatus: "NOT_SENT",
    isChair: seatNumber === 1,
    legalEligibilityConfirmed: false,
    involvedClubRole: false,
    hbGovernanceRole: false,
    directInterest: false,
    relationshipAffectingIndependence: false,
    conflictFactors: [],
    conflictDecision: "",
    conflictReason: "",
    availabilityNotes: "",
  };
}

export const EMPTY_TRIBUNAL_PREPARATION: TribunalPreparationDraft = {
  referralBasis: "HB_RULE_7_7_REFERRAL",
  appointmentAuthority: "",
  authorityReference: "",
  authorityMappingConfirmed: false,
  receivingBody: "",
  receivingContactName: "",
  receivingContactEmail: "",
  hbPresenterName: "",
  hbPresenterEmail: "",
  hearingMode: "VIDEO",
  hearingDate: "",
  hearingTime: "",
  hearingLocation: "",
  chairRequirementTreatment: "NOT_RESOLVED",
  chairApprovalReference: "",
  twoMemberReason: "",
  preparationNotes: "",
  members: [1, 2, 3].map(emptyTribunalMember),
};

export function validateTribunalPreparation(draft: TribunalPreparationDraft) {
  const errors: string[] = [];
  const accepted = draft.members.filter(
    (member) => member.invitationStatus === "ACCEPTED",
  );
  const linkedIds = draft.members
    .map((member) => member.profileId)
    .filter(Boolean);

  if (draft.appointmentAuthority.trim().length < 3)
    errors.push(
      "Record who appoints the Tribunal under the local HB authority mapping.",
    );
  if (!draft.receivingBody.trim())
    errors.push("Record the body receiving the referral.");
  if (
    draft.receivingContactName.trim().length < 2 ||
    !EMAIL_PATTERN.test(draft.receivingContactEmail)
  )
    errors.push("Record a valid receiving contact and email.");
  if (
    draft.hbPresenterName.trim().length < 2 ||
    !EMAIL_PATTERN.test(draft.hbPresenterEmail)
  )
    errors.push(
      "Record the HB representative who will attend and present the material.",
    );
  if (!draft.hearingLocation.trim())
    errors.push("Record the venue or online meeting location.");
  if (draft.preparationNotes.trim().length < 10)
    errors.push("Record the scope and safeguards for this preparation.");
  if (
    draft.chairRequirementTreatment === "HB_VARIATION_APPROVED" &&
    draft.chairApprovalReference.trim().length < 3
  )
    errors.push(
      "Record the formal approval reference for the HB Chair variation.",
    );
  if (accepted.length === 2 && draft.twoMemberReason.trim().length < 10)
    errors.push(
      "Explain why the Tribunal uses the minimum of two members rather than the ordinary three.",
    );
  if (new Set(linkedIds).size !== linkedIds.length)
    errors.push(
      "The same SportStack account cannot occupy two Tribunal seats.",
    );

  draft.members.forEach((member) => {
    const seat = `Tribunal member ${member.seatNumber}`;
    if (member.fullName.trim().length < 2)
      errors.push(`${seat}: enter a name.`);
    if (!EMAIL_PATTERN.test(member.email))
      errors.push(`${seat}: enter a valid email address.`);
    if (!member.conflictDecision)
      errors.push(`${seat}: select an independence result.`);
    if (member.conflictReason.trim().length < 10)
      errors.push(`${seat}: explain the independence result.`);
    if (member.availabilityNotes.trim().length < 3)
      errors.push(`${seat}: record availability.`);
    if (member.invitationStatus === "ACCEPTED" && !member.profileId)
      errors.push(`${seat}: link a SportStack account before acceptance.`);
    if (
      member.invitationStatus === "ACCEPTED" &&
      (member.involvedClubRole ||
        member.hbGovernanceRole ||
        member.directInterest ||
        member.relationshipAffectingIndependence ||
        member.conflictDecision === "REPLACE_MEMBER")
    )
      errors.push(`${seat}: an independence issue prevents acceptance.`);
  });

  if (accepted.length >= 2) {
    const chairs = accepted.filter((member) => member.isChair);
    if (chairs.length !== 1)
      errors.push("Exactly one accepted member must be the Tribunal Chair.");
    if (
      chairs.length === 1 &&
      draft.chairRequirementTreatment === "HV_REQUIREMENT_CONFIRMED" &&
      !chairs[0].legalEligibilityConfirmed
    )
      errors.push(
        "Confirm the Chair is eligible to engage in legal practice in Victoria.",
      );
  }
  return errors;
}

export function tribunalReadinessItems(draft: TribunalPreparationDraft) {
  const accepted = draft.members.filter(
    (member) => member.invitationStatus === "ACCEPTED",
  );
  const chair = accepted.find((member) => member.isChair);
  return [
    {
      label: "HB authority mapping formally confirmed",
      complete: draft.authorityMappingConfirmed,
    },
    {
      label: "At least two independent members accepted",
      complete: accepted.length >= 2,
    },
    {
      label: "One accepted Chair recorded",
      complete: accepted.filter((member) => member.isChair).length === 1,
    },
    {
      label: "Chair requirement resolved",
      complete:
        draft.chairRequirementTreatment === "HB_VARIATION_APPROVED" ||
        (draft.chairRequirementTreatment === "HV_REQUIREMENT_CONFIRMED" &&
          Boolean(chair?.legalEligibilityConfirmed)),
    },
    {
      label: "Hearing time and place fixed",
      complete: Boolean(
        draft.hearingDate && draft.hearingTime && draft.hearingLocation.trim(),
      ),
    },
    {
      label: "Receiving contact and HB presenter recorded",
      complete:
        EMAIL_PATTERN.test(draft.receivingContactEmail) &&
        EMAIL_PATTERN.test(draft.hbPresenterEmail),
    },
  ];
}
