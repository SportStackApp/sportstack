-- Umpire is currently presented through Player mode in the application. A
-- signed-in umpire may therefore have a team selected in the normal cascade
-- while voting on a different completed fixture in the same association.
-- Keep the standard session-scope check for every role, then add a narrow
-- Umpire-role path that still enforces the live session, association scope and
-- configured module rules for each participating side.

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
  v_actor_id uuid := auth.uid();
  v_active_mode text := private.active_permission_mode_for_current_session();
  v_division_id uuid;
  v_home_team_id uuid;
  v_home_club_id uuid;
  v_home_association_id uuid;
  v_away_team_id uuid;
  v_away_club_id uuid;
  v_away_association_id uuid;
  v_home_permission jsonb;
  v_away_permission jsonb;
begin
  if p_fixture_id is null or v_actor_id is null or v_active_mode is null then
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

  -- Preserve the normal selected-cascade path for administrators, managers,
  -- coaches, players and Super Admin previews.
  if private.module_allowed_for_current_session(
    'umpire_match_voting',
    v_home_association_id,
    v_home_club_id,
    v_division_id,
    v_home_team_id
  ) or private.module_allowed_for_current_session(
    'umpire_match_voting',
    v_away_association_id,
    v_away_club_id,
    v_division_id,
    v_away_team_id
  ) then
    return true;
  end if;

  -- Umpire and Umpire Admin are specialised roles inside Player mode. They
  -- may vote across their assigned association without changing the player's
  -- normal team cascade. No other Player-mode role receives this exception.
  if v_active_mode <> 'player' or not exists (
    select 1
    from public.user_roles role_row
    where role_row.user_id = v_actor_id
      and role_row.role::text in ('UMPIRE', 'UMPIRE_ADMIN')
      and (
        role_row.association_id is null
        or role_row.association_id in (v_home_association_id, v_away_association_id)
      )
  ) then
    return false;
  end if;

  -- Resolve the same configured module rules against both fixture sides. This
  -- deliberately bypasses only the unrelated player-team cascade comparison;
  -- direct user/group/role rules and association/club/division/team module
  -- flags still apply exactly as configured.
  v_home_permission := public.resolve_effective_permission_for_mode_unchecked(
    'module.umpire_match_voting.access',
    v_active_mode,
    v_home_association_id,
    v_home_club_id,
    v_division_id,
    v_home_team_id
  );
  v_away_permission := public.resolve_effective_permission_for_mode_unchecked(
    'module.umpire_match_voting.access',
    v_active_mode,
    v_away_association_id,
    v_away_club_id,
    v_division_id,
    v_away_team_id
  );

  return coalesce((v_home_permission->>'allowed')::boolean, false)
    or coalesce((v_away_permission->>'allowed')::boolean, false);
exception
  when others then
    return false;
end;
$function$;

revoke all on function private.umpire_match_fixture_allowed_for_current_session(uuid)
  from public, anon, authenticated;
grant execute on function private.umpire_match_fixture_allowed_for_current_session(uuid)
  to authenticated;

comment on function private.umpire_match_fixture_allowed_for_current_session(uuid) is
  'Allows the active selected scope, or a signed-in Umpire role within its assigned association, to access an enabled Umpire Match Voting fixture.';
