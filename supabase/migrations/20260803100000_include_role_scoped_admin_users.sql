-- Include role-only accounts in scoped administration user lists.
--
-- Coaches, Team Managers and administrators do not need a player membership.
-- Their user_roles row is sufficient to make them visible to an authorised
-- administrator within the same association, club or team.

create or replace function public.admin_visible_profile_ids(
  p_actor_mode text default null,
  p_association_id uuid default null,
  p_club_id uuid default null,
  p_team_id uuid default null
)
returns table (profile_id uuid)
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_mode text := public.administration_effective_mode(p_actor_mode);
begin
  if v_mode = 'coach' or v_mode = 'player' then
    return;
  end if;

  if v_mode = 'super_admin' then
    return query select profile.id from public.profiles profile;
    return;
  end if;

  return query
  with membership_profiles as (
    select distinct membership.user_id as profile_id
    from public.team_memberships membership
    join public.teams team on team.id = membership.team_id
    join public.clubs club on club.id = team.club_id
    where membership.status::text in ('ACTIVE','PENDING','INVITED')
      and (p_association_id is null or club.association_id = p_association_id)
      and (p_club_id is null or club.id = p_club_id)
      and (p_team_id is null or team.id = p_team_id)
      and public.administration_scope_allows(v_mode, club.association_id, club.id, team.id)
  ),
  role_profiles as (
    select distinct role_row.user_id as profile_id
    from public.user_roles role_row
    left join public.teams team on team.id = role_row.team_id
    left join public.clubs club on club.id = coalesce(role_row.club_id, team.club_id)
    cross join lateral (
      select
        coalesce(role_row.association_id, club.association_id) as association_id,
        coalesce(role_row.club_id, team.club_id) as club_id,
        role_row.team_id as team_id
    ) scope
    where scope.association_id is not null
      and (p_association_id is null or scope.association_id = p_association_id)
      and (p_club_id is null or scope.club_id = p_club_id)
      and (p_team_id is null or scope.team_id = p_team_id)
      and public.administration_scope_allows(
        v_mode,
        scope.association_id,
        scope.club_id,
        scope.team_id
      )
  )
  select visible.profile_id
  from (
    select membership_profiles.profile_id from membership_profiles
    union
    select role_profiles.profile_id from role_profiles
  ) visible;

  if v_mode in ('association','club') then
    return query select v_actor;
  end if;
end;
$function$;

revoke all on function public.admin_visible_profile_ids(text, uuid, uuid, uuid) from public, anon;
grant execute on function public.admin_visible_profile_ids(text, uuid, uuid, uuid) to authenticated;
