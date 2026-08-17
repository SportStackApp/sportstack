-- SportStack Coordination Module foundation and complete fixture/activity workflow.
-- Additive Dev-first migration. Production requires separate privacy and release approval.

create extension if not exists btree_gist with schema extensions;
create schema if not exists private;

insert into public.permission_catalogue(permission_key, module_key, label, description, category, default_allowed)
values
  ('module.coordination.access', 'coordination', 'Access Coordination', 'Open personal Coordination offers and assignments.', 'MODULE', true),
  ('coordination.umpires.manage', 'coordination', 'Coordinate Umpires', 'Offer and confirm Umpire and supervising Umpire duties within scope.', 'ACTION', false),
  ('coordination.technical_bench.manage', 'coordination', 'Coordinate Technical Bench', 'Offer and confirm Technical Bench duties within scope.', 'ACTION', false),
  ('coordination.volunteers.manage', 'coordination', 'Coordinate volunteers', 'Offer and confirm volunteer duties within scope.', 'ACTION', false),
  ('coordination.activities.create', 'coordination', 'Create volunteer activities', 'Create basic scoped volunteer activities and positions.', 'ACTION', false),
  ('coordination.offers.take_over', 'coordination', 'Take over offers', 'Take over an active offer with an audited reason.', 'ACTION', false),
  ('coordination.umpire_matrix.manage', 'coordination', 'Manage Umpire Matrix', 'Manage grade sign-offs, qualifications and restricted Umpire notes.', 'ACTION', false),
  ('coordination.roster_mismatches.review', 'coordination', 'Review roster mismatches', 'Review Umpire Match Voting roster checks.', 'ACTION', false),
  ('coordination.sensitive_notes.redact', 'coordination', 'Redact sensitive notes', 'Privacy-administration permission to redact sensitive note content while retaining audit history.', 'ACTION', false)
on conflict (permission_key) do update set
  label = excluded.label,
  description = excluded.description,
  category = excluded.category;

create table public.coordination_capabilities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  capability_type text not null check (capability_type in ('UMPIRE', 'TECHNICAL_BENCH', 'VOLUNTEER', 'SUPERVISING_UMPIRE')),
  scope_type text not null check (scope_type in ('ASSOCIATION', 'CLUB', 'TEAM')),
  scope_id uuid not null,
  active_from date not null default current_date,
  active_until date,
  active boolean not null default true,
  granted_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (active_until is null or active_until >= active_from)
);
create unique index coordination_capabilities_active_key
  on public.coordination_capabilities(user_id, capability_type, scope_type, scope_id)
  where active;
create index coordination_capabilities_scope_idx
  on public.coordination_capabilities(scope_type, scope_id, capability_type) where active;
create index coordination_capabilities_user_idx
  on public.coordination_capabilities(user_id, capability_type) where active;

create table public.coordination_capability_invitations (
  id uuid primary key default gen_random_uuid(),
  email text,
  user_id uuid references public.profiles(id),
  capability_type text not null check (capability_type in ('UMPIRE', 'TECHNICAL_BENCH', 'VOLUNTEER', 'SUPERVISING_UMPIRE')),
  scope_type text not null check (scope_type in ('ASSOCIATION', 'CLUB', 'TEAM')),
  scope_id uuid not null,
  invited_by uuid not null references public.profiles(id),
  status text not null default 'PENDING' check (status in ('PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'WITHDRAWN')),
  expires_at timestamptz not null default (now() + interval '14 days'),
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (email is not null or user_id is not null)
);
create unique index coordination_capability_invites_pending_user_key
  on public.coordination_capability_invitations(user_id, capability_type, scope_type, scope_id)
  where status = 'PENDING' and user_id is not null;
create index coordination_capability_invites_email_idx
  on public.coordination_capability_invitations(lower(email)) where email is not null;
create index coordination_capability_invites_inviter_idx
  on public.coordination_capability_invitations(invited_by, created_at desc);

create table public.coordination_position_types (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  label text not null,
  required_capability text not null,
  coordinator_permission text not null references public.permission_catalogue(permission_key),
  fixture_enabled boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  check (code ~ '^[A-Z][A-Z0-9_]*$')
);
insert into public.coordination_position_types(code, label, required_capability, coordinator_permission, fixture_enabled)
values
  ('UMPIRE', 'Umpire', 'UMPIRE', 'coordination.umpires.manage', true),
  ('TECHNICAL_BENCH', 'Technical Bench', 'TECHNICAL_BENCH', 'coordination.technical_bench.manage', true),
  ('SUPERVISING_UMPIRE', 'Supervising Umpire', 'SUPERVISING_UMPIRE', 'coordination.umpires.manage', true),
  ('VOLUNTEER', 'Volunteer', 'VOLUNTEER', 'coordination.volunteers.manage', false)
on conflict (code) do update set label=excluded.label, required_capability=excluded.required_capability,
  coordinator_permission=excluded.coordinator_permission, fixture_enabled=excluded.fixture_enabled;

create table public.coordination_position_templates (
  id uuid primary key default gen_random_uuid(),
  association_id uuid references public.associations(id),
  position_type_id uuid not null references public.coordination_position_types(id),
  fixture_type text not null default 'STANDARD',
  required_count integer not null check (required_count between 1 and 50),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique nulls not distinct (association_id, position_type_id, fixture_type)
);
insert into public.coordination_position_templates(association_id, position_type_id, required_count)
select null, id, case code when 'UMPIRE' then 2 else 2 end
from public.coordination_position_types where code in ('UMPIRE','TECHNICAL_BENCH')
on conflict (association_id, position_type_id, fixture_type)
do update set required_count=excluded.required_count, active=true;

create table public.coordination_activities (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 120),
  activity_type text not null default 'OTHER' check (char_length(btrim(activity_type)) between 2 and 80),
  description text,
  scope_type text not null check (scope_type in ('ASSOCIATION','CLUB','TEAM')),
  association_id uuid not null references public.associations(id),
  club_id uuid references public.clubs(id),
  team_id uuid references public.teams(id),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  location text,
  status text not null default 'DRAFT' check (status in ('DRAFT','OPEN','COMPLETED','CANCELLED')),
  coordinator_id uuid not null references public.profiles(id),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at),
  check ((scope_type='ASSOCIATION' and club_id is null and team_id is null)
    or (scope_type='CLUB' and club_id is not null and team_id is null)
    or (scope_type='TEAM' and team_id is not null))
);
create index coordination_activities_scope_start_idx
  on public.coordination_activities(association_id, starts_at, status);
create index coordination_activities_club_idx on public.coordination_activities(club_id) where club_id is not null;
create index coordination_activities_team_idx on public.coordination_activities(team_id) where team_id is not null;
create index coordination_activities_coordinator_idx on public.coordination_activities(coordinator_id, starts_at);

create table public.coordination_positions (
  id uuid primary key default gen_random_uuid(),
  fixture_id uuid references public.fixtures(id),
  activity_id uuid references public.coordination_activities(id),
  association_id uuid not null references public.associations(id),
  club_id uuid references public.clubs(id),
  team_id uuid references public.teams(id),
  position_type_id uuid not null references public.coordination_position_types(id),
  position_label text not null,
  slot_number integer not null default 1 check (slot_number between 1 and 100),
  state text not null default 'OPEN' check (state in ('OPEN','OFFERING','AWAITING_CONFIRMATION','FILLED','REPLACEMENT_REQUIRED','RECONFIRMATION_REQUIRED','CANCELLED','COMPLETED')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((fixture_id is not null) <> (activity_id is not null)),
  check (ends_at > starts_at)
);
create unique index coordination_positions_fixture_slot_key
  on public.coordination_positions(fixture_id, position_type_id, slot_number) where fixture_id is not null;
create unique index coordination_positions_activity_slot_key
  on public.coordination_positions(activity_id, position_type_id, position_label, slot_number) where activity_id is not null;
create index coordination_positions_association_time_idx
  on public.coordination_positions(association_id, starts_at, state);
create index coordination_positions_type_idx on public.coordination_positions(position_type_id, starts_at);
create index coordination_positions_activity_idx on public.coordination_positions(activity_id) where activity_id is not null;

create table public.coordination_offer_batches (
  id uuid primary key default gen_random_uuid(),
  position_id uuid not null references public.coordination_positions(id),
  offered_by uuid not null references public.profiles(id),
  current_owner_id uuid not null references public.profiles(id),
  status text not null default 'ACTIVE' check (status in ('ACTIVE','CONFIRMED','EXPIRED','WITHDRAWN','CANCELLED','SUPERSEDED')),
  response_deadline timestamptz not null,
  note text,
  note_version integer not null default 1 check (note_version > 0),
  urgent boolean not null default false,
  takeover_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index coordination_offer_batches_one_active
  on public.coordination_offer_batches(position_id) where status='ACTIVE';
create index coordination_offer_batches_owner_idx on public.coordination_offer_batches(current_owner_id, status, response_deadline);

create table public.coordination_offer_recipients (
  id uuid primary key default gen_random_uuid(),
  offer_batch_id uuid not null references public.coordination_offer_batches(id),
  user_id uuid not null references public.profiles(id),
  status text not null default 'PENDING' check (status in ('DRAFT','PENDING','ACCEPTED_AWAITING_CONFIRMATION','DECLINED','EXPIRED','WITHDRAWN','CONFIRMED','NOT_SELECTED')),
  responded_at timestamptz,
  decline_reason text,
  acceptance_note_version integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(offer_batch_id, user_id)
);
create index coordination_offer_recipients_user_idx
  on public.coordination_offer_recipients(user_id, status, created_at desc);

create table public.coordination_offer_note_revisions (
  id uuid primary key default gen_random_uuid(),
  offer_batch_id uuid not null references public.coordination_offer_batches(id),
  version integer not null,
  note text,
  material boolean not null default false,
  changed_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  unique(offer_batch_id, version)
);
create index coordination_offer_note_revisions_changed_by_idx on public.coordination_offer_note_revisions(changed_by, created_at desc);

create table public.coordination_offer_reminders (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.coordination_offer_recipients(id),
  reminder_type text not null,
  due_at timestamptz not null,
  status text not null default 'PENDING' check (status in ('PENDING','QUEUED','SENT','FAILED','CANCELLED')),
  processed_at timestamptz,
  attempts integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  unique(recipient_id, reminder_type)
);
create index coordination_offer_reminders_due_idx on public.coordination_offer_reminders(status, due_at);

create table public.coordination_notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  event_type text not null,
  entity_type text not null,
  entity_id uuid not null,
  channel text not null check (channel in ('IN_APP','EMAIL')),
  status text not null default 'QUEUED' check (status in ('QUEUED','SENDING','SENT','FAILED','CANCELLED')),
  subject text not null,
  body_text text not null,
  action_url text,
  dedupe_key text not null unique,
  attempts integer not null default 0,
  last_attempt_at timestamptz,
  sent_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index coordination_notification_deliveries_queue_idx
  on public.coordination_notification_deliveries(channel, status, created_at);
create index coordination_notification_deliveries_user_idx
  on public.coordination_notification_deliveries(user_id, created_at desc);

create table public.coordination_assignments (
  id uuid primary key default gen_random_uuid(),
  position_id uuid not null references public.coordination_positions(id),
  assigned_user_id uuid not null references public.profiles(id),
  offer_recipient_id uuid references public.coordination_offer_recipients(id),
  assigned_by uuid not null references public.profiles(id),
  confirmed_by uuid not null references public.profiles(id),
  status text not null default 'CONFIRMED' check (status in ('CONFIRMED','RECONFIRMATION_REQUIRED','REPLACEMENT_REQUESTED','REPLACED','CANCELLED','COMPLETED','DISPUTED')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  confirmed_at timestamptz not null default now(),
  completed_at timestamptz,
  replaced_by_assignment_id uuid references public.coordination_assignments(id),
  late_assignment boolean not null default false,
  confirmation_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create unique index coordination_assignments_current_position_key
  on public.coordination_assignments(position_id)
  where status in ('CONFIRMED','RECONFIRMATION_REQUIRED','REPLACEMENT_REQUESTED','DISPUTED');
create index coordination_assignments_user_time_idx
  on public.coordination_assignments(assigned_user_id, starts_at, ends_at);
create index coordination_assignments_assigned_by_idx on public.coordination_assignments(assigned_by, created_at desc);
alter table public.coordination_assignments add constraint coordination_assignments_no_overlap
  exclude using gist (
    assigned_user_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  ) where (status in ('CONFIRMED','RECONFIRMATION_REQUIRED','REPLACEMENT_REQUESTED','DISPUTED'));

create table public.coordination_replacement_requests (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.coordination_assignments(id),
  requested_by uuid not null references public.profiles(id),
  note text not null check (char_length(btrim(note)) between 2 and 2000),
  status text not null default 'OPEN' check (status in ('OPEN','RESOLVED','DECLINED','CANCELLED')),
  resolved_by uuid references public.profiles(id),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index coordination_replacement_requests_one_open
  on public.coordination_replacement_requests(assignment_id) where status='OPEN';
create index coordination_replacement_requests_requester_idx on public.coordination_replacement_requests(requested_by, created_at desc);

create table public.coordination_assignment_events (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid references public.coordination_assignments(id),
  position_id uuid not null references public.coordination_positions(id),
  event_type text not null,
  actor_id uuid references public.profiles(id),
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index coordination_assignment_events_assignment_idx on public.coordination_assignment_events(assignment_id, created_at);
create index coordination_assignment_events_position_idx on public.coordination_assignment_events(position_id, created_at);

create table public.coordination_warning_overrides (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid not null,
  warning_code text not null,
  note text not null check (char_length(btrim(note)) between 2 and 2000),
  overridden_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);
create index coordination_warning_overrides_entity_idx on public.coordination_warning_overrides(entity_type, entity_id, created_at);
create index coordination_warning_overrides_actor_idx on public.coordination_warning_overrides(overridden_by, created_at desc);

create table public.umpire_grade_signoffs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  association_id uuid not null references public.associations(id),
  division_id uuid not null references public.divisions(id),
  status text not null check (status in ('SIGNED_OFF','SUSPENDED','REMOVED')),
  effective_date date not null default current_date,
  reason text,
  signed_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  check (status='SIGNED_OFF' or char_length(btrim(reason)) >= 2)
);
create index umpire_grade_signoffs_current_idx on public.umpire_grade_signoffs(user_id, association_id, division_id, created_at desc);
create index umpire_grade_signoffs_signer_idx on public.umpire_grade_signoffs(signed_by, created_at desc);

create table public.umpire_qualifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  association_id uuid not null references public.associations(id),
  name text not null check (char_length(btrim(name)) between 2 and 120),
  issuer text,
  issued_on date,
  expires_on date,
  note text,
  added_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  check (expires_on is null or issued_on is null or expires_on >= issued_on)
);
create index umpire_qualifications_user_idx on public.umpire_qualifications(user_id, association_id, expires_on);
create index umpire_qualifications_added_by_idx on public.umpire_qualifications(added_by, created_at desc);

create table public.umpire_coordinator_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  association_id uuid not null references public.associations(id),
  content text not null check (char_length(btrim(content)) between 1 and 4000),
  note_kind text not null default 'GENERAL' check (note_kind in ('GENERAL','HEALTH','BEREAVEMENT','CONDUCT','OTHER')),
  created_by uuid not null references public.profiles(id),
  redacted_at timestamptz,
  redacted_by uuid references public.profiles(id),
  redaction_reason text,
  created_at timestamptz not null default now(),
  check ((redacted_at is null and redacted_by is null) or (redacted_at is not null and redacted_by is not null and redaction_reason is not null))
);
create index umpire_coordinator_notes_user_idx on public.umpire_coordinator_notes(user_id, association_id, created_at desc);
create index umpire_coordinator_notes_creator_idx on public.umpire_coordinator_notes(created_by, created_at desc);

create table public.coordination_supervision_links (
  id uuid primary key default gen_random_uuid(),
  supervisor_assignment_id uuid not null references public.coordination_assignments(id),
  supervised_assignment_id uuid not null references public.coordination_assignments(id),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  unique(supervisor_assignment_id, supervised_assignment_id),
  check (supervisor_assignment_id <> supervised_assignment_id)
);
create index coordination_supervision_links_supervised_idx on public.coordination_supervision_links(supervised_assignment_id);

create table public.coordination_supervision_notes (
  id uuid primary key default gen_random_uuid(),
  supervision_link_id uuid not null references public.coordination_supervision_links(id),
  author_id uuid not null references public.profiles(id),
  content text not null check (char_length(btrim(content)) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index coordination_supervision_notes_link_idx on public.coordination_supervision_notes(supervision_link_id, created_at);
create index coordination_supervision_notes_author_idx on public.coordination_supervision_notes(author_id, created_at desc);

create table public.umpire_match_roster_checks (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.player_vote_submissions(id),
  fixture_id uuid references public.fixtures(id),
  result text not null check (result in ('MATCHED','MISMATCH','NO_ROSTER','UNVERIFIABLE','VALID_PROXY','ROSTER_DISPUTED')),
  roster_snapshot jsonb not null default '[]'::jsonb,
  detail text,
  reviewed_status text not null default 'PENDING' check (reviewed_status in ('PENDING','CONFIRMED','DISMISSED')),
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  review_note text,
  checked_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index umpire_match_roster_checks_submission_idx on public.umpire_match_roster_checks(submission_id, checked_at desc);
create index umpire_match_roster_checks_queue_idx on public.umpire_match_roster_checks(result, reviewed_status, checked_at desc);
create index umpire_match_roster_checks_fixture_idx on public.umpire_match_roster_checks(fixture_id, checked_at desc);

-- Resolve organisation IDs without trusting caller-supplied parent relationships.
create or replace function private.coordination_scope_details(p_scope_type text, p_scope_id uuid)
returns table(association_id uuid, club_id uuid, team_id uuid)
language sql stable security definer set search_path=''
as $function$
  select a.id, null::uuid, null::uuid from public.associations a where p_scope_type='ASSOCIATION' and a.id=p_scope_id
  union all
  select c.association_id, c.id, null::uuid from public.clubs c where p_scope_type='CLUB' and c.id=p_scope_id
  union all
  select c.association_id, t.club_id, t.id from public.teams t join public.clubs c on c.id=t.club_id where p_scope_type='TEAM' and t.id=p_scope_id;
$function$;

create or replace function private.coordination_fixture_window(p_fixture_id uuid)
returns table(association_id uuid, starts_at timestamptz, ends_at timestamptz, division_id uuid)
language sql stable security definer set search_path=''
as $function$
  select c.association_id, f.fixture_date,
    coalesce(f.scheduled_end_at, f.fixture_date + pg_catalog.make_interval(mins => coalesce(d.default_match_duration_minutes,a.default_match_duration_minutes,90))),
    f.division_id
  from public.fixtures f
  join public.teams t on t.id=f.home_team_id
  join public.clubs c on c.id=t.club_id
  join public.associations a on a.id=c.association_id
  left join public.divisions d on d.id=f.division_id and d.association_id=a.id
  where f.id=p_fixture_id and f.fixture_date is not null;
$function$;

create or replace function private.coordination_permission_allowed(
  p_permission text, p_actor_mode text, p_association_id uuid, p_club_id uuid default null, p_team_id uuid default null
) returns boolean
language plpgsql stable security definer set search_path=''
as $function$
declare v_result jsonb;
begin
  if auth.uid() is null then return false; end if;
  if public.is_super_admin() and public.administration_effective_mode(p_actor_mode)='super_admin' then return true; end if;
  v_result := public.resolve_effective_permission_for_mode(p_permission,p_actor_mode,p_association_id,p_club_id,null,p_team_id);
  return coalesce((v_result->>'allowed')::boolean,false);
exception when others then return false;
end;
$function$;

create or replace function private.coordination_user_has_capability(
  p_user_id uuid, p_capability text, p_association_id uuid, p_club_id uuid default null, p_team_id uuid default null, p_on_date date default current_date
) returns boolean
language sql stable security definer set search_path=''
as $function$
  select
    (p_capability in ('UMPIRE','SUPERVISING_UMPIRE') and exists (
      select 1 from public.profiles p where p.id=p_user_id and p.is_umpire
      union all select 1 from public.user_roles ur where ur.user_id=p_user_id and ur.role::text='UMPIRE'
    ))
    or exists (
      select 1 from public.coordination_capabilities c
      where c.user_id=p_user_id and c.capability_type=p_capability and c.active
        and c.active_from<=p_on_date and (c.active_until is null or c.active_until>=p_on_date)
        and ((c.scope_type='ASSOCIATION' and c.scope_id=p_association_id)
          or (c.scope_type='CLUB' and c.scope_id=p_club_id)
          or (c.scope_type='TEAM' and c.scope_id=p_team_id))
    );
$function$;

create or replace function private.coordination_queue_notice(
  p_user_id uuid, p_event_type text, p_entity_type text, p_entity_id uuid,
  p_subject text, p_body text, p_action_url text, p_dedupe_root text
) returns void
language plpgsql security definer set search_path=''
as $function$
begin
  insert into public.notifications(user_id,title,body,message,type,action_url,dedupe_key)
  values(p_user_id,p_subject,p_body,p_body,'COORDINATION',p_action_url,p_dedupe_root||':in_app')
  on conflict (dedupe_key) where dedupe_key is not null do nothing;
  insert into public.coordination_notification_deliveries(
    user_id,event_type,entity_type,entity_id,channel,status,subject,body_text,action_url,dedupe_key
  ) values(p_user_id,p_event_type,p_entity_type,p_entity_id,'IN_APP','SENT',p_subject,p_body,p_action_url,p_dedupe_root||':in_app')
  on conflict (dedupe_key) do nothing;
  insert into public.coordination_notification_deliveries(
    user_id,event_type,entity_type,entity_id,channel,status,subject,body_text,action_url,dedupe_key
  ) values(p_user_id,p_event_type,p_entity_type,p_entity_id,'EMAIL','QUEUED',p_subject,p_body,p_action_url,p_dedupe_root||':email')
  on conflict (dedupe_key) do nothing;
end;
$function$;

create or replace function private.coordination_ensure_fixture_positions(p_fixture_id uuid, p_actor_id uuid default null)
returns integer
language plpgsql security definer set search_path=''
as $function$
declare v_window record; v_template record; v_slot integer; v_count integer:=0;
begin
  select * into v_window from private.coordination_fixture_window(p_fixture_id);
  if not found then return 0; end if;
  for v_template in
    select pt.id,pt.label,t.required_count
    from public.coordination_position_templates t join public.coordination_position_types pt on pt.id=t.position_type_id
    where t.active and pt.active and pt.code in ('UMPIRE','TECHNICAL_BENCH')
      and (t.association_id=v_window.association_id or t.association_id is null)
    order by (t.association_id is not null) desc
  loop
    for v_slot in 1..v_template.required_count loop
      insert into public.coordination_positions(fixture_id,association_id,position_type_id,position_label,slot_number,starts_at,ends_at,created_by)
      values(p_fixture_id,v_window.association_id,v_template.id,v_template.label||' '||v_slot,v_slot,v_window.starts_at,v_window.ends_at,p_actor_id)
      on conflict (fixture_id,position_type_id,slot_number) where fixture_id is not null do nothing;
      if found then v_count:=v_count+1; end if;
    end loop;
  end loop;
  return v_count;
end;
$function$;

create or replace function public.coordination_prepare_fixture(p_fixture_id uuid, p_actor_mode text default null)
returns integer language plpgsql security definer set search_path=''
as $function$
declare v_window record;
begin
  if auth.uid() is null then raise exception 'You must be signed in.'; end if;
  select * into v_window from private.coordination_fixture_window(p_fixture_id);
  if not found then raise exception 'Fixture date or organisation could not be resolved.'; end if;
  if not (private.coordination_permission_allowed('coordination.umpires.manage',p_actor_mode,v_window.association_id)
    or private.coordination_permission_allowed('coordination.technical_bench.manage',p_actor_mode,v_window.association_id)) then
    raise exception 'You do not have Coordination access for this fixture.';
  end if;
  return private.coordination_ensure_fixture_positions(p_fixture_id,auth.uid());
end;
$function$;

create or replace function private.coordination_schedule_reminders(p_recipient_id uuid, p_created_at timestamptz, p_deadline timestamptz)
returns void language plpgsql security definer set search_path=''
as $function$
declare v_window interval:=p_deadline-p_created_at; v_due timestamptz;
begin
  if v_window>=interval '24 hours' then
    foreach v_due in array array[p_deadline-interval '24 hours',p_deadline-interval '4 hours'] loop
      if v_due>now() then insert into public.coordination_offer_reminders(recipient_id,reminder_type,due_at)
        values(p_recipient_id,case when v_due=p_deadline-interval '24 hours' then '24_HOURS' else '4_HOURS' end,v_due) on conflict do nothing; end if;
    end loop;
  else
    v_due:=p_created_at+(v_window/2);
    if v_due>now() then insert into public.coordination_offer_reminders(recipient_id,reminder_type,due_at) values(p_recipient_id,'HALFWAY',v_due) on conflict do nothing; end if;
    v_due:=p_deadline-interval '1 hour';
    if v_due>now() then insert into public.coordination_offer_reminders(recipient_id,reminder_type,due_at) values(p_recipient_id,'1_HOUR',v_due) on conflict do nothing; end if;
  end if;
end;
$function$;

create or replace function public.coordination_send_offer(
  p_position_id uuid, p_recipient_ids uuid[], p_note text default null,
  p_response_deadline timestamptz default null, p_actor_mode text default null, p_override_note text default null
) returns uuid
language plpgsql security definer set search_path=''
as $function$
declare v_position record; v_type record; v_batch public.coordination_offer_batches%rowtype; v_user uuid; v_recipient_id uuid;
  v_deadline timestamptz; v_warning text; v_division uuid;
begin
  if auth.uid() is null then raise exception 'You must be signed in.'; end if;
  if coalesce(array_length(p_recipient_ids,1),0)=0 then raise exception 'Select at least one person.'; end if;
  select p.*,pt.required_capability,pt.coordinator_permission,pt.label type_label into v_position
  from public.coordination_positions p join public.coordination_position_types pt on pt.id=p.position_type_id
  where p.id=p_position_id for update of p;
  if not found or v_position.state in ('CANCELLED','COMPLETED','FILLED') then raise exception 'This position is not open for offers.'; end if;
  if not private.coordination_permission_allowed(v_position.coordinator_permission,p_actor_mode,v_position.association_id,v_position.club_id,v_position.team_id) then
    raise exception 'You do not have permission to offer this position.'; end if;
  v_deadline:=coalesce(p_response_deadline,least(now()+interval '72 hours',v_position.starts_at));
  if v_deadline<=now() or v_deadline>v_position.starts_at then raise exception 'The response deadline must be after now and no later than the start time.'; end if;
  select f.division_id into v_division from public.fixtures f where f.id=v_position.fixture_id;
  select * into v_batch from public.coordination_offer_batches b where b.position_id=p_position_id and b.status='ACTIVE' for update;
  if found then
    if v_batch.response_deadline<>v_deadline or coalesce(v_batch.note,'')<>coalesce(p_note,'') then
      raise exception 'Additional recipients must use the active offer note and deadline.'; end if;
  else
    insert into public.coordination_offer_batches(position_id,offered_by,current_owner_id,response_deadline,note,urgent)
    values(p_position_id,auth.uid(),auth.uid(),v_deadline,nullif(btrim(p_note),''),v_deadline-now()<interval '2 hours') returning * into v_batch;
    insert into public.coordination_offer_note_revisions(offer_batch_id,version,note,material,changed_by)
    values(v_batch.id,1,v_batch.note,false,auth.uid());
  end if;
  foreach v_user in array p_recipient_ids loop
    if not private.coordination_user_has_capability(v_user,v_position.required_capability,v_position.association_id,v_position.club_id,v_position.team_id,v_position.starts_at::date) then
      raise exception 'One selected person does not have the required capability.'; end if;
    v_warning:=null;
    if v_position.fixture_id is not null and exists(select 1 from public.fixture_availability fa where fa.fixture_id=v_position.fixture_id and fa.user_id=v_user and fa.status='UNAVAILABLE') then v_warning:='EXPLICITLY_UNAVAILABLE'; end if;
    if v_position.required_capability='UMPIRE' and v_division is not null and not exists(
      select 1 from public.umpire_grade_signoffs s where s.user_id=v_user and s.association_id=v_position.association_id and s.division_id=v_division
        and s.status='SIGNED_OFF' and not exists(select 1 from public.umpire_grade_signoffs newer where newer.user_id=s.user_id and newer.association_id=s.association_id and newer.division_id=s.division_id and newer.created_at>s.created_at)
    ) then v_warning:=coalesce(v_warning||',','')||'NOT_SIGNED_OFF_FOR_GRADE'; end if;
    if v_warning is not null and nullif(btrim(p_override_note),'') is null then raise exception 'A warning override note is required: %',v_warning; end if;
    insert into public.coordination_offer_recipients(offer_batch_id,user_id) values(v_batch.id,v_user)
    on conflict (offer_batch_id,user_id) do nothing returning id into v_recipient_id;
    if v_recipient_id is not null then
      perform private.coordination_schedule_reminders(v_recipient_id,v_batch.created_at,v_batch.response_deadline);
      perform private.coordination_queue_notice(v_user,'OFFER_SENT','OFFER_RECIPIENT',v_recipient_id,
        case when v_batch.urgent then 'Urgent Coordination offer' else 'New Coordination offer' end,
        v_position.position_label||' has been offered to you. Accepting means willing; the coordinator must still confirm you.',
        '/coordination/my-assignments','coordination:offer:'||v_recipient_id);
      if v_warning is not null then insert into public.coordination_warning_overrides(entity_type,entity_id,warning_code,note,overridden_by)
        values('OFFER_RECIPIENT',v_recipient_id,v_warning,btrim(p_override_note),auth.uid()); end if;
    end if;
  end loop;
  update public.coordination_positions set state='OFFERING',updated_at=now() where id=p_position_id;
  return v_batch.id;
end;
$function$;

create or replace function public.coordination_respond_to_offer(
  p_recipient_id uuid, p_response text, p_reason text default null
) returns text language plpgsql security definer set search_path=''
as $function$
declare v_recipient public.coordination_offer_recipients%rowtype; v_batch public.coordination_offer_batches%rowtype; v_new text;
begin
  if auth.uid() is null then raise exception 'You must be signed in.'; end if;
  select * into v_recipient from public.coordination_offer_recipients where id=p_recipient_id for update;
  if not found or v_recipient.user_id<>auth.uid() then raise exception 'This offer is not yours.'; end if;
  select * into v_batch from public.coordination_offer_batches where id=v_recipient.offer_batch_id;
  if v_batch.status<>'ACTIVE' then raise exception 'This offer is no longer active.'; end if;
  if p_response='ACCEPT' then
    if v_recipient.status<>'PENDING' or now()>v_batch.response_deadline then raise exception 'This offer can no longer be accepted.'; end if;
    v_new:='ACCEPTED_AWAITING_CONFIRMATION';
  elsif p_response='DECLINE' then
    if v_recipient.status not in ('PENDING','ACCEPTED_AWAITING_CONFIRMATION') then raise exception 'This offer can no longer be declined.'; end if;
    v_new:='DECLINED';
  elsif p_response='WITHDRAW' then
    if v_recipient.status not in ('PENDING','ACCEPTED_AWAITING_CONFIRMATION') then raise exception 'This response can no longer be withdrawn.'; end if;
    v_new:='WITHDRAWN';
  else raise exception 'Unknown response.'; end if;
  update public.coordination_offer_recipients set status=v_new,responded_at=now(),decline_reason=case when v_new='DECLINED' then nullif(btrim(p_reason),'') else null end,
    acceptance_note_version=case when v_new='ACCEPTED_AWAITING_CONFIRMATION' then v_batch.note_version else null end,updated_at=now() where id=p_recipient_id;
  update public.coordination_positions set state=case when exists(select 1 from public.coordination_offer_recipients r where r.offer_batch_id=v_batch.id and r.status='ACCEPTED_AWAITING_CONFIRMATION') then 'AWAITING_CONFIRMATION' else 'OFFERING' end,updated_at=now() where id=v_batch.position_id;
  perform private.coordination_queue_notice(v_batch.current_owner_id,'OFFER_RESPONSE','OFFER_RECIPIENT',p_recipient_id,'Coordination offer response',
    'A recipient has '||lower(replace(v_new,'_',' '))||'.','/coordination','coordination:response:'||p_recipient_id||':'||v_new);
  return v_new;
end;
$function$;

create or replace function public.coordination_confirm_offer(
  p_recipient_id uuid, p_actor_mode text default null, p_warning_override_note text default null
) returns uuid language plpgsql security definer set search_path=''
as $function$
declare v_r public.coordination_offer_recipients%rowtype; v_b public.coordination_offer_batches%rowtype; v_p record; v_assignment public.coordination_assignments%rowtype;
  v_status public.availability_status_enum; v_warning text; v_existing uuid; v_other_dob date; v_dob date;
begin
  if auth.uid() is null then raise exception 'You must be signed in.'; end if;
  select * into v_r from public.coordination_offer_recipients where id=p_recipient_id for update;
  select * into v_b from public.coordination_offer_batches where id=v_r.offer_batch_id for update;
  select p.*,pt.required_capability,pt.coordinator_permission,pt.code into v_p from public.coordination_positions p join public.coordination_position_types pt on pt.id=p.position_type_id where p.id=v_b.position_id for update of p;
  if v_r.status<>'ACCEPTED_AWAITING_CONFIRMATION' or v_b.status<>'ACTIVE' then raise exception 'The person has not accepted an active offer.'; end if;
  if now()>v_p.starts_at then raise exception 'Use late assignment after the start time.'; end if;
  if not private.coordination_permission_allowed(v_p.coordinator_permission,p_actor_mode,v_p.association_id,v_p.club_id,v_p.team_id) then raise exception 'You do not have permission to confirm this offer.'; end if;
  if not private.coordination_user_has_capability(v_r.user_id,v_p.required_capability,v_p.association_id,v_p.club_id,v_p.team_id,v_p.starts_at::date) then raise exception 'The person no longer has the required capability.'; end if;
  if v_p.fixture_id is not null and exists(select 1 from public.fixture_availability fa where fa.fixture_id=v_p.fixture_id and fa.user_id=v_r.user_id and fa.status='UNAVAILABLE') then v_warning:='EXPLICITLY_UNAVAILABLE'; end if;
  if v_p.code='TECHNICAL_BENCH' then
    if not exists(select 1 from public.coordination_assignments a join public.coordination_positions p on p.id=a.position_id join public.coordination_position_types pt on pt.id=p.position_type_id where a.assigned_user_id=v_r.user_id and a.status='COMPLETED' and pt.code='TECHNICAL_BENCH') then v_warning:=coalesce(v_warning||',','')||'FIRST_TECHNICAL_BENCH_DUTY'; end if;
    select date_of_birth into v_dob from public.profiles where id=v_r.user_id;
    select pr.date_of_birth into v_other_dob from public.coordination_assignments a join public.coordination_positions p on p.id=a.position_id join public.coordination_position_types pt on pt.id=p.position_type_id join public.profiles pr on pr.id=a.assigned_user_id where p.fixture_id=v_p.fixture_id and pt.code='TECHNICAL_BENCH' and a.status='CONFIRMED' limit 1;
    if v_dob is null or (v_other_dob is not null and age(v_p.starts_at::date,v_dob)<interval '18 years' and age(v_p.starts_at::date,v_other_dob)<interval '18 years') then v_warning:=coalesce(v_warning||',','')||case when v_dob is null then 'AGE_UNKNOWN' else 'TWO_UNDER_18' end; end if;
  end if;
  if v_warning is not null and nullif(btrim(p_warning_override_note),'') is null then raise exception 'A warning override note is required: %',v_warning; end if;
  select id into v_existing from public.coordination_assignments where position_id=v_p.id and assigned_user_id=v_r.user_id and status='RECONFIRMATION_REQUIRED' for update;
  if v_existing is not null then
    update public.coordination_assignments set status='CONFIRMED',confirmed_by=auth.uid(),confirmed_at=now(),starts_at=v_p.starts_at,ends_at=v_p.ends_at,confirmation_note=nullif(btrim(p_warning_override_note),''),updated_at=now() where id=v_existing returning * into v_assignment;
  else
    insert into public.coordination_assignments(position_id,assigned_user_id,offer_recipient_id,assigned_by,confirmed_by,starts_at,ends_at,confirmation_note)
    values(v_p.id,v_r.user_id,v_r.id,v_b.offered_by,auth.uid(),v_p.starts_at,v_p.ends_at,nullif(btrim(p_warning_override_note),'')) returning * into v_assignment;
  end if;
  update public.coordination_offer_recipients set status=case when id=v_r.id then 'CONFIRMED' else 'NOT_SELECTED' end,updated_at=now() where offer_batch_id=v_b.id and status in ('PENDING','ACCEPTED_AWAITING_CONFIRMATION');
  update public.coordination_offer_batches set status='CONFIRMED',updated_at=now() where id=v_b.id;
  update public.coordination_offer_reminders set status='CANCELLED',processed_at=now() where recipient_id in (select id from public.coordination_offer_recipients where offer_batch_id=v_b.id) and status='PENDING';
  update public.coordination_positions set state='FILLED',updated_at=now() where id=v_p.id;
  if v_p.fixture_id is not null then
    v_status:=case v_p.code when 'UMPIRE' then 'UMPIRING'::public.availability_status_enum when 'TECHNICAL_BENCH' then 'TECHNICAL_BENCH'::public.availability_status_enum else 'VOLUNTEERING'::public.availability_status_enum end;
    insert into public.fixture_availability(fixture_id,user_id,status,note) values(v_p.fixture_id,v_r.user_id,v_status,'Confirmed Coordination assignment')
    on conflict (fixture_id,user_id) do update set status=excluded.status,note=excluded.note,updated_at=now();
  end if;
  insert into public.coordination_assignment_events(assignment_id,position_id,event_type,actor_id,detail) values(v_assignment.id,v_p.id,'CONFIRMED',auth.uid(),jsonb_build_object('offer_recipient_id',v_r.id));
  if v_warning is not null then insert into public.coordination_warning_overrides(entity_type,entity_id,warning_code,note,overridden_by) values('ASSIGNMENT',v_assignment.id,v_warning,btrim(p_warning_override_note),auth.uid()); end if;
  perform private.coordination_queue_notice(v_r.user_id,'ASSIGNMENT_CONFIRMED','ASSIGNMENT',v_assignment.id,'Coordination assignment confirmed',v_p.position_label||' is now confirmed.','/coordination/my-assignments','coordination:confirmed:'||v_assignment.id);
  perform private.coordination_queue_notice(r.user_id,'NOT_SELECTED','OFFER_RECIPIENT',r.id,'Coordination offer closed','Another person was confirmed for '||v_p.position_label||'.','/coordination/my-assignments','coordination:not-selected:'||r.id)
    from public.coordination_offer_recipients r where r.offer_batch_id=v_b.id and r.id<>v_r.id;
  return v_assignment.id;
end;
$function$;

create or replace function public.coordination_request_replacement(p_assignment_id uuid, p_note text)
returns uuid language plpgsql security definer set search_path=''
as $function$
declare v_a public.coordination_assignments%rowtype; v_request uuid;
begin
  if auth.uid() is null then raise exception 'You must be signed in.'; end if;
  if nullif(btrim(p_note),'') is null then raise exception 'A replacement note is required.'; end if;
  select * into v_a from public.coordination_assignments where id=p_assignment_id for update;
  if not found or v_a.assigned_user_id<>auth.uid() or v_a.status<>'CONFIRMED' then raise exception 'This confirmed assignment cannot be changed by you.'; end if;
  insert into public.coordination_replacement_requests(assignment_id,requested_by,note) values(v_a.id,auth.uid(),btrim(p_note)) returning id into v_request;
  update public.coordination_assignments set status='REPLACEMENT_REQUESTED',updated_at=now() where id=v_a.id;
  update public.coordination_positions set state='REPLACEMENT_REQUIRED',updated_at=now() where id=v_a.position_id;
  insert into public.coordination_assignment_events(assignment_id,position_id,event_type,actor_id,detail) values(v_a.id,v_a.position_id,'REPLACEMENT_REQUESTED',auth.uid(),jsonb_build_object('request_id',v_request));
  perform private.coordination_queue_notice(a.confirmed_by,'REPLACEMENT_REQUESTED','REPLACEMENT_REQUEST',v_request,'Replacement requested','A confirmed person has requested a replacement.','/coordination','coordination:replacement:'||v_request)
    from public.coordination_assignments a where a.id=v_a.id;
  return v_request;
end;
$function$;

create or replace function public.coordination_take_over_offer(p_offer_batch_id uuid, p_reason text, p_actor_mode text default null)
returns void language plpgsql security definer set search_path=''
as $function$
declare v_b public.coordination_offer_batches%rowtype; v_p record; v_old uuid;
begin
  if nullif(btrim(p_reason),'') is null then raise exception 'A takeover reason is required.'; end if;
  select * into v_b from public.coordination_offer_batches where id=p_offer_batch_id and status='ACTIVE' for update;
  select p.*,pt.coordinator_permission into v_p from public.coordination_positions p join public.coordination_position_types pt on pt.id=p.position_type_id where p.id=v_b.position_id;
  if not private.coordination_permission_allowed('coordination.offers.take_over',p_actor_mode,v_p.association_id,v_p.club_id,v_p.team_id)
    and not private.coordination_permission_allowed(v_p.coordinator_permission,p_actor_mode,v_p.association_id,v_p.club_id,v_p.team_id) then raise exception 'You cannot take over this offer.'; end if;
  v_old:=v_b.current_owner_id;
  update public.coordination_offer_batches set current_owner_id=auth.uid(),takeover_reason=btrim(p_reason),updated_at=now() where id=v_b.id;
  insert into public.coordination_assignment_events(position_id,event_type,actor_id,detail) values(v_b.position_id,'OFFER_TAKEN_OVER',auth.uid(),jsonb_build_object('previous_owner_id',v_old,'reason',btrim(p_reason)));
  perform private.coordination_queue_notice(v_old,'OFFER_TAKEN_OVER','OFFER_BATCH',v_b.id,'Coordination offer taken over','Another authorised coordinator has taken over this offer.','/coordination','coordination:takeover:'||v_b.id);
end;
$function$;

create or replace function public.coordination_revise_offer_note(p_offer_batch_id uuid,p_note text,p_material boolean,p_actor_mode text default null)
returns integer language plpgsql security definer set search_path=''
as $function$
declare v_b public.coordination_offer_batches%rowtype; v_p record; v_version integer;
begin
  select * into v_b from public.coordination_offer_batches where id=p_offer_batch_id and status='ACTIVE' for update;
  select p.*,pt.coordinator_permission into v_p from public.coordination_positions p join public.coordination_position_types pt on pt.id=p.position_type_id where p.id=v_b.position_id;
  if not private.coordination_permission_allowed(v_p.coordinator_permission,p_actor_mode,v_p.association_id,v_p.club_id,v_p.team_id) then raise exception 'You cannot revise this offer.'; end if;
  v_version:=v_b.note_version+1;
  update public.coordination_offer_batches set note=nullif(btrim(p_note),''),note_version=v_version,updated_at=now() where id=v_b.id;
  insert into public.coordination_offer_note_revisions(offer_batch_id,version,note,material,changed_by) values(v_b.id,v_version,nullif(btrim(p_note),''),p_material,auth.uid());
  if p_material then update public.coordination_offer_recipients set status='PENDING',responded_at=null,acceptance_note_version=null,updated_at=now() where offer_batch_id=v_b.id and status='ACCEPTED_AWAITING_CONFIRMATION'; end if;
  perform private.coordination_queue_notice(r.user_id,'OFFER_NOTE_REVISED','OFFER_RECIPIENT',r.id,'Coordination offer updated',case when p_material then 'Important offer details changed. Please respond again.' else 'The offer note was updated.' end,'/coordination/my-assignments','coordination:note-revision:'||v_b.id||':'||v_version||':'||r.id)
    from public.coordination_offer_recipients r where r.offer_batch_id=v_b.id and r.status not in ('DECLINED','WITHDRAWN','EXPIRED','NOT_SELECTED');
  return v_version;
end;
$function$;

create or replace function public.coordination_process_due_work()
returns jsonb language plpgsql security definer set search_path=''
as $function$
declare v_reminders integer; v_expired integer;
begin
  if session_user not in ('postgres','supabase_admin') and coalesce(auth.jwt()->>'role','')<>'service_role' then raise exception 'Service role required'; end if;
  with due as (
    update public.coordination_offer_reminders rem set status='QUEUED',processed_at=now(),attempts=attempts+1
    from public.coordination_offer_recipients r,public.coordination_offer_batches b
    where rem.recipient_id=r.id and r.offer_batch_id=b.id and rem.status='PENDING' and rem.due_at<=now() and r.status='PENDING' and b.status='ACTIVE'
    returning rem.id,rem.recipient_id
  ), notices as (
    select private.coordination_queue_notice(r.user_id,'OFFER_REMINDER','OFFER_RECIPIENT',r.id,'Coordination offer reminder','Your Coordination offer is waiting for a response.','/coordination/my-assignments','coordination:reminder:'||d.id)
    from due d join public.coordination_offer_recipients r on r.id=d.recipient_id
  ) select count(*) into v_reminders from due;
  update public.coordination_offer_reminders set status='SENT' where status='QUEUED' and processed_at>=statement_timestamp()-interval '1 minute';
  with expired as (
    update public.coordination_offer_recipients r set status='EXPIRED',responded_at=now(),updated_at=now()
    from public.coordination_offer_batches b where r.offer_batch_id=b.id and b.status='ACTIVE' and b.response_deadline<=now() and r.status='PENDING' returning r.id
  ) select count(*) into v_expired from expired;
  update public.coordination_offer_batches b set status='EXPIRED',updated_at=now()
  where b.status='ACTIVE' and b.response_deadline<=now() and not exists(select 1 from public.coordination_offer_recipients r where r.offer_batch_id=b.id and r.status='ACCEPTED_AWAITING_CONFIRMATION');
  return jsonb_build_object('reminders',v_reminders,'expired',v_expired);
end;
$function$;

create or replace function private.coordination_fixture_material_change()
returns trigger language plpgsql security definer set search_path=''
as $function$
declare v_position record; v_assignment record; v_batch uuid; v_deadline timestamptz;
begin
  if new.fixture_date is not distinct from old.fixture_date and new.scheduled_end_at is not distinct from old.scheduled_end_at
    and new.venue_id is not distinct from old.venue_id and new.pitch_id is not distinct from old.pitch_id
    and new.home_team_id is not distinct from old.home_team_id and new.away_team_id is not distinct from old.away_team_id then return new; end if;
  perform private.coordination_ensure_fixture_positions(new.id,null);
  for v_position in select p.*,w.ends_at new_end from public.coordination_positions p cross join lateral private.coordination_fixture_window(new.id) w where p.fixture_id=new.id loop
    update public.coordination_positions set starts_at=new.fixture_date,ends_at=v_position.new_end,updated_at=now() where id=v_position.id;
    update public.coordination_offer_batches set status='SUPERSEDED',updated_at=now() where position_id=v_position.id and status='ACTIVE';
    for v_assignment in select * from public.coordination_assignments where position_id=v_position.id and status='CONFIRMED' loop
      update public.coordination_assignments set status='RECONFIRMATION_REQUIRED',starts_at=new.fixture_date,ends_at=v_position.new_end,updated_at=now() where id=v_assignment.id;
      update public.coordination_positions set state='RECONFIRMATION_REQUIRED' where id=v_position.id;
      delete from public.fixture_availability where fixture_id=new.id and user_id=v_assignment.assigned_user_id;
      insert into public.coordination_assignment_events(assignment_id,position_id,event_type,detail) values(v_assignment.id,v_position.id,'RECONFIRMATION_REQUIRED',jsonb_build_object('reason','MATERIAL_FIXTURE_CHANGE'));
      if new.fixture_date>now() then
        v_deadline:=least(new.fixture_date,now()+interval '72 hours');
        insert into public.coordination_offer_batches(position_id,offered_by,current_owner_id,response_deadline,note,urgent) values(v_position.id,v_assignment.confirmed_by,v_assignment.confirmed_by,v_deadline,'Fixture details changed. Please confirm the new details.',v_deadline-now()<interval '2 hours') returning id into v_batch;
        insert into public.coordination_offer_note_revisions(offer_batch_id,version,note,material,changed_by) values(v_batch,1,'Fixture details changed. Please confirm the new details.',true,v_assignment.confirmed_by);
        insert into public.coordination_offer_recipients(offer_batch_id,user_id) values(v_batch,v_assignment.assigned_user_id);
        perform private.coordination_queue_notice(v_assignment.assigned_user_id,'RECONFIRMATION_REQUIRED','ASSIGNMENT',v_assignment.id,'Fixture details changed','Please accept the changed fixture details. The coordinator must then confirm you again.','/coordination/my-assignments','coordination:reconfirm:'||v_assignment.id||':'||new.updated_at::text);
      end if;
    end loop;
  end loop;
  return new;
end;
$function$;

create or replace function private.coordination_check_umpire_vote_roster()
returns trigger language plpgsql security definer set search_path=''
as $function$
declare v_result text; v_snapshot jsonb; v_name text;
begin
  if new.fixture_id is null then v_result:='UNVERIFIABLE'; v_snapshot:='[]'::jsonb;
  else
    select coalesce(jsonb_agg(jsonb_build_object('assignment_id',a.id,'user_id',a.assigned_user_id,'name',concat_ws(' ',p.first_name,p.last_name),'status',a.status)),'[]'::jsonb)
    into v_snapshot from public.coordination_assignments a join public.coordination_positions cp on cp.id=a.position_id join public.coordination_position_types pt on pt.id=cp.position_type_id join public.profiles p on p.id=a.assigned_user_id
    where cp.fixture_id=new.fixture_id and pt.code in ('UMPIRE','SUPERVISING_UMPIRE') and a.status in ('CONFIRMED','COMPLETED','DISPUTED');
    if jsonb_array_length(v_snapshot)=0 then v_result:='NO_ROSTER';
    elsif exists(select 1 from jsonb_array_elements(v_snapshot) x where x->>'status'='DISPUTED') then v_result:='ROSTER_DISPUTED';
    elsif new.umpire_user_id is not null then v_result:=case when exists(select 1 from jsonb_array_elements(v_snapshot) x where x->>'user_id'=new.umpire_user_id::text) then 'MATCHED' else 'MISMATCH' end;
    elsif nullif(btrim(new.proxy_umpire_name),'') is not null then v_name:=lower(btrim(new.proxy_umpire_name)); v_result:=case when exists(select 1 from jsonb_array_elements(v_snapshot) x where lower(btrim(x->>'name'))=v_name) then 'VALID_PROXY' else 'MISMATCH' end;
    else v_result:='UNVERIFIABLE'; end if;
  end if;
  insert into public.umpire_match_roster_checks(submission_id,fixture_id,result,roster_snapshot,detail)
  values(new.id,new.fixture_id,v_result,v_snapshot,'Automated check only; the Umpire Match Voting submission is unchanged.');
  return new;
end;
$function$;

drop trigger if exists coordination_fixture_material_change on public.fixtures;
create trigger coordination_fixture_material_change after update of fixture_date,scheduled_end_at,venue_id,pitch_id,home_team_id,away_team_id on public.fixtures
for each row execute function private.coordination_fixture_material_change();
drop trigger if exists coordination_check_umpire_vote_roster on public.player_vote_submissions;
create trigger coordination_check_umpire_vote_roster after insert or update of fixture_id,umpire_user_id,proxy_umpire_name,public_identity_status on public.player_vote_submissions
for each row execute function private.coordination_check_umpire_vote_roster();

-- Read-only Matrix view. Exact dates of birth and restricted note text are deliberately excluded.
create or replace view public.coordination_umpire_matrix with (security_invoker=true) as
select p.id user_id,concat_ws(' ',p.first_name,p.last_name) display_name,
  coalesce(c.scope_id,d.association_id) association_id,
  count(a.id) filter(where a.status='COMPLETED') completed_games,
  count(distinct cp.fixture_id) filter(where a.status in ('CONFIRMED','RECONFIRMATION_REQUIRED','REPLACEMENT_REQUESTED')) upcoming_games,
  count(rr.id) replacement_requests,
  max(a.completed_at) last_completed_at
from public.profiles p
left join public.coordination_capabilities c on c.user_id=p.id and c.capability_type='UMPIRE' and c.scope_type='ASSOCIATION' and c.active
left join public.coordination_assignments a on a.assigned_user_id=p.id
left join public.coordination_positions cp on cp.id=a.position_id
left join public.fixtures f on f.id=cp.fixture_id
left join public.divisions d on d.id=f.division_id
left join public.coordination_replacement_requests rr on rr.assignment_id=a.id
where p.is_umpire or c.id is not null or exists(select 1 from public.user_roles ur where ur.user_id=p.id and ur.role::text='UMPIRE')
group by p.id,p.first_name,p.last_name,coalesce(c.scope_id,d.association_id);

-- All exposed tables are explicitly granted then protected by RLS. Mutations use narrow RPCs.
do $block$
declare v_table text;
begin
  foreach v_table in array array[
    'coordination_capabilities','coordination_capability_invitations','coordination_position_types','coordination_position_templates',
    'coordination_activities','coordination_positions','coordination_offer_batches','coordination_offer_recipients',
    'coordination_offer_note_revisions','coordination_offer_reminders','coordination_notification_deliveries','coordination_assignments',
    'coordination_replacement_requests','coordination_assignment_events','coordination_warning_overrides','umpire_grade_signoffs',
    'umpire_qualifications','umpire_coordinator_notes','coordination_supervision_links','coordination_supervision_notes','umpire_match_roster_checks'
  ] loop
    execute format('alter table public.%I enable row level security',v_table);
    execute format('revoke all on public.%I from anon, authenticated',v_table);
    execute format('grant select on public.%I to authenticated',v_table);
    execute format('grant select,insert,update,delete on public.%I to service_role',v_table);
  end loop;
end $block$;
grant select on public.coordination_umpire_matrix to authenticated,service_role;

create policy coordination_capabilities_read on public.coordination_capabilities for select to authenticated
using (user_id=(select auth.uid()) or (select public.is_super_admin()));
create policy coordination_capability_invitations_read on public.coordination_capability_invitations for select to authenticated
using (user_id=(select auth.uid()) or invited_by=(select auth.uid()) or (select public.is_super_admin()));
create policy coordination_position_types_read on public.coordination_position_types for select to authenticated using(true);
create policy coordination_position_templates_read on public.coordination_position_templates for select to authenticated using(true);
create policy coordination_activities_read on public.coordination_activities for select to authenticated using(coordinator_id=(select auth.uid()) or (select public.is_super_admin()));
create policy coordination_positions_read on public.coordination_positions for select to authenticated using(
  (select public.is_super_admin()) or created_by=(select auth.uid()) or exists(select 1 from public.coordination_offer_batches b join public.coordination_offer_recipients r on r.offer_batch_id=b.id where b.position_id=coordination_positions.id and r.user_id=(select auth.uid())) or exists(select 1 from public.coordination_assignments a where a.position_id=coordination_positions.id and a.assigned_user_id=(select auth.uid()))
);
create policy coordination_offer_batches_read on public.coordination_offer_batches for select to authenticated using(
  offered_by=(select auth.uid()) or current_owner_id=(select auth.uid()) or (select public.is_super_admin()) or exists(select 1 from public.coordination_offer_recipients r where r.offer_batch_id=coordination_offer_batches.id and r.user_id=(select auth.uid()))
);
create policy coordination_offer_recipients_read on public.coordination_offer_recipients for select to authenticated using(user_id=(select auth.uid()) or (select public.is_super_admin()) or exists(select 1 from public.coordination_offer_batches b where b.id=coordination_offer_recipients.offer_batch_id and b.current_owner_id=(select auth.uid())));
create policy coordination_offer_note_revisions_read on public.coordination_offer_note_revisions for select to authenticated using((select public.is_super_admin()) or exists(select 1 from public.coordination_offer_batches b left join public.coordination_offer_recipients r on r.offer_batch_id=b.id where b.id=coordination_offer_note_revisions.offer_batch_id and ((b.current_owner_id=(select auth.uid())) or r.user_id=(select auth.uid()))));
create policy coordination_offer_reminders_read on public.coordination_offer_reminders for select to authenticated using((select public.is_super_admin()) or exists(select 1 from public.coordination_offer_recipients r where r.id=coordination_offer_reminders.recipient_id and r.user_id=(select auth.uid())));
create policy coordination_notification_deliveries_read on public.coordination_notification_deliveries for select to authenticated using(user_id=(select auth.uid()) or (select public.is_super_admin()));
create policy coordination_assignments_read on public.coordination_assignments for select to authenticated using(assigned_user_id=(select auth.uid()) or confirmed_by=(select auth.uid()) or assigned_by=(select auth.uid()) or (select public.is_super_admin()));
create policy coordination_replacement_requests_read on public.coordination_replacement_requests for select to authenticated using(requested_by=(select auth.uid()) or (select public.is_super_admin()) or exists(select 1 from public.coordination_assignments a where a.id=coordination_replacement_requests.assignment_id and a.confirmed_by=(select auth.uid())));
create policy coordination_assignment_events_read on public.coordination_assignment_events for select to authenticated using((select public.is_super_admin()) or actor_id=(select auth.uid()) or exists(select 1 from public.coordination_assignments a where a.id=coordination_assignment_events.assignment_id and (a.assigned_user_id=(select auth.uid()) or a.confirmed_by=(select auth.uid()))));
create policy coordination_warning_overrides_read on public.coordination_warning_overrides for select to authenticated using(overridden_by=(select auth.uid()) or (select public.is_super_admin()));
create policy umpire_grade_signoffs_read on public.umpire_grade_signoffs for select to authenticated using(user_id=(select auth.uid()) or signed_by=(select auth.uid()) or (select public.is_super_admin()));
create policy umpire_qualifications_read on public.umpire_qualifications for select to authenticated using(user_id=(select auth.uid()) or added_by=(select auth.uid()) or (select public.is_super_admin()));
create policy umpire_coordinator_notes_read on public.umpire_coordinator_notes for select to authenticated using(created_by=(select auth.uid()) or (select public.is_super_admin()));
create policy coordination_supervision_links_read on public.coordination_supervision_links for select to authenticated using((select public.is_super_admin()) or exists(select 1 from public.coordination_assignments a where a.id in (coordination_supervision_links.supervisor_assignment_id,coordination_supervision_links.supervised_assignment_id) and a.assigned_user_id=(select auth.uid())));
create policy coordination_supervision_notes_read on public.coordination_supervision_notes for select to authenticated using(author_id=(select auth.uid()) or (select public.is_super_admin()));
create policy umpire_match_roster_checks_read on public.umpire_match_roster_checks for select to authenticated using((select public.is_super_admin()));

revoke all on all functions in schema private from public,anon,authenticated;
revoke all on function public.coordination_prepare_fixture(uuid,text) from public,anon;
revoke all on function public.coordination_send_offer(uuid,uuid[],text,timestamptz,text,text) from public,anon;
revoke all on function public.coordination_respond_to_offer(uuid,text,text) from public,anon;
revoke all on function public.coordination_confirm_offer(uuid,text,text) from public,anon;
revoke all on function public.coordination_request_replacement(uuid,text) from public,anon;
revoke all on function public.coordination_take_over_offer(uuid,text,text) from public,anon;
revoke all on function public.coordination_revise_offer_note(uuid,text,boolean,text) from public,anon;
revoke all on function public.coordination_process_due_work() from public,anon,authenticated;
grant execute on function public.coordination_prepare_fixture(uuid,text) to authenticated;
grant execute on function public.coordination_send_offer(uuid,uuid[],text,timestamptz,text,text) to authenticated;
grant execute on function public.coordination_respond_to_offer(uuid,text,text) to authenticated;
grant execute on function public.coordination_confirm_offer(uuid,text,text) to authenticated;
grant execute on function public.coordination_request_replacement(uuid,text) to authenticated;
grant execute on function public.coordination_take_over_offer(uuid,text,text) to authenticated;
grant execute on function public.coordination_revise_offer_note(uuid,text,boolean,text) to authenticated;
grant execute on function public.coordination_process_due_work() to service_role;
grant usage on schema private to authenticated,service_role;

comment on table public.coordination_assignments is 'Official Coordination roster. Recipient acceptance alone never creates a row.';
comment on table public.umpire_coordinator_notes is 'Permanent restricted history. Privacy redaction retains event metadata; Production requires privacy approval.';
comment on table public.umpire_match_roster_checks is 'Flags roster differences without changing Umpire Match Voting submissions.';
