import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import type {
  ClassificationResult,
  DisciplineCaseSummary,
  DisciplineIntakeOptions,
  DisciplinePortalContext,
  DisciplineWorkspaceData,
  NewDisciplineCaseInput,
} from "./types";

const throwIfError = (error: { message: string } | null) => {
  if (error) throw new Error(error.message);
};

export async function loadDisciplinePortalContext(): Promise<DisciplinePortalContext> {
  const { data, error } = await supabase.rpc("get_discipline_portal_context");
  throwIfError(error);
  const context = data as DisciplinePortalContext | null;
  return (
    context ?? {
      allowed: false,
      discipline_only: false,
      can_create_cases: false,
      can_manage_config: false,
      association_ids: [],
    }
  );
}

export async function loadDisciplineCases(): Promise<DisciplineCaseSummary[]> {
  const [
    { data: cases, error: caseError },
    { data: deadlines, error: deadlineError },
  ] = await Promise.all([
    supabase
      .from("discipline_cases")
      .select("*")
      .order("updated_at", { ascending: false }),
    supabase
      .from("discipline_deadlines")
      .select("*")
      .is("completed_at", null)
      .order("due_at"),
  ]);
  throwIfError(caseError);
  throwIfError(deadlineError);
  return (cases ?? []).map((incidentCase) => ({
    ...incidentCase,
    nextDeadline:
      (deadlines ?? []).find(
        (deadline) => deadline.case_id === incidentCase.id,
      ) ?? null,
  }));
}

export async function loadAssociationOptions(associationIds: string[]) {
  if (associationIds.length === 0) return [];
  const { data, error } = await supabase
    .from("associations")
    .select("id, name, timezone")
    .in("id", associationIds)
    .order("name");
  throwIfError(error);
  return data ?? [];
}

export async function loadDisciplineIntakeOptions(
  associationId: string,
): Promise<DisciplineIntakeOptions> {
  const { data, error } = await supabase.rpc("get_discipline_intake_options", {
    p_association_id: associationId,
  });
  throwIfError(error);
  return data as unknown as DisciplineIntakeOptions;
}

export async function createDisciplineCase(input: NewDisciplineCaseInput) {
  const { data, error } = await supabase.rpc("create_discipline_case", {
    p_intake: input as unknown as Json,
  });
  throwIfError(error);
  if (!data) throw new Error("The case was not created.");
  return data;
}

export async function loadDisciplineWorkspace(
  caseId: string,
): Promise<DisciplineWorkspaceData> {
  const { data: incidentCase, error: caseError } = await supabase
    .from("discipline_cases")
    .select("*")
    .eq("id", caseId)
    .single();
  throwIfError(caseError);

  const [
    rulePackResult,
    deadlinesResult,
    membersResult,
    peopleResult,
    allegationsResult,
    assessmentsResult,
    setupsResult,
    notificationsResult,
    witnessesResult,
    evidenceResult,
    naturalJusticeResult,
    findingsResult,
    decisionsResult,
    reportSnapshotsResult,
    auditResult,
    clausesResult,
    variationsResult,
    tagsResult,
    caseTagsResult,
    allegationTagsResult,
    profilesResult,
  ] = await Promise.all([
    supabase
      .from("discipline_rule_packs")
      .select("*")
      .eq("id", incidentCase.rule_pack_id)
      .single(),
    supabase
      .from("discipline_deadlines")
      .select("*")
      .eq("case_id", caseId)
      .order("due_at"),
    supabase
      .from("discipline_case_members")
      .select("*")
      .eq("case_id", caseId)
      .order("assigned_at"),
    supabase
      .from("discipline_case_people")
      .select("*")
      .eq("case_id", caseId)
      .order("created_at"),
    supabase
      .from("discipline_allegations")
      .select("*")
      .eq("case_id", caseId)
      .order("allegation_number"),
    supabase
      .from("discipline_classification_assessments")
      .select("*")
      .eq("case_id", caseId)
      .order("assessed_at", { ascending: false }),
    supabase
      .from("discipline_investigator_setups")
      .select("*")
      .eq("case_id", caseId)
      .order("recorded_at", { ascending: false }),
    supabase
      .from("discipline_notifications")
      .select("*")
      .eq("case_id", caseId)
      .order("created_at", { ascending: false }),
    supabase
      .from("discipline_witnesses")
      .select("*")
      .eq("case_id", caseId)
      .order("created_at", { ascending: false }),
    supabase
      .from("discipline_evidence")
      .select("*")
      .eq("case_id", caseId)
      .order("created_at", { ascending: false }),
    supabase
      .from("discipline_natural_justice_checks")
      .select("*")
      .eq("case_id", caseId)
      .order("check_key"),
    supabase
      .from("discipline_findings")
      .select("*")
      .eq("case_id", caseId)
      .order("recorded_at"),
    supabase
      .from("discipline_decisions")
      .select("*")
      .eq("case_id", caseId)
      .order("decided_at", { ascending: false }),
    supabase
      .from("discipline_report_snapshots")
      .select("*")
      .eq("case_id", caseId)
      .order("snapshot_number", { ascending: false }),
    supabase
      .from("discipline_audit_events")
      .select("*")
      .eq("case_id", caseId)
      .order("created_at", { ascending: false }),
    supabase
      .from("discipline_rule_clauses")
      .select("*")
      .eq("rule_pack_id", incidentCase.rule_pack_id)
      .order("sort_order"),
    supabase
      .from("discipline_local_variations")
      .select("*")
      .eq("rule_pack_id", incidentCase.rule_pack_id)
      .order("created_at"),
    supabase
      .from("discipline_tags")
      .select("*")
      .eq("association_id", incidentCase.association_id)
      .order("sort_order"),
    supabase.from("discipline_case_tags").select("*").eq("case_id", caseId),
    supabase.from("discipline_allegation_tags").select("*"),
    supabase
      .from("profiles")
      .select("id, first_name, last_name")
      .order("last_name")
      .limit(1000),
  ]);

  [
    rulePackResult,
    deadlinesResult,
    membersResult,
    peopleResult,
    allegationsResult,
    assessmentsResult,
    setupsResult,
    notificationsResult,
    witnessesResult,
    evidenceResult,
    naturalJusticeResult,
    findingsResult,
    decisionsResult,
    reportSnapshotsResult,
    auditResult,
    clausesResult,
    variationsResult,
    tagsResult,
    caseTagsResult,
    allegationTagsResult,
    profilesResult,
  ].forEach((result) => throwIfError(result.error));

  return {
    incidentCase,
    rulePack: rulePackResult.data!,
    deadlines: deadlinesResult.data ?? [],
    members: membersResult.data ?? [],
    people: peopleResult.data ?? [],
    allegations: allegationsResult.data ?? [],
    assessments: assessmentsResult.data ?? [],
    investigatorSetups: setupsResult.data ?? [],
    notifications: notificationsResult.data ?? [],
    witnesses: witnessesResult.data ?? [],
    evidence: evidenceResult.data ?? [],
    naturalJustice: naturalJusticeResult.data ?? [],
    findings: findingsResult.data ?? [],
    decisions: decisionsResult.data ?? [],
    reportSnapshots: reportSnapshotsResult.data ?? [],
    auditEvents: auditResult.data ?? [],
    ruleClauses: clausesResult.data ?? [],
    localVariations: variationsResult.data ?? [],
    tags: tagsResult.data ?? [],
    caseTags: caseTagsResult.data ?? [],
    allegationTags: (allegationTagsResult.data ?? []).filter((assignment) =>
      (allegationsResult.data ?? []).some(
        (allegation) => allegation.id === assignment.allegation_id,
      ),
    ),
    profileOptions: profilesResult.data ?? [],
  };
}

export async function saveAllegation(
  caseId: string,
  values: {
    allegationId?: string;
    title: string;
    description: string;
    incidentAt?: string;
    location?: string;
    changeReason: string;
    tagIds?: string[];
  },
) {
  const { data, error } = await supabase.rpc(
    "save_discipline_allegation_with_tags",
    {
      p_case_id: caseId,
      p_allegation_id: (values.allegationId || null) as unknown as string,
      p_title: values.title,
      p_description: values.description,
      p_incident_at: (values.incidentAt || null) as unknown as string,
      p_location: (values.location || null) as unknown as string,
      p_change_reason: values.changeReason,
      p_tag_ids: values.tagIds ?? null,
    },
  );
  throwIfError(error);
  return data;
}

export async function recordClassification(
  caseId: string,
  allegationId: string,
  answers: Record<string, unknown>,
) {
  const { data, error } = await supabase.rpc(
    "record_discipline_classification",
    {
      p_case_id: caseId,
      p_allegation_id: allegationId,
      p_assessment_stage: "PRELIMINARY",
      p_answers: answers as Json,
    },
  );
  throwIfError(error);
  return data as unknown as ClassificationResult;
}

export async function setDeadlineCompletion(
  deadlineId: string,
  completed: boolean,
) {
  const { error } = await supabase.rpc("set_discipline_deadline_completion", {
    p_deadline_id: deadlineId,
    p_completed: completed,
    p_completed_at: (completed
      ? new Date().toISOString()
      : null) as unknown as string,
    p_note: completed
      ? "Marked complete in the case workspace."
      : "Reopened in the case workspace.",
  });
  throwIfError(error);
}

export async function updateNaturalJusticeCheck(
  checkId: string,
  completed: boolean,
  notes: string,
  userId: string,
) {
  const { error } = await supabase
    .from("discipline_natural_justice_checks")
    .update({
      completed,
      completed_at: completed ? new Date().toISOString() : null,
      completed_by: completed ? userId : null,
      notes: notes || null,
    })
    .eq("id", checkId);
  throwIfError(error);
}

export async function advanceDisciplineStage(
  caseId: string,
  nextStatus: string,
) {
  const { error } = await supabase.rpc("complete_discipline_stage", {
    p_case_id: caseId,
    p_next_status: nextStatus,
    p_reason: `Phase completed in the case workspace; advancing to ${nextStatus}.`,
  });
  throwIfError(error);
}

export async function signDisciplineReport(caseId: string) {
  const { data, error } = await supabase.rpc("sign_discipline_report", {
    p_case_id: caseId,
  });
  throwIfError(error);
  return data;
}

export async function assignDisciplineCaseMember(
  caseId: string,
  values: {
    userId: string;
    role: string;
    active: boolean;
    reason: string;
  },
) {
  const { data, error } = await supabase.rpc("assign_discipline_case_member", {
    p_case_id: caseId,
    p_user_id: values.userId,
    p_case_role: values.role,
    p_active: values.active,
    p_reason: values.reason,
  });
  throwIfError(error);
  return data;
}

export async function setDisciplinePortalAccess(values: {
  associationId: string;
  userId: string;
  accountMode: "FULL_APP" | "DISCIPLINE_ONLY";
  canCreateCases: boolean;
  canManageConfig: boolean;
  active: boolean;
  reason: string;
}) {
  const { data, error } = await supabase.rpc("set_discipline_portal_access", {
    p_association_id: values.associationId,
    p_user_id: values.userId,
    p_account_mode: values.accountMode,
    p_can_create_cases: values.canCreateCases,
    p_can_manage_config: values.canManageConfig,
    p_active: values.active,
    p_reason: values.reason,
  });
  throwIfError(error);
  return data;
}

export async function addDisciplineCasePerson(
  caseId: string,
  userId: string,
  values: {
    caseRole: string;
    fullName: string;
    organisation?: string;
    personRole?: string;
    email?: string;
    phone?: string;
    isJunior?: boolean;
    notes?: string;
  },
) {
  const { error } = await supabase.from("discipline_case_people").insert({
    case_id: caseId,
    case_role: values.caseRole,
    full_name: values.fullName,
    organisation: values.organisation || null,
    person_role: values.personRole || null,
    email: values.email || null,
    phone: values.phone || null,
    is_junior: values.isJunior,
    notes: values.notes || null,
    created_by: userId,
    updated_by: userId,
  });
  throwIfError(error);
}

export async function addInvestigatorSetup(
  caseId: string,
  userId: string,
  values: {
    leadUserId: string;
    appointedAt: string;
    trainingExperience: string;
    clubAffiliation?: string;
    committeeRole?: string;
    relationshipToParties?: string;
    competitiveInterest?: string;
    actualConflict: boolean;
    perceivedConflict: boolean;
    conflictDecision: string;
    conflictReason: string;
  },
) {
  const { error } = await supabase
    .from("discipline_investigator_setups")
    .insert({
      case_id: caseId,
      lead_user_id: values.leadUserId,
      appointed_at: values.appointedAt,
      appointed_by: userId,
      training_experience: values.trainingExperience,
      club_affiliation: values.clubAffiliation || null,
      committee_role: values.committeeRole || null,
      relationship_to_parties: values.relationshipToParties || null,
      competitive_interest: values.competitiveInterest || null,
      actual_conflict: values.actualConflict,
      perceived_conflict: values.perceivedConflict,
      conflict_decision: values.conflictDecision,
      conflict_reason: values.conflictReason,
      recorded_by: userId,
    });
  throwIfError(error);
}

export async function addDisciplineNotification(
  caseId: string,
  userId: string,
  values: {
    recipientName: string;
    recipientRole?: string;
    recipientEmail?: string;
    noticeType: string;
    sentAt?: string;
    delivered?: boolean;
    acknowledgedAt?: string;
    copyReference?: string;
    noFindingStatementIncluded: boolean;
  },
) {
  const { error } = await supabase.from("discipline_notifications").insert({
    case_id: caseId,
    recipient_name: values.recipientName,
    recipient_role: values.recipientRole || null,
    recipient_email: values.recipientEmail || null,
    notice_type: values.noticeType,
    sent_at: values.sentAt || null,
    delivered: values.delivered,
    acknowledged_at: values.acknowledgedAt || null,
    copy_reference: values.copyReference || null,
    no_finding_statement_included: values.noFindingStatementIncluded,
    created_by: userId,
    updated_by: userId,
  });
  throwIfError(error);
}

export async function addDisciplineWitness(
  caseId: string,
  userId: string,
  values: {
    allegationId?: string;
    name: string;
    roleAndClub?: string;
    contactDetails?: string;
    isJunior?: boolean;
    directWitness?: boolean;
    canAddress: string;
    followUpRequired: boolean;
    requestSentAt?: string;
    responseReceivedAt?: string;
  },
) {
  const { error } = await supabase.from("discipline_witnesses").insert({
    case_id: caseId,
    allegation_id: values.allegationId || null,
    name: values.name,
    role_and_club: values.roleAndClub || null,
    contact_details: values.contactDetails || null,
    is_junior: values.isJunior,
    direct_witness: values.directWitness,
    can_address: values.canAddress,
    follow_up_required: values.followUpRequired,
    request_sent_at: values.requestSentAt || null,
    response_received_at: values.responseReceivedAt || null,
    created_by: userId,
    updated_by: userId,
  });
  throwIfError(error);
}

export async function addDisciplineEvidence(
  caseId: string,
  userId: string,
  values: {
    allegationId?: string;
    evidenceType: string;
    title: string;
    source: string;
    evidenceBasis: string;
    externalUrl?: string;
    notes?: string;
    file?: File;
    requestedAt?: string;
    receivedAt?: string;
    sharedAt?: string;
    supersedesEvidenceId?: string;
    versionNumber?: number;
  },
) {
  let storagePath: string | null = null;
  if (values.file) {
    const safeName = values.file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
    storagePath = `${caseId}/${crypto.randomUUID()}-${safeName}`;
    const { error: uploadError } = await supabase.storage
      .from("discipline-evidence")
      .upload(storagePath, values.file, { upsert: false });
    throwIfError(uploadError);
  }
  const { error } = await supabase.from("discipline_evidence").insert({
    case_id: caseId,
    allegation_id: values.allegationId || null,
    evidence_type: values.evidenceType,
    title: values.title,
    source: values.source,
    evidence_basis: values.evidenceBasis,
    requested_at: values.requestedAt || null,
    received_at: values.receivedAt || null,
    shared_with_reported_person_at: values.sharedAt || null,
    storage_path: storagePath,
    external_url: values.externalUrl || null,
    notes: values.notes || null,
    supersedes_evidence_id: values.supersedesEvidenceId || null,
    version_number: values.versionNumber ?? 1,
    created_by: userId,
  });
  throwIfError(error);
}

export async function createDisciplineEvidenceLink(storagePath: string) {
  const { data, error } = await supabase.storage
    .from("discipline-evidence")
    .createSignedUrl(storagePath, 60);
  throwIfError(error);
  if (!data?.signedUrl)
    throw new Error("A private file link could not be created.");
  return data.signedUrl;
}

export async function saveDisciplineFinding(
  caseId: string,
  allegationId: string,
  values: Record<string, unknown>,
) {
  const { data, error } = await supabase.rpc("save_discipline_finding", {
    p_case_id: caseId,
    p_allegation_id: allegationId,
    p_finding: values as Json,
    p_change_reason: "Finding recorded or revised in the case workspace.",
  });
  throwIfError(error);
  return data;
}

export async function recordDisciplineDecision(
  caseId: string,
  values: {
    outcome: string;
    reason: string;
    ruleReference: string;
    recommendationFollowed: boolean;
    differenceReason?: string;
  },
) {
  const { data, error } = await supabase.rpc("record_discipline_decision", {
    p_case_id: caseId,
    p_outcome: values.outcome,
    p_decision_reason: values.reason,
    p_rule_reference: values.ruleReference,
    p_recommendation_followed: values.recommendationFollowed,
    p_difference_reason: (values.differenceReason || null) as unknown as string,
  });
  throwIfError(error);
  return data;
}

export async function authoriseNaturalJusticeOverride(
  caseId: string,
  reason: string,
) {
  const { data, error } = await supabase.rpc(
    "authorise_discipline_natural_justice_override",
    {
      p_case_id: caseId,
      p_reason: reason,
    },
  );
  throwIfError(error);
  return data;
}
