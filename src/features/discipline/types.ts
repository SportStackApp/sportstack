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
export type DisciplineMember =
  Database["public"]["Tables"]["discipline_case_members"]["Row"];
export type DisciplinePerson =
  Database["public"]["Tables"]["discipline_case_people"]["Row"];
export type DisciplineInvestigatorSetup =
  Database["public"]["Tables"]["discipline_investigator_setups"]["Row"];
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
  profileOptions: Array<{
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
  }>;
};

export type NewDisciplineCaseInput = {
  association_id: string;
  title: string;
  jurisdiction_path: string;
  jurisdiction_reason?: string;
  immediate_safety_risk: boolean;
  immediate_safety_action?: string;
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
  };
  reported_person?: {
    full_name: string;
    organisation?: string;
    person_role?: string;
    email?: string;
    phone?: string;
    is_junior?: boolean;
  };
  initial_allegation?: {
    title: string;
    description: string;
    incident_at?: string;
    location?: string;
  };
};

export const asJson = (value: unknown) => value as Json;
