import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import process from "node:process";

const mode = process.argv[2];
const migrationPaths = [
  "supabase/migrations/20260829124215_published_player_mvp_tally_presentations.sql",
  "supabase/migrations/20260829130253_index_player_mvp_tally_foreign_keys.sql",
  "supabase/migrations/20260829131126_harden_player_mvp_tally_audience.sql",
];

const fail = (message) => {
  console.error(message);
  process.exit(1);
};

const run = (command, args) => {
  const result = spawnSync(command, args, { stdio: "inherit", shell: process.platform === "win32" });
  if (result.status !== 0) process.exit(result.status ?? 1);
};

if (mode === "migration") {
  const sql = migrationPaths.map((path) => readFileSync(path, "utf8")).join("\n");
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
  ];
  for (const marker of required) {
    if (!sql.toLowerCase().includes(marker.toLowerCase())) fail(`Missing migration security marker: ${marker}`);
  }
  if (/grant\s+(insert|update|delete|all)[^;]*mvp_tally_(presentations|sessions|recipients)[^;]*authenticated/i.test(sql)) {
    fail("Authenticated browser role has a direct tally lifecycle write grant.");
  }
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
    "scripts/verify-mvp-tally-feature.mjs",
  ]);
  console.log("MVP_TALLY_LINT_OK");
} else if (mode === "typecheck") {
  run("npx", ["tsc", "--noEmit"]);
  console.log("MVP_TALLY_TSC_OK");
} else if (mode === "build") {
  run("npm", ["run", "build"]);
  console.log("MVP_TALLY_BUILD_OK");
} else {
  fail("Usage: node scripts/verify-mvp-tally-feature.mjs migration|tests|lint|typecheck|build");
}
