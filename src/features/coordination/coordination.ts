export type CoordinationPositionState =
  | "OPEN"
  | "OFFERING"
  | "AWAITING_CONFIRMATION"
  | "FILLED"
  | "REPLACEMENT_REQUIRED"
  | "RECONFIRMATION_REQUIRED"
  | "CANCELLED"
  | "COMPLETED";

export type CoordinationAvailabilityStatus =
  | "UMPIRING"
  | "TECHNICAL_BENCH"
  | "VOLUNTEERING";

export const isCoordinationAvailability = (
  status?: string | null,
): status is CoordinationAvailabilityStatus =>
  status === "UMPIRING" || status === "TECHNICAL_BENCH" || status === "VOLUNTEERING";

export const coordinationAvailabilityLabel = (status: CoordinationAvailabilityStatus) => {
  if (status === "UMPIRING") return "Umpiring";
  if (status === "TECHNICAL_BENCH") return "Technical Bench";
  return "Volunteering";
};

export type OfferRecipientState =
  | "PENDING"
  | "ACCEPTED_AWAITING_CONFIRMATION"
  | "DECLINED"
  | "EXPIRED"
  | "WITHDRAWN"
  | "CONFIRMED"
  | "NOT_SELECTED";

export interface EligiblePerson {
  user_id: string;
  name: string;
  availability: string | null;
  confirmed_load: number;
  completed_count: number;
  grade_signed_off: boolean;
  age_state: "ADULT" | "UNDER_18" | "UNKNOWN" | null;
}

export interface OfferRecipientSummary {
  id: string;
  user_id: string;
  name: string;
  status: OfferRecipientState;
  reason: string | null;
}

export interface FixturePositionSummary {
  id: string;
  label: string;
  state: CoordinationPositionState;
  starts_at: string;
  ends_at: string;
  type: "UMPIRE" | "TECHNICAL_BENCH" | "SUPERVISING_UMPIRE" | "VOLUNTEER";
  type_label: string;
  assignment: null | {
    id: string;
    user_id: string;
    name: string;
    status: string;
    late: boolean;
  };
  offer: null | {
    id: string;
    deadline: string;
    note: string | null;
    urgent: boolean;
    owner_id: string;
    recipients: OfferRecipientSummary[];
  };
}

export const capOfferDeadline = (startsAt: string, requestedAt: Date) => {
  const start = new Date(startsAt);
  return requestedAt.getTime() > start.getTime() ? start : requestedAt;
};

export const defaultOfferDeadline = (startsAt: string, now = new Date()) =>
  capOfferDeadline(startsAt, new Date(now.getTime() + 72 * 60 * 60 * 1000));

export const isUrgentOffer = (deadline: string, now = new Date()) =>
  new Date(deadline).getTime() - now.getTime() < 2 * 60 * 60 * 1000;

export const formatCoordinationStatus = (status: string) =>
  status.replaceAll("_", " ").toLowerCase().replace(/^./, (letter) => letter.toUpperCase());

export type CoordinationTab = "fixtures" | "mine" | "matrix" | "activities" | "roster-checks";

export const coordinationTabsForAccess = (access: {
  can_manage_umpires: boolean;
  can_manage_technical_bench: boolean;
  can_manage_volunteers: boolean;
  can_manage_matrix: boolean;
  can_review_roster_mismatches: boolean;
}): CoordinationTab[] => {
  const tabs: CoordinationTab[] = [];
  if (access.can_manage_umpires || access.can_manage_technical_bench) tabs.push("fixtures");
  tabs.push("mine");
  if (access.can_manage_matrix) tabs.push("matrix");
  if (access.can_manage_volunteers) tabs.push("activities");
  if (access.can_review_roster_mismatches) tabs.push("roster-checks");
  return tabs;
};
