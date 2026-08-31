import { spawnSync } from "node:child_process";
import process from "node:process";

const readLimit = (name) => {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? Number(process.argv[index + 1]) : Number.NaN;
  if (!Number.isInteger(value) || value < 0) {
    console.error(`Usage: node scripts/verify-lint-baseline.mjs --max-errors <count> --max-warnings <count>`);
    process.exit(2);
  }
  return value;
};

const maxErrors = readLimit("--max-errors");
const maxWarnings = readLimit("--max-warnings");
const result = spawnSync(process.execPath, ["node_modules/eslint/bin/eslint.js", ".", "--format", "json"], {
  encoding: "utf8",
  maxBuffer: 128 * 1024 * 1024,
});

if (result.error) {
  console.error(`Unable to run ESLint: ${result.error.message}`);
  process.exit(2);
}

let report;
try {
  report = JSON.parse(result.stdout || "[]");
} catch {
  console.error("ESLint did not return valid JSON.");
  process.exit(2);
}

const totals = report.reduce(
  (current, file) => ({
    errors: current.errors + Number(file.errorCount || 0),
    warnings: current.warnings + Number(file.warningCount || 0),
    fatalErrors: current.fatalErrors + Number(file.fatalErrorCount || 0),
  }),
  { errors: 0, warnings: 0, fatalErrors: 0 },
);

console.log(`ESLint measured ${totals.errors} errors and ${totals.warnings} warnings (${totals.fatalErrors} fatal).`);

if (totals.fatalErrors > 0 || totals.errors > maxErrors || totals.warnings > maxWarnings) {
  console.error(`Lint baseline exceeded: allowed at most ${maxErrors} errors and ${maxWarnings} warnings.`);
  process.exit(1);
}

console.log("lint baseline verification passed");
