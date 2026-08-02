-- Enforce module availability at the voting data and RPC boundaries.
-- Browser requests use the active, session-bound permission mode introduced
-- by 20260802113500. Service-role jobs remain callable, but their Edge
-- Functions must perform an explicit scope-level module check.

create schema if not exists private;

create or replace function private.voting_request_is_service_role()
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_claims jsonb := '{}'::jsonb;
  v_role text;
begin
  begin
    v_claims := coalesce(
      nullif(current_setting('request.jwt.claims', true), '')::jsonb,
      '{}'::jsonb
    );
  exception
    when others then
      v_claims := '{}'::jsonb;
  end;

  v_role := coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    v_claims->>'role'
  );
  return v_role = 'service_role';
end;
$function$;

create or replace function private.player_mvp_team_allowed_for_current_session(
  p_team_id uuid,
  p_division_id uuid default null
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_club_id uuid;
  v_association_id uuid;
  v_division_id uuid;
begin
  if p_team_id is null then
    return false;
  end if;

  select team_row.club_id,
         club_row.association_id,
         coalesce(p_division_id, team_row.division_id)
  into v_club_id, v_association_id, v_division_id
  from public.teams team_row
  join public.clubs club_row on club_row.id = team_row.club_id
  where team_row.id = p_team_id;

  if not found then
    return false;
  end if;

  return private.module_allowed_for_current_session(
    'player_mvp',
    v_association_id,
    v_club_id,
    v_division_id,
    p_team_id
  );
exception
  when others then
    return false;
end;
$function$;

create or replace function private.player_mvp_session_allowed_for_current_session(
  p_session_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_team_id uuid;
  v_division_id uuid;
begin
  if p_session_id is null then
    return false;
  end if;

  select session_row.team_id,
         coalesce(fixture_row.division_id, team_row.division_id)
  into v_team_id, v_division_id
  from public.mvp_voting_sessions session_row
  left join public.fixtures fixture_row on fixture_row.id = session_row.fixture_id
  left join public.teams team_row on team_row.id = session_row.team_id
  where session_row.id = p_session_id;

  if not found then
    return false;
  end if;

  return private.player_mvp_team_allowed_for_current_session(v_team_id, v_division_id);
exception
  when others then
    return false;
end;
$function$;

create or replace function private.player_mvp_vote_allowed_for_current_session(
  p_session_id uuid,
  p_token_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_session_id uuid := p_session_id;
  v_token_session_id uuid;
begin
  if p_token_id is not null then
    select token_row.session_id
    into v_token_session_id
    from public.mvp_vote_tokens token_row
    where token_row.id = p_token_id;

    if not found
       or (v_session_id is not null and v_session_id is distinct from v_token_session_id) then
      return false;
    end if;

    v_session_id := v_token_session_id;
  end if;

  return private.player_mvp_session_allowed_for_current_session(v_session_id);
exception
  when others then
    return false;
end;
$function$;

create or replace function private.player_mvp_fixture_team_allowed_for_current_session(
  p_fixture_id uuid,
  p_team_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_division_id uuid;
  v_home_team_id uuid;
  v_away_team_id uuid;
begin
  select fixture_row.division_id,
         fixture_row.home_team_id,
         fixture_row.away_team_id
  into v_division_id, v_home_team_id, v_away_team_id
  from public.fixtures fixture_row
  where fixture_row.id = p_fixture_id;

  if not found
     or p_team_id is null
     or (
       p_team_id is distinct from v_home_team_id
       and p_team_id is distinct from v_away_team_id
     ) then
    return false;
  end if;

  return private.player_mvp_team_allowed_for_current_session(p_team_id, v_division_id);
exception
  when others then
    return false;
end;
$function$;

create or replace function private.player_mvp_session_row_allowed_for_current_session(
  p_fixture_id uuid,
  p_team_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $function$
begin
  if p_fixture_id is not null then
    return private.player_mvp_fixture_team_allowed_for_current_session(p_fixture_id, p_team_id);
  end if;
  return private.player_mvp_team_allowed_for_current_session(p_team_id, null);
exception
  when others then
    return false;
end;
$function$;

create or replace function public.player_mvp_public_session_enabled(p_session_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_association_id uuid;
  v_club_id uuid;
  v_division_id uuid;
  v_team_id uuid;
begin
  if p_session_id is null then
    return false;
  end if;

  select club_row.association_id,
         team_row.club_id,
         coalesce(fixture_row.division_id, team_row.division_id),
         session_row.team_id
  into v_association_id, v_club_id, v_division_id, v_team_id
  from public.mvp_voting_sessions session_row
  join public.teams team_row on team_row.id = session_row.team_id
  join public.clubs club_row on club_row.id = team_row.club_id
  left join public.fixtures fixture_row on fixture_row.id = session_row.fixture_id
  where session_row.id = p_session_id;

  if not found then
    return false;
  end if;

  return public.resolve_module_enabled(
    'player_mvp',
    v_association_id,
    v_club_id,
    v_division_id,
    v_team_id
  ) is true;
exception
  when others then
    return false;
end;
$function$;

create or replace function public.player_mvp_public_session_row_enabled(
  p_fixture_id uuid,
  p_team_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_association_id uuid;
  v_club_id uuid;
  v_division_id uuid;
begin
  if p_team_id is null then
    return false;
  end if;

  select club_row.association_id,
         team_row.club_id,
         coalesce(fixture_row.division_id, team_row.division_id)
  into v_association_id, v_club_id, v_division_id
  from public.teams team_row
  join public.clubs club_row on club_row.id = team_row.club_id
  left join public.fixtures fixture_row on fixture_row.id = p_fixture_id
  where team_row.id = p_team_id;

  if not found then
    return false;
  end if;

  return public.resolve_module_enabled(
    'player_mvp',
    v_association_id,
    v_club_id,
    v_division_id,
    p_team_id
  ) is true;
exception
  when others then
    return false;
end;
$function$;

create or replace function public.player_mvp_public_vote_enabled(
  p_session_id uuid,
  p_token_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_token_session_id uuid;
begin
  if p_token_id is null then
    return false;
  end if;

  select token_row.session_id
  into v_token_session_id
  from public.mvp_vote_tokens token_row
  where token_row.id = p_token_id;

  if not found
     or (p_session_id is not null and p_session_id is distinct from v_token_session_id) then
    return false;
  end if;

  return public.player_mvp_public_session_enabled(v_token_session_id);
exception
  when others then
    return false;
end;
$function$;

-- The fixture scraper writes through a SECURITY DEFINER trigger. Gate that
-- trigger before it creates even a pending session so turning Player MVP off
-- is enforced at the automatic write boundary as well as in the UI and RPCs.
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
    if public.player_mvp_public_session_row_enabled(new.id, v_team_id) is not true then
      continue;
    end if;

    v_session_id := private.mvp_create_pending_session(
      new.id,
      v_team_id,
      auth.uid()
    );

    if v_session_id is null or not v_should_auto_open then
      continue;
    end if;

    select session_row.*
    into v_session
    from public.mvp_voting_sessions session_row
    where session_row.id = v_session_id
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
end;
$function$;

-- Keep every stored token vote bound to the token's own session. The legacy
-- public token route is retired, but this trigger also protects trusted jobs
-- and future maintenance code from creating cross-session vote rows.
create or replace function private.enforce_mvp_vote_token_session()
returns trigger
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  v_token_session_id uuid;
begin
  if new.token_id is null then
    return new;
  end if;

  select token_row.session_id
  into v_token_session_id
  from public.mvp_vote_tokens token_row
  where token_row.id = new.token_id;

  if not found then
    raise exception using
      errcode = '23503',
      message = 'The Player MVP token does not exist.';
  end if;

  if new.session_id is null then
    new.session_id := v_token_session_id;
  elsif new.session_id is distinct from v_token_session_id then
    raise exception using
      errcode = '23514',
      message = 'The Player MVP token belongs to a different voting session.';
  end if;

  return new;
end;
$function$;

drop trigger if exists enforce_mvp_vote_token_session on public.mvp_votes;
create trigger enforce_mvp_vote_token_session
before insert or update on public.mvp_votes
for each row execute function private.enforce_mvp_vote_token_session();

revoke all on function private.enforce_mvp_vote_token_session()
  from public, anon, authenticated;

create or replace function private.umpire_match_fixture_allowed_for_current_session(
  p_fixture_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_division_id uuid;
  v_home_team_id uuid;
  v_home_club_id uuid;
  v_home_association_id uuid;
  v_away_team_id uuid;
  v_away_club_id uuid;
  v_away_association_id uuid;
begin
  if p_fixture_id is null then
    return false;
  end if;

  select coalesce(fixture_row.division_id, home_team.division_id, away_team.division_id),
         home_team.id,
         home_team.club_id,
         home_club.association_id,
         away_team.id,
         away_team.club_id,
         away_club.association_id
  into v_division_id,
       v_home_team_id,
       v_home_club_id,
       v_home_association_id,
       v_away_team_id,
       v_away_club_id,
       v_away_association_id
  from public.fixtures fixture_row
  join public.teams home_team on home_team.id = fixture_row.home_team_id
  join public.clubs home_club on home_club.id = home_team.club_id
  join public.teams away_team on away_team.id = fixture_row.away_team_id
  join public.clubs away_club on away_club.id = away_team.club_id
  where fixture_row.id = p_fixture_id;

  if not found then
    return false;
  end if;

  -- A fixture is visible when the active mode can legitimately access either
  -- participating side. Existing business RLS still limits the caller to a
  -- club or team they manage; requiring both sides locked every Club Admin out
  -- of normal cross-club fixtures.
  return private.module_allowed_for_current_session(
    'umpire_match_voting',
    v_home_association_id,
    v_home_club_id,
    v_division_id,
    v_home_team_id
  )
  or private.module_allowed_for_current_session(
    'umpire_match_voting',
    v_away_association_id,
    v_away_club_id,
    v_division_id,
    v_away_team_id
  );
exception
  when others then
    return false;
end;
$function$;

create or replace function private.umpire_match_submission_allowed_for_current_session(
  p_submission_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_submission public.player_vote_submissions%rowtype;
  v_has_team_scope boolean := false;
  v_team_scope_allowed boolean := false;
begin
  select submission_row.*
  into v_submission
  from public.player_vote_submissions submission_row
  where submission_row.id = p_submission_id;

  if not found then
    return false;
  end if;

  if v_submission.fixture_id is not null then
    return private.umpire_match_fixture_allowed_for_current_session(v_submission.fixture_id);
  end if;

  if v_submission.home_team_id is not null then
    v_has_team_scope := true;
    v_team_scope_allowed := v_team_scope_allowed or private.module_allowed_for_current_session(
      'umpire_match_voting',
      v_submission.association_id,
      (select team_row.club_id from public.teams team_row where team_row.id = v_submission.home_team_id),
      v_submission.division_id,
      v_submission.home_team_id
    );
  end if;

  if v_submission.away_team_id is not null then
    v_has_team_scope := true;
    v_team_scope_allowed := v_team_scope_allowed or private.module_allowed_for_current_session(
      'umpire_match_voting',
      v_submission.association_id,
      (select team_row.club_id from public.teams team_row where team_row.id = v_submission.away_team_id),
      v_submission.division_id,
      v_submission.away_team_id
    );
  end if;

  if v_has_team_scope then
    return v_team_scope_allowed;
  end if;

  return private.module_allowed_for_current_session(
    'umpire_match_voting',
    v_submission.association_id,
    null,
    v_submission.division_id,
    null
  );
exception
  when others then
    return false;
end;
$function$;

create or replace function private.umpire_match_submission_row_allowed_for_current_session(
  p_fixture_id uuid,
  p_association_id uuid,
  p_division_id uuid,
  p_home_team_id uuid,
  p_away_team_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_has_team_scope boolean := false;
  v_team_scope_allowed boolean := false;
begin
  if p_fixture_id is not null then
    return private.umpire_match_fixture_allowed_for_current_session(p_fixture_id);
  end if;

  if p_home_team_id is not null then
    v_has_team_scope := true;
    v_team_scope_allowed := v_team_scope_allowed or private.module_allowed_for_current_session(
      'umpire_match_voting',
      p_association_id,
      (select team_row.club_id from public.teams team_row where team_row.id = p_home_team_id),
      p_division_id,
      p_home_team_id
    );
  end if;

  if p_away_team_id is not null then
    v_has_team_scope := true;
    v_team_scope_allowed := v_team_scope_allowed or private.module_allowed_for_current_session(
      'umpire_match_voting',
      p_association_id,
      (select team_row.club_id from public.teams team_row where team_row.id = p_away_team_id),
      p_division_id,
      p_away_team_id
    );
  end if;

  if v_has_team_scope then
    return v_team_scope_allowed;
  end if;

  return private.module_allowed_for_current_session(
    'umpire_match_voting',
    p_association_id,
    null,
    p_division_id,
    null
  );
exception
  when others then
    return false;
end;
$function$;

-- Resolve public portal fixture flags in one database request. This replaces
-- two network RPCs per fixture while retaining the conservative rule that the
-- public workflow is available only when both participating scopes enable it.
create or replace function public.umpire_match_voting_enabled_fixture_ids(
  p_fixture_ids uuid[]
)
returns table (fixture_id uuid)
language sql
stable
security definer
set search_path = ''
as $function$
  select fixture_row.id
  from public.fixtures fixture_row
  join public.teams home_team on home_team.id = fixture_row.home_team_id
  join public.clubs home_club on home_club.id = home_team.club_id
  join public.teams away_team on away_team.id = fixture_row.away_team_id
  join public.clubs away_club on away_club.id = away_team.club_id
  where fixture_row.id = any(coalesce(p_fixture_ids, array[]::uuid[]))
    and public.resolve_module_enabled(
      'umpire_match_voting',
      home_club.association_id,
      home_team.club_id,
      coalesce(fixture_row.division_id, home_team.division_id, away_team.division_id),
      home_team.id
    ) is true
    and public.resolve_module_enabled(
      'umpire_match_voting',
      away_club.association_id,
      away_team.club_id,
      coalesce(fixture_row.division_id, home_team.division_id, away_team.division_id),
      away_team.id
    ) is true;
$function$;

create or replace function public.current_session_can_access_voting_module(
  p_module_key text,
  p_association_id uuid default null,
  p_club_id uuid default null,
  p_division_id uuid default null,
  p_team_id uuid default null
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $function$
begin
  if lower(trim(coalesce(p_module_key, ''))) not in ('player_mvp', 'umpire_match_voting') then
    return false;
  end if;

  return private.module_allowed_for_current_session(
    lower(trim(p_module_key)),
    p_association_id,
    p_club_id,
    p_division_id,
    p_team_id
  );
exception
  when others then
    return false;
end;
$function$;

revoke all on function public.player_mvp_public_session_enabled(uuid)
  from public, anon, authenticated;
revoke all on function public.player_mvp_public_session_row_enabled(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.player_mvp_public_vote_enabled(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.player_mvp_public_session_enabled(uuid) to anon;
grant execute on function public.player_mvp_public_session_row_enabled(uuid, uuid) to anon;
grant execute on function public.player_mvp_public_vote_enabled(uuid, uuid) to anon;

revoke all on function public.current_session_can_access_voting_module(
  text, uuid, uuid, uuid, uuid
) from public, anon, authenticated;
grant execute on function public.current_session_can_access_voting_module(
  text, uuid, uuid, uuid, uuid
) to authenticated;

revoke all on function public.umpire_match_voting_enabled_fixture_ids(uuid[])
  from public, anon, authenticated;
grant execute on function public.umpire_match_voting_enabled_fixture_ids(uuid[])
  to service_role;

revoke all on function private.voting_request_is_service_role()
  from public, anon, authenticated;
revoke all on function private.player_mvp_team_allowed_for_current_session(uuid, uuid)
  from public, anon, authenticated;
revoke all on function private.player_mvp_session_allowed_for_current_session(uuid)
  from public, anon, authenticated;
revoke all on function private.player_mvp_vote_allowed_for_current_session(uuid, uuid)
  from public, anon, authenticated;
revoke all on function private.player_mvp_fixture_team_allowed_for_current_session(uuid, uuid)
  from public, anon, authenticated;
revoke all on function private.player_mvp_session_row_allowed_for_current_session(uuid, uuid)
  from public, anon, authenticated;
revoke all on function private.umpire_match_fixture_allowed_for_current_session(uuid)
  from public, anon, authenticated;
revoke all on function private.umpire_match_submission_allowed_for_current_session(uuid)
  from public, anon, authenticated;
revoke all on function private.umpire_match_submission_row_allowed_for_current_session(
  uuid, uuid, uuid, uuid, uuid
) from public, anon, authenticated;

grant usage on schema private to authenticated;
grant execute on function private.player_mvp_team_allowed_for_current_session(uuid, uuid)
  to authenticated;
grant execute on function private.player_mvp_session_allowed_for_current_session(uuid)
  to authenticated;
grant execute on function private.player_mvp_vote_allowed_for_current_session(uuid, uuid)
  to authenticated;
grant execute on function private.player_mvp_fixture_team_allowed_for_current_session(uuid, uuid)
  to authenticated;
grant execute on function private.player_mvp_session_row_allowed_for_current_session(uuid, uuid)
  to authenticated;
grant execute on function private.umpire_match_fixture_allowed_for_current_session(uuid)
  to authenticated;
grant execute on function private.umpire_match_submission_allowed_for_current_session(uuid)
  to authenticated;
grant execute on function private.umpire_match_submission_row_allowed_for_current_session(
  uuid, uuid, uuid, uuid, uuid
) to authenticated;

-- The public token route has been retired. Remove the legacy policies and
-- table privileges that exposed raw bearer tokens or allowed direct token
-- ballot writes. Signed-in Player MVP ballots continue through their existing
-- atomic RPC and authenticated ownership policies.
drop policy if exists "Public token lookup by value" on public.mvp_vote_tokens;
drop policy if exists "Verified token can submit votes" on public.mvp_votes;
revoke all privileges on table public.mvp_vote_tokens from anon;
revoke all privileges on table public.mvp_votes from anon;

-- These are empty, superseded legacy tables. Current app and Edge Function
-- searches find no runtime consumer; only the SECURITY DEFINER profile-merge
-- maintenance function still references the old Umpire tables. Retire their
-- browser access instead of adding feature gates to a dead data path.
drop policy if exists "mvp_tokens_public_read" on public.mvp_tokens;
drop policy if exists "mvp_tokens_public_update" on public.mvp_tokens;
drop policy if exists "umpire_subs_insert" on public.umpire_vote_submissions;
drop policy if exists "umpire_subs_read" on public.umpire_vote_submissions;
drop policy if exists "umpire_lines_insert" on public.umpire_vote_lines;
drop policy if exists "umpire_lines_read" on public.umpire_vote_lines;
drop policy if exists "umpire_edits_read" on public.umpire_vote_edits;

revoke all privileges on table public.mvp_tokens
  from public, anon, authenticated;
revoke all privileges on table public.umpire_vote_submissions
  from public, anon, authenticated;
revoke all privileges on table public.umpire_vote_lines
  from public, anon, authenticated;
revoke all privileges on table public.umpire_vote_edits
  from public, anon, authenticated;

-- Restrictive policies are ANDed with every existing permissive business-role
-- policy. They do not replace ownership or manager checks. The anonymous token
-- and vote policies are retained only as defence in depth if a future migration
-- deliberately restores table privileges; by themselves they grant no access.
drop policy if exists "Module gate: public Player MVP sessions" on public.mvp_voting_sessions;
create policy "Module gate: public Player MVP sessions"
on public.mvp_voting_sessions
as restrictive
for all
to anon
using (public.player_mvp_public_session_enabled(id))
with check (public.player_mvp_public_session_row_enabled(fixture_id, team_id));

drop policy if exists "Module gate: public Player MVP tokens" on public.mvp_vote_tokens;
create policy "Module gate: public Player MVP tokens"
on public.mvp_vote_tokens
as restrictive
for all
to anon
using (public.player_mvp_public_session_enabled(session_id))
with check (public.player_mvp_public_session_enabled(session_id));

drop policy if exists "Module gate: public Player MVP votes" on public.mvp_votes;
create policy "Module gate: public Player MVP votes"
on public.mvp_votes
as restrictive
for all
to anon
using (public.player_mvp_public_vote_enabled(session_id, token_id))
with check (public.player_mvp_public_vote_enabled(session_id, token_id));

drop policy if exists "Module gate: signed-in Player MVP sessions" on public.mvp_voting_sessions;
create policy "Module gate: signed-in Player MVP sessions"
on public.mvp_voting_sessions
as restrictive
for all
to authenticated
using (private.player_mvp_session_allowed_for_current_session(id))
with check (private.player_mvp_session_row_allowed_for_current_session(fixture_id, team_id));

drop policy if exists "Module gate: signed-in Player MVP tokens" on public.mvp_vote_tokens;
create policy "Module gate: signed-in Player MVP tokens"
on public.mvp_vote_tokens
as restrictive
for all
to authenticated
using (private.player_mvp_session_allowed_for_current_session(session_id))
with check (private.player_mvp_session_allowed_for_current_session(session_id));

drop policy if exists "Module gate: signed-in Player MVP votes" on public.mvp_votes;
create policy "Module gate: signed-in Player MVP votes"
on public.mvp_votes
as restrictive
for all
to authenticated
using (private.player_mvp_vote_allowed_for_current_session(session_id, token_id))
with check (private.player_mvp_vote_allowed_for_current_session(session_id, token_id));

drop policy if exists "Module gate: signed-in Player MVP submissions" on public.mvp_vote_submissions;
create policy "Module gate: signed-in Player MVP submissions"
on public.mvp_vote_submissions
as restrictive
for all
to authenticated
using (private.player_mvp_session_allowed_for_current_session(session_id))
with check (private.player_mvp_session_allowed_for_current_session(session_id));

drop policy if exists "Module gate: signed-in Player MVP audit" on public.mvp_vote_audit;
create policy "Module gate: signed-in Player MVP audit"
on public.mvp_vote_audit
as restrictive
for all
to authenticated
using (
  case
    when session_id is not null then private.player_mvp_session_allowed_for_current_session(session_id)
    when team_id is not null then private.player_mvp_team_allowed_for_current_session(team_id, null)
    else false
  end
)
with check (
  case
    when session_id is not null then private.player_mvp_session_allowed_for_current_session(session_id)
    when team_id is not null then private.player_mvp_team_allowed_for_current_session(team_id, null)
    else false
  end
);

drop policy if exists "Module gate: signed-in Player MVP result checks" on public.mvp_result_checks;
create policy "Module gate: signed-in Player MVP result checks"
on public.mvp_result_checks
as restrictive
for all
to authenticated
using (private.player_mvp_session_allowed_for_current_session(session_id))
with check (private.player_mvp_session_allowed_for_current_session(session_id));

drop policy if exists "Module gate: signed-in Player MVP email events" on public.mvp_voting_email_events;
create policy "Module gate: signed-in Player MVP email events"
on public.mvp_voting_email_events
as restrictive
for all
to authenticated
using (private.player_mvp_session_allowed_for_current_session(session_id))
with check (private.player_mvp_session_allowed_for_current_session(session_id));

drop policy if exists "Module gate: signed-in Umpire Match submissions" on public.player_vote_submissions;
create policy "Module gate: signed-in Umpire Match submissions"
on public.player_vote_submissions
as restrictive
for all
to authenticated
using (private.umpire_match_submission_allowed_for_current_session(id))
with check (
  private.umpire_match_submission_row_allowed_for_current_session(
    fixture_id,
    association_id,
    division_id,
    home_team_id,
    away_team_id
  )
);

drop policy if exists "Module gate: signed-in Umpire Match lines" on public.player_vote_lines;
create policy "Module gate: signed-in Umpire Match lines"
on public.player_vote_lines
as restrictive
for all
to authenticated
using (private.umpire_match_submission_allowed_for_current_session(submission_id))
with check (private.umpire_match_submission_allowed_for_current_session(submission_id));

drop policy if exists "Module gate: signed-in Umpire Match edits" on public.player_vote_edits;
create policy "Module gate: signed-in Umpire Match edits"
on public.player_vote_edits
as restrictive
for all
to authenticated
using (private.umpire_match_submission_allowed_for_current_session(submission_id))
with check (private.umpire_match_submission_allowed_for_current_session(submission_id));

-- Preserve each established business rule by renaming the existing function
-- and placing a narrow module guard in front of it. Only the wrapper is
-- callable by a browser role.
alter function public.set_team_mvp_enabled(uuid, boolean)
  rename to set_team_mvp_enabled_module_impl_20260802115000;
alter function public.set_team_mvp_notifications_enabled(uuid, boolean)
  rename to set_team_mvp_notifications_enabled_module_impl_20260802115000;
alter function public.open_mvp_voting_session(uuid, uuid, timestamptz)
  rename to open_mvp_voting_session_module_impl_20260802115000;
alter function public.close_mvp_voting_session(uuid)
  rename to close_mvp_voting_session_module_impl_20260802115000;
alter function public.reopen_mvp_voting_session(uuid, timestamptz)
  rename to reopen_mvp_voting_session_module_impl_20260802115000;
alter function public.record_mvp_result_check(uuid, text, text)
  rename to record_mvp_result_check_module_impl_20260802115000;
alter function public.resolve_mvp_result_dispute(uuid, timestamptz)
  rename to resolve_mvp_result_dispute_module_impl_20260802115000;
alter function public.submit_mvp_ballot(uuid, uuid, uuid, uuid, text)
  rename to submit_mvp_ballot_module_impl_20260802115000;
alter function public.request_mvp_session_reopen(uuid)
  rename to request_mvp_session_reopen_module_impl_20260802115000;
alter function public.withdraw_mvp_submission(uuid, uuid, text)
  rename to withdraw_mvp_submission_module_impl_20260802115000;
alter function public.get_mvp_result_check_state(uuid)
  rename to get_mvp_result_check_state_module_impl_20260802115000;
alter function public.get_mvp_session_results(uuid)
  rename to get_mvp_session_results_module_impl_20260802115000;
alter function public.submit_umpire_match_vote(uuid, text, jsonb, text, text)
  rename to submit_umpire_match_vote_module_impl_20260802115000;
alter function public.review_umpire_vote_submission(uuid, text, jsonb)
  rename to review_umpire_vote_submission_module_impl_20260802115000;

create or replace function public.set_team_mvp_enabled(
  p_team_id uuid,
  p_enabled boolean
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $function$
begin
  if not private.voting_request_is_service_role()
     and not private.player_mvp_team_allowed_for_current_session(p_team_id, null) then
    raise exception using errcode = '42501', message = 'PLAYER_MVP_MODULE_DISABLED';
  end if;
  return public.set_team_mvp_enabled_module_impl_20260802115000(p_team_id, p_enabled);
end;
$function$;

create or replace function public.set_team_mvp_notifications_enabled(
  p_team_id uuid,
  p_enabled boolean
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $function$
begin
  if not private.voting_request_is_service_role()
     and not private.player_mvp_team_allowed_for_current_session(p_team_id, null) then
    raise exception using errcode = '42501', message = 'PLAYER_MVP_MODULE_DISABLED';
  end if;
  return public.set_team_mvp_notifications_enabled_module_impl_20260802115000(
    p_team_id,
    p_enabled
  );
end;
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
set search_path = ''
as $function$
begin
  if not private.voting_request_is_service_role()
     and not private.player_mvp_fixture_team_allowed_for_current_session(p_fixture_id, p_team_id) then
    raise exception using errcode = '42501', message = 'PLAYER_MVP_MODULE_DISABLED';
  end if;
  return public.open_mvp_voting_session_module_impl_20260802115000(
    p_fixture_id,
    p_team_id,
    p_closes_at
  );
end;
$function$;

create or replace function public.close_mvp_voting_session(p_session_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $function$
begin
  if not private.voting_request_is_service_role()
     and not private.player_mvp_session_allowed_for_current_session(p_session_id) then
    raise exception using errcode = '42501', message = 'PLAYER_MVP_MODULE_DISABLED';
  end if;
  return public.close_mvp_voting_session_module_impl_20260802115000(p_session_id);
end;
$function$;

create or replace function public.reopen_mvp_voting_session(
  p_session_id uuid,
  p_closes_at timestamptz default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $function$
begin
  if not private.voting_request_is_service_role()
     and not private.player_mvp_session_allowed_for_current_session(p_session_id) then
    raise exception using errcode = '42501', message = 'PLAYER_MVP_MODULE_DISABLED';
  end if;
  return public.reopen_mvp_voting_session_module_impl_20260802115000(
    p_session_id,
    p_closes_at
  );
end;
$function$;

create or replace function public.record_mvp_result_check(
  p_session_id uuid,
  p_response text,
  p_comment text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $function$
begin
  if not private.voting_request_is_service_role()
     and not private.player_mvp_session_allowed_for_current_session(p_session_id) then
    raise exception using errcode = '42501', message = 'PLAYER_MVP_MODULE_DISABLED';
  end if;
  return public.record_mvp_result_check_module_impl_20260802115000(
    p_session_id,
    p_response,
    p_comment
  );
end;
$function$;

create or replace function public.resolve_mvp_result_dispute(
  p_session_id uuid,
  p_closes_at timestamptz default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $function$
begin
  if not private.voting_request_is_service_role()
     and not private.player_mvp_session_allowed_for_current_session(p_session_id) then
    raise exception using errcode = '42501', message = 'PLAYER_MVP_MODULE_DISABLED';
  end if;
  return public.resolve_mvp_result_dispute_module_impl_20260802115000(
    p_session_id,
    p_closes_at
  );
end;
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
set search_path = ''
as $function$
begin
  if not private.voting_request_is_service_role()
     and not private.player_mvp_session_allowed_for_current_session(p_session_id) then
    raise exception using errcode = '42501', message = 'PLAYER_MVP_MODULE_DISABLED';
  end if;
  return public.submit_mvp_ballot_module_impl_20260802115000(
    p_session_id,
    p_three_point_player_id,
    p_two_point_player_id,
    p_one_point_player_id,
    p_shoutout
  );
end;
$function$;

create or replace function public.request_mvp_session_reopen(p_session_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $function$
begin
  if not private.voting_request_is_service_role()
     and not private.player_mvp_session_allowed_for_current_session(p_session_id) then
    raise exception using errcode = '42501', message = 'PLAYER_MVP_MODULE_DISABLED';
  end if;
  return public.request_mvp_session_reopen_module_impl_20260802115000(p_session_id);
end;
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
set search_path = ''
as $function$
begin
  if not private.voting_request_is_service_role()
     and not private.player_mvp_session_allowed_for_current_session(p_session_id) then
    raise exception using errcode = '42501', message = 'PLAYER_MVP_MODULE_DISABLED';
  end if;
  return public.withdraw_mvp_submission_module_impl_20260802115000(
    p_session_id,
    p_voter_profile_id,
    p_reason
  );
end;
$function$;

create or replace function public.get_mvp_result_check_state(p_session_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
begin
  if not private.voting_request_is_service_role()
     and not private.player_mvp_session_allowed_for_current_session(p_session_id) then
    raise exception using errcode = '42501', message = 'PLAYER_MVP_MODULE_DISABLED';
  end if;
  return public.get_mvp_result_check_state_module_impl_20260802115000(p_session_id);
end;
$function$;

create or replace function public.get_mvp_session_results(p_session_id uuid)
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
set search_path = ''
as $function$
begin
  if not private.voting_request_is_service_role()
     and not private.player_mvp_session_allowed_for_current_session(p_session_id) then
    raise exception using errcode = '42501', message = 'PLAYER_MVP_MODULE_DISABLED';
  end if;
  return query
  select result_row.player_id,
         result_row.player_name,
         result_row.profile_id,
         result_row.points,
         result_row.vote_count
  from public.get_mvp_session_results_module_impl_20260802115000(p_session_id) result_row;
end;
$function$;

create or replace function public.submit_umpire_match_vote(
  p_fixture_id uuid,
  p_vote_scheme_key text,
  p_lines jsonb,
  p_proxy_umpire_name text default null,
  p_proxy_reason text default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $function$
begin
  if not private.voting_request_is_service_role()
     and not private.umpire_match_fixture_allowed_for_current_session(p_fixture_id) then
    raise exception using errcode = '42501', message = 'UMPIRE_MATCH_VOTING_MODULE_DISABLED';
  end if;
  return public.submit_umpire_match_vote_module_impl_20260802115000(
    p_fixture_id,
    p_vote_scheme_key,
    p_lines,
    p_proxy_umpire_name,
    p_proxy_reason
  );
end;
$function$;

create or replace function public.review_umpire_vote_submission(
  p_submission_id uuid,
  p_action text,
  p_lines jsonb default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $function$
begin
  if not private.voting_request_is_service_role()
     and not private.umpire_match_submission_allowed_for_current_session(p_submission_id) then
    raise exception using errcode = '42501', message = 'UMPIRE_MATCH_VOTING_MODULE_DISABLED';
  end if;
  return public.review_umpire_vote_submission_module_impl_20260802115000(
    p_submission_id,
    p_action,
    p_lines
  );
end;
$function$;

revoke all on function public.set_team_mvp_enabled_module_impl_20260802115000(uuid, boolean)
  from public, anon, authenticated;
revoke all on function public.set_team_mvp_notifications_enabled_module_impl_20260802115000(uuid, boolean)
  from public, anon, authenticated;
revoke all on function public.open_mvp_voting_session_module_impl_20260802115000(uuid, uuid, timestamptz)
  from public, anon, authenticated;
revoke all on function public.close_mvp_voting_session_module_impl_20260802115000(uuid)
  from public, anon, authenticated;
revoke all on function public.reopen_mvp_voting_session_module_impl_20260802115000(uuid, timestamptz)
  from public, anon, authenticated;
revoke all on function public.record_mvp_result_check_module_impl_20260802115000(uuid, text, text)
  from public, anon, authenticated;
revoke all on function public.resolve_mvp_result_dispute_module_impl_20260802115000(uuid, timestamptz)
  from public, anon, authenticated;
revoke all on function public.submit_mvp_ballot_module_impl_20260802115000(uuid, uuid, uuid, uuid, text)
  from public, anon, authenticated;
revoke all on function public.request_mvp_session_reopen_module_impl_20260802115000(uuid)
  from public, anon, authenticated;
revoke all on function public.withdraw_mvp_submission_module_impl_20260802115000(uuid, uuid, text)
  from public, anon, authenticated;
revoke all on function public.get_mvp_result_check_state_module_impl_20260802115000(uuid)
  from public, anon, authenticated;
revoke all on function public.get_mvp_session_results_module_impl_20260802115000(uuid)
  from public, anon, authenticated;
revoke all on function public.submit_umpire_match_vote_module_impl_20260802115000(uuid, text, jsonb, text, text)
  from public, anon, authenticated;
revoke all on function public.review_umpire_vote_submission_module_impl_20260802115000(uuid, text, jsonb)
  from public, anon, authenticated;

grant execute on function public.set_team_mvp_enabled_module_impl_20260802115000(uuid, boolean)
  to service_role;
grant execute on function public.set_team_mvp_notifications_enabled_module_impl_20260802115000(uuid, boolean)
  to service_role;
grant execute on function public.open_mvp_voting_session_module_impl_20260802115000(uuid, uuid, timestamptz)
  to service_role;
grant execute on function public.close_mvp_voting_session_module_impl_20260802115000(uuid)
  to service_role;
grant execute on function public.reopen_mvp_voting_session_module_impl_20260802115000(uuid, timestamptz)
  to service_role;
grant execute on function public.record_mvp_result_check_module_impl_20260802115000(uuid, text, text)
  to service_role;
grant execute on function public.resolve_mvp_result_dispute_module_impl_20260802115000(uuid, timestamptz)
  to service_role;
grant execute on function public.submit_mvp_ballot_module_impl_20260802115000(uuid, uuid, uuid, uuid, text)
  to service_role;
grant execute on function public.request_mvp_session_reopen_module_impl_20260802115000(uuid)
  to service_role;
grant execute on function public.withdraw_mvp_submission_module_impl_20260802115000(uuid, uuid, text)
  to service_role;
grant execute on function public.get_mvp_result_check_state_module_impl_20260802115000(uuid)
  to service_role;
grant execute on function public.get_mvp_session_results_module_impl_20260802115000(uuid)
  to service_role;
grant execute on function public.submit_umpire_match_vote_module_impl_20260802115000(uuid, text, jsonb, text, text)
  to service_role;
grant execute on function public.review_umpire_vote_submission_module_impl_20260802115000(uuid, text, jsonb)
  to service_role;

revoke all on function public.set_team_mvp_enabled(uuid, boolean)
  from public, anon, authenticated;
revoke all on function public.set_team_mvp_notifications_enabled(uuid, boolean)
  from public, anon, authenticated;
revoke all on function public.open_mvp_voting_session(uuid, uuid, timestamptz)
  from public, anon, authenticated;
revoke all on function public.close_mvp_voting_session(uuid)
  from public, anon, authenticated;
revoke all on function public.reopen_mvp_voting_session(uuid, timestamptz)
  from public, anon, authenticated;
revoke all on function public.record_mvp_result_check(uuid, text, text)
  from public, anon, authenticated;
revoke all on function public.resolve_mvp_result_dispute(uuid, timestamptz)
  from public, anon, authenticated;
revoke all on function public.submit_mvp_ballot(uuid, uuid, uuid, uuid, text)
  from public, anon, authenticated;
revoke all on function public.request_mvp_session_reopen(uuid)
  from public, anon, authenticated;
revoke all on function public.withdraw_mvp_submission(uuid, uuid, text)
  from public, anon, authenticated;
revoke all on function public.get_mvp_result_check_state(uuid)
  from public, anon, authenticated;
revoke all on function public.get_mvp_session_results(uuid)
  from public, anon, authenticated;
revoke all on function public.submit_umpire_match_vote(uuid, text, jsonb, text, text)
  from public, anon, authenticated;
revoke all on function public.review_umpire_vote_submission(uuid, text, jsonb)
  from public, anon, authenticated;

grant execute on function public.set_team_mvp_enabled(uuid, boolean)
  to authenticated, service_role;
grant execute on function public.set_team_mvp_notifications_enabled(uuid, boolean)
  to authenticated, service_role;
grant execute on function public.open_mvp_voting_session(uuid, uuid, timestamptz)
  to authenticated, service_role;
grant execute on function public.close_mvp_voting_session(uuid)
  to authenticated, service_role;
grant execute on function public.reopen_mvp_voting_session(uuid, timestamptz)
  to authenticated, service_role;
grant execute on function public.record_mvp_result_check(uuid, text, text)
  to authenticated, service_role;
grant execute on function public.resolve_mvp_result_dispute(uuid, timestamptz)
  to authenticated, service_role;
grant execute on function public.submit_mvp_ballot(uuid, uuid, uuid, uuid, text)
  to authenticated, service_role;
grant execute on function public.request_mvp_session_reopen(uuid)
  to authenticated, service_role;
grant execute on function public.withdraw_mvp_submission(uuid, uuid, text)
  to authenticated, service_role;
grant execute on function public.get_mvp_result_check_state(uuid)
  to authenticated, service_role;
grant execute on function public.get_mvp_session_results(uuid)
  to authenticated, service_role;
grant execute on function public.submit_umpire_match_vote(uuid, text, jsonb, text, text)
  to authenticated, service_role;
grant execute on function public.review_umpire_vote_submission(uuid, text, jsonb)
  to authenticated, service_role;

-- The bulk cutover helper has no browser scope and must remain service-only.
revoke all on function public.close_legacy_mvp_sessions_for_cutover(text)
  from public, anon, authenticated;
grant execute on function public.close_legacy_mvp_sessions_for_cutover(text)
  to service_role;

comment on function public.current_session_can_access_voting_module(
  text, uuid, uuid, uuid, uuid
) is
  'Authenticated Edge Function gate for Player MVP and Umpire Match Voting using the caller live session mode.';
