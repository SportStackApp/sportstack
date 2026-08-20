-- Keep the reserved Dev Umpire role association-scoped after the scoped-role
-- rules introduced on 19 August 2026. The account still receives one
-- disposable team membership so actual-role fixture testing remains useful.

alter function public.provision_dev_test_account_data_scoped(
  uuid, uuid, text, text, uuid, uuid, uuid, boolean
) rename to provision_dev_test_account_data_scoped_legacy;

revoke all on function public.provision_dev_test_account_data_scoped_legacy(
  uuid, uuid, text, text, uuid, uuid, uuid, boolean
) from public, anon, authenticated;
grant execute on function public.provision_dev_test_account_data_scoped_legacy(
  uuid, uuid, text, text, uuid, uuid, uuid, boolean
) to service_role;

create or replace function public.provision_dev_umpire_test_account_data(
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
  v_email text := lower(trim(coalesce(p_email, '')));
  v_role text := upper(trim(coalesce(p_role, '')));
  v_membership_id uuid;
  v_old_roles jsonb;
  v_old_memberships jsonb;
  v_new_roles jsonb;
  v_new_memberships jsonb;
  v_result jsonb;
begin
  if v_role <> 'UMPIRE'
     or v_email <> 'codex.umpire.dev@sportstackapp.com.au' then
    raise exception 'The reserved Dev Umpire identity is invalid.';
  end if;

  if not exists (
    select 1
    from public.user_roles actor_role
    where actor_role.user_id = p_actor_id
      and actor_role.role::text = 'SUPER_ADMIN'
  ) then
    raise exception using
      errcode = '42501',
      message = 'Only an actual Super Admin can provision Dev test accounts.';
  end if;

  if not exists (
    select 1
    from auth.users auth_user
    where auth_user.id = p_user_id
      and lower(auth_user.email) = v_email
      and coalesce(auth_user.raw_app_meta_data, '{}'::jsonb)
        @> '{"sportstack_dev_test": true}'::jsonb
  ) then
    raise exception 'The Auth user is not the matching disposable Dev test account.';
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
    raise exception 'The reserved Umpire test account requires a team inside the selected club and association.';
  end if;

  select coalesce(
    jsonb_agg(to_jsonb(role_row) order by role_row.created_at, role_row.id),
    '[]'::jsonb
  )
  into v_old_roles
  from public.user_roles role_row
  where role_row.user_id = p_user_id;

  select coalesce(
    jsonb_agg(to_jsonb(membership) order by membership.created_at, membership.id),
    '[]'::jsonb
  )
  into v_old_memberships
  from public.team_memberships membership
  where membership.user_id = p_user_id;

  insert into public.profiles (
    id,
    first_name,
    last_name,
    phone,
    date_of_birth,
    gender,
    is_placeholder,
    is_umpire,
    updated_at
  ) values (
    p_user_id,
    'Codex',
    'Umpire Test',
    '0400 000 000',
    '2000-01-01',
    'Other',
    false,
    true,
    now()
  )
  on conflict (id) do update set
    first_name = excluded.first_name,
    last_name = excluded.last_name,
    phone = excluded.phone,
    date_of_birth = excluded.date_of_birth,
    gender = excluded.gender,
    is_placeholder = excluded.is_placeholder,
    is_umpire = excluded.is_umpire,
    updated_at = excluded.updated_at;

  delete from public.user_roles role_row
  where role_row.user_id = p_user_id;

  update public.team_memberships membership
  set status = 'INACTIVE'::public.membership_status_enum
  where membership.user_id = p_user_id
    and membership.status <> 'INACTIVE'::public.membership_status_enum;

  -- Umpire authority belongs to the association, never a club or team.
  insert into public.user_roles (
    user_id,
    role,
    association_id,
    club_id,
    team_id
  ) values (
    p_user_id,
    'UMPIRE'::public.user_role_enum,
    p_association_id,
    null,
    null
  );

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

  -- The membership trigger adds PLAYER. Preserve the reserved account's one
  -- actual role while retaining its disposable team context.
  delete from public.user_roles role_row
  where role_row.user_id = p_user_id
    and role_row.role::text = 'PLAYER';

  select coalesce(
    jsonb_agg(to_jsonb(role_row) order by role_row.created_at, role_row.id),
    '[]'::jsonb
  )
  into v_new_roles
  from public.user_roles role_row
  where role_row.user_id = p_user_id;

  select coalesce(
    jsonb_agg(to_jsonb(membership) order by membership.created_at, membership.id),
    '[]'::jsonb
  )
  into v_new_memberships
  from public.team_memberships membership
  where membership.user_id = p_user_id;

  v_result := jsonb_build_object(
    'success', true,
    'created', coalesce(p_created, false),
    'user_id', p_user_id,
    'email', v_email,
    'role', v_role,
    'association_id', p_association_id,
    'club_id', p_club_id,
    'team_id', p_team_id,
    'roles', v_new_roles,
    'memberships', v_new_memberships
  );

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
    case when coalesce(p_created, false)
      then 'DEV_TEST_ACCOUNT_CREATED'
      else 'DEV_TEST_ACCOUNT_RESET'
    end,
    'DEV_TEST_ACCOUNT',
    p_user_id,
    p_user_id,
    p_association_id,
    p_club_id,
    p_team_id,
    jsonb_build_object('roles', v_old_roles, 'memberships', v_old_memberships),
    jsonb_build_object(
      'email', v_email,
      'role', v_role,
      'sportstack_dev_test', true,
      'roles', v_new_roles,
      'memberships', v_new_memberships
    )
  );

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
    jsonb_build_object('roles', v_old_roles, 'memberships', v_old_memberships),
    jsonb_build_object(
      'role', v_role,
      'sportstack_dev_test', true,
      'roles', v_new_roles,
      'memberships', v_new_memberships
    )
  );

  return v_result;
end;
$function$;

revoke all on function public.provision_dev_umpire_test_account_data(
  uuid, uuid, text, text, uuid, uuid, uuid, boolean
) from public, anon, authenticated;
grant execute on function public.provision_dev_umpire_test_account_data(
  uuid, uuid, text, text, uuid, uuid, uuid, boolean
) to service_role;

create function public.provision_dev_test_account_data_scoped(
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
begin
  if upper(trim(coalesce(p_role, ''))) = 'UMPIRE' then
    return public.provision_dev_umpire_test_account_data(
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

  return public.provision_dev_test_account_data_scoped_legacy(
    p_actor_id,
    p_user_id,
    p_email,
    p_role,
    p_association_id,
    p_club_id,
    p_team_id,
    p_created
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
) is 'Atomically resets a reserved disposable Dev test account. Umpires keep association role scope plus a disposable team membership; other roles retain the established provisioning path. Service role only.';

notify pgrst, 'reload schema';
