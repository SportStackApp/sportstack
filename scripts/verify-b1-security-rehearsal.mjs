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
requireValue(
  evidence.production.changed === false,
  "Evidence must confirm Production was not changed",
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
