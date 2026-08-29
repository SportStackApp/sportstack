import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// This small checker verifies the planning package itself. It does not test the
// application and it does not execute any future Production-readiness gate.
const mode = process.argv[2];
const root = process.cwd();

const read = (relativePath) => readFileSync(resolve(root, relativePath), "utf8");

const assertIncludes = (text, values, label) => {
  const missing = values.filter((value) => !text.includes(value));
  if (missing.length > 0) {
    throw new Error(`${label} is missing: ${missing.join(", ")}`);
  }
};

if (mode === "plan") {
  const plan = read("docs/production-readiness/PLAN.md");
  assertIncludes(plan, [
    "## B. Known-defect repair",
    "READY-001",
    "## C. Screen consistency review",
    "### C1. Sorting contract",
    "### C2. Persistence contract",
    "## D. Missing test cycles and regression automation",
    "## E. Walk-away night testing",
    "## F. Main staging acceptance",
    "## G. Production release decision and controlled rollout",
    "explicit approval",
  ], "readiness plan");
  console.log("readiness plan verification passed");
} else if (mode === "gates") {
  const gates = read("docs/production-readiness/GATES.md");
  const ids = [...gates.matchAll(/^- \[[ x]\] (R\d+):/gm)].map((match) => match[1]);
  if (ids.length !== 20 || new Set(ids).size !== ids.length) {
    throw new Error(`expected 20 unique readiness gates, found ${ids.length}`);
  }
  assertIncludes(gates, ["R2:", "R4:", "R5:", "R13:", "R16:", "R19:", "EVIDENCE: pending"], "readiness gates");
  console.log("readiness gate verification passed");
} else if (mode === "walk-away") {
  const charter = read("docs/production-readiness/WALK-AWAY-CHARTER.md");
  assertIncludes(charter, [
    "## Safe default",
    "Dev only",
    "read-only and report-only",
    "## Evidence folder",
    "## Stop conditions",
    "## Morning report",
    "passwords, tokens",
  ], "walk-away charter");
  console.log("walk-away charter verification passed");
} else if (mode === "links") {
  const currentState = read("docs/current-state.md");
  const consolidated = read("docs/consolidated-open-items-plan.md");
  const handoff = read("CODEX_HANDOFF.md");
  for (const [label, text] of [["current state", currentState], ["consolidated plan", consolidated], ["handoff", handoff]]) {
    assertIncludes(text, ["docs/production-readiness/PLAN.md", "Production"], label);
  }
  console.log("readiness link verification passed");
} else {
  throw new Error("usage: node scripts/verify-production-readiness-plan.mjs <plan|gates|walk-away|links>");
}
