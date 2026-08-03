-- Allow authorised administrators to update a role-only account in scope.
--
-- This keeps the mutation boundary aligned with admin_visible_profile_ids.
-- A target can be in scope through an active team membership or through a
-- scoped Coach, Team Manager or administration role.

create or replace function public.administration_target_profile_in_scope(
  p_user_id uuid,
  p_actor_mode text default null
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_mode text := public.administration_effective_mode(p_actor_mode);
begin
  if p_user_id is null then
    return false;
  end if;

  if v_mode = 'super_admin' then
    return exists (
      select 1
      from public.profiles profile
      where profile.id = p_user_id
    );
  end if;

  if v_mode not in ('association', 'club') then
    return false;
  end if;

  if exists (
    select 1
    from public.team_memberships membership
    join public.teams team on team.id = membership.team_id
    join public.clubs club on club.id = team.club_id
    where membership.user_id = p_user_id
      and membership.status::text in ('ACTIVE', 'PENDING', 'INVITED')
      and public.administration_scope_allows(
        v_mode,
        club.association_id,
        club.id,
        team.id
      )
  ) then
    return true;
  end if;

  return exists (
    select 1
    from public.user_roles role_row
    left join public.teams team on team.id = role_row.team_id
    left join public.clubs club on club.id = coalesce(role_row.club_id, team.club_id)
    cross join lateral (
      select
        coalesce(role_row.association_id, club.association_id) as association_id,
        coalesce(role_row.club_id, team.club_id) as club_id,
        role_row.team_id as team_id
    ) scope
    where role_row.user_id = p_user_id
      and scope.association_id is not null
      and public.administration_scope_allows(
        v_mode,
        scope.association_id,
        scope.club_id,
        scope.team_id
      )
  );
end;
$function$;

revoke all on function public.administration_target_profile_in_scope(uuid, text) from public, anon;
grant execute on function public.administration_target_profile_in_scope(uuid, text) to authenticated;
grant execute on function public.administration_target_profile_in_scope(uuid, text) to service_role;
