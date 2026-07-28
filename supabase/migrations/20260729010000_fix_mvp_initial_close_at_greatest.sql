-- Fix fixture upserts that auto-open Player MVP Voting sessions.
--
-- PostgreSQL parses GREATEST as a conditional expression rather than an
-- ordinary pg_catalog function. Schema-qualifying it caused completed fixture
-- upserts to fail with SQLSTATE 42883 from private.mvp_initial_close_at.

create or replace function private.mvp_initial_close_at(
  p_fixture_id uuid,
  p_team_id uuid,
  p_opened_at timestamptz
)
returns timestamptz
language plpgsql
stable
security definer
set search_path = pg_catalog
as $function$
declare
  v_current_fixture_at timestamptz;
  v_next_fixture_at timestamptz;
begin
  select f.fixture_date
  into v_current_fixture_at
  from public.fixtures f
  where f.id = p_fixture_id
    and p_team_id in (f.home_team_id, f.away_team_id);

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'MVP_TEAM_NOT_IN_FIXTURE';
  end if;

  select min(f.fixture_date)
  into v_next_fixture_at
  from public.fixtures f
  where f.id <> p_fixture_id
    and p_team_id in (f.home_team_id, f.away_team_id)
    and f.status::text = 'SCHEDULED'
    and f.fixture_date > greatest(
      p_opened_at,
      coalesce(v_current_fixture_at, p_opened_at)
    );

  return coalesce(v_next_fixture_at, p_opened_at + interval '72 hours');
end
$function$;

revoke all on function private.mvp_initial_close_at(uuid, uuid, timestamptz)
  from public, anon, authenticated;
