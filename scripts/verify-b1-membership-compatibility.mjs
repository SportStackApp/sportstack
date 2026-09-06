#!/usr/bin/env node

/**
 * Static safety check for the B1c primary-team change compatibility bridge.
 * Runtime allow/deny and transaction checks are performed separately.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const migrationPath = resolve(
  root,
  "supabase/migrations/20260906095820_b1_membership_workflow_compatibility.sql",
);
const migration = readFileSync(migrationPath, "utf8");
const lower = migration.toLowerCase();
const executable = lower.replace(/^\s*--.*$/gm, "");
const failures = [];

const expectedFunctions = [
  "public.approve_primary_team_change",
  "public.can_review_primary_team_change",
  "public.cancel_primary_team_change",
  "public.confirm_primary_team_change",
  "public.decline_primary_team_change",
  "public.request_primary_team_change",
];

const definitions = [
  ...migration.matchAll(
    /create or replace function\s+(public\.[a-z0-9_]+)\([^]*?\n\$function\$;/gi,
  ),
];
const actualFunctions = definitions.map((match) => match[1].toLowerCase()).sort();
if (JSON.stringify(actualFunctions) !== JSON.stringify([...expectedFunctions].sort())) {
  failures.push(
    `function allow-list mismatch: expected ${expectedFunctions.length}, found ${actualFunctions.length}`,
  );
}

for (const match of definitions) {
  const name = match[1].toLowerCase();
  const definition = match[0].toLowerCase();
  if (!definition.includes("security definer")) {
    failures.push(`${name} is not SECURITY DEFINER`);
  }
  if (!definition.includes("set search_path = ''")) {
    failures.push(`${name} does not pin an empty search_path`);
  }
  for (const table of [
    "clubs",
    "primary_change_requests",
    "team_memberships",
    "teams",
    "user_roles",
  ]) {
    const unqualified = new RegExp(
      `\\b(?:from|join|insert\\s+into|update|delete\\s+from)\\s+(?:only\\s+)?${table}\\b`,
    );
    if (unqualified.test(definition)) {
      failures.push(`${name} contains an unqualified ${table} reference`);
    }
  }
}

for (const required of [
  "primary_change_requests_valid_status",
  "drop policy if exists primary_change_requests_insert_own",
  "drop policy if exists primary_change_requests_update_own",
  "create policy primary_change_requests_read_own",
  "create policy primary_change_requests_read_scoped_admin",
  "revoke all on table public.primary_change_requests from anon",
  "revoke insert, update, delete, truncate, references, trigger",
  "grant select on table public.primary_change_requests to authenticated",
]) {
  if (!lower.includes(required)) failures.push(`missing statement: ${required}`);
}

if ((lower.match(/create policy /g) ?? []).length !== 2) {
  failures.push("unexpected policy count");
}

for (const name of expectedFunctions) {
  if (!lower.includes(`revoke all on function ${name}`)) {
    failures.push(`missing browser revoke for ${name}`);
  }
  if (!lower.includes(`grant execute on function ${name}`)) {
    failures.push(`missing authenticated/service grant for ${name}`);
  }
}

for (const forbidden of [
  "drop table",
  "truncate table",
  "delete from public.team_memberships",
  "delete from public.primary_change_requests",
  "alter type",
  "auth.users",
]) {
  if (executable.includes(forbidden)) {
    failures.push(`destructive or out-of-scope statement found: ${forbidden}`);
  }
}

const confirmDefinition = definitions.find(
  (match) => match[1].toLowerCase() === "public.confirm_primary_team_change",
)?.[0].toLowerCase();
if (
  !confirmDefinition?.includes("membership.status = 'active'") ||
  !confirmDefinition.includes("pg_advisory_xact_lock")
) {
  failures.push("confirmation does not serialise and limit demotion to active primaries");
}

if (failures.length > 0) {
  console.error("B1_MEMBERSHIP_COMPATIBILITY_FAILED");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("B1_MEMBERSHIP_COMPATIBILITY_OK");
console.log("B1_MEMBERSHIP_SECURITY_OK");
console.log("Functions checked: 6; policies checked: 2");
