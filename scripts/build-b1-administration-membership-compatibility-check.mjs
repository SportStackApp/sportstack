#!/usr/bin/env node

/**
 * Builds a rollback-only SQL check around the exact B1e migration. The same
 * file can verify a Production-derived rehearsal database or live Dev without
 * retaining schema or data changes.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const [outputPath] = process.argv.slice(2);
if (!outputPath) {
  throw new Error(
    "Usage: node scripts/build-b1-administration-membership-compatibility-check.mjs <output.sql>",
  );
}

const root = resolve(import.meta.dirname, "..");
const migration = readFileSync(
  resolve(
    root,
    "supabase/migrations/20260906114318_b1_administration_membership_compatibility.sql",
  ),
  "utf8",
);

const functionNames = `(
  'admin_cancel_team_invite', 'admin_create_team_invite',
  'admin_manage_team_membership', 'admin_membership_integrity_report',
  'admin_save_user_roles', 'admin_save_user_roles_unchecked',
  'admin_update_profile_details', 'admin_visible_profile_ids',
  'administration_target_profile_in_scope', 'approve_membership_request',
  'guard_team_membership_integrity', 'guard_user_role_duplicate_insert'
)`;

const wrapper = `create temporary table b1e_before_state as
select
  (select count(*) from public.profiles) as profiles,
  (select count(*) from public.team_memberships) as team_memberships,
  (select count(*) from public.primary_change_requests) as primary_change_requests,
  (
    select coalesce(jsonb_agg(to_jsonb(snapshot) order by snapshot.identity), '[]'::jsonb)
    from (
      select
        function_row.proname || '(' || pg_catalog.pg_get_function_identity_arguments(function_row.oid) || ')' as identity,
        md5(pg_catalog.pg_get_functiondef(function_row.oid)) as definition_md5,
        function_row.prosecdef as security_definer,
        function_row.proconfig as config,
        pg_catalog.has_function_privilege('anon', function_row.oid, 'EXECUTE') as anon_execute,
        pg_catalog.has_function_privilege('authenticated', function_row.oid, 'EXECUTE') as authenticated_execute,
        pg_catalog.has_function_privilege('service_role', function_row.oid, 'EXECUTE') as service_execute
      from pg_catalog.pg_proc function_row
      join pg_catalog.pg_namespace namespace_row on namespace_row.oid = function_row.pronamespace
      where namespace_row.nspname = 'public'
        and function_row.proname in ${functionNames}
    ) snapshot
  ) as functions,
  (
    select coalesce(jsonb_agg(to_jsonb(snapshot) order by snapshot.name), '[]'::jsonb)
    from (
      select trigger_row.tgname as name, pg_catalog.pg_get_triggerdef(trigger_row.oid) as definition
      from pg_catalog.pg_trigger trigger_row
      where trigger_row.tgrelid in ('public.team_memberships'::regclass, 'public.user_roles'::regclass)
        and trigger_row.tgname in ('team_membership_integrity_guard', 'user_role_duplicate_insert_guard')
        and not trigger_row.tgisinternal
    ) snapshot
  ) as triggers,
  (
    select pg_catalog.pg_get_constraintdef(constraint_row.oid)
    from pg_catalog.pg_constraint constraint_row
    where constraint_row.conrelid = 'public.requests'::regclass
      and constraint_row.conname = 'requests_membership_type_check'
  ) as request_membership_constraint;

begin;
savepoint b1e_before_migration;

${migration}

do $b1e_compatibility$
declare
  v_before b1e_before_state%rowtype;
  v_count integer;
begin
  select * into v_before from b1e_before_state;

  if v_before.profiles <> (select count(*) from public.profiles)
    or v_before.team_memberships <> (select count(*) from public.team_memberships)
    or v_before.primary_change_requests <> (select count(*) from public.primary_change_requests)
  then
    raise exception 'B1e changed protected row counts.';
  end if;

  select count(*) into v_count
  from pg_catalog.pg_proc function_row
  join pg_catalog.pg_namespace namespace_row on namespace_row.oid = function_row.pronamespace
  where namespace_row.nspname = 'public'
    and function_row.proname in ${functionNames}
    and function_row.prosecdef
    and coalesce(function_row.proconfig, array[]::text[]) @> array['search_path=""']
    and pg_catalog.has_function_privilege('service_role', function_row.oid, 'EXECUTE')
    and not pg_catalog.has_function_privilege('anon', function_row.oid, 'EXECUTE');
  if v_count <> 13 then
    raise exception 'Only % of 13 B1e functions meet the security contract.', v_count;
  end if;

  select count(*) into v_count
  from pg_catalog.pg_proc function_row
  join pg_catalog.pg_namespace namespace_row on namespace_row.oid = function_row.pronamespace
  where namespace_row.nspname = 'public'
    and function_row.proname in ${functionNames}
    and pg_catalog.has_function_privilege('authenticated', function_row.oid, 'EXECUTE');
  if v_count <> 8 then
    raise exception 'Expected eight browser-facing B1e functions, found %.', v_count;
  end if;

  select count(*) into v_count
  from pg_catalog.pg_trigger trigger_row
  where trigger_row.tgrelid in ('public.team_memberships'::regclass, 'public.user_roles'::regclass)
    and trigger_row.tgname in ('team_membership_integrity_guard', 'user_role_duplicate_insert_guard')
    and not trigger_row.tgisinternal;
  if v_count <> 2 then raise exception 'Expected two B1e integrity triggers, found %.', v_count; end if;

  if not exists (
    select 1 from pg_catalog.pg_constraint constraint_row
    where constraint_row.conrelid = 'public.requests'::regclass
      and constraint_row.conname = 'requests_membership_type_check'
      and pg_catalog.pg_get_constraintdef(constraint_row.oid) ilike '%FILL_IN%'
  ) then raise exception 'The request membership constraint does not allow fill-ins.'; end if;
end;
$b1e_compatibility$;

select 'B1_ADMIN_MEMBERSHIP_COMPATIBILITY_OK' as result;
rollback to savepoint b1e_before_migration;

do $b1e_rollback$
declare
  v_before b1e_before_state%rowtype;
  v_functions jsonb;
  v_triggers jsonb;
  v_constraint text;
begin
  select * into v_before from b1e_before_state;

  select coalesce(jsonb_agg(to_jsonb(snapshot) order by snapshot.identity), '[]'::jsonb)
  into v_functions
  from (
    select
      function_row.proname || '(' || pg_catalog.pg_get_function_identity_arguments(function_row.oid) || ')' as identity,
      md5(pg_catalog.pg_get_functiondef(function_row.oid)) as definition_md5,
      function_row.prosecdef as security_definer,
      function_row.proconfig as config,
      pg_catalog.has_function_privilege('anon', function_row.oid, 'EXECUTE') as anon_execute,
      pg_catalog.has_function_privilege('authenticated', function_row.oid, 'EXECUTE') as authenticated_execute,
      pg_catalog.has_function_privilege('service_role', function_row.oid, 'EXECUTE') as service_execute
    from pg_catalog.pg_proc function_row
    join pg_catalog.pg_namespace namespace_row on namespace_row.oid = function_row.pronamespace
    where namespace_row.nspname = 'public'
      and function_row.proname in ${functionNames}
  ) snapshot;

  select coalesce(jsonb_agg(to_jsonb(snapshot) order by snapshot.name), '[]'::jsonb)
  into v_triggers
  from (
    select trigger_row.tgname as name, pg_catalog.pg_get_triggerdef(trigger_row.oid) as definition
    from pg_catalog.pg_trigger trigger_row
    where trigger_row.tgrelid in ('public.team_memberships'::regclass, 'public.user_roles'::regclass)
      and trigger_row.tgname in ('team_membership_integrity_guard', 'user_role_duplicate_insert_guard')
      and not trigger_row.tgisinternal
  ) snapshot;

  select pg_catalog.pg_get_constraintdef(constraint_row.oid)
  into v_constraint
  from pg_catalog.pg_constraint constraint_row
  where constraint_row.conrelid = 'public.requests'::regclass
    and constraint_row.conname = 'requests_membership_type_check';

  if v_before.functions <> v_functions
    or v_before.triggers <> v_triggers
    or v_before.request_membership_constraint is distinct from v_constraint
  then
    raise exception 'B1e rollback did not restore the previous schema state.';
  end if;

  if v_before.profiles <> (select count(*) from public.profiles)
    or v_before.team_memberships <> (select count(*) from public.team_memberships)
    or v_before.primary_change_requests <> (select count(*) from public.primary_change_requests)
  then
    raise exception 'B1e rollback changed protected row counts.';
  end if;
end;
$b1e_rollback$;

select 'B1_ADMIN_MEMBERSHIP_ROLLBACK_OK' as result;
rollback;
`;

writeFileSync(outputPath, wrapper, "utf8");
console.log("B1_ADMIN_MEMBERSHIP_COMPATIBILITY_CHECK_BUILT");
