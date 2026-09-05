import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import process from "node:process";

const mode = process.argv[2];
const migrationPaths = [
  "supabase/migrations/20260829124215_published_player_mvp_tally_presentations.sql",
  "supabase/migrations/20260829130253_index_player_mvp_tally_foreign_keys.sql",
  "supabase/migrations/20260829131126_harden_player_mvp_tally_audience.sql",
  "supabase/migrations/20260829150000_refine_player_mvp_tally_presentations.sql",
  "supabase/migrations/20260829170000_dedupe_mvp_tally_audience.sql",
  "supabase/migrations/20260905131718_restore_player_mvp_voting_lifecycle_after_production_slice.sql",
];

const lifecycleMigrationPath =
  "supabase/migrations/20260905131718_restore_player_mvp_voting_lifecycle_after_production_slice.sql";

const fail = (message) => {
  console.error(message);
  process.exit(1);
};

const run = (command, args) => {
  const result = spawnSync(command, args, { stdio: "inherit", shell: process.platform === "win32" });
  if (result.status !== 0) process.exit(result.status ?? 1);
};

const verifyMigration = () => {
  const sql = migrationPaths.map((path) => readFileSync(path, "utf8")).join("\n");
  const lifecycleSql = readFileSync(lifecycleMigrationPath, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/^\s*--.*$/gm, " ");
  const required = [
    "create table public.mvp_tally_presentations",
    "create table public.mvp_tally_sessions",
    "create table public.mvp_tally_recipients",
    "alter table public.mvp_tally_presentations enable row level security",
    "grant select on table public.mvp_tally_presentations to authenticated",
    "revoke all on function public.publish_mvp_tally",
    "private.mvp_tally_source_fingerprint",
    "private.publish_due_mvp_tallies",
    "publish-due-player-mvp-tallies",
    "PLAYER_MVP_RESULTS",
    "MVP_TALLY_AUDIENCE_CHANGED",
    "validate_mvp_tally_replacement",
    "mvp_tally_presentations_created_by_idx",
    "private.close_due_mvp_voting_sessions",
    "CLOSED_AT_DEADLINE",
    "enforce_mvp_voting_deadline_on_votes",
    "mvp-tally-assets",
    "ballotsReceived",
    "eligibleVoterCount",
    "leaderboardLimit",
    "commentary_snapshot",
    "save_mvp_tally_commentary",
    "close-due-player-mvp-voting",
    "bool_or(membership.membership_type",
  ];
  for (const marker of required) {
    if (!sql.toLowerCase().includes(marker.toLowerCase())) fail(`Missing migration security marker: ${marker}`);
  }
  if (/grant\s+(insert|update|delete|all)[^;]*mvp_tally_(presentations|sessions|recipients)[^;]*authenticated/i.test(sql)) {
    fail("Authenticated browser role has a direct tally lifecycle write grant.");
  }
  for (const marker of [
    "create or replace function private.close_due_mvp_voting_sessions()",
    "create or replace function private.enforce_mvp_voting_deadline()",
    "enforce_mvp_voting_deadline_on_votes",
    "enforce_mvp_voting_deadline_on_submissions",
    "close-due-player-mvp-voting",
    "select private.close_due_mvp_voting_sessions();",
  ]) {
    if (!lifecycleSql.toLowerCase().includes(marker.toLowerCase())) {
      fail(`Missing lifecycle reconciliation marker: ${marker}`);
    }
  }
  if (/public\.notifications|email_queue|send_email|http_request|net\.http/i.test(lifecycleSql)) {
    fail("Lifecycle reconciliation contains an outbound notification or email path.");
  }
};

if (mode === "migration") {
  verifyMigration();
  console.log("MVP_TALLY_MIGRATION_OK");
} else if (mode === "tests") {
  run("npx", ["vitest", "run", "src/features/player-mvp-tally/logic.test.ts"]);
  console.log("MVP_TALLY_TESTS_OK");
} else if (mode === "lint") {
  run("npx", [
    "eslint",
    "src/features/player-mvp-tally",
    "src/pages/admin/MvpTallyAdmin.tsx",
    "src/pages/MvpTallyPresentationPage.tsx",
    "src/pages/MvpVotes.tsx",
    "src/pages/admin/MvpVotingAdmin.tsx",
    "src/components/profile/NotificationPreferencesSection.tsx",
    "src/App.tsx",
    "supabase/functions/sportstack-notification-dispatch/index.ts",
    "supabase/functions/mvp-tally-commentary/index.ts",
    "scripts/verify-mvp-tally-feature.mjs",
  ]);
  console.log("MVP_TALLY_LINT_OK");
} else if (mode === "typecheck") {
  run("npx", ["tsc", "--noEmit"]);
  console.log("MVP_TALLY_TSC_OK");
} else if (mode === "build") {
  run("npm", ["run", "build"]);
  console.log("MVP_TALLY_BUILD_OK");
} else if (!mode) {
  verifyMigration();
  const presentation = readFileSync("src/features/player-mvp-tally/MvpTallyPresentation.tsx", "utf8");
  const admin = readFileSync("src/pages/admin/MvpTallyAdmin.tsx", "utf8");
  const logic = readFileSync("src/features/player-mvp-tally/logic.ts", "utf8");
  const edge = readFileSync("supabase/functions/mvp-tally-commentary/index.ts", "utf8");
  for (const marker of ["TALLY_SPEEDS", "frameDelayMs", "limitLeaderboard", "buildRuleCommentary", "Jump to", "Players shown", "Upload logo", "ballotsReceived", "store: false", "Aggregate data"]) {
    if (![presentation, admin, logic, edge].some((source) => source.includes(marker))) fail(`Missing feature marker: ${marker}`);
  }
  if (edge.includes("voter_profile_id") || edge.includes("token_id")) fail("AI commentary function contains voter identity fields.");
  console.log("Player MVP tally feature verification passed");
} else {
  fail("Usage: node scripts/verify-mvp-tally-feature.mjs migration|tests|lint|typecheck|build");
}
