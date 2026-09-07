-- B1: make Primary team membership association-scoped.
--
-- A player may have one active Primary team in each association. A request
-- created by the player records their consent, so an authorised destination
-- team or club approval completes the change in one transaction. The legacy
-- confirmation RPC remains available only for requests already in the
-- ADMIN_APPROVED state.

create or replace function public.guard_team_membership_integrity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_association_id uuid;
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

  if new.status::text = 'ACTIVE' and new.membership_type::text = 'PRIMARY' then
    select club.association_id
    into v_association_id
    from public.teams team
    join public.clubs club on club.id = team.club_id
    where team.id = new.team_id;

    if not found then
      raise exception 'The membership team was not found.';
    end if;

    if exists (
      select 1
      from public.team_memberships membership
      join public.teams team on team.id = membership.team_id
      join public.clubs club on club.id = team.club_id
      where membership.user_id = new.user_id
        and membership.status::text = 'ACTIVE'
        and membership.membership_type::text = 'PRIMARY'
        and membership.id <> new.id
        and club.association_id = v_association_id
    ) then
      raise exception 'This person already has an active primary team in that association.';
    end if;
  end if;

  return new;
end;
$function$;

create or replace function private.sync_registered_club_from_primary_membership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_club_id uuid;
  v_association_id uuid;
  v_registered_club_id uuid;
  v_registered_association_id uuid;
begin
  if new.status::text <> 'ACTIVE' or new.membership_type::text <> 'PRIMARY' then
    return new;
  end if;

  select team.club_id, club.association_id
  into v_club_id, v_association_id
  from public.teams team
  join public.clubs club on club.id = team.club_id
  where team.id = new.team_id;

  select profile.registered_club_id, registered_club.association_id
  into v_registered_club_id, v_registered_association_id
  from public.profiles profile
  left join public.clubs registered_club on registered_club.id = profile.registered_club_id
  where profile.id = new.user_id;

  -- registered_club_id is a legacy singular field. Keep a club from another
  -- association intact; within the same association it follows Primary.
  if v_registered_club_id is null or v_registered_association_id = v_association_id then
    update public.profiles profile
    set registered_club_id = v_club_id
    where profile.id = new.user_id
      and profile.registered_club_id is distinct from v_club_id;
  end if;

  return new;
end;
$function$;

create or replace function private.apply_primary_team_for_association(
  p_user_id uuid,
  p_team_id uuid,
  p_invited_by uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_association_id uuid;
  v_membership_id uuid;
  v_existing_count integer;
begin
  select club.association_id
  into v_association_id
  from public.teams team
  join public.clubs club on club.id = team.club_id
  where team.id = p_team_id;

  if not found then
    raise exception 'The requested team was not found.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('membership-user:' || p_user_id::text, 0)
  );

  select count(*), (pg_catalog.array_agg(membership.id order by membership.id))[1]
  into v_existing_count, v_membership_id
  from public.team_memberships membership
  where membership.user_id = p_user_id
    and membership.team_id = p_team_id;

  if v_existing_count > 1 then
    raise exception 'Duplicate membership records exist for the requested team. An admin must repair them first.';
  end if;

  update public.team_memberships membership
  set membership_type = 'SECONDARY'::public.membership_type_enum
  from public.teams team
  join public.clubs club on club.id = team.club_id
  where membership.team_id = team.id
    and membership.user_id = p_user_id
    and membership.team_id <> p_team_id
    and membership.status::text = 'ACTIVE'
    and membership.membership_type::text = 'PRIMARY'
    and club.association_id = v_association_id;

  if v_existing_count = 0 then
    insert into public.team_memberships (
      user_id, team_id, membership_type, status, invited_by
    ) values (
      p_user_id,
      p_team_id,
      'PRIMARY'::public.membership_type_enum,
      'ACTIVE'::public.membership_status_enum,
      p_invited_by
    )
    returning id into v_membership_id;
  else
    update public.team_memberships membership
    set membership_type = 'PRIMARY'::public.membership_type_enum,
        status = 'ACTIVE'::public.membership_status_enum,
        invited_by = coalesce(membership.invited_by, p_invited_by)
    where membership.id = v_membership_id;
  end if;

  return v_membership_id;
end;
$function$;

create or replace function public.can_review_primary_team_change(p_to_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.teams team
    join public.clubs club on club.id = team.club_id
    join public.user_roles role_row on role_row.user_id = auth.uid()
    where team.id = p_to_team_id
      and (
        role_row.role::text = 'SUPER_ADMIN'
        or (role_row.role::text = 'ASSOCIATION_ADMIN' and role_row.association_id = club.association_id)
        or (role_row.role::text = 'CLUB_ADMIN' and role_row.club_id = team.club_id)
        or (role_row.role::text = 'TEAM_MANAGER' and role_row.team_id = team.id)
      )
  );
$function$;

create or replace function public.request_primary_team_change(p_to_team_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor_id uuid := auth.uid();
  v_association_id uuid;
  v_from_team_id uuid;
  v_primary_count integer;
  v_request_id uuid;
begin
  if v_actor_id is null then
    raise exception 'You must be signed in to request a primary team change.';
  end if;

  select club.association_id
  into v_association_id
  from public.teams team
  join public.clubs club on club.id = team.club_id
  where team.id = p_to_team_id;

  if not found then
    raise exception 'The requested team was not found.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('primary-change-request:' || v_actor_id::text, 0)
  );

  select count(*), (pg_catalog.array_agg(membership.team_id order by membership.id))[1]
  into v_primary_count, v_from_team_id
  from public.team_memberships membership
  join public.teams team on team.id = membership.team_id
  join public.clubs club on club.id = team.club_id
  where membership.user_id = v_actor_id
    and membership.status::text = 'ACTIVE'
    and membership.membership_type::text = 'PRIMARY'
    and club.association_id = v_association_id;

  if v_primary_count > 1 then
    raise exception 'Multiple active primary memberships exist in that association. An admin must repair them first.';
  end if;

  if v_from_team_id = p_to_team_id then
    raise exception 'That team is already your primary team for this association.';
  end if;

  -- The current interface handles one request at a time. Active Primary teams
  -- remain association-scoped; this only serialises the request workflow.
  if exists (
    select 1
    from public.primary_change_requests request_row
    where request_row.user_id = v_actor_id
      and request_row.status in ('PENDING', 'ADMIN_APPROVED')
  ) then
    raise exception 'You already have a primary team change in progress.';
  end if;

  insert into public.primary_change_requests (user_id, from_team_id, to_team_id, status)
  values (v_actor_id, v_from_team_id, p_to_team_id, 'PENDING')
  returning id into v_request_id;

  return pg_catalog.jsonb_build_object('request_id', v_request_id, 'status', 'PENDING');
end;
$function$;

create or replace function public.approve_primary_team_change(p_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor_id uuid := auth.uid();
  v_request public.primary_change_requests%rowtype;
  v_membership_id uuid;
begin
  if v_actor_id is null then
    raise exception 'You must be signed in to approve a primary team change.';
  end if;

  select request_row.* into v_request
  from public.primary_change_requests request_row
  where request_row.id = p_request_id
  for update;

  if not found or not public.can_review_primary_team_change(v_request.to_team_id) then
    raise exception 'The primary team change request was not found.';
  end if;

  if v_request.status <> 'PENDING' then
    raise exception 'Only a pending primary team change can be approved.';
  end if;

  v_membership_id := private.apply_primary_team_for_association(
    v_request.user_id,
    v_request.to_team_id,
    v_actor_id
  );

  update public.primary_change_requests request_row
  set status = 'COMPLETED',
      resolved_by = v_actor_id,
      resolved_at = pg_catalog.now(),
      updated_at = pg_catalog.now()
  where request_row.id = p_request_id;

  return pg_catalog.jsonb_build_object(
    'request_id', p_request_id,
    'status', 'COMPLETED',
    'membership_id', v_membership_id
  );
end;
$function$;

create or replace function public.confirm_primary_team_change(p_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor_id uuid := auth.uid();
  v_request public.primary_change_requests%rowtype;
  v_membership_id uuid;
begin
  if v_actor_id is null then
    raise exception 'You must be signed in to confirm a primary team change.';
  end if;

  select request_row.* into v_request
  from public.primary_change_requests request_row
  where request_row.id = p_request_id
  for update;

  if not found or v_request.user_id <> v_actor_id then
    raise exception 'The primary team change request was not found.';
  end if;

  if v_request.status <> 'ADMIN_APPROVED' then
    raise exception 'This legacy primary team change is not ready for confirmation.';
  end if;

  v_membership_id := private.apply_primary_team_for_association(
    v_actor_id,
    v_request.to_team_id,
    v_request.resolved_by
  );

  update public.primary_change_requests request_row
  set status = 'COMPLETED',
      resolved_at = pg_catalog.now(),
      updated_at = pg_catalog.now()
  where request_row.id = p_request_id;

  return pg_catalog.jsonb_build_object(
    'request_id', p_request_id,
    'status', 'COMPLETED',
    'membership_id', v_membership_id
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
as $function$
declare
  v_actor uuid := auth.uid();
  v_mode text := public.administration_effective_mode(p_actor_mode);
  v_membership public.team_memberships%rowtype;
  v_old_data jsonb;
  v_new_data jsonb;
  v_association_id uuid;
  v_club_id uuid;
  v_action text := pg_catalog.upper(pg_catalog.trim(coalesce(p_action, '')));
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
as $function$
  with duplicate_team as (
    select 'DUPLICATE_USER_TEAM'::text issue_type,
           membership.user_id,
           membership.team_id,
           pg_catalog.array_agg(membership.id order by membership.created_at, membership.id) membership_ids,
           pg_catalog.count(*) row_count
    from public.team_memberships membership
    where membership.status::text in ('ACTIVE','PENDING')
    group by membership.user_id, membership.team_id
    having pg_catalog.count(*) > 1
  ), multiple_primary as (
    select 'MULTIPLE_ACTIVE_PRIMARY_IN_ASSOCIATION'::text issue_type,
           membership.user_id,
           null::uuid team_id,
           pg_catalog.array_agg(membership.id order by membership.created_at, membership.id) membership_ids,
           pg_catalog.count(*) row_count
    from public.team_memberships membership
    join public.teams team on team.id = membership.team_id
    join public.clubs club on club.id = team.club_id
    where membership.status::text = 'ACTIVE'
      and membership.membership_type::text = 'PRIMARY'
    group by membership.user_id, club.association_id
    having pg_catalog.count(*) > 1
  )
  select * from duplicate_team
  union all
  select * from multiple_primary
  order by issue_type, user_id, team_id nulls first;
$function$;

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
as $function$
declare
  v_actor uuid := auth.uid();
  v_mode text := public.administration_effective_mode(p_actor_mode);
  v_club_id uuid;
  v_association_id uuid;
  v_request_id uuid;
begin
  select team.club_id, club.association_id into v_club_id, v_association_id
  from public.teams team
  join public.clubs club on club.id = team.club_id
  where team.id = p_team_id;

  if not found then raise exception 'The selected team was not found.'; end if;
  if not public.administration_scope_allows(v_mode, v_association_id, v_club_id, p_team_id)
     or v_mode in ('coach', 'player') then
    raise exception 'You do not have permission to invite members to this team.';
  end if;
  if pg_catalog.upper(coalesce(p_membership_type, '')) not in ('PRIMARY','SECONDARY','FILL_IN') then
    raise exception 'The membership type is not recognised.';
  end if;
  if exists (
    select 1 from public.team_memberships membership
    where membership.user_id = p_target_user_id
      and membership.team_id = p_team_id
      and membership.status::text in ('ACTIVE','PENDING')
  ) or exists (
    select 1 from public.requests request_row
    where request_row.target_user_id = p_target_user_id
      and request_row.team_id = p_team_id
      and request_row.request_type::text = 'TEAM_INVITE'
      and request_row.status::text = 'PENDING'
  ) then
    raise exception 'This person already has an active or pending membership for that team.';
  end if;
  if pg_catalog.upper(p_membership_type) = 'PRIMARY' and exists (
    select 1
    from public.requests request_row
    left join public.teams requested_team on requested_team.id = request_row.team_id
    left join public.clubs requested_club on requested_club.id = requested_team.club_id
    where request_row.target_user_id = p_target_user_id
      and request_row.request_type::text = 'TEAM_INVITE'
      and request_row.status::text = 'PENDING'
      and request_row.membership_type = 'PRIMARY'
      and coalesce(requested_club.association_id, request_row.association_id) = v_association_id
  ) then
    raise exception 'This person already has a pending primary team request in that association.';
  end if;

  insert into public.requests (
    request_type, requester_id, target_user_id, team_id, association_id, club_id,
    membership_type, status
  ) values (
    'TEAM_INVITE', v_actor, p_target_user_id, p_team_id, v_association_id, v_club_id,
    pg_catalog.upper(p_membership_type), 'PENDING'
  ) returning id into v_request_id;

  insert into public.administration_audit_log (
    actor_id, actor_mode, action, record_type, record_id, target_user_id,
    association_id, club_id, team_id, new_data
  ) values (
    v_actor, v_mode, 'TEAM_INVITE_CREATED', 'request', v_request_id, p_target_user_id,
    v_association_id, v_club_id, p_team_id,
    pg_catalog.jsonb_build_object('membership_type', pg_catalog.upper(p_membership_type), 'status', 'PENDING')
  );

  return v_request_id;
end;
$function$;

create or replace function public.approve_membership_request_unbound(
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

  select request_row.* into v_request
  from public.requests request_row
  where request_row.id = p_request_id
  for update;

  if not found then raise exception 'The membership request was not found.'; end if;
  if v_request.status::text <> 'PENDING' then
    raise exception 'Only a pending membership request can be approved.';
  end if;

  v_team_id := v_request.team_id;
  v_club_id := v_request.club_id;
  v_association_id := v_request.association_id;

  if v_team_id is not null then
    select team.club_id, club.association_id into v_club_id, v_association_id
    from public.teams team
    join public.clubs club on club.id = team.club_id
    where team.id = v_team_id;
    if not found then raise exception 'The requested team was not found.'; end if;
    if v_request.club_id is not null and v_request.club_id <> v_club_id then
      raise exception 'The request club does not match the requested team.';
    end if;
    if v_request.association_id is not null and v_request.association_id <> v_association_id then
      raise exception 'The request association does not match the requested team.';
    end if;
  elsif v_club_id is not null then
    select club.association_id into v_association_id
    from public.clubs club where club.id = v_club_id;
    if not found then raise exception 'The requested club was not found.'; end if;
    if v_request.association_id is not null and v_request.association_id <> v_association_id then
      raise exception 'The request association does not match the requested club.';
    end if;
  end if;

  if not exists (
    select 1 from public.user_roles role_row
    where role_row.user_id = v_actor_id
      and (
        role_row.role::text = 'SUPER_ADMIN'
        or (role_row.role::text = 'ASSOCIATION_ADMIN' and v_association_id is not null and role_row.association_id = v_association_id)
        or (role_row.role::text = 'CLUB_ADMIN' and v_club_id is not null and role_row.club_id = v_club_id)
        or (role_row.role::text = 'TEAM_MANAGER' and v_team_id is not null and role_row.team_id = v_team_id)
      )
  ) then
    raise exception 'You do not have permission to approve this membership request.';
  end if;

  if p_assign_team and v_team_id is not null then
    if v_request.membership_type not in ('PRIMARY', 'SECONDARY', 'FILL_IN') then
      raise exception 'The requested membership type is not supported.';
    end if;

    if v_request.membership_type = 'PRIMARY' then
      v_membership_id := private.apply_primary_team_for_association(
        v_request.target_user_id,
        v_team_id,
        v_actor_id
      );
    else
      perform pg_catalog.pg_advisory_xact_lock(
        pg_catalog.hashtextextended('membership-user:' || v_request.target_user_id::text, 0)
      );
      select count(*), (pg_catalog.array_agg(membership.id order by membership.id))[1]
      into v_existing_membership_count, v_membership_id
      from public.team_memberships membership
      where membership.user_id = v_request.target_user_id
        and membership.team_id = v_team_id;

      if v_existing_membership_count > 1 then
        raise exception 'This person already has duplicate membership records for the requested team. Review the user before approving.';
      end if;
      if v_existing_membership_count = 0 then
        insert into public.team_memberships (user_id, team_id, membership_type, status, invited_by)
        values (
          v_request.target_user_id,
          v_team_id,
          v_request.membership_type::public.membership_type_enum,
          'ACTIVE'::public.membership_status_enum,
          v_actor_id
        ) returning id into v_membership_id;
      else
        update public.team_memberships membership
        set membership_type = v_request.membership_type::public.membership_type_enum,
            status = 'ACTIVE'::public.membership_status_enum,
            invited_by = coalesce(membership.invited_by, v_actor_id)
        where membership.id = v_membership_id;
      end if;
    end if;
    v_membership_changed := true;
  end if;

  update public.requests request_row
  set status = 'APPROVED'::public.request_status_enum,
      responded_by = v_actor_id,
      updated_at = pg_catalog.now()
  where request_row.id = p_request_id;

  return pg_catalog.jsonb_build_object(
    'request_id', p_request_id,
    'status', 'APPROVED',
    'team_assigned', v_membership_changed,
    'membership_id', v_membership_id
  );
end;
$function$;

revoke all on function private.apply_primary_team_for_association(uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function private.apply_primary_team_for_association(uuid, uuid, uuid)
  to service_role;

revoke all on function public.guard_team_membership_integrity()
  from public, anon, authenticated;
grant execute on function public.guard_team_membership_integrity()
  to service_role;

revoke all on function public.can_review_primary_team_change(uuid)
  from public, anon;
revoke all on function public.request_primary_team_change(uuid)
  from public, anon;
revoke all on function public.approve_primary_team_change(uuid)
  from public, anon;
revoke all on function public.confirm_primary_team_change(uuid)
  from public, anon;
revoke all on function public.admin_manage_team_membership(uuid, text, text, text)
  from public, anon;
revoke all on function public.admin_membership_integrity_report()
  from public, anon;

grant execute on function public.can_review_primary_team_change(uuid)
  to authenticated, service_role;
grant execute on function public.request_primary_team_change(uuid)
  to authenticated, service_role;
grant execute on function public.approve_primary_team_change(uuid)
  to authenticated, service_role;
grant execute on function public.confirm_primary_team_change(uuid)
  to authenticated, service_role;
grant execute on function public.admin_manage_team_membership(uuid, text, text, text)
  to authenticated, service_role;
grant execute on function public.admin_membership_integrity_report()
  to authenticated, service_role;
revoke all on function public.admin_create_team_invite(uuid, uuid, text, text)
  from public, anon;
grant execute on function public.admin_create_team_invite(uuid, uuid, text, text)
  to authenticated, service_role;
revoke all on function public.approve_membership_request_unbound(uuid, boolean)
  from public, anon, authenticated;
grant execute on function public.approve_membership_request_unbound(uuid, boolean)
  to service_role;

comment on function public.can_review_primary_team_change(uuid) is
  'Returns whether a destination team manager or scoped club/association administrator may review a Primary-team request.';
comment on function public.request_primary_team_change(uuid) is
  'Records player consent by creating one pending Primary-team request, scoped to the destination association.';
comment on function public.approve_primary_team_change(uuid) is
  'Approves and atomically completes a player-requested Primary-team change within the destination association.';
comment on function public.confirm_primary_team_change(uuid) is
  'Completes a legacy ADMIN_APPROVED Primary-team request within its association.';
