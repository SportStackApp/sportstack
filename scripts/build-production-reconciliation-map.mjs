#!/usr/bin/env node

/**
 * Build the first-pass Main-to-Production migration reconciliation register.
 *
 * The script is deliberately offline: it consumes the sanitised output from
 * audit-production-reconciliation.ps1 and the two Git trees. It never connects
 * to Supabase and never changes a database.
 */

import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, "..");
const evidenceDirectory = resolve(
  repositoryRoot,
  process.argv[2] ?? "outputs/production-reconciliation-2026-09-06-detail",
);
const csvPath = resolve(
  repositoryRoot,
  "docs/production-readiness/MAIN-PRODUCTION-MIGRATION-MAP-2026-09-06.csv",
);
const analysisPath = join(evidenceDirectory, "migration-analysis.json");

function git(args) {
  return execFileSync("git", args, {
    cwd: repositoryRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function csv(value) {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

function releaseGroup(fileName) {
  const name = fileName.toLowerCase();
  if (/mvp|tally/.test(name)) return "B2 Player MVP";
  if (/expense|statement/.test(name)) return "B5 Expense";
  if (/committee|safety|risk|incident|discipline/.test(name)) return "B4 Governance and safety";
  if (/coordination|availability|replacement/.test(name)) return "B4 Coordination";
  if (/umpire|vote_scheme|voter/.test(name)) return "B3 Umpire operations";
  if (/fixture|revsports|venue|match_duration|lineup|formation|coach|position|player_explorer/.test(name)) {
    return "B3 Hockey operations";
  }
  if (/communication|message|notification|reminder/.test(name)) return "B3 Communications";
  if (/role|permission|access|scope|admin|membership|module|profile|placeholder/.test(name)) {
    return "B1 Access and identity";
  }
  return "B1 Shared database foundation";
}

function manualDecision(fileName) {
  const decisions = new Map([
    [
      "20260905040425_add_manual_player_mvp_tally_presentations.sql",
      ["PRESERVE_PRODUCTION_BASELINE", "Already applied only in Production; never reapply or remove."],
    ],
    [
      "20260801013000_harden_field_template_grants.sql",
      ["REPLACE_WITH_COMPATIBILITY_BRIDGE", "Original file fails because live Production has no public.field_templates table."],
    ],
    [
      "20260802105000_transactional_dev_account_and_role_guards.sql",
      ["SPLIT_PRODUCTION_AND_DEV_CONTENT", "Retain the generic duplicate-role guard but exclude disposable Dev-account helpers."],
    ],
    [
      "20260802109000_authorise_dev_test_provisioning_session.sql",
      ["EXCLUDE_DEV_ONLY", "Authorises the disposable Dev-account provisioner."],
    ],
    [
      "20260802231405_reserved_dev_test_account_lookup.sql",
      ["EXCLUDE_DEV_ONLY", "Contains the fixed reserved Dev test identities."],
    ],
    [
      "20260803090000_scope_reserved_umpire_voter_accounts.sql",
      ["EXCLUDE_DEV_ONLY", "Resets reserved disposable Dev Umpire and Voter accounts."],
    ],
    [
      "20260820213845_fix_dev_umpire_account_scope.sql",
      ["EXCLUDE_DEV_ONLY", "Repairs only the reserved Dev Umpire account."],
    ],
  ]);
  for (const tallyFile of [
    "20260829124215_published_player_mvp_tally_presentations.sql",
    "20260829130253_index_player_mvp_tally_foreign_keys.sql",
    "20260829131126_harden_player_mvp_tally_audience.sql",
    "20260829150000_refine_player_mvp_tally_presentations.sql",
    "20260829170000_dedupe_mvp_tally_audience.sql",
  ]) {
    decisions.set(tallyFile, [
      "REPLACED_BY_PRODUCTION_TALLY_SLICE",
      "Production migration 20260905040425 supplies the reconciled tally schema; verify equivalence rather than replaying this history.",
    ]);
  }
  return decisions.get(fileName) ?? [
    "CURATE_AND_REHEARSE",
    "Do not apply the historical file directly until live-schema equivalence, dependencies and data effects are proven.",
  ];
}

function riskFlags(sql) {
  const flags = [];
  const tests = [
    ["data-delete", /\bdelete\s+from\b/i],
    ["table-or-type-drop", /\bdrop\s+(?:table|type|schema)\b/i],
    ["data-update", /\bupdate\s+(?:public\.|private\.|auth\.|storage\.)?[a-z_]/i],
    ["data-insert", /\binsert\s+into\b/i],
    ["security-definer", /\bsecurity\s+definer\b/i],
    ["rls-or-policy", /\b(?:create|drop)\s+policy\b|enable\s+row\s+level\s+security/i],
    ["grant-change", /\b(?:grant|revoke)\b/i],
    ["cron-or-trigger", /\bcron\.|\bcreate\s+(?:constraint\s+)?trigger\b/i],
  ];
  for (const [label, pattern] of tests) {
    if (pattern.test(sql)) flags.push(label);
  }
  return flags;
}

function migrationSummary(sql) {
  return sql
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("--"))
    .slice(0, 3)
    .map((line) => line.replace(/^--\s?/, ""))
    .join(" ")
    .slice(0, 300);
}

function referencedObjects(sql) {
  const objects = new Set();
  for (const match of sql.matchAll(/\b(public|private|auth|storage)\.([a-z_][a-z0-9_]*)\b/gi)) {
    objects.add(`${match[1].toLowerCase()}.${match[2].toLowerCase()}`);
  }
  return [...objects].sort();
}

const migrationVersions = new Set(
  JSON.parse(readFileSync(join(evidenceDirectory, "production-migration-versions.json"), "utf8")),
);
const productionSchema = readFileSync(join(evidenceDirectory, "production-public-schema.sql"), "utf8").toLowerCase();
const changedLines = git([
  "diff",
  "--name-status",
  "--no-renames",
  "origin/prod",
  "origin/main",
  "--",
  "supabase/migrations",
])
  .split(/\r?\n/)
  .filter(Boolean);

const rows = changedLines.map((line) => {
  const [gitStatus, path] = line.split("\t");
  const fileName = path.split("/").at(-1);
  const version = fileName.match(/^(20\d{12})_/)?.[1] ?? "";
  const sql = gitStatus === "D"
    ? git(["show", `origin/prod:${path}`])
    : readFileSync(join(repositoryRoot, path), "utf8");
  const [decision, reason] = manualDecision(fileName);
  const objects = referencedObjects(sql);
  const publicObjects = objects.filter((object) => object.startsWith("public."));
  const presentCount = publicObjects.filter((object) => productionSchema.includes(object.slice(7))).length;
  const presence = publicObjects.length === 0
    ? "No public object extracted"
    : presentCount === 0
      ? "None mentioned in Production schema"
      : presentCount === publicObjects.length
        ? "All names mentioned in Production schema"
        : `${presentCount}/${publicObjects.length} names mentioned in Production schema`;

  return {
    version,
    file: fileName,
    git_change: gitStatus === "A" ? "Main only" : "Production only",
    recorded_in_production_history: migrationVersions.has(version) ? "Yes" : "No",
    proposed_batch: releaseGroup(fileName),
    decision,
    reason,
    risk_flags: riskFlags(sql).join("; ") || "none detected",
    production_schema_signal: presence,
    referenced_objects: objects.join("; "),
    migration_summary: migrationSummary(sql),
  };
});

if (rows.length !== 115) {
  throw new Error(`Expected 115 changed migration paths, found ${rows.length}.`);
}

const headers = Object.keys(rows[0]);
const csvText = [
  headers.map(csv).join(","),
  ...rows.map((row) => headers.map((header) => csv(row[header])).join(",")),
].join("\n") + "\n";
mkdirSync(dirname(csvPath), { recursive: true });
writeFileSync(csvPath, csvText, "utf8");
writeFileSync(analysisPath, `${JSON.stringify(rows, null, 2)}\n`, "utf8");

const decisionCounts = Object.groupBy(rows, (row) => row.decision);
const batchCounts = Object.groupBy(rows, (row) => row.proposed_batch);
console.log("MIGRATION_RECONCILIATION_MAP_OK");
console.log(`Rows: ${rows.length}`);
for (const [decision, items] of Object.entries(decisionCounts).sort()) {
  console.log(`${decision}: ${items.length}`);
}
for (const [batch, items] of Object.entries(batchCounts).sort()) {
  console.log(`${batch}: ${items.length}`);
}
console.log(`CSV: ${csvPath}`);
