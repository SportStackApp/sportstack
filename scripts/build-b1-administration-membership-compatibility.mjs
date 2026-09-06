#!/usr/bin/env node

/**
 * Builds the additive B1e administration and membership compatibility
 * migration from the final reviewed function definitions already recorded in
 * migration history. This deliberately excludes Coordination and Dev-only
 * provisioning functions.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const outputPath = resolve(
  root,
  process.argv[2] ??
    "supabase/migrations/20260906114318_b1_administration_membership_compatibility.sql",
);

const sources = {
  approval: "supabase/migrations/20260801040000_atomic_membership_request_approval.sql",
  administration: "supabase/migrations/20260801083000_scoped_administration_integrity.sql",
  profile: "supabase/migrations/20260801084000_administration_scope_reads_and_snapshot.sql",
  roleWrapper: "supabase/migrations/20260802104000_validate_admin_role_scopes.sql",
  roleGuard: "supabase/migrations/20260802105000_transactional_dev_account_and_role_guards.sql",
  roleMutation:
    "supabase/migrations/20260802111000_scope_role_mutations_and_preserve_membership_player.sql",
  visibleProfiles:
    "supabase/migrations/20260803100000_include_role_scoped_admin_users.sql",
  targetScope:
    "supabase/migrations/20260803101000_include_role_scoped_admin_mutations.sql",
};

const contents = Object.fromEntries(
  Object.entries(sources).map(([key, path]) => [
    key,
    readFileSync(resolve(root, path), "utf8"),
  ]),
);

function extractFunction(source, name) {
  const startPattern = new RegExp(
    `create(?: or replace)? function public\\.${name}\\(`,
    "i",
  );
  const start = source.search(startPattern);
  if (start < 0) throw new Error(`Function source not found: ${name}`);

  const remainder = source.slice(start);
  const terminator = /\n(?:\$function\$|\$\$);/g;
  const match = terminator.exec(remainder);
  if (!match) throw new Error(`Function terminator not found: ${name}`);

  return remainder.slice(0, match.index + match[0].length).trim();
}

function withoutParameterDefaults(definition) {
  const returnsIndex = definition.toLowerCase().indexOf("\nreturns ");
  if (returnsIndex < 0) throw new Error("Function return clause not found");
  const header = definition
    .slice(0, returnsIndex)
    .replace(/\s+default\s+null/gi, "");
  return `${header}${definition.slice(returnsIndex)}`;
}

const functions = [
  extractFunction(contents.administration, "guard_team_membership_integrity"),
  extractFunction(contents.roleGuard, "guard_user_role_duplicate_insert"),
  extractFunction(contents.visibleProfiles, "admin_visible_profile_ids"),
  extractFunction(contents.targetScope, "administration_target_profile_in_scope"),
  extractFunction(contents.profile, "admin_update_profile_details"),
  extractFunction(contents.roleMutation, "admin_save_user_roles_unchecked"),
  withoutParameterDefaults(
    extractFunction(contents.roleWrapper, "admin_save_user_roles").replace(
      /^create function/i,
      "create or replace function",
    ),
  ),
  extractFunction(contents.administration, "admin_manage_team_membership"),
  extractFunction(contents.administration, "admin_create_team_invite"),
  extractFunction(contents.administration, "admin_cancel_team_invite"),
  extractFunction(contents.administration, "admin_membership_integrity_report"),
  extractFunction(contents.approval, "approve_membership_request").replace(
    "not in ('PRIMARY', 'SECONDARY')",
    "not in ('PRIMARY', 'SECONDARY', 'FILL_IN')",
  ),
];

const compatibilityPreamble = `-- PostgreSQL cannot remove parameter defaults with CREATE OR REPLACE.
-- Drop only this browser wrapper, without CASCADE, before recreating its safe
-- six- and seven-argument compatibility signatures below.
drop function if exists public.admin_save_user_roles(
  uuid, text[], jsonb, jsonb, uuid[], jsonb, text
);

alter table public.requests
  drop constraint if exists requests_membership_type_check;
alter table public.requests
  add constraint requests_membership_type_check
  check (membership_type in ('PRIMARY', 'SECONDARY', 'FILL_IN'));`;

const legacyRoleWrapper = `create or replace function public.admin_save_user_roles(
  p_user_id uuid,
  p_roles text[],
  p_coach_scopes jsonb default null,
  p_manager_scopes jsonb default null,
  p_association_admin_associations uuid[] default null,
  p_club_admin_scopes jsonb default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
begin
  perform public.admin_save_user_roles(
    p_user_id,
    p_roles,
    p_coach_scopes,
    p_manager_scopes,
    p_association_admin_associations,
    p_club_admin_scopes,
    null
  );
end;
$function$;`;

const grants = `-- Trigger and implementation helpers are never browser-callable.
revoke all on function public.guard_team_membership_integrity()
  from public, anon, authenticated;
revoke all on function public.guard_user_role_duplicate_insert()
  from public, anon, authenticated;
revoke all on function public.administration_target_profile_in_scope(uuid, text)
  from public, anon, authenticated;
revoke all on function public.admin_save_user_roles_unchecked(
  uuid, text[], jsonb, jsonb, uuid[], jsonb, text
) from public, anon, authenticated;
revoke all on function public.admin_membership_integrity_report()
  from public, anon, authenticated;

grant execute on function public.guard_team_membership_integrity() to service_role;
grant execute on function public.guard_user_role_duplicate_insert() to service_role;
grant execute on function public.administration_target_profile_in_scope(uuid, text)
  to service_role;
grant execute on function public.admin_save_user_roles_unchecked(
  uuid, text[], jsonb, jsonb, uuid[], jsonb, text
) to service_role;
grant execute on function public.admin_membership_integrity_report() to service_role;

-- These are the browser-facing administration functions.
revoke all on function public.admin_visible_profile_ids(text, uuid, uuid, uuid)
  from public, anon;
revoke all on function public.admin_update_profile_details(uuid, jsonb, text)
  from public, anon;
revoke all on function public.admin_save_user_roles(
  uuid, text[], jsonb, jsonb, uuid[], jsonb, text
) from public, anon;
revoke all on function public.admin_save_user_roles(
  uuid, text[], jsonb, jsonb, uuid[], jsonb
) from public, anon;
revoke all on function public.admin_manage_team_membership(uuid, text, text, text)
  from public, anon;
revoke all on function public.admin_create_team_invite(uuid, uuid, text, text)
  from public, anon;
revoke all on function public.admin_cancel_team_invite(uuid, text)
  from public, anon;
revoke all on function public.approve_membership_request(uuid, boolean)
  from public, anon;

grant execute on function public.admin_visible_profile_ids(text, uuid, uuid, uuid)
  to authenticated, service_role;
grant execute on function public.admin_update_profile_details(uuid, jsonb, text)
  to authenticated, service_role;
grant execute on function public.admin_save_user_roles(
  uuid, text[], jsonb, jsonb, uuid[], jsonb, text
) to authenticated, service_role;
grant execute on function public.admin_save_user_roles(
  uuid, text[], jsonb, jsonb, uuid[], jsonb
) to authenticated, service_role;
grant execute on function public.admin_manage_team_membership(uuid, text, text, text)
  to authenticated, service_role;
grant execute on function public.admin_create_team_invite(uuid, uuid, text, text)
  to authenticated, service_role;
grant execute on function public.admin_cancel_team_invite(uuid, text)
  to authenticated, service_role;
grant execute on function public.approve_membership_request(uuid, boolean)
  to authenticated, service_role;`;

const migration = `-- B1e: Production-compatible administration and general membership bridge.
--
-- This migration recreates only the functions required by the allow-listed
-- Users and Requests screens. It does not copy Coordination, Dev test-account
-- provisioning, Edge Functions, workflows or historical data.
--
-- The six-argument role function is retained as a hardened compatibility
-- wrapper for the current Production browser bundle. The seven-argument
-- function has no defaults so PostgREST can resolve both overloads safely.

${compatibilityPreamble}

${functions.join("\n\n")}

${legacyRoleWrapper}

drop trigger if exists team_membership_integrity_guard
  on public.team_memberships;
create trigger team_membership_integrity_guard
before insert or update of user_id, team_id, status, membership_type
on public.team_memberships
for each row execute function public.guard_team_membership_integrity();

drop trigger if exists user_role_duplicate_insert_guard
  on public.user_roles;
create trigger user_role_duplicate_insert_guard
before insert on public.user_roles
for each row execute function public.guard_user_role_duplicate_insert();

${grants}
`;

writeFileSync(outputPath, migration, "utf8");
console.log(`B1_ADMIN_MEMBERSHIP_MIGRATION_BUILT ${outputPath}`);
