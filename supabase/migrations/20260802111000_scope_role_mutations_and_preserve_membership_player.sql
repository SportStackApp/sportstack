-- Close the remaining scoped role-mutation gaps without changing historical
-- role or membership rows.
--
-- The public wrapper created in 20260802104000 still validates every supplied
-- association, club and team scope. This migration hardens the service-only
-- implementation it calls so a lower-level administrator cannot target an
-- arbitrary profile, existing simple roles can be safely re-saved, and
-- deselected simple roles are removed without deleting PLAYER roles required
-- by active team memberships.

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

  -- Keep mutation scope aligned with admin_visible_profile_ids: a lower-level
  -- administrator may only change a person who has a current membership in a
  -- team that the active mode is authorised to manage.
  return exists (
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
  );
end;
$function$;

revoke all on function public.administration_target_profile_in_scope(uuid, text)
  from public, anon, authenticated;

create or replace function public.admin_save_user_roles_unchecked(
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
declare
  v_actor uuid := auth.uid();
  v_mode text := public.administration_effective_mode(p_actor_mode);
  v_scope jsonb;
  v_old_data jsonb;
  v_new_data jsonb;
  v_association_id uuid;
  v_club_id uuid;
  v_team_id uuid;
begin
  if p_user_id is null or not exists (
    select 1 from public.profiles profile where profile.id = p_user_id
  ) then
    raise exception 'The selected user was not found.';
  end if;
  if p_roles is null or coalesce(array_length(p_roles, 1), 0) = 0 then
    raise exception 'At least one role must remain assigned.';
  end if;
  if exists (
    select 1 from unnest(p_roles) requested(role_name)
    where requested.role_name not in (
      'SUPER_ADMIN', 'ASSOCIATION_ADMIN', 'CLUB_ADMIN', 'TEAM_MANAGER',
      'COACH', 'PLAYER', 'UMPIRE', 'VOTER', 'UMPIRE_ADMIN'
    )
  ) then
    raise exception 'One or more requested roles are not recognised.';
  end if;

  if not public.administration_target_profile_in_scope(p_user_id, v_mode) then
    raise exception using
      errcode = '42501',
      message = 'This user is outside your active administration scope.';
  end if;

  -- Serialise every role replacement for this user. This uses the same lock
  -- key as guard_user_role_duplicate_insert(), so the pre-insert existence
  -- checks below remain safe when two administrators save at the same time.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('user-role:' || p_user_id::text, 0)
  );

  select coalesce(
    jsonb_agg(to_jsonb(role_row) order by role_row.role::text, role_row.id),
    '[]'::jsonb
  )
  into v_old_data
  from public.user_roles role_row
  where role_row.user_id = p_user_id;

  if v_mode = 'super_admin' then
    if p_user_id = v_actor and not ('SUPER_ADMIN' = any(p_roles)) then
      raise exception 'You cannot remove your own Super Admin role.';
    end if;
    delete from public.user_roles role_row
    where role_row.user_id = p_user_id;
  elsif v_mode = 'association' then
    if exists (
      select 1
      from public.user_roles target_role
      where target_role.user_id = p_user_id
        and target_role.role::text in ('SUPER_ADMIN', 'ASSOCIATION_ADMIN')
    ) then
      raise exception 'Association Admins cannot edit Super Admin or peer Association Admin accounts.';
    end if;
    if exists (
      select 1
      from unnest(p_roles) requested(role_name)
      where requested.role_name not in ('PLAYER', 'VOTER', 'CLUB_ADMIN', 'TEAM_MANAGER', 'COACH')
    ) then
      raise exception 'The selected role is above Association Admin authority.';
    end if;
    delete from public.user_roles target_role
    where target_role.user_id = p_user_id
      and target_role.role::text in ('CLUB_ADMIN', 'TEAM_MANAGER', 'COACH')
      and exists (
        select 1
        from public.user_roles actor_role
        where actor_role.user_id = v_actor
          and actor_role.role::text = 'ASSOCIATION_ADMIN'
          and actor_role.association_id = target_role.association_id
      );
  elsif v_mode = 'club' then
    if exists (
      select 1
      from public.user_roles target_role
      where target_role.user_id = p_user_id
        and target_role.role::text in ('SUPER_ADMIN', 'ASSOCIATION_ADMIN', 'CLUB_ADMIN')
    ) then
      raise exception 'Club Admins cannot edit equal or higher-role accounts.';
    end if;
    if exists (
      select 1
      from unnest(p_roles) requested(role_name)
      where requested.role_name not in ('PLAYER', 'VOTER', 'TEAM_MANAGER', 'COACH')
    ) then
      raise exception 'The selected role is above Club Admin authority.';
    end if;
    delete from public.user_roles target_role
    where target_role.user_id = p_user_id
      and target_role.role::text in ('TEAM_MANAGER', 'COACH')
      and exists (
        select 1
        from public.user_roles actor_role
        where actor_role.user_id = v_actor
          and actor_role.role::text = 'CLUB_ADMIN'
          and actor_role.club_id = target_role.club_id
      );
  else
    raise exception 'This mode cannot change user roles.';
  end if;

  if v_mode <> 'super_admin' then
    -- VOTER is discretionary. Remove it when deselected. Existing deployments
    -- use an unscoped VOTER row, while the scoped predicate also safely handles
    -- any legacy scoped rows that belong to this administrator's authority.
    if not ('VOTER' = any(p_roles)) then
      delete from public.user_roles voter_role
      where voter_role.user_id = p_user_id
        and voter_role.role::text = 'VOTER'
        and (
          (
            voter_role.association_id is null
            and voter_role.club_id is null
            and voter_role.team_id is null
          )
          or public.administration_scope_allows(
            v_mode,
            voter_role.association_id,
            voter_role.club_id,
            voter_role.team_id
          )
        );
    end if;

    -- Remove only discretionary or stale PLAYER rows. A team-scoped PLAYER row
    -- backed by an active membership is required by the membership trigger and
    -- must survive a role-dialog save even when PLAYER was deselected.
    if not ('PLAYER' = any(p_roles)) then
      delete from public.user_roles player_role
      where player_role.user_id = p_user_id
        and player_role.role::text = 'PLAYER'
        and (
          (
            player_role.association_id is null
            and player_role.club_id is null
            and player_role.team_id is null
          )
          or public.administration_scope_allows(
            v_mode,
            player_role.association_id,
            player_role.club_id,
            player_role.team_id
          )
        )
        and not exists (
          select 1
          from public.team_memberships membership
          where membership.user_id = player_role.user_id
            and membership.team_id = player_role.team_id
            and membership.status::text = 'ACTIVE'
        );
    end if;
  end if;

  if v_mode = 'super_admin' then
    if 'SUPER_ADMIN' = any(p_roles) then
      insert into public.user_roles (user_id, role)
      values (p_user_id, 'SUPER_ADMIN'::public.user_role_enum);
    end if;
    if 'ASSOCIATION_ADMIN' = any(p_roles)
       and p_association_admin_associations is not null then
      insert into public.user_roles (user_id, role, association_id)
      select p_user_id, 'ASSOCIATION_ADMIN'::public.user_role_enum, association_id
      from unnest(p_association_admin_associations) association_id;
    end if;
    if 'UMPIRE' = any(p_roles) then
      insert into public.user_roles (user_id, role)
      values (p_user_id, 'UMPIRE'::public.user_role_enum);
    end if;
    if 'UMPIRE_ADMIN' = any(p_roles) then
      insert into public.user_roles (user_id, role)
      values (p_user_id, 'UMPIRE_ADMIN'::public.user_role_enum);
    end if;
  end if;

  -- Do not rely on ON CONFLICT here: historical databases do not have a
  -- null-safe unique constraint, and the duplicate guard runs before conflict
  -- handling. Explicit existence checks make unchanged PLAYER/VOTER saves a
  -- true no-op instead of raising a duplicate-role error.
  if 'PLAYER' = any(p_roles) and not exists (
    select 1
    from public.user_roles role_row
    where role_row.user_id = p_user_id
      and role_row.role::text = 'PLAYER'
  ) then
    insert into public.user_roles (user_id, role)
    values (p_user_id, 'PLAYER'::public.user_role_enum);
  end if;
  if 'VOTER' = any(p_roles) and not exists (
    select 1
    from public.user_roles role_row
    where role_row.user_id = p_user_id
      and role_row.role::text = 'VOTER'
  ) then
    insert into public.user_roles (user_id, role)
    values (p_user_id, 'VOTER'::public.user_role_enum);
  end if;

  if 'CLUB_ADMIN' = any(p_roles) and p_club_admin_scopes is not null then
    for v_scope in select value from jsonb_array_elements(p_club_admin_scopes)
    loop
      v_association_id := nullif(v_scope->>'association_id', '')::uuid;
      v_club_id := nullif(v_scope->>'club_id', '')::uuid;
      if v_club_id is null
         or not public.administration_scope_allows(v_mode, v_association_id, v_club_id, null) then
        raise exception 'A Club Admin scope is outside your authority.';
      end if;
      select club.association_id
      into v_association_id
      from public.clubs club
      where club.id = v_club_id;
      insert into public.user_roles (user_id, role, association_id, club_id)
      values (
        p_user_id,
        'CLUB_ADMIN'::public.user_role_enum,
        v_association_id,
        v_club_id
      );
    end loop;
  end if;

  if 'COACH' = any(p_roles) and p_coach_scopes is not null then
    for v_scope in select value from jsonb_array_elements(p_coach_scopes)
    loop
      v_team_id := nullif(v_scope->>'team_id', '')::uuid;
      if v_team_id is null
         or not public.administration_scope_allows(v_mode, null, null, v_team_id) then
        raise exception 'A Coach scope is outside your authority.';
      end if;
      select team.club_id, club.association_id
      into v_club_id, v_association_id
      from public.teams team
      join public.clubs club on club.id = team.club_id
      where team.id = v_team_id;
      insert into public.user_roles (user_id, role, association_id, club_id, team_id)
      values (
        p_user_id,
        'COACH'::public.user_role_enum,
        v_association_id,
        v_club_id,
        v_team_id
      );
    end loop;
  end if;

  if 'TEAM_MANAGER' = any(p_roles) and p_manager_scopes is not null then
    for v_scope in select value from jsonb_array_elements(p_manager_scopes)
    loop
      v_team_id := nullif(v_scope->>'team_id', '')::uuid;
      if v_team_id is null
         or not public.administration_scope_allows(v_mode, null, null, v_team_id) then
        raise exception 'A Team Manager scope is outside your authority.';
      end if;
      select team.club_id, club.association_id
      into v_club_id, v_association_id
      from public.teams team
      join public.clubs club on club.id = team.club_id
      where team.id = v_team_id;
      insert into public.user_roles (user_id, role, association_id, club_id, team_id)
      values (
        p_user_id,
        'TEAM_MANAGER'::public.user_role_enum,
        v_association_id,
        v_club_id,
        v_team_id
      );
    end loop;
  end if;

  select coalesce(
    jsonb_agg(to_jsonb(role_row) order by role_row.role::text, role_row.id),
    '[]'::jsonb
  )
  into v_new_data
  from public.user_roles role_row
  where role_row.user_id = p_user_id;

  insert into public.administration_audit_log (
    actor_id,
    actor_mode,
    action,
    record_type,
    target_user_id,
    old_data,
    new_data
  ) values (
    v_actor,
    v_mode,
    'ROLES_UPDATED',
    'user_roles',
    p_user_id,
    v_old_data,
    v_new_data
  );
end;
$function$;

revoke all on function public.admin_save_user_roles_unchecked(
  uuid, text[], jsonb, jsonb, uuid[], jsonb, text
) from public, anon, authenticated;
grant execute on function public.admin_save_user_roles_unchecked(
  uuid, text[], jsonb, jsonb, uuid[], jsonb, text
) to service_role;

comment on function public.administration_target_profile_in_scope(uuid, text) is
  'Checks that a target profile is inside the signed-in administrator active mode scope before a privileged mutation.';
comment on function public.admin_save_user_roles_unchecked(
  uuid, text[], jsonb, jsonb, uuid[], jsonb, text
) is
  'Service-only implementation behind admin_save_user_roles. Enforces target scope, hierarchy, idempotent simple roles and membership-driven PLAYER preservation.';
