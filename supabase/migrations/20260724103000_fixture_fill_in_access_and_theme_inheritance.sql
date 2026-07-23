-- Fixture-scoped fill-ins, registered-club identity and inherited branding.
-- This migration is additive. It preserves legacy membership values and all
-- historical line-up and voting data.

alter table public.associations
  add column if not exists banner_url text,
  add column if not exists primary_colour text,
  add column if not exists secondary_colour text,
  add column if not exists default_match_duration_minutes integer not null default 90,
  add column if not exists fill_in_access_grace_minutes integer not null default 60;

alter table public.associations
  drop constraint if exists associations_default_match_duration_minutes_check,
  add constraint associations_default_match_duration_minutes_check
    check (default_match_duration_minutes between 30 and 240),
  drop constraint if exists associations_fill_in_access_grace_minutes_check,
  add constraint associations_fill_in_access_grace_minutes_check
    check (fill_in_access_grace_minutes between 0 and 240);

alter table public.clubs
  add column if not exists banner_url text,
  add column if not exists primary_colour text,
  add column if not exists secondary_colour text;

alter table public.teams
  add column if not exists banner_url text,
  add column if not exists primary_colour text,
  add column if not exists secondary_colour text;

alter table public.profiles
  add column if not exists registered_club_id uuid references public.clubs(id) on delete set null;

create index if not exists profiles_registered_club_id_idx
  on public.profiles (registered_club_id);

-- Only backfill an unambiguous registered club. Profiles with no active
-- primary membership or active primary memberships in multiple clubs remain
-- null for an administrator to review.
with primary_clubs as (
  select
    tm.user_id,
    (array_agg(distinct t.club_id))[1] as club_id,
    count(distinct t.club_id) as club_count
  from public.team_memberships tm
  join public.teams t on t.id = tm.team_id
  where tm.status = 'ACTIVE'
    and tm.membership_type::text = 'PRIMARY'
  group by tm.user_id
)
update public.profiles p
set registered_club_id = pc.club_id
from primary_clubs pc
where p.id = pc.user_id
  and p.registered_club_id is null
  and pc.club_count = 1;

create or replace function private.guard_registered_club_change()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  v_user_id uuid := auth.uid();
begin
  if new.registered_club_id is not distinct from old.registered_club_id
     or v_user_id is null then
    return new;
  end if;

  if not exists (
    select 1
    from public.user_roles ur
    left join public.clubs new_club on new_club.id = new.registered_club_id
    left join public.clubs old_club on old_club.id = old.registered_club_id
    where ur.user_id = v_user_id
      and (
        ur.role::text = 'SUPER_ADMIN'
        or (
          ur.role::text = 'ASSOCIATION_ADMIN'
          and ur.association_id in (new_club.association_id, old_club.association_id)
        )
        or (
          ur.role::text = 'CLUB_ADMIN'
          and ur.club_id in (new.registered_club_id, old.registered_club_id)
        )
      )
  ) then
    raise exception using errcode = '42501', message = 'REGISTERED_CLUB_CHANGE_NOT_AUTHORISED';
  end if;

  return new;
end
$function$;

drop trigger if exists guard_registered_club_change on public.profiles;
create trigger guard_registered_club_change
before update of registered_club_id on public.profiles
for each row execute function private.guard_registered_club_change();

create or replace function private.sync_registered_club_from_primary_membership()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  v_club_id uuid;
begin
  if new.status <> 'ACTIVE' or new.membership_type::text <> 'PRIMARY' then
    return new;
  end if;

  select t.club_id into v_club_id
  from public.teams t
  where t.id = new.team_id;

  if exists (
    select 1
    from public.team_memberships tm
    join public.teams t on t.id = tm.team_id
    where tm.user_id = new.user_id
      and tm.id <> new.id
      and tm.status = 'ACTIVE'
      and tm.membership_type::text = 'PRIMARY'
      and t.club_id <> v_club_id
  ) then
    raise exception using errcode = '23514', message = 'PLAYER_ALREADY_REGISTERED_WITH_ANOTHER_CLUB';
  end if;

  update public.profiles
  set registered_club_id = v_club_id
  where id = new.user_id
    and registered_club_id is distinct from v_club_id;

  return new;
end
$function$;

drop trigger if exists sync_registered_club_from_primary_membership on public.team_memberships;
create trigger sync_registered_club_from_primary_membership
after insert or update of status, membership_type, team_id
on public.team_memberships
for each row execute function private.sync_registered_club_from_primary_membership();

alter table public.fixtures
  add column if not exists scheduled_end_at timestamptz;

alter table public.fixtures
  drop constraint if exists fixtures_scheduled_end_after_start_check,
  add constraint fixtures_scheduled_end_after_start_check
    check (scheduled_end_at is null or scheduled_end_at >= fixture_date);

create or replace function private.can_manage_fixture_team(
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
    and exists (
      select 1
      from public.teams t
      join public.clubs c on c.id = t.club_id
      join public.user_roles ur on ur.user_id = p_user_id
      where t.id = p_team_id
        and (
          ur.role::text = 'SUPER_ADMIN'
          or (ur.role::text = 'ASSOCIATION_ADMIN' and ur.association_id = c.association_id)
          or (ur.role::text = 'CLUB_ADMIN' and ur.club_id = t.club_id)
          or (ur.role::text in ('COACH', 'TEAM_MANAGER') and ur.team_id = t.id)
        )
    );
$function$;

create or replace function private.fixture_fill_in_expiry(
  p_fixture_id uuid,
  p_team_id uuid
)
returns timestamptz
language sql
stable
security definer
set search_path = pg_catalog
as $function$
  select
    coalesce(
      f.scheduled_end_at,
      f.fixture_date + pg_catalog.make_interval(mins => a.default_match_duration_minutes)
    ) + pg_catalog.make_interval(mins => a.fill_in_access_grace_minutes)
  from public.fixtures f
  join public.teams t on t.id = p_team_id
  join public.clubs c on c.id = t.club_id
  join public.associations a on a.id = c.association_id
  where f.id = p_fixture_id
    and p_team_id in (f.home_team_id, f.away_team_id);
$function$;

create table if not exists public.fixture_fill_ins (
  id uuid primary key default gen_random_uuid(),
  fixture_id uuid not null references public.fixtures(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  player_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'SELECTED'
    check (status in ('SELECTED', 'REMOVED')),
  access_starts_at timestamptz not null default now(),
  access_expires_at timestamptz not null,
  added_by uuid references public.profiles(id) on delete set null,
  removed_at timestamptz,
  removed_by uuid references public.profiles(id) on delete set null,
  removal_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (fixture_id, team_id, player_id),
  check (access_expires_at >= access_starts_at),
  check (
    (status = 'SELECTED' and removed_at is null)
    or (status = 'REMOVED' and removed_at is not null)
  )
);

create index if not exists fixture_fill_ins_player_access_idx
  on public.fixture_fill_ins (player_id, status, access_expires_at);

create index if not exists fixture_fill_ins_team_fixture_idx
  on public.fixture_fill_ins (team_id, fixture_id, status);

create index if not exists fixture_fill_ins_added_by_idx
  on public.fixture_fill_ins (added_by)
  where added_by is not null;

create index if not exists fixture_fill_ins_removed_by_idx
  on public.fixture_fill_ins (removed_by)
  where removed_by is not null;

create or replace function private.has_current_fixture_fill_in_access(
  p_user_id uuid,
  p_fixture_id uuid,
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
    and exists (
      select 1
      from public.fixture_fill_ins ffi
      where ffi.fixture_id = p_fixture_id
        and ffi.team_id = p_team_id
        and ffi.player_id = p_user_id
        and ffi.status = 'SELECTED'
        and pg_catalog.now() between ffi.access_starts_at and ffi.access_expires_at
    );
$function$;

create or replace function private.prepare_fixture_fill_in()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  v_access_expires_at timestamptz;
begin
  if not exists (
    select 1
    from public.fixtures f
    where f.id = new.fixture_id
      and new.team_id in (f.home_team_id, f.away_team_id)
  ) then
    raise exception using errcode = '23514', message = 'FILL_IN_TEAM_NOT_IN_FIXTURE';
  end if;

  v_access_expires_at := private.fixture_fill_in_expiry(new.fixture_id, new.team_id);
  if v_access_expires_at is null then
    raise exception using errcode = '23514', message = 'FILL_IN_EXPIRY_UNAVAILABLE';
  end if;

  new.access_expires_at := v_access_expires_at;
  new.updated_at := pg_catalog.now();

  if new.status = 'SELECTED' then
    new.removed_at := null;
    new.removed_by := null;
    new.removal_reason := null;
  elsif new.removed_at is null then
    new.removed_at := pg_catalog.now();
  end if;

  return new;
end
$function$;

drop trigger if exists prepare_fixture_fill_in on public.fixture_fill_ins;
create trigger prepare_fixture_fill_in
before insert or update on public.fixture_fill_ins
for each row execute function private.prepare_fixture_fill_in();

create or replace function private.refresh_fixture_fill_in_expiry()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $function$
begin
  update public.fixture_fill_ins ffi
  set access_expires_at = private.fixture_fill_in_expiry(ffi.fixture_id, ffi.team_id),
      updated_at = pg_catalog.now()
  where ffi.fixture_id = new.id;
  return new;
end
$function$;

drop trigger if exists refresh_fixture_fill_in_expiry on public.fixtures;
create trigger refresh_fixture_fill_in_expiry
after update of fixture_date, scheduled_end_at, home_team_id, away_team_id
on public.fixtures
for each row execute function private.refresh_fixture_fill_in_expiry();

alter table public.fixture_fill_ins enable row level security;

drop policy if exists "Fixture fill-ins scoped select" on public.fixture_fill_ins;
create policy "Fixture fill-ins scoped select"
on public.fixture_fill_ins
for select
to authenticated
using (
  player_id = (select auth.uid())
  or private.can_manage_fixture_team((select auth.uid()), team_id)
  or exists (
    select 1
    from public.team_memberships tm
    where tm.user_id = (select auth.uid())
      and tm.team_id = fixture_fill_ins.team_id
      and tm.status = 'ACTIVE'
  )
  or private.has_current_fixture_fill_in_access(
    (select auth.uid()),
    fixture_id,
    team_id
  )
);

drop policy if exists "Fixture fill-ins scoped insert" on public.fixture_fill_ins;
create policy "Fixture fill-ins scoped insert"
on public.fixture_fill_ins
for insert
to authenticated
with check (
  added_by = (select auth.uid())
  and private.can_manage_fixture_team((select auth.uid()), team_id)
);

drop policy if exists "Fixture fill-ins scoped update" on public.fixture_fill_ins;
create policy "Fixture fill-ins scoped update"
on public.fixture_fill_ins
for update
to authenticated
using (private.can_manage_fixture_team((select auth.uid()), team_id))
with check (
  private.can_manage_fixture_team((select auth.uid()), team_id)
  and (
    status = 'SELECTED'
    or (status = 'REMOVED' and removed_by = (select auth.uid()))
  )
);

revoke all on public.fixture_fill_ins from public, anon, authenticated;
grant select, insert, update on public.fixture_fill_ins to authenticated;
grant all on public.fixture_fill_ins to service_role;

revoke all on function private.can_manage_fixture_team(uuid, uuid) from public, anon;
revoke all on function private.has_current_fixture_fill_in_access(uuid, uuid, uuid) from public, anon;
revoke all on function private.guard_registered_club_change() from public, anon, authenticated;
revoke all on function private.sync_registered_club_from_primary_membership() from public, anon, authenticated;
revoke all on function private.fixture_fill_in_expiry(uuid, uuid) from public, anon, authenticated;
revoke all on function private.prepare_fixture_fill_in() from public, anon, authenticated;
revoke all on function private.refresh_fixture_fill_in_expiry() from public, anon, authenticated;
grant execute on function private.can_manage_fixture_team(uuid, uuid) to authenticated;
grant execute on function private.has_current_fixture_fill_in_access(uuid, uuid, uuid) to authenticated;

-- Team chat is available from selection until one hour after the calculated
-- match end. It does not grant club or association broadcast access.
create or replace function private.communication_has_channel_access(
  p_channel_id uuid,
  p_message_created_at timestamptz default now()
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select private.communication_is_super_admin()
  or exists (
    select 1
    from public.communication_channels ch
    where ch.id = p_channel_id
      and (
        (
          ch.scope_type = 'TEAM'
          and (
            exists (
              select 1 from public.team_memberships tm
              where tm.user_id = (select auth.uid())
                and tm.team_id = ch.team_id
                and tm.status = 'ACTIVE'
                and coalesce(tm.activated_at, tm.created_at) <= p_message_created_at
            )
            or exists (
              select 1 from public.fixture_fill_ins ffi
              where ffi.player_id = (select auth.uid())
                and ffi.team_id = ch.team_id
                and ffi.status = 'SELECTED'
                and ffi.access_starts_at <= p_message_created_at
                and pg_catalog.now() <= ffi.access_expires_at
            )
            or exists (
              select 1 from public.user_roles ur
              join public.teams t on t.id = ch.team_id
              join public.clubs c on c.id = t.club_id
              where ur.user_id = (select auth.uid())
                and (
                  (ur.role in ('COACH', 'TEAM_MANAGER') and ur.team_id = ch.team_id)
                  or (ur.role = 'CLUB_ADMIN' and ur.club_id = t.club_id)
                  or (ur.role = 'ASSOCIATION_ADMIN' and ur.association_id = c.association_id)
                )
            )
          )
        )
        or (
          ch.scope_type = 'CLUB'
          and (
            exists (
              select 1 from public.team_memberships tm
              join public.teams t on t.id = tm.team_id
              where tm.user_id = (select auth.uid())
                and tm.status = 'ACTIVE'
                and t.club_id = ch.club_id
            )
            or exists (
              select 1 from public.user_roles ur
              join public.clubs c on c.id = ch.club_id
              where ur.user_id = (select auth.uid())
                and (
                  (ur.role = 'CLUB_ADMIN' and ur.club_id = ch.club_id)
                  or (ur.role = 'ASSOCIATION_ADMIN' and ur.association_id = c.association_id)
                )
            )
          )
        )
        or (
          ch.scope_type = 'ASSOCIATION'
          and (
            exists (
              select 1 from public.team_memberships tm
              join public.teams t on t.id = tm.team_id
              join public.clubs c on c.id = t.club_id
              where tm.user_id = (select auth.uid())
                and tm.status = 'ACTIVE'
                and c.association_id = ch.association_id
            )
            or exists (
              select 1 from public.user_roles ur
              where ur.user_id = (select auth.uid())
                and ur.role = 'ASSOCIATION_ADMIN'
                and ur.association_id = ch.association_id
            )
          )
        )
      )
  );
$$;

revoke all on function private.communication_has_channel_access(uuid, timestamptz) from public, anon;
grant execute on function private.communication_has_channel_access(uuid, timestamptz) to authenticated;

drop policy if exists "Fixture lineups scoped select" on public.fixture_lineups;
create policy "Fixture lineups scoped select"
on public.fixture_lineups
for select
to authenticated
using (
  public.is_super_admin()
  or exists (
    select 1
    from public.team_memberships tm
    where tm.team_id = fixture_lineups.team_id
      and tm.user_id = (select auth.uid())
      and tm.status = 'ACTIVE'
  )
  or exists (
    select 1
    from public.fixture_fill_ins ffi
    where ffi.fixture_id = fixture_lineups.fixture_id
      and ffi.team_id = fixture_lineups.team_id
      and ffi.player_id = (select auth.uid())
      and ffi.status = 'SELECTED'
      and pg_catalog.now() between ffi.access_starts_at and ffi.access_expires_at
  )
  or exists (
    select 1
    from public.teams t
    join public.clubs c on c.id = t.club_id
    join public.user_roles ur on ur.user_id = (select auth.uid())
    where t.id = fixture_lineups.team_id
      and (
        (ur.role = 'ASSOCIATION_ADMIN'::public.user_role_enum and ur.association_id = c.association_id)
        or (ur.role = 'CLUB_ADMIN'::public.user_role_enum and ur.club_id = c.id)
        or (ur.role = any (array['TEAM_MANAGER'::public.user_role_enum, 'COACH'::public.user_role_enum]) and ur.team_id = t.id)
      )
  )
);

-- Player MVP eligibility deliberately outlives team-resource access. A selected
-- fill-in stays eligible for this fixture until the voting session itself closes.
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
      where s.id = p_session_id
        and s.team_id is not null
        and (
          exists (
            select 1
            from public.revsports_players rp
            where rp.fixture_id = s.fixture_id
              and rp.profile_id = p_user_id
              and rp.attended is true
              and (
                (lower(rp.team_side) = 'home' and s.team_id = f.home_team_id)
                or (lower(rp.team_side) = 'away' and s.team_id = f.away_team_id)
              )
          )
          or exists (
            select 1
            from public.fixture_fill_ins ffi
            where ffi.fixture_id = s.fixture_id
              and ffi.team_id = s.team_id
              and ffi.player_id = p_user_id
              and ffi.status = 'SELECTED'
          )
        )
    );
$function$;

revoke all on function private.mvp_player_is_eligible(uuid, uuid) from public, anon;
grant execute on function private.mvp_player_is_eligible(uuid, uuid) to authenticated;

comment on column public.profiles.registered_club_id is
  'The club where the player is registered. Team classification is PRIMARY when this matches the team club, otherwise SECONDARY.';
comment on table public.fixture_fill_ins is
  'Fixture-scoped fill-in selections. Resource access expires after the match grace period; Player MVP eligibility follows the session close.';
comment on column public.fixtures.scheduled_end_at is
  'Optional exact match end used for fill-in access. When absent, the association default match duration is used.';
