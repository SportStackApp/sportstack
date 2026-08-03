-- Notify the people managing a published line-up when a selected player's
-- availability changes. Keeping this in Postgres covers every app screen and
-- avoids relying on a particular browser being open.

create or replace function public.notify_selected_player_availability_change()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_fixture_id uuid;
  v_player_id uuid;
  v_status text;
  v_event_at timestamptz := clock_timestamp();
begin
  if tg_op = 'UPDATE' and new.status is not distinct from old.status then
    return new;
  end if;

  if tg_op = 'DELETE' then
    v_fixture_id := old.fixture_id;
    v_player_id := old.user_id;
    v_status := 'NO_RESPONSE';
  else
    v_fixture_id := new.fixture_id;
    v_player_id := new.user_id;
    v_status := new.status::text;
  end if;

  with selected_lineup as (
    select
      fl.fixture_id,
      fl.team_id,
      fl.created_by,
      f.fixture_date,
      coalesce(home.name, 'Home team') as home_name,
      coalesce(away.name, 'Bye') as away_name,
      trim(concat_ws(' ', p.first_name, p.last_name)) as player_name
    from public.fixture_lineups fl
    join public.fixture_lineup_assignments assignment
      on assignment.fixture_lineup_id = fl.id
     and assignment.player_id = v_player_id
    join public.fixtures f on f.id = fl.fixture_id
    join public.teams home on home.id = f.home_team_id
    left join public.teams away on away.id = f.away_team_id
    join public.profiles p on p.id = v_player_id
    where fl.fixture_id = v_fixture_id
      and fl.published_at is not null
    limit 1
  ), recipients as (
    select ur.user_id
    from selected_lineup lineup
    join public.user_roles ur
      on ur.team_id = lineup.team_id
     and ur.role in ('COACH'::public.user_role_enum, 'TEAM_MANAGER'::public.user_role_enum)
    where ur.user_id <> v_player_id

    union

    select lineup.created_by
    from selected_lineup lineup
    where lineup.created_by is not null
      and lineup.created_by <> v_player_id
  )
  insert into public.notifications (
    user_id,
    type,
    title,
    message,
    body,
    game_id,
    fixture_id,
    team_id,
    action_url,
    dedupe_key
  )
  select
    recipient.user_id,
    'LINEUP_AVAILABILITY_CHANGED',
    case
      when v_status = 'UNAVAILABLE' then 'Selected player is unavailable'
      else 'Selected player availability changed'
    end,
    coalesce(nullif(lineup.player_name, ''), 'A selected player')
      || ' changed availability to '
      || case v_status
           when 'AVAILABLE' then 'Available'
           when 'UNAVAILABLE' then 'Unavailable'
           when 'MAYBE' then 'Unsure'
           else 'No response'
         end
      || ' for '
      || lineup.home_name
      || ' vs '
      || lineup.away_name
      || ' on '
      || to_char(timezone('Australia/Melbourne', lineup.fixture_date), 'DD/MM/YYYY')
      || '.',
    coalesce(nullif(lineup.player_name, ''), 'A selected player')
      || ' changed availability to '
      || case v_status
           when 'AVAILABLE' then 'Available'
           when 'UNAVAILABLE' then 'Unavailable'
           when 'MAYBE' then 'Unsure'
           else 'No response'
         end
      || ' for '
      || lineup.home_name
      || ' vs '
      || lineup.away_name
      || ' on '
      || to_char(timezone('Australia/Melbourne', lineup.fixture_date), 'DD/MM/YYYY')
      || '.',
    lineup.fixture_id,
    lineup.fixture_id,
    lineup.team_id,
    '/games/' || lineup.fixture_id::text,
    'lineup-availability:'
      || lineup.fixture_id::text
      || ':' || v_player_id::text
      || ':' || recipient.user_id::text
      || ':' || extract(epoch from v_event_at)::text
  from selected_lineup lineup
  cross join recipients recipient
  on conflict (dedupe_key) where dedupe_key is not null do nothing;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function public.notify_selected_player_availability_change() from public, anon, authenticated;

drop trigger if exists notify_selected_player_availability_change
  on public.fixture_availability;

create trigger notify_selected_player_availability_change
after insert or update of status or delete on public.fixture_availability
for each row execute function public.notify_selected_player_availability_change();
