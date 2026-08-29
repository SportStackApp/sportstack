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
