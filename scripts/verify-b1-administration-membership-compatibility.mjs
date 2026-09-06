#!/usr/bin/env node

/**
 * Static safety check for the B1e administration and membership bridge.
 * Runtime role, transaction and rollback checks are performed separately.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const migrationPath = resolve(
  root,
  "supabase/migrations/20260906114318_b1_administration_membership_compatibility.sql",
);
const migration = readFileSync(migrationPath, "utf8");
const hardeningPath = resolve(
  root,
  "supabase/migrations/20260906123500_b1_administration_session_binding_hardening.sql",
);
const hardening = readFileSync(hardeningPath, "utf8");
const lower = migration.toLowerCase().replaceAll("\r\n", "\n");
const hardeningLower = hardening.toLowerCase().replaceAll("\r\n", "\n");
const executable = lower.replace(/^\s*--.*$/gm, "");
const failures = [];

const expectedFunctions = [
  "admin_cancel_team_invite",
  "admin_create_team_invite",
  "admin_manage_team_membership",
  "admin_membership_integrity_report",
  "admin_save_user_roles",
  "admin_save_user_roles",
  "admin_save_user_roles_unchecked",
  "admin_update_profile_details",
  "admin_visible_profile_ids",
  "administration_target_profile_in_scope",
  "approve_membership_request",
  "guard_team_membership_integrity",
  "guard_user_role_duplicate_insert",
].sort();

const definitions = [
  ...migration.matchAll(
    /create or replace function\s+public\.([a-z0-9_]+)\([^]*?\n(?:\$function\$|\$\$);/gi,
  ),
];
const actualFunctions = definitions.map((match) => match[1].toLowerCase()).sort();
if (JSON.stringify(actualFunctions) !== JSON.stringify(expectedFunctions)) {
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
}

for (const required of [
  "drop function if exists public.admin_save_user_roles(\n  uuid, text[], jsonb, jsonb, uuid[], jsonb, text\n)",
  "drop constraint if exists requests_membership_type_check",
  "check (membership_type in ('primary', 'secondary', 'fill_in'))",
  "create trigger team_membership_integrity_guard",
  "create trigger user_role_duplicate_insert_guard",
  "revoke all on function public.admin_membership_integrity_report()",
  "revoke all on function public.administration_target_profile_in_scope(uuid, text)",
  "revoke all on function public.admin_save_user_roles_unchecked",
  "grant execute on function public.admin_membership_integrity_report() to service_role",
  "grant execute on function public.admin_visible_profile_ids(text, uuid, uuid, uuid)",
  "grant execute on function public.admin_save_user_roles(",
  "to authenticated, service_role",
]) {
  if (!lower.includes(required)) failures.push(`missing statement: ${required}`);
}

if ((lower.match(/create trigger /g) ?? []).length !== 2) {
  failures.push("unexpected trigger count");
}

const sevenArgumentHeader = lower.match(
  /create or replace function public\.admin_save_user_roles\(\n  p_user_id uuid,[^]*?\n\)\nreturns void/g,
);
if (!sevenArgumentHeader || sevenArgumentHeader.length !== 2) {
  failures.push("expected safe six- and seven-argument role functions");
} else {
  const sevenArgument = sevenArgumentHeader.find((header) =>
    header.includes("p_actor_mode text"),
  );
  if (!sevenArgument || sevenArgument.includes(" default ")) {
    failures.push("seven-argument role function must not have defaults");
  }
}

for (const forbidden of [
  "admin_save_user_access",
  "admin_list_coordination_responsibilities",
  "provision_dev_test_account",
  "edge function",
  "drop table",
  "truncate table",
  "alter type",
  "auth.users",
]) {
  if (executable.includes(forbidden)) {
    failures.push(`out-of-scope statement found: ${forbidden}`);
  }
}

const droppedFunctions = [
  ...executable.matchAll(/drop function if exists\s+([^;]+);/g),
].map((match) => match[1].replace(/\s+/g, " ").trim());
if (
  droppedFunctions.length !== 1 ||
  droppedFunctions[0] !==
    "public.admin_save_user_roles( uuid, text[], jsonb, jsonb, uuid[], jsonb, text )"
) {
  failures.push("unexpected function replacement boundary");
}
if (executable.includes(" cascade")) {
  failures.push("CASCADE is forbidden in the B1e compatibility migration");
}

for (const required of [
  "admin_visible_profile_ids_unbound(text,uuid,uuid,uuid)",
  "administration_target_profile_in_scope_unbound(uuid,text)",
  "admin_update_profile_details_unbound(uuid,jsonb,text)",
  "approve_membership_request_unbound(uuid,boolean)",
  "private.active_permission_mode_for_current_session() is distinct from v_mode",
  "or not public.administration_scope_allows(",
]) {
  if (!hardeningLower.includes(required)) {
    failures.push(`missing session-binding hardening: ${required}`);
  }
}

for (const internalFunction of [
  "public.admin_visible_profile_ids_unbound(text, uuid, uuid, uuid)",
  "public.administration_target_profile_in_scope_unbound(uuid, text)",
  "public.admin_update_profile_details_unbound(uuid, jsonb, text)",
  "public.approve_membership_request_unbound(uuid, boolean)",
]) {
  const revoke = `revoke all on function ${internalFunction}`;
  const position = hardeningLower.indexOf(revoke);
  const statementEnd = hardeningLower.indexOf(";", position);
  const statement = hardeningLower.slice(position, statementEnd + 1);
  if (position < 0 || !statement.includes("public, anon, authenticated")) {
    failures.push(`unbound helper remains browser-callable: ${internalFunction}`);
  }
}

if (hardeningLower.includes("svierarfcolhcfjpmwck")) {
  failures.push("session-binding hardening must not select Production");
}

const approvalDefinition = definitions.find(
  (match) => match[1].toLowerCase() === "approve_membership_request",
)?.[0].toLowerCase();
if (!approvalDefinition?.includes("'primary', 'secondary', 'fill_in'")) {
  failures.push("membership approval does not accept the complete membership type set");
}

for (const helper of [
  "public.admin_membership_integrity_report()",
  "public.administration_target_profile_in_scope(uuid, text)",
  "public.admin_save_user_roles_unchecked(\n  uuid, text[], jsonb, jsonb, uuid[], jsonb, text\n)",
]) {
  const revoke = `revoke all on function ${helper}`;
  const position = lower.lastIndexOf(revoke);
  if (position < 0) {
    failures.push(`missing final helper revoke: ${helper}`);
    continue;
  }
  const statementEnd = lower.indexOf(";", position);
  const statement = lower.slice(position, statementEnd + 1);
  if (!statement.includes("public, anon, authenticated")) {
    failures.push(`helper remains browser-callable: ${helper}`);
  }
}

if (failures.length > 0) {
  console.error("B1_ADMIN_MEMBERSHIP_COMPATIBILITY_FAILED");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("B1_ADMIN_MEMBERSHIP_COMPATIBILITY_OK");
console.log("B1_ADMIN_MEMBERSHIP_SECURITY_OK");
console.log("Functions checked: 13 plus 4 session-bound wrappers; triggers checked: 2");
