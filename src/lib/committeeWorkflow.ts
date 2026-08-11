export type CommitteePermissionKey =
  | "manage_committee"
  | "manage_members"
  | "manage_documents"
  | "manage_polls"
  | "vote"
  | "manage_meetings"
  | "record_minutes"
  | "chat";

export type CommitteeAccessPreset = "ADMIN" | "RECORDS" | "MEMBER" | "VIEW_ONLY";
export type CommitteeLifecycle = "STANDING" | "TEMPORARY";
export type CommitteeScopeType = "ASSOCIATION" | "CLUB";
export type CommitteeWizardKind = "COMMITTEE" | "SUBCOMMITTEE";

export interface CommitteePurposePreset {
  id: string;
  label: string;
  description: string;
  suggestedName: string;
  lifecycle: CommitteeLifecycle;
}

export interface CommitteePositionDraft {
  key: string;
  title: string;
  description: string;
  accessPreset: CommitteeAccessPreset;
  isPresident: boolean;
  selected: boolean;
  memberIds: string[];
}

export interface CommitteeWizardDraft {
  kind: CommitteeWizardKind;
  purposeId: string;
  scopeType: CommitteeScopeType;
  associationId: string;
  clubId: string;
  parentCommitteeId: string;
  lifecycleType: CommitteeLifecycle;
  startsOn: string;
  targetEndOn: string;
  name: string;
  description: string;
  positions: CommitteePositionDraft[];
  skipSetup: boolean;
}

export const COMMITTEE_PERMISSION_KEYS: CommitteePermissionKey[] = [
  "manage_committee",
  "manage_members",
  "manage_documents",
  "manage_polls",
  "vote",
  "manage_meetings",
  "record_minutes",
  "chat",
];

export const ACCESS_PRESET_LABELS: Record<CommitteeAccessPreset, string> = {
  ADMIN: "Committee administrator",
  RECORDS: "Meetings and records",
  MEMBER: "Member access",
  VIEW_ONLY: "View only",
};

export const MAIN_COMMITTEE_PURPOSES: CommitteePurposePreset[] = [
  { id: "executive", label: "Executive", suggestedName: "Executive Committee", lifecycle: "STANDING", description: "Provide governance, oversight and strategic direction for the organisation." },
  { id: "juniors", label: "Juniors", suggestedName: "Junior Committee", lifecycle: "STANDING", description: "Coordinate junior participation, development and support." },
  { id: "selection", label: "Selection", suggestedName: "Selection Committee", lifecycle: "STANDING", description: "Support fair, consistent team selection and related decisions." },
  { id: "finance", label: "Finance", suggestedName: "Finance Committee", lifecycle: "STANDING", description: "Oversee budgets, financial reporting and financial decisions." },
  { id: "facilities", label: "Facilities", suggestedName: "Facilities Committee", lifecycle: "STANDING", description: "Plan and oversee facilities, grounds, equipment and maintenance." },
  { id: "events", label: "Events and fundraising", suggestedName: "Events and Fundraising Committee", lifecycle: "STANDING", description: "Plan events, fundraising activities and community engagement." },
  { id: "safety", label: "Safety and wellbeing", suggestedName: "Safety and Wellbeing Committee", lifecycle: "STANDING", description: "Support safety, wellbeing, risk management and continuous improvement." },
  { id: "custom", label: "Custom", suggestedName: "", lifecycle: "STANDING", description: "" },
];

export const SUBCOMMITTEE_PURPOSES: CommitteePurposePreset[] = [
  { id: "presidents", label: "Presidents forum", suggestedName: "Presidents Committee", lifecycle: "STANDING", description: "Bring current Club Presidents together with the parent committee for regular discussion and coordination." },
  { id: "disciplinary", label: "Disciplinary panel", suggestedName: "Disciplinary Panel", lifecycle: "TEMPORARY", description: "Consider a specific disciplinary matter privately, fairly and consistently." },
  { id: "investigation", label: "Investigation or review", suggestedName: "Investigation Panel", lifecycle: "TEMPORARY", description: "Investigate or review a defined matter and report findings to the parent committee." },
  { id: "project", label: "Project or task", suggestedName: "Project Working Group", lifecycle: "TEMPORARY", description: "Complete a defined project or task on behalf of the parent committee." },
  { id: "event", label: "Event", suggestedName: "Event Working Group", lifecycle: "TEMPORARY", description: "Plan and deliver a specific event on behalf of the parent committee." },
  { id: "custom", label: "Custom", suggestedName: "", lifecycle: "STANDING", description: "" },
];

const position = (
  key: string,
  title: string,
  accessPreset: CommitteeAccessPreset,
  isPresident = false,
  description = "",
): CommitteePositionDraft => ({
  key,
  title,
  description,
  accessPreset,
  isPresident,
  selected: true,
  memberIds: [],
});

const GENERAL_POSITIONS = () => [
  position("chair", "Chair", "ADMIN", true),
  position("secretary", "Secretary", "RECORDS"),
  position("member", "General Member", "MEMBER"),
];

export function suggestedCommitteePositions(kind: CommitteeWizardKind, purposeId: string): CommitteePositionDraft[] {
  if (kind === "SUBCOMMITTEE") {
    if (purposeId === "presidents") return [position("chair", "Chair", "ADMIN", true), position("club-president", "Club President", "MEMBER"), position("secretary", "Secretary", "RECORDS")];
    if (purposeId === "disciplinary") return [position("chair", "Panel Chair", "ADMIN", true), position("secretary", "Panel Secretary", "RECORDS"), position("member", "Panel Member", "VIEW_ONLY")];
    if (purposeId === "investigation") return [position("chair", "Investigation Lead", "ADMIN", true), position("secretary", "Investigation Secretary", "RECORDS"), position("member", "Investigation Member", "VIEW_ONLY")];
    if (purposeId === "project") return [position("chair", "Project Lead", "ADMIN", true), position("secretary", "Project Secretary", "RECORDS"), position("member", "Project Member", "MEMBER")];
    if (purposeId === "event") return [position("chair", "Event Lead", "ADMIN", true), position("secretary", "Event Secretary", "RECORDS"), position("member", "Event Team Member", "MEMBER")];
    return GENERAL_POSITIONS();
  }

  if (purposeId === "executive") return [position("president", "President", "ADMIN", true), position("vice-president", "Vice President", "MEMBER"), position("secretary", "Secretary", "RECORDS"), position("treasurer", "Treasurer", "MEMBER"), position("member", "General Member", "MEMBER")];
  if (purposeId === "juniors") return [position("chair", "Chair", "ADMIN", true), position("secretary", "Secretary", "RECORDS"), position("junior-coordinator", "Junior Coordinator", "MEMBER"), position("coach-coordinator", "Coach Coordinator", "MEMBER"), position("member", "General Member", "MEMBER")];
  if (purposeId === "selection") return [position("chair", "Chair", "ADMIN", true), position("secretary", "Secretary", "RECORDS"), position("selector", "Selector", "MEMBER"), position("coach-representative", "Coach Representative", "MEMBER")];
  if (purposeId === "finance") return [position("chair", "Chair", "ADMIN", true), position("treasurer", "Treasurer", "MEMBER"), position("secretary", "Secretary", "RECORDS"), position("member", "General Member", "MEMBER")];
  if (purposeId === "facilities") return [position("chair", "Chair", "ADMIN", true), position("secretary", "Secretary", "RECORDS"), position("facilities-coordinator", "Facilities Coordinator", "MEMBER"), position("member", "General Member", "MEMBER")];
  if (purposeId === "events") return [position("chair", "Chair", "ADMIN", true), position("secretary", "Secretary", "RECORDS"), position("treasurer", "Treasurer", "MEMBER"), position("events-coordinator", "Events Coordinator", "MEMBER"), position("fundraising-coordinator", "Fundraising Coordinator", "MEMBER")];
  if (purposeId === "safety") return [position("chair", "Chair", "ADMIN", true), position("secretary", "Secretary", "RECORDS"), position("safety-officer", "Safety Officer", "MEMBER"), position("wellbeing-officer", "Wellbeing Officer", "MEMBER"), position("member", "General Member", "MEMBER")];
  return GENERAL_POSITIONS();
}

export function permissionsForAccessPreset(preset: CommitteeAccessPreset): Record<CommitteePermissionKey, boolean> {
  const enabled = preset === "ADMIN"
    ? COMMITTEE_PERMISSION_KEYS
    : preset === "RECORDS"
      ? ["manage_documents", "vote", "manage_meetings", "record_minutes", "chat"] satisfies CommitteePermissionKey[]
      : preset === "MEMBER"
        ? ["vote", "chat"] satisfies CommitteePermissionKey[]
        : [];
  return Object.fromEntries(COMMITTEE_PERMISSION_KEYS.map((key) => [key, enabled.includes(key)])) as Record<CommitteePermissionKey, boolean>;
}

export function applyPurposePreset(draft: CommitteeWizardDraft, preset: CommitteePurposePreset): CommitteeWizardDraft {
  return {
    ...draft,
    purposeId: preset.id,
    lifecycleType: preset.lifecycle,
    name: preset.suggestedName,
    description: preset.description,
    positions: suggestedCommitteePositions(draft.kind, preset.id),
    skipSetup: false,
  };
}

export function buildCommitteeCreatePayload(draft: CommitteeWizardDraft) {
  return {
    committee: {
      association_id: draft.associationId,
      club_id: draft.scopeType === "CLUB" ? draft.clubId : "",
      scope_type: draft.scopeType,
      parent_committee_id: draft.parentCommitteeId,
      lifecycle_type: draft.lifecycleType,
      starts_on: draft.startsOn,
      target_end_on: draft.lifecycleType === "TEMPORARY" ? draft.targetEndOn : "",
      name: draft.name.trim(),
      description: draft.description.trim(),
    },
    positions: draft.skipSetup
      ? []
      : draft.positions.filter((item) => item.selected && item.title.trim()).map((item, index) => ({
          title: item.title.trim(),
          description: item.description.trim(),
          is_president: item.isPresident,
          permissions: permissionsForAccessPreset(item.accessPreset),
          sort_order: index,
          member_ids: [...new Set(item.memberIds)],
        })),
  };
}

export function committeeWizardStepIsValid(draft: CommitteeWizardDraft, step: number): boolean {
  if (step === 0) return Boolean(draft.purposeId);
  if (step === 1) {
    if (draft.kind === "SUBCOMMITTEE") {
      return Boolean(draft.parentCommitteeId && draft.startsOn)
        && (draft.lifecycleType === "STANDING" || !draft.targetEndOn || draft.targetEndOn >= draft.startsOn);
    }
    return Boolean(draft.associationId)
      && (draft.scopeType === "ASSOCIATION" || Boolean(draft.clubId));
  }
  if (step === 2) return Boolean(draft.name.trim() && draft.description.trim());
  return true;
}
