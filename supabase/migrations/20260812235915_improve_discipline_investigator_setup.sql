alter table public.discipline_investigator_setups
  add column if not exists investigation_type text,
  add column if not exists appointment_authority text,
  add column if not exists authority_reference text,
  add column if not exists conflict_factors text[] not null default '{}'::text[];

update public.discipline_investigator_setups
set
  investigation_type = coalesce(investigation_type, 'INTERNAL'),
  appointment_authority = coalesce(
    appointment_authority,
    'Legacy appointment - authority was not separately recorded'
  )
where investigation_type is null or appointment_authority is null;

alter table public.discipline_investigator_setups
  alter column investigation_type set not null,
  alter column appointment_authority set not null;

alter table public.discipline_investigator_setups
  drop constraint if exists discipline_investigator_type_check,
  add constraint discipline_investigator_type_check check (
    investigation_type in ('INTERNAL', 'EXTERNAL')
  ),
  drop constraint if exists discipline_investigator_authority_check,
  add constraint discipline_investigator_authority_check check (
    length(btrim(appointment_authority)) between 3 and 300
  ),
  drop constraint if exists discipline_investigator_conflict_factors_check,
  add constraint discipline_investigator_conflict_factors_check check (
    conflict_factors <@ array[
      'SAME_CLUB_OR_TEAM',
      'COMMITTEE_OR_DECISION_ROLE',
      'PERSONAL_FAMILY_BUSINESS_RELATIONSHIP',
      'PRIOR_INVOLVEMENT_OR_KNOWLEDGE',
      'COMPETITIVE_INTEREST',
      'PUBLICLY_EXPRESSED_VIEW',
      'OTHER'
    ]::text[]
  );

create or replace function public.record_discipline_investigator_setup(
  p_case_id uuid,
  p_lead_user_id uuid,
  p_support_user_ids uuid[],
  p_appointed_at timestamptz,
  p_investigation_type text,
  p_appointment_authority text,
  p_authority_reference text,
  p_training_experience text,
  p_club_affiliation text,
  p_committee_role text,
  p_relationship_to_parties text,
  p_competitive_interest text,
  p_conflict_factors text[],
  p_actual_conflict boolean,
  p_perceived_conflict boolean,
  p_conflict_decision text,
  p_conflict_reason text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor_id uuid := auth.uid();
  v_setup_id uuid;
  v_support_user_ids uuid[];
  v_conflict_factors text[];
  v_selected_user_ids uuid[];
begin
  if v_actor_id is null then
    raise exception 'You must be signed in to record an investigator appointment.';
  end if;
  if not private.discipline_can_manage_case(p_case_id, v_actor_id) then
    raise exception 'Only a Case Coordinator can record an investigator appointment.';
  end if;
  if not exists (
    select 1
    from public.discipline_cases incident_case
    where incident_case.id = p_case_id
      and incident_case.status not in ('REPORT_SIGNED', 'HB_DECISION', 'CLOSED', 'REFERRED')
  ) then
    raise exception 'A signed or final case cannot receive a new investigator appointment.';
  end if;
  if not exists (select 1 from public.profiles where id = p_lead_user_id) then
    raise exception 'The selected Lead Investigation Officer was not found.';
  end if;

  select coalesce(array_agg(candidate.user_id order by candidate.user_id), '{}'::uuid[])
  into v_support_user_ids
  from (
    select distinct support_user_id as user_id
    from unnest(coalesce(p_support_user_ids, '{}'::uuid[])) support_user_id
    where support_user_id is not null
  ) candidate;

  if p_lead_user_id = any(v_support_user_ids) then
    raise exception 'The Lead Investigation Officer cannot also be a support investigator.';
  end if;
  if cardinality(v_support_user_ids) > 10 then
    raise exception 'No more than 10 support investigators can be appointed.';
  end if;
  if exists (
    select 1
    from unnest(v_support_user_ids) support_user_id
    where not exists (select 1 from public.profiles where id = support_user_id)
  ) then
    raise exception 'One or more support investigators were not found.';
  end if;

  select coalesce(array_agg(factor order by factor), '{}'::text[])
  into v_conflict_factors
  from (
    select distinct btrim(conflict_factor) as factor
    from unnest(coalesce(p_conflict_factors, '{}'::text[])) conflict_factor
    where nullif(btrim(conflict_factor), '') is not null
  ) factors;

  if p_investigation_type not in ('INTERNAL', 'EXTERNAL') then
    raise exception 'Select whether this is an internal or external investigation.';
  end if;
  if length(btrim(coalesce(p_appointment_authority, ''))) < 3 then
    raise exception 'Record the HB appointment authority or delegation basis.';
  end if;
  if length(btrim(coalesce(p_training_experience, ''))) < 10 then
    raise exception 'Record enough training or experience information to support the appointment.';
  end if;
  if p_appointed_at is null then
    raise exception 'Record the appointment date and time.';
  end if;
  if p_appointed_at > now() + interval '5 minutes' then
    raise exception 'The appointment time cannot be in the future.';
  end if;
  if p_actual_conflict is null or p_perceived_conflict is null then
    raise exception 'Answer both conflict questions.';
  end if;
  if p_conflict_decision not in ('NO_CONFLICT', 'MANAGED', 'REPLACE_INVESTIGATOR') then
    raise exception 'Select a valid conflict decision.';
  end if;
  if length(btrim(coalesce(p_conflict_reason, ''))) < 10 then
    raise exception 'Record a clear reason for the independence decision.';
  end if;
  if p_actual_conflict and p_conflict_decision <> 'REPLACE_INVESTIGATOR' then
    raise exception 'An actual conflict requires a replacement investigator.';
  end if;
  if not p_actual_conflict and not p_perceived_conflict
     and p_conflict_decision <> 'NO_CONFLICT' then
    raise exception 'Use No conflict when neither an actual nor perceived conflict is identified.';
  end if;
  if p_perceived_conflict and not p_actual_conflict
     and p_conflict_decision not in ('MANAGED', 'REPLACE_INVESTIGATOR') then
    raise exception 'A perceived conflict must be managed with reasons or result in replacement.';
  end if;
  if (p_actual_conflict or p_perceived_conflict) and cardinality(v_conflict_factors) = 0 then
    raise exception 'Select at least one factor relevant to the identified conflict.';
  end if;
  if not p_actual_conflict and not p_perceived_conflict
     and cardinality(v_conflict_factors) > 0 then
    raise exception 'Conflict factors should only be selected when a conflict is identified.';
  end if;

  perform set_config(
    'app.discipline_change_reason',
    'Investigator appointment and independence check recorded',
    true
  );
  perform set_config('app.discipline_actor_id', v_actor_id::text, true);

  insert into public.discipline_investigator_setups (
    case_id,
    lead_user_id,
    support_user_ids,
    appointed_at,
    appointed_by,
    investigation_type,
    appointment_authority,
    authority_reference,
    training_experience,
    club_affiliation,
    committee_role,
    relationship_to_parties,
    competitive_interest,
    conflict_factors,
    actual_conflict,
    perceived_conflict,
    conflict_decision,
    conflict_reason,
    recorded_by
  ) values (
    p_case_id,
    p_lead_user_id,
    v_support_user_ids,
    p_appointed_at,
    v_actor_id,
    p_investigation_type,
    btrim(p_appointment_authority),
    nullif(btrim(coalesce(p_authority_reference, '')), ''),
    btrim(p_training_experience),
    nullif(btrim(coalesce(p_club_affiliation, '')), ''),
    nullif(btrim(coalesce(p_committee_role, '')), ''),
    nullif(btrim(coalesce(p_relationship_to_parties, '')), ''),
    nullif(btrim(coalesce(p_competitive_interest, '')), ''),
    v_conflict_factors,
    p_actual_conflict,
    p_perceived_conflict,
    p_conflict_decision,
    btrim(p_conflict_reason),
    v_actor_id
  )
  returning id into v_setup_id;

  if p_conflict_decision = 'REPLACE_INVESTIGATOR' then
    return v_setup_id;
  end if;

  v_selected_user_ids := array[p_lead_user_id] || v_support_user_ids;

  if exists (
    select 1
    from public.discipline_case_members member
    where member.case_id = p_case_id
      and member.active
      and member.case_role = 'CASE_COORDINATOR'
      and member.user_id = any(v_selected_user_ids)
  ) and not exists (
    select 1
    from public.discipline_case_members member
    where member.case_id = p_case_id
      and member.active
      and member.case_role = 'CASE_COORDINATOR'
      and not (member.user_id = any(v_selected_user_ids))
  ) then
    raise exception 'Assign another Case Coordinator before appointing the current coordinator as an investigator.';
  end if;

  update public.discipline_case_members member
  set
    active = false,
    assignment_reason = 'Investigator access replaced by a later formal appointment.',
    revoked_by = v_actor_id,
    revoked_at = now()
  where member.case_id = p_case_id
    and member.active
    and member.case_role in ('LEAD_INVESTIGATOR', 'SUPPORT_INVESTIGATOR')
    and not (member.user_id = any(v_selected_user_ids));

  insert into public.discipline_case_members (
    case_id,
    user_id,
    case_role,
    active,
    assignment_reason,
    assigned_by,
    revoked_by,
    revoked_at
  ) values (
    p_case_id,
    p_lead_user_id,
    'LEAD_INVESTIGATOR',
    true,
    'Appointed as the formally accountable Lead Investigation Officer.',
    v_actor_id,
    null,
    null
  )
  on conflict (case_id, user_id) do update set
    case_role = excluded.case_role,
    active = true,
    assignment_reason = excluded.assignment_reason,
    assigned_by = v_actor_id,
    assigned_at = now(),
    revoked_by = null,
    revoked_at = null;

  insert into public.discipline_case_members (
    case_id,
    user_id,
    case_role,
    active,
    assignment_reason,
    assigned_by,
    revoked_by,
    revoked_at
  )
  select
    p_case_id,
    support_user_id,
    'SUPPORT_INVESTIGATOR',
    true,
    'Appointed to support the Lead Investigation Officer; no formal report sign-off authority.',
    v_actor_id,
    null,
    null
  from unnest(v_support_user_ids) support_user_id
  on conflict (case_id, user_id) do update set
    case_role = excluded.case_role,
    active = true,
    assignment_reason = excluded.assignment_reason,
    assigned_by = v_actor_id,
    assigned_at = now(),
    revoked_by = null,
    revoked_at = null;

  return v_setup_id;
end;
$function$;

drop policy if exists discipline_investigator_setups_insert
  on public.discipline_investigator_setups;
revoke insert on table public.discipline_investigator_setups from authenticated;

revoke all on function public.record_discipline_investigator_setup(
  uuid, uuid, uuid[], timestamptz, text, text, text, text, text, text, text,
  text, text[], boolean, boolean, text, text
) from public, anon;
grant execute on function public.record_discipline_investigator_setup(
  uuid, uuid, uuid[], timestamptz, text, text, text, text, text, text, text,
  text, text[], boolean, boolean, text, text
) to authenticated;

comment on function public.record_discipline_investigator_setup(
  uuid, uuid, uuid[], timestamptz, text, text, text, text, text, text, text,
  text, text[], boolean, boolean, text, text
) is
  'Atomically records the investigator appointment and independence assessment, then aligns active lead and support case access when the candidate is suitable.';
