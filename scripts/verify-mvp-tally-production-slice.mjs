import { readFileSync } from "node:fs";

const migrationPath =
  "supabase/migrations/20260905040425_add_manual_player_mvp_tally_presentations.sql";
const source = readFileSync(migrationPath, "utf8");
const executableSql = source
  .replace(/\/\*[\s\S]*?\*\//g, " ")
  .replace(/^\s*--.*$/gm, " ");

const fail = (message) => {
  console.error(`MVP_TALLY_PRODUCTION_SLICE_FAILED: ${message}`);
  process.exit(1);
};

const requiredMarkers = [
  "create table public.mvp_tally_presentations",
  "create table public.mvp_tally_sessions",
  "create table public.mvp_tally_recipients",
  "alter table public.mvp_tally_presentations enable row level security",
  "alter table public.mvp_tally_sessions enable row level security",
  "alter table public.mvp_tally_recipients enable row level security",
  "create or replace function public.publish_mvp_tally(p_presentation_id uuid)",
  "create or replace function public.withdraw_mvp_tally",
  "insert into public.notifications",
  "'MVP_TALLY_PUBLISHED'",
  "'mvp-tally-assets'",
  "p_commentary ->> 'source' <> 'RULES'",
];

for (const marker of requiredMarkers) {
  if (!executableSql.toLowerCase().includes(marker.toLowerCase())) {
    fail(`missing required marker: ${marker}`);
  }
}

const forbiddenPatterns = [
  [/scheduled_for/i, "scheduled publication"],
  [/\bSCHEDULED\b/i, "scheduled status"],
  [/publish_due_mvp_tallies/i, "background tally publisher"],
  [/close_due_mvp_voting_sessions/i, "Player MVP session closer"],
  [/enforce_mvp_voting_deadline/i, "Player MVP deadline trigger"],
  [/email_(delivery|status|sent)/i, "email delivery state"],
  [/cron\./i, "cron scheduling"],
];

for (const [pattern, description] of forbiddenPatterns) {
  if (pattern.test(executableSql)) fail(`contains excluded ${description}`);
}

if (/grant\s+(insert|update|delete|all)[^;]*mvp_tally_(presentations|sessions|recipients)[^;]*authenticated/i.test(executableSql)) {
  fail("authenticated browser role has a direct tally lifecycle write grant");
}

const publishSignatures = [
  ...executableSql.matchAll(/create\s+or\s+replace\s+function\s+public\.publish_mvp_tally\s*\(([^)]*)\)/gi),
];
if (publishSignatures.length !== 1 || publishSignatures[0][1].trim().toLowerCase() !== "p_presentation_id uuid") {
  fail("manual publisher must have exactly one UUID-only signature");
}

console.log("MVP_TALLY_PRODUCTION_SLICE_OK");
