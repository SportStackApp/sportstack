-- Private, case-assigned Incident & Discipline records for Phase 1.
-- Case content and module configuration are deliberately separate permissions.

alter table public.module_feature_flags
  drop constraint if exists module_feature_flags_module_key_check;
alter table public.module_feature_flags
  add constraint module_feature_flags_module_key_check check (
    module_key in (
      'player_mvp', 'umpire_match_voting', 'committee', 'safety_risk',
      'hockey_trace', 'incident_discipline'
    )
  );

insert into public.permission_catalogue
  (permission_key, module_key, label, description, category, default_allowed)
values
  (
    'module.incident_discipline.access',
    'incident_discipline',
    'Access Incident & Discipline',
    'Open assigned Incident & Discipline cases.',
    'MODULE',
    false
  )
on conflict (permission_key) do update set
  module_key = excluded.module_key,
  label = excluded.label,
  description = excluded.description,
  category = excluded.category,
  default_allowed = excluded.default_allowed;

create or replace function public.set_module_feature_flag(
  p_module_key text,
  p_scope_type text,
  p_scope_id uuid,
  p_enabled boolean,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor_id uuid := auth.uid();
  v_flag_id uuid;
begin
  if p_module_key not in (
    'player_mvp', 'umpire_match_voting', 'committee', 'safety_risk',
    'hockey_trace', 'incident_discipline'
  ) then
    raise exception 'Unknown SportStack module.';
  end if;
  if p_scope_type not in ('ASSOCIATION', 'CLUB', 'DIVISION', 'TEAM') then
    raise exception 'Unknown module scope.';
  end if;
  if not public.can_manage_module_scope(v_actor_id, p_scope_type, p_scope_id) then
    raise exception 'You do not have permission to manage modules at this scope.';
  end if;
  if (p_scope_type = 'ASSOCIATION' and not exists (select 1 from public.associations where id = p_scope_id))
    or (p_scope_type = 'CLUB' and not exists (select 1 from public.clubs where id = p_scope_id))
    or (p_scope_type = 'DIVISION' and not exists (select 1 from public.divisions where id = p_scope_id))
    or (p_scope_type = 'TEAM' and not exists (select 1 from public.teams where id = p_scope_id)) then
    raise exception 'The selected module scope was not found.';
  end if;

  insert into public.module_feature_flags (
    module_key, scope_type, scope_id, enabled, notes, created_by, updated_by
  ) values (
    p_module_key, p_scope_type, p_scope_id, p_enabled,
    nullif(btrim(p_notes), ''), v_actor_id, v_actor_id
  )
  on conflict (module_key, scope_type, scope_id) do update set
    enabled = excluded.enabled,
    notes = excluded.notes,
    updated_by = v_actor_id,
    updated_at = now()
  returning id into v_flag_id;

  return jsonb_build_object(
    'id', v_flag_id,
    'module_key', p_module_key,
    'scope_type', p_scope_type,
    'scope_id', p_scope_id,
    'enabled', p_enabled
  );
end;
$function$;

create or replace function public.resolve_module_enabled(
  p_module_key text,
  p_association_id uuid default null,
  p_club_id uuid default null,
  p_division_id uuid default null,
  p_team_id uuid default null
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_enabled boolean;
begin
  if p_module_key not in (
    'player_mvp', 'umpire_match_voting', 'committee', 'safety_risk',
    'hockey_trace', 'incident_discipline'
  ) then
    raise exception 'Unknown SportStack module.';
  end if;

  select flag.enabled into v_enabled
  from public.module_feature_flags flag
  where flag.module_key = p_module_key
    and (
      (flag.scope_type = 'TEAM' and flag.scope_id = p_team_id)
      or (flag.scope_type = 'DIVISION' and flag.scope_id = p_division_id)
      or (flag.scope_type = 'CLUB' and flag.scope_id = p_club_id)
      or (flag.scope_type = 'ASSOCIATION' and flag.scope_id = p_association_id)
    )
  order by case flag.scope_type
    when 'TEAM' then 1
    when 'DIVISION' then 2
    when 'CLUB' then 3
    when 'ASSOCIATION' then 4
  end
  limit 1;

  return coalesce(v_enabled, p_module_key not in ('hockey_trace', 'incident_discipline'));
end;
$function$;

create table public.discipline_rule_packs (
  id uuid primary key default gen_random_uuid(),
  association_id uuid not null references public.associations(id) on delete cascade,
  code text not null,
  title text not null,
  version text not null,
  status text not null default 'REVIEW_REQUIRED',
  timezone text not null default 'Australia/Melbourne',
  source_manifest jsonb not null default '[]'::jsonb,
  approval_notes text,
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  effective_from date,
  effective_to date,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint discipline_rule_packs_code_check check (length(btrim(code)) between 2 and 50),
  constraint discipline_rule_packs_title_check check (length(btrim(title)) between 2 and 160),
  constraint discipline_rule_packs_status_check check (
    status in ('REVIEW_REQUIRED', 'PUBLISHED', 'RETIRED')
  ),
  constraint discipline_rule_packs_sources_array check (jsonb_typeof(source_manifest) = 'array'),
  constraint discipline_rule_packs_dates_check check (
    effective_to is null or effective_from is null or effective_to >= effective_from
  ),
  unique (association_id, code, version)
);

create table public.discipline_rule_clauses (
  id uuid primary key default gen_random_uuid(),
  rule_pack_id uuid not null references public.discipline_rule_packs(id) on delete cascade,
  reference text not null,
  title text not null,
  verified_summary text not null,
  source_url text not null,
  source_page integer,
  item_type text not null default 'RULE',
  source_status text not null default 'VERIFIED',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint discipline_rule_clauses_type_check check (
    item_type in ('RULE', 'LOCAL_INTERPRETATION', 'SOURCE_AMBIGUITY')
  ),
  constraint discipline_rule_clauses_status_check check (
    source_status in ('VERIFIED', 'REVIEW_REQUIRED', 'CONFLICT')
  ),
  unique (rule_pack_id, reference)
);

create table public.discipline_deadline_definitions (
  id uuid primary key default gen_random_uuid(),
  rule_pack_id uuid not null references public.discipline_rule_packs(id) on delete cascade,
  pathway text not null,
  action_key text not null,
  label text not null,
  business_day_number integer not null,
  due_local_time time not null,
  rule_reference text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint discipline_deadline_definitions_path_check check (
    pathway in ('REGULAR', 'DIRECT_TRIBUNAL')
  ),
  constraint discipline_deadline_definitions_day_check check (business_day_number between 1 and 30),
  unique (rule_pack_id, pathway, action_key)
);

create table public.discipline_classification_rules (
  id uuid primary key default gen_random_uuid(),
  rule_pack_id uuid not null references public.discipline_rule_packs(id) on delete cascade,
  classification_code text not null,
  label text not null,
  criteria jsonb not null,
  person_category text not null,
  recommended_penalty_value numeric,
  recommended_penalty_unit text,
  recommended_penalty_text text not null,
  tribunal_required boolean not null,
  rule_reference text not null,
  priority integer not null default 0,
  source_warning text,
  created_at timestamptz not null default now(),
  constraint discipline_classification_criteria_object check (jsonb_typeof(criteria) = 'object'),
  constraint discipline_classification_person_check check (
    person_category in ('N_A', 'MATCH_PARTICIPANT', 'SPECTATOR', 'OFFICIAL', 'ANY')
  ),
  constraint discipline_classification_unit_check check (
    recommended_penalty_unit is null
    or recommended_penalty_unit in ('MATCH', 'WEEK', 'REPRIMAND', 'DOLLAR')
  )
);
create unique index discipline_classification_rules_match_key
  on public.discipline_classification_rules (
    rule_pack_id, classification_code, person_category, criteria
  );

create table public.discipline_calendar_exclusions (
  id uuid primary key default gen_random_uuid(),
  association_id uuid not null references public.associations(id) on delete cascade,
  exclusion_date date not null,
  label text not null,
  exclusion_type text not null,
  source_url text,
  active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint discipline_calendar_exclusions_type_check check (
    exclusion_type in ('VICTORIAN_PUBLIC_HOLIDAY', 'HB_MANUAL_EXCLUSION')
  ),
  unique (association_id, exclusion_date)
);

create table public.discipline_local_variations (
  id uuid primary key default gen_random_uuid(),
  rule_pack_id uuid not null references public.discipline_rule_packs(id) on delete cascade,
  variation_key text not null,
  rule_reference text not null,
  hv_requirement text not null,
  issue text not null,
  proposed_hb_treatment text,
  status text not null default 'REVIEW_REQUIRED',
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  effective_from date,
  review_date date,
  created_at timestamptz not null default now(),
  constraint discipline_local_variations_status_check check (
    status in ('REVIEW_REQUIRED', 'APPROVED', 'REJECTED', 'SUPERSEDED')
  ),
  unique (rule_pack_id, variation_key)
);

create table public.discipline_portal_access (
  id uuid primary key default gen_random_uuid(),
  association_id uuid not null references public.associations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  account_mode text not null default 'FULL_APP',
  can_create_cases boolean not null default false,
  can_manage_config boolean not null default false,
  active boolean not null default true,
  reason text not null,
  granted_by uuid references public.profiles(id) on delete set null,
  granted_at timestamptz not null default now(),
  revoked_by uuid references public.profiles(id) on delete set null,
  revoked_at timestamptz,
  constraint discipline_portal_access_mode_check check (
    account_mode in ('FULL_APP', 'DISCIPLINE_ONLY')
  ),
  constraint discipline_portal_access_reason_check check (length(btrim(reason)) between 3 and 500),
  unique (association_id, user_id)
);
create index discipline_portal_access_user_idx
  on public.discipline_portal_access (user_id, active, association_id);

create sequence public.discipline_case_number_seq;

create table public.discipline_cases (
  id uuid primary key default gen_random_uuid(),
  case_number text not null unique,
  association_id uuid not null references public.associations(id) on delete restrict,
  rule_pack_id uuid not null references public.discipline_rule_packs(id) on delete restrict,
  status text not null default 'DRAFT',
  title text not null,
  jurisdiction_path text not null default 'UNASSESSED',
  jurisdiction_reason text,
  immediate_safety_risk boolean not null default false,
  immediate_safety_action text,
  fixture_id uuid references public.fixtures(id) on delete set null,
  safety_record_id uuid references public.rg_risk_register(id) on delete set null,
  committee_id uuid references public.committees(id) on delete set null,
  competition text,
  grade text,
  round_label text,
  round_type text not null,
  relevant_club_participating boolean,
  first_named_team text,
  second_named_team text,
  match_concluded_at timestamptz not null,
  incident_at timestamptz,
  venue text,
  incident_location text,
  report_received_at timestamptz,
  report_method text,
  report_in_writing boolean,
  prescribed_form_used boolean,
  report_complete boolean,
  desired_outcome_included boolean,
  prior_presentation_completed boolean,
  pathway text not null default 'REVIEW_REQUIRED',
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  closed_at timestamptz,
  constraint discipline_cases_status_check check (
    status in (
      'DRAFT', 'SCREENING', 'INVESTIGATOR_SETUP', 'INVESTIGATING',
      'FINDINGS', 'REPORT_SIGNED', 'HB_DECISION', 'CLOSED', 'REFERRED'
    )
  ),
  constraint discipline_cases_title_check check (length(btrim(title)) between 3 and 200),
  constraint discipline_cases_jurisdiction_check check (
    jurisdiction_path in (
      'UNASSESSED', 'COMPETITION_RULE_7', 'NIF_REFERRAL',
      'EXTERNAL_SAFETY_REFERRAL', 'OTHER_REFERRAL'
    )
  ),
  constraint discipline_cases_round_type_check check (
    round_type in ('REGULAR', 'LAST_REGULAR', 'FINALS')
  ),
  constraint discipline_cases_pathway_check check (
    pathway in ('REGULAR', 'DIRECT_TRIBUNAL', 'REVIEW_REQUIRED', 'EXTERNAL_REFERRAL')
  ),
  constraint discipline_cases_finals_fact_check check (
    round_type = 'REGULAR' or relevant_club_participating is not null
  ),
  constraint discipline_cases_safety_action_check check (
    not immediate_safety_risk or nullif(btrim(immediate_safety_action), '') is not null
  )
);
create index discipline_cases_association_status_idx
  on public.discipline_cases (association_id, status, updated_at desc);
create index discipline_cases_rule_pack_idx on public.discipline_cases (rule_pack_id);
create index discipline_cases_fixture_idx on public.discipline_cases (fixture_id) where fixture_id is not null;
create index discipline_cases_safety_idx on public.discipline_cases (safety_record_id) where safety_record_id is not null;
create index discipline_cases_committee_idx on public.discipline_cases (committee_id) where committee_id is not null;

create table public.discipline_case_members (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.discipline_cases(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete restrict,
  case_role text not null,
  active boolean not null default true,
  assignment_reason text not null,
  assigned_by uuid not null references public.profiles(id) on delete restrict,
  assigned_at timestamptz not null default now(),
  revoked_by uuid references public.profiles(id) on delete set null,
  revoked_at timestamptz,
  constraint discipline_case_members_role_check check (
    case_role in (
      'CASE_COORDINATOR', 'LEAD_INVESTIGATOR', 'SUPPORT_INVESTIGATOR',
      'DECISION_MAKER', 'READ_ONLY'
    )
  ),
  constraint discipline_case_members_reason_check check (
    length(btrim(assignment_reason)) between 3 and 500
  ),
  unique (case_id, user_id)
);
create index discipline_case_members_user_idx
  on public.discipline_case_members (user_id, active, case_id);

create table public.discipline_case_people (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.discipline_cases(id) on delete cascade,
  case_role text not null,
  full_name text not null,
  organisation text,
  person_role text,
  email text,
  phone text,
  is_junior boolean,
  notes text,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint discipline_case_people_role_check check (
    case_role in ('REPORTER', 'REPORTED_PERSON', 'AFFECTED_PERSON', 'WITNESS', 'OTHER')
  ),
  constraint discipline_case_people_name_check check (length(btrim(full_name)) between 2 and 160)
);
create index discipline_case_people_case_idx on public.discipline_case_people (case_id, case_role);

create table public.discipline_allegations (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.discipline_cases(id) on delete cascade,
  allegation_number integer not null,
  title text not null,
  description text not null,
  incident_at timestamptz,
  location text,
  initial_classification_code text,
  recommended_classification_code text,
  final_charge text,
  finding text,
  revision_number integer not null default 1,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint discipline_allegations_title_check check (length(btrim(title)) between 3 and 200),
  constraint discipline_allegations_description_check check (length(btrim(description)) between 5 and 10000),
  constraint discipline_allegations_finding_check check (
    finding is null or finding in ('SUBSTANTIATED', 'UNSUBSTANTIATED', 'UNABLE_TO_DETERMINE')
  ),
  unique (case_id, allegation_number)
);
create index discipline_allegations_case_idx on public.discipline_allegations (case_id, allegation_number);

create table public.discipline_allegation_revisions (
  id uuid primary key default gen_random_uuid(),
  allegation_id uuid not null references public.discipline_allegations(id) on delete cascade,
  case_id uuid not null references public.discipline_cases(id) on delete cascade,
  revision_number integer not null,
  snapshot jsonb not null,
  change_reason text not null,
  changed_by uuid not null references public.profiles(id) on delete restrict,
  changed_at timestamptz not null default now(),
  unique (allegation_id, revision_number)
);

create table public.discipline_classification_assessments (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.discipline_cases(id) on delete cascade,
  allegation_id uuid not null references public.discipline_allegations(id) on delete cascade,
  assessment_stage text not null,
  answers jsonb not null,
  classification_rule_id uuid references public.discipline_classification_rules(id) on delete restrict,
  classification_code text not null,
  classification_label text not null,
  tribunal_readiness text not null,
  penalty_guidance text,
  explanation text not null,
  assessed_by uuid not null references public.profiles(id) on delete restrict,
  assessed_at timestamptz not null default now(),
  constraint discipline_classification_assessments_stage_check check (
    assessment_stage in ('PRELIMINARY', 'INVESTIGATOR_RECOMMENDATION')
  ),
  constraint discipline_classification_assessments_answers_check check (jsonb_typeof(answers) = 'object'),
  constraint discipline_classification_assessments_readiness_check check (
    tribunal_readiness in ('GREEN', 'AMBER', 'RED')
  )
);
create index discipline_classification_assessments_case_idx
  on public.discipline_classification_assessments (case_id, allegation_id, assessed_at desc);

create table public.discipline_deadlines (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.discipline_cases(id) on delete cascade,
  definition_id uuid not null references public.discipline_deadline_definitions(id) on delete restrict,
  action_key text not null,
  label text not null,
  trigger_at timestamptz not null,
  calculation_text text not null,
  due_at timestamptz not null,
  rule_reference text not null,
  completed_at timestamptz,
  completed_by uuid references public.profiles(id) on delete set null,
  completion_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (case_id, action_key)
);
create index discipline_deadlines_case_due_idx on public.discipline_deadlines (case_id, due_at);

create table public.discipline_deadline_events (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.discipline_cases(id) on delete cascade,
  deadline_id uuid references public.discipline_deadlines(id) on delete cascade,
  event_type text not null,
  previous_due_at timestamptz,
  new_due_at timestamptz,
  previous_completed_at timestamptz,
  new_completed_at timestamptz,
  reason text not null,
  actor_id uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint discipline_deadline_events_type_check check (
    event_type in ('INITIAL_CALCULATION', 'RECALCULATED', 'COMPLETED', 'REOPENED')
  )
);

create table public.discipline_investigator_setups (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.discipline_cases(id) on delete cascade,
  lead_user_id uuid not null references public.profiles(id) on delete restrict,
  support_user_ids uuid[] not null default '{}'::uuid[],
  appointed_at timestamptz not null,
  appointed_by uuid not null references public.profiles(id) on delete restrict,
  training_experience text not null,
  club_affiliation text,
  committee_role text,
  relationship_to_parties text,
  competitive_interest text,
  actual_conflict boolean not null,
  perceived_conflict boolean not null,
  conflict_decision text not null,
  conflict_reason text not null,
  recorded_by uuid not null references public.profiles(id) on delete restrict,
  recorded_at timestamptz not null default now(),
  constraint discipline_investigator_conflict_decision_check check (
    conflict_decision in ('NO_CONFLICT', 'MANAGED', 'REPLACE_INVESTIGATOR')
  )
);

create table public.discipline_notifications (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.discipline_cases(id) on delete cascade,
  recipient_name text not null,
  recipient_role text,
  recipient_email text,
  notice_type text not null,
  sent_at timestamptz,
  delivered boolean,
  acknowledged_at timestamptz,
  copy_reference text,
  no_finding_statement_included boolean not null default false,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);
create index discipline_notifications_case_idx on public.discipline_notifications (case_id, created_at);

create table public.discipline_witnesses (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.discipline_cases(id) on delete cascade,
  allegation_id uuid references public.discipline_allegations(id) on delete set null,
  name text not null,
  role_and_club text,
  contact_details text,
  is_junior boolean,
  direct_witness boolean,
  can_address text not null,
  request_sent_at timestamptz,
  response_received_at timestamptz,
  follow_up_required boolean not null default false,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table public.discipline_evidence (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.discipline_cases(id) on delete cascade,
  allegation_id uuid references public.discipline_allegations(id) on delete set null,
  evidence_type text not null,
  title text not null,
  source text not null,
  requested_at timestamptz,
  received_at timestamptz,
  evidence_basis text not null,
  storage_path text,
  external_url text,
  shared_with_reported_person_at timestamptz,
  notes text,
  version_number integer not null default 1,
  supersedes_evidence_id uuid references public.discipline_evidence(id) on delete restrict,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint discipline_evidence_basis_check check (
    evidence_basis in ('DIRECT', 'SECOND_HAND', 'UNKNOWN')
  ),
  constraint discipline_evidence_reference_check check (
    storage_path is not null or external_url is not null or notes is not null
  )
);
create index discipline_evidence_case_idx on public.discipline_evidence (case_id, allegation_id, created_at);

create table public.discipline_natural_justice_checks (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.discipline_cases(id) on delete cascade,
  check_key text not null,
  label text not null,
  required boolean not null default true,
  completed boolean not null default false,
  completed_at timestamptz,
  completed_by uuid references public.profiles(id) on delete set null,
  notes text,
  rule_basis text not null default 'HB operating safeguard pending approval',
  updated_at timestamptz not null default now(),
  unique (case_id, check_key)
);

create table public.discipline_findings (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.discipline_cases(id) on delete cascade,
  allegation_id uuid not null references public.discipline_allegations(id) on delete cascade,
  supporting_evidence text not null,
  contradicting_evidence text,
  inconsistencies text,
  missing_evidence text,
  reported_person_response text,
  reasoning text not null,
  recommended_finding text not null,
  recommended_classification_code text,
  classification_change_reason text,
  revision_number integer not null default 1,
  recorded_by uuid not null references public.profiles(id) on delete restrict,
  recorded_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint discipline_findings_result_check check (
    recommended_finding in ('SUBSTANTIATED', 'UNSUBSTANTIATED', 'UNABLE_TO_DETERMINE')
  ),
  unique (allegation_id)
);

create table public.discipline_finding_revisions (
  id uuid primary key default gen_random_uuid(),
  finding_id uuid not null references public.discipline_findings(id) on delete cascade,
  case_id uuid not null references public.discipline_cases(id) on delete cascade,
  revision_number integer not null,
  snapshot jsonb not null,
  change_reason text not null,
  changed_by uuid not null references public.profiles(id) on delete restrict,
  changed_at timestamptz not null default now(),
  unique (finding_id, revision_number)
);

create table public.discipline_report_snapshots (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.discipline_cases(id) on delete restrict,
  snapshot_number integer not null,
  report_data jsonb not null,
  natural_justice_override_reason text,
  signed_by uuid not null references public.profiles(id) on delete restrict,
  signed_at timestamptz not null default now(),
  sha256 text not null,
  constraint discipline_report_snapshots_hash_check check (sha256 ~ '^[0-9a-f]{64}$'),
  unique (case_id, snapshot_number)
);

create table public.discipline_decisions (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.discipline_cases(id) on delete restrict,
  outcome text not null,
  decision_reason text not null,
  rule_reference text not null,
  recommendation_followed boolean,
  difference_reason text,
  decided_by uuid not null references public.profiles(id) on delete restrict,
  decided_at timestamptz not null default now(),
  constraint discipline_decisions_outcome_check check (
    outcome in (
      'NO_ACTION', 'MISCONDUCT_PENALTY_GUIDANCE', 'TRIBUNAL_REFERRAL',
      'MEDIATION_REFERRAL', 'COMBINATION_REFERRAL', 'OTHER_APPROPRIATE_COURSE'
    )
  ),
  constraint discipline_decisions_difference_reason_check check (
    recommendation_followed is distinct from false
    or nullif(btrim(difference_reason), '') is not null
  )
);

create table public.discipline_audit_events (
  id bigint generated always as identity primary key,
  case_id uuid references public.discipline_cases(id) on delete restrict,
  association_id uuid not null references public.associations(id) on delete restrict,
  event_type text not null,
  entity_type text not null,
  entity_id text,
  previous_data jsonb,
  new_data jsonb,
  reason text,
  actor_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index discipline_audit_events_case_idx
  on public.discipline_audit_events (case_id, created_at desc);
create index discipline_audit_events_association_idx
  on public.discipline_audit_events (association_id, created_at desc);

create or replace function private.discipline_set_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog
as $function$
begin
  new.updated_at := now();
  return new;
end;
$function$;

create trigger discipline_cases_updated_at
before update on public.discipline_cases
for each row execute function private.discipline_set_updated_at();
create trigger discipline_case_people_updated_at
before update on public.discipline_case_people
for each row execute function private.discipline_set_updated_at();
create trigger discipline_allegations_updated_at
before update on public.discipline_allegations
for each row execute function private.discipline_set_updated_at();
create trigger discipline_deadlines_updated_at
before update on public.discipline_deadlines
for each row execute function private.discipline_set_updated_at();
create trigger discipline_notifications_updated_at
before update on public.discipline_notifications
for each row execute function private.discipline_set_updated_at();
create trigger discipline_witnesses_updated_at
before update on public.discipline_witnesses
for each row execute function private.discipline_set_updated_at();
create trigger discipline_natural_justice_updated_at
before update on public.discipline_natural_justice_checks
for each row execute function private.discipline_set_updated_at();
create trigger discipline_findings_updated_at
before update on public.discipline_findings
for each row execute function private.discipline_set_updated_at();

comment on table public.discipline_cases is
  'Private Phase 1 incident cases. Access requires an active case assignment.';
comment on table public.discipline_audit_events is
  'Append-only Incident & Discipline history. Browser roles have no write grant.';
comment on table public.discipline_report_snapshots is
  'Immutable signed investigation-report snapshots.';
comment on column public.discipline_cases.pathway is
  'Workflow timing path only; it is not a finding of guilt or automatic penalty.';
