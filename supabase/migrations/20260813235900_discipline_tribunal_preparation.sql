-- Phase 2, Screen 12: source-checked Tribunal preparation.
-- This records appointments and logistics only. It does not send notices,
-- determine a charge, conduct a hearing or impose a penalty.

alter table public.discipline_case_members
  drop constraint discipline_case_members_role_check;

alter table public.discipline_case_members
  add constraint discipline_case_members_role_check check (
    case_role in (
      'CASE_COORDINATOR', 'LEAD_INVESTIGATOR', 'SUPPORT_INVESTIGATOR',
      'DECISION_MAKER', 'TRIBUNAL_MEMBER', 'READ_ONLY'
    )
  );

create or replace function private.discipline_can_read_case(
  p_case_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select private.discipline_has_case_role(
    p_case_id,
    array[
      'CASE_COORDINATOR', 'LEAD_INVESTIGATOR', 'SUPPORT_INVESTIGATOR',
      'DECISION_MAKER', 'TRIBUNAL_MEMBER', 'READ_ONLY'
    ]::text[],
    p_user_id
  );
$function$;

create table public.discipline_tribunal_preparations (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null unique references public.discipline_cases(id) on delete restrict,
  status text not null default 'SETUP',
  referral_basis text not null,
  appointment_authority text not null,
  authority_reference text,
  authority_mapping_confirmed boolean not null default false,
  receiving_body text not null,
  receiving_contact_name text not null,
  receiving_contact_email text not null,
  hb_presenter_name text not null,
  hb_presenter_email text not null,
  hearing_mode text not null,
  hearing_at timestamptz,
  hearing_location text not null,
  chair_requirement_treatment text not null,
  chair_approval_reference text,
  two_member_reason text,
  preparation_notes text not null,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_by uuid not null references public.profiles(id) on delete restrict,
  updated_at timestamptz not null default now(),
  constraint discipline_tribunal_preparations_status_check check (
    status in ('SETUP', 'READY')
  ),
  constraint discipline_tribunal_preparations_referral_basis_check check (
    referral_basis in (
      'HB_RULE_7_7_REFERRAL', 'DIRECT_SCHEDULE_REFERRAL',
      'MEDIATION_UNRESOLVED', 'OTHER_TRIBUNAL_JURISDICTION'
    )
  ),
  constraint discipline_tribunal_preparations_authority_check check (
    length(btrim(appointment_authority)) between 3 and 300
  ),
  constraint discipline_tribunal_preparations_body_check check (
    length(btrim(receiving_body)) between 2 and 300
  ),
  constraint discipline_tribunal_preparations_contact_check check (
    length(btrim(receiving_contact_name)) between 2 and 160
    and receiving_contact_email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    and length(btrim(hb_presenter_name)) between 2 and 160
    and hb_presenter_email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  ),
  constraint discipline_tribunal_preparations_hearing_mode_check check (
    hearing_mode in ('IN_PERSON', 'VIDEO', 'TELECONFERENCE', 'HYBRID')
  ),
  constraint discipline_tribunal_preparations_hearing_location_check check (
    length(btrim(hearing_location)) between 3 and 1000
  ),
  constraint discipline_tribunal_preparations_chair_treatment_check check (
    chair_requirement_treatment in (
      'HV_REQUIREMENT_CONFIRMED', 'HB_VARIATION_APPROVED', 'NOT_RESOLVED'
    )
  ),
  constraint discipline_tribunal_preparations_chair_reference_check check (
    chair_requirement_treatment <> 'HB_VARIATION_APPROVED'
    or length(btrim(coalesce(chair_approval_reference, ''))) >= 3
  ),
  constraint discipline_tribunal_preparations_notes_check check (
    length(btrim(preparation_notes)) between 10 and 4000
  )
);

create index discipline_tribunal_preparations_case_status_idx
  on public.discipline_tribunal_preparations (case_id, status);

create table public.discipline_tribunal_members (
  id uuid primary key default gen_random_uuid(),
  preparation_id uuid not null references public.discipline_tribunal_preparations(id) on delete restrict,
  case_id uuid not null references public.discipline_cases(id) on delete restrict,
  seat_number smallint not null,
  full_name text not null,
  email text not null,
  profile_id uuid references public.profiles(id) on delete restrict,
  organisation text,
  role_or_position text,
  invitation_status text not null default 'NOT_SENT',
  is_chair boolean not null default false,
  legal_eligibility_confirmed boolean not null default false,
  involved_club_role boolean not null default false,
  hb_governance_role boolean not null default false,
  direct_interest boolean not null default false,
  relationship_affecting_independence boolean not null default false,
  conflict_factors text[] not null default array[]::text[],
  conflict_decision text not null,
  conflict_reason text not null,
  availability_notes text not null,
  active boolean not null default true,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_by uuid not null references public.profiles(id) on delete restrict,
  updated_at timestamptz not null default now(),
  constraint discipline_tribunal_members_seat_check check (seat_number between 1 and 3),
  constraint discipline_tribunal_members_name_check check (
    length(btrim(full_name)) between 2 and 160
  ),
  constraint discipline_tribunal_members_email_check check (
    email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  ),
  constraint discipline_tribunal_members_invitation_check check (
    invitation_status in ('NOT_SENT', 'SENT', 'ACCEPTED', 'DECLINED')
  ),
  constraint discipline_tribunal_members_conflict_check check (
    conflict_decision in ('CLEARED', 'MANAGED', 'REPLACE_MEMBER')
  ),
  constraint discipline_tribunal_members_conflict_reason_check check (
    length(btrim(conflict_reason)) between 10 and 2000
  ),
  constraint discipline_tribunal_members_availability_check check (
    length(btrim(availability_notes)) between 3 and 1000
  ),
  unique (preparation_id, seat_number)
);

create unique index discipline_tribunal_members_active_profile_idx
  on public.discipline_tribunal_members (preparation_id, profile_id)
  where active and profile_id is not null;
create index discipline_tribunal_members_case_idx
  on public.discipline_tribunal_members (case_id, active, seat_number);

create trigger discipline_tribunal_preparations_updated_at
before update on public.discipline_tribunal_preparations
for each row execute function private.discipline_set_updated_at();

create trigger discipline_tribunal_members_updated_at
before update on public.discipline_tribunal_members
for each row execute function private.discipline_set_updated_at();

create trigger discipline_tribunal_preparations_audit
after insert or update or delete on public.discipline_tribunal_preparations
for each row execute function private.discipline_capture_row_audit();

create trigger discipline_tribunal_members_audit
after insert or update or delete on public.discipline_tribunal_members
for each row execute function private.discipline_capture_row_audit();

alter table public.discipline_tribunal_preparations enable row level security;
alter table public.discipline_tribunal_members enable row level security;

create policy discipline_tribunal_preparations_select
on public.discipline_tribunal_preparations
for select to authenticated
using (private.discipline_can_read_case(case_id, (select auth.uid())));

create policy discipline_tribunal_members_select
on public.discipline_tribunal_members
for select to authenticated
using (private.discipline_can_read_case(case_id, (select auth.uid())));

revoke all on table
  public.discipline_tribunal_preparations,
  public.discipline_tribunal_members
from public, anon, authenticated;

grant select on table
  public.discipline_tribunal_preparations,
  public.discipline_tribunal_members
to authenticated;

grant all on table
  public.discipline_tribunal_preparations,
  public.discipline_tribunal_members
to service_role;

create or replace function public.save_discipline_tribunal_preparation(
  p_case_id uuid,
  p_preparation jsonb,
  p_members jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor_id uuid := auth.uid();
  v_preparation_id uuid;
  v_status text := 'SETUP';
  v_member jsonb;
  v_profile_id uuid;
  v_seat integer;
  v_invitation_status text;
  v_conflict_decision text;
  v_accepted_count integer;
  v_accepted_chair_count integer;
  v_has_blocking_member boolean;
begin
  if v_actor_id is null or not private.discipline_can_manage_case(p_case_id, v_actor_id) then
    raise exception 'Only a Case Coordinator can prepare the Tribunal handover.';
  end if;

  if not exists (
    select 1
    from public.discipline_cases incident_case
    join public.discipline_decisions decision on decision.case_id = incident_case.id
    where incident_case.id = p_case_id
      and incident_case.status = 'REFERRED'
      and decision.outcome in ('TRIBUNAL_REFERRAL', 'COMBINATION_REFERRAL')
  ) then
    raise exception 'A final Tribunal referral decision is required before Tribunal preparation.';
  end if;

  if jsonb_typeof(p_members) <> 'array' or jsonb_array_length(p_members) <> 3 then
    raise exception 'Record all three ordinary Tribunal seats, including any unfilled seat.';
  end if;
  if (
    select count(distinct (member ->> 'seat_number')::integer)
    from jsonb_array_elements(p_members) member
    where (member ->> 'seat_number') ~ '^[1-3]$'
  ) <> 3 then
    raise exception 'Tribunal seats 1, 2 and 3 must each be recorded once.';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_members) member
    where nullif(member ->> 'profile_id', '') is not null
    group by member ->> 'profile_id'
    having count(*) > 1
  ) then
    raise exception 'The same SportStack account cannot occupy two Tribunal seats.';
  end if;

  if length(btrim(coalesce(p_preparation ->> 'appointment_authority', ''))) < 3
     or length(btrim(coalesce(p_preparation ->> 'receiving_body', ''))) < 2
     or length(btrim(coalesce(p_preparation ->> 'receiving_contact_name', ''))) < 2
     or length(btrim(coalesce(p_preparation ->> 'hb_presenter_name', ''))) < 2
     or length(btrim(coalesce(p_preparation ->> 'hearing_location', ''))) < 3
     or length(btrim(coalesce(p_preparation ->> 'preparation_notes', ''))) < 10 then
    raise exception 'Complete the authority, receiving body, presenter, hearing and preparation notes.';
  end if;
  if coalesce(p_preparation ->> 'receiving_contact_email', '') !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
     or coalesce(p_preparation ->> 'hb_presenter_email', '') !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Valid receiving-contact and HB-presenter email addresses are required.';
  end if;
  if p_preparation ->> 'referral_basis' not in (
    'HB_RULE_7_7_REFERRAL', 'DIRECT_SCHEDULE_REFERRAL',
    'MEDIATION_UNRESOLVED', 'OTHER_TRIBUNAL_JURISDICTION'
  ) then
    raise exception 'Select a valid Tribunal referral basis.';
  end if;
  if p_preparation ->> 'hearing_mode' not in ('IN_PERSON', 'VIDEO', 'TELECONFERENCE', 'HYBRID') then
    raise exception 'Select a valid hearing mode.';
  end if;
  if p_preparation ->> 'chair_requirement_treatment' not in (
    'HV_REQUIREMENT_CONFIRMED', 'HB_VARIATION_APPROVED', 'NOT_RESOLVED'
  ) then
    raise exception 'Record how the Rule 7.17 Chair requirement is being treated.';
  end if;
  if p_preparation ->> 'chair_requirement_treatment' = 'HB_VARIATION_APPROVED'
     and length(btrim(coalesce(p_preparation ->> 'chair_approval_reference', ''))) < 3 then
    raise exception 'Record the formal HB approval reference for a Chair variation.';
  end if;

  for v_member in select value from jsonb_array_elements(p_members)
  loop
    v_seat := (v_member ->> 'seat_number')::integer;
    v_profile_id := nullif(v_member ->> 'profile_id', '')::uuid;
    v_invitation_status := v_member ->> 'invitation_status';
    v_conflict_decision := v_member ->> 'conflict_decision';

    if length(btrim(coalesce(v_member ->> 'full_name', ''))) < 2
       or coalesce(v_member ->> 'email', '') !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
       or length(btrim(coalesce(v_member ->> 'conflict_reason', ''))) < 10
       or length(btrim(coalesce(v_member ->> 'availability_notes', ''))) < 3 then
      raise exception 'Complete the identity, conflict reason and availability for Tribunal seat %.', v_seat;
    end if;
    if v_invitation_status not in ('NOT_SENT', 'SENT', 'ACCEPTED', 'DECLINED')
       or v_conflict_decision not in ('CLEARED', 'MANAGED', 'REPLACE_MEMBER') then
      raise exception 'Invitation or conflict status is not valid for Tribunal seat %.', v_seat;
    end if;
    if v_invitation_status = 'ACCEPTED' and v_profile_id is null then
      raise exception 'An accepted Tribunal member needs a linked SportStack account for seat %.', v_seat;
    end if;
    if v_invitation_status = 'ACCEPTED' and (
      coalesce((v_member ->> 'involved_club_role')::boolean, false)
      or coalesce((v_member ->> 'hb_governance_role')::boolean, false)
      or coalesce((v_member ->> 'direct_interest')::boolean, false)
      or coalesce((v_member ->> 'relationship_affecting_independence')::boolean, false)
      or v_conflict_decision = 'REPLACE_MEMBER'
    ) then
      raise exception 'A person with a Rule 7.17 independence issue cannot be accepted for Tribunal seat %.', v_seat;
    end if;
    if v_profile_id is not null and exists (
      select 1 from public.discipline_case_members member
      where member.case_id = p_case_id
        and member.user_id = v_profile_id
        and member.active
        and member.case_role <> 'TRIBUNAL_MEMBER'
    ) then
      raise exception 'Tribunal seat % must use an account that has not held another active role in this case.', v_seat;
    end if;
  end loop;

  select
    count(*) filter (where member ->> 'invitation_status' = 'ACCEPTED'),
    count(*) filter (
      where member ->> 'invitation_status' = 'ACCEPTED'
        and coalesce((member ->> 'is_chair')::boolean, false)
    ),
    bool_or(
      member ->> 'invitation_status' = 'ACCEPTED' and (
        nullif(member ->> 'profile_id', '') is null
        or coalesce((member ->> 'involved_club_role')::boolean, false)
        or coalesce((member ->> 'hb_governance_role')::boolean, false)
        or coalesce((member ->> 'direct_interest')::boolean, false)
        or coalesce((member ->> 'relationship_affecting_independence')::boolean, false)
        or member ->> 'conflict_decision' = 'REPLACE_MEMBER'
      )
    )
  into v_accepted_count, v_accepted_chair_count, v_has_blocking_member
  from jsonb_array_elements(p_members) member;

  if v_accepted_count = 2
     and length(btrim(coalesce(p_preparation ->> 'two_member_reason', ''))) < 10 then
    raise exception 'Explain why the Tribunal will sit with the Rule 7.17 minimum of two rather than the ordinary three.';
  end if;

  if v_accepted_count between 2 and 3
     and v_accepted_chair_count = 1
     and not coalesce(v_has_blocking_member, false)
     and coalesce((p_preparation ->> 'authority_mapping_confirmed')::boolean, false)
     and nullif(p_preparation ->> 'hearing_at', '') is not null
     and p_preparation ->> 'chair_requirement_treatment' <> 'NOT_RESOLVED'
     and exists (
       select 1 from jsonb_array_elements(p_members) member
       where member ->> 'invitation_status' = 'ACCEPTED'
         and coalesce((member ->> 'is_chair')::boolean, false)
         and (
           coalesce((member ->> 'legal_eligibility_confirmed')::boolean, false)
           or p_preparation ->> 'chair_requirement_treatment' = 'HB_VARIATION_APPROVED'
         )
     ) then
    v_status := 'READY';
  end if;

  perform set_config('app.discipline_change_reason', 'Tribunal preparation saved', true);
  perform set_config('app.discipline_actor_id', v_actor_id::text, true);

  insert into public.discipline_tribunal_preparations (
    case_id, status, referral_basis, appointment_authority, authority_reference,
    authority_mapping_confirmed, receiving_body, receiving_contact_name,
    receiving_contact_email, hb_presenter_name, hb_presenter_email,
    hearing_mode, hearing_at, hearing_location, chair_requirement_treatment,
    chair_approval_reference, two_member_reason, preparation_notes,
    created_by, updated_by
  ) values (
    p_case_id, v_status, p_preparation ->> 'referral_basis',
    btrim(p_preparation ->> 'appointment_authority'),
    nullif(btrim(p_preparation ->> 'authority_reference'), ''),
    coalesce((p_preparation ->> 'authority_mapping_confirmed')::boolean, false),
    btrim(p_preparation ->> 'receiving_body'),
    btrim(p_preparation ->> 'receiving_contact_name'),
    lower(btrim(p_preparation ->> 'receiving_contact_email')),
    btrim(p_preparation ->> 'hb_presenter_name'),
    lower(btrim(p_preparation ->> 'hb_presenter_email')),
    p_preparation ->> 'hearing_mode',
    nullif(p_preparation ->> 'hearing_at', '')::timestamptz,
    btrim(p_preparation ->> 'hearing_location'),
    p_preparation ->> 'chair_requirement_treatment',
    nullif(btrim(p_preparation ->> 'chair_approval_reference'), ''),
    nullif(btrim(p_preparation ->> 'two_member_reason'), ''),
    btrim(p_preparation ->> 'preparation_notes'), v_actor_id, v_actor_id
  )
  on conflict (case_id) do update set
    status = excluded.status,
    referral_basis = excluded.referral_basis,
    appointment_authority = excluded.appointment_authority,
    authority_reference = excluded.authority_reference,
    authority_mapping_confirmed = excluded.authority_mapping_confirmed,
    receiving_body = excluded.receiving_body,
    receiving_contact_name = excluded.receiving_contact_name,
    receiving_contact_email = excluded.receiving_contact_email,
    hb_presenter_name = excluded.hb_presenter_name,
    hb_presenter_email = excluded.hb_presenter_email,
    hearing_mode = excluded.hearing_mode,
    hearing_at = excluded.hearing_at,
    hearing_location = excluded.hearing_location,
    chair_requirement_treatment = excluded.chair_requirement_treatment,
    chair_approval_reference = excluded.chair_approval_reference,
    two_member_reason = excluded.two_member_reason,
    preparation_notes = excluded.preparation_notes,
    updated_by = v_actor_id
  returning id into v_preparation_id;

  update public.discipline_tribunal_members
  set active = false, updated_by = v_actor_id
  where preparation_id = v_preparation_id and active;

  update public.discipline_case_members
  set active = false, revoked_by = v_actor_id, revoked_at = now()
  where case_id = p_case_id and active and case_role = 'TRIBUNAL_MEMBER';

  for v_member in select value from jsonb_array_elements(p_members)
  loop
    v_seat := (v_member ->> 'seat_number')::integer;
    v_profile_id := nullif(v_member ->> 'profile_id', '')::uuid;
    v_invitation_status := v_member ->> 'invitation_status';

    insert into public.discipline_tribunal_members (
      preparation_id, case_id, seat_number, full_name, email, profile_id,
      organisation, role_or_position, invitation_status, is_chair,
      legal_eligibility_confirmed, involved_club_role, hb_governance_role,
      direct_interest, relationship_affecting_independence, conflict_factors,
      conflict_decision, conflict_reason, availability_notes, active,
      created_by, updated_by
    ) values (
      v_preparation_id, p_case_id, v_seat,
      btrim(v_member ->> 'full_name'), lower(btrim(v_member ->> 'email')),
      v_profile_id, nullif(btrim(v_member ->> 'organisation'), ''),
      nullif(btrim(v_member ->> 'role_or_position'), ''), v_invitation_status,
      coalesce((v_member ->> 'is_chair')::boolean, false),
      coalesce((v_member ->> 'legal_eligibility_confirmed')::boolean, false),
      coalesce((v_member ->> 'involved_club_role')::boolean, false),
      coalesce((v_member ->> 'hb_governance_role')::boolean, false),
      coalesce((v_member ->> 'direct_interest')::boolean, false),
      coalesce((v_member ->> 'relationship_affecting_independence')::boolean, false),
      coalesce(array(select jsonb_array_elements_text(coalesce(v_member -> 'conflict_factors', '[]'::jsonb))), array[]::text[]),
      v_member ->> 'conflict_decision', btrim(v_member ->> 'conflict_reason'),
      btrim(v_member ->> 'availability_notes'), true, v_actor_id, v_actor_id
    )
    on conflict (preparation_id, seat_number) do update set
      full_name = excluded.full_name,
      email = excluded.email,
      profile_id = excluded.profile_id,
      organisation = excluded.organisation,
      role_or_position = excluded.role_or_position,
      invitation_status = excluded.invitation_status,
      is_chair = excluded.is_chair,
      legal_eligibility_confirmed = excluded.legal_eligibility_confirmed,
      involved_club_role = excluded.involved_club_role,
      hb_governance_role = excluded.hb_governance_role,
      direct_interest = excluded.direct_interest,
      relationship_affecting_independence = excluded.relationship_affecting_independence,
      conflict_factors = excluded.conflict_factors,
      conflict_decision = excluded.conflict_decision,
      conflict_reason = excluded.conflict_reason,
      availability_notes = excluded.availability_notes,
      active = true,
      updated_by = v_actor_id;

    if v_invitation_status = 'ACCEPTED' and v_profile_id is not null then
      insert into public.discipline_case_members (
        case_id, user_id, case_role, active, assignment_reason, assigned_by
      ) values (
        p_case_id, v_profile_id, 'TRIBUNAL_MEMBER', true,
        'Accepted Tribunal appointment under Rule 7.17', v_actor_id
      )
      on conflict (case_id, user_id) do update set
        case_role = 'TRIBUNAL_MEMBER', active = true,
        assignment_reason = excluded.assignment_reason,
        assigned_by = v_actor_id, assigned_at = now(),
        revoked_by = null, revoked_at = null;
    end if;
  end loop;

  return v_preparation_id;
end;
$function$;

revoke all on function public.save_discipline_tribunal_preparation(uuid, jsonb, jsonb)
from public, anon;
grant execute on function public.save_discipline_tribunal_preparation(uuid, jsonb, jsonb)
to authenticated, service_role;

revoke all on function private.discipline_can_read_case(uuid, uuid)
from public, anon, authenticated;
