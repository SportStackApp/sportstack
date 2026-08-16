-- Record requests to withdraw witness material without deleting or rewriting evidence.
-- Other case work may continue, but a report or Tribunal determination cannot be
-- finalised while a withdrawal request still needs a recorded decision.

create table public.discipline_evidence_status_events (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.discipline_cases(id) on delete restrict,
  target_type text not null,
  evidence_id uuid references public.discipline_evidence(id) on delete restrict,
  witness_id uuid references public.discipline_witnesses(id) on delete restrict,
  status text not null,
  request_source text not null,
  reason text not null,
  safety_concern boolean not null default false,
  pressure_or_intimidation_concern boolean not null default false,
  source_references text[] not null default array[
    'HV Rule 7.19(f)-(g)',
    'Hockey Australia CDDP clauses 6.9 and 7.5(b)'
  ]::text[],
  recorded_by uuid not null references public.profiles(id) on delete restrict,
  recorded_at timestamptz not null default now(),
  constraint discipline_evidence_status_target_type_check check (
    target_type in ('EVIDENCE', 'WITNESS')
  ),
  constraint discipline_evidence_status_target_check check (
    (target_type = 'EVIDENCE' and evidence_id is not null and witness_id is null)
    or
    (target_type = 'WITNESS' and witness_id is not null and evidence_id is null)
  ),
  constraint discipline_evidence_status_value_check check (
    status in (
      'WITHDRAWAL_REQUESTED',
      'WITHDRAWAL_CANCELLED',
      'EXCLUDED_FROM_RELIANCE',
      'RETAINED_LIMITED_WEIGHT',
      'RETAINED_FOR_RELIANCE',
      'RESTORED_FOR_CONSIDERATION'
    )
  ),
  constraint discipline_evidence_status_source_check check (
    request_source in (
      'WITNESS', 'COMPLAINANT', 'REPORTER', 'CASE_COORDINATOR',
      'INVESTIGATOR', 'TRIBUNAL', 'OTHER'
    )
  ),
  constraint discipline_evidence_status_reason_check check (
    length(btrim(reason)) between 10 and 2000
  )
);

create index discipline_evidence_status_case_idx
  on public.discipline_evidence_status_events (case_id, recorded_at desc, id desc);
create index discipline_evidence_status_evidence_idx
  on public.discipline_evidence_status_events (evidence_id, recorded_at desc, id desc)
  where evidence_id is not null;
create index discipline_evidence_status_witness_idx
  on public.discipline_evidence_status_events (witness_id, recorded_at desc, id desc)
  where witness_id is not null;
create index discipline_evidence_status_recorded_by_idx
  on public.discipline_evidence_status_events (recorded_by, recorded_at desc);

alter table public.discipline_evidence_status_events enable row level security;

create policy discipline_evidence_status_events_select
on public.discipline_evidence_status_events for select to authenticated
using (private.discipline_can_read_case(case_id, (select auth.uid())));

revoke all on table public.discipline_evidence_status_events from public, anon, authenticated;
grant select on table public.discipline_evidence_status_events to authenticated;
grant all on table public.discipline_evidence_status_events to service_role;

create trigger discipline_evidence_status_events_audit
after insert or update or delete on public.discipline_evidence_status_events
for each row execute function private.discipline_capture_row_audit();

create or replace function public.record_discipline_evidence_status_event(
  p_case_id uuid,
  p_target_type text,
  p_target_id uuid,
  p_status text,
  p_request_source text,
  p_reason text,
  p_safety_concern boolean default false,
  p_pressure_or_intimidation_concern boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor_id uuid := auth.uid();
  v_target_type text := upper(btrim(coalesce(p_target_type, '')));
  v_status text := upper(btrim(coalesce(p_status, '')));
  v_request_source text := upper(btrim(coalesce(p_request_source, '')));
  v_latest_status text;
  v_event_id uuid;
  v_has_accepted_chair boolean;
  v_actor_is_chair boolean;
  v_is_request_action boolean;
  v_is_decision_action boolean;
begin
  if v_actor_id is null then
    raise exception 'You must be signed in to record an evidence status.';
  end if;
  if not private.discipline_can_read_case(p_case_id, v_actor_id) then
    raise exception 'You are not assigned to this case.';
  end if;
  if v_target_type not in ('EVIDENCE', 'WITNESS') then
    raise exception 'The evidence target type is not valid.';
  end if;
  if v_request_source not in (
    'WITNESS', 'COMPLAINANT', 'REPORTER', 'CASE_COORDINATOR',
    'INVESTIGATOR', 'TRIBUNAL', 'OTHER'
  ) then
    raise exception 'Select who requested or authorised this action.';
  end if;
  if length(btrim(coalesce(p_reason, ''))) not between 10 and 2000 then
    raise exception 'Record a reason between 10 and 2000 characters.';
  end if;

  if v_target_type = 'EVIDENCE' then
    if not exists (
      select 1 from public.discipline_evidence evidence
      where evidence.id = p_target_id and evidence.case_id = p_case_id
    ) then
      raise exception 'The evidence item does not belong to this case.';
    end if;
    select event.status into v_latest_status
    from public.discipline_evidence_status_events event
    where event.case_id = p_case_id and event.evidence_id = p_target_id
    order by event.recorded_at desc, event.id desc
    limit 1;
  else
    if not exists (
      select 1 from public.discipline_witnesses witness
      where witness.id = p_target_id and witness.case_id = p_case_id
    ) then
      raise exception 'The witness does not belong to this case.';
    end if;
    select event.status into v_latest_status
    from public.discipline_evidence_status_events event
    where event.case_id = p_case_id and event.witness_id = p_target_id
    order by event.recorded_at desc, event.id desc
    limit 1;
  end if;

  v_is_request_action := v_status in ('WITHDRAWAL_REQUESTED', 'WITHDRAWAL_CANCELLED');
  v_is_decision_action := v_status in (
    'EXCLUDED_FROM_RELIANCE', 'RETAINED_LIMITED_WEIGHT',
    'RETAINED_FOR_RELIANCE', 'RESTORED_FOR_CONSIDERATION'
  );
  if not v_is_request_action and not v_is_decision_action then
    raise exception 'The evidence status is not valid.';
  end if;

  if v_is_request_action and not private.discipline_has_case_role(
    p_case_id,
    array[
      'CASE_COORDINATOR', 'LEAD_INVESTIGATOR', 'SUPPORT_INVESTIGATOR',
      'TRIBUNAL_MEMBER', 'TRIBUNAL_ADMINISTRATOR'
    ]::text[],
    v_actor_id
  ) then
    raise exception 'Your assigned role cannot record a withdrawal request.';
  end if;

  if v_status = 'WITHDRAWAL_REQUESTED'
     and v_latest_status = 'WITHDRAWAL_REQUESTED' then
    raise exception 'A withdrawal request is already awaiting a decision.';
  end if;
  if v_status = 'WITHDRAWAL_CANCELLED'
     and v_latest_status is distinct from 'WITHDRAWAL_REQUESTED' then
    raise exception 'Only a pending withdrawal request can be cancelled.';
  end if;

  if v_is_decision_action then
    select exists (
      select 1 from public.discipline_tribunal_members member
      where member.case_id = p_case_id
        and member.active
        and member.is_chair
        and member.invitation_status = 'ACCEPTED'
        and member.profile_id is not null
    ) into v_has_accepted_chair;

    select exists (
      select 1 from public.discipline_tribunal_members member
      where member.case_id = p_case_id
        and member.active
        and member.is_chair
        and member.invitation_status = 'ACCEPTED'
        and member.profile_id = v_actor_id
    ) into v_actor_is_chair;

    if (v_has_accepted_chair and not v_actor_is_chair)
       or (not v_has_accepted_chair and not private.discipline_can_manage_case(p_case_id, v_actor_id)) then
      raise exception 'The accepted Tribunal Chair must decide this request. Before a Chair is appointed, the Case Coordinator may record the handling decision.';
    end if;

    if v_status = 'RESTORED_FOR_CONSIDERATION' then
      if v_latest_status is distinct from 'EXCLUDED_FROM_RELIANCE' then
        raise exception 'Only excluded material can be restored for consideration.';
      end if;
    elsif v_latest_status is distinct from 'WITHDRAWAL_REQUESTED' then
      raise exception 'A pending withdrawal request is required before recording this decision.';
    end if;
  end if;

  perform set_config('app.discipline_change_reason', v_status || ' recorded', true);
  insert into public.discipline_evidence_status_events (
    case_id, target_type, evidence_id, witness_id, status,
    request_source, reason, safety_concern,
    pressure_or_intimidation_concern, recorded_by
  ) values (
    p_case_id,
    v_target_type,
    case when v_target_type = 'EVIDENCE' then p_target_id else null end,
    case when v_target_type = 'WITNESS' then p_target_id else null end,
    v_status,
    v_request_source,
    btrim(p_reason),
    coalesce(p_safety_concern, false),
    coalesce(p_pressure_or_intimidation_concern, false),
    v_actor_id
  ) returning id into v_event_id;

  return v_event_id;
end;
$function$;

revoke all on function public.record_discipline_evidence_status_event(
  uuid, text, uuid, text, text, text, boolean, boolean
) from public, anon;
grant execute on function public.record_discipline_evidence_status_event(
  uuid, text, uuid, text, text, text, boolean, boolean
) to authenticated, service_role;

create or replace function private.discipline_block_pending_evidence_finalisation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_case_id uuid := new.case_id;
begin
  if tg_table_name = 'discipline_phase2_stage_records'
     and not (new.stage = 'DETERMINATION' and new.status = 'FINAL') then
    return new;
  end if;

  if exists (
    select 1
    from (
      select distinct on (event.target_type, coalesce(event.evidence_id, event.witness_id))
        event.status
      from public.discipline_evidence_status_events event
      where event.case_id = v_case_id
      order by event.target_type, coalesce(event.evidence_id, event.witness_id),
        event.recorded_at desc, event.id desc
    ) latest
    where latest.status = 'WITHDRAWAL_REQUESTED'
  ) then
    raise exception 'Resolve each pending evidence withdrawal request before finalising the report or Tribunal determination.';
  end if;
  return new;
end;
$function$;

create trigger discipline_report_pending_evidence_guard
before insert on public.discipline_report_snapshots
for each row execute function private.discipline_block_pending_evidence_finalisation();

create trigger discipline_determination_pending_evidence_guard
before insert on public.discipline_phase2_stage_records
for each row execute function private.discipline_block_pending_evidence_finalisation();

revoke all on function private.discipline_block_pending_evidence_finalisation()
from public, anon, authenticated;

comment on table public.discipline_evidence_status_events is
  'Append-only withdrawal requests and handling decisions. Original witness and evidence records are never deleted or rewritten.';
