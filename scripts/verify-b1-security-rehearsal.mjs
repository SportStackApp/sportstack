#!/usr/bin/env node

/**
 * Verifies the durable B1b rehearsal record against the exact migration file.
 * This is intentionally separate from hosted deployment verification: it proves
 * the candidate that was rehearsed, its rollback result and its protected data
 * counts without claiming that Development or Production was changed.
 */

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const evidencePath = resolve(
  root,
  "docs/production-readiness/B1-SECURITY-REHEARSAL-2026-09-06.json",
);
const evidence = JSON.parse(readFileSync(evidencePath, "utf8"));
const amendmentPath = resolve(
  root,
  "docs/production-readiness/B1-SECURITY-REHEARSAL-FINGERPRINT-AMENDMENT-2026-09-08.json",
);
const amendment = JSON.parse(readFileSync(amendmentPath, "utf8"));
const migrationPath = resolve(root, evidence.migration.path);
const workingMigrationHash = createHash("sha256")
  .update(readFileSync(migrationPath, "utf8").replaceAll("\r\n", "\n"))
  .digest("hex");
const sourceSpec = `${evidence.source_commit}:${evidence.migration.path}`;
const releasedSpec =
  `${amendment.repository_migration.released_commit}:${evidence.migration.path}`;
const sourceBytes = execFileSync("git", ["show", sourceSpec], { cwd: root });
const sourceHash = createHash("sha256").update(sourceBytes).digest("hex");
const sourceBlob = execFileSync("git", ["rev-parse", sourceSpec], {
  cwd: root,
  encoding: "utf8",
}).trim();
const releasedBlob = execFileSync("git", ["rev-parse", releasedSpec], {
  cwd: root,
  encoding: "utf8",
}).trim();

const failures = [];
const requireValue = (condition, message) => {
  if (!condition) failures.push(message);
};

requireValue(
  amendment.amends.endsWith("B1-SECURITY-REHEARSAL-2026-09-06.json"),
  "Fingerprint amendment points to the wrong evidence record",
);
requireValue(
  amendment.original_recorded_sha256 === evidence.migration.sha256,
  "Fingerprint amendment does not preserve the original recorded SHA-256",
);
requireValue(
  amendment.exact_rehearsed_artifact_status.startsWith("UNKNOWN"),
  "The unreconciled rehearsal artifact must remain explicitly unknown",
);
requireValue(
  sourceHash === amendment.repository_migration.canonical_lf_sha256,
  `Source-commit migration hash mismatch: expected ${amendment.repository_migration.canonical_lf_sha256}, got ${sourceHash}`,
);
requireValue(
  workingMigrationHash === sourceHash,
  `Working migration differs from source commit after line-ending normalisation: expected ${sourceHash}, got ${workingMigrationHash}`,
);
requireValue(
  sourceBlob === amendment.repository_migration.git_blob_sha1,
  "Source-commit migration Git blob does not match the amendment",
);
requireValue(
  releasedBlob === sourceBlob,
  "Released migration Git blob differs from the source-commit migration",
);
requireValue(
  evidence.migration.sha256 !== sourceHash,
  "The original mismatch is no longer present; review whether the amendment is still required",
);
requireValue(evidence.local_rehearsal.first_apply === "passed", "First apply did not pass");
requireValue(evidence.local_rehearsal.repeat_apply === "passed", "Repeat apply did not pass");
requireValue(evidence.local_rehearsal.rollback === "passed", "Rollback did not pass");
requireValue(evidence.local_rehearsal.runtime === "passed", "Runtime verification did not pass");
requireValue(
  evidence.local_rehearsal.cross_user_scope_probe === "denied",
  "Cross-user scope probe was not denied",
);
requireValue(
  evidence.development.rollback_compatibility_check === "passed",
  "Development rollback compatibility check did not pass",
);
requireValue(evidence.development.database_applied === true, "Development application is not recorded");
requireValue(
  evidence.development.migration_version_recorded === true,
  "Development migration history is not recorded",
);
requireValue(
  evidence.development.runtime_verification === "passed",
  "Hosted Development runtime verification did not pass",
);
requireValue(
  evidence.development.database_lint_errors === 0 &&
    evidence.development.security_adviser_errors === 0 &&
    evidence.development.performance_adviser_errors === 0,
  "Hosted Development database checks contain an error-level finding",
);
requireValue(
  evidence.production.changed === false,
  "Evidence must confirm Production was not changed",
);
requireValue(
  evidence.quality.vitest_files_passed === 46 &&
    evidence.quality.vitest_tests_passed === 181 &&
    evidence.quality.typescript === "passed" &&
    evidence.quality.production_build === "passed" &&
    evidence.quality.focused_eslint === "passed",
  "Frozen candidate quality evidence is incomplete",
);
requireValue(
  evidence.development_deployment.dev_quality_result === "passed" &&
    evidence.development_deployment.deployment_result === "success" &&
    evidence.development_deployment.alias_matches_deployment === true &&
    evidence.development_deployment.deployment_shell_sha256 ===
      evidence.development_deployment.dev_alias_shell_sha256,
  "Development quality or deployment evidence is incomplete",
);

const protectedCounts = evidence.local_rehearsal.protected_counts;
for (const [name, counts] of Object.entries(protectedCounts)) {
  requireValue(
    counts.before === counts.after_first_apply &&
      counts.before === counts.after_repeat_apply,
    `Protected count changed for ${name}`,
  );
}

if (failures.length > 0) {
  for (const failure of failures) console.error(`ERROR: ${failure}`);
  process.exitCode = 1;
} else {
  console.log("B1_SECURITY_REHEARSAL_FINGERPRINT_AMENDMENT_OK");
}
