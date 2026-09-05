-- Manual-only Player MVP tally presentation release slice.
-- Production baseline: origin/prod 682b8eaba33f657a2c64dcce571a40e0b2b0ba00.
-- This migration deliberately excludes scheduling, email delivery, Edge Functions,
-- Player MVP session lifecycle changes and background jobs.

-- Saved, private Player MVP tally presentations.
-- Original Player MVP sessions, submissions and vote lines are read only to this feature.

create table public.mvp_tally_presentations (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete restrict,
  title text not null,
  subtitle text,
  status text not null default 'DRAFT'
    check (status in ('DRAFT', 'PUBLISHED', 'WITHDRAWN')),
  theme jsonb not null default '{}'::jsonb,
  playback_speed numeric(3,2) not null default 1
    check (playback_speed in (0.5, 1, 1.5, 2)),
  card_snapshot jsonb,
  result_snapshot jsonb,
  source_fingerprint text,
  previewed_at timestamptz,
  published_at timestamptz,
  withdrawn_at timestamptz,
  withdrawal_reason text,
  validation_error text,
  replaces_presentation_id uuid references public.mvp_tally_presentations(id) on delete restrict,
  created_by uuid not null references public.profiles(id) on delete restrict,
  updated_by uuid not null references public.profiles(id) on delete restrict,
  published_by uuid references public.profiles(id) on delete set null,
  withdrawn_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (char_length(btrim(title)) between 1 and 120),
  check (subtitle is null or char_length(subtitle) <= 240),
  check (withdrawal_reason is null or char_length(btrim(withdrawal_reason)) between 3 and 1000),
  check (jsonb_typeof(theme) = 'object'),
  check (card_snapshot is null or jsonb_typeof(card_snapshot) = 'object'),
  check (result_snapshot is null or jsonb_typeof(result_snapshot) = 'array'),
  check (status <> 'PUBLISHED' or published_at is not null),
  check (status <> 'WITHDRAWN' or (withdrawn_at is not null and withdrawal_reason is not null))
);

create table public.mvp_tally_sessions (
  presentation_id uuid not null references public.mvp_tally_presentations(id) on delete cascade,
  session_id uuid not null references public.mvp_voting_sessions(id) on delete restrict,
  display_order integer not null check (display_order > 0),
  primary key (presentation_id, session_id),
  unique (presentation_id, display_order)
);

create table public.mvp_tally_recipients (
  id uuid not null default gen_random_uuid() unique,
  presentation_id uuid not null references public.mvp_tally_presentations(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete restrict,
  audience_group text not null check (audience_group in ('PRIMARY', 'SECONDARY', 'FILL_IN')),
  created_at timestamptz not null default now(),
  primary key (presentation_id, profile_id)
);

create index mvp_tally_presentations_team_status_idx
  on public.mvp_tally_presentations(team_id, status, created_at desc);
create index mvp_tally_sessions_session_idx
  on public.mvp_tally_sessions(session_id);
create index mvp_tally_recipients_profile_idx
  on public.mvp_tally_recipients(profile_id, presentation_id);

alter table public.mvp_tally_presentations enable row level security;
alter table public.mvp_tally_sessions enable row level security;
alter table public.mvp_tally_recipients enable row level security;

revoke all on table public.mvp_tally_presentations from public, anon, authenticated;
revoke all on table public.mvp_tally_sessions from public, anon, authenticated;
revoke all on table public.mvp_tally_recipients from public, anon, authenticated;
grant select on table public.mvp_tally_presentations to authenticated;
grant select on table public.mvp_tally_sessions to authenticated;
grant select on table public.mvp_tally_recipients to authenticated;
grant all on table public.mvp_tally_presentations to service_role;
grant all on table public.mvp_tally_sessions to service_role;
grant all on table public.mvp_tally_recipients to service_role;

comment on table public.mvp_tally_presentations is
  'Saved Player MVP result presentations. Snapshots never contain voter identities.';
comment on table public.mvp_tally_sessions is
  'Ordered closed, undisputed Player MVP sessions included in a presentation.';
comment on table public.mvp_tally_recipients is
  'Explicit signed-in audience fixed when a Player MVP tally is published.';

create or replace function private.mvp_tally_can_read(p_user_id uuid, p_presentation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_user_id is not null
    and p_user_id = (select auth.uid())
    and exists (
      select 1
      from public.mvp_tally_presentations presentation
      where presentation.id = p_presentation_id
        and (
          private.mvp_can_manage_team(p_user_id, presentation.team_id)
          or (
            presentation.status = 'PUBLISHED'
            and exists (
              select 1
              from public.mvp_tally_recipients recipient
              where recipient.presentation_id = presentation.id
                and recipient.profile_id = p_user_id
            )
          )
        )
    );
$$;

revoke all on function private.mvp_tally_can_read(uuid, uuid) from public, anon;
grant execute on function private.mvp_tally_can_read(uuid, uuid) to authenticated;

create policy mvp_tally_presentations_select
on public.mvp_tally_presentations for select to authenticated
using ((select private.mvp_tally_can_read((select auth.uid()), id)));

create policy mvp_tally_sessions_select
on public.mvp_tally_sessions for select to authenticated
using ((select private.mvp_tally_can_read((select auth.uid()), presentation_id)));

create policy mvp_tally_recipients_select
on public.mvp_tally_recipients for select to authenticated
using ((select private.mvp_tally_can_read((select auth.uid()), presentation_id)));

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
          coalesce(voted_player.profile_id::text, ''), coalesce(voted_player.player_name, '')),
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
  v_invalid_count integer;
  v_recipient_count integer;
begin
  select presentation.team_id into v_team_id
  from public.mvp_tally_presentations presentation
  where presentation.id = p_presentation_id;

  select count(*), count(*) filter (
    where session.team_id is distinct from v_team_id
       or session.status::text <> 'CLOSED'
       or exists (
         select 1 from public.mvp_result_checks result_check
         where result_check.session_id = session.id
           and result_check.result_check_round = session.result_check_round
           and result_check.response = 'INCORRECT'
       )
  )
  into v_session_count, v_invalid_count
  from public.mvp_tally_sessions included
  join public.mvp_voting_sessions session on session.id = included.session_id
  where included.presentation_id = p_presentation_id;

  select count(*) into v_recipient_count
  from public.mvp_tally_recipients recipient
  where recipient.presentation_id = p_presentation_id;

  if v_session_count = 0 then
    raise exception using errcode = 'P0001', message = 'MVP_TALLY_ROUNDS_REQUIRED';
  end if;
  if v_invalid_count > 0 then
    raise exception using errcode = 'P0001', message = 'MVP_TALLY_ROUNDS_CHANGED';
  end if;
  if v_recipient_count = 0 then
    raise exception using errcode = 'P0001', message = 'MVP_TALLY_AUDIENCE_REQUIRED';
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
      coalesce(included.round, 'Round ' || included.display_order::text) round_label,
      included.game_date,
      concat_ws(' v ', included.home_team, included.away_team) match_label,
      vote.id vote_id,
      vote.points,
      player.profile_id,
      player.player_name,
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
      max(player.player_name) player_name,
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

create or replace function private.protect_published_mvp_tally()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status = 'WITHDRAWN' then
    raise exception 'Withdrawn Player MVP tally presentations are immutable';
  end if;
  if old.status = 'PUBLISHED' then
    if new.status <> 'WITHDRAWN'
       or (to_jsonb(new) - array['status','withdrawn_at','withdrawal_reason','withdrawn_by','updated_at','updated_by'])
          is distinct from
          (to_jsonb(old) - array['status','withdrawn_at','withdrawal_reason','withdrawn_by','updated_at','updated_by']) then
      raise exception 'Published Player MVP tally presentations are immutable';
    end if;
  end if;
  return new;
end;
$$;

create trigger protect_published_mvp_tally
before update or delete on public.mvp_tally_presentations
for each row execute function private.protect_published_mvp_tally();

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
        'round', coalesce(session.round, 'Round'),
        'gameDate', session.game_date,
        'homeTeam', session.home_team,
        'awayTeam', session.away_team,
        'voteCount', (select count(*) from public.mvp_votes vote where vote.session_id = session.id),
        'unlinkedCount', (
          select count(distinct vote.player_id)
          from public.mvp_votes vote
          join public.revsports_players player on player.id = vote.player_id
          where vote.session_id = session.id and player.profile_id is null
        )
      ) order by session.game_date, session.created_at), '[]'::jsonb)
      from public.mvp_voting_sessions session
      where session.team_id = p_team_id
        and session.status::text = 'CLOSED'
        and not exists (
          select 1 from public.mvp_result_checks result_check
          where result_check.session_id = session.id
            and result_check.result_check_round = session.result_check_round
            and result_check.response = 'INCORRECT'
        )
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
      ), combined as (
        select * from member_rows
        union all
        select fill_in.* from fill_in_rows fill_in
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
  v_session_id uuid;
  v_order integer := 0;
  v_recipient jsonb;
begin
  if v_user_id is null or not private.mvp_can_manage_team(v_user_id, p_team_id) then
    raise exception using errcode = '42501', message = 'Player MVP team-management permission required';
  end if;
  if coalesce(array_length(p_session_ids, 1), 0) = 0 then
    raise exception using errcode = 'P0001', message = 'MVP_TALLY_ROUNDS_REQUIRED';
  end if;
  if jsonb_typeof(coalesce(p_recipients, '[]'::jsonb)) <> 'array' then
    raise exception using errcode = '22023', message = 'Audience must be an array';
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
      card_snapshot = null, result_snapshot = null, source_fingerprint = null,
      previewed_at = null, validation_error = null,
      updated_by = v_user_id, updated_at = now()
    where id = v_id;
    delete from public.mvp_tally_sessions where presentation_id = v_id;
    delete from public.mvp_tally_recipients where presentation_id = v_id;
  end if;

  foreach v_session_id in array p_session_ids loop
    v_order := v_order + 1;
    insert into public.mvp_tally_sessions(presentation_id, session_id, display_order)
    values (v_id, v_session_id, v_order);
  end loop;

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

create or replace function public.preview_mvp_tally(p_presentation_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_team_id uuid;
  v_cards jsonb;
  v_results jsonb;
  v_fingerprint text;
begin
  select presentation.team_id into v_team_id
  from public.mvp_tally_presentations presentation
  where presentation.id = p_presentation_id and presentation.status = 'DRAFT'
  for update;
  if v_team_id is null or v_user_id is null
     or not private.mvp_can_manage_team(v_user_id, v_team_id) then
    raise exception using errcode = '42501', message = 'Editable Player MVP tally not available';
  end if;

  perform private.mvp_tally_assert_source_ready(p_presentation_id);
  v_cards := private.mvp_tally_build_cards(p_presentation_id);
  v_results := private.mvp_tally_build_results(p_presentation_id);
  v_fingerprint := private.mvp_tally_source_fingerprint(p_presentation_id);

  update public.mvp_tally_presentations
  set card_snapshot = v_cards, result_snapshot = v_results,
    source_fingerprint = v_fingerprint, previewed_at = now(),
    validation_error = null, updated_by = v_user_id, updated_at = now()
  where id = p_presentation_id;

  return jsonb_build_object('cards', v_cards, 'results', v_results,
    'sourceFingerprint', v_fingerprint, 'previewedAt', now());
end;
$$;

create or replace function private.mvp_tally_publish_now(p_presentation_id uuid, p_actor_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_team_id uuid;
  v_title text;
begin
  select presentation.team_id, presentation.title
  into v_team_id, v_title
  from public.mvp_tally_presentations presentation
  where presentation.id = p_presentation_id
    and presentation.status = 'DRAFT'
  for update;

  if v_team_id is null then return; end if;
  perform private.mvp_tally_assert_source_ready(p_presentation_id);

  update public.mvp_tally_presentations
  set status = 'PUBLISHED', published_at = now(), published_by = p_actor_id,
    validation_error = null, updated_at = now(), updated_by = coalesce(p_actor_id, updated_by)
  where id = p_presentation_id;

  insert into public.notifications(user_id, title, body, message, type, team_id, action_url, dedupe_key)
  select recipient.profile_id,
    'New Player MVP results',
    v_title || ' is ready to watch.',
    v_title || ' is ready to watch.',
    'MVP_TALLY_PUBLISHED',
    v_team_id,
    '/mvp-votes/tallies/' || p_presentation_id,
    'mvp-tally:' || p_presentation_id || ':' || recipient.profile_id
  from public.mvp_tally_recipients recipient
  where recipient.presentation_id = p_presentation_id
  on conflict (dedupe_key) where dedupe_key is not null do nothing;
end;
$$;

create or replace function public.publish_mvp_tally(p_presentation_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_presentation public.mvp_tally_presentations%rowtype;
  v_current_fingerprint text;
begin
  select * into v_presentation
  from public.mvp_tally_presentations presentation
  where presentation.id = p_presentation_id and presentation.status = 'DRAFT'
  for update;
  if v_presentation.id is null or v_user_id is null
     or not private.mvp_can_manage_team(v_user_id, v_presentation.team_id) then
    raise exception using errcode = '42501', message = 'Editable Player MVP tally not available';
  end if;
  if v_presentation.previewed_at is null or v_presentation.source_fingerprint is null then
    raise exception using errcode = 'P0001', message = 'MVP_TALLY_PREVIEW_REQUIRED';
  end if;

  perform private.mvp_tally_assert_source_ready(p_presentation_id);
  v_current_fingerprint := private.mvp_tally_source_fingerprint(p_presentation_id);
  if v_current_fingerprint is distinct from v_presentation.source_fingerprint then
    update public.mvp_tally_presentations
    set card_snapshot = null, result_snapshot = null, commentary_snapshot = null,
      source_fingerprint = null, previewed_at = null,
      validation_error = 'Rounds, votes or audience changed. Preview again.',
      updated_by = v_user_id, updated_at = now()
    where id = p_presentation_id;
    raise exception using errcode = 'P0001', message = 'MVP_TALLY_PREVIEW_STALE';
  end if;

  perform private.mvp_tally_publish_now(p_presentation_id, v_user_id);
  return 'PUBLISHED';
end;
$$;

create or replace function public.withdraw_mvp_tally(
  p_presentation_id uuid,
  p_reason text
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
  if char_length(btrim(coalesce(p_reason, ''))) < 3 then
    raise exception using errcode = '22023', message = 'A withdrawal reason is required';
  end if;
  select presentation.team_id into v_team_id
  from public.mvp_tally_presentations presentation
  where presentation.id = p_presentation_id
    and presentation.status = 'PUBLISHED'
  for update;
  if v_team_id is null or v_user_id is null
     or not private.mvp_can_manage_team(v_user_id, v_team_id) then
    raise exception using errcode = '42501', message = 'Published Player MVP tally not available';
  end if;

  update public.mvp_tally_presentations
  set status = 'WITHDRAWN', withdrawn_at = now(), withdrawal_reason = btrim(p_reason),
    withdrawn_by = v_user_id, updated_by = v_user_id, updated_at = now()
  where id = p_presentation_id;
end;
$$;

revoke all on function private.mvp_tally_source_fingerprint(uuid) from public, anon, authenticated;
revoke all on function private.mvp_tally_assert_source_ready(uuid) from public, anon, authenticated;
revoke all on function private.mvp_tally_build_cards(uuid) from public, anon, authenticated;
revoke all on function private.mvp_tally_build_results(uuid) from public, anon, authenticated;
revoke all on function private.protect_published_mvp_tally() from public, anon, authenticated;
revoke all on function private.mvp_tally_publish_now(uuid, uuid) from public, anon, authenticated;

revoke all on function public.get_mvp_tally_builder_data(uuid, uuid[]) from public, anon;
revoke all on function public.save_mvp_tally_draft(uuid, uuid, text, text, jsonb, numeric, uuid[], jsonb, uuid) from public, anon;
revoke all on function public.preview_mvp_tally(uuid) from public, anon;
revoke all on function public.publish_mvp_tally(uuid) from public, anon;
revoke all on function public.withdraw_mvp_tally(uuid, text) from public, anon;
grant execute on function public.get_mvp_tally_builder_data(uuid, uuid[]) to authenticated;
grant execute on function public.save_mvp_tally_draft(uuid, uuid, text, text, jsonb, numeric, uuid[], jsonb, uuid) to authenticated;
grant execute on function public.preview_mvp_tally(uuid) to authenticated;
grant execute on function public.publish_mvp_tally(uuid) to authenticated;
grant execute on function public.withdraw_mvp_tally(uuid, text) to authenticated;




-- Cover Player MVP tally presentation foreign keys reported by the Dev performance advisor.
create index if not exists mvp_tally_presentations_created_by_idx
  on public.mvp_tally_presentations(created_by);
create index if not exists mvp_tally_presentations_updated_by_idx
  on public.mvp_tally_presentations(updated_by);
create index if not exists mvp_tally_presentations_published_by_idx
  on public.mvp_tally_presentations(published_by)
  where published_by is not null;
create index if not exists mvp_tally_presentations_withdrawn_by_idx
  on public.mvp_tally_presentations(withdrawn_by)
  where withdrawn_by is not null;
create index if not exists mvp_tally_presentations_replaces_idx
  on public.mvp_tally_presentations(replaces_presentation_id)
  where replaces_presentation_id is not null;



-- Limit audience records to eligible players and hide other recipients from players.

drop policy if exists mvp_tally_recipients_select on public.mvp_tally_recipients;
create policy mvp_tally_recipients_select
on public.mvp_tally_recipients for select to authenticated
using (
  profile_id = (select auth.uid())
  or exists (
    select 1
    from public.mvp_tally_presentations presentation
    where presentation.id = presentation_id
      and private.mvp_can_manage_team((select auth.uid()), presentation.team_id)
  )
);

create or replace function private.mvp_tally_assert_source_ready(p_presentation_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_team_id uuid;
  v_session_count integer;
  v_invalid_count integer;
  v_recipient_count integer;
  v_ineligible_count integer;
begin
  select presentation.team_id into v_team_id
  from public.mvp_tally_presentations presentation
  where presentation.id = p_presentation_id;

  select count(*), count(*) filter (
    where session.team_id is distinct from v_team_id
       or session.status::text <> 'CLOSED'
       or not exists (
         select 1 from public.mvp_votes vote where vote.session_id = session.id
       )
       or exists (
         select 1 from public.mvp_result_checks result_check
         where result_check.session_id = session.id
           and result_check.result_check_round = session.result_check_round
           and result_check.response = 'INCORRECT'
       )
  )
  into v_session_count, v_invalid_count
  from public.mvp_tally_sessions included
  join public.mvp_voting_sessions session on session.id = included.session_id
  where included.presentation_id = p_presentation_id;

  select count(*) into v_recipient_count
  from public.mvp_tally_recipients recipient
  where recipient.presentation_id = p_presentation_id;

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
        and exists (
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
      )
    );

  if v_session_count = 0 then
    raise exception using errcode = 'P0001', message = 'MVP_TALLY_ROUNDS_REQUIRED';
  end if;
  if v_invalid_count > 0 then
    raise exception using errcode = 'P0001', message = 'MVP_TALLY_ROUNDS_CHANGED';
  end if;
  if v_recipient_count = 0 then
    raise exception using errcode = 'P0001', message = 'MVP_TALLY_AUDIENCE_REQUIRED';
  end if;
  if v_ineligible_count > 0 then
    raise exception using errcode = 'P0001', message = 'MVP_TALLY_AUDIENCE_CHANGED';
  end if;
end;
$$;

create or replace function private.validate_mvp_tally_replacement()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.replaces_presentation_id is not null
     and not exists (
       select 1
       from public.mvp_tally_presentations replaced
       where replaced.id = new.replaces_presentation_id
         and replaced.team_id = new.team_id
         and replaced.status = 'WITHDRAWN'
     ) then
    raise exception using errcode = 'P0001', message = 'MVP_TALLY_REPLACEMENT_INVALID';
  end if;
  return new;
end;
$$;

create trigger validate_mvp_tally_replacement
before insert or update of replaces_presentation_id, team_id
on public.mvp_tally_presentations
for each row execute function private.validate_mvp_tally_replacement();

revoke all on function private.mvp_tally_assert_source_ready(uuid) from public, anon, authenticated;
revoke all on function private.validate_mvp_tally_replacement() from public, anon, authenticated;



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
    where presentation.status = 'PUBLISHED'
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
     or p_commentary ->> 'source' <> 'RULES'
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
