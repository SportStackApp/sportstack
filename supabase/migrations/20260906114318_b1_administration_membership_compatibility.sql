-- B1e: Production-compatible administration and general membership bridge.
--
-- This migration recreates only the functions required by the allow-listed
-- Users and Requests screens. It does not copy Coordination, Dev test-account
-- provisioning, Edge Functions, workflows or historical data.
--
-- The six-argument role function is retained as a hardened compatibility
-- wrapper for the current Production browser bundle. The seven-argument
-- function has no defaults so PostgREST can resolve both overloads safely.

-- PostgreSQL cannot remove parameter defaults with CREATE OR REPLACE.
-- Drop only this browser wrapper, without CASCADE, before recreating its safe
-- six- and seven-argument compatibility signatures below.
drop function if exists public.admin_save_user_roles(
  uuid, text[], jsonb, jsonb, uuid[], jsonb, text
);

alter table public.requests
  drop constraint if exists requests_membership_type_check;
alter table public.requests
  add constraint requests_membership_type_check
  check (membership_type in ('PRIMARY', 'SECONDARY', 'FILL_IN'));

create or replace function public.guard_team_membership_integrity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE'
     and new.user_id is not distinct from old.user_id
     and new.team_id is not distinct from old.team_id
     and new.status is not distinct from old.status
     and new.membership_type is not distinct from old.membership_type then
    return new;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('membership-user:' || new.user_id::text, 0)
  );

  if new.status::text in ('ACTIVE', 'PENDING') and exists (
    select 1
    from public.team_memberships membership
    where membership.user_id = new.user_id
      and membership.team_id = new.team_id
      and membership.status::text in ('ACTIVE', 'PENDING')
      and membership.id <> new.id
  ) then
    raise exception 'This person already has an active or pending membership for that team.';
  end if;

  if new.status::text = 'ACTIVE'
     and new.membership_type::text = 'PRIMARY'
     and exists (
       select 1
       from public.team_memberships membership
       where membership.user_id = new.user_id
         and membership.status::text = 'ACTIVE'
         and membership.membership_type::text = 'PRIMARY'
         and membership.id <> new.id
     ) then
    raise exception 'This person already has an active primary team.';
  end if;

  return new;
end;
$$;

create or replace function public.guard_user_role_duplicate_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('user-role:' || new.user_id::text, 0)
  );

  if exists (
    select 1
    from public.user_roles role_row
    where role_row.user_id = new.user_id
      and role_row.role is not distinct from new.role
      and role_row.association_id is not distinct from new.association_id
      and role_row.club_id is not distinct from new.club_id
      and role_row.team_id is not distinct from new.team_id
  ) then
    raise exception using
      errcode = '23505',
      message = 'This user already has that role in the same scope.';
  end if;

  return new;
end;
$function$;

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

create or replace function public.admin_update_profile_details(
  p_user_id uuid,
  p_details jsonb,
  p_actor_mode text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_mode text := public.administration_effective_mode(p_actor_mode);
  v_old public.profiles%rowtype;
  v_new public.profiles%rowtype;
  v_target_team_id uuid;
  v_target_club_id uuid;
  v_target_association_id uuid;
begin
  select profile.* into v_old from public.profiles profile where profile.id = p_user_id for update;
  if not found then raise exception 'The selected user was not found.'; end if;

  if v_mode = 'super_admin' then
    null;
  else
    select team.id, club.id, club.association_id
    into v_target_team_id, v_target_club_id, v_target_association_id
    from public.team_memberships membership
    join public.teams team on team.id = membership.team_id
    join public.clubs club on club.id = team.club_id
    where membership.user_id = p_user_id
      and membership.status::text in ('ACTIVE','PENDING','INVITED')
      and public.administration_scope_allows(v_mode, club.association_id, club.id, team.id)
    order by (membership.status::text = 'ACTIVE') desc, membership.created_at
    limit 1;
    if not found then raise exception 'This user is outside your active administration scope.'; end if;

    if (v_mode = 'association' and exists (
      select 1 from public.user_roles r where r.user_id = p_user_id and r.role::text in ('SUPER_ADMIN','ASSOCIATION_ADMIN')
    )) or (v_mode = 'club' and exists (
      select 1 from public.user_roles r where r.user_id = p_user_id and r.role::text in ('SUPER_ADMIN','ASSOCIATION_ADMIN','CLUB_ADMIN')
    )) or v_mode = 'team_manager' then
      raise exception 'You cannot edit this account from the selected mode.';
    end if;
  end if;

  update public.profiles profile
  set
    first_name = case when p_details ? 'first_name' then nullif(trim(p_details->>'first_name'),'') else profile.first_name end,
    last_name = case when p_details ? 'last_name' then nullif(trim(p_details->>'last_name'),'') else profile.last_name end,
    phone = case when p_details ? 'phone' then nullif(trim(p_details->>'phone'),'') else profile.phone end,
    street_address = case when p_details ? 'street_address' then nullif(trim(p_details->>'street_address'),'') else profile.street_address end,
    suburb = case when p_details ? 'suburb' then nullif(trim(p_details->>'suburb'),'') else profile.suburb end,
    date_of_birth = case when p_details ? 'date_of_birth' and nullif(trim(p_details->>'date_of_birth'),'') is not null
      then (p_details->>'date_of_birth')::date
      when p_details ? 'date_of_birth' then null else profile.date_of_birth end,
    gender = case when p_details ? 'gender' then nullif(trim(p_details->>'gender'),'') else profile.gender end,
    emergency_contact_name = case when p_details ? 'emergency_contact_name' then nullif(trim(p_details->>'emergency_contact_name'),'') else profile.emergency_contact_name end,
    emergency_contact_phone = case when p_details ? 'emergency_contact_phone' then nullif(trim(p_details->>'emergency_contact_phone'),'') else profile.emergency_contact_phone end,
    updated_at = now()
  where profile.id = p_user_id
  returning profile.* into v_new;

  insert into public.administration_audit_log (
    actor_id, actor_mode, action, record_type, record_id, target_user_id,
    association_id, club_id, team_id, old_data, new_data
  ) values (
    v_actor, v_mode, 'PROFILE_DETAILS_UPDATED', 'profile', p_user_id, p_user_id,
    v_target_association_id, v_target_club_id, v_target_team_id,
    to_jsonb(v_old) - 'avatar_url', to_jsonb(v_new) - 'avatar_url'
  );

  return to_jsonb(v_new);
end;
$$;

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
as $$
declare
  v_actor uuid := auth.uid();
  v_mode text := public.administration_effective_mode(p_actor_mode);
  v_membership public.team_memberships%rowtype;
  v_old_data jsonb;
  v_new_data jsonb;
  v_association_id uuid;
  v_club_id uuid;
  v_action text := upper(trim(coalesce(p_action,'')));
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
  if v_mode = 'coach' or v_mode = 'player' then
    raise exception 'This mode cannot manage memberships.';
  end if;
  if (v_mode = 'association' and exists (
      select 1 from public.user_roles r where r.user_id = v_membership.user_id and r.role::text in ('SUPER_ADMIN','ASSOCIATION_ADMIN')
    )) or (v_mode = 'club' and exists (
      select 1 from public.user_roles r where r.user_id = v_membership.user_id and r.role::text in ('SUPER_ADMIN','ASSOCIATION_ADMIN','CLUB_ADMIN')
    )) or (v_mode = 'team_manager' and exists (
      select 1 from public.user_roles r where r.user_id = v_membership.user_id and r.role::text in ('SUPER_ADMIN','ASSOCIATION_ADMIN','CLUB_ADMIN','TEAM_MANAGER')
    )) then
    raise exception 'You cannot edit an equal or higher-role account.';
  end if;

  v_old_data := to_jsonb(v_membership);
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('membership-user:' || v_membership.user_id::text, 0)
  );

  if v_action = 'APPROVE' then
    update public.team_memberships set status = 'ACTIVE' where id = p_membership_id;
  elsif v_action = 'DECLINE' then
    update public.team_memberships set status = 'INACTIVE' where id = p_membership_id;
  elsif v_action = 'MAKE_PRIMARY' then
    update public.team_memberships
    set membership_type = 'SECONDARY'
    where user_id = v_membership.user_id and membership_type::text = 'PRIMARY' and id <> p_membership_id;
    update public.team_memberships
    set membership_type = 'PRIMARY', status = 'ACTIVE'
    where id = p_membership_id;
  elsif v_action = 'CHANGE_TYPE' then
    if upper(coalesce(p_membership_type,'')) not in ('PRIMARY','SECONDARY','FILL_IN') then
      raise exception 'The membership type is not recognised.';
    end if;
    if upper(p_membership_type) = 'PRIMARY' then
      update public.team_memberships
      set membership_type = 'SECONDARY'
      where user_id = v_membership.user_id and membership_type::text = 'PRIMARY' and id <> p_membership_id;
    end if;
    update public.team_memberships
    set membership_type = upper(p_membership_type)::public.membership_type_enum
    where id = p_membership_id;
  elsif v_action = 'REMOVE' then
    delete from public.team_memberships where id = p_membership_id;
  else
    raise exception 'The membership action is not recognised.';
  end if;

  select to_jsonb(membership) into v_new_data
  from public.team_memberships membership where membership.id = p_membership_id;

  insert into public.administration_audit_log (
    actor_id, actor_mode, action, record_type, record_id, target_user_id,
    association_id, club_id, team_id, old_data, new_data
  ) values (
    v_actor, v_mode, 'MEMBERSHIP_' || v_action, 'team_membership', p_membership_id,
    v_membership.user_id, v_association_id, v_club_id, v_membership.team_id, v_old_data, v_new_data
  );

  return jsonb_build_object('membership_id', p_membership_id, 'action', v_action, 'membership', v_new_data);
end;
$$;

create or replace function public.admin_create_team_invite(
  p_target_user_id uuid,
  p_team_id uuid,
  p_membership_type text,
  p_actor_mode text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_mode text := public.administration_effective_mode(p_actor_mode);
  v_club_id uuid;
  v_association_id uuid;
  v_request_id uuid;
begin
  select team.club_id, club.association_id into v_club_id, v_association_id
  from public.teams team join public.clubs club on club.id = team.club_id where team.id = p_team_id;
  if not found then raise exception 'The selected team was not found.'; end if;
  if not public.administration_scope_allows(v_mode, v_association_id, v_club_id, p_team_id)
     or v_mode in ('coach','player') then
    raise exception 'You do not have permission to invite members to this team.';
  end if;
  if upper(coalesce(p_membership_type,'')) not in ('PRIMARY','SECONDARY','FILL_IN') then
    raise exception 'The membership type is not recognised.';
  end if;
  if exists (
    select 1 from public.team_memberships membership
    where membership.user_id = p_target_user_id and membership.team_id = p_team_id
      and membership.status::text in ('ACTIVE','PENDING')
  ) or exists (
    select 1 from public.requests request_row
    where request_row.target_user_id = p_target_user_id and request_row.team_id = p_team_id
      and request_row.request_type::text = 'TEAM_INVITE' and request_row.status::text = 'PENDING'
  ) then raise exception 'This person already has an active or pending membership for that team.'; end if;
  if upper(p_membership_type) = 'PRIMARY' and exists (
    select 1 from public.requests request_row
    where request_row.target_user_id = p_target_user_id
      and request_row.request_type::text = 'TEAM_INVITE'
      and request_row.status::text = 'PENDING'
      and request_row.membership_type = 'PRIMARY'
  ) then raise exception 'This person already has a pending primary team request.'; end if;

  insert into public.requests (
    request_type, requester_id, target_user_id, team_id, association_id, club_id,
    membership_type, status
  ) values (
    'TEAM_INVITE', v_actor, p_target_user_id, p_team_id, v_association_id, v_club_id,
    upper(p_membership_type), 'PENDING'
  ) returning id into v_request_id;

  insert into public.administration_audit_log (
    actor_id, actor_mode, action, record_type, record_id, target_user_id,
    association_id, club_id, team_id, new_data
  ) values (
    v_actor, v_mode, 'TEAM_INVITE_CREATED', 'request', v_request_id, p_target_user_id,
    v_association_id, v_club_id, p_team_id,
    jsonb_build_object('membership_type', upper(p_membership_type), 'status', 'PENDING')
  );
  return v_request_id;
end;
$$;

create or replace function public.admin_cancel_team_invite(
  p_request_id uuid,
  p_actor_mode text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_mode text := public.administration_effective_mode(p_actor_mode);
  v_request public.requests%rowtype;
  v_club_id uuid;
  v_association_id uuid;
begin
  select request_row.* into v_request from public.requests request_row where request_row.id = p_request_id for update;
  if not found or v_request.request_type::text <> 'TEAM_INVITE' then raise exception 'The team invite was not found.'; end if;
  select team.club_id, club.association_id into v_club_id, v_association_id
  from public.teams team join public.clubs club on club.id = team.club_id where team.id = v_request.team_id;
  if not public.administration_scope_allows(v_mode, v_association_id, v_club_id, v_request.team_id)
     or v_mode in ('coach','player') then
    raise exception 'You do not have permission to cancel this team invite.';
  end if;
  if v_request.status::text <> 'PENDING' then raise exception 'Only pending team invites can be cancelled.'; end if;
  update public.requests set status = 'CANCELLED', cancelled_by = v_actor, updated_at = now() where id = p_request_id;
  insert into public.administration_audit_log (
    actor_id, actor_mode, action, record_type, record_id, target_user_id,
    association_id, club_id, team_id, old_data, new_data
  ) values (
    v_actor, v_mode, 'TEAM_INVITE_CANCELLED', 'request', p_request_id, v_request.target_user_id,
    v_association_id, v_club_id, v_request.team_id, to_jsonb(v_request), jsonb_build_object('status','CANCELLED')
  );
end;
$$;

create or replace function public.admin_membership_integrity_report()
returns table (
  issue_type text,
  user_id uuid,
  team_id uuid,
  membership_ids uuid[],
  row_count bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  with duplicate_team as (
    select
      'DUPLICATE_USER_TEAM'::text issue_type,
      membership.user_id,
      membership.team_id,
      array_agg(membership.id order by membership.created_at, membership.id) membership_ids,
      count(*) row_count
    from public.team_memberships membership
    where membership.status::text in ('ACTIVE','PENDING')
    group by membership.user_id, membership.team_id
    having count(*) > 1
  ), multiple_primary as (
    select
      'MULTIPLE_ACTIVE_PRIMARY'::text issue_type,
      membership.user_id,
      null::uuid team_id,
      array_agg(membership.id order by membership.created_at, membership.id) membership_ids,
      count(*) row_count
    from public.team_memberships membership
    where membership.status::text = 'ACTIVE' and membership.membership_type::text = 'PRIMARY'
    group by membership.user_id
    having count(*) > 1
  )
  select * from duplicate_team
  union all
  select * from multiple_primary
  order by issue_type, user_id, team_id nulls first
$$;

create or replace function public.approve_membership_request(
  p_request_id uuid,
  p_assign_team boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor_id uuid := auth.uid();
  v_request public.requests%rowtype;
  v_team_id uuid;
  v_club_id uuid;
  v_association_id uuid;
  v_membership_id uuid;
  v_existing_membership_count integer := 0;
  v_membership_changed boolean := false;
begin
  if v_actor_id is null then
    raise exception 'You must be signed in to approve membership requests.';
  end if;

  select request_row.*
  into v_request
  from public.requests request_row
  where request_row.id = p_request_id
  for update;

  if not found then
    raise exception 'The membership request was not found.';
  end if;

  if v_request.status::text <> 'PENDING' then
    raise exception 'Only a pending membership request can be approved.';
  end if;

  v_team_id := v_request.team_id;
  v_club_id := v_request.club_id;
  v_association_id := v_request.association_id;

  if v_team_id is not null then
    select team.club_id, club.association_id
    into v_club_id, v_association_id
    from public.teams team
    join public.clubs club on club.id = team.club_id
    where team.id = v_team_id;

    if not found then
      raise exception 'The requested team was not found.';
    end if;

    if v_request.club_id is not null and v_request.club_id <> v_club_id then
      raise exception 'The request club does not match the requested team.';
    end if;
    if v_request.association_id is not null and v_request.association_id <> v_association_id then
      raise exception 'The request association does not match the requested team.';
    end if;
  elsif v_club_id is not null then
    select club.association_id
    into v_association_id
    from public.clubs club
    where club.id = v_club_id;

    if not found then
      raise exception 'The requested club was not found.';
    end if;

    if v_request.association_id is not null and v_request.association_id <> v_association_id then
      raise exception 'The request association does not match the requested club.';
    end if;
  end if;

  if not exists (
    select 1
    from public.user_roles role_row
    where role_row.user_id = v_actor_id
      and (
        role_row.role::text = 'SUPER_ADMIN'
        or (
          role_row.role::text = 'ASSOCIATION_ADMIN'
          and v_association_id is not null
          and role_row.association_id = v_association_id
        )
        or (
          role_row.role::text = 'CLUB_ADMIN'
          and v_club_id is not null
          and role_row.club_id = v_club_id
        )
        or (
          role_row.role::text = 'TEAM_MANAGER'
          and v_team_id is not null
          and role_row.team_id = v_team_id
        )
      )
  ) then
    raise exception 'You do not have permission to approve this membership request.';
  end if;

  if p_assign_team and v_team_id is not null then
    if v_request.membership_type not in ('PRIMARY', 'SECONDARY', 'FILL_IN') then
      raise exception 'The requested membership type is not supported.';
    end if;

    -- Serialise all membership approvals for this person. This prevents two
    -- simultaneous approvals from creating duplicate rows or two primaries.
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended('membership-user:' || v_request.target_user_id::text, 0)
    );

    select count(*), (array_agg(membership.id order by membership.id))[1]
    into v_existing_membership_count, v_membership_id
    from public.team_memberships membership
    where membership.user_id = v_request.target_user_id
      and membership.team_id = v_team_id;

    if v_existing_membership_count > 1 then
      raise exception 'This person already has duplicate membership records for the requested team. Review the user before approving.';
    end if;

    if v_request.membership_type = 'PRIMARY' then
      update public.team_memberships membership
      set membership_type = 'SECONDARY'::public.membership_type_enum
      where membership.user_id = v_request.target_user_id
        and membership.team_id <> v_team_id
        and membership.membership_type = 'PRIMARY'::public.membership_type_enum;
    end if;

    if v_existing_membership_count = 0 then
      insert into public.team_memberships (
        user_id,
        team_id,
        membership_type,
        status,
        invited_by
      )
      values (
        v_request.target_user_id,
        v_team_id,
        v_request.membership_type::public.membership_type_enum,
        'ACTIVE'::public.membership_status_enum,
        v_actor_id
      )
      returning id into v_membership_id;
    else
      update public.team_memberships membership
      set
        membership_type = v_request.membership_type::public.membership_type_enum,
        status = 'ACTIVE'::public.membership_status_enum,
        invited_by = coalesce(membership.invited_by, v_actor_id)
      where membership.id = v_membership_id;
    end if;

    v_membership_changed := true;
  end if;

  update public.requests request_row
  set
    status = 'APPROVED'::public.request_status_enum,
    responded_by = v_actor_id,
    updated_at = now()
  where request_row.id = p_request_id;

  return jsonb_build_object(
    'request_id', p_request_id,
    'status', 'APPROVED',
    'team_assigned', v_membership_changed,
    'membership_id', v_membership_id
  );
end;
$function$;

create or replace function public.admin_save_user_roles(
  p_user_id uuid,
  p_roles text[],
  p_coach_scopes jsonb default null,
  p_manager_scopes jsonb default null,
  p_association_admin_associations uuid[] default null,
  p_club_admin_scopes jsonb default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
begin
  perform public.admin_save_user_roles(
    p_user_id,
    p_roles,
    p_coach_scopes,
    p_manager_scopes,
    p_association_admin_associations,
    p_club_admin_scopes,
    null
  );
end;
$function$;

drop trigger if exists team_membership_integrity_guard
  on public.team_memberships;
create trigger team_membership_integrity_guard
before insert or update of user_id, team_id, status, membership_type
on public.team_memberships
for each row execute function public.guard_team_membership_integrity();

drop trigger if exists user_role_duplicate_insert_guard
  on public.user_roles;
create trigger user_role_duplicate_insert_guard
before insert on public.user_roles
for each row execute function public.guard_user_role_duplicate_insert();

-- Trigger and implementation helpers are never browser-callable.
revoke all on function public.guard_team_membership_integrity()
  from public, anon, authenticated;
revoke all on function public.guard_user_role_duplicate_insert()
  from public, anon, authenticated;
revoke all on function public.administration_target_profile_in_scope(uuid, text)
  from public, anon, authenticated;
revoke all on function public.admin_save_user_roles_unchecked(
  uuid, text[], jsonb, jsonb, uuid[], jsonb, text
) from public, anon, authenticated;
revoke all on function public.admin_membership_integrity_report()
  from public, anon, authenticated;

grant execute on function public.guard_team_membership_integrity() to service_role;
grant execute on function public.guard_user_role_duplicate_insert() to service_role;
grant execute on function public.administration_target_profile_in_scope(uuid, text)
  to service_role;
grant execute on function public.admin_save_user_roles_unchecked(
  uuid, text[], jsonb, jsonb, uuid[], jsonb, text
) to service_role;
grant execute on function public.admin_membership_integrity_report() to service_role;

-- These are the browser-facing administration functions.
revoke all on function public.admin_visible_profile_ids(text, uuid, uuid, uuid)
  from public, anon;
revoke all on function public.admin_update_profile_details(uuid, jsonb, text)
  from public, anon;
revoke all on function public.admin_save_user_roles(
  uuid, text[], jsonb, jsonb, uuid[], jsonb, text
) from public, anon;
revoke all on function public.admin_save_user_roles(
  uuid, text[], jsonb, jsonb, uuid[], jsonb
) from public, anon;
revoke all on function public.admin_manage_team_membership(uuid, text, text, text)
  from public, anon;
revoke all on function public.admin_create_team_invite(uuid, uuid, text, text)
  from public, anon;
revoke all on function public.admin_cancel_team_invite(uuid, text)
  from public, anon;
revoke all on function public.approve_membership_request(uuid, boolean)
  from public, anon;

grant execute on function public.admin_visible_profile_ids(text, uuid, uuid, uuid)
  to authenticated, service_role;
grant execute on function public.admin_update_profile_details(uuid, jsonb, text)
  to authenticated, service_role;
grant execute on function public.admin_save_user_roles(
  uuid, text[], jsonb, jsonb, uuid[], jsonb, text
) to authenticated, service_role;
grant execute on function public.admin_save_user_roles(
  uuid, text[], jsonb, jsonb, uuid[], jsonb
) to authenticated, service_role;
grant execute on function public.admin_manage_team_membership(uuid, text, text, text)
  to authenticated, service_role;
grant execute on function public.admin_create_team_invite(uuid, uuid, text, text)
  to authenticated, service_role;
grant execute on function public.admin_cancel_team_invite(uuid, text)
  to authenticated, service_role;
grant execute on function public.approve_membership_request(uuid, boolean)
  to authenticated, service_role;
