-- Phase 1: independently reviewed Hockey Ballarat decisions.
-- The three-person panel is an HB operating safeguard pending formal approval;
-- it is not represented as wording taken directly from Rule 7.

create table public.discipline_review_panels (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null unique references public.discipline_cases(id) on delete restrict,
  status text not null default 'SETUP',
  required_member_count integer not null default 3,
  appointment_authority text not null,
  authority_reference text,
  process_notes text not null,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_by uuid not null references public.profiles(id) on delete restrict,
  updated_at timestamptz not null default now(),
  constraint discipline_review_panels_status_check check (
    status in ('SETUP', 'READY', 'DELIBERATING', 'COMPLETE')
  ),
  constraint discipline_review_panels_member_count_check check (required_member_count = 3),
  constraint discipline_review_panels_authority_check check (
    length(btrim(appointment_authority)) between 3 and 300
  ),
  constraint discipline_review_panels_notes_check check (
    length(btrim(process_notes)) between 10 and 2000
  )
);

create table public.discipline_review_panel_members (
  id uuid primary key default gen_random_uuid(),
  panel_id uuid not null references public.discipline_review_panels(id) on delete restrict,
  case_id uuid not null references public.discipline_cases(id) on delete restrict,
  seat_number smallint not null,
  full_name text not null,
  email text not null,
  profile_id uuid references public.profiles(id) on delete restrict,
  organisation text,
  role_or_position text,
  invitation_status text not null default 'NOT_SENT',
  invited_at timestamptz,
  accepted_at timestamptz,
  training_experience text not null,
  club_affiliation text,
  committee_role text,
  relationship_to_parties text,
  competitive_interest text,
  conflict_factors text[] not null default array[]::text[],
  actual_conflict boolean not null default false,
  perceived_conflict boolean not null default false,
  conflict_decision text not null,
  conflict_reason text not null,
  active boolean not null default true,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_by uuid not null references public.profiles(id) on delete restrict,
  updated_at timestamptz not null default now(),
  constraint discipline_review_panel_members_seat_check check (seat_number between 1 and 3),
  constraint discipline_review_panel_members_name_check check (
    length(btrim(full_name)) between 2 and 160
  ),
  constraint discipline_review_panel_members_email_check check (
    email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  ),
  constraint discipline_review_panel_members_invitation_check check (
    invitation_status in ('NOT_SENT', 'SENT', 'ACCEPTED', 'DECLINED')
  ),
  constraint discipline_review_panel_members_conflict_check check (
    conflict_decision in ('NO_CONFLICT', 'MANAGED', 'REPLACE_MEMBER')
  ),
  constraint discipline_review_panel_members_experience_check check (
    length(btrim(training_experience)) between 3 and 2000
  ),
  constraint discipline_review_panel_members_reason_check check (
    length(btrim(conflict_reason)) between 10 and 2000
  ),
  unique (panel_id, seat_number)
);

create unique index discipline_review_panel_members_active_profile_idx
  on public.discipline_review_panel_members (panel_id, profile_id)
  where active and profile_id is not null;
create index discipline_review_panel_members_case_idx
  on public.discipline_review_panel_members (case_id, active, seat_number);

create table public.discipline_review_panel_votes (
  id uuid primary key default gen_random_uuid(),
  panel_id uuid not null references public.discipline_review_panels(id) on delete restrict,
  case_id uuid not null references public.discipline_cases(id) on delete restrict,
  panel_member_id uuid not null references public.discipline_review_panel_members(id) on delete restrict,
  revision_number integer not null,
  supersedes_vote_id uuid references public.discipline_review_panel_votes(id) on delete restrict,
  outcome text not null,
  decision_reason text not null,
  rule_reference text not null,
  recommendation_followed boolean not null,
  difference_reason text,
  change_reason text,
  submitted_by uuid not null references public.profiles(id) on delete restrict,
  submitted_at timestamptz not null default now(),
  constraint discipline_review_panel_votes_revision_check check (revision_number >= 1),
  constraint discipline_review_panel_votes_outcome_check check (
    outcome in (
      'NO_ACTION', 'MISCONDUCT_PENALTY_GUIDANCE', 'TRIBUNAL_REFERRAL',
      'MEDIATION_REFERRAL', 'COMBINATION_REFERRAL', 'OTHER_APPROPRIATE_COURSE'
    )
  ),
  constraint discipline_review_panel_votes_reason_check check (
    length(btrim(decision_reason)) between 10 and 4000
  ),
  constraint discipline_review_panel_votes_rule_check check (
    length(btrim(rule_reference)) between 3 and 500
  ),
  constraint discipline_review_panel_votes_difference_check check (
    recommendation_followed
    or length(btrim(coalesce(difference_reason, ''))) >= 5
  ),
  constraint discipline_review_panel_votes_change_check check (
    revision_number = 1
    or length(btrim(coalesce(change_reason, ''))) >= 10
  ),
  unique (panel_member_id, revision_number)
);

create index discipline_review_panel_votes_case_idx
  on public.discipline_review_panel_votes (case_id, submitted_at desc);

alter table public.discipline_decisions
  add column review_panel_id uuid references public.discipline_review_panels(id) on delete restrict,
  add column decision_method text,
  add column majority_count integer,
  add column minority_count integer,
  add column meeting_reference text,
  add column panel_vote_summary jsonb;

alter table public.discipline_decisions
  add constraint discipline_decisions_method_check check (
    decision_method is null or decision_method = 'THREE_PERSON_REVIEW_PANEL'
  ),
  add constraint discipline_decisions_panel_count_check check (
    (review_panel_id is null and majority_count is null and minority_count is null)
    or (review_panel_id is not null and majority_count between 2 and 3
        and minority_count between 0 and 1 and majority_count + minority_count = 3)
  );

create trigger discipline_review_panels_updated_at
before update on public.discipline_review_panels
for each row execute function private.discipline_set_updated_at();

create trigger discipline_review_panel_members_updated_at
before update on public.discipline_review_panel_members
for each row execute function private.discipline_set_updated_at();

create trigger discipline_review_panels_audit
after insert or update or delete on public.discipline_review_panels
for each row execute function private.discipline_capture_row_audit();

create trigger discipline_review_panel_members_audit
after insert or update or delete on public.discipline_review_panel_members
for each row execute function private.discipline_capture_row_audit();

create trigger discipline_review_panel_votes_audit
after insert or update or delete on public.discipline_review_panel_votes
for each row execute function private.discipline_capture_row_audit();

alter table public.discipline_review_panels enable row level security;
alter table public.discipline_review_panel_members enable row level security;
alter table public.discipline_review_panel_votes enable row level security;

create policy discipline_review_panels_select on public.discipline_review_panels
for select to authenticated
using (private.discipline_can_read_case(case_id, (select auth.uid())));

create policy discipline_review_panel_members_select on public.discipline_review_panel_members
for select to authenticated
using (private.discipline_can_read_case(case_id, (select auth.uid())));

create policy discipline_review_panel_votes_select on public.discipline_review_panel_votes
for select to authenticated
using (private.discipline_can_read_case(case_id, (select auth.uid())));

revoke all on table
  public.discipline_review_panels,
  public.discipline_review_panel_members,
  public.discipline_review_panel_votes
from public, anon, authenticated;

grant select on table
  public.discipline_review_panels,
  public.discipline_review_panel_members,
  public.discipline_review_panel_votes
to authenticated;

grant all on table
  public.discipline_review_panels,
  public.discipline_review_panel_members,
  public.discipline_review_panel_votes
to service_role;

create or replace function public.save_discipline_review_panel(
  p_case_id uuid,
  p_panel jsonb,
  p_members jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor_id uuid := auth.uid();
  v_panel_id uuid;
  v_panel_status text;
  v_member jsonb;
  v_profile_id uuid;
  v_seat integer;
  v_invitation_status text;
  v_conflict_decision text;
begin
  if v_actor_id is null or not private.discipline_can_manage_case(p_case_id, v_actor_id) then
    raise exception 'Only a Case Coordinator can set up the review panel.';
  end if;
  if not exists (
    select 1 from public.discipline_cases incident_case
    where incident_case.id = p_case_id
      and incident_case.status in ('REPORT_SIGNED', 'HB_DECISION')
  ) then
    raise exception 'A signed investigation report is required before panel setup.';
  end if;
  if exists (
    select 1 from public.discipline_review_panel_votes vote where vote.case_id = p_case_id
  ) or exists (
    select 1 from public.discipline_decisions decision where decision.case_id = p_case_id
  ) then
    raise exception 'The panel cannot be changed after voting has started.';
  end if;
  if length(btrim(coalesce(p_panel ->> 'appointment_authority', ''))) < 3
     or length(btrim(coalesce(p_panel ->> 'process_notes', ''))) < 10 then
    raise exception 'Record the appointment authority and why this panel process was selected.';
  end if;
  if jsonb_typeof(p_members) <> 'array' or jsonb_array_length(p_members) <> 3 then
    raise exception 'Exactly three review panel member records are required.';
  end if;
  if (
    select count(distinct (member ->> 'seat_number')::integer)
    from jsonb_array_elements(p_members) member
    where (member ->> 'seat_number') ~ '^[1-3]$'
  ) <> 3 then
    raise exception 'Panel seats 1, 2 and 3 must each be completed once.';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_members) member
    where nullif(member ->> 'profile_id', '') is not null
    group by member ->> 'profile_id'
    having count(*) > 1
  ) then
    raise exception 'The same SportStack account cannot occupy two panel seats.';
  end if;

  for v_member in select value from jsonb_array_elements(p_members)
  loop
    v_seat := (v_member ->> 'seat_number')::integer;
    v_profile_id := nullif(v_member ->> 'profile_id', '')::uuid;
    v_invitation_status := v_member ->> 'invitation_status';
    v_conflict_decision := v_member ->> 'conflict_decision';

    if length(btrim(coalesce(v_member ->> 'full_name', ''))) < 2 then
      raise exception 'A name is required for panel seat %.', v_seat;
    end if;
    if coalesce(v_member ->> 'email', '') !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
      raise exception 'A valid email is required for panel seat %.', v_seat;
    end if;
    if length(btrim(coalesce(v_member ->> 'training_experience', ''))) < 3
       or length(btrim(coalesce(v_member ->> 'conflict_reason', ''))) < 10 then
      raise exception 'Record suitability and a conflict assessment for panel seat %.', v_seat;
    end if;
    if v_invitation_status not in ('NOT_SENT', 'SENT', 'ACCEPTED', 'DECLINED') then
      raise exception 'Invitation status is not valid for panel seat %.', v_seat;
    end if;
    if v_conflict_decision not in ('NO_CONFLICT', 'MANAGED', 'REPLACE_MEMBER') then
      raise exception 'Conflict result is not valid for panel seat %.', v_seat;
    end if;
    if coalesce((v_member ->> 'actual_conflict')::boolean, false)
       and v_conflict_decision <> 'REPLACE_MEMBER' then
      raise exception 'An actual conflict requires replacement of panel seat %.', v_seat;
    end if;
    if coalesce((v_member ->> 'perceived_conflict')::boolean, false)
       and v_conflict_decision = 'NO_CONFLICT' then
      raise exception 'A perceived conflict must be managed or the member replaced for panel seat %.', v_seat;
    end if;
    if v_invitation_status = 'ACCEPTED' and (
      v_profile_id is null
      or coalesce((v_member ->> 'actual_conflict')::boolean, false)
      or v_conflict_decision = 'REPLACE_MEMBER'
    ) then
      raise exception 'An accepted member needs a linked account and an acceptable conflict result for panel seat %.', v_seat;
    end if;
    if v_profile_id is not null and exists (
      select 1 from public.discipline_case_members member
      where member.case_id = p_case_id
        and member.user_id = v_profile_id
        and member.active
        and member.case_role in ('CASE_COORDINATOR', 'LEAD_INVESTIGATOR', 'SUPPORT_INVESTIGATOR')
    ) then
      raise exception 'Panel seat % cannot be the Case Coordinator or an investigator on this case.', v_seat;
    end if;
  end loop;

  select case when count(*) = 3 then 'READY' else 'SETUP' end
  into v_panel_status
  from jsonb_array_elements(p_members) member
  where member ->> 'invitation_status' = 'ACCEPTED'
    and nullif(member ->> 'profile_id', '') is not null
    and not coalesce((member ->> 'actual_conflict')::boolean, false)
    and member ->> 'conflict_decision' <> 'REPLACE_MEMBER';

  perform set_config('app.discipline_change_reason', 'Review panel setup saved', true);
  perform set_config('app.discipline_actor_id', v_actor_id::text, true);

  insert into public.discipline_review_panels (
    case_id, status, appointment_authority, authority_reference,
    process_notes, created_by, updated_by
  ) values (
    p_case_id, v_panel_status, btrim(p_panel ->> 'appointment_authority'),
    nullif(btrim(p_panel ->> 'authority_reference'), ''),
    btrim(p_panel ->> 'process_notes'), v_actor_id, v_actor_id
  )
  on conflict (case_id) do update set
    status = excluded.status,
    appointment_authority = excluded.appointment_authority,
    authority_reference = excluded.authority_reference,
    process_notes = excluded.process_notes,
    updated_by = v_actor_id
  returning id into v_panel_id;

  update public.discipline_review_panel_members
  set active = false, updated_by = v_actor_id
  where panel_id = v_panel_id and active;

  update public.discipline_case_members
  set active = false, revoked_by = v_actor_id, revoked_at = now()
  where case_id = p_case_id and active and case_role = 'DECISION_MAKER';

  for v_member in select value from jsonb_array_elements(p_members)
  loop
    v_seat := (v_member ->> 'seat_number')::integer;
    v_profile_id := nullif(v_member ->> 'profile_id', '')::uuid;
    v_invitation_status := v_member ->> 'invitation_status';

    insert into public.discipline_review_panel_members (
      panel_id, case_id, seat_number, full_name, email, profile_id,
      organisation, role_or_position, invitation_status, invited_at, accepted_at,
      training_experience, club_affiliation, committee_role,
      relationship_to_parties, competitive_interest, conflict_factors,
      actual_conflict, perceived_conflict, conflict_decision, conflict_reason,
      active, created_by, updated_by
    ) values (
      v_panel_id, p_case_id, v_seat, btrim(v_member ->> 'full_name'),
      lower(btrim(v_member ->> 'email')), v_profile_id,
      nullif(btrim(v_member ->> 'organisation'), ''),
      nullif(btrim(v_member ->> 'role_or_position'), ''), v_invitation_status,
      case when v_invitation_status in ('SENT', 'ACCEPTED') then now() else null end,
      case when v_invitation_status = 'ACCEPTED' then now() else null end,
      btrim(v_member ->> 'training_experience'),
      nullif(btrim(v_member ->> 'club_affiliation'), ''),
      nullif(btrim(v_member ->> 'committee_role'), ''),
      nullif(btrim(v_member ->> 'relationship_to_parties'), ''),
      nullif(btrim(v_member ->> 'competitive_interest'), ''),
      coalesce(array(select jsonb_array_elements_text(coalesce(v_member -> 'conflict_factors', '[]'::jsonb))), array[]::text[]),
      coalesce((v_member ->> 'actual_conflict')::boolean, false),
      coalesce((v_member ->> 'perceived_conflict')::boolean, false),
      v_member ->> 'conflict_decision', btrim(v_member ->> 'conflict_reason'),
      true, v_actor_id, v_actor_id
    )
    on conflict (panel_id, seat_number) do update set
      full_name = excluded.full_name,
      email = excluded.email,
      profile_id = excluded.profile_id,
      organisation = excluded.organisation,
      role_or_position = excluded.role_or_position,
      invitation_status = excluded.invitation_status,
      invited_at = excluded.invited_at,
      accepted_at = excluded.accepted_at,
      training_experience = excluded.training_experience,
      club_affiliation = excluded.club_affiliation,
      committee_role = excluded.committee_role,
      relationship_to_parties = excluded.relationship_to_parties,
      competitive_interest = excluded.competitive_interest,
      conflict_factors = excluded.conflict_factors,
      actual_conflict = excluded.actual_conflict,
      perceived_conflict = excluded.perceived_conflict,
      conflict_decision = excluded.conflict_decision,
      conflict_reason = excluded.conflict_reason,
      active = true,
      updated_by = v_actor_id;

    if v_invitation_status = 'ACCEPTED' and v_profile_id is not null then
      insert into public.discipline_case_members (
        case_id, user_id, case_role, active, assignment_reason, assigned_by
      ) values (
        p_case_id, v_profile_id, 'DECISION_MAKER', true,
        'Accepted independent review panel appointment', v_actor_id
      )
      on conflict (case_id, user_id) do update set
        case_role = 'DECISION_MAKER',
        active = true,
        assignment_reason = excluded.assignment_reason,
        assigned_by = v_actor_id,
        assigned_at = now(),
        revoked_by = null,
        revoked_at = null;
    end if;
  end loop;

  return v_panel_id;
end;
$function$;

create or replace function public.record_discipline_review_panel_vote(
  p_case_id uuid,
  p_vote jsonb,
  p_change_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor_id uuid := auth.uid();
  v_panel public.discipline_review_panels%rowtype;
  v_member public.discipline_review_panel_members%rowtype;
  v_previous public.discipline_review_panel_votes%rowtype;
  v_vote_id uuid;
  v_outcome text := p_vote ->> 'outcome';
begin
  select panel.* into v_panel
  from public.discipline_review_panels panel
  join public.discipline_cases incident_case on incident_case.id = panel.case_id
  where panel.case_id = p_case_id
    and panel.status in ('READY', 'DELIBERATING')
    and incident_case.status = 'HB_DECISION';
  if v_panel.id is null then
    raise exception 'The review panel must be ready and the case opened for deliberation.';
  end if;

  select member.* into v_member
  from public.discipline_review_panel_members member
  where member.panel_id = v_panel.id
    and member.profile_id = v_actor_id
    and member.active
    and member.invitation_status = 'ACCEPTED'
    and member.conflict_decision <> 'REPLACE_MEMBER'
    and not member.actual_conflict;
  if v_member.id is null then
    raise exception 'Only an accepted independent panel member can record a vote.';
  end if;
  if v_outcome not in (
    'NO_ACTION', 'MISCONDUCT_PENALTY_GUIDANCE', 'TRIBUNAL_REFERRAL',
    'MEDIATION_REFERRAL', 'COMBINATION_REFERRAL', 'OTHER_APPROPRIATE_COURSE'
  ) then
    raise exception 'Decision outcome is not valid.';
  end if;
  if length(btrim(coalesce(p_vote ->> 'decision_reason', ''))) < 10
     or length(btrim(coalesce(p_vote ->> 'rule_reference', ''))) < 3 then
    raise exception 'Independent reasoning and a rule source are required.';
  end if;
  if not coalesce((p_vote ->> 'recommendation_followed')::boolean, false)
     and length(btrim(coalesce(p_vote ->> 'difference_reason', ''))) < 5 then
    raise exception 'Explain why the investigator recommendation was not followed.';
  end if;

  select vote.* into v_previous
  from public.discipline_review_panel_votes vote
  where vote.panel_member_id = v_member.id
  order by vote.revision_number desc
  limit 1;
  if v_previous.id is not null and length(btrim(coalesce(p_change_reason, ''))) < 10 then
    raise exception 'Explain why the earlier vote is being revised.';
  end if;

  perform set_config('app.discipline_change_reason', coalesce(nullif(btrim(p_change_reason), ''), 'Independent panel vote recorded'), true);
  perform set_config('app.discipline_actor_id', v_actor_id::text, true);

  insert into public.discipline_review_panel_votes (
    panel_id, case_id, panel_member_id, revision_number, supersedes_vote_id,
    outcome, decision_reason, rule_reference, recommendation_followed,
    difference_reason, change_reason, submitted_by
  ) values (
    v_panel.id, p_case_id, v_member.id, coalesce(v_previous.revision_number, 0) + 1,
    v_previous.id, v_outcome, btrim(p_vote ->> 'decision_reason'),
    btrim(p_vote ->> 'rule_reference'),
    coalesce((p_vote ->> 'recommendation_followed')::boolean, false),
    nullif(btrim(p_vote ->> 'difference_reason'), ''),
    nullif(btrim(p_change_reason), ''), v_actor_id
  ) returning id into v_vote_id;

  update public.discipline_review_panels
  set status = 'DELIBERATING', updated_by = v_actor_id
  where id = v_panel.id;

  return v_vote_id;
end;
$function$;

create or replace function public.finalise_discipline_review_panel_decision(
  p_case_id uuid,
  p_meeting_reference text,
  p_process_note text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor_id uuid := auth.uid();
  v_panel public.discipline_review_panels%rowtype;
  v_vote_count integer;
  v_outcome text;
  v_majority_count integer;
  v_minority_count integer;
  v_reasoning text;
  v_rule_reference text;
  v_recommendation_followed boolean;
  v_difference_reason text;
  v_vote_summary jsonb;
  v_final_status text;
  v_decision_id uuid;
begin
  select panel.* into v_panel
  from public.discipline_review_panels panel
  join public.discipline_cases incident_case on incident_case.id = panel.case_id
  where panel.case_id = p_case_id
    and panel.status in ('READY', 'DELIBERATING')
    and incident_case.status = 'HB_DECISION';
  if v_panel.id is null then
    raise exception 'The panel is not ready to finalise a decision.';
  end if;
  if not exists (
    select 1 from public.discipline_review_panel_members member
    where member.panel_id = v_panel.id and member.profile_id = v_actor_id
      and member.active and member.invitation_status = 'ACCEPTED'
      and member.conflict_decision <> 'REPLACE_MEMBER' and not member.actual_conflict
  ) then
    raise exception 'Only an accepted panel member can finalise the majority result.';
  end if;
  if length(btrim(coalesce(p_meeting_reference, ''))) < 3
     or length(btrim(coalesce(p_process_note, ''))) < 10 then
    raise exception 'Record the meeting or circular resolution reference and a process note.';
  end if;
  if exists (select 1 from public.discipline_decisions decision where decision.case_id = p_case_id) then
    raise exception 'A final decision is already recorded for this case.';
  end if;

  with latest_votes as (
    select distinct on (vote.panel_member_id) vote.*
    from public.discipline_review_panel_votes vote
    where vote.panel_id = v_panel.id
    order by vote.panel_member_id, vote.revision_number desc
  )
  select count(*) into v_vote_count from latest_votes;
  if v_vote_count <> 3 then
    raise exception 'All three panel members must record an independent vote first.';
  end if;

  with latest_votes as (
    select distinct on (vote.panel_member_id) vote.*
    from public.discipline_review_panel_votes vote
    where vote.panel_id = v_panel.id
    order by vote.panel_member_id, vote.revision_number desc
  ), result_counts as (
    select outcome, count(*)::integer as vote_count
    from latest_votes group by outcome
    order by vote_count desc, outcome
  )
  select outcome, vote_count into v_outcome, v_majority_count
  from result_counts limit 1;
  if v_majority_count < 2 then
    raise exception 'The three votes do not produce a majority. Further panel deliberation is required.';
  end if;
  v_minority_count := 3 - v_majority_count;

  with latest_votes as (
    select distinct on (vote.panel_member_id) vote.*
    from public.discipline_review_panel_votes vote
    where vote.panel_id = v_panel.id
    order by vote.panel_member_id, vote.revision_number desc
  )
  select
    string_agg(member.full_name || ': ' || vote.decision_reason, E'\n\n' order by member.seat_number)
      filter (where vote.outcome = v_outcome),
    string_agg(distinct vote.rule_reference, '; ') filter (where vote.outcome = v_outcome),
    bool_and(vote.recommendation_followed) filter (where vote.outcome = v_outcome),
    string_agg(vote.difference_reason, E'\n' order by member.seat_number)
      filter (where vote.outcome = v_outcome and not vote.recommendation_followed),
    jsonb_agg(jsonb_build_object(
      'seat_number', member.seat_number,
      'member_name', member.full_name,
      'outcome', vote.outcome,
      'decision_reason', vote.decision_reason,
      'rule_reference', vote.rule_reference,
      'recommendation_followed', vote.recommendation_followed,
      'difference_reason', vote.difference_reason,
      'revision_number', vote.revision_number,
      'submitted_at', vote.submitted_at
    ) order by member.seat_number)
  into v_reasoning, v_rule_reference, v_recommendation_followed,
       v_difference_reason, v_vote_summary
  from latest_votes vote
  join public.discipline_review_panel_members member on member.id = vote.panel_member_id;

  v_final_status := case
    when v_outcome in ('NO_ACTION', 'MISCONDUCT_PENALTY_GUIDANCE') then 'CLOSED'
    else 'REFERRED'
  end;

  perform set_config('app.discipline_change_reason', 'Three-person review panel majority finalised', true);
  perform set_config('app.discipline_actor_id', v_actor_id::text, true);

  insert into public.discipline_decisions (
    case_id, outcome, decision_reason, rule_reference, recommendation_followed,
    difference_reason, decided_by, review_panel_id, decision_method,
    majority_count, minority_count, meeting_reference, panel_vote_summary
  ) values (
    p_case_id, v_outcome,
    btrim(p_process_note) || E'\n\nMajority member reasoning:\n' || v_reasoning,
    v_rule_reference, v_recommendation_followed, nullif(v_difference_reason, ''),
    v_actor_id, v_panel.id, 'THREE_PERSON_REVIEW_PANEL',
    v_majority_count, v_minority_count, btrim(p_meeting_reference), v_vote_summary
  ) returning id into v_decision_id;

  update public.discipline_review_panels
  set status = 'COMPLETE', updated_by = v_actor_id
  where id = v_panel.id;

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
  if p_next_status = 'HB_DECISION' and not exists (
    select 1 from public.discipline_review_panels panel
    where panel.case_id = p_case_id and panel.status = 'READY'
  ) then
    raise exception 'Three accepted and eligible review panel members are required first.';
  end if;

  perform set_config('app.discipline_change_reason', btrim(p_reason), true);
  perform set_config('app.discipline_actor_id', v_actor_id::text, true);
  update public.discipline_cases
  set status = p_next_status, updated_by = v_actor_id
  where id = p_case_id;
end;
$function$;

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
begin
  raise exception 'Use the three-person review panel workflow to record the HB decision.';
end;
$function$;

revoke all on function public.save_discipline_review_panel(uuid, jsonb, jsonb) from public, anon;
revoke all on function public.record_discipline_review_panel_vote(uuid, jsonb, text) from public, anon;
revoke all on function public.finalise_discipline_review_panel_decision(uuid, text, text) from public, anon;

grant execute on function public.save_discipline_review_panel(uuid, jsonb, jsonb) to authenticated;
grant execute on function public.record_discipline_review_panel_vote(uuid, jsonb, text) to authenticated;
grant execute on function public.finalise_discipline_review_panel_decision(uuid, text, text) to authenticated;
