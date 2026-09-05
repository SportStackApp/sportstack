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

Vercel reports the candidate preview deployment `dpl_6hYjdHD8yPJ7cr7xzEqvh7ugKVuZ` READY. Its
public bundle returns HTTP 200, contains `15223e9` and the manual tally UI, and is connected only to
the Dev project as expected for a preview. Current Production deployment
`dpl_BxfnnYSLbrrgkxTsuu5mgxf5vV5S` is READY at `682b8ea`; the Production domain returns HTTP 200,
contains only the Production project reference and does not contain the tally bundle. This is the
captured application rollback target.

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
229 errors and 50 warnings, with zero focused-file findings.

## Hosted staging rehearsal

The owner-provided isolated Supabase project `SportStack-staging` (`fdkgcwacuqoswnatvubv`) was
confirmed active and empty before use. Three migrations are recorded there:

1. `production_tally_dependencies_baseline` — focused empty Production-compatible dependencies and
   two sentinel rows for rehearsal only;
2. `add_manual_player_mvp_tally_presentations` — the exact frozen candidate migration; and
3. `harden_rehearsal_dependency_scaffold` — hosted-staging-only RLS and privilege hardening for the
   dependency scaffold, not part of the Production release.

The hosted transaction completed with `HOSTED_MANUAL_PLAYER_MVP_TALLY_REHEARSAL_PASS`. It exercised
manager build, preview, manual publish and withdrawal; one in-app notification; recipient access;
unrelated-account denial; duplicate-publish denial; rule commentary; 3-2-1 results; and manager
Storage scope. The transaction rolled back cleanly: presentations, notifications and temporary
rehearsal helpers are all zero, while the OPEN-session and association-setting sentinels are
unchanged.

Post-test checks confirm all public tables have RLS enabled, all three tally tables have RLS, direct
authenticated writes to the tally presentation table are denied, only the manual one-argument
publish RPC exists, and no scheduling, email-delivery or background voting-lifecycle state was
introduced. Security advisers report 14 no-policy INFO items on locked rehearsal-only dependency
tables and six expected warnings for the authenticated `SECURITY DEFINER` tally RPCs. Those RPCs
are intentional guarded API endpoints; their manager and recipient authorisation paths passed the
transactional test. Performance advisers report INFO only (22 scaffold foreign-key indexes and six
unused indexes in the new empty project).

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

## Pinned release command

Use only `scripts/release-player-mvp-tally-production.ps1` for this package. The older
`scripts/release-production.ps1` is Umpire-Portal-specific and must not be reused. The tally script
pins:

- Production base `682b8eaba33f657a2c64dcce571a40e0b2b0ba00`;
- release commit `15223e9f72f36307c1e09d96a1b1bdb9472f6d72`;
- the exact 14-path allow-list;
- migration `20260905040425_add_manual_player_mvp_tally_presentations.sql` and Git blob
  `883d3f30cfc5aabec02826aa31896eb45262f310`; and
- Production Supabase project `svierarfcolhcfjpmwck`.

Its `Preflight` mode is read-only. It verifies Git identity/account, frozen remote refs, migration
content, the static slice verifier, public Production bundle, scoped Supabase access, dependency
drift, remote migration history, a one-migration dry-run and backup command availability. `Release`
requires the exact phrase `RELEASE PLAYER MVP TALLY TO PRODUCTION`, creates and hashes separate
roles/schema/data dumps, applies only the approved migration, rechecks drift, fast-forwards `prod`
without rewriting history and verifies the deployed bundle. Its manifest records the Vercel
rollback deployment above. Wrong-confirmation and wrong-candidate tests both stop safely.
PowerShell parsing and release-order assertions pass. Repository TypeScript and Production build
also pass; full lint remains exactly the accepted 343-error/77-warning baseline and has no finding
for the new PowerShell file.

The tally-specific access file is now configured outside the repository with Windows encryption.
The replacement token can see healthy SportStack Production. The pinned read-only pre-flight passed
on 5 September 2026: the frozen Git package and public rollback baseline matched, Production schema
drift was limited to the one approved pending tally migration, the migration dry-run passed, backup
metadata was available and the logical-backup command was ready. No backup was created and no
Production state changed.

The secure configuration and repeatable pre-flight commands are:

```powershell
pwsh -NoProfile -File scripts/release-player-mvp-tally-production.ps1 -Mode ConfigureAccess
pwsh -NoProfile -File scripts/release-player-mvp-tally-production.ps1 -Mode Preflight
```

## Remaining approval blockers

The Production smoke identities are nominated:

- manager: the existing Admin Sportstack Super Admin account;
- recipients: Chloe Wilson and Aaron Mullane; and
- both recipients are active, non-placeholder Pumas members. Aaron's personal account has only the
  Player role, so it cannot run the builder. This slice cannot queue external email.

1. Give separate explicit approval for the exact frozen `prod` change and Production migration.
2. Confirm acceptance of the unchanged Production dependency debt for this narrow release, while
   keeping its remediation as a separately tested package.

**Readiness decision: the narrow manual Player MVP tally candidate is built, locally and hosted-
staging rehearsed, and has passed the final read-only Production pre-flight. Production itself
remains unchanged and approval-gated.**
