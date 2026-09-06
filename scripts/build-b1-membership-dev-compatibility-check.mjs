#!/usr/bin/env node

/**
 * Builds a pure-SQL, rollback-only check around the exact B1c migration so it
 * can run through the hosted Supabase Management API without psql commands.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const [outputPath] = process.argv.slice(2);
if (!outputPath) {
  throw new Error(
    "Usage: node scripts/build-b1-membership-dev-compatibility-check.mjs <output.sql>",
  );
}

const root = resolve(import.meta.dirname, "..");
const migration = readFileSync(
  resolve(
    root,
    "supabase/migrations/20260906095820_b1_membership_workflow_compatibility.sql",
  ),
  "utf8",
);

const wrapper = `begin;
create temporary table b1c_before_counts as
select
  (select count(*) from public.profiles) as profiles,
  (select count(*) from public.team_memberships) as team_memberships,
  (select count(*) from public.primary_change_requests) as primary_change_requests;

${migration}

do $b1c_dev_compatibility$
declare
  v_before b1c_before_counts%rowtype;
  v_count integer;
begin
  select * into v_before from b1c_before_counts;

  if v_before.profiles <> (select count(*) from public.profiles)
    or v_before.team_memberships <> (select count(*) from public.team_memberships)
    or v_before.primary_change_requests <> (select count(*) from public.primary_change_requests)
  then
    raise exception 'B1c changed protected Dev row counts.';
  end if;

  select count(*)
  into v_count
  from pg_catalog.pg_proc procedure_row
  join pg_catalog.pg_namespace namespace_row
    on namespace_row.oid = procedure_row.pronamespace
  where namespace_row.nspname = 'public'
    and procedure_row.proname in (
      'approve_primary_team_change',
      'can_review_primary_team_change',
      'cancel_primary_team_change',
      'confirm_primary_team_change',
      'decline_primary_team_change',
      'request_primary_team_change'
    )
    and procedure_row.prosecdef
    and coalesce(procedure_row.proconfig, array[]::text[]) @> array['search_path=""']
    and pg_catalog.has_function_privilege('authenticated', procedure_row.oid, 'EXECUTE')
    and pg_catalog.has_function_privilege('service_role', procedure_row.oid, 'EXECUTE')
    and not pg_catalog.has_function_privilege('anon', procedure_row.oid, 'EXECUTE');
  if v_count <> 6 then
    raise exception 'Only % of 6 B1c functions meet the Dev security contract.', v_count;
  end if;

  select count(*)
  into v_count
  from pg_catalog.pg_policies policy_row
  where policy_row.schemaname = 'public'
    and policy_row.tablename = 'primary_change_requests';
  if v_count <> 2 then
    raise exception 'Expected two Dev request policies after B1c, found %.', v_count;
  end if;

  if not pg_catalog.has_table_privilege(
    'authenticated', 'public.primary_change_requests', 'SELECT'
  ) or pg_catalog.has_table_privilege(
    'authenticated',
    'public.primary_change_requests',
    'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'
  ) or pg_catalog.has_table_privilege(
    'anon',
    'public.primary_change_requests',
    'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'
  ) then
    raise exception 'B1c request-table privileges do not match the Dev contract.';
  end if;

  select count(*)
  into v_count
  from public.primary_change_requests request_row
  where request_row.status not in (
    'PENDING',
    'ADMIN_APPROVED',
    'COMPLETED',
    'APPROVED',
    'DECLINED',
    'CANCELLED'
  );
  if v_count <> 0 then
    raise exception 'Dev contains % request rows outside the B1c lifecycle.', v_count;
  end if;
end;
$b1c_dev_compatibility$;

select 'B1_MEMBERSHIP_DEV_COMPATIBILITY_OK' as result;
rollback;
`;

writeFileSync(outputPath, wrapper, "utf8");
console.log("B1_MEMBERSHIP_DEV_COMPATIBILITY_CHECK_BUILT");
