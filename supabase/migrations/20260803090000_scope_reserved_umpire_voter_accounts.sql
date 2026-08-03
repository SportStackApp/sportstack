-- Give the reserved Umpire and Voter Dev accounts a disposable team context
-- while retaining exactly one stored role. This wrapper keeps every database
-- write in one transaction and leaves the original provisioning function
-- available for compatibility with earlier deployments.

create or replace function public.provision_dev_test_account_data_scoped(
  p_actor_id uuid,
  p_user_id uuid,
  p_email text,
  p_role text,
  p_association_id uuid,
  p_club_id uuid,
  p_team_id uuid,
  p_created boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_role text := upper(trim(coalesce(p_role, '')));
  v_membership_id uuid;
  v_result jsonb;
  v_final_roles jsonb;
  v_final_memberships jsonb;
begin
  if v_role not in ('UMPIRE', 'VOTER') then
    return public.provision_dev_test_account_data(
      p_actor_id,
      p_user_id,
      p_email,
      p_role,
      p_association_id,
      p_club_id,
      p_team_id,
      p_created
    );
  end if;

  if p_association_id is null or p_club_id is null or p_team_id is null
    or not exists (
      select 1
      from public.teams team
      join public.clubs club on club.id = team.club_id
      where team.id = p_team_id
        and team.club_id = p_club_id
        and club.association_id = p_association_id
    ) then
    raise exception 'The reserved Umpire and Voter test accounts require a team inside the selected club and association.';
  end if;

  -- The established function performs the identity check, profile reset,
  -- single-role reset and first audit record. Passing an empty scope preserves
  -- its strict contract for Umpire and Voter before the test context is added.
  v_result := public.provision_dev_test_account_data(
    p_actor_id,
    p_user_id,
    p_email,
    p_role,
    null,
    null,
    null,
    p_created
  );

  update public.user_roles role_row
  set association_id = p_association_id,
      club_id = p_club_id,
      team_id = p_team_id
  where role_row.user_id = p_user_id
    and role_row.role::text = v_role;

  select membership.id
  into v_membership_id
  from public.team_memberships membership
  where membership.user_id = p_user_id
    and membership.team_id = p_team_id
  order by membership.created_at, membership.id
  limit 1;

  if v_membership_id is null then
    insert into public.team_memberships (
      user_id,
      team_id,
      membership_type,
      status
    ) values (
      p_user_id,
      p_team_id,
      'PRIMARY'::public.membership_type_enum,
      'ACTIVE'::public.membership_status_enum
    );
  else
    update public.team_memberships membership
    set membership_type = 'PRIMARY'::public.membership_type_enum,
        status = 'ACTIVE'::public.membership_status_enum
    where membership.id = v_membership_id;
  end if;

  -- The normal membership trigger adds PLAYER. These two accounts exist to
  -- test Umpire-only and Voter-only navigation, so remove only that automatic
  -- role after the supporting disposable membership has been activated.
  delete from public.user_roles role_row
  where role_row.user_id = p_user_id
    and role_row.role::text = 'PLAYER';

  select coalesce(
    jsonb_agg(to_jsonb(role_row) order by role_row.created_at, role_row.id),
    '[]'::jsonb
  )
  into v_final_roles
  from public.user_roles role_row
  where role_row.user_id = p_user_id;

  select coalesce(
    jsonb_agg(to_jsonb(membership) order by membership.created_at, membership.id),
    '[]'::jsonb
  )
  into v_final_memberships
  from public.team_memberships membership
  where membership.user_id = p_user_id;

  insert into public.administration_audit_log (
    actor_id,
    actor_mode,
    action,
    record_type,
    record_id,
    target_user_id,
    association_id,
    club_id,
    team_id,
    old_data,
    new_data
  ) values (
    p_actor_id,
    'SUPER_ADMIN',
    'DEV_TEST_ACCOUNT_SCOPE_ATTACHED',
    'DEV_TEST_ACCOUNT',
    p_user_id,
    p_user_id,
    p_association_id,
    p_club_id,
    p_team_id,
    jsonb_build_object('provision_result', v_result),
    jsonb_build_object(
      'role', v_role,
      'sportstack_dev_test', true,
      'roles', v_final_roles,
      'memberships', v_final_memberships
    )
  );

  return v_result || jsonb_build_object(
    'association_id', p_association_id,
    'club_id', p_club_id,
    'team_id', p_team_id,
    'roles', v_final_roles,
    'memberships', v_final_memberships
  );
end;
$function$;

revoke all on function public.provision_dev_test_account_data_scoped(
  uuid, uuid, text, text, uuid, uuid, uuid, boolean
) from public, anon, authenticated;
grant execute on function public.provision_dev_test_account_data_scoped(
  uuid, uuid, text, text, uuid, uuid, uuid, boolean
) to service_role;

comment on function public.provision_dev_test_account_data_scoped(
  uuid, uuid, text, text, uuid, uuid, uuid, boolean
) is 'Atomically resets a reserved disposable Dev test account and adds the supporting team context required for isolated Umpire or Voter role testing. Service role only.';
