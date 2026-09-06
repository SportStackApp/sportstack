#!/usr/bin/env node

/**
 * Builds a rollback-only Dev check around the exact B1b migration. The wrapper
 * fingerprints B1 data, functions, policies, triggers and privileges before
 * and during the migration, permits only the intended caller-binding
 * hardening, fails on any other logical change, then rolls back.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const [outputPath] = process.argv.slice(2);
if (!outputPath) {
  throw new Error(
    "Usage: node scripts/build-b1-security-dev-noop-check.mjs <output.sql>",
  );
}

const root = resolve(import.meta.dirname, "..");
const migration = readFileSync(
  resolve(root, "supabase/migrations/20260906075102_b1_security_compatibility.sql"),
  "utf8",
);

const fingerprintFunction = String.raw`
create or replace function pg_temp.b1b_security_fingerprint()
returns jsonb
language sql
stable
set search_path = ''
as $fingerprint$
  with target_functions as (
    select
      namespace_row.nspname as schema_name,
      procedure_row.proname as function_name,
      pg_catalog.pg_get_function_identity_arguments(procedure_row.oid) as arguments,
      case
        when namespace_row.nspname = 'public'
          and procedure_row.proname = 'can_manage_module_scope'
          then null
        else pg_catalog.pg_get_functiondef(procedure_row.oid)
      end as definition,
      procedure_row.proconfig,
      pg_catalog.has_function_privilege('authenticated', procedure_row.oid, 'EXECUTE') as authenticated_execute,
      pg_catalog.has_function_privilege('anon', procedure_row.oid, 'EXECUTE') as anon_execute,
      pg_catalog.has_function_privilege('service_role', procedure_row.oid, 'EXECUTE') as service_execute,
      exists (
        select 1
        from pg_catalog.aclexplode(
          coalesce(
            procedure_row.proacl,
            pg_catalog.acldefault('f', procedure_row.proowner)
          )
        ) access_row
        where access_row.grantee = 0
          and access_row.privilege_type = 'EXECUTE'
      ) as public_execute
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
    ])
  ), target_policies as (
    select to_jsonb(policy_row) as value
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
      ])
  ), target_triggers as (
    select
      trigger_row.tgname as trigger_name,
      pg_catalog.pg_get_triggerdef(trigger_row.oid, true) as definition
    from pg_catalog.pg_trigger trigger_row
    where not trigger_row.tgisinternal
      and trigger_row.tgname in (
        'permission_assignment_scope_guard',
        'permission_set_owner_scope_guard'
      )
  ), target_table_privileges as (
    select to_jsonb(privilege_row) as value
    from information_schema.role_table_grants privilege_row
    where privilege_row.table_schema in ('public', 'private')
      and privilege_row.table_name = any(array[
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
        'permission_overrides',
        'auth_session_permission_modes'
      ])
  )
  select jsonb_build_object(
    'functions', (select jsonb_agg(to_jsonb(target_functions) order by schema_name, function_name, arguments) from target_functions),
    'policies', (select jsonb_agg(value order by value::text) from target_policies),
    'triggers', (select jsonb_agg(to_jsonb(target_triggers) order by trigger_name) from target_triggers),
    'table_privileges', (select jsonb_agg(value order by value::text) from target_table_privileges),
    'catalogue', (select jsonb_agg(to_jsonb(row_value) order by permission_key) from public.permission_catalogue row_value),
    'module_flags', (select jsonb_agg(to_jsonb(row_value) order by id) from public.module_feature_flags row_value),
    'audit_log', (select jsonb_agg(to_jsonb(row_value) order by id) from public.administration_audit_log row_value),
    'integrity_batches', (select jsonb_agg(to_jsonb(row_value) order by id) from public.administration_integrity_snapshot_batches row_value),
    'integrity_snapshot', (select jsonb_agg(to_jsonb(row_value) order by id) from public.administration_membership_integrity_snapshot row_value),
    'groups', (select jsonb_agg(to_jsonb(row_value) order by id) from public.permission_groups row_value),
    'group_members', (select jsonb_agg(to_jsonb(row_value) order by group_id, user_id) from public.permission_group_members row_value),
    'sets', (select jsonb_agg(to_jsonb(row_value) order by id) from public.permission_sets row_value),
    'set_permissions', (select jsonb_agg(to_jsonb(row_value) order by permission_set_id, permission_key) from public.permission_set_permissions row_value),
    'assignments', (select jsonb_agg(to_jsonb(row_value) order by id) from public.permission_assignments row_value),
    'overrides', (select jsonb_agg(to_jsonb(row_value) order by id) from public.permission_overrides row_value),
    'session_modes', (select jsonb_agg(to_jsonb(row_value) order by session_id, user_id) from private.auth_session_permission_modes row_value)
  );
$fingerprint$;
`;

const wrapper = `begin;
${fingerprintFunction}
create temporary table b1b_before_fingerprint as
select pg_temp.b1b_security_fingerprint() as value;

${migration}

do $b1b_noop$
declare
  v_changed_keys text;
  v_changed_functions text;
  v_changed_table_privileges text;
  v_after jsonb := pg_temp.b1b_security_fingerprint();
begin
  if not exists (
    select 1
    from pg_catalog.pg_proc procedure_row
    join pg_catalog.pg_namespace namespace_row
      on namespace_row.oid = procedure_row.pronamespace
    where namespace_row.nspname = 'public'
      and procedure_row.proname = 'can_manage_module_scope'
      and pg_catalog.pg_get_function_identity_arguments(procedure_row.oid) =
        'p_user_id uuid, p_scope_type text, p_scope_id uuid'
      and pg_catalog.pg_get_functiondef(procedure_row.oid)
        like '%p_user_id = auth.uid()%'
      and pg_catalog.pg_get_functiondef(procedure_row.oid)
        like '%auth.role() = ''service_role''%'
  ) then
    raise exception 'B1b did not bind can_manage_module_scope to the caller.';
  end if;

  select string_agg(before_entry.key, ', ' order by before_entry.key)
  into v_changed_keys
  from b1b_before_fingerprint snapshot,
       lateral jsonb_each(snapshot.value) before_entry
  join lateral jsonb_each(v_after) after_entry
    on after_entry.key = before_entry.key
  where before_entry.value is distinct from after_entry.value;

  if v_changed_keys is not null then
    select string_agg(
      coalesce(before_row.value->>'schema_name', after_row.value->>'schema_name') || '.' ||
      coalesce(before_row.value->>'function_name', after_row.value->>'function_name') || '(' ||
      coalesce(before_row.value->>'arguments', after_row.value->>'arguments') || ')',
      ', ' order by coalesce(before_row.value::text, after_row.value::text)
    )
    into v_changed_functions
    from b1b_before_fingerprint snapshot,
         lateral jsonb_array_elements(snapshot.value->'functions') before_row
    full join lateral jsonb_array_elements(v_after->'functions') after_row
      on after_row.value->>'schema_name' = before_row.value->>'schema_name'
     and after_row.value->>'function_name' = before_row.value->>'function_name'
     and after_row.value->>'arguments' = before_row.value->>'arguments'
    where before_row.value is distinct from after_row.value;

    select string_agg(
      coalesce(before_row.value->>'grantee', after_row.value->>'grantee') || ':' ||
      coalesce(before_row.value->>'table_schema', after_row.value->>'table_schema') || '.' ||
      coalesce(before_row.value->>'table_name', after_row.value->>'table_name') || ':' ||
      coalesce(before_row.value->>'privilege_type', after_row.value->>'privilege_type'),
      ', ' order by coalesce(before_row.value::text, after_row.value::text)
    )
    into v_changed_table_privileges
    from b1b_before_fingerprint snapshot,
         lateral jsonb_array_elements(snapshot.value->'table_privileges') before_row
    full join lateral jsonb_array_elements(v_after->'table_privileges') after_row
      on after_row.value->>'grantee' = before_row.value->>'grantee'
     and after_row.value->>'table_schema' = before_row.value->>'table_schema'
     and after_row.value->>'table_name' = before_row.value->>'table_name'
     and after_row.value->>'privilege_type' = before_row.value->>'privilege_type'
    where before_row.value is distinct from after_row.value;

    raise exception 'B1b changed current Dev keys: %. Functions: %. Table privileges: %.',
      v_changed_keys,
      coalesce(v_changed_functions, 'none'),
      coalesce(v_changed_table_privileges, 'none');
  end if;
end;
$b1b_noop$;

select 'B1_SECURITY_DEV_COMPATIBILITY_OK';
rollback;
`;

writeFileSync(outputPath, wrapper, "utf8");
console.log("B1_SECURITY_DEV_NOOP_CHECK_BUILT");
