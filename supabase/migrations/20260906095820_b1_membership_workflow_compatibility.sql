-- B1c compatibility bridge for the primary-team change lifecycle.
--
-- Production still has the original direct-write policies, while Development
-- already has the protected RPC workflow. This repeat-safe migration installs
-- the final workflow on either schema and removes browser write access to the
-- request table. Historical membership cleanup is deliberately out of scope.

alter table public.primary_change_requests
  drop constraint if exists valid_status;

alter table public.primary_change_requests
  drop constraint if exists primary_change_requests_valid_status;

alter table public.primary_change_requests
  add constraint primary_change_requests_valid_status
  check (status in (
    'PENDING',
    'ADMIN_APPROVED',
    'COMPLETED',
    'APPROVED',
    'DECLINED',
    'CANCELLED'
  ));

create or replace function public.can_review_primary_team_change(
  p_to_team_id uuid
)
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
        or (
          role_row.role::text = 'ASSOCIATION_ADMIN'
          and role_row.association_id = club.association_id
        )
        or (
          role_row.role::text = 'CLUB_ADMIN'
          and role_row.club_id = team.club_id
        )
      )
  );
$function$;

create or replace function public.request_primary_team_change(
  p_to_team_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor_id uuid := auth.uid();
  v_from_team_id uuid;
  v_primary_count integer;
  v_request_id uuid;
begin
  if v_actor_id is null then
    raise exception 'You must be signed in to request a primary team change.';
  end if;

  if not exists (
    select 1
    from public.teams team
    where team.id = p_to_team_id
  ) then
    raise exception 'The requested team was not found.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('primary-change-request:' || v_actor_id::text, 0)
  );

  select count(*), (array_agg(membership.team_id order by membership.id))[1]
  into v_primary_count, v_from_team_id
  from public.team_memberships membership
  where membership.user_id = v_actor_id
    and membership.status = 'ACTIVE'::public.membership_status_enum
    and membership.membership_type = 'PRIMARY'::public.membership_type_enum;

  if v_primary_count > 1 then
    raise exception 'Multiple active primary memberships exist. An admin must repair them first.';
  end if;

  if v_from_team_id = p_to_team_id then
    raise exception 'That team is already your primary team.';
  end if;

  if exists (
    select 1
    from public.primary_change_requests request_row
    where request_row.user_id = v_actor_id
      and request_row.status in ('PENDING', 'ADMIN_APPROVED')
  ) then
    raise exception 'You already have a primary team change in progress.';
  end if;

  insert into public.primary_change_requests (
    user_id,
    from_team_id,
    to_team_id,
    status
  )
  values (
    v_actor_id,
    v_from_team_id,
    p_to_team_id,
    'PENDING'
  )
  returning id into v_request_id;

  return jsonb_build_object(
    'request_id', v_request_id,
    'status', 'PENDING'
  );
end;
$function$;

create or replace function public.approve_primary_team_change(
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor_id uuid := auth.uid();
  v_request public.primary_change_requests%rowtype;
begin
  if v_actor_id is null then
    raise exception 'You must be signed in to approve a primary team change.';
  end if;

  select request_row.*
  into v_request
  from public.primary_change_requests request_row
  where request_row.id = p_request_id
  for update;

  if not found or not public.can_review_primary_team_change(v_request.to_team_id) then
    raise exception 'The primary team change request was not found.';
  end if;

  if v_request.status <> 'PENDING' then
    raise exception 'Only a pending primary team change can be approved.';
  end if;

  update public.primary_change_requests request_row
  set
    status = 'ADMIN_APPROVED',
    resolved_by = v_actor_id,
    resolved_at = null,
    updated_at = now()
  where request_row.id = p_request_id;

  return jsonb_build_object(
    'request_id', p_request_id,
    'status', 'ADMIN_APPROVED'
  );
end;
$function$;

create or replace function public.confirm_primary_team_change(
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor_id uuid := auth.uid();
  v_request public.primary_change_requests%rowtype;
  v_membership_id uuid;
  v_existing_membership_count integer := 0;
begin
  if v_actor_id is null then
    raise exception 'You must be signed in to confirm a primary team change.';
  end if;

  select request_row.*
  into v_request
  from public.primary_change_requests request_row
  where request_row.id = p_request_id
  for update;

  if not found then
    raise exception 'The primary team change request was not found.';
  end if;

  if v_request.user_id <> v_actor_id then
    raise exception 'You can only confirm your own primary team change.';
  end if;

  if v_request.status <> 'ADMIN_APPROVED' then
    raise exception 'This primary team change is not ready for confirmation.';
  end if;

  if not exists (
    select 1
    from public.teams team
    where team.id = v_request.to_team_id
  ) then
    raise exception 'The requested team was not found.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('membership-user:' || v_actor_id::text, 0)
  );

  select count(*), (array_agg(membership.id order by membership.id))[1]
  into v_existing_membership_count, v_membership_id
  from public.team_memberships membership
  where membership.user_id = v_actor_id
    and membership.team_id = v_request.to_team_id;

  if v_existing_membership_count > 1 then
    raise exception 'Duplicate membership records exist for the requested team. An admin must repair them first.';
  end if;

  update public.team_memberships membership
  set membership_type = 'SECONDARY'::public.membership_type_enum
  where membership.user_id = v_actor_id
    and membership.team_id <> v_request.to_team_id
    and membership.status = 'ACTIVE'::public.membership_status_enum
    and membership.membership_type = 'PRIMARY'::public.membership_type_enum;

  if v_existing_membership_count = 0 then
    insert into public.team_memberships (
      user_id,
      team_id,
      membership_type,
      status,
      invited_by
    )
    values (
      v_actor_id,
      v_request.to_team_id,
      'PRIMARY'::public.membership_type_enum,
      'ACTIVE'::public.membership_status_enum,
      v_request.resolved_by
    )
    returning id into v_membership_id;
  else
    update public.team_memberships membership
    set
      membership_type = 'PRIMARY'::public.membership_type_enum,
      status = 'ACTIVE'::public.membership_status_enum,
      invited_by = coalesce(membership.invited_by, v_request.resolved_by)
    where membership.id = v_membership_id;
  end if;

  update public.primary_change_requests request_row
  set
    status = 'COMPLETED',
    resolved_at = now(),
    updated_at = now()
  where request_row.id = p_request_id;

  return jsonb_build_object(
    'request_id', p_request_id,
    'status', 'COMPLETED',
    'membership_id', v_membership_id
  );
end;
$function$;

create or replace function public.cancel_primary_team_change(
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor_id uuid := auth.uid();
  v_request public.primary_change_requests%rowtype;
begin
  if v_actor_id is null then
    raise exception 'You must be signed in to cancel a primary team change.';
  end if;

  select request_row.*
  into v_request
  from public.primary_change_requests request_row
  where request_row.id = p_request_id
  for update;

  if not found or (
    v_request.user_id <> v_actor_id
    and not public.is_super_admin()
  ) then
    raise exception 'The primary team change request was not found.';
  end if;

  if v_request.status not in ('PENDING', 'ADMIN_APPROVED') then
    raise exception 'This primary team change can no longer be cancelled.';
  end if;

  update public.primary_change_requests request_row
  set
    status = 'CANCELLED',
    resolved_by = v_actor_id,
    resolved_at = now(),
    updated_at = now()
  where request_row.id = p_request_id;

  return jsonb_build_object(
    'request_id', p_request_id,
    'status', 'CANCELLED'
  );
end;
$function$;

create or replace function public.decline_primary_team_change(
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor_id uuid := auth.uid();
  v_request public.primary_change_requests%rowtype;
begin
  if v_actor_id is null then
    raise exception 'You must be signed in to decline a primary team change.';
  end if;

  select request_row.*
  into v_request
  from public.primary_change_requests request_row
  where request_row.id = p_request_id
  for update;

  if not found or not public.can_review_primary_team_change(v_request.to_team_id) then
    raise exception 'The primary team change request was not found.';
  end if;

  if v_request.status not in ('PENDING', 'ADMIN_APPROVED') then
    raise exception 'This primary team change can no longer be declined.';
  end if;

  update public.primary_change_requests request_row
  set
    status = 'DECLINED',
    resolved_by = v_actor_id,
    resolved_at = now(),
    updated_at = now()
  where request_row.id = p_request_id;

  return jsonb_build_object(
    'request_id', p_request_id,
    'status', 'DECLINED'
  );
end;
$function$;

-- Replace every historical policy name so a Production apply and a repeated
-- Development apply converge on the same two read-only policies.
drop policy if exists "Users can view their own primary change requests"
  on public.primary_change_requests;
drop policy if exists "Users can create their own primary change requests"
  on public.primary_change_requests;
drop policy if exists "Users can cancel their own pending requests"
  on public.primary_change_requests;
drop policy if exists "Admins and coaches can manage primary change requests"
  on public.primary_change_requests;
drop policy if exists primary_change_requests_insert_own
  on public.primary_change_requests;
drop policy if exists primary_change_requests_update_own
  on public.primary_change_requests;
drop policy if exists primary_change_requests_read_own
  on public.primary_change_requests;
drop policy if exists primary_change_requests_read_scoped_admin
  on public.primary_change_requests;
drop policy if exists primary_change_requests_super_admin
  on public.primary_change_requests;

create policy primary_change_requests_read_own
  on public.primary_change_requests
  for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy primary_change_requests_read_scoped_admin
  on public.primary_change_requests
  for select
  to authenticated
  using (public.can_review_primary_team_change(to_team_id));

-- Request state changes are RPC-only. Authenticated callers retain SELECT for
-- the profile and administrator request screens; anonymous callers get none.
revoke all on table public.primary_change_requests from anon;
revoke insert, update, delete, truncate, references, trigger
  on table public.primary_change_requests from authenticated;
grant select on table public.primary_change_requests to authenticated;

revoke all on function public.can_review_primary_team_change(uuid)
  from public, anon;
revoke all on function public.request_primary_team_change(uuid)
  from public, anon;
revoke all on function public.approve_primary_team_change(uuid)
  from public, anon;
revoke all on function public.confirm_primary_team_change(uuid)
  from public, anon;
revoke all on function public.cancel_primary_team_change(uuid)
  from public, anon;
revoke all on function public.decline_primary_team_change(uuid)
  from public, anon;

grant execute on function public.can_review_primary_team_change(uuid)
  to authenticated, service_role;
grant execute on function public.request_primary_team_change(uuid)
  to authenticated, service_role;
grant execute on function public.approve_primary_team_change(uuid)
  to authenticated, service_role;
grant execute on function public.confirm_primary_team_change(uuid)
  to authenticated, service_role;
grant execute on function public.cancel_primary_team_change(uuid)
  to authenticated, service_role;
grant execute on function public.decline_primary_team_change(uuid)
  to authenticated, service_role;

comment on function public.can_review_primary_team_change(uuid) is
  'Returns whether the signed-in administrator may review requests for one destination team.';
comment on function public.request_primary_team_change(uuid) is
  'Creates one audited pending primary-team request for the signed-in player.';
comment on function public.approve_primary_team_change(uuid) is
  'Approves one primary-team change after checking the signed-in administrator scope.';
comment on function public.confirm_primary_team_change(uuid) is
  'Atomically applies an administrator-approved primary-team change for the signed-in player.';
comment on function public.cancel_primary_team_change(uuid) is
  'Cancels the signed-in player own pending or approved primary-team request.';
comment on function public.decline_primary_team_change(uuid) is
  'Declines a primary-team request after checking the signed-in administrator scope.';
