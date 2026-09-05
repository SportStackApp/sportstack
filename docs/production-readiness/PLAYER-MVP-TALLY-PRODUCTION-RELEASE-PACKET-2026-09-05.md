# Player MVP tally Production release packet — 5 September 2026

Status: **Production-baseline candidate built and rehearsed; explicit Production approval pending**

No Production change was made during this run. In particular, repository history and read-only
database evidence confirm no `prod` or Production database mutation; no Production deployment,
Edge Function, secret, DNS or workflow action was taken.

## Frozen evidence point

- Dev application: `5338c0a75c335f89d4b20685937e4702a6d64801`
- Main/staging application: `1924404642710bf570e9bde424a09e34be181658`
- Production application: `682b8eaba33f657a2c64dcce571a40e0b2b0ba00`
- Narrow release candidate: `15223e9b` on
  `codex/player-mvp-tally-production-slice`, based directly on the Production commit above
- Dev Quality run: `33938772306` — passed
- Vercel Dev deployment for `5338c0a` — passed
- The immutable code deployment
  `https://sportstack-i3bbxl3h9-sportstackapps-projects.vercel.app` serves
  `v2026.09.05+5338c0a`. The Dev alias served the same bundle when this application evidence was
  frozen; later documentation-only commits may advance the alias build label without changing the
  tested tally code.
- Production-to-Dev distance: 243 commits, 435 changed paths, 114 migration files,
  15 Edge Function files and 3 workflow files
- Main-to-Dev distance: 15 commits and 74 changed paths

The Dev commit remains the deployed acceptance evidence. Main and Dev are not aligned, and neither
broad branch can be promoted safely for this single feature. The narrow candidate is independently
frozen from the exact Production baseline and has not been merged to or deployed from `prod`.

## Current Dev acceptance

The labelled presentation `fbaef8ee-724b-458f-896e-f24939feceee` was tested against Pumas with
9 closed rounds and exactly one reserved disposable Player recipient.

- Pumas `mvp_notifications_enabled` was confirmed false before publication.
- The publish created one in-app notification and left the recipient email state `NOT_QUEUED`.
- The Player notification deep link opened the full-screen tally.
- An unrelated reserved Voter received `Tally unavailable` from the same direct URL.
- Withdrawal immediately removed Player access and retained the row with an audit reason.
- Desktop `1440x900`, tablet `820x1180` and mobile `390x844` had no horizontal page overflow.
- Pause, resume, replay, skip, speed, round jumping, reduced motion and keyboard activation passed.
- Visible keyboard focus passed. The full-screen route and embedded preview each had zero
  confirmed Axe violations.
- The final podium was Fraser Cullen 71, Traiyth Leffler 63 and Glen Cosgriff 60.
- After deployment of `1bb7621`, both authorised and denied routes had no captured 4xx/5xx request
  and no console error. The expected denied query now uses `maybeSingle()`. Final review then found
  and fixed stale unavailable state when a route ID changes in place; `5338c0a` adds the regression.
- The Player and Voter sessions were explicitly signed out, their disposable accounts were reset
  to fresh unshared passwords, and the clipboard was cleared.

Current code gates: 46 Vitest files/181 tests passed; the tally migration verifier and 11 focused
tally tests passed; TypeScript and the Production build passed. Full lint remains exactly at the
accepted baseline of 343 errors and 77 warnings.

## Fresh Production reconciliation

Read-only checks on 5 September found that Production still lacks:

- `mvp_tally_presentations`, `mvp_tally_sessions` and `mvp_tally_recipients`;
- all eight public tally RPCs;
- the `mvp-tally-assets` bucket;
- `mvp-tally-commentary`; and
- both tally-related cron jobs.

Production already has the required base tables, columns, enum values, `pg_cron`, `pgcrypto`, the
dedupe index and the compatible `mvp_can_manage_team` helper with authenticated execution. The
broad advanced-permission migration set is therefore not a tally prerequisite.

Fresh impact counts are:

- 355 overdue OPEN Player MVP sessions would match the broad staged closure migration;
- all 96 teams still have inherited email-on values with no audited opt-in; and
- Pumas is the only team with Player MVP enabled, but its Production email flag is also on.

Those counts replace the older packet's 341-session snapshot. They are evidence against promoting
the full staged migration history for a presentation-only release.

## Smallest safe release design

The smallest safe slice has now been engineered from the Production baseline with these deliberate
limits:

- manual publication only;
- rule-based commentary only;
- in-app notification only;
- no scheduling UI or publication cron;
- no tally email queueing or email dispatcher change;
- no voting-session closure behaviour;
- no bulk team-notification update; and
- no Dev test-account objects.

Expected application surface is 10 runtime files:

1. `src/App.tsx`
2. `src/features/player-mvp-tally/MvpTallyPresentation.tsx`
3. `src/features/player-mvp-tally/PublishedMvpTallies.tsx`
4. `src/features/player-mvp-tally/api.ts`
5. `src/features/player-mvp-tally/logic.ts`
6. `src/features/player-mvp-tally/types.ts`
7. `src/pages/MvpTallyPresentationPage.tsx`
8. `src/pages/MvpVotes.tsx`
9. `src/pages/admin/MvpTallyAdmin.tsx`
10. `src/pages/admin/MvpVotingAdmin.tsx`

It includes one new consolidated Production-safe migration that creates the three tables,
required private/public functions, indexes, triggers, grants, RLS and Storage policies without
scheduling work, changing existing sessions, changing team settings or queueing email. Supabase
access is intentionally isolated behind a generic RPC boundary, so the broad generated client types
do not need to be replaced from a partial rehearsal schema. Edge Function and workflow count is zero.

The frozen candidate contains 10 runtime files, two focused test files, one static allow-list
verifier and migration
`20260905040425_add_manual_player_mvp_tally_presentations.sql`. The verifier rejects scheduling,
email state, session-closing/deadline functions, cron and direct authenticated lifecycle writes.

Source behaviour must be extracted and reviewed from `882c30c`, the tally-only parts of `1faf79f`,
`71af047`, `1924404`, `40409af`, `6c87ae1`, `1bb7621` and `5338c0a`; these commits must not be cherry-picked
whole without reviewing their non-tally changes.

## Accepted pre-existing dependency debt

The narrow candidate does not change `package.json` or `package-lock.json`. A fresh
`npm audit --omit=dev` on the Production baseline nevertheless reports 14 existing runtime-tree
findings: 1 low, 1 moderate and 12 high. Most have dependency updates available; `xlsx` reports no
npm fix. This is not caused or expanded by the tally slice, but it must remain visible as accepted
Production debt and receive a separate exposure-and-upgrade review. Do not run an automatic bulk
dependency fix as part of this release.

## Full-behaviour alternative

Keeping scheduling, AI commentary and tally email delivery expands the package to at least
11 runtime files, a separate scheduler-activation migration, a tally-only notification dispatcher,
a corrected commentary Edge Function and substantially more failure modes. The current dispatcher
also contains unrelated Player Explorer and Coordination changes, and the commentary function does
not allow the Production origin. This alternative is not recommended for the first Grampians
release.

## Mandatory isolated rehearsal

The narrow package was applied to a fresh local Supabase environment containing faithful empty
recreations of the live Production objects it depends on, plus sentinel existing session and
notification-setting rows. The earlier attempt to replay all historical migrations was abandoned
safely because it exposed unrelated migration-history drift; live schema metadata, not an unreliable
full migration replay, was used for the focused baseline. The rehearsal tested:

1. manager create/preview/publish/withdraw access;
2. recipient-only RLS, unrelated-user denial and withdrawn access denial;
3. exact RPC grants and Storage policies;
4. one in-app notification with no email work row;
5. idempotent publication and safe retry behaviour;
6. desktop, tablet and mobile playback, keyboard use, reduced motion and Axe;
7. console, failed requests, TypeScript, build, focused lint and the full test suite; and
8. transaction rollback and before/after sentinel checks.

The focused reset applied both migrations successfully. The transactional test ended with
`MANUAL_PLAYER_MVP_TALLY_REHEARSAL_PASS`; local public/private schema lint reported no errors. It
proved one in-app notification, recipient-only access, unrelated-account denial, manager-only
write access, withdrawal denial, rules-only commentary, 3-2-1 results, RLS, Storage upload scope and
unchanged sentinel session/settings. Focused application lint passed, 2 files/11 tests passed,
TypeScript and the Production build passed. Full Production-baseline lint remains existing debt at
229 errors and 50 warnings, with zero focused-file findings. No hosted Supabase branch or extra paid
project was created.

## Release and rollback sequence after rehearsal

1. Freeze a new narrow release commit based on the exact Production baseline.
2. Verify backup/PITR availability and capture a readable backup manifest, current Vercel
   deployment and current Edge Function metadata.
3. Re-run the Production read-only impact counts. Stop on unexplained drift.
4. Apply only the rehearsed consolidated schema migration. Confirm no existing session, team flag,
   cron job or notification row changed.
5. Deploy the narrow application commit and verify the displayed commit and Production project.
6. Run the authorised Production smoke with one nominated Grampians test recipient and email off.
7. Withdraw the smoke presentation and retain its audit row.

Rollback before any migration is simply to stop. After the additive schema migration, leave new
objects dormant and roll the application back to the captured Vercel deployment; do not drop tables
during an incident. If any existing row or job changes, stop writes and use only the rehearsed
targeted reversal or owner-approved backup/PITR process.

## Remaining approval blockers

1. Capture a fresh authenticated Production backup/PITR manifest and re-run the read-only drift
   counts immediately before release.
2. Prepare a release command or script pinned only to `15223e9b` and the single consolidated
   migration; the existing Umpire release script must not be reused.
3. Nominate the Production Grampians test manager and recipient and confirm the intended audience
   before the smoke publication. This slice cannot queue email.
4. Give separate explicit approval for the exact frozen `prod` change and Production migration.
5. Confirm acceptance of the unchanged Production dependency debt for this narrow release, while
   keeping its remediation as a separately tested package.

**Readiness decision: the narrow manual Player MVP tally candidate is built, locally rehearsed and
ready for final Production pre-flight. Production itself remains unchanged and approval-gated.**
