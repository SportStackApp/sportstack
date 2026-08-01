-- Scoped administration, membership integrity and immutable administration audit.
--
-- This migration deliberately does not clean historical duplicate memberships.
-- Existing rows remain available for the owner-approved cleanup pass. The guard
-- only rejects new conflicts or updates that would create a new conflict.

create table if not exists public.administration_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references auth.users(id),
  actor_mode text not null,
  action text not null,
  record_type text not null,
  record_id uuid,
  target_user_id uuid references public.profiles(id),
  association_id uuid references public.associations(id),
  club_id uuid references public.clubs(id),
  team_id uuid references public.teams(id),
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);

create index if not exists administration_audit_actor_idx
  on public.administration_audit_log (actor_id, created_at desc);
create index if not exists administration_audit_target_idx
  on public.administration_audit_log (target_user_id, created_at desc);
create index if not exists administration_audit_scope_idx
  on public.administration_audit_log (association_id, club_id, team_id, created_at desc);

alter table public.administration_audit_log enable row level security;
revoke all on table public.administration_audit_log from public, anon, authenticated;
grant select on table public.administration_audit_log to authenticated;

drop policy if exists administration_audit_read_scoped on public.administration_audit_log;
create policy administration_audit_read_scoped
on public.administration_audit_log
for select
to authenticated
using (
  actor_id = auth.uid()
  or public.is_super_admin()
  or exists (
    select 1
    from public.user_roles role_row
    where role_row.user_id = auth.uid()
      and (
        (role_row.role::text = 'ASSOCIATION_ADMIN'
          and role_row.association_id = administration_audit_log.association_id)
        or (role_row.role::text = 'CLUB_ADMIN'
          and role_row.club_id = administration_audit_log.club_id)
        or (role_row.role::text = 'TEAM_MANAGER'
          and role_row.team_id = administration_audit_log.team_id)
      )
  )
);

create or replace function public.administration_effective_mode(p_requested_mode text default null)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_requested text := lower(coalesce(p_requested_mode, ''));
  v_has_super boolean;
begin
  if v_actor is null then
    raise exception 'You must be signed in.';
  end if;

  select exists (
    select 1 from public.user_roles role_row
    where role_row.user_id = v_actor and role_row.role::text = 'SUPER_ADMIN'
  ) into v_has_super;

  if v_requested in ('super_admin', 'association', 'club', 'team_manager', 'coach', 'player') then
    if v_has_super then
      return v_requested;
    end if;

    if v_requested = 'association' and exists (
      select 1 from public.user_roles role_row
      where role_row.user_id = v_actor and role_row.role::text = 'ASSOCIATION_ADMIN'
    ) then return v_requested; end if;
    if v_requested = 'club' and exists (
      select 1 from public.user_roles role_row
      where role_row.user_id = v_actor and role_row.role::text = 'CLUB_ADMIN'
    ) then return v_requested; end if;
    if v_requested = 'team_manager' and exists (
      select 1 from public.user_roles role_row
      where role_row.user_id = v_actor and role_row.role::text = 'TEAM_MANAGER'
    ) then return v_requested; end if;
    if v_requested = 'coach' and exists (
      select 1 from public.user_roles role_row
      where role_row.user_id = v_actor and role_row.role::text = 'COACH'
    ) then return v_requested; end if;
    if v_requested = 'player' then return v_requested; end if;

    raise exception 'The selected mode is not assigned to this account.';
  end if;

  if v_has_super then return 'super_admin'; end if;
  if exists (select 1 from public.user_roles r where r.user_id = v_actor and r.role::text = 'ASSOCIATION_ADMIN') then return 'association'; end if;
  if exists (select 1 from public.user_roles r where r.user_id = v_actor and r.role::text = 'CLUB_ADMIN') then return 'club'; end if;
  if exists (select 1 from public.user_roles r where r.user_id = v_actor and r.role::text = 'TEAM_MANAGER') then return 'team_manager'; end if;
  if exists (select 1 from public.user_roles r where r.user_id = v_actor and r.role::text = 'COACH') then return 'coach'; end if;
  return 'player';
end;
$$;

revoke all on function public.administration_effective_mode(text) from public;
grant execute on function public.administration_effective_mode(text) to authenticated;

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

  if v_mode = 'super_admin' then return true; end if;
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

drop trigger if exists team_membership_integrity_guard on public.team_memberships;
create trigger team_membership_integrity_guard
before insert or update of user_id, team_id, status, membership_type
on public.team_memberships
for each row execute function public.guard_team_membership_integrity();

drop function if exists public.admin_save_user_roles(uuid, text[], jsonb, jsonb, uuid[], jsonb);
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
as $$
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
  if p_user_id is null or not exists (select 1 from public.profiles where id = p_user_id) then
    raise exception 'The selected user was not found.';
  end if;
  if p_roles is null or coalesce(array_length(p_roles, 1), 0) = 0 then
    raise exception 'At least one role must remain assigned.';
  end if;
  if exists (
    select 1 from unnest(p_roles) requested(role_name)
    where requested.role_name not in ('SUPER_ADMIN','ASSOCIATION_ADMIN','CLUB_ADMIN','TEAM_MANAGER','COACH','PLAYER','UMPIRE','VOTER','UMPIRE_ADMIN')
  ) then
    raise exception 'One or more requested roles are not recognised.';
  end if;

  select coalesce(jsonb_agg(to_jsonb(role_row) order by role_row.role::text), '[]'::jsonb)
  into v_old_data from public.user_roles role_row where role_row.user_id = p_user_id;

  if v_mode = 'super_admin' then
    if p_user_id = v_actor and not ('SUPER_ADMIN' = any(p_roles)) then
      raise exception 'You cannot remove your own Super Admin role.';
    end if;
    delete from public.user_roles where user_id = p_user_id;
  elsif v_mode = 'association' then
    if exists (
      select 1 from public.user_roles target_role
      where target_role.user_id = p_user_id
        and target_role.role::text in ('SUPER_ADMIN','ASSOCIATION_ADMIN')
    ) then raise exception 'Association Admins cannot edit Super Admin or peer Association Admin accounts.'; end if;
    if exists (
      select 1 from unnest(p_roles) requested(role_name)
      where requested.role_name not in ('PLAYER','VOTER','CLUB_ADMIN','TEAM_MANAGER','COACH')
    ) then raise exception 'The selected role is above Association Admin authority.'; end if;
    delete from public.user_roles target_role
    where target_role.user_id = p_user_id
      and target_role.role::text in ('CLUB_ADMIN','TEAM_MANAGER','COACH')
      and exists (
        select 1 from public.user_roles actor_role
        where actor_role.user_id = v_actor
          and actor_role.role::text = 'ASSOCIATION_ADMIN'
          and actor_role.association_id = target_role.association_id
      );
  elsif v_mode = 'club' then
    if exists (
      select 1 from public.user_roles target_role
      where target_role.user_id = p_user_id
        and target_role.role::text in ('SUPER_ADMIN','ASSOCIATION_ADMIN','CLUB_ADMIN')
    ) then raise exception 'Club Admins cannot edit equal or higher-role accounts.'; end if;
    if exists (
      select 1 from unnest(p_roles) requested(role_name)
      where requested.role_name not in ('PLAYER','VOTER','TEAM_MANAGER','COACH')
    ) then raise exception 'The selected role is above Club Admin authority.'; end if;
    delete from public.user_roles target_role
    where target_role.user_id = p_user_id
      and target_role.role::text in ('TEAM_MANAGER','COACH')
      and exists (
        select 1 from public.user_roles actor_role
        where actor_role.user_id = v_actor
          and actor_role.role::text = 'CLUB_ADMIN'
          and actor_role.club_id = target_role.club_id
      );
  else
    raise exception 'This mode cannot change user roles.';
  end if;

  if v_mode = 'super_admin' then
    if 'SUPER_ADMIN' = any(p_roles) then insert into public.user_roles (user_id, role) values (p_user_id, 'SUPER_ADMIN') on conflict do nothing; end if;
    if 'ASSOCIATION_ADMIN' = any(p_roles) and p_association_admin_associations is not null then
      insert into public.user_roles (user_id, role, association_id)
      select p_user_id, 'ASSOCIATION_ADMIN'::public.app_role, association_id
      from unnest(p_association_admin_associations) association_id on conflict do nothing;
    end if;
    if 'UMPIRE' = any(p_roles) then insert into public.user_roles (user_id, role) values (p_user_id, 'UMPIRE') on conflict do nothing; end if;
    if 'UMPIRE_ADMIN' = any(p_roles) then insert into public.user_roles (user_id, role) values (p_user_id, 'UMPIRE_ADMIN') on conflict do nothing; end if;
  end if;

  if 'PLAYER' = any(p_roles) then
    insert into public.user_roles (user_id, role) values (p_user_id, 'PLAYER') on conflict do nothing;
  end if;
  if 'VOTER' = any(p_roles) then
    insert into public.user_roles (user_id, role) values (p_user_id, 'VOTER') on conflict do nothing;
  end if;

  if 'CLUB_ADMIN' = any(p_roles) and p_club_admin_scopes is not null then
    for v_scope in select value from jsonb_array_elements(p_club_admin_scopes)
    loop
      v_association_id := nullif(v_scope->>'association_id','')::uuid;
      v_club_id := nullif(v_scope->>'club_id','')::uuid;
      if v_club_id is null or not public.administration_scope_allows(v_mode, v_association_id, v_club_id, null) then
        raise exception 'A Club Admin scope is outside your authority.';
      end if;
      select club.association_id into v_association_id from public.clubs club where club.id = v_club_id;
      insert into public.user_roles (user_id, role, association_id, club_id)
      values (p_user_id, 'CLUB_ADMIN', v_association_id, v_club_id) on conflict do nothing;
    end loop;
  end if;

  if 'COACH' = any(p_roles) and p_coach_scopes is not null then
    for v_scope in select value from jsonb_array_elements(p_coach_scopes)
    loop
      v_team_id := nullif(v_scope->>'team_id','')::uuid;
      if v_team_id is null or not public.administration_scope_allows(v_mode, null, null, v_team_id) then
        raise exception 'A Coach scope is outside your authority.';
      end if;
      select team.club_id, club.association_id into v_club_id, v_association_id
      from public.teams team join public.clubs club on club.id = team.club_id where team.id = v_team_id;
      insert into public.user_roles (user_id, role, association_id, club_id, team_id)
      values (p_user_id, 'COACH', v_association_id, v_club_id, v_team_id) on conflict do nothing;
    end loop;
  end if;

  if 'TEAM_MANAGER' = any(p_roles) and p_manager_scopes is not null then
    for v_scope in select value from jsonb_array_elements(p_manager_scopes)
    loop
      v_team_id := nullif(v_scope->>'team_id','')::uuid;
      if v_team_id is null or not public.administration_scope_allows(v_mode, null, null, v_team_id) then
        raise exception 'A Team Manager scope is outside your authority.';
      end if;
      select team.club_id, club.association_id into v_club_id, v_association_id
      from public.teams team join public.clubs club on club.id = team.club_id where team.id = v_team_id;
      insert into public.user_roles (user_id, role, association_id, club_id, team_id)
      values (p_user_id, 'TEAM_MANAGER', v_association_id, v_club_id, v_team_id) on conflict do nothing;
    end loop;
  end if;

  select coalesce(jsonb_agg(to_jsonb(role_row) order by role_row.role::text), '[]'::jsonb)
  into v_new_data from public.user_roles role_row where role_row.user_id = p_user_id;

  insert into public.administration_audit_log (
    actor_id, actor_mode, action, record_type, target_user_id, old_data, new_data
  ) values (v_actor, v_mode, 'ROLES_UPDATED', 'user_roles', p_user_id, v_old_data, v_new_data);
end;
$$;

revoke all on function public.admin_save_user_roles(uuid, text[], jsonb, jsonb, uuid[], jsonb, text) from public;
grant execute on function public.admin_save_user_roles(uuid, text[], jsonb, jsonb, uuid[], jsonb, text) to authenticated;

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

revoke all on function public.admin_manage_team_membership(uuid, text, text, text) from public;
grant execute on function public.admin_manage_team_membership(uuid, text, text, text) to authenticated;

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

revoke all on function public.admin_create_team_invite(uuid, uuid, text, text) from public;
grant execute on function public.admin_create_team_invite(uuid, uuid, text, text) to authenticated;

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

revoke all on function public.admin_cancel_team_invite(uuid, text) from public;
grant execute on function public.admin_cancel_team_invite(uuid, text) to authenticated;

-- Read-only report. It supports owner review without altering historical rows.
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

revoke all on function public.admin_membership_integrity_report() from public;
grant execute on function public.admin_membership_integrity_report() to authenticated;
