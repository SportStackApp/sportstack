import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const productionCommit = "15223e9f72f36307c1e09d96a1b1bdb9472f6d72";
const candidateCommit = "a1d23c741b79de02c32763a879597192a1c1ebd5";
const candidateBranch = "codex/player-mvp-lifecycle-production-slice";
const migrationPath =
  "supabase/migrations/20260905131718_restore_player_mvp_voting_lifecycle_after_production_slice.sql";
const migrationBlob = "cbb7558a68af1270acd02a1f4da60e736b42263e";
const expectedRemote = "https://github.com/SportStackApp/sportstack.git";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const defaultCandidateRoot = resolve(scriptDirectory, "..", "..", "sportstack-mvp-lifecycle-release");
const candidateArgument = process.argv.indexOf("--candidate-root");
const candidateRoot = resolve(
  candidateArgument >= 0 && process.argv[candidateArgument + 1]
    ? process.argv[candidateArgument + 1]
    : defaultCandidateRoot,
);

const git = (...args) =>
  execFileSync("git", ["-C", candidateRoot, ...args], { encoding: "utf8" }).trim();

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};

assert(git("remote", "get-url", "origin") === expectedRemote, "Unexpected Git remote.");
assert(git("rev-parse", "HEAD") === candidateCommit, "Candidate worktree is not at the frozen commit.");
assert(
  git("rev-parse", `origin/${candidateBranch}`) === candidateCommit,
  "Remote candidate branch is not at the frozen commit.",
);
assert(git("rev-parse", "origin/prod") === productionCommit, "Production branch moved; re-review required.");
assert(git("rev-parse", `${candidateCommit}^`) === productionCommit, "Candidate is not one commit above Production.");
assert(git("rev-list", "--count", `${productionCommit}..${candidateCommit}`) === "1", "Candidate is not a one-commit slice.");

const changedPaths = git("diff", "--name-only", `${productionCommit}..${candidateCommit}`)
  .split(/\r?\n/)
  .filter(Boolean);
assert(
  JSON.stringify(changedPaths) === JSON.stringify([migrationPath]),
  `Candidate allow-list mismatch: ${changedPaths.join(", ")}`,
);
assert(
  git("rev-parse", `${candidateCommit}:${migrationPath}`) === migrationBlob,
  "Migration blob differs from the rehearsed content.",
);

const sql = readFileSync(resolve(candidateRoot, migrationPath), "utf8");
const compactSql = sql.replace(/\s+/g, " ").toLowerCase();
for (const required of [
  "create or replace function private.close_due_mvp_voting_sessions()",
  "create or replace function private.enforce_mvp_voting_deadline()",
  "set search_path = ''",
  "create trigger enforce_mvp_voting_deadline_on_votes",
  "create trigger enforce_mvp_voting_deadline_on_submissions",
  "revoke all on function private.close_due_mvp_voting_sessions() from public, anon, authenticated",
  "revoke all on function private.enforce_mvp_voting_deadline() from public, anon, authenticated",
  "perform cron.schedule(",
  "select private.close_due_mvp_voting_sessions();",
]) {
  assert(compactSql.includes(required), `Required lifecycle control is missing: ${required}`);
}

for (const forbidden of [
  "net.http",
  "http_post",
  "notifications",
  "email_event",
  "supabase.functions",
  "create table",
  "alter table",
  "drop table",
]) {
  assert(!compactSql.includes(forbidden), `Forbidden release behaviour found: ${forbidden}`);
}

console.log("PLAYER_MVP_LIFECYCLE_PRODUCTION_SLICE_OK");
