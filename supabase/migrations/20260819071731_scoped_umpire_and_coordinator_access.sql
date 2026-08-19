-- Scoped Umpire and coordinator access.
--
-- Dev dry-run evidence captured before this migration:
--   17 UMPIRE rows / 17 people; 16 unscoped and one Hockey Ballarat row.
--   Current organisation evidence: Admin Sportstack, Ben Sturmfels,
--   Craig Stevens, Daniel Ryan, Ethan Oldaker, Hayden Bourne, Jeff Sly,
--   Joshua Sly, Mitchell Stevens, Nicholas Hargreaves,
--   Sara Weuffen-Humphrey, Tucker Kooloos and Codex Umpire Test.
--   Confirmed Hockey Ballarat Umpire Portal origin: I Edgar, L Drury,
--   Lily Drury and Shepherd J.
-- No profiles, names, emails, team memberships or historical mappings are
-- changed by this migration.

alter table public.permission_sets
  add column if not exists system_key text;

alter table public.permission_sets
  drop constraint if exists permission_sets_system_key_check;
alter table public.permission_sets
  add constraint permission_sets_system_key_check check (
    system_key is null or system_key in (
      'UMPIRE_COORDINATOR',
      'TECHNICAL_BENCH_COORDINATOR',
      'VOLUNTEER_COORDINATOR'
    )
  );

create unique index if not exists permission_sets_system_scope_key
  on public.permission_sets (system_key, owner_scope_type, owner_scope_id)
  where system_key is not null;

create or replace function private.protect_coordination_system_permission_set()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if (case when tg_op = 'DELETE' then old.system_key else coalesce(old.system_key, new.system_key) end) is not null
     and coalesce(current_setting('sportstack.coordinator_bundle_write', true), '') <> 'on' then
    raise exception 'Coordinator permission bundles are managed through User Management.';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$function$;

drop trigger if exists protect_coordination_system_permission_set on public.permission_sets;
create trigger protect_coordination_system_permission_set
before update or delete on public.permission_sets
for each row execute function private.protect_coordination_system_permission_set();

create or replace function private.protect_coordination_system_set_child()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_set_id uuid;
begin
  v_set_id := case when tg_op = 'DELETE' then old.permission_set_id else new.permission_set_id end;
  if exists (
    select 1 from public.permission_sets set_row
    where set_row.id = v_set_id and set_row.system_key is not null
  ) and coalesce(current_setting('sportstack.coordinator_bundle_write', true), '') <> 'on' then
    raise exception 'Coordinator permission bundles are managed through User Management.';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$function$;

drop trigger if exists protect_coordination_system_set_permissions on public.permission_set_permissions;
create trigger protect_coordination_system_set_permissions
before insert or update or delete on public.permission_set_permissions
for each row execute function private.protect_coordination_system_set_child();

drop trigger if exists protect_coordination_system_assignments on public.permission_assignments;
create trigger protect_coordination_system_assignments
before insert or update or delete on public.permission_assignments
for each row execute function private.protect_coordination_system_set_child();

create or replace function private.coordination_direct_bundle_allowed(
  p_permission text,
  p_association_id uuid,
  p_club_id uuid default null,
  p_team_id uuid default null
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_fixture_id uuid;
begin
  if auth.uid() is null then return false; end if;

  begin
    v_fixture_id := nullif(current_setting('sportstack.coordination_fixture_id', true), '')::uuid;
  exception when invalid_text_representation then
    v_fixture_id := null;
  end;

  return exists (
    select 1
    from public.permission_assignments assignment
    join public.permission_sets set_row
      on set_row.id = assignment.permission_set_id
     and set_row.active
     and set_row.system_key is not null
    join public.permission_set_permissions set_permission
      on set_permission.permission_set_id = set_row.id
     and set_permission.permission_key = p_permission
     and set_permission.allowed
    where assignment.active
      and assignment.subject_type = 'USER'
      and assignment.subject_key = auth.uid()::text
      and assignment.scope_type = set_row.owner_scope_type
      and assignment.scope_id = set_row.owner_scope_id
      and (
        (
          assignment.scope_type = 'ASSOCIATION'
          and assignment.scope_id = p_association_id
        )
        or (
          assignment.scope_type = 'CLUB'
          and assignment.scope_id = p_club_id
        )
        or (
          p_permission = 'coordination.technical_bench.manage'
          and assignment.scope_type = 'CLUB'
          and v_fixture_id is not null
          and exists (
            select 1
            from public.fixtures fixture
            join public.teams home_team on home_team.id = fixture.home_team_id
            left join public.teams away_team on away_team.id = fixture.away_team_id
            join public.clubs home_club on home_club.id = home_team.club_id
            where fixture.id = v_fixture_id
              and home_club.association_id = p_association_id
              and assignment.scope_id in (home_team.club_id, away_team.club_id)
          )
        )
      )
  );
end;
$function$;

create or replace function private.coordination_permission_allowed(
  p_permission text,
  p_actor_mode text,
  p_association_id uuid,
  p_club_id uuid default null,
  p_team_id uuid default null
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_result jsonb;
begin
  if auth.uid() is null then return false; end if;
  if public.is_super_admin()
     and public.administration_effective_mode(p_actor_mode) = 'super_admin' then
    return true;
  end if;

  begin
    v_result := public.resolve_effective_permission_for_mode(
      p_permission,
      p_actor_mode,
      p_association_id,
      p_club_id,
      null,
      p_team_id
    );
    if coalesce((v_result->>'allowed')::boolean, false) then return true; end if;
  exception when others then
    null;
  end;

  return private.coordination_direct_bundle_allowed(
    p_permission,
    p_association_id,
    p_club_id,
    p_team_id
  );
end;
$function$;

create or replace function private.coordination_user_has_capability(
  p_user_id uuid,
  p_capability text,
  p_association_id uuid,
  p_club_id uuid default null,
  p_team_id uuid default null,
  p_on_date date default current_date
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select
    (
      p_capability = 'UMPIRE'
      and exists (
        select 1
        from public.user_roles role_row
        where role_row.user_id = p_user_id
          and role_row.role::text = 'UMPIRE'
          and role_row.association_id = p_association_id
          and role_row.club_id is null
          and role_row.team_id is null
      )
    )
    or (
      p_capability <> 'UMPIRE'
      and exists (
        select 1
        from public.coordination_capabilities capability
        where capability.user_id = p_user_id
          and capability.capability_type = p_capability
          and capability.active
          and capability.active_from <= p_on_date
          and (capability.active_until is null or capability.active_until >= p_on_date)
          and (
            (capability.scope_type = 'ASSOCIATION' and capability.scope_id = p_association_id)
            or (capability.scope_type = 'CLUB' and capability.scope_id = p_club_id)
            or (capability.scope_type = 'TEAM' and capability.scope_id = p_team_id)
          )
      )
    );
$function$;

-- The role itself is now the association-scoped Umpire capability. It never
-- implies Supervising Umpire and cannot be stored without an association.
alter table public.user_roles
  drop constraint if exists user_roles_umpire_association_scope_check;

do $backfill$
declare
  v_hockey_ballarat_id uuid;
  v_role_count integer;
  v_person_count integer;
begin
  select association.id into v_hockey_ballarat_id
  from public.associations association
  where lower(btrim(association.name)) = 'hockey ballarat';

  if v_hockey_ballarat_id is null then
    raise exception 'Hockey Ballarat association was not found.';
  end if;

  select count(*), count(distinct role_row.user_id)
  into v_role_count, v_person_count
  from public.user_roles role_row
  where role_row.role::text = 'UMPIRE';

  if v_role_count <> 17 or v_person_count <> 17 then
    raise exception 'Expected 17 Umpire rows for 17 people; found % rows for % people.',
      v_role_count, v_person_count;
  end if;

  update public.user_roles role_row
  set association_id = v_hockey_ballarat_id,
      club_id = null,
      team_id = null
  where role_row.role::text = 'UMPIRE'
    and (
      role_row.association_id is distinct from v_hockey_ballarat_id
      or role_row.club_id is not null
      or role_row.team_id is not null
    );

  if exists (
    select 1
    from public.user_roles role_row
    where role_row.role::text = 'UMPIRE'
      and (
        role_row.association_id <> v_hockey_ballarat_id
        or role_row.association_id is null
        or role_row.club_id is not null
        or role_row.team_id is not null
      )
  ) then
    raise exception 'Umpire backfill verification failed.';
  end if;
end;
$backfill$;

alter table public.user_roles
  add constraint user_roles_umpire_association_scope_check check (
    role::text <> 'UMPIRE'
    or (association_id is not null and club_id is null and team_id is null)
  );

create or replace function public.admin_save_user_access(
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
as $function$
declare
  v_actor uuid := auth.uid();
  v_mode text := public.administration_effective_mode(p_actor_mode);
  v_base_roles text[];
  v_used_player_sentinel boolean := false;
  v_had_legacy_umpire_admin boolean;
  v_requested_legacy_umpire_admin boolean := 'UMPIRE_ADMIN' = any(p_roles);
  v_existing_umpire_associations uuid[];
  v_scope jsonb;
  v_responsibility text;
  v_scope_type text;
  v_scope_id uuid;
  v_association_id uuid;
  v_club_id uuid;
  v_set_id uuid;
  v_permissions text[];
  v_old_coordination jsonb;
  v_new_coordination jsonb;
begin
  if v_actor is null then raise exception 'You must be signed in.'; end if;
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
  if jsonb_typeof(coalesce(p_coordination_responsibilities, '[]'::jsonb)) <> 'array' then
    raise exception 'Coordinator responsibilities must be supplied as a list.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('user-access:' || p_user_id::text, 0)
  );

  select exists (
    select 1 from public.user_roles role_row
    where role_row.user_id = p_user_id and role_row.role::text = 'UMPIRE_ADMIN'
  ) into v_had_legacy_umpire_admin;

  if v_requested_legacy_umpire_admin and not v_had_legacy_umpire_admin then
    raise exception 'Legacy Umpire Admin cannot be newly assigned.';
  end if;
  if v_mode <> 'super_admin'
     and v_requested_legacy_umpire_admin <> v_had_legacy_umpire_admin then
    raise exception 'Only a Super Admin can remove Legacy Umpire Admin.';
  end if;

  select coalesce(array_agg(distinct role_row.association_id order by role_row.association_id), '{}'::uuid[])
  into v_existing_umpire_associations
  from public.user_roles role_row
  where role_row.user_id = p_user_id
    and role_row.role::text = 'UMPIRE';

  if 'UMPIRE' = any(p_roles) then
    if coalesce(array_length(p_umpire_associations, 1), 0) = 0
       or exists (select 1 from unnest(p_umpire_associations) association_id where association_id is null) then
      raise exception 'Select an association for every Umpire assignment.';
    end if;
    if (select count(*) from unnest(p_umpire_associations)) <>
       (select count(distinct association_id) from unnest(p_umpire_associations) association_id) then
      raise exception 'The same association cannot be assigned twice to Umpire.';
    end if;
    if exists (
      select 1
      from unnest(p_umpire_associations) association_id
      where not exists (select 1 from public.associations association where association.id = association_id)
         or not public.administration_scope_allows(v_mode, association_id, null, null)
    ) then
      raise exception 'An Umpire association is outside your authority.';
    end if;
  elsif coalesce(array_length(p_umpire_associations, 1), 0) > 0 then
    raise exception 'Remove Umpire scopes when the Umpire role is not selected.';
  end if;

  if v_mode = 'club' and (
    ('UMPIRE' = any(p_roles)) <> (coalesce(array_length(v_existing_umpire_associations, 1), 0) > 0)
    or coalesce((select array_agg(id order by id) from unnest(p_umpire_associations) id), '{}'::uuid[])
       <> coalesce((select array_agg(id order by id) from unnest(v_existing_umpire_associations) id), '{}'::uuid[])
  ) then
    raise exception 'Club Admins cannot change Umpire access.';
  end if;

  select coalesce(array_agg(role_name order by role_name), '{}'::text[])
  into v_base_roles
  from (
    select distinct requested.role_name
    from unnest(p_roles) requested(role_name)
    where requested.role_name not in ('UMPIRE', 'UMPIRE_ADMIN')
  ) base;

  if coalesce(array_length(v_base_roles, 1), 0) = 0 then
    v_base_roles := array['PLAYER']::text[];
    v_used_player_sentinel := true;
  end if;

  perform public.admin_save_user_roles_unchecked(
    p_user_id,
    v_base_roles,
    p_coach_scopes,
    p_manager_scopes,
    p_association_admin_associations,
    p_club_admin_scopes,
    p_actor_mode
  );

  if v_used_player_sentinel and not ('PLAYER' = any(p_roles)) then
    delete from public.user_roles role_row
    where role_row.user_id = p_user_id
      and role_row.role::text = 'PLAYER'
      and role_row.association_id is null
      and role_row.club_id is null
      and role_row.team_id is null;
  end if;

  if v_mode = 'super_admin' then
    delete from public.user_roles role_row
    where role_row.user_id = p_user_id and role_row.role::text = 'UMPIRE';
  elsif v_mode = 'association' then
    delete from public.user_roles role_row
    where role_row.user_id = p_user_id
      and role_row.role::text = 'UMPIRE'
      and exists (
        select 1 from public.user_roles actor_role
        where actor_role.user_id = v_actor
          and actor_role.role::text = 'ASSOCIATION_ADMIN'
          and actor_role.association_id = role_row.association_id
      );
  end if;

  if v_mode in ('super_admin', 'association') and 'UMPIRE' = any(p_roles) then
    insert into public.user_roles (user_id, role, association_id)
    select p_user_id, 'UMPIRE'::public.user_role_enum, association_id
    from unnest(p_umpire_associations) association_id;
  end if;

  if v_mode = 'super_admin' and v_requested_legacy_umpire_admin then
    insert into public.user_roles (user_id, role)
    values (p_user_id, 'UMPIRE_ADMIN'::public.user_role_enum);
  end if;

  if exists (
    select 1
    from (
      select
        upper(item->>'responsibility') responsibility,
        upper(item->>'scope_type') scope_type,
        nullif(item->>'scope_id', '')::uuid scope_id,
        count(*) over (
          partition by upper(item->>'responsibility'), upper(item->>'scope_type'), nullif(item->>'scope_id', '')::uuid
        ) duplicate_count
      from jsonb_array_elements(coalesce(p_coordination_responsibilities, '[]'::jsonb)) item
    ) supplied
    where supplied.duplicate_count > 1
  ) then
    raise exception 'The same Coordinator responsibility and scope cannot be assigned twice.';
  end if;

  for v_scope in
    select value from jsonb_array_elements(coalesce(p_coordination_responsibilities, '[]'::jsonb))
  loop
    v_responsibility := upper(v_scope->>'responsibility');
    v_scope_type := upper(v_scope->>'scope_type');
    v_scope_id := nullif(v_scope->>'scope_id', '')::uuid;

    if v_responsibility not in (
      'UMPIRE_COORDINATOR', 'TECHNICAL_BENCH_COORDINATOR', 'VOLUNTEER_COORDINATOR'
    ) or v_scope_id is null then
      raise exception 'A Coordinator responsibility is invalid.';
    end if;
    if (v_responsibility = 'UMPIRE_COORDINATOR' and v_scope_type <> 'ASSOCIATION')
       or (v_responsibility <> 'UMPIRE_COORDINATOR' and v_scope_type not in ('ASSOCIATION', 'CLUB')) then
      raise exception 'The selected Coordinator scope type is not allowed.';
    end if;

    select details.association_id, details.club_id
    into v_association_id, v_club_id
    from public.permission_scope_details(v_scope_type, v_scope_id) details;
    if not found or not public.administration_scope_allows(
      v_mode, v_association_id, v_club_id, null
    ) then
      raise exception 'A Coordinator scope is outside your authority.';
    end if;
    if v_mode = 'club' and (
      v_scope_type <> 'CLUB' or v_responsibility = 'UMPIRE_COORDINATOR'
    ) then
      raise exception 'Club Admins can assign only club Technical Bench or Volunteer Coordinators.';
    end if;
  end loop;

  select coalesce(jsonb_agg(jsonb_build_object(
    'responsibility', set_row.system_key,
    'scope_type', assignment.scope_type,
    'scope_id', assignment.scope_id
  ) order by set_row.system_key, assignment.scope_type, assignment.scope_id), '[]'::jsonb)
  into v_old_coordination
  from public.permission_assignments assignment
  join public.permission_sets set_row on set_row.id = assignment.permission_set_id
  where assignment.subject_type = 'USER'
    and assignment.subject_key = p_user_id::text
    and assignment.active
    and set_row.system_key is not null;

  perform set_config('sportstack.coordinator_bundle_write', 'on', true);

  delete from public.permission_assignments assignment
  using public.permission_sets set_row
  where assignment.permission_set_id = set_row.id
    and assignment.subject_type = 'USER'
    and assignment.subject_key = p_user_id::text
    and assignment.active
    and set_row.system_key is not null
    and (
      v_mode = 'super_admin'
      or public.administration_scope_allows(
        v_mode,
        case
          when assignment.scope_type = 'ASSOCIATION' then assignment.scope_id
          else (select club_row.association_id from public.clubs club_row where club_row.id = assignment.scope_id)
        end,
        case when assignment.scope_type = 'CLUB' then assignment.scope_id else null end,
        null
      )
    )
    and (
      assignment.scope_type <> 'CLUB'
      or exists (select 1 from public.clubs club_check where club_check.id = assignment.scope_id)
    );

  for v_scope in
    select value from jsonb_array_elements(coalesce(p_coordination_responsibilities, '[]'::jsonb))
  loop
    v_responsibility := upper(v_scope->>'responsibility');
    v_scope_type := upper(v_scope->>'scope_type');
    v_scope_id := (v_scope->>'scope_id')::uuid;

    insert into public.permission_sets (
      name, description, owner_scope_type, owner_scope_id, active,
      created_by, updated_by, system_key
    ) values (
      case v_responsibility
        when 'UMPIRE_COORDINATOR' then 'System: Umpire Coordinator'
        when 'TECHNICAL_BENCH_COORDINATOR' then 'System: Technical Bench Coordinator'
        else 'System: Volunteer Coordinator'
      end,
      'Protected SportStack Coordinator permission bundle.',
      v_scope_type,
      v_scope_id,
      true,
      v_actor,
      v_actor,
      v_responsibility
    )
    on conflict (system_key, owner_scope_type, owner_scope_id)
      where system_key is not null
    do update set active = true, updated_by = v_actor, updated_at = now()
    returning id into v_set_id;

    delete from public.permission_set_permissions set_permission
    where set_permission.permission_set_id = v_set_id;

    v_permissions := case v_responsibility
      when 'UMPIRE_COORDINATOR' then array[
        'module.coordination.access',
        'coordination.umpires.manage',
        'coordination.umpire_matrix.manage',
        'coordination.roster_mismatches.review'
      ]
      when 'TECHNICAL_BENCH_COORDINATOR' then array[
        'module.coordination.access',
        'coordination.technical_bench.manage'
      ]
      else array[
        'module.coordination.access',
        'coordination.volunteers.manage',
        'coordination.activities.create'
      ]
    end;

    insert into public.permission_set_permissions (permission_set_id, permission_key, allowed)
    select v_set_id, permission_key, true from unnest(v_permissions) permission_key;

    insert into public.permission_assignments (
      permission_set_id, subject_type, subject_key, scope_type, scope_id,
      active, created_by, updated_by
    ) values (
      v_set_id, 'USER', p_user_id::text, v_scope_type, v_scope_id,
      true, v_actor, v_actor
    );
  end loop;

  perform set_config('sportstack.coordinator_bundle_write', 'off', true);

  select coalesce(jsonb_agg(jsonb_build_object(
    'responsibility', set_row.system_key,
    'scope_type', assignment.scope_type,
    'scope_id', assignment.scope_id
  ) order by set_row.system_key, assignment.scope_type, assignment.scope_id), '[]'::jsonb)
  into v_new_coordination
  from public.permission_assignments assignment
  join public.permission_sets set_row on set_row.id = assignment.permission_set_id
  where assignment.subject_type = 'USER'
    and assignment.subject_key = p_user_id::text
    and assignment.active
    and set_row.system_key is not null;

  insert into public.administration_audit_log (
    actor_id, actor_mode, action, record_type, target_user_id, old_data, new_data
  ) values (
    v_actor, v_mode, 'SCOPED_ACCESS_UPDATED', 'user_access', p_user_id,
    jsonb_build_object('coordination', v_old_coordination),
    jsonb_build_object('coordination', v_new_coordination)
  );
end;
$function$;

revoke all on function public.admin_save_user_access(
  uuid, text[], jsonb, jsonb, uuid[], jsonb, uuid[], jsonb, text
) from public, anon;
grant execute on function public.admin_save_user_access(
  uuid, text[], jsonb, jsonb, uuid[], jsonb, uuid[], jsonb, text
) to authenticated;

create or replace function public.admin_list_coordination_responsibilities(
  p_user_ids uuid[],
  p_actor_mode text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_mode text := public.administration_effective_mode(p_actor_mode);
begin
  if auth.uid() is null or v_mode not in ('super_admin', 'association', 'club') then
    raise exception 'This mode cannot view Coordinator responsibilities.';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'user_id', assignment.subject_key::uuid,
      'responsibility', set_row.system_key,
      'scope_type', assignment.scope_type,
      'scope_id', assignment.scope_id
    ) order by assignment.subject_key, set_row.system_key, assignment.scope_type, assignment.scope_id)
    from public.permission_assignments assignment
    join public.permission_sets set_row on set_row.id = assignment.permission_set_id
    where assignment.active
      and set_row.active
      and set_row.system_key is not null
      and assignment.subject_type = 'USER'
      and assignment.subject_key::uuid = any(coalesce(p_user_ids, '{}'::uuid[]))
      and (
        v_mode = 'super_admin'
        or public.administration_scope_allows(
          v_mode,
          case
            when assignment.scope_type = 'ASSOCIATION' then assignment.scope_id
            else (select club_row.association_id from public.clubs club_row where club_row.id = assignment.scope_id)
          end,
          case when assignment.scope_type = 'CLUB' then assignment.scope_id else null end,
          null
        )
      )
  ), '[]'::jsonb);
end;
$function$;

revoke all on function public.admin_list_coordination_responsibilities(uuid[], text)
  from public, anon;
grant execute on function public.admin_list_coordination_responsibilities(uuid[], text)
  to authenticated;

create or replace function public.coordination_get_current_access(
  p_actor_mode text default null,
  p_association_id uuid default null,
  p_club_id uuid default null,
  p_team_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_responsibilities jsonb;
  v_is_super boolean := false;
  v_can_umpires boolean := false;
  v_can_bench boolean := false;
  v_can_volunteers boolean := false;
  v_can_matrix boolean := false;
  v_can_roster boolean := false;
begin
  if v_user_id is null then raise exception 'You must be signed in.'; end if;

  v_is_super := public.is_super_admin()
    and public.administration_effective_mode(p_actor_mode) = 'super_admin';

  select coalesce(jsonb_agg(jsonb_build_object(
    'responsibility', set_row.system_key,
    'scope_type', assignment.scope_type,
    'scope_id', assignment.scope_id
  ) order by set_row.system_key, assignment.scope_type, assignment.scope_id), '[]'::jsonb)
  into v_responsibilities
  from public.permission_assignments assignment
  join public.permission_sets set_row on set_row.id = assignment.permission_set_id
  where assignment.active
    and set_row.active
    and set_row.system_key is not null
    and assignment.subject_type = 'USER'
    and assignment.subject_key = v_user_id::text;

  v_can_umpires := v_is_super or exists (
    select 1 from jsonb_array_elements(v_responsibilities) item
    where item->>'responsibility' = 'UMPIRE_COORDINATOR'
  );
  v_can_bench := v_is_super or exists (
    select 1 from jsonb_array_elements(v_responsibilities) item
    where item->>'responsibility' = 'TECHNICAL_BENCH_COORDINATOR'
  );
  v_can_volunteers := v_is_super or exists (
    select 1 from jsonb_array_elements(v_responsibilities) item
    where item->>'responsibility' = 'VOLUNTEER_COORDINATOR'
  );
  v_can_matrix := v_can_umpires;
  v_can_roster := v_can_umpires;

  if p_association_id is not null then
    v_can_umpires := v_can_umpires or private.coordination_permission_allowed(
      'coordination.umpires.manage', p_actor_mode, p_association_id, p_club_id, p_team_id
    );
    v_can_bench := v_can_bench or private.coordination_permission_allowed(
      'coordination.technical_bench.manage', p_actor_mode, p_association_id, p_club_id, p_team_id
    );
    v_can_volunteers := v_can_volunteers or private.coordination_permission_allowed(
      'coordination.volunteers.manage', p_actor_mode, p_association_id, p_club_id, p_team_id
    );
    v_can_matrix := v_can_matrix or private.coordination_permission_allowed(
      'coordination.umpire_matrix.manage', p_actor_mode, p_association_id, p_club_id, p_team_id
    );
    v_can_roster := v_can_roster or private.coordination_permission_allowed(
      'coordination.roster_mismatches.review', p_actor_mode, p_association_id, p_club_id, p_team_id
    );
  end if;

  return jsonb_build_object(
    'is_coordinator', jsonb_array_length(v_responsibilities) > 0,
    'can_manage_umpires', v_can_umpires,
    'can_manage_technical_bench', v_can_bench,
    'can_manage_volunteers', v_can_volunteers,
    'can_manage_matrix', v_can_matrix,
    'can_review_roster_mismatches', v_can_roster,
    'responsibilities', v_responsibilities
  );
end;
$function$;

revoke all on function public.coordination_get_current_access(text, uuid, uuid, uuid)
  from public, anon;
grant execute on function public.coordination_get_current_access(text, uuid, uuid, uuid)
  to authenticated;

drop policy if exists coordination_activities_read on public.coordination_activities;
create policy coordination_activities_read
on public.coordination_activities
for select
to authenticated
using (
  coordinator_id = (select auth.uid())
  or (select public.is_super_admin())
  or private.coordination_direct_bundle_allowed(
    'coordination.volunteers.manage', association_id, club_id, team_id
  )
);

create or replace function public.coordination_create_capability_invite(
  p_user_id uuid,
  p_capability_type text,
  p_scope_type text,
  p_scope_id uuid,
  p_actor_mode text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_scope record;
  v_permission text;
  v_id uuid;
begin
  if upper(p_capability_type) = 'UMPIRE' then
    raise exception 'Assign the association-scoped Umpire role in User Management. Umpires do not accept a separate capability invitation.';
  end if;

  select * into v_scope
  from private.coordination_scope_details(upper(p_scope_type), p_scope_id);
  v_permission := case upper(p_capability_type)
    when 'SUPERVISING_UMPIRE' then 'coordination.umpires.manage'
    when 'TECHNICAL_BENCH' then 'coordination.technical_bench.manage'
    else 'coordination.volunteers.manage'
  end;
  if not private.coordination_permission_allowed(
    v_permission, p_actor_mode, v_scope.association_id, v_scope.club_id, v_scope.team_id
  ) then
    raise exception 'You cannot invite this capability in the selected scope.';
  end if;

  insert into public.coordination_capability_invitations (
    user_id, capability_type, scope_type, scope_id, invited_by
  ) values (
    p_user_id, upper(p_capability_type), upper(p_scope_type), p_scope_id, auth.uid()
  ) returning id into v_id;

  perform private.coordination_queue_notice(
    p_user_id,
    'CAPABILITY_INVITE',
    'CAPABILITY_INVITE',
    v_id,
    'Coordination capability invitation',
    'Accept this invitation before you can receive assignments for this responsibility.',
    '/coordination/my-assignments',
    'coordination:capability-invite:' || v_id
  );
  return v_id;
end;
$function$;

-- Existing Coordination operations remain the implementation source. Narrow
-- wrappers add the fixture context needed to prove that a club Technical Bench
-- Coordinator belongs to either participating club.
alter function public.coordination_prepare_fixture(uuid, text)
  rename to coordination_prepare_fixture_scoped_impl;
alter function public.coordination_get_fixture_positions(uuid, text)
  rename to coordination_get_fixture_positions_scoped_impl;
alter function public.coordination_list_eligible_people(uuid, text)
  rename to coordination_list_eligible_people_scoped_impl;
alter function public.coordination_send_offer(uuid, uuid[], text, timestamptz, text, text)
  rename to coordination_send_offer_scoped_impl;
alter function public.coordination_confirm_offer(uuid, text, text)
  rename to coordination_confirm_offer_scoped_impl;
alter function public.coordination_late_assign(uuid, uuid, text, text, text)
  rename to coordination_late_assign_scoped_impl;
alter function public.coordination_take_over_offer(uuid, text, text)
  rename to coordination_take_over_offer_scoped_impl;
alter function public.coordination_revise_offer_note(uuid, text, boolean, text)
  rename to coordination_revise_offer_note_scoped_impl;

create or replace function private.coordination_fixture_id_for_position(p_position_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $function$
  select position.fixture_id
  from public.coordination_positions position
  where position.id = p_position_id;
$function$;

create or replace function private.coordination_fixture_id_for_recipient(p_recipient_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $function$
  select position.fixture_id
  from public.coordination_offer_recipients recipient
  join public.coordination_offer_batches batch on batch.id = recipient.offer_batch_id
  join public.coordination_positions position on position.id = batch.position_id
  where recipient.id = p_recipient_id;
$function$;

create or replace function private.coordination_fixture_id_for_batch(p_offer_batch_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $function$
  select position.fixture_id
  from public.coordination_offer_batches batch
  join public.coordination_positions position on position.id = batch.position_id
  where batch.id = p_offer_batch_id;
$function$;

create or replace function public.coordination_prepare_fixture(
  p_fixture_id uuid,
  p_actor_mode text default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $function$
declare v_result integer;
begin
  perform set_config('sportstack.coordination_fixture_id', p_fixture_id::text, true);
  v_result := public.coordination_prepare_fixture_scoped_impl(p_fixture_id, p_actor_mode);
  perform set_config('sportstack.coordination_fixture_id', '', true);
  return v_result;
end;
$function$;

create or replace function public.coordination_get_fixture_positions(
  p_fixture_id uuid,
  p_actor_mode text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_association_id uuid;
  v_payload jsonb;
  v_can_umpires boolean;
  v_can_bench boolean;
begin
  select fixture_window.association_id into v_association_id
  from private.coordination_fixture_window(p_fixture_id) fixture_window;
  if v_association_id is null then
    raise exception 'Fixture date or organisation could not be resolved.';
  end if;

  perform set_config('sportstack.coordination_fixture_id', p_fixture_id::text, true);
  v_can_umpires := private.coordination_permission_allowed(
    'coordination.umpires.manage', p_actor_mode, v_association_id
  );
  v_can_bench := private.coordination_permission_allowed(
    'coordination.technical_bench.manage', p_actor_mode, v_association_id
  );
  if not v_can_umpires and not v_can_bench then
    raise exception 'You do not have Coordination access for this fixture.';
  end if;

  v_payload := public.coordination_get_fixture_positions_scoped_impl(p_fixture_id, p_actor_mode);
  perform set_config('sportstack.coordination_fixture_id', '', true);

  return coalesce((
    select jsonb_agg(item)
    from jsonb_array_elements(v_payload) item
    where (item->>'type' in ('UMPIRE', 'SUPERVISING_UMPIRE') and v_can_umpires)
       or (item->>'type' = 'TECHNICAL_BENCH' and v_can_bench)
  ), '[]'::jsonb);
end;
$function$;

create or replace function public.coordination_list_eligible_people(
  p_position_id uuid,
  p_actor_mode text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare v_result jsonb; v_fixture_id uuid;
begin
  v_fixture_id := private.coordination_fixture_id_for_position(p_position_id);
  perform set_config('sportstack.coordination_fixture_id', coalesce(v_fixture_id::text, ''), true);
  v_result := public.coordination_list_eligible_people_scoped_impl(p_position_id, p_actor_mode);
  perform set_config('sportstack.coordination_fixture_id', '', true);
  return v_result;
end;
$function$;

create or replace function public.coordination_send_offer(
  p_position_id uuid,
  p_recipient_ids uuid[],
  p_note text default null,
  p_response_deadline timestamptz default null,
  p_actor_mode text default null,
  p_override_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare v_result uuid; v_fixture_id uuid;
begin
  v_fixture_id := private.coordination_fixture_id_for_position(p_position_id);
  perform set_config('sportstack.coordination_fixture_id', coalesce(v_fixture_id::text, ''), true);
  v_result := public.coordination_send_offer_scoped_impl(
    p_position_id, p_recipient_ids, p_note, p_response_deadline, p_actor_mode, p_override_note
  );
  perform set_config('sportstack.coordination_fixture_id', '', true);
  return v_result;
end;
$function$;

create or replace function public.coordination_confirm_offer(
  p_recipient_id uuid,
  p_actor_mode text default null,
  p_warning_override_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare v_result uuid; v_fixture_id uuid;
begin
  v_fixture_id := private.coordination_fixture_id_for_recipient(p_recipient_id);
  perform set_config('sportstack.coordination_fixture_id', coalesce(v_fixture_id::text, ''), true);
  v_result := public.coordination_confirm_offer_scoped_impl(
    p_recipient_id, p_actor_mode, p_warning_override_note
  );
  perform set_config('sportstack.coordination_fixture_id', '', true);
  return v_result;
end;
$function$;

create or replace function public.coordination_late_assign(
  p_position_id uuid,
  p_user_id uuid,
  p_note text default null,
  p_actor_mode text default null,
  p_warning_override_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare v_result uuid; v_fixture_id uuid;
begin
  v_fixture_id := private.coordination_fixture_id_for_position(p_position_id);
  perform set_config('sportstack.coordination_fixture_id', coalesce(v_fixture_id::text, ''), true);
  v_result := public.coordination_late_assign_scoped_impl(
    p_position_id, p_user_id, p_note, p_actor_mode, p_warning_override_note
  );
  perform set_config('sportstack.coordination_fixture_id', '', true);
  return v_result;
end;
$function$;

create or replace function public.coordination_take_over_offer(
  p_offer_batch_id uuid,
  p_reason text,
  p_actor_mode text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare v_fixture_id uuid;
begin
  v_fixture_id := private.coordination_fixture_id_for_batch(p_offer_batch_id);
  perform set_config('sportstack.coordination_fixture_id', coalesce(v_fixture_id::text, ''), true);
  perform public.coordination_take_over_offer_scoped_impl(p_offer_batch_id, p_reason, p_actor_mode);
  perform set_config('sportstack.coordination_fixture_id', '', true);
end;
$function$;

create or replace function public.coordination_revise_offer_note(
  p_offer_batch_id uuid,
  p_note text,
  p_material boolean,
  p_actor_mode text default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $function$
declare v_result integer; v_fixture_id uuid;
begin
  v_fixture_id := private.coordination_fixture_id_for_batch(p_offer_batch_id);
  perform set_config('sportstack.coordination_fixture_id', coalesce(v_fixture_id::text, ''), true);
  v_result := public.coordination_revise_offer_note_scoped_impl(
    p_offer_batch_id, p_note, p_material, p_actor_mode
  );
  perform set_config('sportstack.coordination_fixture_id', '', true);
  return v_result;
end;
$function$;

revoke all on function public.coordination_prepare_fixture_scoped_impl(uuid, text) from public, anon, authenticated;
revoke all on function public.coordination_get_fixture_positions_scoped_impl(uuid, text) from public, anon, authenticated;
revoke all on function public.coordination_list_eligible_people_scoped_impl(uuid, text) from public, anon, authenticated;
revoke all on function public.coordination_send_offer_scoped_impl(uuid, uuid[], text, timestamptz, text, text) from public, anon, authenticated;
revoke all on function public.coordination_confirm_offer_scoped_impl(uuid, text, text) from public, anon, authenticated;
revoke all on function public.coordination_late_assign_scoped_impl(uuid, uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.coordination_take_over_offer_scoped_impl(uuid, text, text) from public, anon, authenticated;
revoke all on function public.coordination_revise_offer_note_scoped_impl(uuid, text, boolean, text) from public, anon, authenticated;

revoke all on function public.coordination_prepare_fixture(uuid, text) from public, anon;
revoke all on function public.coordination_get_fixture_positions(uuid, text) from public, anon;
revoke all on function public.coordination_list_eligible_people(uuid, text) from public, anon;
revoke all on function public.coordination_send_offer(uuid, uuid[], text, timestamptz, text, text) from public, anon;
revoke all on function public.coordination_confirm_offer(uuid, text, text) from public, anon;
revoke all on function public.coordination_late_assign(uuid, uuid, text, text, text) from public, anon;
revoke all on function public.coordination_take_over_offer(uuid, text, text) from public, anon;
revoke all on function public.coordination_revise_offer_note(uuid, text, boolean, text) from public, anon;

grant execute on function public.coordination_prepare_fixture(uuid, text) to authenticated;
grant execute on function public.coordination_get_fixture_positions(uuid, text) to authenticated;
grant execute on function public.coordination_list_eligible_people(uuid, text) to authenticated;
grant execute on function public.coordination_send_offer(uuid, uuid[], text, timestamptz, text, text) to authenticated;
grant execute on function public.coordination_confirm_offer(uuid, text, text) to authenticated;
grant execute on function public.coordination_late_assign(uuid, uuid, text, text, text) to authenticated;
grant execute on function public.coordination_take_over_offer(uuid, text, text) to authenticated;
grant execute on function public.coordination_revise_offer_note(uuid, text, boolean, text) to authenticated;

comment on column public.permission_sets.system_key is
  'Protected identifier for fixed SportStack Coordinator permission bundles.';
comment on function public.admin_save_user_access(uuid, text[], jsonb, jsonb, uuid[], jsonb, uuid[], jsonb, text) is
  'Atomically saves roles, association-scoped Umpire access and protected Coordinator responsibilities.';
