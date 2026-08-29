-- Transactional regression test. The migration is re-run inside this
-- transaction and every schema/data change is rolled back at the end.
begin;

\ir ../migrations/20260829074811_admin_lineup_coaching_improvements.sql

do $test$
declare
  v_missing_roster integer;
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'preferred_name'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'nickname'
  ) then
    raise exception 'Profile name columns are missing.';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'formation_positions' and column_name = 'position_area'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'formation_positions' and column_name = 'position_side'
  ) then
    raise exception 'Canonical formation-position columns are missing.';
  end if;

  if exists (
    select 1 from public.formation_positions
    where position_area = 'GOALKEEPER' and position_side is not null
  ) then
    raise exception 'A goalkeeper has an invalid pitch side.';
  end if;

  if not exists (
    select 1 from pg_class
    where oid = 'public.fixture_lineup_roster_selections'::regclass and relrowsecurity
  ) or not exists (
    select 1 from pg_class
    where oid = 'public.fixture_lineup_position_overrides'::regclass and relrowsecurity
  ) or not exists (
    select 1 from pg_class
    where oid = 'public.coach_player_fixture_notes'::regclass and relrowsecurity
  ) then
    raise exception 'A new browser-facing table does not have RLS enabled.';
  end if;

  if has_table_privilege('anon', 'public.fixture_lineup_roster_selections', 'SELECT')
     or has_table_privilege('anon', 'public.fixture_lineup_position_overrides', 'SELECT')
     or has_table_privilege('anon', 'public.coach_player_fixture_notes', 'SELECT') then
    raise exception 'Anonymous access was granted to a private table.';
  end if;

  if not has_table_privilege('authenticated', 'public.fixture_lineup_roster_selections', 'SELECT, INSERT, UPDATE, DELETE')
     or not has_table_privilege('authenticated', 'public.fixture_lineup_position_overrides', 'SELECT, INSERT, UPDATE, DELETE')
     or not has_table_privilege('authenticated', 'public.coach_player_fixture_notes', 'SELECT, INSERT, UPDATE, DELETE') then
    raise exception 'Authenticated Data API grants are incomplete.';
  end if;

  select count(*) into v_missing_roster
  from public.fixture_lineup_assignments assignment
  where not exists (
    select 1
    from public.fixture_lineup_roster_selections selection
    where selection.fixture_lineup_id = assignment.fixture_lineup_id
      and selection.player_id = assignment.player_id
  );
  if v_missing_roster <> 0 then
    raise exception 'Existing line-up assignments were not backfilled into the roster.';
  end if;

  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'mvp_votes'
      and policyname = 'Super Association admin full access - mvp_votes'
  ) then
    raise exception 'The broad Association Admin raw-vote policy still exists.';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'mvp_votes'
      and policyname = 'Super admin full access - mvp_votes'
      and cmd = 'ALL'
  ) or not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'mvp_votes'
      and policyname = 'Club admins read own club mvp_votes'
      and cmd = 'SELECT'
  ) then
    raise exception 'The replacement raw-vote policies are incomplete.';
  end if;
end
$test$;

select 'admin, line-up and coaching database checks passed';

rollback;
