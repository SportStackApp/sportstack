-- Submit a signed-in Umpire Match Voting ballot in one transaction.
-- The function derives fixture scope from the live fixture and validates the
-- scheme, teams and actor before writing either the header or vote lines.

create or replace function public.submit_umpire_match_vote(
  p_fixture_id uuid,
  p_vote_scheme_key text,
  p_lines jsonb,
  p_proxy_umpire_name text default null,
  p_proxy_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor_id uuid := auth.uid();
  v_submission_id uuid;
  v_association_id uuid;
  v_division_id uuid;
  v_round_number integer;
  v_home_team_id uuid;
  v_away_team_id uuid;
  v_fixture_status text;
  v_proxy_umpire_name text := nullif(btrim(p_proxy_umpire_name), '');
  v_proxy_reason text := nullif(btrim(p_proxy_reason), '');
begin
  if v_actor_id is null then
    raise exception 'You must be signed in to submit Umpire Match Voting.';
  end if;

  select
    division.association_id,
    fixture.division_id,
    fixture.round_number,
    fixture.home_team_id,
    fixture.away_team_id,
    fixture.status::text
  into
    v_association_id,
    v_division_id,
    v_round_number,
    v_home_team_id,
    v_away_team_id,
    v_fixture_status
  from public.fixtures fixture
  join public.divisions division on division.id = fixture.division_id
  where fixture.id = p_fixture_id;

  if not found then
    raise exception 'The selected fixture was not found.';
  end if;

  if v_fixture_status <> 'COMPLETED' then
    raise exception 'Umpire Match Voting is available only after the fixture is completed.';
  end if;

  if v_home_team_id is null or v_away_team_id is null then
    raise exception 'A bye or incomplete fixture cannot receive Umpire Match Voting.';
  end if;

  if not (
    exists (
      select 1
      from public.user_roles role_row
      where role_row.user_id = v_actor_id
        and role_row.role::text = 'SUPER_ADMIN'
    )
    or exists (
      select 1
      from public.user_roles role_row
      where role_row.user_id = v_actor_id
        and role_row.role::text in ('UMPIRE', 'UMPIRE_ADMIN')
        and (
          role_row.association_id is null
          or role_row.association_id = v_association_id
        )
    )
  ) then
    raise exception 'You do not have Umpire Match Voting access for this association.';
  end if;

  if (v_proxy_umpire_name is null) <> (v_proxy_reason is null) then
    raise exception 'Proxy umpire name and reason must be supplied together.';
  end if;

  if p_vote_scheme_key not in ('classic_3_2_1', 'junior_2_1_split') then
    raise exception 'The selected Umpire Match Voting scheme is not supported.';
  end if;

  if p_lines is null or jsonb_typeof(p_lines) <> 'array' then
    raise exception 'Umpire Match Voting lines must be supplied as an array.';
  end if;

  if (
    p_vote_scheme_key = 'classic_3_2_1'
    and (
      jsonb_array_length(p_lines) <> 3
      or exists (
        select 1
        from jsonb_array_elements(p_lines) line
        where not (
          (line->>'scheme_line_key' = 'best' and line->>'votes' = '3')
          or (line->>'scheme_line_key' = 'second' and line->>'votes' = '2')
          or (line->>'scheme_line_key' = 'third' and line->>'votes' = '1')
        )
      )
    )
  ) or (
    p_vote_scheme_key = 'junior_2_1_split'
    and (
      jsonb_array_length(p_lines) <> 4
      or exists (
        select 1
        from jsonb_array_elements(p_lines) line
        where not (
          (line->>'scheme_line_key' = 'best_male' and line->>'votes' = '2')
          or (line->>'scheme_line_key' = 'second_male' and line->>'votes' = '1')
          or (line->>'scheme_line_key' = 'best_female' and line->>'votes' = '2')
          or (line->>'scheme_line_key' = 'second_female' and line->>'votes' = '1')
        )
      )
    )
  ) then
    raise exception 'The Umpire Match Voting lines do not match the selected scheme.';
  end if;

  if exists (
    select 1
    from (
      select line->>'scheme_line_key' as scheme_line_key, count(*) as line_count
      from jsonb_array_elements(p_lines) line
      group by line->>'scheme_line_key'
    ) duplicate_scheme_line
    where duplicate_scheme_line.line_count > 1
  ) then
    raise exception 'Each Umpire Match Voting scheme line can be supplied only once.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_lines) line
    where nullif(line->>'team_id', '') is null
      or nullif(line->>'team_id', '')::uuid not in (v_home_team_id, v_away_team_id)
  ) then
    raise exception 'Every voted person must be assigned to one of the fixture teams.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_lines) line
    where nullif(btrim(coalesce(line->>'player_name', '')), '') is null
      and nullif(btrim(coalesce(line->>'player_number', '')), '') is null
  ) then
    raise exception 'Every vote line requires a player name or jersey number.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_lines) line
    where nullif(btrim(coalesce(line->>'player_number', '')), '') is not null
      and line->>'player_number' !~ '^[0-9]{1,3}$'
  ) then
    raise exception 'Jersey numbers must contain one to three digits.';
  end if;

  if exists (
    select 1
    from (
      select
        coalesce(
          nullif(line->>'profile_id', ''),
          lower(btrim(coalesce(line->>'player_name', '')))
            || '|' || coalesce(line->>'player_number', '')
            || '|' || coalesce(line->>'team_id', '')
        ) as player_identity,
        count(*) as vote_count
      from jsonb_array_elements(p_lines) line
      group by 1
    ) duplicate_player
    where duplicate_player.vote_count > 1
  ) then
    raise exception 'The same person cannot receive more than one vote line.';
  end if;

  -- Serialise duplicate checks for this actor and fixture without adding
  -- placeholder rows or holding a table lock.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_actor_id::text || ':' || p_fixture_id::text, 0)
  );

  if exists (
    select 1
    from public.player_vote_submissions existing
    where existing.fixture_id = p_fixture_id
      and existing.umpire_user_id = v_actor_id
      and not existing.is_deleted
      and (
        (v_proxy_umpire_name is null and existing.proxy_umpire_name is null)
        or (
          v_proxy_umpire_name is not null
          and lower(btrim(existing.proxy_umpire_name)) = lower(v_proxy_umpire_name)
        )
      )
  ) then
    raise exception 'This Umpire Match Voting ballot has already been submitted.';
  end if;

  insert into public.player_vote_submissions (
    fixture_id,
    association_id,
    division_id,
    round_number,
    home_team_id,
    away_team_id,
    umpire_user_id,
    is_approved,
    submitted_at,
    proxy_umpire_name,
    proxy_reason,
    vote_scheme_key
  )
  values (
    p_fixture_id,
    v_association_id,
    v_division_id,
    v_round_number,
    v_home_team_id,
    v_away_team_id,
    v_actor_id,
    false,
    now(),
    v_proxy_umpire_name,
    v_proxy_reason,
    p_vote_scheme_key
  )
  returning id into v_submission_id;

  insert into public.player_vote_lines (
    submission_id,
    profile_id,
    player_name,
    player_number,
    team_id,
    votes,
    scheme_line_key
  )
  select
    v_submission_id,
    nullif(line->>'profile_id', '')::uuid,
    btrim(coalesce(line->>'player_name', '')),
    nullif(btrim(coalesce(line->>'player_number', '')), '')::integer,
    (line->>'team_id')::uuid,
    (line->>'votes')::integer,
    line->>'scheme_line_key'
  from jsonb_array_elements(p_lines) line;

  return v_submission_id;
end;
$function$;

revoke all on function public.submit_umpire_match_vote(uuid, text, jsonb, text, text)
  from public, anon;
grant execute on function public.submit_umpire_match_vote(uuid, text, jsonb, text, text)
  to authenticated;

-- Browser users must use the validated atomic function. Scoped administrators
-- retain their existing read/update paths, while the public portal continues
-- through its service-role-only atomic function.
revoke insert on public.player_vote_submissions from authenticated;
revoke insert on public.player_vote_lines from authenticated;

comment on function public.submit_umpire_match_vote(uuid, text, jsonb, text, text) is
  'Atomically validates and records one signed-in Umpire Match Voting ballot.';
