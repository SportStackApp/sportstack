-- Keep the primary-team change workflow valid on both the live Dev schema and
-- databases rebuilt from the older migrations. The original status check did
-- not include the two-step approval states now used by the application.
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

-- Admin approval is deliberately separate from the player's confirmation.
-- It still runs server-side so scope checks and the status transition cannot
-- be bypassed by changing a browser request.
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
  v_club_id uuid;
  v_association_id uuid;
begin
  if v_actor_id is null then
    raise exception 'You must be signed in to approve a primary team change.';
  end if;

  select request_row.*
  into v_request
  from public.primary_change_requests request_row
  where request_row.id = p_request_id
  for update;

  if not found then
    raise exception 'The primary team change request was not found.';
  end if;

  if v_request.status <> 'PENDING' then
    raise exception 'Only a pending primary team change can be approved.';
  end if;

  select team.club_id, club.association_id
  into v_club_id, v_association_id
  from public.teams team
  join public.clubs club on club.id = team.club_id
  where team.id = v_request.to_team_id;

  if not found then
    raise exception 'The requested team was not found.';
  end if;

  if not exists (
    select 1
    from public.user_roles role_row
    where role_row.user_id = v_actor_id
      and (
        role_row.role::text = 'SUPER_ADMIN'
        or (
          role_row.role::text = 'ASSOCIATION_ADMIN'
          and role_row.association_id = v_association_id
        )
        or (
          role_row.role::text = 'CLUB_ADMIN'
          and role_row.club_id = v_club_id
        )
      )
  ) then
    raise exception 'You do not have permission to approve this primary team change.';
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

-- The final confirmation serialises every membership change for the player
-- and commits the membership plus request status in one database transaction.
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

revoke all on function public.approve_primary_team_change(uuid)
  from public, anon;
grant execute on function public.approve_primary_team_change(uuid)
  to authenticated;

revoke all on function public.confirm_primary_team_change(uuid)
  from public, anon;
grant execute on function public.confirm_primary_team_change(uuid)
  to authenticated;

comment on function public.approve_primary_team_change(uuid) is
  'Approves one primary-team change after checking the signed-in admin scope.';

comment on function public.confirm_primary_team_change(uuid) is
  'Atomically applies an admin-approved primary-team change for the signed-in player.';
