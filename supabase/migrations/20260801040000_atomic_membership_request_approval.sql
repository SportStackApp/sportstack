-- Approve one team membership request and apply its membership changes in a
-- single transaction. The function derives organisation scope from the team
-- and checks the signed-in administrator before changing any row.

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
    if v_request.membership_type not in ('PRIMARY', 'SECONDARY') then
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

revoke all on function public.approve_membership_request(uuid, boolean)
  from public, anon;
grant execute on function public.approve_membership_request(uuid, boolean)
  to authenticated;

comment on function public.approve_membership_request(uuid, boolean) is
  'Atomically approves one scoped membership request and applies its optional team membership.';
