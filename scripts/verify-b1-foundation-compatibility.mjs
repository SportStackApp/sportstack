#!/usr/bin/env node

/**
 * Static safety check for the dormant B1a compatibility migration.
 * Runtime apply/repeat/rollback checks are recorded separately against a
 * Production-derived local database.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const migrationPath = resolve(
  root,
  "supabase/migrations/20260906063905_b1_foundation_compatibility.sql",
);
const driftPath = resolve(
  root,
  "docs/production-readiness/B1-SCHEMA-DRIFT-MAP-2026-09-06.csv",
);
const migration = readFileSync(migrationPath, "utf8");
const lower = migration.toLowerCase();
const drift = readFileSync(driftPath, "utf8");

const expectedTables = [
  "public.module_feature_flags",
  "public.administration_audit_log",
  "public.administration_integrity_snapshot_batches",
  "public.administration_membership_integrity_snapshot",
  "public.permission_catalogue",
  "public.permission_groups",
  "public.permission_group_members",
  "public.permission_sets",
  "public.permission_set_permissions",
  "public.permission_assignments",
  "public.permission_overrides",
  "private.auth_session_permission_modes",
];

const failures = [];
for (const table of expectedTables) {
  if (!lower.includes(`create table if not exists ${table}`)) {
    failures.push(`missing repeat-safe table definition: ${table}`);
  }
}

for (const forbidden of [
  "create or replace function",
  "create function",
  "create policy",
  "grant execute",
  "grant select",
  "grant all",
  "alter type",
  "truncate ",
  "drop constraint",
]) {
  if (lower.includes(forbidden)) failures.push(`forbidden B1a operation: ${forbidden.trim()}`);
}

for (const deferredFeature of [
  "incident_discipline",
  "coordination",
  "umpire_coordinator",
  "technical_bench_coordinator",
  "volunteer_coordinator",
  "reserved_dev",
  "scraper",
]) {
  if (lower.includes(deferredFeature)) failures.push(`later-batch feature leaked into B1a: ${deferredFeature}`);
}

const dataWrites = migration
  .split(/\r?\n/)
  .map((line) => line.trim().toLowerCase())
  .filter((line) => /^(insert into|update |delete from)/.test(line));
if (dataWrites.length !== 1 || dataWrites[0] !== "insert into b1a_new_objects (schema_name, object_name, object_type)") {
  failures.push("B1a must write only to its temporary new-object marker.");
}

if (!lower.includes("revoke all on table") || !lower.includes("revoke all on sequence")) {
  failures.push("new dormant objects are not explicitly locked from browser roles");
}
if (!lower.includes("force row level security")) {
  failures.push("the private session table is not forced through row-level security");
}
if (!drift.includes('"B1_OWNED_TABLE","table","public","module_feature_flags","DEV_ONLY"')) {
  failures.push("the current live drift map does not contain the expected Production gap");
}

if (failures.length > 0) {
  console.error("B1_FOUNDATION_COMPATIBILITY_FAILED");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("B1_FOUNDATION_COMPATIBILITY_OK");
console.log(`Tables checked: ${expectedTables.length}`);
console.log("Scope: structures only; no application data, policies, functions or grants");
