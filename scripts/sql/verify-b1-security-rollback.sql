\set ON_ERROR_STOP on

begin;
\i /tmp/b1b.sql

do $b1b_during_rollback$
declare
  v_count integer;
begin
  select count(*)
  into v_count
  from pg_catalog.pg_proc procedure_row
  join pg_catalog.pg_namespace namespace_row
    on namespace_row.oid = procedure_row.pronamespace
  where namespace_row.nspname || '.' || procedure_row.proname = any(array[
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
  ]);
  if v_count <> 38 then
    raise exception 'B1b did not create all functions inside the rollback transaction.';
  end if;

  select count(*) into v_count from public.permission_catalogue;
  if v_count <> 12 then
    raise exception 'B1b did not seed 12 catalogue rows inside the rollback transaction.';
  end if;
end;
$b1b_during_rollback$;

rollback;

do $b1b_after_rollback$
declare
  v_count integer;
  v_search_path text[];
begin
  select count(*)
  into v_count
  from pg_catalog.pg_proc procedure_row
  join pg_catalog.pg_namespace namespace_row
    on namespace_row.oid = procedure_row.pronamespace
  where namespace_row.nspname || '.' || procedure_row.proname = any(array[
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
  ]);
  if v_count <> 1 then
    raise exception 'Rollback left % B1b functions; expected only Production is_super_admin().', v_count;
  end if;

  select procedure_row.proconfig
  into v_search_path
  from pg_catalog.pg_proc procedure_row
  join pg_catalog.pg_namespace namespace_row
    on namespace_row.oid = procedure_row.pronamespace
  where namespace_row.nspname = 'public'
    and procedure_row.proname = 'is_super_admin';
  if v_search_path is not null then
    raise exception 'Rollback did not restore Production is_super_admin() settings.';
  end if;

  select count(*) into v_count from public.permission_catalogue;
  if v_count <> 0 then
    raise exception 'Rollback left % catalogue rows.', v_count;
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
  if v_count <> 0 then
    raise exception 'Rollback left % B1b policies.', v_count;
  end if;

  select count(*)
  into v_count
  from pg_catalog.pg_trigger trigger_row
  where not trigger_row.tgisinternal
    and trigger_row.tgname in (
      'permission_assignment_scope_guard',
      'permission_set_owner_scope_guard'
    );
  if v_count <> 0 then
    raise exception 'Rollback left % B1b triggers.', v_count;
  end if;
end;
$b1b_after_rollback$;

select 'B1_SECURITY_ROLLBACK_OK';
