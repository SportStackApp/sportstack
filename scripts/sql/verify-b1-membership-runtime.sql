do $b1c_static$
declare
  v_function_names text[] := array[
    'public.approve_primary_team_change',
    'public.can_review_primary_team_change',
    'public.cancel_primary_team_change',
    'public.confirm_primary_team_change',
    'public.decline_primary_team_change',
    'public.request_primary_team_change'
  ];
  v_count integer;
begin
  select count(*)
  into v_count
  from pg_catalog.pg_proc procedure_row
  join pg_catalog.pg_namespace namespace_row
    on namespace_row.oid = procedure_row.pronamespace
  where namespace_row.nspname || '.' || procedure_row.proname = any(v_function_names)
    and procedure_row.prosecdef
    and coalesce(procedure_row.proconfig, array[]::text[]) @> array['search_path=""'];
  if v_count <> 6 then
    raise exception 'Only % of 6 B1c functions are hardened.', v_count;
  end if;

  select count(*)
  into v_count
  from pg_catalog.pg_proc procedure_row
  join pg_catalog.pg_namespace namespace_row
    on namespace_row.oid = procedure_row.pronamespace
  where namespace_row.nspname || '.' || procedure_row.proname = any(v_function_names)
    and pg_catalog.has_function_privilege('authenticated', procedure_row.oid, 'EXECUTE')
    and pg_catalog.has_function_privilege('service_role', procedure_row.oid, 'EXECUTE')
    and not pg_catalog.has_function_privilege('anon', procedure_row.oid, 'EXECUTE');
  if v_count <> 6 then
    raise exception 'Only % of 6 B1c functions have the required allow-list.', v_count;
  end if;

  select count(*)
  into v_count
  from pg_catalog.pg_proc procedure_row
  join pg_catalog.pg_namespace namespace_row
    on namespace_row.oid = procedure_row.pronamespace
  cross join lateral pg_catalog.aclexplode(
    coalesce(procedure_row.proacl, pg_catalog.acldefault('f', procedure_row.proowner))
  ) access_row
  where namespace_row.nspname || '.' || procedure_row.proname = any(v_function_names)
    and access_row.grantee = 0
    and access_row.privilege_type = 'EXECUTE';
  if v_count <> 0 then
    raise exception 'PUBLIC can execute % B1c functions.', v_count;
  end if;

  if not pg_catalog.has_table_privilege(
    'authenticated',
    'public.primary_change_requests',
    'SELECT'
  ) or pg_catalog.has_table_privilege(
    'authenticated',
    'public.primary_change_requests',
    'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'
  ) then
    raise exception 'Authenticated request-table privileges are incorrect.';
  end if;

  if pg_catalog.has_table_privilege(
    'anon',
    'public.primary_change_requests',
    'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'
  ) then
    raise exception 'Anonymous request-table privileges remain.';
  end if;

  select count(*)
  into v_count
  from pg_catalog.pg_policies policy_row
  where policy_row.schemaname = 'public'
    and policy_row.tablename = 'primary_change_requests'
    and policy_row.policyname in (
      'primary_change_requests_read_own',
      'primary_change_requests_read_scoped_admin'
    )
    and policy_row.cmd = 'SELECT'
    and policy_row.roles = array['authenticated']::name[];
  if v_count <> 2 then
    raise exception 'Expected the two B1c read policies, found %.', v_count;
  end if;

  select count(*)
  into v_count
  from pg_catalog.pg_policies policy_row
  where policy_row.schemaname = 'public'
    and policy_row.tablename = 'primary_change_requests';
  if v_count <> 2 then
    raise exception 'Unexpected primary-change policy count: %.', v_count;
  end if;
end;
$b1c_static$;

-- Use existing non-placeholder-shaped memberships only as transaction-local
-- test inputs. Every workflow change below is rolled back.
begin;
do $b1c_select_candidate$
declare
  v_candidate jsonb;
begin
  select jsonb_build_object(
    'requester_id', membership.user_id,
    'from_team_id', membership.team_id,
    'to_team_id', target_team.id,
    'club_id', from_team.club_id,
    'club_admin_id', club_admin.user_id,
    'unrelated_user_id', unrelated_user.id
  )
  into v_candidate
  from public.team_memberships membership
  join public.teams from_team on from_team.id = membership.team_id
  join lateral (
    select team.id
    from public.teams team
    where team.club_id = from_team.club_id
      and team.id <> membership.team_id
      and not exists (
        select 1
        from public.team_memberships target_membership
        where target_membership.user_id = membership.user_id
          and target_membership.team_id = team.id
      )
    order by team.id
    limit 1
  ) target_team on true
  join lateral (
    select profile_row.id as user_id
    from public.profiles profile_row
    where profile_row.id <> membership.user_id
      and not exists (
        select 1
        from public.user_roles role_row
        where role_row.user_id = profile_row.id
          and role_row.role::text in ('SUPER_ADMIN', 'ASSOCIATION_ADMIN', 'CLUB_ADMIN')
      )
    order by profile_row.id
    limit 1
  ) club_admin on true
  join lateral (
    select profile_row.id
    from public.profiles profile_row
    where profile_row.id not in (membership.user_id, club_admin.user_id)
      and not exists (
        select 1
        from public.user_roles role_row
        join public.clubs club on club.id = from_team.club_id
        where role_row.user_id = profile_row.id
          and (
            role_row.role::text = 'SUPER_ADMIN'
            or (
              role_row.role::text = 'ASSOCIATION_ADMIN'
              and role_row.association_id = club.association_id
            )
            or (
              role_row.role::text = 'CLUB_ADMIN'
              and role_row.club_id = from_team.club_id
            )
          )
      )
    order by profile_row.id
    limit 1
  ) unrelated_user on true
  where membership.status = 'ACTIVE'::public.membership_status_enum
    and membership.membership_type = 'PRIMARY'::public.membership_type_enum
    and (
      select count(*)
      from public.team_memberships primary_membership
      where primary_membership.user_id = membership.user_id
        and primary_membership.status = 'ACTIVE'::public.membership_status_enum
        and primary_membership.membership_type = 'PRIMARY'::public.membership_type_enum
    ) = 1
    and not exists (
      select 1
      from public.primary_change_requests request_row
      where request_row.user_id = membership.user_id
        and request_row.status in ('PENDING', 'ADMIN_APPROVED')
    )
  order by membership.user_id
  limit 1;

  if v_candidate is not null then
    perform set_config('b1c.candidate', v_candidate::text, true);
  end if;
end;
$b1c_select_candidate$;

do $b1c_candidate$
begin
  if current_setting('b1c.candidate', true) is null then
    raise exception 'No safe B1c runtime candidate exists.';
  end if;
end;
$b1c_candidate$;

-- Production currently has no scoped Club Admin role row. Add one only inside
-- this transaction so the exact scoped-manager path can still be exercised.
insert into public.user_roles (user_id, role, club_id)
values (
  (current_setting('b1c.candidate')::jsonb->>'club_admin_id')::uuid,
  'CLUB_ADMIN'::public.user_role_enum,
  (current_setting('b1c.candidate')::jsonb->>'club_id')::uuid
);

do $b1c_config$
begin
  perform set_config(
    'request.jwt.claim.sub',
    current_setting('b1c.candidate')::jsonb->>'requester_id',
    true
  );
end;
$b1c_config$;
set local role authenticated;

do $b1c_config$
begin
  perform set_config(
    'b1c.request_id',
    public.request_primary_team_change(
      (current_setting('b1c.candidate')::jsonb->>'to_team_id')::uuid
    )->>'request_id',
    true
  );
end;
$b1c_config$;

do $b1c_requester_read$
declare
  v_count integer;
begin
  select count(*)
  into v_count
  from public.primary_change_requests request_row
  where request_row.id = current_setting('b1c.request_id')::uuid;
  if v_count <> 1 then
    raise exception 'The requester could not read their own request.';
  end if;

  begin
    insert into public.primary_change_requests (user_id, to_team_id, status)
    values (
      (current_setting('b1c.candidate')::jsonb->>'requester_id')::uuid,
      (current_setting('b1c.candidate')::jsonb->>'to_team_id')::uuid,
      'PENDING'
    );
    raise exception 'Direct authenticated request insert succeeded.';
  exception
    when insufficient_privilege then null;
  end;
end;
$b1c_requester_read$;

reset role;
do $b1c_config$
begin
  perform set_config(
    'request.jwt.claim.sub',
    current_setting('b1c.candidate')::jsonb->>'unrelated_user_id',
    true
  );
end;
$b1c_config$;
set local role authenticated;

do $b1c_unrelated$
declare
  v_count integer;
begin
  select count(*)
  into v_count
  from public.primary_change_requests request_row
  where request_row.id = current_setting('b1c.request_id')::uuid;
  if v_count <> 0 then
    raise exception 'An unrelated user could read the request.';
  end if;

  begin
    perform public.approve_primary_team_change(
      current_setting('b1c.request_id')::uuid
    );
    raise exception 'An unrelated user approved the request.';
  exception
    when others then
      if sqlerrm <> 'The primary team change request was not found.' then
        raise;
      end if;
  end;

  begin
    perform public.confirm_primary_team_change(
      current_setting('b1c.request_id')::uuid
    );
    raise exception 'An unrelated user confirmed the request.';
  exception
    when others then
      if sqlerrm <> 'You can only confirm your own primary team change.' then
        raise;
      end if;
  end;

  begin
    perform public.cancel_primary_team_change(
      current_setting('b1c.request_id')::uuid
    );
    raise exception 'An unrelated user cancelled the request.';
  exception
    when others then
      if sqlerrm <> 'The primary team change request was not found.' then
        raise;
      end if;
  end;

  begin
    perform public.decline_primary_team_change(
      current_setting('b1c.request_id')::uuid
    );
    raise exception 'An unrelated user declined the request.';
  exception
    when others then
      if sqlerrm <> 'The primary team change request was not found.' then
        raise;
      end if;
  end;
end;
$b1c_unrelated$;

reset role;
do $b1c_config$
begin
  perform set_config(
    'request.jwt.claim.sub',
    current_setting('b1c.candidate')::jsonb->>'club_admin_id',
    true
  );
end;
$b1c_config$;
set local role authenticated;

do $b1c_club_admin$
declare
  v_count integer;
  v_result jsonb;
begin
  select count(*)
  into v_count
  from public.primary_change_requests request_row
  where request_row.id = current_setting('b1c.request_id')::uuid;
  if v_count <> 1 then
    raise exception 'The scoped Club Admin could not read the request.';
  end if;

  v_result := public.approve_primary_team_change(
    current_setting('b1c.request_id')::uuid
  );
  if v_result->>'status' <> 'ADMIN_APPROVED' then
    raise exception 'The scoped approval returned an unexpected status.';
  end if;
end;
$b1c_club_admin$;

reset role;
do $b1c_config$
begin
  perform set_config(
    'request.jwt.claim.sub',
    current_setting('b1c.candidate')::jsonb->>'requester_id',
    true
  );
end;
$b1c_config$;
set local role authenticated;

do $b1c_confirm$
declare
  v_result jsonb;
  v_count integer;
begin
  v_result := public.confirm_primary_team_change(
    current_setting('b1c.request_id')::uuid
  );
  if v_result->>'status' <> 'COMPLETED' then
    raise exception 'The confirmation returned an unexpected status.';
  end if;

  select count(*)
  into v_count
  from public.team_memberships membership
  where membership.user_id = (current_setting('b1c.candidate')::jsonb->>'requester_id')::uuid
    and membership.team_id = (current_setting('b1c.candidate')::jsonb->>'to_team_id')::uuid
    and membership.status = 'ACTIVE'::public.membership_status_enum
    and membership.membership_type = 'PRIMARY'::public.membership_type_enum;
  if v_count <> 1 then
    raise exception 'Confirmation did not create exactly one active target Primary membership.';
  end if;
end;
$b1c_confirm$;

-- A terminal request must remain indistinguishable from an unknown request to
-- an unrelated signed-in caller.
reset role;
do $b1c_config$
begin
  perform set_config(
    'request.jwt.claim.sub',
    current_setting('b1c.candidate')::jsonb->>'unrelated_user_id',
    true
  );
end;
$b1c_config$;
set local role authenticated;
do $b1c_terminal_masking$
begin
  begin
    perform public.approve_primary_team_change(
      current_setting('b1c.request_id')::uuid
    );
    raise exception 'An unrelated user learned the terminal request state through approval.';
  exception
    when others then
      if sqlerrm <> 'The primary team change request was not found.' then
        raise;
      end if;
  end;

  begin
    perform public.decline_primary_team_change(
      current_setting('b1c.request_id')::uuid
    );
    raise exception 'An unrelated user learned the terminal request state through decline.';
  exception
    when others then
      if sqlerrm <> 'The primary team change request was not found.' then
        raise;
      end if;
  end;
end;
$b1c_terminal_masking$;

-- Exercise decline after the successful transition.
reset role;
do $b1c_config$
begin
  perform set_config(
    'request.jwt.claim.sub',
    current_setting('b1c.candidate')::jsonb->>'requester_id',
    true
  );
end;
$b1c_config$;
set local role authenticated;
do $b1c_config$
begin
  perform set_config(
    'b1c.request_id',
    public.request_primary_team_change(
      (current_setting('b1c.candidate')::jsonb->>'from_team_id')::uuid
    )->>'request_id',
    true
  );
end;
$b1c_config$;
reset role;
do $b1c_config$
begin
  perform set_config(
    'request.jwt.claim.sub',
    current_setting('b1c.candidate')::jsonb->>'club_admin_id',
    true
  );
end;
$b1c_config$;
set local role authenticated;
do $b1c_decline$
begin
  if public.decline_primary_team_change(
    current_setting('b1c.request_id')::uuid
  )->>'status' <> 'DECLINED' then
    raise exception 'The scoped decline returned an unexpected status.';
  end if;
end;
$b1c_decline$;

-- Exercise self-cancellation after the decline released the in-progress lock.
reset role;
do $b1c_config$
begin
  perform set_config(
    'request.jwt.claim.sub',
    current_setting('b1c.candidate')::jsonb->>'requester_id',
    true
  );
end;
$b1c_config$;
set local role authenticated;
do $b1c_config$
begin
  perform set_config(
    'b1c.request_id',
    public.request_primary_team_change(
      (current_setting('b1c.candidate')::jsonb->>'from_team_id')::uuid
    )->>'request_id',
    true
  );
end;
$b1c_config$;
do $b1c_cancel$
begin
  if public.cancel_primary_team_change(
    current_setting('b1c.request_id')::uuid
  )->>'status' <> 'CANCELLED' then
    raise exception 'The self-cancellation returned an unexpected status.';
  end if;
end;
$b1c_cancel$;

reset role;
rollback;

select 'B1_MEMBERSHIP_RUNTIME_OK';
