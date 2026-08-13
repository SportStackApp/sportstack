-- Complete the post-referral discipline workflow without automating a legal outcome.
-- Every save creates a new revision. Simulation records never change the real case status.

create table public.discipline_phase2_stage_records (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.discipline_cases(id) on delete restrict,
  stage text not null,
  revision_number integer not null,
  workflow_mode text not null default 'REAL',
  status text not null,
  payload jsonb not null,
  source_references text[] not null default '{}',
  recorded_by uuid not null references public.profiles(id) on delete restrict,
  recorded_at timestamptz not null default now(),
  constraint discipline_phase2_stage_check check (
    stage in ('NOTICE', 'HEARING', 'DETERMINATION', 'APPEAL', 'CLOSURE')
  ),
  constraint discipline_phase2_mode_check check (workflow_mode in ('REAL', 'SIMULATION')),
  constraint discipline_phase2_status_check check (
    status in ('DRAFT', 'ISSUED', 'ADJOURNED', 'COMPLETED', 'FINAL', 'LODGED', 'NO_APPEAL', 'CLOSED')
  ),
  constraint discipline_phase2_payload_check check (jsonb_typeof(payload) = 'object'),
  unique (case_id, stage, workflow_mode, revision_number)
);

create index discipline_phase2_stage_case_idx
  on public.discipline_phase2_stage_records (case_id, workflow_mode, stage, revision_number desc);
create index discipline_phase2_stage_recorded_by_idx
  on public.discipline_phase2_stage_records (recorded_by, recorded_at desc);

alter table public.discipline_phase2_stage_records enable row level security;

create policy discipline_phase2_stage_records_select
on public.discipline_phase2_stage_records for select to authenticated
using (private.discipline_can_read_case(case_id, (select auth.uid())));

revoke all on table public.discipline_phase2_stage_records from public, anon;
grant select on table public.discipline_phase2_stage_records to authenticated;
grant all on table public.discipline_phase2_stage_records to service_role;

create trigger discipline_phase2_stage_records_audit
after insert or update or delete on public.discipline_phase2_stage_records
for each row execute function private.discipline_capture_row_audit();

create or replace function public.save_discipline_phase2_stage(
  p_case_id uuid,
  p_stage text,
  p_status text,
  p_workflow_mode text,
  p_payload jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor_id uuid := auth.uid();
  v_revision integer;
  v_record_id uuid;
  v_previous_complete boolean;
  v_source_references text[];
begin
  if v_actor_id is null or not private.discipline_can_manage_case(p_case_id, v_actor_id) then
    raise exception 'Only a Case Coordinator can save the post-referral workflow.';
  end if;
  if not exists (
    select 1 from public.discipline_cases incident_case
    where incident_case.id = p_case_id and incident_case.status in ('REFERRED', 'CLOSED')
  ) then
    raise exception 'A final Tribunal referral is required before this workflow.';
  end if;
  if p_stage not in ('NOTICE', 'HEARING', 'DETERMINATION', 'APPEAL', 'CLOSURE')
     or p_workflow_mode not in ('REAL', 'SIMULATION')
     or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'The stage, mode or payload is not valid.';
  end if;
  if (p_stage = 'NOTICE' and p_status not in ('DRAFT', 'ISSUED'))
     or (p_stage = 'HEARING' and p_status not in ('DRAFT', 'ADJOURNED', 'COMPLETED'))
     or (p_stage = 'DETERMINATION' and p_status not in ('DRAFT', 'FINAL'))
     or (p_stage = 'APPEAL' and p_status not in ('DRAFT', 'LODGED', 'NO_APPEAL', 'FINAL'))
     or (p_stage = 'CLOSURE' and p_status not in ('DRAFT', 'CLOSED')) then
    raise exception 'The status is not valid for this workflow stage.';
  end if;

  if p_workflow_mode = 'SIMULATION'
     and coalesce((p_payload ->> 'simulation_acknowledged')::boolean, false) is not true then
    raise exception 'A simulation must be expressly acknowledged in every completed stage.';
  end if;

  if p_stage = 'NOTICE' and p_status = 'ISSUED' then
    if p_workflow_mode = 'REAL' and not exists (
      select 1 from public.discipline_tribunal_preparations preparation
      where preparation.case_id = p_case_id and preparation.status = 'READY'
    ) then
      raise exception 'A real Rule 7.18 notice cannot be recorded as issued until Tribunal preparation is READY.';
    end if;
    if length(btrim(coalesce(p_payload ->> 'recipient_name', ''))) < 2
       or coalesce(p_payload ->> 'recipient_email', '') !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
       or nullif(p_payload ->> 'hearing_at', '') is null
       or length(btrim(coalesce(p_payload ->> 'hearing_location', ''))) < 3
       or length(btrim(coalesce(p_payload ->> 'allegation_particulars', ''))) < 20
       or length(btrim(coalesce(p_payload ->> 'evidence_relied_on', ''))) < 10
       or length(btrim(coalesce(p_payload ->> 'response_rights', ''))) < 10
       or length(btrim(coalesce(p_payload ->> 'hb_presenter', ''))) < 2
       or not coalesce((p_payload ->> 'all_affected_people_checked')::boolean, false)
       or not coalesce((p_payload ->> 'notice_manually_issued')::boolean, false) then
      raise exception 'Complete the Rule 7.18 notice details and manual-issue confirmations.';
    end if;
  end if;

  if p_stage <> 'NOTICE' then
    select exists (
      select 1 from public.discipline_phase2_stage_records record
      where record.case_id = p_case_id and record.workflow_mode = p_workflow_mode
        and record.stage = case p_stage
          when 'HEARING' then 'NOTICE'
          when 'DETERMINATION' then 'HEARING'
          when 'APPEAL' then 'DETERMINATION'
          when 'CLOSURE' then 'APPEAL'
        end
        and (
          (p_stage = 'HEARING' and record.status = 'ISSUED')
          or (p_stage = 'DETERMINATION' and record.status = 'COMPLETED')
          or (p_stage = 'APPEAL' and record.status = 'FINAL')
          or (p_stage = 'CLOSURE' and record.status in ('FINAL', 'NO_APPEAL'))
        )
    ) into v_previous_complete;
    if p_status <> 'DRAFT' and not v_previous_complete then
      raise exception 'Complete the preceding workflow stage first.';
    end if;
  end if;

  if p_stage = 'HEARING' and p_status = 'COMPLETED' and (
    not coalesce((p_payload ->> 'charges_read')::boolean, false)
    or not coalesce((p_payload ->> 'plea_recorded')::boolean, false)
    or not coalesce((p_payload ->> 'parties_heard')::boolean, false)
    or not coalesce((p_payload ->> 'evidence_considered')::boolean, false)
    or not coalesce((p_payload ->> 'natural_justice_confirmed')::boolean, false)
    or p_payload ->> 'standard_of_proof' <> 'BALANCE_OF_PROBABILITIES'
    or length(btrim(coalesce(p_payload ->> 'hearing_notes', ''))) < 20
  ) then
    raise exception 'Complete the Rule 7.19 hearing and natural-justice checks.';
  end if;

  if p_stage = 'DETERMINATION' and p_status = 'FINAL' and (
    p_payload ->> 'standard_of_proof' <> 'BALANCE_OF_PROBABILITIES'
    or length(btrim(coalesce(p_payload ->> 'charge_results', ''))) < 20
    or length(btrim(coalesce(p_payload ->> 'majority_basis', ''))) < 10
    or length(btrim(coalesce(p_payload ->> 'reasons', ''))) < 20
    or (coalesce((p_payload ->> 'any_charge_proved')::boolean, false) and (
      not coalesce((p_payload ->> 'penalty_submissions_invited')::boolean, false)
      or length(btrim(coalesce(p_payload ->> 'sanctions', ''))) < 3
    ))
  ) then
    raise exception 'Complete the Rule 7.20 determination and Rule 7.21 penalty safeguards.';
  end if;

  if p_stage = 'APPEAL' and p_status in ('LODGED', 'NO_APPEAL', 'FINAL') then
    if nullif(p_payload ->> 'decision_notified_at', '') is null
       or nullif(p_payload ->> 'appeal_deadline_at', '') is null
       or length(btrim(coalesce(p_payload ->> 'pathway_confirmation', ''))) < 10 then
      raise exception 'Record notification, deadline and the confirmed local appeal pathway.';
    end if;
    if p_status = 'LODGED' and (
      not coalesce((p_payload ->> 'application_received')::boolean, false)
      or not coalesce((p_payload ->> 'stay_applied')::boolean, false)
    ) then
      raise exception 'A lodged appeal must record the application and Rule 7.22 stay.';
    end if;
    if p_status = 'NO_APPEAL' and coalesce((p_payload ->> 'application_received')::boolean, false) then
      raise exception 'No appeal cannot be recorded when an application was received.';
    end if;
    if p_status = 'FINAL' and length(btrim(coalesce(p_payload ->> 'appeal_outcome', ''))) < 10 then
      raise exception 'Record the final appeal outcome.';
    end if;
  end if;

  if p_stage = 'CLOSURE' and p_status = 'CLOSED' and (
    not coalesce((p_payload ->> 'outcome_notified')::boolean, false)
    or not coalesce((p_payload ->> 'appeal_complete')::boolean, false)
    or not coalesce((p_payload ->> 'records_complete')::boolean, false)
    or not coalesce((p_payload ->> 'privacy_review_complete')::boolean, false)
    or length(btrim(coalesce(p_payload ->> 'closure_summary', ''))) < 20
  ) then
    raise exception 'Complete notification, appeal, records, privacy and closure checks.';
  end if;

  select coalesce(max(record.revision_number), 0) + 1 into v_revision
  from public.discipline_phase2_stage_records record
  where record.case_id = p_case_id and record.stage = p_stage
    and record.workflow_mode = p_workflow_mode;

  v_source_references := case p_stage
    when 'NOTICE' then array['HV Rules 7.18']
    when 'HEARING' then array['HV Rules 7.18-7.20']
    when 'DETERMINATION' then array['HV Rules 7.20-7.21']
    when 'APPEAL' then array['HV Rules 7.22-7.25']
    else array['HV Rules 7.13-7.14, 7.21.8, 7.22-7.25', 'HB local records treatment requires confirmation']
  end;

  perform set_config('app.discipline_change_reason', p_stage || ' ' || p_status || ' recorded', true);
  insert into public.discipline_phase2_stage_records (
    case_id, stage, revision_number, workflow_mode, status, payload,
    source_references, recorded_by
  ) values (
    p_case_id, p_stage, v_revision, p_workflow_mode, p_status, p_payload,
    v_source_references, v_actor_id
  ) returning id into v_record_id;

  if p_stage = 'CLOSURE' and p_status = 'CLOSED' and p_workflow_mode = 'REAL' then
    update public.discipline_cases set status = 'CLOSED', closed_at = now(), updated_by = v_actor_id
    where id = p_case_id;
  end if;

  return v_record_id;
end;
$function$;

revoke all on function public.save_discipline_phase2_stage(uuid, text, text, text, jsonb)
from public, anon;
grant execute on function public.save_discipline_phase2_stage(uuid, text, text, text, jsonb)
to authenticated, service_role;
