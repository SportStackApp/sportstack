#!/usr/bin/env node

/**
 * Static safety check for the B1b access-control migration.
 * Runtime apply, repeat, rollback and role-denial checks are recorded by the
 * separate rehearsal verifier.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const migrationPath = resolve(
  root,
  "supabase/migrations/20260906075102_b1_security_compatibility.sql",
);
const migration = readFileSync(migrationPath, "utf8");
const lower = migration.toLowerCase();
const executable = lower.replace(/^\s*--.*$/gm, "");
const failures = [];

const expectedFunctions = [
  "private.active_permission_mode_for_current_session",
  "private.current_session_scope_allows",
  "private.module_allowed_for_current_session",
  "private.permission_context_canonical_scope",
  "public.administration_effective_mode",
  "public.administration_scope_allows",
  "public.can_manage_module_scope",
  "public.clear_module_feature_flag",
  "public.enforce_permission_assignment_scope",
  "public.enforce_permission_set_owner_scope",
  "public.get_active_permission_mode",
  "public.has_effective_permission",
  "public.is_super_admin",
  "public.list_permission_management_records_for_mode",
  "public.permission_mode_scope_allows",
  "public.permission_save_assignment_unchecked",
  "public.permission_save_group_unchecked",
  "public.permission_save_override_unchecked",
  "public.permission_save_set_unchecked",
  "public.permission_scope_contains",
  "public.permission_scope_details",
  "public.permission_subject_manageable",
  "public.permission_subject_matches",
  "public.permission_subject_matches_for_mode",
  "public.permission_user_in_scope",
  "public.permission_visible_profiles",
  "public.permission_visible_profiles_for_mode",
  "public.resolve_effective_permission",
  "public.resolve_effective_permission_for_mode",
  "public.resolve_effective_permission_for_mode_unchecked",
  "public.resolve_module_enabled",
  "public.save_permission_assignment",
  "public.save_permission_group",
  "public.save_permission_override",
  "public.save_permission_set",
  "public.set_active_permission_context",
  "public.set_active_permission_mode",
  "public.set_module_feature_flag",
];

const definitions = [
  ...migration.matchAll(
    /create or replace function\s+((?:public|private)\.[a-z0-9_]+)\([^]*?\n\$function\$;/gi,
  ),
];
const actualFunctions = definitions.map((match) => match[1].toLowerCase()).sort();
const referencedTables = [
  "administration_audit_log",
  "associations",
  "auth_session_permission_modes",
  "clubs",
  "divisions",
  "module_feature_flags",
  "permission_assignments",
  "permission_catalogue",
  "permission_group_members",
  "permission_groups",
  "permission_overrides",
  "permission_set_permissions",
  "permission_sets",
  "profiles",
  "team_divisions",
  "team_memberships",
  "teams",
  "user_roles",
];

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
  if (!definition.includes("set search_path to ''")) {
    failures.push(`${name} does not pin an empty search_path`);
  }
  for (const table of referencedTables) {
    const unqualified = new RegExp(
      `\\b(?:from|join|insert\\s+into|update|delete\\s+from)\\s+(?:only\\s+)?${table}\\b`,
    );
    if (unqualified.test(definition)) {
      failures.push(`${name} contains an unqualified ${table} reference`);
    }
  }
}

const canManageDefinition = definitions.find(
  (match) => match[1].toLowerCase() === "public.can_manage_module_scope",
)?.[0].toLowerCase();
if (
  !canManageDefinition?.includes("p_user_id = auth.uid()") ||
  !canManageDefinition.includes("auth.role() = 'service_role'")
) {
  failures.push("can_manage_module_scope is not bound to the caller");
}

for (const forbidden of [
  "incident_discipline",
  "coordination",
  "technical_bench_coordinator",
  "volunteer_coordinator",
  "system_key",
  "alter type",
  "drop table",
  "truncate ",
]) {
  if (executable.includes(forbidden)) {
    failures.push(`later or destructive feature leaked into B1b: ${forbidden.trim()}`);
  }
}

const expectedCatalogue = [
  "module.player_mvp.access",
  "module.umpire_match_voting.access",
  "module.committee.access",
  "module.safety_risk.access",
  "module.hockey_trace.access",
  "player_mvp.submit",
  "player_mvp.view_results",
  "umpire_match_voting.submit",
  "umpire_match_voting.manage",
  "committee.chat.post",
  "committee.poll.vote",
  "safety_risk.manage",
];
for (const key of expectedCatalogue) {
  if (!migration.includes(`'${key}'`)) failures.push(`missing catalogue key: ${key}`);
}

const expectedPolicies = [
  "administration_audit_read_scoped",
  "administration_integrity_batches_super_read",
  "administration_integrity_snapshot_super_read",
  "module_feature_flags_select",
  "permission_catalogue_authenticated_read",
  "permission_groups_scoped_read",
  "permission_group_members_scoped_read",
  "permission_sets_scoped_read",
  "permission_set_permissions_scoped_read",
  "permission_assignments_scoped_read",
  "permission_overrides_scoped_read",
];
for (const policy of expectedPolicies) {
  if (!lower.includes(`create policy ${policy}`)) failures.push(`missing policy: ${policy}`);
}
if ((lower.match(/create policy /g) ?? []).length !== expectedPolicies.length) {
  failures.push("unexpected policy count");
}

for (const trigger of [
  "permission_assignment_scope_guard",
  "permission_set_owner_scope_guard",
]) {
  if (!lower.includes(`create trigger ${trigger}`)) failures.push(`missing trigger: ${trigger}`);
}
if ((lower.match(/create trigger /g) ?? []).length !== 2) {
  failures.push("unexpected trigger count");
}

const authenticatedFunctions = new Set([
  "private.module_allowed_for_current_session",
  "public.administration_effective_mode",
  "public.administration_scope_allows",
  "public.can_manage_module_scope",
  "public.clear_module_feature_flag",
  "public.get_active_permission_mode",
  "public.is_super_admin",
  "public.list_permission_management_records_for_mode",
  "public.permission_visible_profiles_for_mode",
  "public.resolve_effective_permission_for_mode",
  "public.resolve_module_enabled",
  "public.save_permission_assignment",
  "public.save_permission_group",
  "public.save_permission_override",
  "public.save_permission_set",
  "public.set_active_permission_context",
  "public.set_active_permission_mode",
  "public.set_module_feature_flag",
]);

const authenticatedGrants = [
  ...lower.matchAll(/grant execute on function\s+((?:public|private)\.[a-z0-9_]+)\([^;]*?\)\s+to authenticated;/g),
].map((match) => match[1]);
if (
  JSON.stringify([...new Set(authenticatedGrants)].sort()) !==
  JSON.stringify([...authenticatedFunctions].sort())
) {
  failures.push("authenticated function grant allow-list mismatch");
}
if (/grant\s+[^;]+\s+to\s+(?:public|anon)\s*;/i.test(migration)) {
  failures.push("PUBLIC or anon receives a grant");
}

const tableGrant = migration.match(
  /grant select on table([^;]+)to authenticated;/i,
);
const expectedReadTables = [
  "public.module_feature_flags",
  "public.administration_audit_log",
  "public.administration_integrity_snapshot_batches",
  "public.administration_membership_integrity_snapshot",
  "public.permission_catalogue",
];
if (!tableGrant) {
  failures.push("missing authenticated table read allow-list");
} else {
  const granted = [...tableGrant[1].matchAll(/(?:public|private)\.[a-z0-9_]+/gi)]
    .map((match) => match[0].toLowerCase())
    .sort();
  if (JSON.stringify(granted) !== JSON.stringify([...expectedReadTables].sort())) {
    failures.push("authenticated table read allow-list mismatch");
  }
}

for (const required of [
  "alter table private.auth_session_permission_modes force row level security",
  "revoke all on sequence private.auth_session_permission_mode_revision_seq",
  "grant usage on schema private to authenticated, service_role",
]) {
  if (!lower.includes(required)) failures.push(`missing security statement: ${required}`);
}

if (failures.length > 0) {
  console.error("B1_SECURITY_COMPATIBILITY_FAILED");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("B1_SECURITY_COMPATIBILITY_OK");
console.log("B1_SECURITY_FUNCTIONS_OK");
console.log("B1_SECURITY_RLS_OK");
console.log(`Functions checked: ${expectedFunctions.length}`);
console.log(`Policies checked: ${expectedPolicies.length}`);
console.log("Authenticated tables: 5; authenticated functions: 18");
