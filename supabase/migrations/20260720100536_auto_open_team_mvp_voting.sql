-- Automatically open first-cycle Player MVP Voting when a completed fixture
-- with final scores is written by the fixture import.
--
-- Initial rounds close at the team's next scheduled fixture start. If no
-- future scheduled fixture exists, the safe fallback is 72 hours after open.
-- Reopen and dispute-resolution windows remain unchanged at a maximum of
-- 72 hours.

create index if not exists fixtures_scheduled_home_team_date_idx
  on public.fixtures (home_team_id, fixture_date)
  where status = 'SCHEDULED'::public.fixture_status_enum;

create index if not exists fixtures_scheduled_away_team_date_idx
  on public.fixtures (away_team_id, fixture_date)
  where status = 'SCHEDULED'::public.fixture_status_enum;

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
    and f.fixture_date > pg_catalog.greatest(
      p_opened_at,
      coalesce(v_current_fixture_at, p_opened_at)
    );

  return coalesce(v_next_fixture_at, p_opened_at + interval '72 hours');
end
$function$;

create or replace function public.create_mvp_session_for_fixture()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  v_team_id uuid;
  v_session_id uuid;
  v_session public.mvp_voting_sessions%rowtype;
  v_opened_at timestamptz;
  v_closes_at timestamptz;
  v_should_auto_open boolean;
begin
  v_should_auto_open :=
    new.status::text = 'COMPLETED'
    and new.home_score is not null
    and new.away_score is not null;

  if tg_op = 'UPDATE' then
    v_should_auto_open :=
      v_should_auto_open
      and (
        old.status is distinct from new.status
        or (old.home_score is null and new.home_score is not null)
        or (old.away_score is null and new.away_score is not null)
        or old.home_team_id is distinct from new.home_team_id
        or old.away_team_id is distinct from new.away_team_id
      );
  end if;

  for v_team_id in
    select distinct candidate.team_id
    from (
      values (new.home_team_id), (new.away_team_id)
    ) as candidate(team_id)
    where candidate.team_id is not null
    order by candidate.team_id
  loop
    v_session_id := private.mvp_create_pending_session(
      new.id,
      v_team_id,
      auth.uid()
    );

    if v_session_id is null or not v_should_auto_open then
      continue;
    end if;

    select s.*
    into v_session
    from public.mvp_voting_sessions s
    where s.id = v_session_id
    for update;

    -- Repeated scraper updates are safe: only the original pending round opens.
    if v_session.status::text <> 'PENDING' then
      continue;
    end if;

    v_opened_at := pg_catalog.now();
    v_closes_at := private.mvp_initial_close_at(
      new.id,
      v_team_id,
      v_opened_at
    );

    update public.mvp_voting_sessions
    set status = 'OPEN'::public.mvp_session_status,
        opened_at = v_opened_at,
        opened_by = null,
        closes_at = v_closes_at,
        closed_at = null,
        closed_by = null,
        locked_at = null,
        locked_by = null,
        locked_reason = null
    where id = v_session.id;

    perform private.mvp_write_audit(
      v_session.id,
      v_team_id,
      'AUTO_OPEN',
      'Team MVP voting opened after fixture finalisation',
      null,
      null,
      pg_catalog.jsonb_build_object(
        'previous_status', v_session.status::text,
        'fixture_id', new.id,
        'opened_at', v_opened_at,
        'closes_at', v_closes_at,
        'close_rule',
          case
            when v_closes_at = v_opened_at + interval '72 hours'
              then 'FALLBACK_72_HOURS'
            else 'NEXT_SCHEDULED_FIXTURE'
          end,
        'voting_cycle', v_session.voting_cycle
      )
    );
  end loop;

  return new;
end
$function$;

drop trigger if exists trg_create_mvp_session_on_fixture on public.fixtures;
create trigger trg_create_mvp_session_on_fixture
after insert or update of
  home_team_id,
  away_team_id,
  status,
  home_score,
  away_score
on public.fixtures
for each row execute function public.create_mvp_session_for_fixture();

-- Keep the existing RPC signature for deployed-client compatibility. A
-- first-time opening always uses the database-calculated next-match close,
-- even if an older client supplies its former 72-hour value.
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
  v_opened_at timestamptz;
  v_closes_at timestamptz;
  v_team_enabled boolean;
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'MVP_NOT_AUTHENTICATED';
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

  v_opened_at := pg_catalog.now();
  v_closes_at := private.mvp_initial_close_at(
    p_fixture_id,
    p_team_id,
    v_opened_at
  );

  update public.mvp_voting_sessions
  set status = 'OPEN'::public.mvp_session_status,
      opened_at = v_opened_at,
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
      'requested_closes_at', p_closes_at,
      'closes_at', v_closes_at,
      'close_rule',
        case
          when v_closes_at = v_opened_at + interval '72 hours'
            then 'FALLBACK_72_HOURS'
          else 'NEXT_SCHEDULED_FIXTURE'
        end,
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

revoke all on function private.mvp_initial_close_at(uuid, uuid, timestamptz)
  from public, anon, authenticated;
revoke all on function public.create_mvp_session_for_fixture()
  from public, anon, authenticated;

-- Reuse the existing scheduler command so each Supabase environment keeps its
-- own URL and secret. Checking every minute makes automatic opening messages
-- prompt without creating a second scheduled job.
do $migration$
declare
  v_command text;
begin
  select j.command
  into v_command
  from cron.job j
  where j.jobname = 'mvp-voting-email-reminders'
  order by j.jobid desc
  limit 1;

  if v_command is null then
    raise warning 'Player MVP reminder job was not found; schedule was not changed';
  else
    perform cron.unschedule('mvp-voting-email-reminders');
    perform cron.schedule(
      'mvp-voting-email-reminders',
      '* * * * *',
      v_command
    );
  end if;
end
$migration$;
