-- Correct the action normaliser in the preceding applied migration.
-- PostgreSQL exposes btrim(text) through pg_catalog; trim is SQL syntax and
-- cannot be schema-qualified as a function.

create or replace function public.admin_manage_team_membership(
  p_membership_id uuid,
  p_action text,
  p_membership_type text default null,
  p_actor_mode text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_mode text := public.administration_effective_mode(p_actor_mode);
  v_membership public.team_memberships%rowtype;
  v_old_data jsonb;
  v_new_data jsonb;
  v_association_id uuid;
  v_club_id uuid;
  v_action text := pg_catalog.upper(pg_catalog.btrim(coalesce(p_action, '')));
begin
  select membership.* into v_membership
  from public.team_memberships membership
  where membership.id = p_membership_id for update;
  if not found then raise exception 'The membership was not found.'; end if;

  select team.club_id, club.association_id into v_club_id, v_association_id
  from public.teams team join public.clubs club on club.id = team.club_id
  where team.id = v_membership.team_id;

  if not public.administration_scope_allows(v_mode, v_association_id, v_club_id, v_membership.team_id) then
    raise exception 'You do not have permission to manage this membership.';
  end if;
  if v_mode in ('coach', 'player') then raise exception 'This mode cannot manage memberships.'; end if;
  if (v_mode = 'association' and exists (
      select 1 from public.user_roles role_row where role_row.user_id = v_membership.user_id and role_row.role::text in ('SUPER_ADMIN','ASSOCIATION_ADMIN')
    )) or (v_mode = 'club' and exists (
      select 1 from public.user_roles role_row where role_row.user_id = v_membership.user_id and role_row.role::text in ('SUPER_ADMIN','ASSOCIATION_ADMIN','CLUB_ADMIN')
    )) or (v_mode = 'team_manager' and exists (
      select 1 from public.user_roles role_row where role_row.user_id = v_membership.user_id and role_row.role::text in ('SUPER_ADMIN','ASSOCIATION_ADMIN','CLUB_ADMIN','TEAM_MANAGER')
    )) then
    raise exception 'You cannot edit an equal or higher-role account.';
  end if;

  v_old_data := pg_catalog.to_jsonb(v_membership);

  if v_action = 'APPROVE' then
    update public.team_memberships set status = 'ACTIVE' where id = p_membership_id;
  elsif v_action = 'DECLINE' then
    update public.team_memberships set status = 'INACTIVE' where id = p_membership_id;
  elsif v_action = 'MAKE_PRIMARY' then
    perform private.apply_primary_team_for_association(v_membership.user_id, v_membership.team_id, v_actor);
  elsif v_action = 'CHANGE_TYPE' then
    if pg_catalog.upper(coalesce(p_membership_type, '')) not in ('PRIMARY','SECONDARY','FILL_IN') then
      raise exception 'The membership type is not recognised.';
    end if;
    if pg_catalog.upper(p_membership_type) = 'PRIMARY' then
      perform private.apply_primary_team_for_association(v_membership.user_id, v_membership.team_id, v_actor);
    else
      update public.team_memberships
      set membership_type = pg_catalog.upper(p_membership_type)::public.membership_type_enum
      where id = p_membership_id;
    end if;
  elsif v_action = 'REMOVE' then
    delete from public.team_memberships where id = p_membership_id;
  else
    raise exception 'The membership action is not recognised.';
  end if;

  select pg_catalog.to_jsonb(membership) into v_new_data
  from public.team_memberships membership where membership.id = p_membership_id;

  insert into public.administration_audit_log (
    actor_id, actor_mode, action, record_type, record_id, target_user_id,
    association_id, club_id, team_id, old_data, new_data
  ) values (
    v_actor, v_mode, 'MEMBERSHIP_' || v_action, 'team_membership', p_membership_id,
    v_membership.user_id, v_association_id, v_club_id, v_membership.team_id, v_old_data, v_new_data
  );

  return pg_catalog.jsonb_build_object(
    'membership_id', p_membership_id,
    'action', v_action,
    'membership', v_new_data
  );
end;
$function$;

revoke all on function public.admin_manage_team_membership(uuid, text, text, text)
  from public, anon;
grant execute on function public.admin_manage_team_membership(uuid, text, text, text)
  to authenticated, service_role;

comment on function public.admin_manage_team_membership(uuid, text, text, text) is
  'Manages one scoped team membership while limiting Primary demotion to the same association.';
