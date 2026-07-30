-- Division-aware match durations and safe fixture rescheduling.
-- Existing divisions remain null and inherit their association default.

alter table public.divisions
  add column if not exists default_match_duration_minutes integer;

alter table public.divisions
  drop constraint if exists divisions_default_match_duration_minutes_check,
  add constraint divisions_default_match_duration_minutes_check
    check (
      default_match_duration_minutes is null
      or default_match_duration_minutes between 30 and 240
    );

comment on column public.divisions.default_match_duration_minutes is
  'Optional division match duration. Null inherits associations.default_match_duration_minutes.';

-- Preserve an explicitly configured fixture duration when only its start moves.
create or replace function private.preserve_fixture_scheduled_duration()
returns trigger
language plpgsql
set search_path = pg_catalog
as $function$
begin
  if new.fixture_date is distinct from old.fixture_date
     and new.scheduled_end_at is not distinct from old.scheduled_end_at
     and old.fixture_date is not null
     and old.scheduled_end_at is not null then
    new.scheduled_end_at := new.fixture_date + (old.scheduled_end_at - old.fixture_date);
  end if;

  return new;
end
$function$;

drop trigger if exists preserve_fixture_scheduled_duration on public.fixtures;
create trigger preserve_fixture_scheduled_duration
before update of fixture_date on public.fixtures
for each row execute function private.preserve_fixture_scheduled_duration();

-- Keep fill-in access aligned with exact, division and association timing.
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
      f.fixture_date + pg_catalog.make_interval(
        mins => coalesce(
          d.default_match_duration_minutes,
          a.default_match_duration_minutes,
          90
        )
      )
    ) + pg_catalog.make_interval(mins => a.fill_in_access_grace_minutes)
  from public.fixtures f
  join public.teams t on t.id = p_team_id
  join public.clubs c on c.id = t.club_id
  join public.associations a on a.id = c.association_id
  left join public.divisions d
    on d.id = f.division_id
   and d.association_id = a.id
  where f.id = p_fixture_id
    and p_team_id in (f.home_team_id, f.away_team_id);
$function$;

drop trigger if exists refresh_fixture_fill_in_expiry on public.fixtures;
create trigger refresh_fixture_fill_in_expiry
after update of fixture_date, scheduled_end_at, division_id, home_team_id, away_team_id
on public.fixtures
for each row execute function private.refresh_fixture_fill_in_expiry();

create or replace function private.refresh_division_fixture_fill_in_expiry()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $function$
begin
  update public.fixture_fill_ins ffi
  set access_expires_at = private.fixture_fill_in_expiry(ffi.fixture_id, ffi.team_id),
      updated_at = pg_catalog.now()
  from public.fixtures f
  where ffi.fixture_id = f.id
    and f.division_id = new.id;

  return new;
end
$function$;

drop trigger if exists refresh_division_fixture_fill_in_expiry on public.divisions;
create trigger refresh_division_fixture_fill_in_expiry
after update of default_match_duration_minutes on public.divisions
for each row
when (old.default_match_duration_minutes is distinct from new.default_match_duration_minutes)
execute function private.refresh_division_fixture_fill_in_expiry();

create or replace function private.refresh_association_fixture_fill_in_expiry()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $function$
begin
  update public.fixture_fill_ins ffi
  set access_expires_at = private.fixture_fill_in_expiry(ffi.fixture_id, ffi.team_id),
      updated_at = pg_catalog.now()
  from public.fixtures f,
       public.teams t,
       public.clubs c
  where ffi.fixture_id = f.id
    and t.id = ffi.team_id
    and c.id = t.club_id
    and c.association_id = new.id;

  return new;
end
$function$;

drop trigger if exists refresh_association_fixture_fill_in_expiry on public.associations;
create trigger refresh_association_fixture_fill_in_expiry
after update of default_match_duration_minutes, fill_in_access_grace_minutes
on public.associations
for each row
when (
  old.default_match_duration_minutes is distinct from new.default_match_duration_minutes
  or old.fill_in_access_grace_minutes is distinct from new.fill_in_access_grace_minutes
)
execute function private.refresh_association_fixture_fill_in_expiry();

-- Match the existing Division admin page: super admins can manage every row,
-- while association admins can manage only rows in their own association.
drop policy if exists divisions_write on public.divisions;
create policy divisions_write
on public.divisions
for all
to authenticated
using (
  (select public.is_super_admin())
  or exists (
    select 1
    from public.user_roles ur
    where ur.user_id = (select auth.uid())
      and ur.role = 'ASSOCIATION_ADMIN'::public.user_role_enum
      and ur.association_id = divisions.association_id
  )
)
with check (
  (select public.is_super_admin())
  or exists (
    select 1
    from public.user_roles ur
    where ur.user_id = (select auth.uid())
      and ur.role = 'ASSOCIATION_ADMIN'::public.user_role_enum
      and ur.association_id = divisions.association_id
  )
);

revoke all on function private.preserve_fixture_scheduled_duration() from public, anon, authenticated;
revoke all on function private.refresh_division_fixture_fill_in_expiry() from public, anon, authenticated;
revoke all on function private.refresh_association_fixture_fill_in_expiry() from public, anon, authenticated;
revoke all on function private.fixture_fill_in_expiry(uuid, uuid) from public, anon, authenticated;
