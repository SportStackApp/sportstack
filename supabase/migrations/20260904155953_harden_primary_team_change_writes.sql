-- Primary-team requests must use the audited server transitions below. The
-- former own-row policies allowed a browser to write ADMIN_APPROVED directly.
drop policy if exists primary_change_requests_insert_own
  on public.primary_change_requests;
drop policy if exists primary_change_requests_update_own
  on public.primary_change_requests;

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

  if not exists (select 1 from public.teams team where team.id = p_to_team_id) then
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

  return jsonb_build_object('request_id', v_request_id, 'status', 'PENDING');
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
    and not exists (
      select 1 from public.user_roles role_row
      where role_row.user_id = v_actor_id and role_row.role::text = 'SUPER_ADMIN'
    )
  ) then
    raise exception 'The primary team change request was not found.';
  end if;

  if v_request.status not in ('PENDING', 'ADMIN_APPROVED') then
    raise exception 'This primary team change can no longer be cancelled.';
  end if;

  update public.primary_change_requests request_row
  set status = 'CANCELLED', resolved_by = v_actor_id, resolved_at = now(), updated_at = now()
  where request_row.id = p_request_id;

  return jsonb_build_object('request_id', p_request_id, 'status', 'CANCELLED');
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
  v_club_id uuid;
  v_association_id uuid;
begin
  if v_actor_id is null then
    raise exception 'You must be signed in to decline a primary team change.';
  end if;

  select request_row.*
  into v_request
  from public.primary_change_requests request_row
  where request_row.id = p_request_id
  for update;

  if not found then
    raise exception 'The primary team change request was not found.';
  end if;

  if v_request.status not in ('PENDING', 'ADMIN_APPROVED') then
    raise exception 'This primary team change can no longer be declined.';
  end if;

  select team.club_id, club.association_id
  into v_club_id, v_association_id
  from public.teams team
  join public.clubs club on club.id = team.club_id
  where team.id = v_request.to_team_id;

  if not exists (
    select 1
    from public.user_roles role_row
    where role_row.user_id = v_actor_id
      and (
        role_row.role::text = 'SUPER_ADMIN'
        or (role_row.role::text = 'ASSOCIATION_ADMIN' and role_row.association_id = v_association_id)
        or (role_row.role::text = 'CLUB_ADMIN' and role_row.club_id = v_club_id)
      )
  ) then
    raise exception 'You do not have permission to decline this primary team change.';
  end if;

  update public.primary_change_requests request_row
  set status = 'DECLINED', resolved_by = v_actor_id, resolved_at = now(), updated_at = now()
  where request_row.id = p_request_id;

  return jsonb_build_object('request_id', p_request_id, 'status', 'DECLINED');
end;
$function$;

revoke all on function public.request_primary_team_change(uuid) from public, anon;
revoke all on function public.cancel_primary_team_change(uuid) from public, anon;
revoke all on function public.decline_primary_team_change(uuid) from public, anon;
grant execute on function public.request_primary_team_change(uuid) to authenticated;
grant execute on function public.cancel_primary_team_change(uuid) to authenticated;
grant execute on function public.decline_primary_team_change(uuid) to authenticated;

comment on function public.request_primary_team_change(uuid) is
  'Creates one audited pending primary-team request for the signed-in player.';
comment on function public.cancel_primary_team_change(uuid) is
  'Cancels the signed-in player own pending or approved primary-team request.';
comment on function public.decline_primary_team_change(uuid) is
  'Declines a primary-team request after checking the signed-in admin scope.';
