export const INVESTIGATION_TYPES = [
  {
    value: "INTERNAL",
    label: "Internal investigation",
    description:
      "A suitably experienced person from within Hockey Ballarat's available people conducts the investigation.",
  },
  {
    value: "EXTERNAL",
    label: "Independent external investigation",
    description:
      "A person outside the relevant Hockey Ballarat interests is engaged where the nature, seriousness or independence needs support it.",
  },
] as const;

export const CONFLICT_FACTORS = [
  ["SAME_CLUB_OR_TEAM", "Same club or team"],
  ["COMMITTEE_OR_DECISION_ROLE", "Committee or decision-making role"],
  [
    "PERSONAL_FAMILY_BUSINESS_RELATIONSHIP",
    "Personal, family or business relationship",
  ],
  ["PRIOR_INVOLVEMENT_OR_KNOWLEDGE", "Prior involvement or inside knowledge"],
  ["COMPETITIVE_INTEREST", "Competitive interest"],
  ["PUBLICLY_EXPRESSED_VIEW", "Publicly expressed view about the matter"],
  ["OTHER", "Other possible conflict"],
] as const;

export const CONFLICT_DECISIONS = [
  {
    value: "NO_CONFLICT",
    label: "No conflict identified",
    description: "The answers support the appointment without a conflict plan.",
  },
  {
    value: "MANAGED",
    label: "Perceived conflict can be managed",
    description:
      "Record the safeguards that will preserve independence and procedural fairness.",
  },
  {
    value: "REPLACE_INVESTIGATOR",
    label: "Do not appoint — select another investigator",
    description:
      "The person is recorded as unsuitable for this appointment and is not given investigator case access.",
  },
] as const;

export type InvestigatorSetupDraft = {
  leadUserId: string;
  supportUserIds: string[];
  appointedDate: string;
  appointedTime: string;
  investigationType: "" | "INTERNAL" | "EXTERNAL";
  appointmentAuthority: string;
  authorityReference: string;
  trainingExperience: string;
  clubAffiliation: string;
  committeeRole: string;
  relationshipToParties: string;
  competitiveInterest: string;
  conflictFactors: string[];
  actualConflict: "" | "YES" | "NO";
  perceivedConflict: "" | "YES" | "NO";
  conflictDecision: "" | "NO_CONFLICT" | "MANAGED" | "REPLACE_INVESTIGATOR";
  conflictReason: string;
};

export const EMPTY_INVESTIGATOR_SETUP: InvestigatorSetupDraft = {
  leadUserId: "",
  supportUserIds: [],
  appointedDate: "",
  appointedTime: "",
  investigationType: "",
  appointmentAuthority: "",
  authorityReference: "",
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

export function validateInvestigatorSetup(draft: InvestigatorSetupDraft) {
  const errors: string[] = [];
  const actualConflict = draft.actualConflict === "YES";
  const perceivedConflict = draft.perceivedConflict === "YES";
  const conflictQuestionsAnswered =
    draft.actualConflict !== "" && draft.perceivedConflict !== "";

  if (!draft.leadUserId) errors.push("Select a Lead Investigation Officer.");
  if (draft.supportUserIds.includes(draft.leadUserId)) {
    errors.push("The lead officer cannot also be a support investigator.");
  }
  if (draft.supportUserIds.length > 10) {
    errors.push("Select no more than 10 support investigators.");
  }
  if (!draft.appointedDate || !draft.appointedTime) {
    errors.push("Record the appointment date and time.");
  }
  if (!draft.investigationType) {
    errors.push("Select an internal or independent external investigation.");
  }
  if (draft.appointmentAuthority.trim().length < 3) {
    errors.push("Record who authorised the appointment.");
  }
  if (draft.trainingExperience.trim().length < 10) {
    errors.push(
      "Record enough relevant training or experience to support the appointment.",
    );
  }
  if (!draft.actualConflict || !draft.perceivedConflict) {
    errors.push("Answer both conflict questions with Yes or No.");
  }
  if (
    conflictQuestionsAnswered &&
    (actualConflict || perceivedConflict) &&
    draft.conflictFactors.length === 0
  ) {
    errors.push("Select at least one descriptor for the possible conflict.");
  }
  if (
    conflictQuestionsAnswered &&
    !actualConflict &&
    !perceivedConflict &&
    draft.conflictFactors.length > 0
  ) {
    errors.push("Remove conflict descriptors or change the conflict answers.");
  }
  if (!draft.conflictDecision) errors.push("Select a conflict decision.");
  if (
    conflictQuestionsAnswered &&
    draft.conflictDecision &&
    actualConflict &&
    draft.conflictDecision !== "REPLACE_INVESTIGATOR"
  ) {
    errors.push(
      "An actual conflict requires another investigator to be selected.",
    );
  }
  if (
    conflictQuestionsAnswered &&
    draft.conflictDecision &&
    !actualConflict &&
    !perceivedConflict &&
    draft.conflictDecision !== "NO_CONFLICT"
  ) {
    errors.push("No identified conflict must use the no-conflict decision.");
  }
  if (
    conflictQuestionsAnswered &&
    draft.conflictDecision &&
    !actualConflict &&
    perceivedConflict &&
    !["MANAGED", "REPLACE_INVESTIGATOR"].includes(draft.conflictDecision)
  ) {
    errors.push(
      "A perceived conflict must be managed or the investigator replaced.",
    );
  }
  if (draft.conflictReason.trim().length < 10) {
    errors.push(
      "Explain the conflict decision and any safeguards in enough detail.",
    );
  }

  return errors;
}
