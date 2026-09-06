-- B1 follow-up: keep every browser-facing administration operation bound to
-- the active mode and cascade stored for the current Auth session.
--
-- The earlier B1 administration bridge is already applied on Development, so
-- this correction is deliberately additive and does not rewrite that history.

do $b1_session_wrapper_renames$
begin
  if to_regprocedure('public.admin_visible_profile_ids_unbound(text,uuid,uuid,uuid)') is null then
    alter function public.admin_visible_profile_ids(text, uuid, uuid, uuid)
      rename to admin_visible_profile_ids_unbound;
  end if;

  if to_regprocedure('public.administration_target_profile_in_scope_unbound(uuid,text)') is null then
    alter function public.administration_target_profile_in_scope(uuid, text)
      rename to administration_target_profile_in_scope_unbound;
  end if;

  if to_regprocedure('public.admin_update_profile_details_unbound(uuid,jsonb,text)') is null then
    alter function public.admin_update_profile_details(uuid, jsonb, text)
      rename to admin_update_profile_details_unbound;
  end if;

  if to_regprocedure('public.approve_membership_request_unbound(uuid,boolean)') is null then
    alter function public.approve_membership_request(uuid, boolean)
      rename to approve_membership_request_unbound;
  end if;
end;
$b1_session_wrapper_renames$;

revoke all on function public.admin_visible_profile_ids_unbound(text, uuid, uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.administration_target_profile_in_scope_unbound(uuid, text)
  from public, anon, authenticated;
revoke all on function public.admin_update_profile_details_unbound(uuid, jsonb, text)
  from public, anon, authenticated;
revoke all on function public.approve_membership_request_unbound(uuid, boolean)
  from public, anon, authenticated;

grant execute on function public.admin_visible_profile_ids_unbound(text, uuid, uuid, uuid)
  to service_role;
grant execute on function public.administration_target_profile_in_scope_unbound(uuid, text)
  to service_role;
grant execute on function public.admin_update_profile_details_unbound(uuid, jsonb, text)
  to service_role;
grant execute on function public.approve_membership_request_unbound(uuid, boolean)
  to service_role;

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
  v_mode text := public.administration_effective_mode(p_actor_mode);
begin
  if private.active_permission_mode_for_current_session() is distinct from v_mode then
    return;
  end if;

  return query
  select visible.profile_id
  from public.admin_visible_profile_ids_unbound(
    p_actor_mode,
    p_association_id,
    p_club_id,
    p_team_id
  ) visible;
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
  if private.active_permission_mode_for_current_session() is distinct from v_mode then
    return false;
  end if;

  return public.administration_target_profile_in_scope_unbound(
    p_user_id,
    p_actor_mode
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
as $function$
declare
  v_mode text := public.administration_effective_mode(p_actor_mode);
begin
  if private.active_permission_mode_for_current_session() is distinct from v_mode then
    raise exception using
      errcode = '42501',
      message = 'The selected administration mode is not active for this session.';
  end if;

  return public.admin_update_profile_details_unbound(
    p_user_id,
    p_details,
    p_actor_mode
  );
end;
$function$;

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
  v_mode text := private.active_permission_mode_for_current_session();
  v_association_id uuid;
  v_club_id uuid;
  v_team_id uuid;
begin
  if auth.uid() is null then
    raise exception using
      errcode = '42501',
      message = 'You must be signed in to approve membership requests.';
  end if;

  select
    coalesce(team_club.association_id, request_club.association_id, request_row.association_id),
    coalesce(requested_team.club_id, request_row.club_id),
    request_row.team_id
  into v_association_id, v_club_id, v_team_id
  from public.requests request_row
  left join public.teams requested_team
    on requested_team.id = request_row.team_id
  left join public.clubs team_club
    on team_club.id = requested_team.club_id
  left join public.clubs request_club
    on request_club.id = request_row.club_id
  where request_row.id = p_request_id;

  if not found then
    raise exception 'The membership request was not found.';
  end if;

  if v_mode not in ('super_admin', 'association', 'club', 'team_manager')
    or not public.administration_scope_allows(
      v_mode,
      v_association_id,
      v_club_id,
      v_team_id
    ) then
    raise exception using
      errcode = '42501',
      message = 'You do not have permission to approve this membership request from the active mode and scope.';
  end if;

  return public.approve_membership_request_unbound(
    p_request_id,
    p_assign_team
  );
end;
$function$;

revoke all on function public.admin_visible_profile_ids(text, uuid, uuid, uuid)
  from public, anon;
revoke all on function public.administration_target_profile_in_scope(uuid, text)
  from public, anon, authenticated;
revoke all on function public.admin_update_profile_details(uuid, jsonb, text)
  from public, anon;
revoke all on function public.approve_membership_request(uuid, boolean)
  from public, anon;

grant execute on function public.admin_visible_profile_ids(text, uuid, uuid, uuid)
  to authenticated, service_role;
grant execute on function public.administration_target_profile_in_scope(uuid, text)
  to service_role;
grant execute on function public.admin_update_profile_details(uuid, jsonb, text)
  to authenticated, service_role;
grant execute on function public.approve_membership_request(uuid, boolean)
  to authenticated, service_role;

comment on function public.admin_visible_profile_ids(text, uuid, uuid, uuid) is
  'Browser wrapper that requires the requested administration mode to match the current Auth session before listing profiles.';
comment on function public.administration_target_profile_in_scope(uuid, text) is
  'Service-only scope helper that rejects role mutation when the resolved mode is not active for the current Auth session.';
comment on function public.admin_update_profile_details(uuid, jsonb, text) is
  'Browser wrapper that binds profile mutation to the current Auth session mode before delegating to the scoped implementation.';
comment on function public.approve_membership_request(uuid, boolean) is
  'Browser wrapper that binds request approval to the current Auth session mode and selected organisation scope.';
