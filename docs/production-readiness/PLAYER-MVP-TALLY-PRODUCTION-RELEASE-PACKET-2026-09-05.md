# Player MVP tally Production release packet — 5 September 2026

Status: **Dev feature passes; Production package is not yet built or rehearsed**

No Production change was made during this run. In particular, repository history and read-only
database evidence confirm no `prod` or Production database mutation; no Production deployment,
Edge Function, secret, DNS or workflow action was taken.

## Frozen evidence point

- Dev application: `5338c0a75c335f89d4b20685937e4702a6d64801`
- Main/staging application: `1924404642710bf570e9bde424a09e34be181658`
- Production application: `682b8eaba33f657a2c64dcce571a40e0b2b0ba00`
- Dev Quality run: `33938772306` — passed
- Vercel Dev deployment for `5338c0a` — passed
- Dev alias and immutable deployment serve the same bundle, and a refreshed Dev screen displays
  `v2026.09.05+5338c0a`; the immutable deployment is
  `https://sportstack-i3bbxl3h9-sportstackapps-projects.vercel.app`
- Production-to-Dev distance: 243 commits, 435 changed paths, 114 migration files,
  15 Edge Function files and 3 workflow files
- Main-to-Dev distance: 15 commits and 74 changed paths

The Dev commit is an evidence point, not an approved Production release commit. Main and Dev are
not aligned, and neither broad branch can be promoted safely for this single feature.

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

There is no existing safe tally-only commit or migration allow-list. The smallest preferred slice
must be engineered from the Production baseline with these deliberate limits:

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

It also needs one new consolidated Production-safe migration that creates the three tables,
required private/public functions, indexes, triggers, grants, RLS and Storage policies without
scheduling work, changing existing sessions, changing team settings or queueing email. Supabase
types must be regenerated from the rehearsed schema. Expected Edge Function and workflow count is
zero.

Source behaviour must be extracted and reviewed from `882c30c`, the tally-only parts of `1faf79f`,
`71af047`, `1924404`, `40409af`, `6c87ae1`, `1bb7621` and `5338c0a`; these commits must not be cherry-picked
whole without reviewing their non-tally changes.

## Full-behaviour alternative

Keeping scheduling, AI commentary and tally email delivery expands the package to at least
11 runtime files, a separate scheduler-activation migration, a tally-only notification dispatcher,
a corrected commentary Edge Function and substantially more failure modes. The current dispatcher
also contains unrelated Player Explorer and Coordination changes, and the commentary function does
not allow the Production origin. This alternative is not recommended for the first Grampians
release.

## Mandatory isolated rehearsal

The narrow package must be applied to a fresh Production-derived, non-production environment.
Before and after the rehearsal, prove that the 355 OPEN sessions and 96 team flags are unchanged.
Then test:

1. manager create/preview/publish/withdraw access;
2. recipient-only RLS, unrelated-user denial and withdrawn access denial;
3. exact RPC grants and Storage policies;
4. one in-app notification with no email work row;
5. idempotent publication and safe retry behaviour;
6. desktop, tablet and mobile playback, keyboard use, reduced motion and Axe;
7. console, failed requests, TypeScript, build, focused lint and the full test suite; and
8. a complete before/after schema diff and rollback rehearsal.

Docker Desktop was running locally, but its Linux engine did not answer three bounded
`docker info/version` checks. The isolated rehearsal was therefore **BLOCKED**, not passed. No
hosted Supabase branch or extra paid project was created.

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

1. Repair or replace the unavailable local Docker rehearsal environment, or approve a separate
   non-production Supabase rehearsal environment and its cost.
2. Build and independently review the narrow Production-baseline branch and consolidated migration.
3. Complete the isolated rehearsal and generate Supabase types from its final schema.
4. Update `scripts/release-production.ps1` with the exact narrow allow-list and prove it refuses
   everything else.
5. Nominate the Production Grampians test manager and recipient and confirm Production email off.
6. Give separate explicit approval for the exact frozen `prod` change and Production migration.

**Readiness decision: Dev presentation behaviour passes. Production release remains blocked until
the narrow package is built and rehearsed.**
