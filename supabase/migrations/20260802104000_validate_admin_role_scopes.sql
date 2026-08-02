-- Reject incomplete, duplicate or mismatched role scopes before the existing
-- scoped administration function changes any role rows.

alter function public.admin_save_user_roles(uuid, text[], jsonb, jsonb, uuid[], jsonb, text)
  rename to admin_save_user_roles_unchecked;

revoke all on function public.admin_save_user_roles_unchecked(uuid, text[], jsonb, jsonb, uuid[], jsonb, text)
  from public, anon, authenticated;

create function public.admin_save_user_roles(
  p_user_id uuid,
  p_roles text[],
  p_coach_scopes jsonb default null,
  p_manager_scopes jsonb default null,
  p_association_admin_associations uuid[] default null,
  p_club_admin_scopes jsonb default null,
  p_actor_mode text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if 'ASSOCIATION_ADMIN' = any(coalesce(p_roles, '{}'::text[])) then
    if coalesce(array_length(p_association_admin_associations, 1), 0) = 0
      or exists (select 1 from unnest(p_association_admin_associations) association_id where association_id is null)
      or exists (
        select 1 from unnest(p_association_admin_associations) association_id
        left join public.associations association on association.id = association_id
        where association.id is null
      ) then
      raise exception 'Association Admin requires a valid association scope.';
    end if;
    if (select count(*) <> count(distinct association_id) from unnest(p_association_admin_associations) association_id) then
      raise exception 'Association Admin cannot contain duplicate association scopes.';
    end if;
  end if;

  if 'CLUB_ADMIN' = any(coalesce(p_roles, '{}'::text[])) then
    if p_club_admin_scopes is null or jsonb_typeof(p_club_admin_scopes) <> 'array'
      or jsonb_array_length(p_club_admin_scopes) = 0 then
      raise exception 'Club Admin requires a valid club scope.';
    end if;
    if exists (
      select 1
      from jsonb_array_elements(p_club_admin_scopes) scope
      left join public.clubs club on club.id = nullif(scope->>'club_id', '')::uuid
      where club.id is null
        or nullif(scope->>'association_id', '')::uuid is null
        or club.association_id <> nullif(scope->>'association_id', '')::uuid
    ) then
      raise exception 'A Club Admin scope does not match its association.';
    end if;
    if (
      select count(*) <> count(distinct scope->>'club_id')
      from jsonb_array_elements(p_club_admin_scopes) scope
    ) then
      raise exception 'Club Admin cannot contain duplicate club scopes.';
    end if;
  end if;

  if 'COACH' = any(coalesce(p_roles, '{}'::text[])) then
    if p_coach_scopes is null or jsonb_typeof(p_coach_scopes) <> 'array'
      or jsonb_array_length(p_coach_scopes) = 0 then
      raise exception 'Coach requires a valid team scope.';
    end if;
    if exists (
      select 1
      from jsonb_array_elements(p_coach_scopes) scope
      left join public.teams team on team.id = nullif(scope->>'team_id', '')::uuid
      left join public.clubs club on club.id = team.club_id
      where team.id is null
        or nullif(scope->>'club_id', '')::uuid is null
        or nullif(scope->>'association_id', '')::uuid is null
        or team.club_id <> nullif(scope->>'club_id', '')::uuid
        or club.association_id <> nullif(scope->>'association_id', '')::uuid
    ) then
      raise exception 'A Coach scope does not match its association and club.';
    end if;
    if (
      select count(*) <> count(distinct scope->>'team_id')
      from jsonb_array_elements(p_coach_scopes) scope
    ) then
      raise exception 'Coach cannot contain duplicate team scopes.';
    end if;
  end if;

  if 'TEAM_MANAGER' = any(coalesce(p_roles, '{}'::text[])) then
    if p_manager_scopes is null or jsonb_typeof(p_manager_scopes) <> 'array'
      or jsonb_array_length(p_manager_scopes) = 0 then
      raise exception 'Team Manager requires a valid team scope.';
    end if;
    if exists (
      select 1
      from jsonb_array_elements(p_manager_scopes) scope
      left join public.teams team on team.id = nullif(scope->>'team_id', '')::uuid
      left join public.clubs club on club.id = team.club_id
      where team.id is null
        or nullif(scope->>'club_id', '')::uuid is null
        or nullif(scope->>'association_id', '')::uuid is null
        or team.club_id <> nullif(scope->>'club_id', '')::uuid
        or club.association_id <> nullif(scope->>'association_id', '')::uuid
    ) then
      raise exception 'A Team Manager scope does not match its association and club.';
    end if;
    if (
      select count(*) <> count(distinct scope->>'team_id')
      from jsonb_array_elements(p_manager_scopes) scope
    ) then
      raise exception 'Team Manager cannot contain duplicate team scopes.';
    end if;
  end if;

  perform public.admin_save_user_roles_unchecked(
    p_user_id,
    p_roles,
    p_coach_scopes,
    p_manager_scopes,
    p_association_admin_associations,
    p_club_admin_scopes,
    p_actor_mode
  );
end;
$function$;

revoke all on function public.admin_save_user_roles(uuid, text[], jsonb, jsonb, uuid[], jsonb, text)
  from public, anon, authenticated;
grant execute on function public.admin_save_user_roles(uuid, text[], jsonb, jsonb, uuid[], jsonb, text)
  to authenticated;
