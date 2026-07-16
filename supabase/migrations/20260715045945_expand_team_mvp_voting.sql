-- Team-owned MVP voting expansion.
--
-- This migration is additive. Existing fixture-wide sessions deliberately keep
-- team_id = null and remain historical records; no owning team is inferred.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Team and session state
-- ---------------------------------------------------------------------------

alter table public.teams
  add column if not exists mvp_enabled boolean not null default false;

alter table public.mvp_voting_sessions
  add column if not exists team_id uuid references public.teams(id) on delete set null,
  add column if not exists opened_by uuid references public.profiles(id) on delete set null,
  add column if not exists closed_at timestamptz,
  add column if not exists closed_by uuid references public.profiles(id) on delete set null,
  add column if not exists locked_at timestamptz,
  add column if not exists locked_by uuid references public.profiles(id) on delete set null,
  add column if not exists locked_reason text,
  add column if not exists results_confirmed_at timestamptz,
  add column if not exists results_confirmed_by uuid references public.profiles(id) on delete set null,
  add column if not exists result_check_round integer not null default 1,
  add column if not exists voting_cycle integer not null default 1;

do $migration$
begin
  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.mvp_voting_sessions'::regclass
      and conname = 'mvp_voting_sessions_result_check_round_check'
  ) then
    alter table public.mvp_voting_sessions
      add constraint mvp_voting_sessions_result_check_round_check
      check (result_check_round > 0);
  end if;

  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.mvp_voting_sessions'::regclass
      and conname = 'mvp_voting_sessions_voting_cycle_check'
  ) then
    alter table public.mvp_voting_sessions
      add constraint mvp_voting_sessions_voting_cycle_check
      check (voting_cycle > 0);
  end if;
end
$migration$;

-- A legacy one-column fixture uniqueness rule would prevent independent home
-- and away sessions. Remove only that exact rule; legacy rows are not changed.
do $migration$
declare
  v_constraint record;
  v_index record;
  v_fixture_attnum smallint;
begin
  select a.attnum::smallint
  into v_fixture_attnum
  from pg_catalog.pg_attribute a
  where a.attrelid = 'public.mvp_voting_sessions'::regclass
    and a.attname = 'fixture_id'
    and not a.attisdropped;

  for v_constraint in
    select c.conname
    from pg_catalog.pg_constraint c
    where c.conrelid = 'public.mvp_voting_sessions'::regclass
      and c.contype = 'u'
      and c.conkey = array[v_fixture_attnum]::smallint[]
  loop
    execute format(
      'alter table public.mvp_voting_sessions drop constraint %I',
      v_constraint.conname
    );
  end loop;

  for v_index in
    select index_class.relname as index_name
    from pg_catalog.pg_index i
    join pg_catalog.pg_class index_class on index_class.oid = i.indexrelid
    where i.indrelid = 'public.mvp_voting_sessions'::regclass
      and i.indisunique
      and i.indpred is null
      and i.indnkeyatts = 1
      and i.indkey[0] = v_fixture_attnum
      and not exists (
        select 1 from pg_catalog.pg_constraint c where c.conindid = i.indexrelid
      )
  loop
    execute format('drop index if exists public.%I', v_index.index_name);
  end loop;
end
$migration$;

create unique index if not exists mvp_voting_sessions_fixture_team_uidx
  on public.mvp_voting_sessions (fixture_id, team_id)
  where team_id is not null;

create index if not exists mvp_voting_sessions_team_status_close_idx
  on public.mvp_voting_sessions (team_id, status, closes_at)
  where team_id is not null;

create index if not exists mvp_voting_sessions_fixture_team_idx
  on public.mvp_voting_sessions (fixture_id, team_id);

-- Signed-in ballots must contain one 3/2/1 row per point value and must not
-- select the same player twice. Token-era rows have a null voter_profile_id and
-- are intentionally outside these partial indexes.
create unique index if not exists mvp_votes_signed_in_point_uidx
  on public.mvp_votes (session_id, voter_profile_id, points)
  where voter_profile_id is not null;

create unique index if not exists mvp_votes_signed_in_player_uidx
  on public.mvp_votes (session_id, voter_profile_id, player_id)
  where voter_profile_id is not null;

create unique index if not exists mvp_vote_submissions_voter_uidx
  on public.mvp_vote_submissions (session_id, voter_profile_id)
  where voter_profile_id is not null;

create index if not exists mvp_vote_submissions_session_profile_idx
  on public.mvp_vote_submissions (session_id, voter_profile_id);

-- ---------------------------------------------------------------------------
-- Immutable result checks and richer audit history
-- ---------------------------------------------------------------------------

create table if not exists public.mvp_result_checks (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.mvp_voting_sessions(id) on delete cascade,
  result_check_round integer not null,
  voter_profile_id uuid not null references public.profiles(id) on delete restrict,
  response text not null,
  comment text,
  created_at timestamptz not null default now(),
  constraint mvp_result_checks_round_check check (result_check_round > 0),
  constraint mvp_result_checks_response_check check (response in ('CORRECT', 'INCORRECT')),
  constraint mvp_result_checks_comment_length_check check (comment is null or char_length(comment) <= 2000),
  constraint mvp_result_checks_one_response_per_round unique (
    session_id,
    result_check_round,
    voter_profile_id
  )
);

create index if not exists mvp_result_checks_session_round_response_idx
  on public.mvp_result_checks (session_id, result_check_round, response);

create index if not exists mvp_result_checks_voter_idx
  on public.mvp_result_checks (voter_profile_id, created_at desc);

alter table public.mvp_result_checks enable row level security;

create or replace function private.prevent_mvp_result_check_changes()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $function$
begin
  raise exception using
    errcode = 'P0001',
    message = 'MVP_RESULT_CHECK_IMMUTABLE';
end
$function$;

drop trigger if exists mvp_result_checks_are_immutable on public.mvp_result_checks;
create trigger mvp_result_checks_are_immutable
before update or delete on public.mvp_result_checks
for each row execute function private.prevent_mvp_result_check_changes();

revoke all on function private.prevent_mvp_result_check_changes() from public, anon, authenticated;

alter table public.mvp_vote_audit
  add column if not exists team_id uuid references public.teams(id) on delete set null,
  add column if not exists voter_profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists details jsonb not null default '{}'::jsonb;

-- Team-setting events have no session yet, so the existing audit table needs to
-- accept a null session_id while retaining the team_id and full details.
alter table public.mvp_vote_audit
  alter column session_id drop not null;

create index if not exists mvp_vote_audit_team_changed_idx
  on public.mvp_vote_audit (team_id, changed_at desc);

-- ---------------------------------------------------------------------------
-- Notification compatibility and live badge support
-- ---------------------------------------------------------------------------

alter table public.notifications
  add column if not exists type text,
  add column if not exists message text,
  add column if not exists game_id uuid references public.fixtures(id) on delete set null,
  add column if not exists team_id uuid references public.teams(id) on delete set null,
  add column if not exists action_url text;

update public.notifications
set message = coalesce(message, body, '')
where message is null;

update public.notifications
set type = coalesce(type, 'GENERAL')
where type is null;

alter table public.notifications
  alter column message set default '',
  alter column message set not null,
  alter column type set default 'GENERAL',
  alter column type set not null;

create index if not exists notifications_user_read_created_idx
  on public.notifications (user_id, read, created_at desc);

create index if not exists notifications_team_created_idx
  on public.notifications (team_id, created_at desc)
  where team_id is not null;

do $migration$
begin
  if not exists (
    select 1
    from pg_catalog.pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
exception
  when undefined_object then
    raise notice 'supabase_realtime publication is not available; notification realtime was not added';
end
$migration$;

-- ---------------------------------------------------------------------------
-- Reminder cycles (keep old three-day rows as immutable history)
-- ---------------------------------------------------------------------------

alter table public.mvp_voting_email_events
  add column if not exists voting_cycle integer not null default 1;

do $migration$
declare
  v_constraint record;
begin
  for v_constraint in
    select c.conname
    from pg_catalog.pg_constraint c
    where c.conrelid = 'public.mvp_voting_email_events'::regclass
      and c.contype = 'c'
      and pg_catalog.pg_get_constraintdef(c.oid) ilike '%event_type%'
  loop
    execute format(
      'alter table public.mvp_voting_email_events drop constraint %I',
      v_constraint.conname
    );
  end loop;
end
$migration$;

alter table public.mvp_voting_email_events
  add constraint mvp_voting_email_events_event_type_check
  check (event_type in (
    'opened',
    'three_day_reminder',
    'two_day_reminder',
    'one_day_reminder',
    'manual_resend'
  ));

drop index if exists public.mvp_voting_email_events_once_per_scheduled_event_idx;
create unique index mvp_voting_email_events_once_per_scheduled_event_idx
  on public.mvp_voting_email_events (
    session_id,
    profile_id,
    event_type,
    voting_cycle
  )
  -- Existing reminder history may contain repeated skipped rows because the old
  -- scheduler did not reserve those outcomes. Keep every audit row while using
  -- sending/sent as the concurrency claim for the updated function.
  where status in ('sending', 'sent')
    and event_type <> 'manual_resend';

create index if not exists mvp_voting_email_events_cycle_idx
  on public.mvp_voting_email_events (session_id, voting_cycle, event_type, created_at desc);

-- Keep the existing 15-minute scheduler, but allow enough time for the updated
-- throttled sender to finish its bounded batch. This replaces the same named
-- job; it does not create a second reminder schedule.
do $migration$
begin
  perform cron.unschedule('mvp-voting-email-reminders');
exception
  when others then
    null;
end
$migration$;

select cron.schedule(
  'mvp-voting-email-reminders',
  '*/15 * * * *',
  $cron$
  select net.http_post(
    url := 'https://svierarfcolhcfjpmwck.functions.supabase.co/mvp-voting-email-reminders',
    headers := pg_catalog.jsonb_build_object(
      'Content-Type', 'application/json',
      'x-sportstack-cron-secret', coalesce((
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'mvp_reminder_cron_secret'
        limit 1
      ), '')
    ),
    body := pg_catalog.jsonb_build_object('action', 'scheduled'),
    timeout_milliseconds := 120000
  );
  $cron$
);

-- ---------------------------------------------------------------------------
-- Scope and eligibility helpers
-- ---------------------------------------------------------------------------

create or replace function private.mvp_can_manage_team(
  p_user_id uuid,
  p_team_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $function$
  select p_user_id is not null
    and p_user_id = auth.uid()
    and p_team_id is not null
    and exists (
      select 1
      from public.teams t
      join public.clubs c on c.id = t.club_id
      join public.user_roles ur on ur.user_id = p_user_id
      where t.id = p_team_id
        and (
          ur.role::text = 'SUPER_ADMIN'
          or (
            ur.role::text = 'ASSOCIATION_ADMIN'
            and ur.association_id = c.association_id
          )
          or (
            ur.role::text = 'CLUB_ADMIN'
            and ur.club_id = t.club_id
          )
          or (
            ur.role::text in ('COACH', 'TEAM_MANAGER')
            and ur.team_id = t.id
          )
        )
    );
$function$;

create or replace function private.mvp_can_audit_session(
  p_user_id uuid,
  p_session_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $function$
  select p_user_id = auth.uid()
    and exists (
    select 1
    from public.mvp_voting_sessions s
    join public.fixtures f on f.id = s.fixture_id
    where s.id = p_session_id
      and (
        (s.team_id is not null and private.mvp_can_manage_team(p_user_id, s.team_id))
        or (
          s.team_id is null
          and (
            private.mvp_can_manage_team(p_user_id, f.home_team_id)
            or private.mvp_can_manage_team(p_user_id, f.away_team_id)
          )
        )
      )
  );
$function$;

create or replace function private.mvp_can_raw_audit_session(
  p_user_id uuid,
  p_session_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $function$
  select p_user_id = auth.uid()
    and exists (
    select 1
    from public.mvp_voting_sessions s
    join public.fixtures f on f.id = s.fixture_id
    join public.teams home_team on home_team.id = f.home_team_id
    join public.clubs home_club on home_club.id = home_team.club_id
    join public.teams away_team on away_team.id = f.away_team_id
    join public.clubs away_club on away_club.id = away_team.club_id
    join public.user_roles ur on ur.user_id = p_user_id
    where s.id = p_session_id
      and (
        ur.role::text = 'SUPER_ADMIN'
        or (
          ur.role::text = 'ASSOCIATION_ADMIN'
          and (
            (s.team_id = home_team.id and ur.association_id = home_club.association_id)
            or (s.team_id = away_team.id and ur.association_id = away_club.association_id)
            or (
              s.team_id is null
              and ur.association_id in (home_club.association_id, away_club.association_id)
            )
          )
        )
      )
  );
$function$;

create or replace function private.mvp_player_is_eligible(
  p_user_id uuid,
  p_session_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $function$
  select p_user_id is not null
    and p_user_id = auth.uid()
    and exists (
      select 1
      from public.mvp_voting_sessions s
      join public.fixtures f on f.id = s.fixture_id
      join public.revsports_players rp
        on rp.fixture_id = s.fixture_id
       and rp.profile_id = p_user_id
       and rp.attended is true
      where s.id = p_session_id
        and s.team_id is not null
        and (
          (lower(rp.team_side) = 'home' and s.team_id = f.home_team_id)
          or (lower(rp.team_side) = 'away' and s.team_id = f.away_team_id)
        )
    );
$function$;

-- Withdrawals may store the removed 3/2/1 choices in the immutable audit row.
-- Tighten audit access during the additive pilot migration so those details are
-- never exposed through the older broad Club Admin policy while the final MVP
-- access-lockdown migration is still waiting for approval.
alter table public.mvp_vote_audit enable row level security;

do $migration$
declare
  v_policy record;
begin
  for v_policy in
    select p.policyname
    from pg_catalog.pg_policies p
    where p.schemaname = 'public'
      and p.tablename = 'mvp_vote_audit'
  loop
    execute format(
      'drop policy if exists %I on public.mvp_vote_audit',
      v_policy.policyname
    );
  end loop;
end
$migration$;

create policy "Association scoped MVP audit read"
on public.mvp_vote_audit
for select
to authenticated
using (
  exists (
    select 1
    from public.user_roles ur
    where ur.user_id = (select auth.uid())
      and ur.role::text = 'SUPER_ADMIN'
  )
  or (
    session_id is not null
    and private.mvp_can_raw_audit_session((select auth.uid()), session_id)
  )
  or (
    team_id is not null
    and exists (
      select 1
      from public.teams t
      join public.clubs c on c.id = t.club_id
      join public.user_roles ur
        on ur.user_id = (select auth.uid())
       and ur.role::text = 'ASSOCIATION_ADMIN'
       and ur.association_id = c.association_id
      where t.id = mvp_vote_audit.team_id
    )
  )
);

create policy "Association scoped MVP audit insert"
on public.mvp_vote_audit
for insert
to authenticated
with check (
  exists (
    select 1
    from public.user_roles ur
    where ur.user_id = (select auth.uid())
      and ur.role::text = 'SUPER_ADMIN'
  )
  or (
    session_id is not null
    and private.mvp_can_raw_audit_session((select auth.uid()), session_id)
  )
);

create or replace function private.mvp_write_audit(
  p_session_id uuid,
  p_team_id uuid,
  p_action text,
  p_reason text,
  p_changed_by uuid,
  p_voter_profile_id uuid default null,
  p_details jsonb default '{}'::jsonb
)
returns void
language sql
volatile
security definer
set search_path = pg_catalog
as $function$
  insert into public.mvp_vote_audit (
    session_id,
    team_id,
    action,
    changed_by,
    voter_profile_id,
    reason,
    details
  ) values (
    p_session_id,
    p_team_id,
    p_action,
    p_changed_by,
    p_voter_profile_id,
    p_reason,
    coalesce(p_details, '{}'::jsonb)
  );
$function$;

-- Create a team-owned PENDING row by copying descriptive compatibility fields
-- from the fixture's legacy row when one exists. No legacy row is modified.
create or replace function private.mvp_create_pending_session(
  p_fixture_id uuid,
  p_team_id uuid,
  p_created_by uuid default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = pg_catalog
as $function$
declare
  v_session_id uuid;
  v_legacy public.mvp_voting_sessions%rowtype;
begin
  if p_fixture_id is null or p_team_id is null then
    return null;
  end if;

  select s.*
  into v_legacy
  from public.mvp_voting_sessions s
  where s.fixture_id = p_fixture_id
    and s.team_id is null
  order by s.created_at
  limit 1;

  insert into public.mvp_voting_sessions (
    fixture_id,
    match_url,
    grade,
    round,
    game_date,
    home_team,
    away_team,
    status,
    team_id,
    created_by
  )
  select
    f.id,
    coalesce(v_legacy.match_url, ''),
    coalesce(v_legacy.grade, d.name, home_team.division, away_team.division, ''),
    coalesce(
      v_legacy.round,
      case
        when nullif(pg_catalog.to_jsonb(f)->>'round_number', '') is not null
          then 'Round ' || (pg_catalog.to_jsonb(f)->>'round_number')
        else ''
      end
    ),
    coalesce(v_legacy.game_date, f.fixture_date::date),
    coalesce(v_legacy.home_team, home_team.name),
    coalesce(v_legacy.away_team, away_team.name),
    'PENDING'::public.mvp_session_status,
    p_team_id,
    p_created_by
  from public.fixtures f
  join public.teams home_team on home_team.id = f.home_team_id
  join public.teams away_team on away_team.id = f.away_team_id
  join public.teams requested_team
    on requested_team.id = p_team_id
   and requested_team.mvp_enabled is true
  left join public.divisions d on d.id = f.division_id
  where f.id = p_fixture_id
    and p_team_id in (f.home_team_id, f.away_team_id)
  on conflict (fixture_id, team_id) where team_id is not null
  do nothing
  returning id into v_session_id;

  if v_session_id is null then
    select s.id
    into v_session_id
    from public.mvp_voting_sessions s
    where s.fixture_id = p_fixture_id
      and s.team_id = p_team_id;
  end if;

  return v_session_id;
end
$function$;

-- Prevent existing broad team-table policies from being used to bypass the
-- scoped team-setting command.
create or replace function private.guard_team_mvp_enabled_write()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $function$
begin
  if tg_op = 'INSERT' then
    if new.mvp_enabled is true
       and coalesce(current_setting('app.mvp_team_setting_write', true), '') <> 'allowed' then
      raise exception using
        errcode = 'P0001',
        message = 'MVP_TEAM_SETTING_RPC_REQUIRED';
    end if;
  elsif old.mvp_enabled is distinct from new.mvp_enabled
        and coalesce(current_setting('app.mvp_team_setting_write', true), '') <> 'allowed' then
    raise exception using
      errcode = 'P0001',
      message = 'MVP_TEAM_SETTING_RPC_REQUIRED';
  end if;
  return new;
end
$function$;

drop trigger if exists guard_team_mvp_enabled_write on public.teams;
create trigger guard_team_mvp_enabled_write
before update of mvp_enabled on public.teams
for each row execute function private.guard_team_mvp_enabled_write();

drop trigger if exists guard_team_mvp_enabled_insert on public.teams;
create trigger guard_team_mvp_enabled_insert
before insert on public.teams
for each row execute function private.guard_team_mvp_enabled_write();

-- Retire both old fixture-wide triggers and the automatic-open function.
drop trigger if exists trg_create_mvp_session_on_fixture on public.fixtures;
drop trigger if exists trg_open_mvp_session_on_completion on public.fixtures;
drop function if exists public.open_mvp_session_on_completion();

create or replace function public.create_mvp_session_for_fixture()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $function$
begin
  perform private.mvp_create_pending_session(new.id, new.home_team_id, auth.uid());
  perform private.mvp_create_pending_session(new.id, new.away_team_id, auth.uid());
  return new;
end
$function$;

create trigger trg_create_mvp_session_on_fixture
after insert or update of home_team_id, away_team_id, status
on public.fixtures
for each row execute function public.create_mvp_session_for_fixture();

revoke all on function public.create_mvp_session_for_fixture() from public, anon, authenticated;
revoke all on function private.mvp_write_audit(uuid, uuid, text, text, uuid, uuid, jsonb) from public, anon, authenticated;
revoke all on function private.mvp_create_pending_session(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function private.guard_team_mvp_enabled_write() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Scoped lifecycle commands
-- ---------------------------------------------------------------------------

create or replace function public.set_team_mvp_enabled(
  p_team_id uuid,
  p_enabled boolean
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog
as $function$
declare
  v_user_id uuid := auth.uid();
  v_previous boolean;
  v_closed_count integer := 0;
  v_session public.mvp_voting_sessions%rowtype;
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'MVP_NOT_AUTHENTICATED';
  end if;

  select t.mvp_enabled
  into v_previous
  from public.teams t
  where t.id = p_team_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'MVP_TEAM_NOT_FOUND';
  end if;

  if not private.mvp_can_manage_team(v_user_id, p_team_id) then
    raise exception using errcode = '42501', message = 'MVP_NOT_AUTHORISED';
  end if;

  perform pg_catalog.set_config('app.mvp_team_setting_write', 'allowed', true);
  update public.teams
  set mvp_enabled = p_enabled
  where id = p_team_id;

  perform private.mvp_write_audit(
    null,
    p_team_id,
    case when p_enabled then 'TEAM_MVP_ENABLED' else 'TEAM_MVP_DISABLED' end,
    case when p_enabled then 'Team MVP voting enabled' else 'Team MVP voting disabled' end,
    v_user_id,
    null,
    pg_catalog.jsonb_build_object('previous_enabled', v_previous, 'enabled', p_enabled)
  );

  if not p_enabled then
    for v_session in
      select s.*
      from public.mvp_voting_sessions s
      where s.team_id = p_team_id
        and s.status::text in ('PENDING', 'OPEN')
      order by s.created_at, s.id
      for update
    loop
      update public.mvp_voting_sessions
      set status = 'CLOSED'::public.mvp_session_status,
          closed_at = pg_catalog.now(),
          closed_by = v_user_id,
          locked_at = pg_catalog.now(),
          locked_by = v_user_id,
          locked_reason = 'TEAM_DISABLED'
      where id = v_session.id;

      perform private.mvp_write_audit(
        v_session.id,
        p_team_id,
        'TEAM_DISABLED_CLOSE',
        'Session closed because team MVP voting was disabled',
        v_user_id,
        null,
        pg_catalog.jsonb_build_object('previous_status', v_session.status::text)
      );
      v_closed_count := v_closed_count + 1;
    end loop;
  end if;

  return pg_catalog.jsonb_build_object(
    'success', true,
    'team_id', p_team_id,
    'enabled', p_enabled,
    'closed_sessions', v_closed_count
  );
end
$function$;

create or replace function public.open_mvp_voting_session(
  p_fixture_id uuid,
  p_team_id uuid,
  p_closes_at timestamptz default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog
as $function$
declare
  v_user_id uuid := auth.uid();
  v_fixture public.fixtures%rowtype;
  v_session public.mvp_voting_sessions%rowtype;
  v_session_id uuid;
  v_closes_at timestamptz := coalesce(p_closes_at, pg_catalog.now() + interval '72 hours');
  v_team_enabled boolean;
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'MVP_NOT_AUTHENTICATED';
  end if;

  if v_closes_at <= pg_catalog.now() then
    raise exception using errcode = 'P0001', message = 'MVP_CLOSE_TIME_MUST_BE_FUTURE';
  end if;

  if v_closes_at > pg_catalog.now() + interval '72 hours' then
    raise exception using errcode = 'P0001', message = 'MVP_CLOSE_TIME_TOO_LATE';
  end if;

  select f.*
  into v_fixture
  from public.fixtures f
  where f.id = p_fixture_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'MVP_FIXTURE_NOT_FOUND';
  end if;

  if p_team_id not in (v_fixture.home_team_id, v_fixture.away_team_id) then
    raise exception using errcode = 'P0001', message = 'MVP_TEAM_NOT_IN_FIXTURE';
  end if;

  if v_fixture.status::text <> 'COMPLETED'
     or v_fixture.home_score is null
     or v_fixture.away_score is null then
    raise exception using errcode = 'P0001', message = 'MVP_FIXTURE_NOT_COMPLETED';
  end if;

  if not private.mvp_can_manage_team(v_user_id, p_team_id) then
    raise exception using errcode = '42501', message = 'MVP_NOT_AUTHORISED';
  end if;

  select t.mvp_enabled
  into v_team_enabled
  from public.teams t
  where t.id = p_team_id;

  if coalesce(v_team_enabled, false) is not true then
    raise exception using errcode = 'P0001', message = 'MVP_TEAM_DISABLED';
  end if;

  v_session_id := private.mvp_create_pending_session(p_fixture_id, p_team_id, v_user_id);
  if v_session_id is null then
    raise exception using errcode = 'P0001', message = 'MVP_SESSION_CREATE_FAILED';
  end if;

  select s.*
  into v_session
  from public.mvp_voting_sessions s
  where s.id = v_session_id
  for update;

  if v_session.team_id is null then
    raise exception using errcode = 'P0001', message = 'MVP_LEGACY_SESSION_READ_ONLY';
  end if;

  if v_session.status::text = 'OPEN' then
    raise exception using errcode = 'P0001', message = 'MVP_SESSION_ALREADY_OPEN';
  elsif v_session.status::text = 'CLOSED' then
    raise exception using errcode = 'P0001', message = 'MVP_USE_REOPEN';
  elsif v_session.status::text = 'RESULT_DISPUTED' then
    raise exception using errcode = 'P0001', message = 'MVP_RESOLVE_RESULT_FIRST';
  end if;

  update public.mvp_voting_sessions
  set status = 'OPEN'::public.mvp_session_status,
      opened_at = pg_catalog.now(),
      opened_by = v_user_id,
      closes_at = v_closes_at,
      closed_at = null,
      closed_by = null,
      locked_at = null,
      locked_by = null,
      locked_reason = null
  where id = v_session.id;

  perform private.mvp_write_audit(
    v_session.id,
    p_team_id,
    'OPEN',
    'Team MVP voting opened',
    v_user_id,
    null,
    pg_catalog.jsonb_build_object(
      'previous_status', v_session.status::text,
      'closes_at', v_closes_at,
      'voting_cycle', v_session.voting_cycle
    )
  );

  return pg_catalog.jsonb_build_object(
    'success', true,
    'session_id', v_session.id,
    'team_id', p_team_id,
    'status', 'OPEN',
    'closes_at', v_closes_at,
    'voting_cycle', v_session.voting_cycle
  );
end
$function$;

create or replace function public.close_mvp_voting_session(
  p_session_id uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog
as $function$
declare
  v_user_id uuid := auth.uid();
  v_session public.mvp_voting_sessions%rowtype;
  v_incorrect_count integer;
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'MVP_NOT_AUTHENTICATED';
  end if;

  select s.*
  into v_session
  from public.mvp_voting_sessions s
  where s.id = p_session_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'MVP_SESSION_NOT_FOUND';
  end if;

  if v_session.team_id is null then
    raise exception using errcode = 'P0001', message = 'MVP_LEGACY_SESSION_READ_ONLY';
  end if;

  if not private.mvp_can_manage_team(v_user_id, v_session.team_id) then
    raise exception using errcode = '42501', message = 'MVP_NOT_AUTHORISED';
  end if;

  if v_session.status::text = 'RESULT_DISPUTED' then
    raise exception using errcode = 'P0001', message = 'MVP_RESOLVE_RESULT_FIRST';
  elsif v_session.status::text <> 'OPEN' then
    raise exception using errcode = 'P0001', message = 'MVP_SESSION_NOT_OPEN';
  end if;

  select count(*)::integer
  into v_incorrect_count
  from public.mvp_result_checks rc
  where rc.session_id = v_session.id
    and rc.result_check_round = v_session.result_check_round
    and rc.response = 'INCORRECT';

  if v_incorrect_count > 0 then
    raise exception using errcode = 'P0001', message = 'MVP_UNRESOLVED_RESULT_CONCERN';
  end if;

  update public.mvp_voting_sessions
  set status = 'CLOSED'::public.mvp_session_status,
      closed_at = pg_catalog.now(),
      closed_by = v_user_id,
      locked_at = pg_catalog.now(),
      locked_by = v_user_id,
      locked_reason = 'CLOSED_BY_MANAGER'
  where id = v_session.id;

  perform private.mvp_write_audit(
    v_session.id,
    v_session.team_id,
    'CLOSE',
    'Team MVP voting closed',
    v_user_id,
    null,
    pg_catalog.jsonb_build_object('previous_status', v_session.status::text)
  );

  return pg_catalog.jsonb_build_object(
    'success', true,
    'session_id', v_session.id,
    'status', 'CLOSED',
    'closed_at', pg_catalog.now()
  );
end
$function$;

create or replace function public.reopen_mvp_voting_session(
  p_session_id uuid,
  p_closes_at timestamptz default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog
as $function$
declare
  v_user_id uuid := auth.uid();
  v_session public.mvp_voting_sessions%rowtype;
  v_closes_at timestamptz := coalesce(p_closes_at, pg_catalog.now() + interval '72 hours');
  v_incorrect_count integer;
  v_team_enabled boolean;
  v_new_cycle integer;
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'MVP_NOT_AUTHENTICATED';
  end if;

  if v_closes_at <= pg_catalog.now() then
    raise exception using errcode = 'P0001', message = 'MVP_CLOSE_TIME_MUST_BE_FUTURE';
  end if;

  if v_closes_at > pg_catalog.now() + interval '72 hours' then
    raise exception using errcode = 'P0001', message = 'MVP_CLOSE_TIME_TOO_LATE';
  end if;

  select s.*
  into v_session
  from public.mvp_voting_sessions s
  where s.id = p_session_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'MVP_SESSION_NOT_FOUND';
  end if;

  if v_session.team_id is null then
    raise exception using errcode = 'P0001', message = 'MVP_LEGACY_SESSION_READ_ONLY';
  end if;

  if not private.mvp_can_manage_team(v_user_id, v_session.team_id) then
    raise exception using errcode = '42501', message = 'MVP_NOT_AUTHORISED';
  end if;

  if v_session.status::text = 'RESULT_DISPUTED' then
    raise exception using errcode = 'P0001', message = 'MVP_RESOLVE_RESULT_FIRST';
  elsif v_session.status::text = 'OPEN'
        and (v_session.closes_at is null or v_session.closes_at > pg_catalog.now()) then
    raise exception using errcode = 'P0001', message = 'MVP_SESSION_ALREADY_OPEN';
  elsif v_session.status::text not in ('OPEN', 'CLOSED') then
    raise exception using errcode = 'P0001', message = 'MVP_SESSION_CANNOT_REOPEN';
  end if;

  select t.mvp_enabled
  into v_team_enabled
  from public.teams t
  where t.id = v_session.team_id;

  if coalesce(v_team_enabled, false) is not true then
    raise exception using errcode = 'P0001', message = 'MVP_TEAM_DISABLED';
  end if;

  select count(*)::integer
  into v_incorrect_count
  from public.mvp_result_checks rc
  where rc.session_id = v_session.id
    and rc.result_check_round = v_session.result_check_round
    and rc.response = 'INCORRECT';

  if v_incorrect_count > 0 then
    raise exception using errcode = 'P0001', message = 'MVP_UNRESOLVED_RESULT_CONCERN';
  end if;

  v_new_cycle := v_session.voting_cycle + 1;

  update public.mvp_voting_sessions
  set status = 'OPEN'::public.mvp_session_status,
      opened_at = pg_catalog.now(),
      opened_by = v_user_id,
      closes_at = v_closes_at,
      closed_at = null,
      closed_by = null,
      locked_at = null,
      locked_by = null,
      locked_reason = null,
      voting_cycle = v_new_cycle
  where id = v_session.id;

  perform private.mvp_write_audit(
    v_session.id,
    v_session.team_id,
    'REOPEN',
    'Team MVP voting reopened',
    v_user_id,
    null,
    pg_catalog.jsonb_build_object(
      'previous_status', v_session.status::text,
      'previous_cycle', v_session.voting_cycle,
      'voting_cycle', v_new_cycle,
      'closes_at', v_closes_at
    )
  );

  return pg_catalog.jsonb_build_object(
    'success', true,
    'session_id', v_session.id,
    'status', 'OPEN',
    'closes_at', v_closes_at,
    'voting_cycle', v_new_cycle
  );
end
$function$;

-- ---------------------------------------------------------------------------
-- Result checking and atomic ballot submission
-- ---------------------------------------------------------------------------

create or replace function public.record_mvp_result_check(
  p_session_id uuid,
  p_response text,
  p_comment text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog
as $function$
declare
  v_user_id uuid := auth.uid();
  v_session public.mvp_voting_sessions%rowtype;
  v_response text := upper(trim(coalesce(p_response, '')));
  v_comment text := nullif(trim(coalesce(p_comment, '')), '');
  v_incorrect_count integer := 0;
  v_status text;
  v_team_enabled boolean;
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'MVP_NOT_AUTHENTICATED';
  end if;

  if v_response not in ('CORRECT', 'INCORRECT') then
    raise exception using errcode = 'P0001', message = 'MVP_INVALID_RESULT_RESPONSE';
  end if;

  if v_comment is not null and char_length(v_comment) > 2000 then
    raise exception using errcode = 'P0001', message = 'MVP_RESULT_COMMENT_TOO_LONG';
  end if;

  select s.*
  into v_session
  from public.mvp_voting_sessions s
  where s.id = p_session_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'MVP_SESSION_NOT_FOUND';
  end if;

  if v_session.team_id is null then
    raise exception using errcode = 'P0001', message = 'MVP_LEGACY_SESSION_READ_ONLY';
  end if;

  if not private.mvp_player_is_eligible(v_user_id, v_session.id) then
    raise exception using errcode = '42501', message = 'MVP_PLAYER_NOT_ELIGIBLE';
  end if;

  select t.mvp_enabled
  into v_team_enabled
  from public.teams t
  where t.id = v_session.team_id;

  if coalesce(v_team_enabled, false) is not true then
    raise exception using errcode = 'P0001', message = 'MVP_TEAM_DISABLED';
  end if;

  if v_session.status::text <> 'OPEN' then
    raise exception using errcode = 'P0001', message = 'MVP_SESSION_NOT_OPEN';
  end if;

  if v_session.closes_at is null or v_session.closes_at <= pg_catalog.now() then
    raise exception using errcode = 'P0001', message = 'MVP_SESSION_EXPIRED';
  end if;

  begin
    insert into public.mvp_result_checks (
      session_id,
      result_check_round,
      voter_profile_id,
      response,
      comment
    ) values (
      v_session.id,
      v_session.result_check_round,
      v_user_id,
      v_response,
      v_comment
    );
  exception
    when unique_violation then
      raise exception using errcode = 'P0001', message = 'MVP_RESULT_ALREADY_CHECKED';
  end;

  select count(*)::integer
  into v_incorrect_count
  from public.mvp_result_checks rc
  where rc.session_id = v_session.id
    and rc.result_check_round = v_session.result_check_round
    and rc.response = 'INCORRECT';

  -- The first concern asks teammates to check the result and alerts the team's
  -- coach/manager. It does not reveal any ballot choices.
  if v_response = 'INCORRECT' and v_incorrect_count = 1 then
    insert into public.notifications (
      user_id,
      type,
      title,
      body,
      message,
      game_id,
      team_id,
      action_url
    )
    select distinct
      ur.user_id,
      'MVP_RESULT_CONCERN',
      'MVP result concern reported',
      'A player reported that the match result may be incorrect. Review the exact MVP session.',
      'A player reported that the match result may be incorrect. Review the exact MVP session.',
      v_session.fixture_id,
      v_session.team_id,
      '/admin/mvp-voting?session=' || v_session.id::text
    from public.user_roles ur
    where ur.team_id = v_session.team_id
      and ur.role::text in ('COACH', 'TEAM_MANAGER');

    insert into public.notifications (
      user_id,
      type,
      title,
      body,
      message,
      game_id,
      team_id,
      action_url
    )
    select distinct
      rp.profile_id,
      'MVP_RESULT_CONCERN',
      'Please check the match result',
      'A teammate reported that the match result may be incorrect. Check the result before voting.',
      'A teammate reported that the match result may be incorrect. Check the result before voting.',
      v_session.fixture_id,
      v_session.team_id,
      '/mvp-votes/' || v_session.id::text
    from public.revsports_players rp
    join public.fixtures f on f.id = v_session.fixture_id
    where rp.fixture_id = v_session.fixture_id
      and rp.profile_id is not null
      and rp.profile_id <> v_user_id
      and rp.attended is true
      and (
        (lower(rp.team_side) = 'home' and v_session.team_id = f.home_team_id)
        or (lower(rp.team_side) = 'away' and v_session.team_id = f.away_team_id)
      );
  end if;

  if v_response = 'INCORRECT' and v_incorrect_count >= 3 then
    update public.mvp_voting_sessions
    set status = 'RESULT_DISPUTED'::public.mvp_session_status,
        locked_at = pg_catalog.now(),
        locked_by = v_user_id,
        locked_reason = 'THREE_RESULT_CONCERNS'
    where id = v_session.id;

    perform private.mvp_write_audit(
      v_session.id,
      v_session.team_id,
      'RESULT_DISPUTED',
      'Three eligible players reported an incorrect match result',
      v_user_id,
      null,
      pg_catalog.jsonb_build_object(
        'result_check_round', v_session.result_check_round,
        'incorrect_count', v_incorrect_count
      )
    );

    -- Escalate the third concern to club, association and super admins in scope.
    insert into public.notifications (
      user_id,
      type,
      title,
      body,
      message,
      game_id,
      team_id,
      action_url
    )
    select distinct
      ur.user_id,
      'MVP_RESULT_DISPUTED',
      'MVP result concern needs review',
      'Three players reported an incorrect match result. Review the fixture score before reopening voting.',
      'Three players reported an incorrect match result. Review the fixture score before reopening voting.',
      v_session.fixture_id,
      v_session.team_id,
      '/admin/mvp-voting?session=' || v_session.id::text
    from public.teams t
    join public.clubs c on c.id = t.club_id
    join public.user_roles ur on (
      ur.role::text = 'SUPER_ADMIN'
      or (ur.role::text = 'CLUB_ADMIN' and ur.club_id = t.club_id)
      or (ur.role::text = 'ASSOCIATION_ADMIN' and ur.association_id = c.association_id)
    )
    where t.id = v_session.team_id;

    v_status := 'RESULT_DISPUTED';
  else
    v_status := v_session.status::text;
  end if;

  return pg_catalog.jsonb_build_object(
    'success', true,
    'session_id', v_session.id,
    'status', v_status,
    'response', v_response,
    'incorrect_count', v_incorrect_count,
    'result_check_round', v_session.result_check_round,
    'requires_check', v_incorrect_count > 0,
    'can_vote', v_response = 'CORRECT' and v_status = 'OPEN'
  );
end
$function$;

create or replace function public.resolve_mvp_result_dispute(
  p_session_id uuid,
  p_closes_at timestamptz default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog
as $function$
declare
  v_user_id uuid := auth.uid();
  v_session public.mvp_voting_sessions%rowtype;
  v_closes_at timestamptz := coalesce(p_closes_at, pg_catalog.now() + interval '72 hours');
  v_incorrect_count integer;
  v_new_round integer;
  v_new_cycle integer;
  v_team_enabled boolean;
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'MVP_NOT_AUTHENTICATED';
  end if;

  if v_closes_at <= pg_catalog.now() then
    raise exception using errcode = 'P0001', message = 'MVP_CLOSE_TIME_MUST_BE_FUTURE';
  end if;

  if v_closes_at > pg_catalog.now() + interval '72 hours' then
    raise exception using errcode = 'P0001', message = 'MVP_CLOSE_TIME_TOO_LATE';
  end if;

  select s.*
  into v_session
  from public.mvp_voting_sessions s
  where s.id = p_session_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'MVP_SESSION_NOT_FOUND';
  end if;

  if v_session.team_id is null then
    raise exception using errcode = 'P0001', message = 'MVP_LEGACY_SESSION_READ_ONLY';
  end if;

  if not private.mvp_can_manage_team(v_user_id, v_session.team_id) then
    raise exception using errcode = '42501', message = 'MVP_NOT_AUTHORISED';
  end if;

  if v_session.status::text not in ('OPEN', 'RESULT_DISPUTED', 'CLOSED') then
    raise exception using errcode = 'P0001', message = 'MVP_NO_ACTIVE_RESULT_CONCERN';
  end if;

  select t.mvp_enabled
  into v_team_enabled
  from public.teams t
  where t.id = v_session.team_id;

  if coalesce(v_team_enabled, false) is not true then
    raise exception using errcode = 'P0001', message = 'MVP_TEAM_DISABLED';
  end if;

  if not exists (
    select 1
    from public.fixtures f
    where f.id = v_session.fixture_id
      and f.status::text = 'COMPLETED'
      and f.home_score is not null
      and f.away_score is not null
  ) then
    raise exception using errcode = 'P0001', message = 'MVP_FIXTURE_NOT_COMPLETED';
  end if;

  select count(*)::integer
  into v_incorrect_count
  from public.mvp_result_checks rc
  where rc.session_id = v_session.id
    and rc.result_check_round = v_session.result_check_round
    and rc.response = 'INCORRECT';

  if v_incorrect_count = 0 then
    raise exception using errcode = 'P0001', message = 'MVP_NO_ACTIVE_RESULT_CONCERN';
  end if;

  v_new_round := v_session.result_check_round + 1;
  v_new_cycle := v_session.voting_cycle + 1;

  update public.mvp_voting_sessions
  set status = 'OPEN'::public.mvp_session_status,
      opened_at = pg_catalog.now(),
      opened_by = v_user_id,
      closes_at = v_closes_at,
      closed_at = null,
      closed_by = null,
      locked_at = null,
      locked_by = null,
      locked_reason = null,
      results_confirmed_at = pg_catalog.now(),
      results_confirmed_by = v_user_id,
      result_check_round = v_new_round,
      voting_cycle = v_new_cycle
  where id = v_session.id;

  perform private.mvp_write_audit(
    v_session.id,
    v_session.team_id,
    'RESOLVE_RESULT_DISPUTE',
    'Corrected fixture result confirmed and voting reopened',
    v_user_id,
    null,
    pg_catalog.jsonb_build_object(
      'previous_status', v_session.status::text,
      'incorrect_count', v_incorrect_count,
      'previous_result_check_round', v_session.result_check_round,
      'result_check_round', v_new_round,
      'previous_voting_cycle', v_session.voting_cycle,
      'voting_cycle', v_new_cycle,
      'closes_at', v_closes_at
    )
  );

  insert into public.notifications (
    user_id,
    type,
    title,
    body,
    message,
    game_id,
    team_id,
    action_url
  )
  select distinct
    rp.profile_id,
    'MVP_RESULT_RESOLVED',
    'Match result confirmed',
    'The match result concern has been reviewed. MVP voting is open again.',
    'The match result concern has been reviewed. MVP voting is open again.',
    v_session.fixture_id,
    v_session.team_id,
    '/mvp-votes/' || v_session.id::text
  from public.revsports_players rp
  join public.fixtures f on f.id = v_session.fixture_id
  where rp.fixture_id = v_session.fixture_id
    and rp.profile_id is not null
    and rp.attended is true
    and (
      (lower(rp.team_side) = 'home' and v_session.team_id = f.home_team_id)
      or (lower(rp.team_side) = 'away' and v_session.team_id = f.away_team_id)
    );

  return pg_catalog.jsonb_build_object(
    'success', true,
    'session_id', v_session.id,
    'status', 'OPEN',
    'closes_at', v_closes_at,
    'result_check_round', v_new_round,
    'voting_cycle', v_new_cycle
  );
end
$function$;

create or replace function public.submit_mvp_ballot(
  p_session_id uuid,
  p_three_point_player_id uuid,
  p_two_point_player_id uuid,
  p_one_point_player_id uuid,
  p_shoutout text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog
as $function$
declare
  v_user_id uuid := auth.uid();
  v_session public.mvp_voting_sessions%rowtype;
  v_team_enabled boolean;
  v_target_count integer;
  v_requires_check boolean;
  v_own_response text;
  v_submitted_at timestamptz := pg_catalog.now();
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'MVP_NOT_AUTHENTICATED';
  end if;

  if p_three_point_player_id is null
     or p_two_point_player_id is null
     or p_one_point_player_id is null then
    raise exception using errcode = 'P0001', message = 'MVP_THREE_VOTES_REQUIRED';
  end if;

  if p_three_point_player_id = p_two_point_player_id
     or p_three_point_player_id = p_one_point_player_id
     or p_two_point_player_id = p_one_point_player_id then
    raise exception using errcode = 'P0001', message = 'MVP_DUPLICATE_PLAYER';
  end if;

  select s.*
  into v_session
  from public.mvp_voting_sessions s
  where s.id = p_session_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'MVP_SESSION_NOT_FOUND';
  end if;

  if v_session.team_id is null then
    raise exception using errcode = 'P0001', message = 'MVP_LEGACY_SESSION_READ_ONLY';
  end if;

  if v_session.status::text = 'RESULT_DISPUTED' then
    raise exception using errcode = 'P0001', message = 'MVP_RESULT_DISPUTED';
  elsif v_session.status::text <> 'OPEN' then
    raise exception using errcode = 'P0001', message = 'MVP_SESSION_NOT_OPEN';
  end if;

  if v_session.closes_at is null or v_session.closes_at <= pg_catalog.now() then
    raise exception using errcode = 'P0001', message = 'MVP_SESSION_EXPIRED';
  end if;

  select t.mvp_enabled
  into v_team_enabled
  from public.teams t
  where t.id = v_session.team_id;

  if coalesce(v_team_enabled, false) is not true then
    raise exception using errcode = 'P0001', message = 'MVP_TEAM_DISABLED';
  end if;

  if not private.mvp_player_is_eligible(v_user_id, v_session.id) then
    raise exception using errcode = '42501', message = 'MVP_PLAYER_NOT_ELIGIBLE';
  end if;

  if exists (
    select 1
    from public.mvp_vote_submissions sub
    where sub.session_id = v_session.id
      and sub.voter_profile_id = v_user_id
  ) then
    raise exception using errcode = 'P0001', message = 'MVP_BALLOT_ALREADY_SUBMITTED';
  end if;

  select count(*)::integer
  into v_target_count
  from public.revsports_players rp
  join public.fixtures f on f.id = v_session.fixture_id
  where rp.id = any(array[
      p_three_point_player_id,
      p_two_point_player_id,
      p_one_point_player_id
    ]::uuid[])
    and rp.fixture_id = v_session.fixture_id
    and rp.attended is true
    and (
      (lower(rp.team_side) = 'home' and v_session.team_id = f.home_team_id)
      or (lower(rp.team_side) = 'away' and v_session.team_id = f.away_team_id)
    );

  if v_target_count <> 3 then
    raise exception using errcode = 'P0001', message = 'MVP_INVALID_VOTE_TARGET';
  end if;

  if exists (
    select 1
    from public.revsports_players rp
    where rp.id = any(array[
        p_three_point_player_id,
        p_two_point_player_id,
        p_one_point_player_id
      ]::uuid[])
      and rp.profile_id = v_user_id
  ) then
    raise exception using errcode = 'P0001', message = 'MVP_SELF_VOTE_NOT_ALLOWED';
  end if;

  select exists (
    select 1
    from public.mvp_result_checks rc
    where rc.session_id = v_session.id
      and rc.result_check_round = v_session.result_check_round
      and rc.response = 'INCORRECT'
  ) into v_requires_check;

  select rc.response
  into v_own_response
  from public.mvp_result_checks rc
  where rc.session_id = v_session.id
    and rc.result_check_round = v_session.result_check_round
    and rc.voter_profile_id = v_user_id;

  if v_own_response = 'INCORRECT' then
    raise exception using errcode = 'P0001', message = 'MVP_RESULT_REPORTED_INCORRECT';
  end if;

  if v_requires_check and v_own_response is distinct from 'CORRECT' then
    raise exception using errcode = 'P0001', message = 'MVP_RESULT_CHECK_REQUIRED';
  end if;

  begin
    insert into public.mvp_votes (
      session_id,
      voter_profile_id,
      player_id,
      points,
      created_at
    ) values
      (v_session.id, v_user_id, p_three_point_player_id, 3, v_submitted_at),
      (v_session.id, v_user_id, p_two_point_player_id, 2, v_submitted_at),
      (v_session.id, v_user_id, p_one_point_player_id, 1, v_submitted_at);

    insert into public.mvp_vote_submissions (
      session_id,
      voter_profile_id,
      shoutout,
      submitted_at
    ) values (
      v_session.id,
      v_user_id,
      nullif(trim(coalesce(p_shoutout, '')), ''),
      v_submitted_at
    );
  exception
    when unique_violation then
      raise exception using errcode = 'P0001', message = 'MVP_BALLOT_ALREADY_SUBMITTED';
  end;

  return pg_catalog.jsonb_build_object(
    'success', true,
    'session_id', v_session.id,
    'submitted_at', v_submitted_at,
    'vote_count', 3
  );
end
$function$;

create or replace function public.request_mvp_session_reopen(
  p_session_id uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog
as $function$
declare
  v_user_id uuid := auth.uid();
  v_session public.mvp_voting_sessions%rowtype;
  v_requested_at timestamptz := pg_catalog.now();
  v_team_enabled boolean;
  v_already_requested boolean;
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'MVP_NOT_AUTHENTICATED';
  end if;

  select s.*
  into v_session
  from public.mvp_voting_sessions s
  where s.id = p_session_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'MVP_SESSION_NOT_FOUND';
  end if;

  if v_session.team_id is null then
    raise exception using errcode = 'P0001', message = 'MVP_LEGACY_SESSION_READ_ONLY';
  end if;

  if not private.mvp_player_is_eligible(v_user_id, v_session.id) then
    raise exception using errcode = '42501', message = 'MVP_PLAYER_NOT_ELIGIBLE';
  end if;

  if v_session.status::text <> 'CLOSED'
     and not (
       v_session.status::text = 'OPEN'
       and v_session.closes_at is not null
       and v_session.closes_at <= pg_catalog.now()
     ) then
    raise exception using errcode = 'P0001', message = 'MVP_SESSION_NOT_CLOSED';
  end if;

  select t.mvp_enabled
  into v_team_enabled
  from public.teams t
  where t.id = v_session.team_id;

  if coalesce(v_team_enabled, false) is not true then
    raise exception using errcode = 'P0001', message = 'MVP_TEAM_DISABLED';
  end if;

  if exists (
    select 1
    from public.mvp_vote_submissions sub
    where sub.session_id = v_session.id
      and sub.voter_profile_id = v_user_id
  ) then
    raise exception using errcode = 'P0001', message = 'MVP_BALLOT_ALREADY_SUBMITTED';
  end if;

  select exists (
    select 1
    from public.mvp_vote_audit a
    where a.session_id = v_session.id
      and a.changed_by = v_user_id
      and a.action = 'REOPEN_REQUEST'
      and a.changed_at > pg_catalog.now() - interval '24 hours'
  ) into v_already_requested;

  if not v_already_requested then
    perform private.mvp_write_audit(
      v_session.id,
      v_session.team_id,
      'REOPEN_REQUEST',
      'Eligible player requested more time to vote',
      v_user_id,
      v_user_id,
      pg_catalog.jsonb_build_object('requested_at', v_requested_at)
    );

    insert into public.notifications (
      user_id,
      type,
      title,
      body,
      message,
      game_id,
      team_id,
      action_url
    )
    select distinct
      ur.user_id,
      'MVP_REOPEN_REQUEST',
      'MVP voting reopen requested',
      'An eligible player has asked for more time to submit their MVP vote.',
      'An eligible player has asked for more time to submit their MVP vote.',
      v_session.fixture_id,
      v_session.team_id,
      '/admin/mvp-voting?session=' || v_session.id::text
    from public.teams t
    join public.clubs c on c.id = t.club_id
    join public.user_roles ur on (
      ur.role::text = 'SUPER_ADMIN'
      or (ur.role::text = 'ASSOCIATION_ADMIN' and ur.association_id = c.association_id)
      or (ur.role::text = 'CLUB_ADMIN' and ur.club_id = t.club_id)
      or (ur.role::text in ('COACH', 'TEAM_MANAGER') and ur.team_id = t.id)
    )
    where t.id = v_session.team_id;
  end if;

  return pg_catalog.jsonb_build_object(
    'success', true,
    'session_id', v_session.id,
    'requested_at', v_requested_at,
    'already_requested', v_already_requested
  );
end
$function$;

create or replace function public.withdraw_mvp_submission(
  p_session_id uuid,
  p_voter_profile_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog
as $function$
declare
  v_user_id uuid := auth.uid();
  v_session public.mvp_voting_sessions%rowtype;
  v_reason text := nullif(trim(coalesce(p_reason, '')), '');
  v_vote_details jsonb := '[]'::jsonb;
  v_shoutout text;
  v_vote_count integer := 0;
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'MVP_NOT_AUTHENTICATED';
  end if;

  if v_reason is null then
    raise exception using errcode = 'P0001', message = 'MVP_WITHDRAW_REASON_REQUIRED';
  end if;

  select s.*
  into v_session
  from public.mvp_voting_sessions s
  where s.id = p_session_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'MVP_SESSION_NOT_FOUND';
  end if;

  if v_session.team_id is null then
    raise exception using errcode = 'P0001', message = 'MVP_LEGACY_SESSION_READ_ONLY';
  end if;

  if not private.mvp_can_raw_audit_session(v_user_id, v_session.id) then
    raise exception using errcode = '42501', message = 'MVP_NOT_AUTHORISED';
  end if;

  if v_session.status::text not in ('OPEN', 'RESULT_DISPUTED') then
    raise exception using errcode = 'P0001', message = 'MVP_PUBLISHED_BALLOT_IMMUTABLE';
  end if;

  select sub.shoutout
  into v_shoutout
  from public.mvp_vote_submissions sub
  where sub.session_id = v_session.id
    and sub.voter_profile_id = p_voter_profile_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'MVP_SUBMISSION_NOT_FOUND';
  end if;

  select coalesce(
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'player_id', v.player_id,
        'points', v.points
      ) order by v.points desc
    ),
    '[]'::jsonb
  )
  into v_vote_details
  from public.mvp_votes v
  where v.session_id = v_session.id
    and v.voter_profile_id = p_voter_profile_id;

  delete from public.mvp_votes v
  where v.session_id = v_session.id
    and v.voter_profile_id = p_voter_profile_id;
  get diagnostics v_vote_count = row_count;

  delete from public.mvp_vote_submissions sub
  where sub.session_id = v_session.id
    and sub.voter_profile_id = p_voter_profile_id;

  perform private.mvp_write_audit(
    v_session.id,
    v_session.team_id,
    'WITHDRAW_VOTE',
    v_reason,
    v_user_id,
    p_voter_profile_id,
    pg_catalog.jsonb_build_object(
      'withdrawn_votes', v_vote_details,
      'withdrawn_shoutout', v_shoutout,
      'vote_count', v_vote_count
    )
  );

  return pg_catalog.jsonb_build_object(
    'success', true,
    'session_id', v_session.id,
    'voter_profile_id', p_voter_profile_id,
    'withdrawn_vote_count', v_vote_count
  );
end
$function$;

create or replace function public.get_mvp_result_check_state(
  p_session_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog
as $function$
declare
  v_user_id uuid := auth.uid();
  v_session public.mvp_voting_sessions%rowtype;
  v_response text;
  v_comment text;
  v_checked_at timestamptz;
  v_incorrect_count integer := 0;
  v_requires_check boolean;
  v_has_submitted boolean;
  v_team_enabled boolean;
  v_can_vote boolean;
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'MVP_NOT_AUTHENTICATED';
  end if;

  select s.*
  into v_session
  from public.mvp_voting_sessions s
  where s.id = p_session_id;

  if not found or v_session.team_id is null or v_session.status::text = 'PENDING' then
    raise exception using errcode = 'P0001', message = 'MVP_SESSION_NOT_FOUND';
  end if;

  if not private.mvp_player_is_eligible(v_user_id, v_session.id) then
    raise exception using errcode = '42501', message = 'MVP_PLAYER_NOT_ELIGIBLE';
  end if;

  select rc.response, rc.comment, rc.created_at
  into v_response, v_comment, v_checked_at
  from public.mvp_result_checks rc
  where rc.session_id = v_session.id
    and rc.result_check_round = v_session.result_check_round
    and rc.voter_profile_id = v_user_id;

  select count(*)::integer
  into v_incorrect_count
  from public.mvp_result_checks rc
  where rc.session_id = v_session.id
    and rc.result_check_round = v_session.result_check_round
    and rc.response = 'INCORRECT';

  select exists (
    select 1
    from public.mvp_vote_submissions sub
    where sub.session_id = v_session.id
      and sub.voter_profile_id = v_user_id
  ) into v_has_submitted;

  select t.mvp_enabled
  into v_team_enabled
  from public.teams t
  where t.id = v_session.team_id;

  v_requires_check := v_incorrect_count > 0;
  v_can_vote := coalesce(v_team_enabled, false)
    and v_session.status::text = 'OPEN'
    and v_session.closes_at is not null
    and v_session.closes_at > pg_catalog.now()
    and not v_has_submitted
    and v_response is distinct from 'INCORRECT'
    and (not v_requires_check or v_response = 'CORRECT');

  return pg_catalog.jsonb_build_object(
    'success', true,
    'session_id', v_session.id,
    'status', v_session.status::text,
    'required', v_requires_check,
    'requires_check', v_requires_check,
    'response', v_response,
    'comment', v_comment,
    'checked_at', v_checked_at,
    'incorrect_count', v_incorrect_count,
    'result_check_round', v_session.result_check_round,
    'has_submitted', v_has_submitted,
    'can_vote', v_can_vote
  );
end
$function$;

create or replace function public.get_mvp_session_results(
  p_session_id uuid
)
returns table (
  player_id uuid,
  player_name text,
  profile_id uuid,
  points bigint,
  vote_count bigint
)
language plpgsql
stable
security definer
set search_path = pg_catalog
as $function$
declare
  v_user_id uuid := auth.uid();
  v_session public.mvp_voting_sessions%rowtype;
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'MVP_NOT_AUTHENTICATED';
  end if;

  select s.*
  into v_session
  from public.mvp_voting_sessions s
  where s.id = p_session_id;

  if not found then
    raise exception using errcode = 'P0001', message = 'MVP_SESSION_NOT_FOUND';
  end if;

  if not private.mvp_can_audit_session(v_user_id, v_session.id) then
    raise exception using errcode = '42501', message = 'MVP_NOT_AUTHORISED';
  end if;

  if v_session.status::text <> 'CLOSED' then
    raise exception using errcode = 'P0001', message = 'MVP_RESULTS_NOT_PUBLISHED';
  end if;

  if exists (
    select 1
    from public.mvp_result_checks rc
    where rc.session_id = v_session.id
      and rc.result_check_round = v_session.result_check_round
      and rc.response = 'INCORRECT'
  ) then
    raise exception using errcode = 'P0001', message = 'MVP_UNRESOLVED_RESULT_CONCERN';
  end if;

  return query
  select
    rp.id as player_id,
    coalesce(
      nullif(trim(pg_catalog.concat_ws(' ', p.first_name, p.last_name)), ''),
      rp.player_name,
      'Unknown player'
    )::text as player_name,
    rp.profile_id,
    sum(v.points)::bigint as points,
    count(*)::bigint as vote_count
  from public.mvp_votes v
  join public.revsports_players rp on rp.id = v.player_id
  left join public.profiles p on p.id = rp.profile_id
  where v.session_id = v_session.id
  group by rp.id, rp.player_name, rp.profile_id, p.first_name, p.last_name
  order by 4 desc, 2;
end
$function$;

-- Prepared for the separately approved rollout step. Creating this command does
-- not run the cutover; only an authenticated super admin can call it later.
create or replace function public.close_legacy_mvp_sessions_for_cutover(
  p_reason text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog
as $function$
declare
  v_user_id uuid := auth.uid();
  v_reason text := nullif(trim(coalesce(p_reason, '')), '');
  v_session public.mvp_voting_sessions%rowtype;
  v_open_count integer := 0;
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'MVP_NOT_AUTHENTICATED';
  end if;

  if not exists (
    select 1
    from public.user_roles ur
    where ur.user_id = v_user_id
      and ur.role::text = 'SUPER_ADMIN'
  ) then
    raise exception using errcode = '42501', message = 'MVP_SUPER_ADMIN_REQUIRED';
  end if;

  if v_reason is null then
    raise exception using errcode = 'P0001', message = 'MVP_CUTOVER_REASON_REQUIRED';
  end if;

  for v_session in
    select s.*
    from public.mvp_voting_sessions s
    where s.team_id is null
      and s.status::text = 'OPEN'
    order by s.created_at, s.id
    for update
  loop
    v_open_count := v_open_count + 1;

    update public.mvp_voting_sessions
    set status = 'CLOSED'::public.mvp_session_status,
        closed_at = pg_catalog.now(),
        closed_by = v_user_id,
        locked_at = pg_catalog.now(),
        locked_by = v_user_id,
        locked_reason = 'LEGACY_CUTOVER'
    where id = v_session.id;

    perform private.mvp_write_audit(
      v_session.id,
      null,
      'LEGACY_CUTOVER_CLOSE',
      v_reason,
      v_user_id,
      null,
      pg_catalog.jsonb_build_object('previous_status', v_session.status::text)
    );
  end loop;

  return pg_catalog.jsonb_build_object(
    'success', true,
    'closed_open', v_open_count,
    'closed_total', v_open_count
  );
end
$function$;

-- ---------------------------------------------------------------------------
-- Explicit function and Data API privileges
-- ---------------------------------------------------------------------------

revoke all on function private.mvp_can_manage_team(uuid, uuid) from public, anon;
revoke all on function private.mvp_can_audit_session(uuid, uuid) from public, anon;
revoke all on function private.mvp_can_raw_audit_session(uuid, uuid) from public, anon;
revoke all on function private.mvp_player_is_eligible(uuid, uuid) from public, anon;

grant usage on schema private to authenticated;
grant execute on function private.mvp_can_manage_team(uuid, uuid) to authenticated;
grant execute on function private.mvp_can_audit_session(uuid, uuid) to authenticated;
grant execute on function private.mvp_can_raw_audit_session(uuid, uuid) to authenticated;
grant execute on function private.mvp_player_is_eligible(uuid, uuid) to authenticated;

revoke all on function public.set_team_mvp_enabled(uuid, boolean) from public, anon;
revoke all on function public.open_mvp_voting_session(uuid, uuid, timestamptz) from public, anon;
revoke all on function public.close_mvp_voting_session(uuid) from public, anon;
revoke all on function public.reopen_mvp_voting_session(uuid, timestamptz) from public, anon;
revoke all on function public.record_mvp_result_check(uuid, text, text) from public, anon;
revoke all on function public.resolve_mvp_result_dispute(uuid, timestamptz) from public, anon;
revoke all on function public.submit_mvp_ballot(uuid, uuid, uuid, uuid, text) from public, anon;
revoke all on function public.request_mvp_session_reopen(uuid) from public, anon;
revoke all on function public.withdraw_mvp_submission(uuid, uuid, text) from public, anon;
revoke all on function public.get_mvp_result_check_state(uuid) from public, anon;
revoke all on function public.get_mvp_session_results(uuid) from public, anon;
revoke all on function public.close_legacy_mvp_sessions_for_cutover(text) from public, anon;

grant execute on function public.set_team_mvp_enabled(uuid, boolean) to authenticated;
grant execute on function public.open_mvp_voting_session(uuid, uuid, timestamptz) to authenticated;
grant execute on function public.close_mvp_voting_session(uuid) to authenticated;
grant execute on function public.reopen_mvp_voting_session(uuid, timestamptz) to authenticated;
grant execute on function public.record_mvp_result_check(uuid, text, text) to authenticated;
grant execute on function public.resolve_mvp_result_dispute(uuid, timestamptz) to authenticated;
grant execute on function public.submit_mvp_ballot(uuid, uuid, uuid, uuid, text) to authenticated;
grant execute on function public.request_mvp_session_reopen(uuid) to authenticated;
grant execute on function public.withdraw_mvp_submission(uuid, uuid, text) to authenticated;
grant execute on function public.get_mvp_result_check_state(uuid) to authenticated;
grant execute on function public.get_mvp_session_results(uuid) to authenticated;
grant execute on function public.close_legacy_mvp_sessions_for_cutover(text) to authenticated;

revoke all on public.mvp_result_checks from public, anon, authenticated;
grant select on public.mvp_result_checks to authenticated;
grant all on public.mvp_result_checks to service_role;

drop policy if exists "Players can read own MVP result checks" on public.mvp_result_checks;
create policy "Players can read own MVP result checks"
on public.mvp_result_checks
for select
to authenticated
using (voter_profile_id = (select auth.uid()));

drop policy if exists "Scoped managers can read MVP result checks" on public.mvp_result_checks;
create policy "Scoped managers can read MVP result checks"
on public.mvp_result_checks
for select
to authenticated
using (private.mvp_can_audit_session((select auth.uid()), session_id));
