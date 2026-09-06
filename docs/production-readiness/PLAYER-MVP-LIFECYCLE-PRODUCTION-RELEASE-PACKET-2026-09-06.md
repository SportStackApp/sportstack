# Player MVP lifecycle Production release packet — 6 September 2026

## Decision

**Status: revalidated after safe live-data drift; fresh exact approval is required. The earlier
approved attempt stopped before any Production change.**

This is a one-migration follow-up to the Player MVP tally release already running in Production.
It fixes the confirmed lifecycle defect where sessions past their voting deadline remain stored as
`OPEN`, while the tally builder correctly accepts only stored `CLOSED` sessions.

## Exact package

- Production base: `15223e9f72f36307c1e09d96a1b1bdb9472f6d72`
- Candidate: `a1d23c741b79de02c32763a879597192a1c1ebd5`
- Candidate branch: `codex/player-mvp-lifecycle-production-slice`
- Commit count: exactly one
- Changed paths: exactly one
- Migration:
  `supabase/migrations/20260905131718_restore_player_mvp_voting_lifecycle_after_production_slice.sql`
- Migration Git blob: `cbb7558a68af1270acd02a1f4da60e736b42263e`

The package contains no application, dependency, Edge Function, Auth, Storage, secret, DNS or
workflow file. It does not include the currently red Production scraper workflow or its Dev-only
blank-round repair.

## Migration behaviour

The additive migration:

1. creates `private.close_due_mvp_voting_sessions()`;
2. changes overdue `OPEN` sessions to `CLOSED`, or `RESULT_DISPUTED` when the current result-check
   round has an incorrect response;
3. records one audit row for every reconciled session;
4. creates `private.enforce_mvp_voting_deadline()` and two triggers that reject post-deadline vote
   and submission writes;
5. revokes both private functions from `public`, `anon` and `authenticated`;
6. schedules one `close-due-player-mvp-voting` database job every minute using `cron.schedule()`;
7. immediately reconciles sessions already past their deadline.

It does not create or invoke an email, notification, HTTP or Edge Function path. The current
Supabase guidance was checked: the migration uses `cron.schedule()`/`cron.unschedule()` rather than
writing directly to `cron.job`, keeps `SECURITY DEFINER` functions in the private schema, sets an
empty search path and revokes browser-role execution.

## Current read-only Production pre-flight

The guarded pre-flight passed on 6 September without creating a backup or changing Production:

- Git, public bundle and Supabase project match Production `15223e9`;
- Production Supabase is healthy;
- candidate migration state is pending;
- migration dry-run identifies the one approved migration;
- logical backup tooling is available;
- current public asset is `/assets/index-BVOMObE4.js`;
- 647 Player MVP sessions;
- 355 overdue `OPEN` sessions;
- 5 `CLOSED` sessions;
- 0 `RESULT_DISPUTED` sessions;
- 0 overdue sessions with a current-round incorrect result check;
- 41 Player MVP audit rows;
- 24 notifications;
- 341 Player MVP email-event rows;
- 96 teams with Player MVP email enabled;
- one tally presentation and 26 tally recipients;
- no lifecycle function, deadline function, lifecycle trigger or closure job currently exists.

The guard detected the audit count moving from 40 to 41 before release and stopped before creating
a backup or applying the migration. Read-only inspection confirmed the new row is a legitimate
`AUTO_OPEN` for a Pumas session opened on 6 September Melbourne time, closing on 9 September and
not overdue. All other protected counts remain unchanged. The reviewed baseline was therefore
advanced only to 41 audit rows; the expected post-migration audit count is 396.
The same session's normal opening sent 13 configured voting emails between 03:08:04 and 03:08:13
Melbourne time, advancing the email-event baseline from 328 to 341. Those sends occurred before the
release and are unrelated to the lifecycle migration; the guard still requires no email-event
change while the migration is applied.

Any count or object drift makes the release script stop for re-review.

## Structured patch-risk review

The exact commit range `15223e9..a1d23c7` has patch SHA-256
`03bc9457e45cc6f3061f0219efb41ad97464d8337655ffb8cba1165a116dc9dd`.

- Recommendation: **merge**, with workflow label **human review required**.
- Impact if wrong: **high**, because the migration changes persistent Production state and adds
  privileged triggers plus a recurring job.
- Regression likelihood: **low**, because the exact migration passed the Production-derived
  lifecycle rehearsal and the release guard binds the live baseline and after-state.
- Regression protection: **strong**; exact-head verification, wrong-root negative control,
  guarded-script self-test, live pre-flight and the exact migration rehearsal pass.
- Recoverability: **managed**, because application rollback is simple but reversing reconciled
  session and audit rows needs the verified backup or point-in-time recovery and explicit approval.
- Confidence: **high**. The review's JSON satisfies the Codex Security patch-risk schema.

Automatic release is prohibited by the migration, persistent-state, privileged-boundary and
architecture-specific rollout exclusions. The review supports offering the frozen package to Aaron;
it does not grant Production authority.

## Rehearsal evidence

The exact candidate migration blob is unchanged from the Production-derived lifecycle rehearsal in
`docs/production-readiness/PLAYER-MVP-LIFECYCLE-PRODUCTION-BACKUP-REHEARSAL-2026-09-05.md`.

That rehearsal produced:

| Measure | Before | After |
| --- | ---: | ---: |
| Overdue `OPEN` sessions | 355 | 0 |
| `CLOSED` sessions | 5 | 360 |
| `RESULT_DISPUTED` sessions | 0 | 0 |
| Audit rows | 40 | 395 |
| Notifications | 24 | 24 |
| Player MVP email events | 328 | 328 |
| Teams with Player MVP email enabled | 96 | 96 |

Transactional rollback, isolated real apply, idempotence, trigger rejection, job/function creation
and browser-role denial passed. The rehearsal's 29 managed Auth/Storage restore errors and local
Storage compatibility scaffold are disclosed in the durable evidence. They do not affect this
public-table lifecycle migration, but the rehearsal must not be described as a fully faithful
hosted Auth/Storage restore.

## Guarded release tooling

Use only `scripts/release-player-mvp-lifecycle-production.ps1` for this candidate.

The script pins the exact Production base, candidate branch, candidate commit, migration path and
migration blob. It verifies the Git identity and GitHub account, rejects tracked candidate changes,
requires exactly one allowed changed path, checks Production's public bundle and project, compares
the exact pre-release counts, creates and hashes a new logical backup, applies only the approved
migration, checks the exact data deltas, then fast-forwards `prod` and verifies the deployed bundle.

Its local self-test proves that a wrong confirmation, an unexpected changed path and a changed email
count all stop the release.

Read-only pre-flight:

```powershell
pwsh -NoProfile -File scripts/release-player-mvp-lifecycle-production.ps1 -Mode Preflight
```

The future release command is intentionally recorded but must not run without Aaron's fresh exact
approval:

```powershell
pwsh -NoProfile -File scripts/release-player-mvp-lifecycle-production.ps1 `
  -Mode Release `
  -Confirmation "RELEASE PLAYER MVP LIFECYCLE a1d23c7 TO PRODUCTION"
```

The confirmation phrase is approval for this candidate only. A different commit, migration blob,
Production base or pre-flight result requires a new review and approval.

## Release order

1. Re-fetch Production and candidate refs and rerun the read-only pre-flight.
2. Confirm Production still reports the exact pending counts and no lifecycle objects.
3. Obtain Aaron's exact approval phrase for candidate `a1d23c7`.
4. Run the guarded release script. It must create and hash a fresh roles, schema and data backup
   before applying the migration.
5. Apply only migration `20260905131718`.
6. Verify zero overdue `OPEN`, 360 `CLOSED`, 396 audit rows, one closure job, two triggers, unchanged
   notifications/email settings and the recorded migration version.
7. Fast-forward `prod` from `15223e9` to `a1d23c7` without rewriting history.
8. Verify the Production bundle contains `a1d23c7`, the tally UI remains present and only the
   Production Supabase project is referenced.
9. Complete the owner smoke test during the agreed rollback window.

## Rollback boundary

- Before database apply: stop with no Production change.
- After a migration or count-verification failure: do not push `prod`. Preserve evidence and seek
  Aaron's direction. Do not improvise destructive SQL.
- After database success but before the branch push: the current Production application remains
  compatible with the additive lifecycle objects. Stop and investigate.
- After branch push: the application code is unchanged from `15223e9`; only its displayed commit
  marker differs. Revert the Production deployment only under an explicitly pre-approved rollback
  instruction.
- Reversing the 355 session-status changes or 355 audit rows is a separate destructive recovery
  decision. Use the verified backup or point-in-time recovery only with explicit approval.

## Post-release smoke test

1. Confirm the Player MVP admin page shows past-deadline sessions only as **Closed**.
2. Confirm all expected closed Pumas rounds are available to the tally builder.
3. Preview a tally without publishing it to real players.
4. Confirm current vote totals and round order are unchanged.
5. Confirm no new notification or Player MVP email-event row was queued by the migration.
6. Observe at least one closure-job interval and confirm no new overdue `OPEN` session remains.
7. If publication is approved separately, use the already nominated Grampians recipients, keep
   external email disabled, verify recipient access/unrelated denial, then withdraw the test tally
   with an audit reason.

## Deliberate exclusions and separate blockers

- The Production scraper workflow is excluded and remains red due to blank round numbers.
- Main's 259-commit/434-path backlog and its 115 added migrations are excluded.
- All Edge Functions and workflow changes are excluded.
- Dev-only disposable-account helpers are excluded.
- Coordinator testing is not a dependency of this migration-only package because no application,
  permission or role path changes. It remains an open whole-product readiness gate.
- The broader Production migration reconciliation remains required for any later whole-Main
  release; this slice does not claim to solve it.

## Approval boundary

Preparation, self-tests, read-only pre-flight and rehearsal evidence do not authorise Production.
Aaron's fresh exact approval is required before any Production database change or `prod` push.
