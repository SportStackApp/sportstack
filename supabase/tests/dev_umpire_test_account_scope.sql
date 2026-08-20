-- Transactional regression test for the reserved Dev Umpire reset. The role
-- remains association-scoped while one team membership supplies test context.
begin;

do $test$
declare
  v_actor_id uuid;
  v_user_id uuid;
  v_association_id uuid;
  v_club_id uuid;
  v_team_id uuid;
  v_result jsonb;
begin
  if has_function_privilege(
       'anon',
       'public.provision_dev_test_account_data_scoped(uuid,uuid,text,text,uuid,uuid,uuid,boolean)',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'public.provision_dev_test_account_data_scoped(uuid,uuid,text,text,uuid,uuid,uuid,boolean)',
       'EXECUTE'
     ) then
    raise exception 'The Dev account provisioner must not be browser-executable.';
  end if;

  if not has_function_privilege(
       'service_role',
       'public.provision_dev_test_account_data_scoped(uuid,uuid,text,text,uuid,uuid,uuid,boolean)',
       'EXECUTE'
     ) then
    raise exception 'The service role cannot execute the Dev account provisioner.';
  end if;

  select auth_user.id
  into v_actor_id
  from auth.users auth_user
  join public.user_roles role_row on role_row.user_id = auth_user.id
  where lower(auth_user.email) = 'admin@sportstackapp.com.au'
    and role_row.role::text = 'SUPER_ADMIN'
  limit 1;

  select auth_user.id
  into v_user_id
  from auth.users auth_user
  where lower(auth_user.email) = 'codex.umpire.dev@sportstackapp.com.au'
    and coalesce(auth_user.raw_app_meta_data, '{}'::jsonb)
      @> '{"sportstack_dev_test": true}'::jsonb
  limit 1;

  select association.id
  into v_association_id
  from public.associations association
  where lower(btrim(association.name)) = 'hockey ballarat'
  limit 1;

  select club.id, team.id
  into v_club_id, v_team_id
  from public.clubs club
  join public.teams team on team.club_id = club.id
  where club.association_id = v_association_id
  order by club.name, team.name, team.id
  limit 1;

  if v_actor_id is null or v_user_id is null or v_association_id is null
     or v_club_id is null or v_team_id is null then
    raise exception 'The reserved Dev Umpire regression-test context is incomplete.';
  end if;

  select public.provision_dev_test_account_data_scoped(
    v_actor_id,
    v_user_id,
    'codex.umpire.dev@sportstackapp.com.au',
    'UMPIRE',
    v_association_id,
    v_club_id,
    v_team_id,
    false
  )
  into v_result;

  if coalesce((v_result->>'success')::boolean, false) is not true then
    raise exception 'The reserved Dev Umpire reset did not report success.';
  end if;

  if not exists (
    select 1
    from public.user_roles role_row
    where role_row.user_id = v_user_id
      and role_row.role::text = 'UMPIRE'
      and role_row.association_id = v_association_id
      and role_row.club_id is null
      and role_row.team_id is null
  ) then
    raise exception 'The reserved Dev Umpire role is not association-scoped.';
  end if;

  if exists (
    select 1
    from public.user_roles role_row
    where role_row.user_id = v_user_id
      and role_row.role::text <> 'UMPIRE'
  ) then
    raise exception 'The reserved Dev Umpire reset left an additional actual role.';
  end if;

  if not exists (
    select 1
    from public.team_memberships membership
    where membership.user_id = v_user_id
      and membership.team_id = v_team_id
      and membership.status = 'ACTIVE'::public.membership_status_enum
      and membership.membership_type = 'PRIMARY'::public.membership_type_enum
  ) then
    raise exception 'The reserved Dev Umpire team context is missing.';
  end if;
end
$test$;

rollback;
