-- Only Super Admins may add or remove the account-wide PLAYER and VOTER
-- roles. Team-scoped PLAYER rows remain managed by team membership workflows.

create or replace function private.assert_account_wide_simple_roles_unchanged(
  p_user_id uuid,
  p_roles text[],
  p_actor_mode text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_mode text := public.administration_effective_mode(p_actor_mode);
  v_requested_player boolean := 'PLAYER' = any(coalesce(p_roles, '{}'::text[]));
  v_requested_voter boolean := 'VOTER' = any(coalesce(p_roles, '{}'::text[]));
  v_has_any_player boolean;
  v_has_global_player boolean;
  v_has_any_voter boolean;
  v_has_global_voter boolean;
begin
  if not public.administration_target_profile_in_scope(p_user_id, v_mode) then
    raise exception using
      errcode = '42501',
      message = 'This user is outside your active administration scope.';
  end if;

  -- Use the same lock as the role replacement function so the check and the
  -- subsequent write cannot race another administrator's save.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('user-role:' || p_user_id::text, 0)
  );

  if v_mode = 'super_admin' then
    return;
  end if;

  select
    coalesce(bool_or(role_row.role::text = 'PLAYER'), false),
    coalesce(bool_or(
      role_row.role::text = 'PLAYER'
      and role_row.association_id is null
      and role_row.club_id is null
      and role_row.team_id is null
    ), false),
    coalesce(bool_or(role_row.role::text = 'VOTER'), false),
    coalesce(bool_or(
      role_row.role::text = 'VOTER'
      and role_row.association_id is null
      and role_row.club_id is null
      and role_row.team_id is null
    ), false)
  into
    v_has_any_player,
    v_has_global_player,
    v_has_any_voter,
    v_has_global_voter
  from public.user_roles role_row
  where role_row.user_id = p_user_id;

  -- The existing save functions add a global row only when no row of that
  -- role exists, and remove the global row when the role is deselected.
  if (not v_requested_player and v_has_global_player)
     or (v_requested_player and not v_has_any_player)
     or (not v_requested_voter and v_has_global_voter)
     or (v_requested_voter and not v_has_any_voter) then
    raise exception using
      errcode = '42501',
      message = 'Only a Super Admin can change account-wide Player or Voter roles.';
  end if;
end;
$function$;

revoke all on function private.assert_account_wide_simple_roles_unchanged(
  uuid, text[], text
) from public, anon, authenticated;
grant execute on function private.assert_account_wide_simple_roles_unchanged(
  uuid, text[], text
) to service_role;

-- Preserve the hardened B1 implementation behind a service-only name, then
-- expose the original signature through the policy check above.
alter function public.admin_save_user_roles(
  uuid, text[], jsonb, jsonb, uuid[], jsonb, text
) rename to admin_save_user_roles_b1_core;

revoke all on function public.admin_save_user_roles_b1_core(
  uuid, text[], jsonb, jsonb, uuid[], jsonb, text
) from public, anon, authenticated;
grant execute on function public.admin_save_user_roles_b1_core(
  uuid, text[], jsonb, jsonb, uuid[], jsonb, text
) to service_role;

create or replace function public.admin_save_user_roles(
  p_user_id uuid,
  p_roles text[],
  p_coach_scopes jsonb,
  p_manager_scopes jsonb,
  p_association_admin_associations uuid[],
  p_club_admin_scopes jsonb,
  p_actor_mode text
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
begin
  perform private.assert_account_wide_simple_roles_unchanged(
    p_user_id,
    p_roles,
    p_actor_mode
  );

  perform public.admin_save_user_roles_b1_core(
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

revoke all on function public.admin_save_user_roles(
  uuid, text[], jsonb, jsonb, uuid[], jsonb, text
) from public, anon;
grant execute on function public.admin_save_user_roles(
  uuid, text[], jsonb, jsonb, uuid[], jsonb, text
) to authenticated, service_role;

-- Dev has a broader Coordination-aware save function. Production does not.
-- Wrap it only where it already exists so this migration cannot introduce a
-- Production feature that is outside the frozen B1 allow-list.
do $migration$
begin
  if to_regprocedure(
    'public.admin_save_user_access(uuid,text[],jsonb,jsonb,uuid[],jsonb,uuid[],jsonb,text)'
  ) is not null then
    execute $sql$
      alter function public.admin_save_user_access(
        uuid, text[], jsonb, jsonb, uuid[], jsonb, uuid[], jsonb, text
      ) rename to admin_save_user_access_b1_core
    $sql$;

    execute $sql$
      revoke all on function public.admin_save_user_access_b1_core(
        uuid, text[], jsonb, jsonb, uuid[], jsonb, uuid[], jsonb, text
      ) from public, anon, authenticated
    $sql$;
    execute $sql$
      grant execute on function public.admin_save_user_access_b1_core(
        uuid, text[], jsonb, jsonb, uuid[], jsonb, uuid[], jsonb, text
      ) to service_role
    $sql$;

    execute $definition$
      create function public.admin_save_user_access(
        p_user_id uuid,
        p_roles text[],
        p_coach_scopes jsonb default null,
        p_manager_scopes jsonb default null,
        p_association_admin_associations uuid[] default null,
        p_club_admin_scopes jsonb default null,
        p_umpire_associations uuid[] default null,
        p_coordination_responsibilities jsonb default '[]'::jsonb,
        p_actor_mode text default null
      )
      returns void
      language plpgsql
      security definer
      set search_path = ''
      as $wrapper$
      begin
        -- Match the core function's lock order before taking the role lock.
        perform pg_catalog.pg_advisory_xact_lock(
          pg_catalog.hashtextextended('user-access:' || p_user_id::text, 0)
        );

        perform private.assert_account_wide_simple_roles_unchanged(
          p_user_id,
          p_roles,
          p_actor_mode
        );

        perform public.admin_save_user_access_b1_core(
          p_user_id,
          p_roles,
          p_coach_scopes,
          p_manager_scopes,
          p_association_admin_associations,
          p_club_admin_scopes,
          p_umpire_associations,
          p_coordination_responsibilities,
          p_actor_mode
        );
      end;
      $wrapper$
    $definition$;

    execute $sql$
      revoke all on function public.admin_save_user_access(
        uuid, text[], jsonb, jsonb, uuid[], jsonb, uuid[], jsonb, text
      ) from public, anon
    $sql$;
    execute $sql$
      grant execute on function public.admin_save_user_access(
        uuid, text[], jsonb, jsonb, uuid[], jsonb, uuid[], jsonb, text
      ) to authenticated, service_role
    $sql$;
  end if;
end;
$migration$;

comment on function private.assert_account_wide_simple_roles_unchanged(
  uuid, text[], text
) is 'Blocks non-Super-Admin changes to fully unscoped PLAYER and VOTER roles.';
