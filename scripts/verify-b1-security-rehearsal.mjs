#!/usr/bin/env node

/**
 * Verifies the durable B1b rehearsal record against the exact migration file.
 * This is intentionally separate from hosted deployment verification: it proves
 * the candidate that was rehearsed, its rollback result and its protected data
 * counts without claiming that Development or Production was changed.
 */

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const evidencePath = resolve(
  root,
  "docs/production-readiness/B1-SECURITY-REHEARSAL-2026-09-06.json",
);
const evidence = JSON.parse(readFileSync(evidencePath, "utf8"));
const migrationPath = resolve(root, evidence.migration.path);
const migrationHash = createHash("sha256")
  .update(readFileSync(migrationPath))
  .digest("hex");

const failures = [];
const requireValue = (condition, message) => {
  if (!condition) failures.push(message);
};

requireValue(
  migrationHash === evidence.migration.sha256,
  `Migration hash mismatch: expected ${evidence.migration.sha256}, got ${migrationHash}`,
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
  console.log("B1_SECURITY_REHEARSAL_OK");
}
