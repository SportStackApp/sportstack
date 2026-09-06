#!/usr/bin/env node

/**
 * Verify the frozen B1d browser application boundary.
 *
 * This does not deploy or modify an environment. It proves that the manifest
 * points to immutable Git objects, that browser-used RPCs exist in B1b/B1c,
 * and that later modules and Development-only helpers stay outside the slice.
 */

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(import.meta.dirname, "..");
const manifestPath = resolve(
  root,
  "docs/production-readiness/B1-APPLICATION-ALLOW-LIST-2026-09-06.json",
);
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const failures = [];

const requested = new Set(process.argv.slice(2));
const knownFlags = new Set([
  "--check-owner-flag",
  "--check-inventory",
  "--check-dependencies",
  "--check-regression",
  "--check-release-manifest",
]);
for (const flag of requested) {
  if (!knownFlags.has(flag)) failures.push(`unknown flag: ${flag}`);
}
const shouldRun = (flag) => requested.size === 0 || requested.has(flag);

const fail = (message) => failures.push(message);
const assert = (condition, message) => {
  if (!condition) fail(message);
};
const readRepoFile = (path) => readFileSync(resolve(root, path), "utf8");

const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
    ...options,
  });
  if (result.error || result.status !== 0) {
    const detail = [result.error?.message, result.stdout, result.stderr].filter(Boolean).join("\n").trim();
    throw new Error(`${command} ${args.join(" ")} failed${detail ? `:\n${detail}` : ""}`);
  }
  return result.stdout.trim();
};

const git = (...args) => run("git", args);
const sourceAt = (commit, path) => git("show", `${commit}:${path}`);
const sha256At = (commit, path) => {
  const result = spawnSync("git", ["cat-file", "blob", `${commit}:${path}`], {
    cwd: root,
    encoding: null,
    maxBuffer: 20 * 1024 * 1024,
  });
  if (result.error || result.status !== 0) {
    throw new Error(`Unable to read ${commit}:${path}`);
  }
  return createHash("sha256").update(result.stdout).digest("hex");
};

const b1bPath = "supabase/migrations/20260906075102_b1_security_compatibility.sql";
const b1cPath = "supabase/migrations/20260906095820_b1_membership_workflow_compatibility.sql";
const functionNames = (sql) => new Set(
  [...sql.matchAll(/create or replace function\s+(?:public|private)\.([a-z0-9_]+)\s*\(/gi)]
    .map((match) => match[1].toLowerCase()),
);
const rpcNames = (source) => new Set(
  [...source.matchAll(/\.rpc\(\s*["']([^"']+)["']/g)]
    .map((match) => match[1]),
);

if (shouldRun("--check-owner-flag")) {
  const currentState = readRepoFile("docs/current-state.md");
  const allowList = readRepoFile("docs/production-readiness/B1-APPLICATION-ALLOW-LIST-2026-09-06.md");
  assert(manifest.ownerConfirmation?.status === "CONFIRMATION_REQUIRED", "manifest owner confirmation is not open");
  assert(
    currentState.includes("B1c owner walkthrough: CONFIRMATION REQUIRED"),
    "current state does not retain the B1c owner confirmation gate",
  );
  assert(
    allowList.includes("B1c owner walkthrough: CONFIRMATION REQUIRED"),
    "allow-list handoff does not retain the B1c owner confirmation gate",
  );
  if (failures.length === 0) console.log("B1_OWNER_CONFIRMATION_FLAG_OK");
}

if (shouldRun("--check-inventory")) {
  assert(manifest.schemaVersion === 1, "unexpected manifest schema version");
  assert(manifest.productionChangesAuthorised === false, "manifest incorrectly authorises Production changes");
  assert(manifest.edgeFunctions?.length === 0, "an Edge Function entered B1d");
  assert(manifest.workflows?.length === 0, "a workflow entered B1d");
  assert(manifest.exactSourceFiles?.length >= 10, "exact-source inventory is incomplete");
  assert(manifest.patchOnlyFiles?.length === 7, "patch-only inventory is incomplete");

  const allPaths = [
    ...manifest.exactSourceFiles.map((entry) => entry.path),
    ...manifest.patchOnlyFiles.map((entry) => entry.path),
    ...manifest.generatedAtRehearsal.map((entry) => entry.path),
  ];
  assert(new Set(allPaths).size === allPaths.length, "included paths are duplicated across inventory classes");

  for (const entry of manifest.exactSourceFiles) {
    assert(Boolean(entry.path && entry.sourceCommit && entry.blob && entry.reason), `incomplete exact-source entry: ${entry.path || "unknown"}`);
    try {
      const actualBlob = git("rev-parse", `${entry.sourceCommit}:${entry.path}`);
      assert(actualBlob === entry.blob, `blob mismatch for ${entry.path}: ${actualBlob}`);
    } catch (error) {
      fail(error.message);
    }
  }
  for (const entry of manifest.patchOnlyFiles) {
    assert(entry.allowedChanges?.length > 0, `no allowed changes for ${entry.path}`);
    assert(entry.forbiddenFeatures?.length > 0, `no forbidden features for ${entry.path}`);
  }
  for (const entry of manifest.databasePackage) {
    assert(
      sha256At(manifest.environmentPins.hostedCandidateCommit, entry.path) === entry.sha256,
      `hosted candidate migration hash mismatch for ${entry.path}`,
    );
  }

  const excluded = new Set(manifest.excludedPaths.map((entry) => entry.path));
  for (const required of [
    "src/components/admin/DevTestAccountProvisioner.tsx",
    "supabase/functions/provision-dev-test-account",
    "src/pages/CoordinationModule.tsx",
    "src/pages/discipline",
    "src/features/expense-hub",
    ".github/workflows",
    "supabase/functions",
  ]) {
    assert(excluded.has(required), `required exclusion is missing: ${required}`);
  }
  if (failures.length === 0) console.log("B1_APPLICATION_INVENTORY_OK");
}

if (shouldRun("--check-dependencies")) {
  const b1bFunctions = functionNames(readRepoFile(b1bPath));
  const b1cFunctions = functionNames(readRepoFile(b1cPath));
  for (const name of manifest.requiredB1bRpcNames) {
    assert(b1bFunctions.has(name), `B1b does not define browser-required RPC: ${name}`);
  }
  for (const name of manifest.requiredB1cRpcNames) {
    assert(b1cFunctions.has(name), `B1c does not define browser-required RPC: ${name}`);
  }

  const browserRpcSources = [
    "src/components/admin/AdvancedPermissionControls.tsx",
    "src/components/admin/ModuleControlsCard.tsx",
    "src/contexts/AppModeContext.tsx",
    "src/hooks/useModuleAvailability.ts",
  ];
  const browserRpcs = new Set();
  for (const path of browserRpcSources) {
    const entry = manifest.exactSourceFiles.find((candidate) => candidate.path === path);
    assert(Boolean(entry), `missing exact browser RPC source: ${path}`);
    if (!entry) continue;
    for (const rpc of rpcNames(sourceAt(entry.sourceCommit, path))) browserRpcs.add(rpc);
  }
  const expectedB1bRpcs = new Set(manifest.requiredB1bRpcNames);
  assert(
    JSON.stringify([...browserRpcs].sort()) === JSON.stringify([...expectedB1bRpcs].sort()),
    `B1b browser RPC set differs: ${[...browserRpcs].sort().join(", ")}`,
  );

  const wrapperEntry = manifest.exactSourceFiles.find((entry) => entry.path === "src/lib/primaryTeamChangeRpc.ts");
  assert(Boolean(wrapperEntry), "primary-team RPC wrapper is not pinned");
  if (wrapperEntry) {
    const wrapperRpcs = rpcNames(sourceAt(wrapperEntry.sourceCommit, wrapperEntry.path));
    assert(
      JSON.stringify([...wrapperRpcs].sort()) === JSON.stringify([...manifest.requiredB1cRpcNames].sort()),
      `B1c browser RPC set differs: ${[...wrapperRpcs].sort().join(", ")}`,
    );
  }

  const forbiddenExactTokens = [
    "coordination",
    "incident_discipline",
    "expense-hub",
    "provision-dev-test-account",
  ];
  for (const entry of manifest.exactSourceFiles) {
    const source = sourceAt(entry.sourceCommit, entry.path).toLowerCase();
    for (const token of forbiddenExactTokens) {
      assert(!source.includes(token), `${entry.path} contains excluded token: ${token}`);
    }
  }

  const reconciled = new Set(manifest.reconciledB1eDatabaseDependencies);
  for (const name of [
    "approve_membership_request",
    "admin_save_user_roles",
    "admin_manage_team_membership",
    "admin_create_team_invite",
    "admin_cancel_team_invite",
    "admin_visible_profile_ids",
    "admin_update_profile_details",
  ]) {
    assert(reconciled.has(name), `B1e administration dependency is not recorded: ${name}`);
    assert(!manifest.requiredB1bRpcNames.includes(name), `B1e dependency leaked into the B1b RPC set: ${name}`);
  }
  if (failures.length === 0) console.log("B1_APPLICATION_DEPENDENCIES_OK");
}

if (shouldRun("--check-regression")) {
  const primaryPages = [
    "src/pages/Profile.tsx",
    "src/pages/admin/Requests.tsx",
    "src/pages/admin/UsersManagement.tsx",
  ];
  for (const path of primaryPages) {
    const source = readRepoFile(path);
    assert(source.includes("@/lib/primaryTeamChangeRpc"), `${path} does not use the B1c RPC wrapper`);
    const directMutation = /\.from\(\s*["']primary_change_requests["']\s*\)\s*\.(?:insert|update|delete|upsert)\s*\(/s;
    assert(!directMutation.test(source), `${path} still directly mutates primary_change_requests`);
  }

  const currentWrapperBlob = git("hash-object", "src/lib/primaryTeamChangeRpc.ts");
  const pinnedWrapper = manifest.exactSourceFiles.find((entry) => entry.path === "src/lib/primaryTeamChangeRpc.ts");
  assert(currentWrapperBlob === pinnedWrapper?.blob, "current primary-team RPC wrapper differs from the pinned B1c source");

  const commands = [
    ["node", ["scripts/verify-b1-security-compatibility.mjs"]],
    ["node", ["scripts/verify-b1-membership-compatibility.mjs"]],
    [process.execPath, [
      "node_modules/vitest/vitest.mjs",
      "run",
      "src/lib/activeScopeOptions.test.ts",
      "src/lib/primaryTeamChangeRpc.test.ts",
      "src/lib/accountAccess.test.ts",
    ]],
    ["python", [
      "-m",
      "unittest",
      "tests.test_session_permission_context",
      "tests.test_voting_module_enforcement",
    ]],
  ];
  for (const [command, args] of commands) {
    try {
      run(command, args);
    } catch (error) {
      fail(error.message);
    }
  }
  if (failures.length === 0) console.log("B1_APPLICATION_REGRESSION_OK");
}

if (shouldRun("--check-release-manifest")) {
  assert(
    manifest.status === "INDEPENDENT_REVIEW_COMPLETE_HOLD_FOR_OWNER_EVIDENCE",
    "manifest does not accurately state its independent-review status",
  );
  const blockers = new Set(manifest.releaseBlockers.map((entry) => entry.id));
  for (const required of [
    "B1C-OWNER-CONFIRMATION",
    "B1-PRIMARY-SEMANTICS-CONFIRMATION",
    "B1-PRODUCTION-PREFLIGHT",
    "B1-PRODUCTION-APPROVAL",
  ]) {
    assert(blockers.has(required), `release blocker is missing: ${required}`);
  }
  assert(manifest.releaseBlockers.every((entry) => entry.status === "OPEN"), "a release blocker was prematurely closed");
  assert(manifest.productionChangesAuthorised === false, "Production is incorrectly authorised");
  if (failures.length === 0) console.log("B1_APPLICATION_RELEASE_MANIFEST_OK");
}

if (failures.length > 0) {
  console.error("B1_APPLICATION_ALLOW_LIST_FAILED");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

if (requested.size === 0) console.log("B1_APPLICATION_ALLOW_LIST_OK");
