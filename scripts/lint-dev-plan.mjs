import { execFileSync, spawnSync } from "node:child_process";
import path from "node:path";

// These two existing pages contain the locked plan's navigation-only changes,
// but also carry older no-explicit-any debt that predates the plan. Keep the
// exclusion visible until that separate lint cleanup is approved.
const legacyLintExclusions = new Set([
  "src/pages/admin/RevSportsMappings.tsx",
  "src/pages/admin/RevSportsUnmatched.tsx",
]);

// These files were already carrying no-explicit-any debt when the owner-test
// remediation package started. They still run every other lint rule below,
// and the focused check rejects any new explicit `any` added by this package.
const legacyExplicitAnyDebt = new Set([
  "src/pages/Games.tsx",
  "src/pages/Profile.tsx",
  "src/pages/admin/AdminDashboard.tsx",
  "src/pages/admin/Analytics.tsx",
  "src/pages/admin/DivisionsManagement.tsx",
  "src/pages/admin/UsersManagement.tsx",
  "src/pages/coaching/CoachingSquad.tsx",
]);

// Locked starting point for the SportStack Owner-Test Remediation Plan.
// DEV_PLAN_BASE remains available for an intentional future re-baseline.
const baseRef =
  process.env.DEV_PLAN_BASE || "9352d2458f026767961412352a4687bd953799c1";
let changedFiles;

try {
  changedFiles = execFileSync(
    "git",
    [
      "diff",
      "--name-only",
      "--diff-filter=ACMR",
      `${baseRef}...HEAD`,
      "--",
      "*.ts",
      "*.tsx",
    ],
    { encoding: "utf8" },
  )
    .split(/\r?\n/u)
    .filter(Boolean);
} catch {
  console.error(
    `Could not compare this branch with ${baseRef}. Fetch the main branch and try again.`,
  );
  process.exit(1);
}

const lintFiles = changedFiles.filter((file) => !legacyLintExclusions.has(file));
const excludedFiles = changedFiles.filter((file) =>
  legacyLintExclusions.has(file),
);
const legacyDebtFiles = lintFiles.filter((file) => legacyExplicitAnyDebt.has(file));
const strictFiles = lintFiles.filter((file) => !legacyExplicitAnyDebt.has(file));

if (excludedFiles.length > 0) {
  console.log(`Known legacy exclusions: ${excludedFiles.join(", ")}`);
}

if (lintFiles.length === 0) {
  console.log(`No TypeScript files differ from ${baseRef}.`);
  process.exit(0);
}

console.log(`Linting ${lintFiles.length} development-plan TypeScript files.`);
const eslintBin = path.resolve("node_modules", "eslint", "bin", "eslint.js");
const runEslint = (files, extraArgs = []) => {
  if (files.length === 0) return 0;
  const result = spawnSync(
    process.execPath,
    [eslintBin, ...files, "--quiet", ...extraArgs],
    { stdio: "inherit" },
  );
  return result.status ?? 1;
};

const strictStatus = runEslint(strictFiles);
if (strictStatus !== 0) process.exit(strictStatus);

if (legacyDebtFiles.length > 0) {
  console.log(
    `Applying the recorded no-explicit-any baseline to: ${legacyDebtFiles.join(", ")}`,
  );
  const debtStatus = runEslint(legacyDebtFiles, [
    "--rule",
    "@typescript-eslint/no-explicit-any: off",
  ]);
  if (debtStatus !== 0) process.exit(debtStatus);

  const addedLines = execFileSync(
    "git",
    ["diff", "--unified=0", baseRef, "--", ...legacyDebtFiles],
    { encoding: "utf8" },
  )
    .split(/\r?\n/u)
    .filter((line) => /^\+(?!\+\+) .*\bany\b/u.test(line));

  if (addedLines.length > 0) {
    console.error("New explicit any usage was added by the remediation plan:");
    addedLines.forEach((line) => console.error(line));
    process.exit(1);
  }
}

console.log("Development-plan focused lint passed.");
