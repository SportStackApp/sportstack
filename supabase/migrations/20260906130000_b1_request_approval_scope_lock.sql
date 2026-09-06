-- Close the request-approval check/use race without rewriting either applied B1e migration.
-- The wrapper now locks the request row before deriving and authorising its scope.

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
  where request_row.id = p_request_id
  for update of request_row;

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

revoke all on function public.approve_membership_request(uuid, boolean)
  from public, anon;
grant execute on function public.approve_membership_request(uuid, boolean)
  to authenticated, service_role;

comment on function public.approve_membership_request(uuid, boolean) is
  'Browser wrapper that locks the request before binding approval to the current Auth session mode and selected organisation scope.';
