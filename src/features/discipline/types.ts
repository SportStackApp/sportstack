import type { Database, Json } from "@/integrations/supabase/types";

export type DisciplinePortalContext = {
  allowed: boolean;
  discipline_only: boolean;
  can_create_cases: boolean;
  can_manage_config: boolean;
  association_ids: string[];
};

export type DisciplineCase =
  Database["public"]["Tables"]["discipline_cases"]["Row"];
export type DisciplineDeadline =
  Database["public"]["Tables"]["discipline_deadlines"]["Row"];
export type DisciplineAllegation =
  Database["public"]["Tables"]["discipline_allegations"]["Row"];
export type DisciplineAssessment =
  Database["public"]["Tables"]["discipline_classification_assessments"]["Row"];
export type DisciplineClassificationRule =
  Database["public"]["Tables"]["discipline_classification_rules"]["Row"];
export type DisciplineMember =
  Database["public"]["Tables"]["discipline_case_members"]["Row"];
export type DisciplinePerson =
  Database["public"]["Tables"]["discipline_case_people"]["Row"];
export type DisciplineInvestigatorSetup =
  Database["public"]["Tables"]["discipline_investigator_setups"]["Row"];

export type DisciplineInvestigatorSetupInput = {
  leadUserId: string;
  supportUserIds: string[];
  appointedAt: string;
  investigationType: "INTERNAL" | "EXTERNAL";
  appointmentAuthority: string;
  authorityReference?: string;
  trainingExperience: string;
  clubAffiliation?: string;
  committeeRole?: string;
  relationshipToParties?: string;
  competitiveInterest?: string;
  conflictFactors: string[];
  actualConflict: boolean;
  perceivedConflict: boolean;
  conflictDecision: "NO_CONFLICT" | "MANAGED" | "REPLACE_INVESTIGATOR";
  conflictReason: string;
};
export type DisciplineNotification =
  Database["public"]["Tables"]["discipline_notifications"]["Row"];
export type DisciplineWitness =
  Database["public"]["Tables"]["discipline_witnesses"]["Row"];
export type DisciplineEvidence =
  Database["public"]["Tables"]["discipline_evidence"]["Row"];
export type DisciplineNaturalJusticeCheck =
  Database["public"]["Tables"]["discipline_natural_justice_checks"]["Row"];
export type DisciplineFinding =
  Database["public"]["Tables"]["discipline_findings"]["Row"];
export type DisciplineDecision =
  Database["public"]["Tables"]["discipline_decisions"]["Row"];
export type DisciplineReportSnapshot =
  Database["public"]["Tables"]["discipline_report_snapshots"]["Row"];
export type DisciplineAuditEvent =
  Database["public"]["Tables"]["discipline_audit_events"]["Row"];
export type DisciplineRulePack =
  Database["public"]["Tables"]["discipline_rule_packs"]["Row"];
export type DisciplineRuleClause =
  Database["public"]["Tables"]["discipline_rule_clauses"]["Row"];
export type DisciplineLocalVariation =
  Database["public"]["Tables"]["discipline_local_variations"]["Row"];
export type DisciplineTag =
  Database["public"]["Tables"]["discipline_tags"]["Row"];
export type DisciplineCaseTag =
  Database["public"]["Tables"]["discipline_case_tags"]["Row"];
export type DisciplineAllegationTag =
  Database["public"]["Tables"]["discipline_allegation_tags"]["Row"];

export type DisciplineCaseSummary = DisciplineCase & {
  nextDeadline: DisciplineDeadline | null;
};

export type ClassificationResult = {
  classification_code: string;
  classification_label: string;
  tribunal_readiness: "GREEN" | "AMBER" | "RED";
  penalty_guidance: string | null;
  explanation: string;
  source_warning?: string | null;
};

export type DisciplineWorkspaceData = {
  incidentCase: DisciplineCase;
  rulePack: DisciplineRulePack;
  deadlines: DisciplineDeadline[];
  members: DisciplineMember[];
  people: DisciplinePerson[];
  allegations: DisciplineAllegation[];
  assessments: DisciplineAssessment[];
  classificationRules: DisciplineClassificationRule[];
  investigatorSetups: DisciplineInvestigatorSetup[];
  notifications: DisciplineNotification[];
  witnesses: DisciplineWitness[];
  evidence: DisciplineEvidence[];
  naturalJustice: DisciplineNaturalJusticeCheck[];
  findings: DisciplineFinding[];
  decisions: DisciplineDecision[];
  reportSnapshots: DisciplineReportSnapshot[];
  auditEvents: DisciplineAuditEvent[];
  ruleClauses: DisciplineRuleClause[];
  localVariations: DisciplineLocalVariation[];
  tags: DisciplineTag[];
  caseTags: DisciplineCaseTag[];
  allegationTags: DisciplineAllegationTag[];
  profileOptions: Array<{
    id: string;
    first_name: string | null;
    last_name: string | null;
  }>;
};

export type DisciplineIntakeTagOption = {
  id: string;
  scope:
    | "JURISDICTION_REASON"
    | "SAFETY_RISK"
    | "ALLEGATION_DESCRIPTOR";
  key: string;
  label: string;
  description: string;
};

export type DisciplineIntakeOptions = {
  fixtures: Array<{
    id: string;
    label: string;
    fixture_at: string;
    match_concluded_at: string;
    competition_id: string | null;
    competition: string | null;
    division_id: string | null;
    grade: string | null;
    round_label: string | null;
    home_team_id: string;
    home_team: string;
    away_team_id: string;
    away_team: string;
    venue_id: string | null;
    venue: string | null;
  }>;
  competitions: Array<{ id: string; label: string }>;
  grades: Array<{
    id: string;
    label: string;
    competition_id: string | null;
  }>;
  teams: Array<{
    id: string;
    label: string;
    club_id: string;
    club: string;
    division_id: string | null;
  }>;
  venues: Array<{ id: string; label: string }>;
  clubs: Array<{ id: string; label: string }>;
  profiles: Array<{
    id: string;
    label: string;
    club_id: string | null;
    club: string | null;
  }>;
  tags: DisciplineIntakeTagOption[];
};

export type NewDisciplineCaseInput = {
  association_id: string;
  title: string;
  jurisdiction_path: string;
  jurisdiction_reason?: string;
  immediate_safety_risk: boolean;
  immediate_safety_action?: string;
  jurisdiction_tag_ids?: string[];
  safety_tag_ids?: string[];
  fixture_id?: string;
  competition_id?: string;
  division_id?: string;
  home_team_id?: string;
  away_team_id?: string;
  venue_id?: string;
  competition?: string;
  grade?: string;
  round_label?: string;
  round_type: string;
  relevant_club_participating?: boolean;
  first_named_team?: string;
  second_named_team?: string;
  match_concluded_at: string;
  incident_at?: string;
  venue?: string;
  incident_location?: string;
  report_received_at?: string;
  report_method?: string;
  report_in_writing?: boolean;
  prescribed_form_used?: boolean;
  report_complete?: boolean;
  desired_outcome_included?: boolean;
  prior_presentation_completed?: boolean;
  reporter?: {
    full_name: string;
    organisation?: string;
    person_role?: string;
    email?: string;
    phone?: string;
    is_junior?: boolean;
    profile_id?: string;
    club_id?: string;
  };
  reported_person?: {
    full_name: string;
    organisation?: string;
    person_role?: string;
    email?: string;
    phone?: string;
    is_junior?: boolean;
    profile_id?: string;
    club_id?: string;
  };
  allegations: Array<{
    title: string;
    description: string;
    incident_at?: string;
    location?: string;
    tag_ids?: string[];
  }>;
};

export const asJson = (value: unknown) => value as Json;
