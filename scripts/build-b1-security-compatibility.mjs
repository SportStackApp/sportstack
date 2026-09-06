import { readFileSync, writeFileSync } from "node:fs";

const [inventoryPath, outputPath] = process.argv.slice(2);

if (!inventoryPath || !outputPath) {
  throw new Error(
    "Usage: node scripts/build-b1-security-compatibility.mjs <Dev structural-inventory.json> <migration.sql>",
  );
}

const raw = readFileSync(inventoryPath, "utf8");
const parsed = JSON.parse(raw.slice(raw.indexOf("{")));
const inventory = parsed.rows?.[0]?.inventory;

if (!Array.isArray(inventory)) {
  throw new Error("The structural inventory does not contain rows[0].inventory.");
}

// Dependency-safe order for the exact, already-running Dev definitions.
const functions = [
  ["public", "is_super_admin"],
  ["public", "can_manage_module_scope"],
  ["public", "permission_scope_details"],
  ["public", "resolve_module_enabled"],
  ["public", "permission_user_in_scope"],
  ["public", "permission_subject_matches"],
  ["public", "permission_subject_matches_for_mode"],
  ["public", "administration_effective_mode"],
  ["private", "permission_context_canonical_scope"],
  ["private", "active_permission_mode_for_current_session"],
  ["private", "current_session_scope_allows"],
  ["public", "administration_scope_allows"],
  ["public", "permission_mode_scope_allows"],
  ["public", "permission_subject_manageable"],
  ["public", "resolve_effective_permission"],
  ["public", "resolve_effective_permission_for_mode_unchecked"],
  ["public", "resolve_effective_permission_for_mode"],
  ["private", "module_allowed_for_current_session"],
  ["public", "has_effective_permission"],
  ["public", "permission_visible_profiles"],
  ["public", "permission_visible_profiles_for_mode"],
  ["public", "permission_save_group_unchecked"],
  ["public", "permission_save_set_unchecked"],
  ["public", "permission_save_assignment_unchecked"],
  ["public", "permission_save_override_unchecked"],
  ["public", "save_permission_group"],
  ["public", "save_permission_set"],
  ["public", "save_permission_assignment"],
  ["public", "save_permission_override"],
  ["public", "set_module_feature_flag"],
  ["public", "clear_module_feature_flag"],
  ["public", "get_active_permission_mode"],
  ["public", "set_active_permission_context"],
  ["public", "set_active_permission_mode"],
  ["public", "list_permission_management_records_for_mode"],
  ["public", "permission_scope_contains"],
  ["public", "enforce_permission_assignment_scope"],
  ["public", "enforce_permission_set_owner_scope"],
];

const definitions = functions.map(([schema, name]) => {
  const candidates = inventory.filter(
    (row) =>
      row.object_type === "function" &&
      row.schema_name === schema &&
      row.object_name.split("(")[0] === name,
  );

  if (candidates.length !== 1) {
    throw new Error(
      `Expected one ${schema}.${name} definition, found ${candidates.length}.`,
    );
  }

  let definition = candidates[0].definition?.definition?.trim();
  if (!definition?.startsWith("CREATE OR REPLACE FUNCTION")) {
    throw new Error(`Invalid function definition for ${schema}.${name}.`);
  }
  if (!definition.includes("SECURITY DEFINER") || !definition.includes("SET search_path TO ''")) {
    throw new Error(`Unsafe function definition for ${schema}.${name}.`);
  }

  // Dev also contains later Coordination and incident module additions. B1b
  // intentionally keeps the original five-module contract created by B1a.
  if (name === "resolve_module_enabled" || name === "set_module_feature_flag") {
    definition = definition.replace(
      "'hockey_trace', 'incident_discipline', 'coordination'",
      "'hockey_trace'",
    );
  }
  if (name === "resolve_module_enabled") {
    definition = definition.replace(
      "return coalesce(v_enabled, p_module_key not in ('hockey_trace', 'incident_discipline'));",
      "return coalesce(v_enabled, p_module_key <> 'hockey_trace');",
    );
  }
  if (name === "can_manage_module_scope") {
    definition = definition.replace(
      "select p_user_id is not null\n    and p_scope_id is not null",
      `select p_user_id is not null
    and (
      p_user_id = auth.uid()
      or auth.role() = 'service_role'
    )
    and p_scope_id is not null`,
    );
    if (!definition.includes("p_user_id = auth.uid()")) {
      throw new Error("Failed to bind can_manage_module_scope to the caller.");
    }
  }

  if (/incident_discipline|coordination/.test(definition)) {
    throw new Error(`Later-package module logic remains in ${schema}.${name}.`);
  }

  const identityArguments = candidates[0].object_name.slice(
    candidates[0].object_name.indexOf("(") + 1,
    -1,
  );

  // Production already has is_super_admin(), but its search path is not
  // pinned. Replace that one behaviour-equivalent helper. Every other helper
  // is created only when the exact signature is absent, preserving Dev's
  // later Coordination and incident extensions.
  if (
    schema === "public" &&
    (name === "is_super_admin" || name === "can_manage_module_scope")
  ) {
    return `${definition};`;
  }

  return `do $b1b_function$
begin
  if not exists (
    select 1
    from pg_catalog.pg_proc procedure_row
    join pg_catalog.pg_namespace namespace_row
      on namespace_row.oid = procedure_row.pronamespace
    where namespace_row.nspname = '${schema}'
      and procedure_row.proname = '${name}'
      and pg_catalog.pg_get_function_identity_arguments(procedure_row.oid) = '${identityArguments.replaceAll("'", "''")}'
  ) then
    execute $b1b_definition$
${definition};
$b1b_definition$;
  end if;
end;
$b1b_function$;`;
});

const prelude = `-- B1b: dormant access-control functions, seed catalogue, scoped read
-- policies, integrity triggers and minimum grants. This migration is designed
-- to follow 20260906063905_b1_foundation_compatibility.sql.
--
-- Coordination, incident/discipline and membership mutation functions remain
-- excluded for later packages. All browser access is denied first and then
-- explicitly granted to the narrow current-Dev allow-list.

insert into public.permission_catalogue
  (permission_key, module_key, label, description, category, default_allowed)
values
  ('module.player_mvp.access', 'player_mvp', 'Access Player MVP Voting', 'Open Player MVP Voting routes and navigation.', 'MODULE', true),
  ('module.umpire_match_voting.access', 'umpire_match_voting', 'Access Umpire Match Voting', 'Open Umpire Match Voting routes and navigation.', 'MODULE', true),
  ('module.committee.access', 'committee', 'Access Committee Management', 'Open committee work and administration where committee membership also permits it.', 'MODULE', true),
  ('module.safety_risk.access', 'safety_risk', 'Access Safety Hub', 'Open Risk and Quality Improvement workflows inside the selected scope.', 'MODULE', true),
  ('module.hockey_trace.access', 'hockey_trace', 'Access Hockey Trace Lab', 'Open the experimental Hockey Trace tools.', 'MODULE', false),
  ('player_mvp.submit', 'player_mvp', 'Submit Player MVP ballot', 'Submit an eligible Player MVP ballot.', 'ACTION', true),
  ('player_mvp.view_results', 'player_mvp', 'View Player MVP results', 'View Player MVP result and leaderboard information permitted by scope.', 'ACTION', false),
  ('umpire_match_voting.submit', 'umpire_match_voting', 'Submit Umpire Match ballot', 'Submit an authorised Umpire Match ballot.', 'ACTION', true),
  ('umpire_match_voting.manage', 'umpire_match_voting', 'Manage Umpire Match voting', 'Review, correct and approve Umpire Match voting submissions.', 'ACTION', false),
  ('committee.chat.post', 'committee', 'Post committee chat', 'Post to private committee chat when committee position access also permits it.', 'ACTION', false),
  ('committee.poll.vote', 'committee', 'Vote in committee polls', 'Respond to committee polls when committee position access also permits it.', 'ACTION', false),
  ('safety_risk.manage', 'safety_risk', 'Manage Safety Hub records', 'Create and update in-scope Risk and Quality Improvement records.', 'ACTION', false)
on conflict (permission_key) do update set
  module_key = excluded.module_key,
  label = excluded.label,
  description = excluded.description,
  category = excluded.category;
`;

const security = `
-- RLS is explicit even though B1a already enables it on a fresh target.
alter table public.module_feature_flags enable row level security;
alter table public.administration_audit_log enable row level security;
alter table public.administration_integrity_snapshot_batches enable row level security;
alter table public.administration_membership_integrity_snapshot enable row level security;
alter table public.permission_catalogue enable row level security;
alter table public.permission_groups enable row level security;
alter table public.permission_group_members enable row level security;
alter table public.permission_sets enable row level security;
alter table public.permission_set_permissions enable row level security;
alter table public.permission_assignments enable row level security;
alter table public.permission_overrides enable row level security;
alter table private.auth_session_permission_modes enable row level security;
alter table private.auth_session_permission_modes force row level security;

drop policy if exists administration_audit_read_scoped on public.administration_audit_log;
create policy administration_audit_read_scoped on public.administration_audit_log
  for select to authenticated
  using (
    actor_id = (select auth.uid())
    or public.is_super_admin()
    or exists (
      select 1
      from public.user_roles role_row
      where role_row.user_id = (select auth.uid())
        and (
          (role_row.role::text = 'ASSOCIATION_ADMIN' and role_row.association_id = administration_audit_log.association_id)
          or (role_row.role::text = 'CLUB_ADMIN' and role_row.club_id = administration_audit_log.club_id)
          or (role_row.role::text = 'TEAM_MANAGER' and role_row.team_id = administration_audit_log.team_id)
        )
    )
  );

drop policy if exists administration_integrity_batches_super_read on public.administration_integrity_snapshot_batches;
create policy administration_integrity_batches_super_read on public.administration_integrity_snapshot_batches
  for select to authenticated using (public.is_super_admin());

drop policy if exists administration_integrity_snapshot_super_read on public.administration_membership_integrity_snapshot;
create policy administration_integrity_snapshot_super_read on public.administration_membership_integrity_snapshot
  for select to authenticated using (public.is_super_admin());

drop policy if exists module_feature_flags_select on public.module_feature_flags;
create policy module_feature_flags_select on public.module_feature_flags
  for select to authenticated
  using (public.can_manage_module_scope((select auth.uid()), scope_type, scope_id));

drop policy if exists permission_catalogue_authenticated_read on public.permission_catalogue;
create policy permission_catalogue_authenticated_read on public.permission_catalogue
  for select to authenticated using (true);

drop policy if exists permission_groups_scoped_read on public.permission_groups;
create policy permission_groups_scoped_read on public.permission_groups
  for select to authenticated
  using (public.can_manage_module_scope((select auth.uid()), scope_type, scope_id));

drop policy if exists permission_group_members_scoped_read on public.permission_group_members;
create policy permission_group_members_scoped_read on public.permission_group_members
  for select to authenticated
  using (exists (
    select 1
    from public.permission_groups group_row
    where group_row.id = group_id
      and public.can_manage_module_scope((select auth.uid()), group_row.scope_type, group_row.scope_id)
  ));

drop policy if exists permission_sets_scoped_read on public.permission_sets;
create policy permission_sets_scoped_read on public.permission_sets
  for select to authenticated
  using (public.can_manage_module_scope((select auth.uid()), owner_scope_type, owner_scope_id));

drop policy if exists permission_set_permissions_scoped_read on public.permission_set_permissions;
create policy permission_set_permissions_scoped_read on public.permission_set_permissions
  for select to authenticated
  using (exists (
    select 1
    from public.permission_sets set_row
    where set_row.id = permission_set_id
      and public.can_manage_module_scope((select auth.uid()), set_row.owner_scope_type, set_row.owner_scope_id)
  ));

drop policy if exists permission_assignments_scoped_read on public.permission_assignments;
create policy permission_assignments_scoped_read on public.permission_assignments
  for select to authenticated
  using (public.can_manage_module_scope((select auth.uid()), scope_type, scope_id));

drop policy if exists permission_overrides_scoped_read on public.permission_overrides;
create policy permission_overrides_scoped_read on public.permission_overrides
  for select to authenticated
  using (public.can_manage_module_scope((select auth.uid()), scope_type, scope_id));

drop trigger if exists permission_assignment_scope_guard on public.permission_assignments;
create trigger permission_assignment_scope_guard
  before insert or update of permission_set_id, scope_type, scope_id
  on public.permission_assignments
  for each row execute function public.enforce_permission_assignment_scope();

drop trigger if exists permission_set_owner_scope_guard on public.permission_sets;
create trigger permission_set_owner_scope_guard
  before update of owner_scope_type, owner_scope_id
  on public.permission_sets
  for each row execute function public.enforce_permission_set_owner_scope();

-- Tables are API-private by default. Only the five read surfaces used by the
-- current administration screens are exposed to authenticated users.
revoke all on table
  public.module_feature_flags,
  public.administration_audit_log,
  public.administration_integrity_snapshot_batches,
  public.administration_membership_integrity_snapshot,
  public.permission_catalogue,
  public.permission_groups,
  public.permission_group_members,
  public.permission_sets,
  public.permission_set_permissions,
  public.permission_assignments,
  public.permission_overrides,
  private.auth_session_permission_modes
from public, anon, authenticated;

grant select on table
  public.module_feature_flags,
  public.administration_audit_log,
  public.administration_integrity_snapshot_batches,
  public.administration_membership_integrity_snapshot,
  public.permission_catalogue
to authenticated;

grant all on table
  public.module_feature_flags,
  public.administration_audit_log,
  public.administration_integrity_snapshot_batches,
  public.administration_membership_integrity_snapshot,
  public.permission_catalogue,
  public.permission_groups,
  public.permission_group_members,
  public.permission_sets,
  public.permission_set_permissions,
  public.permission_assignments,
  public.permission_overrides
to service_role;

revoke all on sequence private.auth_session_permission_mode_revision_seq
  from public, anon, authenticated;
grant usage, select, update on sequence private.auth_session_permission_mode_revision_seq
  to service_role;

grant usage on schema private to authenticated, service_role;

-- Remove PostgreSQL's default PUBLIC execution before applying the explicit
-- authenticated and service-role allow-lists below.
`;

const identities = functions.map(([schema, name]) => {
  const row = inventory.find(
    (candidate) =>
      candidate.object_type === "function" &&
      candidate.schema_name === schema &&
      candidate.object_name.split("(")[0] === name,
  );
  const open = row.object_name.indexOf("(");
  const args = row.object_name.slice(open + 1, -1);
  return `${schema}.${name}(${args})`;
});

const authenticated = new Set([
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

const noServiceRole = new Set([
  "private.active_permission_mode_for_current_session",
  "private.current_session_scope_allows",
  "private.module_allowed_for_current_session",
  "private.permission_context_canonical_scope",
]);

const grants = identities
  .map((identity, index) => {
    const key = `${functions[index][0]}.${functions[index][1]}`;
    const statements = [
      `revoke all on function ${identity} from public, anon, authenticated, service_role;`,
    ];
    if (authenticated.has(key)) {
      statements.push(`grant execute on function ${identity} to authenticated;`);
    }
    if (!noServiceRole.has(key)) {
      statements.push(`grant execute on function ${identity} to service_role;`);
    }
    return statements.join("\n");
  })
  .join("\n\n");

const output = [
  prelude.trim(),
  definitions.join("\n\n"),
  security.trim(),
  grants,
  "",
].join("\n\n");

writeFileSync(outputPath, output, "utf8");
console.log(`B1_SECURITY_MIGRATION_BUILT functions=${functions.length}`);
