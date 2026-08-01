-- Keep Super Admin authority intact while allowing the selected "Viewing as"
-- mode to apply the scope supplied by the interface.
create or replace function public.administration_scope_allows(
  p_requested_mode text,
  p_association_id uuid default null,
  p_club_id uuid default null,
  p_team_id uuid default null
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_mode text := public.administration_effective_mode(p_requested_mode);
  v_association_id uuid := p_association_id;
  v_club_id uuid := p_club_id;
  v_is_super_admin boolean;
begin
  if p_team_id is not null then
    select team.club_id, club.association_id
    into v_club_id, v_association_id
    from public.teams team
    join public.clubs club on club.id = team.club_id
    where team.id = p_team_id;
    if not found then return false; end if;
  elsif p_club_id is not null then
    select club.association_id into v_association_id
    from public.clubs club where club.id = p_club_id;
    if not found then return false; end if;
  end if;

  select exists (
    select 1 from public.user_roles role_row
    where role_row.user_id = v_actor and role_row.role::text = 'SUPER_ADMIN'
  ) into v_is_super_admin;

  if v_mode = 'super_admin' then return v_is_super_admin; end if;

  -- A real Super Admin may deliberately use a lower Viewing-as mode. The
  -- caller must still supply the selected association, club or team filter.
  if v_is_super_admin then
    if v_mode = 'association' then return v_association_id is not null; end if;
    if v_mode = 'club' then return v_club_id is not null; end if;
    if v_mode = 'team_manager' then return p_team_id is not null; end if;
    return false;
  end if;

  if v_mode = 'association' then
    return v_association_id is not null and exists (
      select 1 from public.user_roles role_row
      where role_row.user_id = v_actor
        and role_row.role::text = 'ASSOCIATION_ADMIN'
        and role_row.association_id = v_association_id
    );
  end if;
  if v_mode = 'club' then
    return v_club_id is not null and exists (
      select 1 from public.user_roles role_row
      where role_row.user_id = v_actor
        and role_row.role::text = 'CLUB_ADMIN'
        and role_row.club_id = v_club_id
    );
  end if;
  if v_mode = 'team_manager' then
    return p_team_id is not null and exists (
      select 1 from public.user_roles role_row
      where role_row.user_id = v_actor
        and role_row.role::text = 'TEAM_MANAGER'
        and role_row.team_id = p_team_id
    );
  end if;
  return false;
end;
$$;

revoke all on function public.administration_scope_allows(text, uuid, uuid, uuid) from public;
grant execute on function public.administration_scope_allows(text, uuid, uuid, uuid) to authenticated;
