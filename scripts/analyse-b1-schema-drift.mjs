#!/usr/bin/env node

/**
 * Compare the final Dev and Production structures used by the proposed B1
 * foundation/access package. This is an offline evidence tool: it reads the
 * schema inventories produced by audit-b1-supabase-environments.ps1.
 */

import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, "..");
const arguments_ = process.argv.slice(2);
const evidenceDirectory = resolve(
  repositoryRoot,
  arguments_[0] ?? "outputs/b1-environment-audit-2026-09-06-detail",
);
const csvPath = resolve(
  repositoryRoot,
  arguments_[1] ?? "docs/production-readiness/B1-SCHEMA-DRIFT-MAP-2026-09-06.csv",
);
const jsonPath = resolve(evidenceDirectory, arguments_[2] ?? "b1-schema-drift.json");

// These tables are created or materially controlled by the B1 migrations.
const ownedTables = new Set([
  "auth_session_permission_modes",
  "administration_audit_log",
  "administration_integrity_snapshot_batches",
  "administration_membership_integrity_snapshot",
  "module_feature_flags",
  "permission_assignments",
  "permission_catalogue",
  "permission_group_members",
  "permission_groups",
  "permission_overrides",
  "permission_set_permissions",
  "permission_sets",
  "primary_change_requests",
]);

// B1 functions also depend on these existing Production tables. Differences in
// them are reported, but the B1 bridge must not replace them automatically.
const dependencyTables = new Set([
  "associations",
  "clubs",
  "divisions",
  "profiles",
  "requests",
  "team_memberships",
  "teams",
  "user_roles",
]);

const ownedFunctions = new Set([
  "active_permission_mode_for_current_session",
  "admin_cancel_team_invite",
  "admin_create_team_invite",
  "admin_manage_team_membership",
  "admin_membership_integrity_report",
  "admin_merge_profiles",
  "admin_save_user_roles",
  "admin_save_user_roles_unchecked",
  "admin_update_profile_details",
  "admin_visible_profile_ids",
  "administration_effective_mode",
  "administration_scope_allows",
  "administration_target_profile_in_scope",
  "approve_membership_request",
  "approve_primary_team_change",
  "can_manage_module_scope",
  "can_review_primary_team_change",
  "cancel_primary_team_change",
  "clear_module_feature_flag",
  "confirm_primary_team_change",
  "current_session_scope_allows",
  "decline_primary_team_change",
  "enforce_permission_assignment_scope",
  "enforce_permission_set_owner_scope",
  "get_active_permission_mode",
  "guard_team_membership_integrity",
  "guard_user_role_duplicate_insert",
  "has_effective_permission",
  "is_super_admin",
  "list_permission_management_records_for_mode",
  "module_allowed_for_current_session",
  "permission_context_canonical_scope",
  "permission_mode_scope_allows",
  "permission_save_assignment_unchecked",
  "permission_save_group_unchecked",
  "permission_save_override_unchecked",
  "permission_save_set_unchecked",
  "permission_scope_contains",
  "permission_scope_details",
  "permission_subject_manageable",
  "permission_subject_matches",
  "permission_subject_matches_for_mode",
  "permission_user_in_scope",
  "permission_visible_profiles",
  "permission_visible_profiles_for_mode",
  "request_primary_team_change",
  "resolve_effective_permission",
  "resolve_effective_permission_for_mode",
  "resolve_effective_permission_for_mode_unchecked",
  "resolve_module_enabled",
  "save_permission_assignment",
  "save_permission_group",
  "save_permission_override",
  "save_permission_set",
  "set_active_permission_context",
  "set_active_permission_mode",
  "set_module_feature_flag",
]);

const ownedSequences = new Set(["auth_session_permission_mode_revision_seq"]);

function loadInventory(path) {
  let text = readFileSync(path, "utf8");
  // Supabase CLI may print a harmless login-role message before its JSON.
  const arrayStart = text.indexOf("[");
  const objectStart = text.indexOf("{");
  const start = arrayStart >= 0 && (objectStart < 0 || arrayStart < objectStart)
    ? arrayStart
    : objectStart;
  const parsed = JSON.parse(text.slice(start));
  return Array.isArray(parsed) ? parsed : parsed.rows[0].inventory;
}

function key(row) {
  return `${row.object_type}|${row.schema_name}|${row.object_name}`;
}

function objectBaseName(row) {
  if (row.object_type === "function") return row.object_name.split("(")[0];
  if (row.object_type === "routine_grant") return row.definition.routine;
  if (["constraint", "policy", "trigger", "table_grant"].includes(row.object_type)) {
    return row.definition.table ?? row.object_name.split(".")[0];
  }
  if (row.object_type === "index") {
    const match = String(row.definition).match(/\sON\s+(?:ONLY\s+)?(?:"?[\w]+"?\.)?"?([\w]+)"?\s/i);
    return match?.[1] ?? row.object_name;
  }
  return row.object_name;
}

function scopeRole(row) {
  const baseName = objectBaseName(row);
  if (ownedFunctions.has(baseName)) return "B1_FUNCTION";
  if (ownedSequences.has(baseName)) return "B1_SEQUENCE";
  if (ownedTables.has(baseName)) return "B1_OWNED_TABLE";
  if (dependencyTables.has(baseName)) return "DEPENDENCY_TABLE";
  return null;
}

function canonicalise(value) {
  if (Array.isArray(value)) return value.map(canonicalise);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value).sort().map((keyName) => [keyName, canonicalise(value[keyName])]),
    );
  }
  return value;
}

function stableDefinition(definition) {
  return JSON.stringify(canonicalise(definition));
}

function digest(definition) {
  return createHash("sha256").update(stableDefinition(definition)).digest("hex").slice(0, 12);
}

function csv(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

const devRows = loadInventory(resolve(evidenceDirectory, "dev/structural-inventory.json"));
const productionRows = loadInventory(resolve(evidenceDirectory, "production/structural-inventory.json"));
const devMap = new Map(devRows.map((row) => [key(row), row]));
const productionMap = new Map(productionRows.map((row) => [key(row), row]));
const allKeys = new Set([...devMap.keys(), ...productionMap.keys()]);
const rows = [];

for (const rowKey of allKeys) {
  const dev = devMap.get(rowKey);
  const production = productionMap.get(rowKey);
  const representative = dev ?? production;
  const role = scopeRole(representative);
  if (!role) continue;

  const status = !production
    ? "DEV_ONLY"
    : !dev
      ? "PRODUCTION_ONLY"
      : stableDefinition(dev.definition) === stableDefinition(production.definition)
        ? "MATCH"
        : "DIFFERENT";
  rows.push({
    scope_role: role,
    object_type: representative.object_type,
    schema_name: representative.schema_name,
    object_name: representative.object_name,
    status,
    dev_definition_sha: dev ? digest(dev.definition) : "",
    production_definition_sha: production ? digest(production.definition) : "",
    release_action: role === "DEPENDENCY_TABLE"
      ? "VERIFY_DEPENDENCY_ONLY"
      : status === "MATCH"
        ? "NO_CHANGE"
        : status === "PRODUCTION_ONLY"
          ? "PRESERVE_AND_INVESTIGATE"
          : "CURATE_IN_COMPATIBILITY_BRIDGE",
  });
}

rows.sort((a, b) => [a.scope_role, a.object_type, a.schema_name, a.object_name]
  .join("|").localeCompare([b.scope_role, b.object_type, b.schema_name, b.object_name].join("|")));

const headers = Object.keys(rows[0]);
const csvText = [
  headers.map(csv).join(","),
  ...rows.map((row) => headers.map((header) => csv(row[header])).join(",")),
].join("\n") + "\n";
mkdirSync(dirname(csvPath), { recursive: true });
writeFileSync(csvPath, csvText, "utf8");
writeFileSync(jsonPath, `${JSON.stringify(rows, null, 2)}\n`, "utf8");

const counts = new Map();
for (const row of rows) {
  const countKey = `${row.scope_role}|${row.status}`;
  counts.set(countKey, (counts.get(countKey) ?? 0) + 1);
}

console.log("B1_SCHEMA_DRIFT_ANALYSIS_OK");
console.log(`Rows: ${rows.length}`);
for (const [countKey, count] of [...counts.entries()].sort()) {
  console.log(`${countKey}: ${count}`);
}
console.log(`CSV: ${csvPath}`);
