-- Correct the Incident and Discipline workflow so an ordinary Rule 7.7
-- outcome is made by Hockey Ballarat and a three-person panel is reserved for
-- the formal Tribunal. Existing review-panel rows remain untouched as audit
-- history.

alter table public.discipline_case_people
  add column if not exists case_reference text;

with numbered as (
  select
    person.id,
    case person.case_role
      when 'REPORTER' then 'Reporter'
      when 'REPORTED_PERSON' then 'Reported Person'
      when 'WITNESS' then 'Witness'
      when 'AFFECTED_PERSON' then 'Affected Person'
      else 'Other Person'
    end || ' ' || row_number() over (
      partition by person.case_id, person.case_role
      order by person.created_at, person.id
    )::text as reference
  from public.discipline_case_people person
  where person.case_reference is null
)
update public.discipline_case_people person
set case_reference = numbered.reference
from numbered
where numbered.id = person.id;

alter table public.discipline_case_people
  alter column case_reference set not null;

create unique index if not exists discipline_case_people_case_reference_idx
  on public.discipline_case_people (case_id, case_reference);

create or replace function private.discipline_assign_case_reference()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_prefix text;
  v_next_number integer;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(new.case_id::text || ':' || new.case_role, 0)
  );
  v_prefix := case new.case_role
    when 'REPORTER' then 'Reporter'
    when 'REPORTED_PERSON' then 'Reported Person'
    when 'WITNESS' then 'Witness'
    when 'AFFECTED_PERSON' then 'Affected Person'
    else 'Other Person'
  end;
  select coalesce(max((regexp_match(person.case_reference, '([0-9]+)$'))[1]::integer), 0) + 1
  into v_next_number
  from public.discipline_case_people person
  where person.case_id = new.case_id
    and person.case_role = new.case_role;
  new.case_reference := v_prefix || ' ' || v_next_number::text;
  return new;
end;
$function$;

create or replace function private.discipline_keep_case_reference_immutable()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if new.case_reference is distinct from old.case_reference then
    raise exception 'A neutral case reference cannot be changed.';
  end if;
  return new;
end;
$function$;

drop trigger if exists discipline_case_people_assign_reference on public.discipline_case_people;
create trigger discipline_case_people_assign_reference
before insert on public.discipline_case_people
for each row when (new.case_reference is null)
execute function private.discipline_assign_case_reference();

drop trigger if exists discipline_case_people_reference_immutable on public.discipline_case_people;
create trigger discipline_case_people_reference_immutable
before update on public.discipline_case_people
for each row execute function private.discipline_keep_case_reference_immutable();

create table public.discipline_risk_assessments (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.discipline_cases(id) on delete restrict,
  revision_number integer not null,
  risk_description text not null,
  likelihood text not null,
  severity text not null,
  mitigation_action text not null,
  responsible_person text,
  review_at timestamptz,
  tag_ids uuid[] not null default '{}',
  status text not null default 'ACTIVE',
  supersedes_assessment_id uuid references public.discipline_risk_assessments(id) on delete restrict,
  recorded_by uuid not null references public.profiles(id) on delete restrict,
  recorded_at timestamptz not null default now(),
  constraint discipline_risk_likelihood_check check (
    likelihood in ('RARE', 'UNLIKELY', 'POSSIBLE', 'LIKELY', 'ALMOST_CERTAIN')
  ),
  constraint discipline_risk_severity_check check (
    severity in ('INSIGNIFICANT', 'MINOR', 'MODERATE', 'MAJOR', 'SEVERE')
  ),
  constraint discipline_risk_status_check check (status in ('ACTIVE', 'REVIEWED', 'CLOSED')),
  constraint discipline_risk_description_check check (length(btrim(risk_description)) >= 5),
  constraint discipline_risk_mitigation_check check (length(btrim(mitigation_action)) >= 5),
  unique (case_id, revision_number)
);

create index discipline_risk_assessments_case_idx
  on public.discipline_risk_assessments (case_id, revision_number desc);

alter table public.discipline_risk_assessments enable row level security;

create policy discipline_risk_assessments_select
on public.discipline_risk_assessments for select to authenticated
using (private.discipline_can_read_case(case_id, (select auth.uid())));

revoke all on table public.discipline_risk_assessments from public, anon;
grant select on table public.discipline_risk_assessments to authenticated;
grant all on table public.discipline_risk_assessments to service_role;

create trigger discipline_risk_assessments_audit
after insert or update or delete on public.discipline_risk_assessments
for each row execute function private.discipline_capture_row_audit();

create or replace function public.record_discipline_risk_assessment(
  p_case_id uuid,
  p_assessment jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor_id uuid := auth.uid();
  v_id uuid;
  v_revision integer;
  v_previous_id uuid;
begin
  if v_actor_id is null or not private.discipline_can_manage_case(p_case_id, v_actor_id) then
    raise exception 'Only the Case Coordinator or authorised committee delegate can record an immediate risk assessment.';
  end if;
  if length(btrim(coalesce(p_assessment ->> 'risk_description', ''))) < 5
     or length(btrim(coalesce(p_assessment ->> 'mitigation_action', ''))) < 5 then
    raise exception 'Record the risk and the action used to reduce it.';
  end if;
  if p_assessment ->> 'likelihood' not in ('RARE', 'UNLIKELY', 'POSSIBLE', 'LIKELY', 'ALMOST_CERTAIN')
     or p_assessment ->> 'severity' not in ('INSIGNIFICANT', 'MINOR', 'MODERATE', 'MAJOR', 'SEVERE') then
    raise exception 'Select a valid likelihood and severity.';
  end if;

  select assessment.id, assessment.revision_number
  into v_previous_id, v_revision
  from public.discipline_risk_assessments assessment
  where assessment.case_id = p_case_id
  order by assessment.revision_number desc
  limit 1;

  insert into public.discipline_risk_assessments (
    case_id, revision_number, risk_description, likelihood, severity,
    mitigation_action, responsible_person, review_at, tag_ids, status,
    supersedes_assessment_id, recorded_by
  ) values (
    p_case_id, coalesce(v_revision, 0) + 1,
    btrim(p_assessment ->> 'risk_description'), p_assessment ->> 'likelihood',
    p_assessment ->> 'severity', btrim(p_assessment ->> 'mitigation_action'),
    nullif(btrim(p_assessment ->> 'responsible_person'), ''),
    nullif(p_assessment ->> 'review_at', '')::timestamptz,
    coalesce(array(select value::uuid from jsonb_array_elements_text(coalesce(p_assessment -> 'tag_ids', '[]'::jsonb))), '{}'),
    coalesce(nullif(p_assessment ->> 'status', ''), 'ACTIVE'),
    v_previous_id, v_actor_id
  ) returning id into v_id;

  perform set_config('app.discipline_change_reason', 'Immediate safety risk assessment recorded', true);
  perform set_config('app.discipline_actor_id', v_actor_id::text, true);
  update public.discipline_cases
  set immediate_safety_risk = true,
      immediate_safety_action = btrim(p_assessment ->> 'mitigation_action'),
      updated_by = v_actor_id
  where id = p_case_id;
  return v_id;
end;
$function$;

alter table public.discipline_decisions
  add column if not exists decision_body text not null default 'HOCKEY_BALLARAT',
  add column if not exists authority_reference text,
  add column if not exists resolution_reference text;

create or replace function public.record_discipline_decision(
  p_case_id uuid,
  p_outcome text,
  p_decision_reason text,
  p_rule_reference text,
  p_recommendation_followed boolean,
  p_difference_reason text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor_id uuid := auth.uid();
  v_decision_id uuid;
  v_final_status text;
begin
  if not private.discipline_has_case_role(
    p_case_id,
    array['CASE_COORDINATOR', 'DECISION_MAKER']::text[],
    v_actor_id
  ) then
    raise exception 'Only a non-conflicted Hockey Ballarat decision maker can record the Rule 7.7 outcome.';
  end if;
  if not exists (
    select 1 from public.discipline_cases incident_case
    where incident_case.id = p_case_id and incident_case.status in ('REPORT_SIGNED', 'HB_DECISION')
  ) then
    raise exception 'A signed investigation report is required before an ordinary Rule 7.7 decision.';
  end if;
  if p_outcome not in (
    'NO_ACTION', 'MISCONDUCT_PENALTY_GUIDANCE', 'TRIBUNAL_REFERRAL',
    'MEDIATION_REFERRAL', 'COMBINATION_REFERRAL', 'OTHER_APPROPRIATE_COURSE'
  ) then raise exception 'Decision outcome is not valid.'; end if;
  if length(btrim(coalesce(p_decision_reason, ''))) < 10 then
    raise exception 'Decision reasoning is required.';
  end if;
  if nullif(btrim(p_rule_reference), '') is null then
    raise exception 'A rule source is required.';
  end if;
  if p_recommendation_followed is false and length(btrim(coalesce(p_difference_reason, ''))) < 5 then
    raise exception 'Explain why the recommendation was not followed.';
  end if;

  v_final_status := case
    when p_outcome in ('NO_ACTION', 'MISCONDUCT_PENALTY_GUIDANCE') then 'CLOSED'
    else 'REFERRED'
  end;
  insert into public.discipline_decisions (
    case_id, outcome, decision_reason, rule_reference,
    recommendation_followed, difference_reason, decided_by,
    decision_body, authority_reference
  ) values (
    p_case_id, p_outcome, btrim(p_decision_reason), btrim(p_rule_reference),
    p_recommendation_followed, nullif(btrim(p_difference_reason), ''), v_actor_id,
    'HOCKEY_BALLARAT', 'HV Rule 7.7'
  ) returning id into v_decision_id;

  perform set_config('app.discipline_change_reason', 'Hockey Ballarat Rule 7.7 decision recorded', true);
  perform set_config('app.discipline_actor_id', v_actor_id::text, true);
  update public.discipline_cases
  set status = v_final_status,
      closed_at = case when v_final_status = 'CLOSED' then now() else null end,
      updated_by = v_actor_id
  where id = p_case_id;
  return v_decision_id;
end;
$function$;

create or replace function public.complete_discipline_stage(
  p_case_id uuid,
  p_next_status text,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor_id uuid := auth.uid();
  v_current text;
  v_allowed boolean := false;
begin
  if not private.discipline_can_manage_case(p_case_id, v_actor_id)
     and not private.discipline_has_case_role(p_case_id, array['LEAD_INVESTIGATOR']::text[], v_actor_id) then
    raise exception 'You do not have permission to advance this case.';
  end if;
  if length(btrim(coalesce(p_reason, ''))) < 5 then
    raise exception 'A stage-change reason is required.';
  end if;
  select status into v_current from public.discipline_cases where id = p_case_id;
  v_allowed := (v_current, p_next_status) in (
    ('DRAFT', 'SCREENING'),
    ('SCREENING', 'INVESTIGATOR_SETUP'),
    ('INVESTIGATOR_SETUP', 'INVESTIGATING'),
    ('INVESTIGATING', 'FINDINGS'),
    ('REPORT_SIGNED', 'HB_DECISION')
  );
  if not v_allowed then raise exception 'That stage transition is not allowed.'; end if;
  if p_next_status = 'INVESTIGATING' and not exists (
    select 1 from public.discipline_investigator_setups setup
    where setup.case_id = p_case_id and setup.conflict_decision <> 'REPLACE_INVESTIGATOR'
  ) then
    raise exception 'Record a suitable Investigation Officer and conflict decision first.';
  end if;
  perform set_config('app.discipline_change_reason', btrim(p_reason), true);
  perform set_config('app.discipline_actor_id', v_actor_id::text, true);
  update public.discipline_cases set status = p_next_status, updated_by = v_actor_id
  where id = p_case_id;
end;
$function$;

create or replace function public.refer_discipline_case_to_tribunal(
  p_case_id uuid,
  p_reason text,
  p_authority_reference text
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor_id uuid := auth.uid();
  v_case public.discipline_cases%rowtype;
begin
  if not private.discipline_has_case_role(p_case_id, array['CASE_COORDINATOR', 'DECISION_MAKER']::text[], v_actor_id) then
    raise exception 'Only the Case Coordinator or a non-conflicted Hockey Ballarat decision maker can refer a matter to the Tribunal.';
  end if;
  select * into v_case from public.discipline_cases where id = p_case_id;
  if v_case.pathway = 'DIRECT_TRIBUNAL' then
    if v_case.status not in ('DRAFT', 'SCREENING', 'REFERRED') then
      raise exception 'The direct Tribunal pathway is not available at this stage.';
    end if;
  elsif v_case.status not in ('REPORT_SIGNED', 'HB_DECISION', 'REFERRED') then
    raise exception 'A signed investigation report is required before an ordinary Tribunal referral.';
  end if;
  if length(btrim(coalesce(p_reason, ''))) < 10
     or length(btrim(coalesce(p_authority_reference, ''))) < 3 then
    raise exception 'Record the referral reason and authority reference.';
  end if;
  perform set_config('app.discipline_change_reason', btrim(p_reason), true);
  perform set_config('app.discipline_actor_id', v_actor_id::text, true);
  update public.discipline_cases
  set status = 'REFERRED', closed_at = null, updated_by = v_actor_id
  where id = p_case_id;
end;
$function$;

create or replace function public.sign_discipline_report(p_case_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor_id uuid := auth.uid();
  v_case public.discipline_cases%rowtype;
  v_snapshot jsonb;
  v_snapshot_id uuid;
  v_snapshot_number integer;
  v_override public.discipline_natural_justice_overrides%rowtype;
  v_missing_count integer;
begin
  if not private.discipline_has_case_role(p_case_id, array['LEAD_INVESTIGATOR']::text[], v_actor_id) then
    raise exception 'Only the Lead Investigator can sign the investigation report.';
  end if;
  select * into v_case from public.discipline_cases where id = p_case_id;
  if v_case.status <> 'FINDINGS' then raise exception 'The case must be at Findings before report sign-off.'; end if;
  if not exists (select 1 from public.discipline_findings where case_id = p_case_id) then
    raise exception 'Record allegation findings before report sign-off.';
  end if;
  select count(*) into v_missing_count
  from public.discipline_natural_justice_checks check_item
  where check_item.case_id = p_case_id and check_item.required and not check_item.completed;
  if v_missing_count > 0 then
    select * into v_override from public.discipline_natural_justice_overrides override_row
    where override_row.case_id = p_case_id and override_row.used_by_snapshot_id is null
    order by override_row.authorised_at desc limit 1;
    if v_override.id is null then
      raise exception 'Natural justice checks are incomplete and no Case Coordinator override is authorised.';
    end if;
  end if;
  select coalesce(max(snapshot_number), 0) + 1 into v_snapshot_number
  from public.discipline_report_snapshots where case_id = p_case_id;
  v_snapshot_id := gen_random_uuid();
  select jsonb_build_object(
    'case', to_jsonb(v_case),
    'rule_pack', (select to_jsonb(pack) from public.discipline_rule_packs pack where pack.id = v_case.rule_pack_id),
    'investigator_setup', (select to_jsonb(setup) from public.discipline_investigator_setups setup where setup.case_id = p_case_id order by setup.recorded_at desc limit 1),
    'people_register', coalesce((select jsonb_agg(jsonb_build_object(
      'case_reference', person.case_reference,
      'case_role', person.case_role,
      'organisation', person.organisation,
      'person_role', person.person_role,
      'is_junior', person.is_junior
    ) order by person.created_at, person.id) from public.discipline_case_people person where person.case_id = p_case_id), '[]'::jsonb),
    'allegations', coalesce((select jsonb_agg(to_jsonb(a) order by a.allegation_number) from public.discipline_allegations a where a.case_id = p_case_id), '[]'::jsonb),
    'classifications', coalesce((select jsonb_agg(to_jsonb(c) order by c.assessed_at) from public.discipline_classification_assessments c where c.case_id = p_case_id), '[]'::jsonb),
    'evidence_register', coalesce((select jsonb_agg(to_jsonb(e) - 'storage_path' - 'external_url' order by e.created_at) from public.discipline_evidence e where e.case_id = p_case_id), '[]'::jsonb),
    'natural_justice', coalesce((select jsonb_agg(to_jsonb(n) order by n.check_key) from public.discipline_natural_justice_checks n where n.case_id = p_case_id), '[]'::jsonb),
    'findings', coalesce((select jsonb_agg(to_jsonb(f) order by f.recorded_at) from public.discipline_findings f where f.case_id = p_case_id), '[]'::jsonb),
    'signed_at', now(),
    'signed_by', v_actor_id
  ) into v_snapshot;
  insert into public.discipline_report_snapshots (
    id, case_id, snapshot_number, report_data, natural_justice_override_reason,
    signed_by, sha256
  ) values (
    v_snapshot_id, p_case_id, v_snapshot_number, v_snapshot, v_override.reason, v_actor_id,
    encode(extensions.digest(convert_to(v_snapshot::text, 'UTF8'), 'sha256'), 'hex')
  );
  if v_override.id is not null then
    update public.discipline_natural_justice_overrides set used_by_snapshot_id = v_snapshot_id
    where id = v_override.id;
  end if;
  perform set_config('app.discipline_change_reason', 'Lead Investigator signed anonymised report snapshot', true);
  perform set_config('app.discipline_actor_id', v_actor_id::text, true);
  update public.discipline_cases set status = 'REPORT_SIGNED', updated_by = v_actor_id where id = p_case_id;
  return v_snapshot_id;
end;
$function$;

revoke all on function public.record_discipline_risk_assessment(uuid, jsonb) from public, anon;
revoke all on function public.refer_discipline_case_to_tribunal(uuid, text, text) from public, anon;
grant execute on function public.record_discipline_risk_assessment(uuid, jsonb) to authenticated;
grant execute on function public.refer_discipline_case_to_tribunal(uuid, text, text) to authenticated;
