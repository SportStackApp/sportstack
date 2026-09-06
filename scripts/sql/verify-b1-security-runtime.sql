\set ON_ERROR_STOP on

do $b1b_static$
declare
  v_function_names text[] := array[
    'private.active_permission_mode_for_current_session',
    'private.current_session_scope_allows',
    'private.module_allowed_for_current_session',
    'private.permission_context_canonical_scope',
    'public.administration_effective_mode',
    'public.administration_scope_allows',
    'public.can_manage_module_scope',
    'public.clear_module_feature_flag',
    'public.enforce_permission_assignment_scope',
    'public.enforce_permission_set_owner_scope',
    'public.get_active_permission_mode',
    'public.has_effective_permission',
    'public.is_super_admin',
    'public.list_permission_management_records_for_mode',
    'public.permission_mode_scope_allows',
    'public.permission_save_assignment_unchecked',
    'public.permission_save_group_unchecked',
    'public.permission_save_override_unchecked',
    'public.permission_save_set_unchecked',
    'public.permission_scope_contains',
    'public.permission_scope_details',
    'public.permission_subject_manageable',
    'public.permission_subject_matches',
    'public.permission_subject_matches_for_mode',
    'public.permission_user_in_scope',
    'public.permission_visible_profiles',
    'public.permission_visible_profiles_for_mode',
    'public.resolve_effective_permission',
    'public.resolve_effective_permission_for_mode',
    'public.resolve_effective_permission_for_mode_unchecked',
    'public.resolve_module_enabled',
    'public.save_permission_assignment',
    'public.save_permission_group',
    'public.save_permission_override',
    'public.save_permission_set',
    'public.set_active_permission_context',
    'public.set_active_permission_mode',
    'public.set_module_feature_flag'
  ];
  v_b1_tables text[] := array[
    'public.module_feature_flags',
    'public.administration_audit_log',
    'public.administration_integrity_snapshot_batches',
    'public.administration_membership_integrity_snapshot',
    'public.permission_catalogue',
    'public.permission_groups',
    'public.permission_group_members',
    'public.permission_sets',
    'public.permission_set_permissions',
    'public.permission_assignments',
    'public.permission_overrides',
    'private.auth_session_permission_modes'
  ];
  v_count integer;
begin
  select count(*)
  into v_count
  from pg_catalog.pg_proc procedure_row
  join pg_catalog.pg_namespace namespace_row
    on namespace_row.oid = procedure_row.pronamespace
  where namespace_row.nspname || '.' || procedure_row.proname = any(v_function_names);
  if v_count <> 38 then
    raise exception 'Expected 38 B1b functions, found %.', v_count;
  end if;

  select count(*)
  into v_count
  from pg_catalog.pg_proc procedure_row
  join pg_catalog.pg_namespace namespace_row
    on namespace_row.oid = procedure_row.pronamespace
  where namespace_row.nspname || '.' || procedure_row.proname = any(v_function_names)
    and procedure_row.prosecdef
    and coalesce(procedure_row.proconfig, array[]::text[]) @> array['search_path=""'];
  if v_count <> 38 then
    raise exception 'Only % of 38 B1b functions are hardened.', v_count;
  end if;

  select count(*)
  into v_count
  from pg_catalog.pg_proc procedure_row
  join pg_catalog.pg_namespace namespace_row
    on namespace_row.oid = procedure_row.pronamespace
  where namespace_row.nspname || '.' || procedure_row.proname = any(v_function_names)
    and pg_catalog.has_function_privilege('authenticated', procedure_row.oid, 'EXECUTE');
  if v_count <> 18 then
    raise exception 'Expected 18 authenticated function grants, found %.', v_count;
  end if;

  select count(*)
  into v_count
  from pg_catalog.pg_proc procedure_row
  join pg_catalog.pg_namespace namespace_row
    on namespace_row.oid = procedure_row.pronamespace
  where namespace_row.nspname || '.' || procedure_row.proname = any(v_function_names)
    and pg_catalog.has_function_privilege('anon', procedure_row.oid, 'EXECUTE');
  if v_count <> 0 then
    raise exception 'Anonymous role can execute % B1b functions.', v_count;
  end if;

  select count(*)
  into v_count
  from pg_catalog.pg_proc procedure_row
  join pg_catalog.pg_namespace namespace_row
    on namespace_row.oid = procedure_row.pronamespace
  cross join lateral pg_catalog.aclexplode(
    coalesce(
      procedure_row.proacl,
      pg_catalog.acldefault('f', procedure_row.proowner)
    )
  ) access_row
  where namespace_row.nspname || '.' || procedure_row.proname = any(v_function_names)
    and access_row.grantee = 0
    and access_row.privilege_type = 'EXECUTE';
  if v_count <> 0 then
    raise exception 'PUBLIC can execute % B1b functions.', v_count;
  end if;

  select count(*)
  into v_count
  from unnest(v_b1_tables) table_name
  where pg_catalog.has_table_privilege('authenticated', table_name, 'SELECT');
  if v_count <> 5 then
    raise exception 'Expected five authenticated table reads, found %.', v_count;
  end if;

  select count(*)
  into v_count
  from unnest(v_b1_tables) table_name
  where pg_catalog.has_table_privilege('anon', table_name, 'SELECT')
     or pg_catalog.has_table_privilege(
       'authenticated',
       table_name,
       'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'
     );
  if v_count <> 0 then
    raise exception 'A browser role has an unintended B1b table privilege.';
  end if;

  select count(*)
  into v_count
  from pg_catalog.pg_policies policy_row
  where policy_row.schemaname = 'public'
    and policy_row.tablename = any(array[
      'module_feature_flags',
      'administration_audit_log',
      'administration_integrity_snapshot_batches',
      'administration_membership_integrity_snapshot',
      'permission_catalogue',
      'permission_groups',
      'permission_group_members',
      'permission_sets',
      'permission_set_permissions',
      'permission_assignments',
      'permission_overrides'
    ]);
  if v_count <> 11 then
    raise exception 'Expected 11 B1b policies, found %.', v_count;
  end if;

  select count(*)
  into v_count
  from pg_catalog.pg_trigger trigger_row
  join pg_catalog.pg_class table_row on table_row.oid = trigger_row.tgrelid
  join pg_catalog.pg_namespace namespace_row on namespace_row.oid = table_row.relnamespace
  where not trigger_row.tgisinternal
    and namespace_row.nspname = 'public'
    and trigger_row.tgname in (
      'permission_assignment_scope_guard',
      'permission_set_owner_scope_guard'
    );
  if v_count <> 2 then
    raise exception 'Expected two B1b integrity triggers, found %.', v_count;
  end if;

  select count(*)
  into v_count
  from public.permission_catalogue
  where permission_key = any(array[
    'module.player_mvp.access',
    'module.umpire_match_voting.access',
    'module.committee.access',
    'module.safety_risk.access',
    'module.hockey_trace.access',
    'player_mvp.submit',
    'player_mvp.view_results',
    'umpire_match_voting.submit',
    'umpire_match_voting.manage',
    'committee.chat.post',
    'committee.poll.vote',
    'safety_risk.manage'
  ]);
  if v_count <> 12 then
    raise exception 'Expected 12 core catalogue rows, found %.', v_count;
  end if;
end;
$b1b_static$;

-- Exercise one allowed and one denied browser session without retaining the
-- temporary feature flag.
begin;
select set_config(
  'b1b.super_user_id',
  (select user_id::text from public.user_roles where role::text = 'SUPER_ADMIN' limit 1),
  true
) as ignored
\gset
select set_config(
  'b1b.unrelated_user_id',
  (
    select profile_row.id::text
    from public.profiles profile_row
    where profile_row.id <> current_setting('b1b.super_user_id')::uuid
    order by profile_row.id
    limit 1
  ),
  true
) as ignored
\gset
select set_config(
  'b1b.association_id',
  (select association_row.id::text from public.associations association_row order by association_row.id limit 1),
  true
) as ignored
\gset

select set_config('request.jwt.claim.sub', current_setting('b1b.super_user_id'), true) as ignored
\gset
set local role authenticated;
do $b1b_super$
declare
  v_result jsonb;
  v_count integer;
begin
  if not public.is_super_admin() then
    raise exception 'The Production-derived Super Admin was not recognised.';
  end if;

  v_result := public.set_module_feature_flag(
    'player_mvp',
    'ASSOCIATION',
    current_setting('b1b.association_id')::uuid,
    true,
    'B1b isolated rehearsal only'
  );
  if v_result->>'module_key' <> 'player_mvp' then
    raise exception 'The authorised feature-flag write returned an invalid result.';
  end if;

  select count(*)
  into v_count
  from public.module_feature_flags
  where scope_type = 'ASSOCIATION'
    and scope_id = current_setting('b1b.association_id')::uuid;
  if v_count <> 1 then
    raise exception 'The authorised scope could not read its feature flag.';
  end if;
end;
$b1b_super$;

reset role;
select set_config('request.jwt.claim.sub', current_setting('b1b.unrelated_user_id'), true) as ignored
\gset
set local role authenticated;
do $b1b_unrelated$
declare
  v_count integer;
begin
  if public.is_super_admin() then
    raise exception 'An unrelated user was recognised as Super Admin.';
  end if;

  if public.can_manage_module_scope(
    current_setting('b1b.super_user_id')::uuid,
    'ASSOCIATION',
    current_setting('b1b.association_id')::uuid
  ) then
    raise exception 'An unrelated user could probe another administrator scope.';
  end if;

  select count(*)
  into v_count
  from public.module_feature_flags
  where scope_type = 'ASSOCIATION'
    and scope_id = current_setting('b1b.association_id')::uuid;
  if v_count <> 0 then
    raise exception 'An unrelated user could read the scoped feature flag.';
  end if;

  select count(*) into v_count from public.permission_catalogue;
  if v_count < 12 then
    raise exception 'The authenticated permission catalogue is unavailable.';
  end if;

  begin
    perform public.set_module_feature_flag(
      'player_mvp',
      'ASSOCIATION',
      current_setting('b1b.association_id')::uuid,
      false,
      'This write must be denied'
    );
    raise exception 'An unrelated user changed a feature flag.';
  exception
    when others then
      if sqlerrm <> 'You do not have permission to manage modules at this scope.' then
        raise;
      end if;
  end;
end;
$b1b_unrelated$;
reset role;
rollback;

select 'B1_SECURITY_RUNTIME_OK';
