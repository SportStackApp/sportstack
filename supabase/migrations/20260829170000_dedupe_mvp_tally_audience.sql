-- Return each Player MVP tally recipient once even when historical membership rows overlap.
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
          case
            when bool_or(membership.membership_type::text in ('PRIMARY', 'PERMANENT')) then 'PRIMARY'
            else 'SECONDARY'
          end audience_group
        from public.team_memberships membership
        where membership.team_id = p_team_id
          and membership.status::text = 'ACTIVE'
          and membership.membership_type::text in ('PRIMARY', 'PERMANENT', 'SECONDARY')
        group by membership.user_id
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
