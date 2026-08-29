-- Player MVP deadline closure and tally presentation refinements.
-- This migration is additive and preserves existing published presentation snapshots.

alter table public.mvp_tally_presentations
  drop constraint mvp_tally_presentations_playback_speed_check;
alter table public.mvp_tally_presentations
  alter column playback_speed type numeric(4,2) using playback_speed::numeric(4,2);
alter table public.mvp_tally_presentations
  add constraint mvp_tally_presentations_playback_speed_check
  check (playback_speed in (0.5, 1, 1.5, 2, 3, 4, 5, 7.5, 10));

alter table public.mvp_tally_presentations
  add column commentary_snapshot jsonb;
alter table public.mvp_tally_presentations
  add constraint mvp_tally_presentations_commentary_snapshot_check
  check (commentary_snapshot is null or jsonb_typeof(commentary_snapshot) = 'object');

comment on column public.mvp_tally_presentations.commentary_snapshot is
  'Versioned positive round commentary saved with the immutable presentation snapshot.';

create or replace function private.close_due_mvp_voting_sessions()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.mvp_voting_sessions%rowtype;
  v_old jsonb;
  v_new jsonb;
  v_has_concern boolean;
  v_closed integer := 0;
  v_disputed integer := 0;
begin
  for v_session in
    select session.*
    from public.mvp_voting_sessions session
    where session.status = 'OPEN'::public.mvp_session_status
      and session.closes_at is not null
      and session.closes_at <= now()
    order by session.closes_at, session.id
    for update skip locked
  loop
    v_old := to_jsonb(v_session);
    select exists (
      select 1
      from public.mvp_result_checks result_check
      where result_check.session_id = v_session.id
        and result_check.result_check_round = v_session.result_check_round
        and result_check.response = 'INCORRECT'
    ) into v_has_concern;

    if v_has_concern then
      update public.mvp_voting_sessions session
      set status = 'RESULT_DISPUTED'::public.mvp_session_status
      where session.id = v_session.id
      returning to_jsonb(session) into v_new;

      insert into public.mvp_vote_audit(
        session_id, changed_by, action, old_data, new_data, reason, team_id, details
      ) values (
        v_session.id, null, 'SESSION_STATUS_CHANGED', v_old, v_new,
        'RESULT_DISPUTED_AT_DEADLINE', v_session.team_id,
        jsonb_build_object('source', 'AUTOMATIC_DEADLINE_JOB', 'deadline', v_session.closes_at)
      );
      v_disputed := v_disputed + 1;
    else
      update public.mvp_voting_sessions session
      set status = 'CLOSED'::public.mvp_session_status,
        closed_at = v_session.closes_at,
        closed_by = null,
        locked_at = v_session.closes_at,
        locked_by = null,
        locked_reason = 'CLOSED_AT_DEADLINE'
      where session.id = v_session.id
      returning to_jsonb(session) into v_new;

      insert into public.mvp_vote_audit(
        session_id, changed_by, action, old_data, new_data, reason, team_id, details
      ) values (
        v_session.id, null, 'SESSION_STATUS_CHANGED', v_old, v_new,
        'CLOSED_AT_DEADLINE', v_session.team_id,
        jsonb_build_object('source', 'AUTOMATIC_DEADLINE_JOB', 'deadline', v_session.closes_at)
      );
      v_closed := v_closed + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'processed', v_closed + v_disputed,
    'closed', v_closed,
    'resultDisputed', v_disputed
  );
end;
$$;

create or replace function private.enforce_mvp_voting_deadline()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status public.mvp_session_status;
  v_closes_at timestamptz;
begin
  select session.status, session.closes_at
  into v_status, v_closes_at
  from public.mvp_voting_sessions session
  where session.id = new.session_id;

  if v_status is distinct from 'OPEN'::public.mvp_session_status then
    raise exception using errcode = 'P0001', message = 'MVP_SESSION_NOT_OPEN';
  end if;
  if v_closes_at is not null and v_closes_at <= clock_timestamp() then
    raise exception using errcode = 'P0001', message = 'MVP_SESSION_DEADLINE_PASSED';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_mvp_voting_deadline_on_votes on public.mvp_votes;
create trigger enforce_mvp_voting_deadline_on_votes
before insert or update on public.mvp_votes
for each row execute function private.enforce_mvp_voting_deadline();

drop trigger if exists enforce_mvp_voting_deadline_on_submissions on public.mvp_vote_submissions;
create trigger enforce_mvp_voting_deadline_on_submissions
before insert or update on public.mvp_vote_submissions
for each row execute function private.enforce_mvp_voting_deadline();

create or replace function private.mvp_tally_session_ballot_count(p_session_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  with counts as (
    select
      (select count(*)::integer from public.mvp_vote_submissions submission
        where submission.session_id = p_session_id) submission_count,
      (select count(distinct vote.voter_profile_id)::integer from public.mvp_votes vote
        where vote.session_id = p_session_id and vote.voter_profile_id is not null) profile_count,
      (select count(distinct vote.token_id)::integer from public.mvp_votes vote
        where vote.session_id = p_session_id and vote.token_id is not null) token_count,
      (select ceil(count(*)::numeric / 3)::integer from public.mvp_votes vote
        where vote.session_id = p_session_id
          and vote.voter_profile_id is null and vote.token_id is null) legacy_count
  )
  select greatest(submission_count, profile_count, token_count, legacy_count) from counts;
$$;

create or replace function private.mvp_tally_session_eligible_voter_count(p_session_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  with selected_session as (
    select session.fixture_id, session.team_id,
      case
        when fixture.home_team_id = session.team_id then 'home'
        when fixture.away_team_id = session.team_id then 'away'
        else null
      end team_side
    from public.mvp_voting_sessions session
    left join public.fixtures fixture on fixture.id = session.fixture_id
    where session.id = p_session_id
  ), eligible as (
    select player.profile_id
    from selected_session selected
    join public.revsports_players player on player.fixture_id = selected.fixture_id
      and player.team_side = selected.team_side
    where player.profile_id is not null
      and player.attended is true
      and coalesce(player.is_removed, false) is false
    union
    select fill_in.player_id
    from selected_session selected
    join public.fixture_fill_ins fill_in on fill_in.fixture_id = selected.fixture_id
      and fill_in.team_id = selected.team_id
      and fill_in.status = 'SELECTED'
  )
  select count(*)::integer from eligible;
$$;

create or replace function private.mvp_tally_asset_team_id(p_name text)
returns uuid
language plpgsql
immutable
security definer
set search_path = ''
as $$
declare
  v_folder text;
begin
  v_folder := (storage.foldername(p_name))[1];
  if v_folder is null or v_folder !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return null;
  end if;
  return v_folder::uuid;
exception when others then
  return null;
end;
$$;

create or replace function private.mvp_tally_asset_can_manage(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.mvp_can_manage_team((select auth.uid()), private.mvp_tally_asset_team_id(p_name));
$$;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values (
  'mvp-tally-assets',
  'mvp-tally-assets',
  true,
  2097152,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists mvp_tally_assets_manager_insert on storage.objects;
create policy mvp_tally_assets_manager_insert
on storage.objects for insert to authenticated
with check (
  bucket_id = 'mvp-tally-assets'
  and private.mvp_tally_asset_can_manage(name)
  and lower(storage.extension(name)) in ('png', 'jpg', 'jpeg', 'webp')
);

drop policy if exists mvp_tally_assets_manager_delete on storage.objects;
create policy mvp_tally_assets_manager_delete
on storage.objects for delete to authenticated
using (
  bucket_id = 'mvp-tally-assets'
  and private.mvp_tally_asset_can_manage(name)
  and not exists (
    select 1
    from public.mvp_tally_presentations presentation
    where presentation.status in ('SCHEDULED', 'PUBLISHED')
      and presentation.theme ->> 'logoStoragePath' = name
  )
);

create or replace function private.mvp_tally_source_fingerprint(p_presentation_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  with session_source as (
    select included.display_order,
      session.id,
      session.status::text,
      session.result_check_round,
      session.results_confirmed_at,
      coalesce(string_agg(
        concat_ws(':', vote.id::text, vote.player_id::text, vote.points::text,
          coalesce(vote.voter_profile_id::text, ''), coalesce(vote.token_id::text, ''),
          coalesce(vote.updated_at::text, vote.created_at::text, ''),
          coalesce(voted_player.profile_id::text, ''), coalesce(voted_player.player_name, ''),
          coalesce(profile.first_name, ''), coalesce(profile.last_name, '')),
        ',' order by vote.id
      ), '') vote_state,
      coalesce(string_agg(
        concat_ws(':', result_check.id::text, result_check.response,
          result_check.result_check_round::text, result_check.created_at::text),
        ',' order by result_check.id
      ) filter (where result_check.id is not null), '') result_check_state
    from public.mvp_tally_sessions included
    join public.mvp_voting_sessions session on session.id = included.session_id
    left join public.mvp_votes vote on vote.session_id = session.id
    left join public.revsports_players voted_player on voted_player.id = vote.player_id
    left join public.profiles profile on profile.id = voted_player.profile_id
    left join public.mvp_result_checks result_check
      on result_check.session_id = session.id
      and result_check.result_check_round = session.result_check_round
    where included.presentation_id = p_presentation_id
    group by included.display_order, session.id, session.status,
      session.result_check_round, session.results_confirmed_at
  ), recipient_source as (
    select coalesce(string_agg(
      recipient.profile_id::text || ':' || recipient.audience_group,
      ',' order by recipient.profile_id
    ), '') value
    from public.mvp_tally_recipients recipient
    where recipient.presentation_id = p_presentation_id
  )
  select md5(
    coalesce(string_agg(
      concat_ws('|', session_source.display_order::text, session_source.id::text,
        session_source.status, session_source.result_check_round::text,
        coalesce(session_source.results_confirmed_at::text, ''),
        session_source.vote_state, session_source.result_check_state),
      '||' order by session_source.display_order
    ), '') || '||recipients:' || (select value from recipient_source)
  )
  from session_source;
$$;

create or replace function private.mvp_tally_assert_source_ready(p_presentation_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_team_id uuid;
  v_session_count integer;
  v_recipient_count integer;
  v_ineligible_count integer;
begin
  select presentation.team_id into v_team_id
  from public.mvp_tally_presentations presentation
  where presentation.id = p_presentation_id;

  select count(*) into v_session_count
  from public.mvp_tally_sessions included
  where included.presentation_id = p_presentation_id;
  if v_session_count = 0 then
    raise exception using errcode = 'P0001', message = 'MVP_TALLY_ROUNDS_REQUIRED';
  end if;
  if exists (
    select 1
    from public.mvp_tally_sessions included
    join public.mvp_voting_sessions session on session.id = included.session_id
    where included.presentation_id = p_presentation_id
      and session.team_id is distinct from v_team_id
  ) then
    raise exception using errcode = 'P0001', message = 'MVP_TALLY_ROUND_WRONG_TEAM';
  end if;
  if exists (
    select 1
    from public.mvp_tally_sessions included
    join public.mvp_voting_sessions session on session.id = included.session_id
    where included.presentation_id = p_presentation_id
      and session.status is distinct from 'CLOSED'::public.mvp_session_status
  ) then
    raise exception using errcode = 'P0001', message = 'MVP_TALLY_ROUND_NOT_CLOSED';
  end if;
  if exists (
    select 1
    from public.mvp_tally_sessions included
    join public.mvp_voting_sessions session on session.id = included.session_id
    where included.presentation_id = p_presentation_id
      and exists (
        select 1 from public.mvp_result_checks result_check
        where result_check.session_id = session.id
          and result_check.result_check_round = session.result_check_round
          and result_check.response = 'INCORRECT'
      )
  ) then
    raise exception using errcode = 'P0001', message = 'MVP_TALLY_ROUND_RESULT_CONCERN';
  end if;
  if exists (
    select 1
    from public.mvp_tally_sessions included
    where included.presentation_id = p_presentation_id
      and private.mvp_tally_session_ballot_count(included.session_id) = 0
  ) then
    raise exception using errcode = 'P0001', message = 'MVP_TALLY_ROUND_NO_BALLOTS';
  end if;

  select count(*) into v_recipient_count
  from public.mvp_tally_recipients recipient
  where recipient.presentation_id = p_presentation_id;
  if v_recipient_count = 0 then
    raise exception using errcode = 'P0001', message = 'MVP_TALLY_AUDIENCE_REQUIRED';
  end if;

  select count(*) into v_ineligible_count
  from public.mvp_tally_recipients recipient
  where recipient.presentation_id = p_presentation_id
    and not (
      (
        recipient.audience_group = 'PRIMARY'
        and exists (
          select 1 from public.team_memberships membership
          where membership.team_id = v_team_id
            and membership.user_id = recipient.profile_id
            and membership.status::text = 'ACTIVE'
            and membership.membership_type::text in ('PRIMARY', 'PERMANENT')
        )
      )
      or (
        recipient.audience_group = 'SECONDARY'
        and exists (
          select 1 from public.team_memberships membership
          where membership.team_id = v_team_id
            and membership.user_id = recipient.profile_id
            and membership.status::text = 'ACTIVE'
            and membership.membership_type::text = 'SECONDARY'
        )
      )
      or (
        recipient.audience_group = 'FILL_IN'
        and (
          exists (
            select 1
            from public.mvp_tally_sessions included
            join public.mvp_voting_sessions session on session.id = included.session_id
            join public.fixtures fixture on fixture.id = session.fixture_id
            join public.revsports_players player on player.fixture_id = fixture.id
            where included.presentation_id = p_presentation_id
              and player.profile_id = recipient.profile_id
              and player.attended is true
              and player.is_fillin is true
              and ((fixture.home_team_id = v_team_id and player.team_side = 'home')
                or (fixture.away_team_id = v_team_id and player.team_side = 'away'))
          )
          or exists (
            select 1
            from public.mvp_tally_sessions included
            join public.mvp_voting_sessions session on session.id = included.session_id
            join public.fixture_fill_ins fill_in on fill_in.fixture_id = session.fixture_id
              and fill_in.team_id = v_team_id
              and fill_in.player_id = recipient.profile_id
              and fill_in.status = 'SELECTED'
            where included.presentation_id = p_presentation_id
          )
        )
      )
    );
  if v_ineligible_count > 0 then
    raise exception using errcode = 'P0001', message = 'MVP_TALLY_AUDIENCE_CHANGED';
  end if;
end;
$$;

create or replace function private.mvp_tally_build_cards(p_presentation_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with included as (
    select link.display_order, session.*
    from public.mvp_tally_sessions link
    join public.mvp_voting_sessions session on session.id = link.session_id
    where link.presentation_id = p_presentation_id
  ), raw_cards as (
    select included.display_order,
      included.id session_id,
      coalesce(nullif(included.round, ''), 'Round ' || included.display_order::text) round_label,
      included.game_date,
      concat_ws(' v ', included.home_team, included.away_team) match_label,
      vote.id vote_id,
      vote.points,
      player.profile_id,
      case when player.profile_id is not null
        then coalesce(nullif(btrim(concat_ws(' ', profile.first_name, profile.last_name)), ''), player.player_name)
        else player.player_name
      end player_name,
      profile.avatar_url,
      coalesce(submission.id::text, vote.token_id::text,
        vote.voter_profile_id::text, 'legacy-' || vote.id::text) ballot_key
    from included
    join public.mvp_votes vote on vote.session_id = included.id
    join public.revsports_players player on player.id = vote.player_id
    left join public.profiles profile on profile.id = player.profile_id
    left join public.mvp_vote_submissions submission
      on submission.session_id = vote.session_id
      and submission.voter_profile_id = vote.voter_profile_id
    where vote.points in (1, 2, 3)
  ), ordered_cards as (
    select raw_cards.*,
      row_number() over (
        partition by raw_cards.session_id
        order by md5(p_presentation_id::text || ':' || raw_cards.session_id::text || ':' || raw_cards.ballot_key),
          raw_cards.points desc, raw_cards.vote_id
      ) card_order
    from raw_cards
  ), round_cards as (
    select display_order, session_id, round_label, game_date, match_label,
      jsonb_agg(jsonb_build_object(
        'cardId', display_order::text || '-' || card_order::text,
        'points', points,
        'playerKey', coalesce(profile_id::text, 'unlinked:' || lower(btrim(player_name))),
        'playerId', profile_id,
        'playerName', player_name,
        'avatarUrl', avatar_url,
        'linked', profile_id is not null
      ) order by card_order) cards
    from ordered_cards
    group by display_order, session_id, round_label, game_date, match_label
  )
  select jsonb_build_object(
    'version', 1,
    'rounds', coalesce(jsonb_agg(jsonb_build_object(
      'sessionId', session_id,
      'roundLabel', round_label,
      'gameDate', game_date,
      'matchLabel', match_label,
      'cards', cards
    ) order by display_order), '[]'::jsonb)
  )
  from round_cards;
$$;

create or replace function private.mvp_tally_build_results(p_presentation_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with totals as (
    select coalesce(player.profile_id::text, 'unlinked:' || lower(btrim(player.player_name))) player_key,
      player.profile_id,
      max(case when player.profile_id is not null
        then coalesce(nullif(btrim(concat_ws(' ', profile.first_name, profile.last_name)), ''), player.player_name)
        else player.player_name
      end) player_name,
      max(profile.avatar_url) avatar_url,
      sum(vote.points)::integer total_points
    from public.mvp_tally_sessions included
    join public.mvp_votes vote on vote.session_id = included.session_id
    join public.revsports_players player on player.id = vote.player_id
    left join public.profiles profile on profile.id = player.profile_id
    where included.presentation_id = p_presentation_id
    group by coalesce(player.profile_id::text, 'unlinked:' || lower(btrim(player.player_name))), player.profile_id
  ), ranked as (
    select totals.*, dense_rank() over (order by total_points desc)::integer shared_rank
    from totals
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'playerKey', player_key,
    'playerId', profile_id,
    'playerName', player_name,
    'avatarUrl', avatar_url,
    'linked', profile_id is not null,
    'points', total_points,
    'rank', shared_rank
  ) order by shared_rank, player_name), '[]'::jsonb)
  from ranked;
$$;

create or replace function public.get_mvp_tally_builder_data(
  p_team_id uuid,
  p_session_ids uuid[] default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_result jsonb;
begin
  if v_user_id is null or not private.mvp_can_manage_team(v_user_id, p_team_id) then
    raise exception using errcode = '42501', message = 'Player MVP team-management permission required';
  end if;

  perform private.close_due_mvp_voting_sessions();

  select jsonb_build_object(
    'branding', jsonb_build_object(
      'teamId', team.id,
      'teamName', team.name,
      'logoUrl', coalesce(team.logo_url, club.logo_url, association.logo_url),
      'bannerUrl', coalesce(team.banner_url, club.banner_url, association.banner_url),
      'primaryColour', coalesce(team.primary_colour, club.primary_colour, association.primary_colour, '#6D28D9'),
      'secondaryColour', coalesce(team.secondary_colour, club.secondary_colour, association.secondary_colour, '#1E1B4B'),
      'accentColour', '#F5C84C'
    ),
    'sessions', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', session.id,
        'round', coalesce(nullif(session.round, ''), 'Round'),
        'gameDate', session.game_date,
        'homeTeam', session.home_team,
        'awayTeam', session.away_team,
        'status', case when stats.has_concern then 'RESULT_CONCERN' else session.status::text end,
        'selectable', session.status = 'CLOSED'::public.mvp_session_status
          and not stats.has_concern and stats.ballots_received > 0,
        'ballotsReceived', stats.ballots_received,
        'eligibleVoterCount', stats.eligible_voters,
        'unselectableReason', case
          when stats.has_concern then 'Resolve the incorrect-result concern first.'
          when session.status = 'PENDING'::public.mvp_session_status then 'Voting has not opened.'
          when session.status = 'OPEN'::public.mvp_session_status then 'Voting is still open.'
          when stats.ballots_received = 0 then 'No ballots were received.'
          else null
        end,
        'unlinkedCount', stats.unlinked_count
      ) order by
        coalesce(fixture.round_number, nullif(substring(session.round from '([0-9]+)'), '')::integer, 2147483647),
        session.game_date nulls last, session.created_at, session.id), '[]'::jsonb)
      from public.mvp_voting_sessions session
      left join public.fixtures fixture on fixture.id = session.fixture_id
      cross join lateral (
        select
          private.mvp_tally_session_ballot_count(session.id) ballots_received,
          private.mvp_tally_session_eligible_voter_count(session.id) eligible_voters,
          exists (
            select 1 from public.mvp_result_checks result_check
            where result_check.session_id = session.id
              and result_check.result_check_round = session.result_check_round
              and result_check.response = 'INCORRECT'
          ) has_concern,
          (
            select count(distinct vote.player_id)::integer
            from public.mvp_votes vote
            join public.revsports_players player on player.id = vote.player_id
            where vote.session_id = session.id and player.profile_id is null
          ) unlinked_count
      ) stats
      where session.team_id = p_team_id
    ),
    'audience', (
      with member_rows as (
        select membership.user_id profile_id,
          case when membership.membership_type::text = 'SECONDARY' then 'SECONDARY' else 'PRIMARY' end audience_group
        from public.team_memberships membership
        where membership.team_id = p_team_id
          and membership.status::text = 'ACTIVE'
          and membership.membership_type::text in ('PRIMARY', 'PERMANENT', 'SECONDARY')
      ), fill_in_rows as (
        select distinct player.profile_id, 'FILL_IN'::text audience_group
        from public.mvp_voting_sessions session
        join public.fixtures fixture on fixture.id = session.fixture_id
        join public.revsports_players player on player.fixture_id = fixture.id
        where session.team_id = p_team_id
          and (p_session_ids is null or session.id = any(p_session_ids))
          and player.profile_id is not null
          and player.attended is true
          and player.is_fillin is true
          and ((fixture.home_team_id = p_team_id and player.team_side = 'home')
            or (fixture.away_team_id = p_team_id and player.team_side = 'away'))
      ), selected_fill_ins as (
        select distinct fill_in.player_id profile_id, 'FILL_IN'::text audience_group
        from public.mvp_voting_sessions session
        join public.fixture_fill_ins fill_in on fill_in.fixture_id = session.fixture_id
          and fill_in.team_id = p_team_id and fill_in.status = 'SELECTED'
        where session.team_id = p_team_id
          and (p_session_ids is null or session.id = any(p_session_ids))
      ), combined as (
        select * from member_rows
        union all
        select fill_in.* from (
          select * from fill_in_rows union select * from selected_fill_ins
        ) fill_in
        where not exists (select 1 from member_rows member where member.profile_id = fill_in.profile_id)
      )
      select coalesce(jsonb_agg(jsonb_build_object(
        'profileId', combined.profile_id,
        'name', coalesce(nullif(concat_ws(' ', profile.first_name, profile.last_name), ''), 'Player'),
        'avatarUrl', profile.avatar_url,
        'group', combined.audience_group,
        'selected', true
      ) order by combined.audience_group, profile.first_name, profile.last_name), '[]'::jsonb)
      from combined join public.profiles profile on profile.id = combined.profile_id
    )
  ) into v_result
  from public.teams team
  join public.clubs club on club.id = team.club_id
  join public.associations association on association.id = club.association_id
  where team.id = p_team_id;

  return coalesce(v_result, '{}'::jsonb);
end;
$$;

create or replace function public.save_mvp_tally_draft(
  p_presentation_id uuid,
  p_team_id uuid,
  p_title text,
  p_subtitle text,
  p_theme jsonb,
  p_playback_speed numeric,
  p_session_ids uuid[],
  p_recipients jsonb,
  p_replaces_presentation_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_id uuid;
  v_recipient jsonb;
  v_limit numeric;
  v_logo_path text;
begin
  if v_user_id is null or not private.mvp_can_manage_team(v_user_id, p_team_id) then
    raise exception using errcode = '42501', message = 'Player MVP team-management permission required';
  end if;
  perform private.close_due_mvp_voting_sessions();
  if coalesce(array_length(p_session_ids, 1), 0) = 0 then
    raise exception using errcode = 'P0001', message = 'MVP_TALLY_ROUNDS_REQUIRED';
  end if;
  if jsonb_typeof(coalesce(p_recipients, '[]'::jsonb)) <> 'array' then
    raise exception using errcode = '22023', message = 'Audience must be an array';
  end if;
  if p_playback_speed not in (0.5, 1, 1.5, 2, 3, 4, 5, 7.5, 10) then
    raise exception using errcode = '22023', message = 'MVP_TALLY_INVALID_SPEED';
  end if;

  if p_theme ? 'leaderboardLimit' and jsonb_typeof(p_theme -> 'leaderboardLimit') <> 'null' then
    if jsonb_typeof(p_theme -> 'leaderboardLimit') <> 'number' then
      raise exception using errcode = '22023', message = 'MVP_TALLY_INVALID_PLAYER_LIMIT';
    end if;
    v_limit := (p_theme ->> 'leaderboardLimit')::numeric;
    if v_limit <> trunc(v_limit) or v_limit < 3 or v_limit > 50 then
      raise exception using errcode = '22023', message = 'MVP_TALLY_INVALID_PLAYER_LIMIT';
    end if;
  end if;

  v_logo_path := nullif(p_theme ->> 'logoStoragePath', '');
  if v_logo_path is not null then
    if private.mvp_tally_asset_team_id(v_logo_path) is distinct from p_team_id
       or not exists (
         select 1 from storage.objects object
         where object.bucket_id = 'mvp-tally-assets' and object.name = v_logo_path
       ) then
      raise exception using errcode = '22023', message = 'MVP_TALLY_INVALID_LOGO';
    end if;
  end if;

  if p_presentation_id is null then
    insert into public.mvp_tally_presentations(
      team_id, title, subtitle, theme, playback_speed, replaces_presentation_id,
      created_by, updated_by
    ) values (
      p_team_id, btrim(p_title), nullif(btrim(p_subtitle), ''), coalesce(p_theme, '{}'::jsonb),
      p_playback_speed, p_replaces_presentation_id, v_user_id, v_user_id
    ) returning id into v_id;
  else
    select presentation.id into v_id
    from public.mvp_tally_presentations presentation
    where presentation.id = p_presentation_id
      and presentation.team_id = p_team_id
      and presentation.status = 'DRAFT'
    for update;
    if v_id is null then
      raise exception using errcode = 'P0001', message = 'MVP_TALLY_DRAFT_NOT_EDITABLE';
    end if;
    update public.mvp_tally_presentations
    set title = btrim(p_title), subtitle = nullif(btrim(p_subtitle), ''),
      theme = coalesce(p_theme, '{}'::jsonb), playback_speed = p_playback_speed,
      replaces_presentation_id = p_replaces_presentation_id,
      card_snapshot = null, result_snapshot = null, commentary_snapshot = null,
      source_fingerprint = null, previewed_at = null, validation_error = null,
      updated_by = v_user_id, updated_at = now()
    where id = v_id;
    delete from public.mvp_tally_sessions where presentation_id = v_id;
    delete from public.mvp_tally_recipients where presentation_id = v_id;
  end if;

  insert into public.mvp_tally_sessions(presentation_id, session_id, display_order)
  select v_id, session.id,
    row_number() over (order by
      coalesce(fixture.round_number, nullif(substring(session.round from '([0-9]+)'), '')::integer, 2147483647),
      session.game_date nulls last, session.created_at, session.id)::integer
  from public.mvp_voting_sessions session
  left join public.fixtures fixture on fixture.id = session.fixture_id
  where session.id = any(p_session_ids);

  if (select count(*) from public.mvp_tally_sessions included where included.presentation_id = v_id)
     <> (select count(distinct value) from unnest(p_session_ids) value) then
    raise exception using errcode = 'P0001', message = 'MVP_TALLY_ROUND_NOT_FOUND';
  end if;

  for v_recipient in select value from jsonb_array_elements(coalesce(p_recipients, '[]'::jsonb)) loop
    insert into public.mvp_tally_recipients(presentation_id, profile_id, audience_group)
    values (
      v_id,
      (v_recipient ->> 'profileId')::uuid,
      upper(v_recipient ->> 'group')
    )
    on conflict (presentation_id, profile_id) do update
      set audience_group = excluded.audience_group;
  end loop;

  perform private.mvp_tally_assert_source_ready(v_id);
  return v_id;
end;
$$;

create or replace function public.save_mvp_tally_commentary(
  p_presentation_id uuid,
  p_source_fingerprint text,
  p_commentary jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_team_id uuid;
begin
  select presentation.team_id into v_team_id
  from public.mvp_tally_presentations presentation
  where presentation.id = p_presentation_id
    and presentation.status = 'DRAFT'
    and presentation.source_fingerprint = p_source_fingerprint
  for update;
  if v_team_id is null or v_user_id is null
     or not private.mvp_can_manage_team(v_user_id, v_team_id) then
    raise exception using errcode = '42501', message = 'Editable Player MVP tally not available';
  end if;
  if jsonb_typeof(p_commentary) <> 'object'
     or p_commentary ->> 'version' <> '1'
     or p_commentary ->> 'source' not in ('AI', 'RULES')
     or jsonb_typeof(p_commentary -> 'rounds') <> 'array'
     or exists (
       select 1 from jsonb_array_elements(p_commentary -> 'rounds') item
       where nullif(item ->> 'sessionId', '') is null
          or char_length(btrim(coalesce(item ->> 'text', ''))) not between 1 and 180
     ) then
    raise exception using errcode = '22023', message = 'MVP_TALLY_INVALID_COMMENTARY';
  end if;
  if (select count(*) from jsonb_array_elements(p_commentary -> 'rounds'))
     <> (select count(*) from public.mvp_tally_sessions included where included.presentation_id = p_presentation_id)
     or exists (
       select 1 from jsonb_array_elements(p_commentary -> 'rounds') item
       where not exists (
         select 1 from public.mvp_tally_sessions included
         where included.presentation_id = p_presentation_id
           and included.session_id::text = item ->> 'sessionId'
       )
     ) then
    raise exception using errcode = '22023', message = 'MVP_TALLY_INVALID_COMMENTARY';
  end if;

  update public.mvp_tally_presentations
  set commentary_snapshot = p_commentary,
    updated_by = v_user_id,
    updated_at = now()
  where id = p_presentation_id;
end;
$$;

revoke all on function private.close_due_mvp_voting_sessions() from public, anon, authenticated;
revoke all on function private.enforce_mvp_voting_deadline() from public, anon, authenticated;
revoke all on function private.mvp_tally_session_ballot_count(uuid) from public, anon, authenticated;
revoke all on function private.mvp_tally_session_eligible_voter_count(uuid) from public, anon, authenticated;
revoke all on function private.mvp_tally_asset_team_id(text) from public, anon, authenticated;
revoke all on function private.mvp_tally_asset_can_manage(text) from public, anon;
revoke all on function private.mvp_tally_source_fingerprint(uuid) from public, anon, authenticated;
revoke all on function private.mvp_tally_assert_source_ready(uuid) from public, anon, authenticated;
revoke all on function private.mvp_tally_build_cards(uuid) from public, anon, authenticated;
revoke all on function private.mvp_tally_build_results(uuid) from public, anon, authenticated;
grant execute on function private.mvp_tally_asset_can_manage(text) to authenticated;

revoke all on function public.get_mvp_tally_builder_data(uuid, uuid[]) from public, anon;
revoke all on function public.save_mvp_tally_draft(uuid, uuid, text, text, jsonb, numeric, uuid[], jsonb, uuid) from public, anon;
revoke all on function public.save_mvp_tally_commentary(uuid, text, jsonb) from public, anon;
grant execute on function public.get_mvp_tally_builder_data(uuid, uuid[]) to authenticated;
grant execute on function public.save_mvp_tally_draft(uuid, uuid, text, text, jsonb, numeric, uuid[], jsonb, uuid) to authenticated;
grant execute on function public.save_mvp_tally_commentary(uuid, text, jsonb) to authenticated;

do $$
declare
  v_job_id bigint;
begin
  select jobid into v_job_id from cron.job where jobname = 'close-due-player-mvp-voting';
  if v_job_id is not null then perform cron.unschedule(v_job_id); end if;
  perform cron.schedule(
    'close-due-player-mvp-voting',
    '* * * * *',
    'select private.close_due_mvp_voting_sessions();'
  );
end;
$$;

-- Reconcile Development immediately as well as scheduling future one-minute runs.
select private.close_due_mvp_voting_sessions();
