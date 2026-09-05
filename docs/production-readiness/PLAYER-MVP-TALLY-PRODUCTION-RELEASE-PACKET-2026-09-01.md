# Player MVP Vote Tally Production release packet — 1 September 2026

Status: **application candidate tested on Dev and Main; Production release blocked pending backend rehearsal and owner approval**

Production, `prod`, Production database, Production Edge Functions, secrets, DNS and Production
workflows were not changed during this run.

## Frozen candidate

- Main application commit: `1924404642710bf570e9bde424a09e34be181658`
- Production branch commit: `682b8eaba33f657a2c64dcce571a40e0b2b0ba00`
- Main displayed deployed version: `v2026.08.31+1924404`
- Dev displayed deployed version: `v2026.08.31+1924404`
- Production-to-Main distance: **228 commits**
- Production-to-Main changed paths: **398**
- Candidate migration files: **111**
- Candidate Edge Function files: **12**
- Candidate GitHub workflow files: **3**
- Exact commit and path inventory:
  `PLAYER-MVP-TALLY-PRODUCTION-INVENTORY-2026-09-01.md`

This candidate must be re-frozen and the inventory regenerated if Main changes.

## Outcome of the readiness run

The Player MVP Vote Tally presentation itself is ready for a Production rehearsal:

- Dev and Main serve the tested application commit.
- The embedded builder preview and full-screen Player route have zero confirmed Axe violations.
- Desktop `1440x900`, tablet `820x1180` and mobile `390x844` have no horizontal page overflow and
  keep the playback controls usable.
- The 3-2-1 reveal produced Bonnie Arnel 3, Glen Cosgriff 2 and Luke Rudolph 1 for the selected test
  round; the final ranking and podium were correct.
- Pause, resume, replay, skip, round jump, speed, keyboard activation, visible focus, reduced motion
  and final-frame persistence passed.
- A reserved disposable Player received the in-app notification and its deep link opened the tally.
  A reserved unrelated Voter was denied the direct link.
- Two disposable presentations were published and then withdrawn with audit reasons. Their rows are
  retained as withdrawn Dev evidence rather than deleted:
  - Dev end-to-end: `096a67db-0cf4-4ea2-80db-eb1f75f5d942`
  - Main application smoke using the shared Dev database:
    `770a6607-5f4c-4355-a9dd-456f9bee1124`
- Full Vitest passed with 33 files and 129 tests. TypeScript, Production build, focused lint, the
  tally migration verifier and Dev Quality run `33393069833` passed.
- Full lint remains exactly at the accepted legacy baseline of 349 errors and 77 warnings, with no
  new finding from this batch.

This does **not** prove the Production database can accept the full staged backend. Main and Dev
share the Dev database, so the Main smoke test proves the Main application bundle, not Production
schema compatibility.

## Live Production reconciliation

Read-only checks against SportStack Production `svierarfcolhcfjpmwck` found:

- `public.mvp_tally_presentations` is absent.
- `public.mvp_tally_sessions` is absent.
- `public.mvp_tally_recipients` is absent.
- The eight public tally functions are absent:
  `get_mvp_tally_builder_data`, `save_mvp_tally_draft`, `preview_mvp_tally`,
  `publish_mvp_tally`, `withdraw_mvp_tally`, `claim_mvp_tally_notification_work`,
  `complete_mvp_tally_notification_work` and `save_mvp_tally_commentary`.
- Production has `sportstack-notification-dispatch` version 1 and
  `mvp-voting-email-reminders` version 6.
- Production does not have `mvp-tally-commentary`.

The same read-only checks against Dev found all three tables, all eight public functions,
`sportstack-notification-dispatch` version 8, `mvp-voting-email-reminders` version 7 and
`mvp-tally-commentary` version 1.

The five repository tally migrations and their Dev live-history equivalents are:

| Required order | Repository file | Dev live version |
|---:|---|---|
| 1 | `20260829124215_published_player_mvp_tally_presentations.sql` | `20260829030046` |
| 2 | `20260829130253_index_player_mvp_tally_foreign_keys.sql` | `20260829030328` |
| 3 | `20260829131126_harden_player_mvp_tally_audience.sql` | `20260829031234` |
| 4 | `20260829150000_refine_player_mvp_tally_presentations.sql` | `20260829050838` |
| 5 | `20260829170000_dedupe_mvp_tally_audience.sql` | `20260829054406` |

The different timestamps are migration-history drift. The live schema is authoritative. These
files must not be pushed blindly merely because Production does not list their repository versions.

## Why a tally-only cherry-pick is rejected

A tally-only cherry-pick is not an approved release path.

- The tally migrations call the staged Player MVP permission helpers, read staged Player MVP
  session and ballot structures, extend notification preferences and enqueue notification work.
- Recipient delivery depends on the staged notification dispatcher and email-reminder behaviour.
- Optional commentary depends on the new `mvp-tally-commentary` function.
- Production and Dev migration histories have diverged, so selecting only the five filenames would
  not prove their prerequisites or resulting grants, RLS policies and function bodies.
- Main is a 228-commit staged package, not an isolated tally branch. Cherry-picking the frontend
  would make the application expect database objects that Production does not have.

The release decision must therefore use a reconciled, rehearsed Production package. If Aaron wants
a smaller release, it must be designed and tested as a separate dependency-complete package first.

## Confirmed non-additive migration impact

The 111-file candidate is **not** an additive-only database package. Read-only Production counts
using the exact migration predicates on 31 August found:

- `20260820203326_default_player_mvp_notifications_off.sql` would immediately change
  `mvp_notifications_enabled` from true to false for **96 teams** whose value has no matching
  audited opt-in event.
- `20260829150000_refine_player_mvp_tally_presentations.sql` would immediately process **341**
  overdue OPEN Player MVP sessions. None currently has an INCORRECT result check, so all 341 would
  be closed by the migration as written.
- `20260829124215_published_player_mvp_tally_presentations.sql` creates and immediately activates
  the one-minute `publish-due-player-mvp-tallies` cron job.
- The same refine migration creates a one-minute `close-due-player-mvp-voting` cron job and calls
  the closure function immediately. A fresh read-only Production query found neither candidate
  job currently exists.

Those are intentional Dev behaviours, but they are material Production data/scheduler changes.
They require explicit owner acceptance, before-value capture, a maintenance window and a tested
reversal/forward-fix procedure. The published and refine migrations must not be applied unchanged
to Production: the Production reconciliation must separate schema creation from both scheduler
activations and the one-time data transition, using new reviewed migration(s) rather than
rewriting migration history.

The candidate also contains database migrations whose only purpose is disposable Dev testing. The
Production allow-list must explicitly exclude these five files, or document a proven dependency
and a Production-safe replacement:

- `20260802105000_transactional_dev_account_and_role_guards.sql`
- `20260802109000_authorise_dev_test_provisioning_session.sql`
- `20260802231405_reserved_dev_test_account_lookup.sql`
- `20260803090000_scope_reserved_umpire_voter_accounts.sql`
- `20260820213845_fix_dev_umpire_account_scope.sql`

The associated `provision-dev-test-account` Edge Function is also excluded. A dependency scan must
prove that every later Production migration and application path remains valid without these Dev
objects.

## Required Production rehearsal

The following rehearsal is mandatory before approval:

1. Create an isolated rehearsal environment from a fresh Production schema and representative
   data backup. Do not rehearse against live Production.
2. Compare the live Production schema, grants, RLS policies, functions and migration history with
   the 111 candidate migration files listed in the inventory appendix.
3. Produce an explicit mapping for migrations already represented in Production under older names
   or versions. Mark them satisfied; do not replay them.
4. Classify every candidate migration as already represented, Production schema-only,
   Production data-changing, Production scheduler/job, Dev-only excluded, or deferred. No
   unclassified migration may enter the allow-list.
5. For every data-changing migration, run the exact predicate as a read-only count, export the
   complete before-values for affected keys/rows, define the expected after-count and rehearse a
   targeted reversal or forward fix. The 96 notification flags and 341 overdue sessions above are
   mandatory named cases.
6. For every scheduler migration, capture the existing job definition, rehearse the job in a
   disabled/quiesced state, then activate it only as a separate checkpoint after data review. The
   tally refine migration's immediate schedule-and-run block cannot be used unchanged.
7. Apply only the classified unresolved migrations in dependency order to the rehearsal copy. The
   five tally migrations must retain their logical order, with the published and refine migrations
   represented by reviewed Production-safe splits that do not activate either cron job inline.
8. Capture before/after schema diffs, migration output, row counts, RLS checks, function signatures
   and cron state. Any unapproved data or scheduler change stops the rehearsal.
9. Deploy the approved rehearsal Edge Functions and confirm their JWT and secret requirements.
   Exclude the five Dev-only database migrations and `provision-dev-test-account`, then prove
   downstream compatibility without them.
10. Deploy the frozen Main application to the rehearsal target and repeat the recipient/denial,
   playback, withdrawal, accessibility, console and network smoke tests.
11. Rebuild the exact Production allow-list from the successful rehearsal and independently review
   it before Aaron is asked for approval.

## Backup requirements for an approved release

Before the first Production write:

- confirm the exact Production project and current application deployment;
- confirm point-in-time recovery availability and retention, or record that it is unavailable;
- create fresh roles, schema and data logical backups from Production;
- include all non-public schemas needed by Auth, Storage metadata and application functions;
- verify every backup is non-empty and readable, record file sizes and SHA-256 checksums, and save
  a manifest with the frozen commit and database project reference;
- capture current Production Edge Function source/version metadata and the current Vercel
  deployment ID so each can be restored independently;
- export the complete before-values for every row identified by a data-changing migration dry-run,
  including the 96 team notification flags and 341 overdue Player MVP sessions;
- capture existing cron definitions and disable/quiesce affected jobs during the migration window;
- record a storage-object inventory if the approved package changes the tally-assets bucket or its
  policies; and
- stop if the backup cannot be independently verified.

The existing `scripts/release-production.ps1` is not ready for this package. It is intentionally
pinned to the earlier Umpire Portal release, allows only two Umpire migrations and one Edge
Function, and must refuse the current 111-migration/12-function-file diff. A separately reviewed
release-tool update is required; do not broaden its allow-list during the release itself.

## Proposed release order after rehearsal and approval

1. Freeze Main again and confirm `prod` is still its clean ancestor.
2. Re-run every application check and the read-only Production pre-flight.
3. Create and verify the fresh Production backup set and rollback manifest.
4. Quiesce the affected Player MVP workflow and scheduler path. Verify that no ballot, manager or
   background-job write can race the captured before-values.
5. Apply the schema-only classified allow-list in the rehearsal-proven order. Stop at every
   checkpoint and confirm the expected schema/function state before continuing.
6. Apply each owner-approved data transition separately. Check the dry-run count still matches the
   approved count; otherwise stop. Verify after-counts and preserve the before-value export.
7. Apply the five logical tally stages in the order recorded above, if they are not already
   represented by an approved live-history mapping. Use reviewed Production-safe replacements for
   the published and refine migrations so neither scheduler is silently activated inline.
8. Activate `publish-due-player-mvp-tallies` only after the publication functions, notification
   queue and worker path pass their checks. Activate `close-due-player-mvp-voting` only after the
   341-session transition is separately approved, executed and checked. Treat these as two
   independent checkpoints and record each exact cron definition and first-run result.
9. Verify the three tally tables, all public/private functions, indexes, triggers, RLS policies,
   grants, notification category and tally-assets policies.
10. Deploy only the approved Edge Functions. For the tally path, deploy supporting changes first,
   then `sportstack-notification-dispatch`, `mvp-voting-email-reminders` and
   `mvp-tally-commentary`. Confirm each version and health before continuing.
11. Fast-forward `prod` to the exact approved Main commit and allow the Vercel Production deployment.
12. Confirm the deployed version, Supabase project reference and absence of Dev configuration.
13. Run the Production smoke tests below while the rollback window remains open.

No step may select Production secrets or schedules that were not in the approved allow-list.

## Rollback points

- **Before migrations:** stop with no Production change.
- **After schema-only migrations but before data transitions:** do not drop new objects. Leave them
  dormant, restore the previous Edge Function versions if necessary and stop.
- **After the notification-setting transition:** restore only the affected team values from the
  verified before-value export if the agreed product behaviour is rejected or the after-count is
  wrong. Do not update teams outside that captured key set.
- **After the overdue-session transition:** keep Player MVP writes quiesced. A targeted row/audit
  reversal is allowed only if the rehearsal proves it and no later ballot, result-check or manager
  activity occurred. Otherwise stop and use an owner-approved forward fix or PITR/full restore;
  do not guess former statuses.
- **After either scheduler activation:** unschedule the affected
  `publish-due-player-mvp-tallies` or `close-due-player-mvp-voting` job and restore the captured
  prior cron state before any database reversal. Production currently has neither job.
- **After Edge Functions:** redeploy the captured prior function versions. If the tally worker is
  new, disable its callers and leave the additive function dormant rather than deleting it during
  the incident.
- **After application deployment:** use the captured prior Vercel deployment for immediate traffic
  rollback, then make an ordinary reviewed revert/forward-fix commit. Do not rewrite Git history.
- **Database data corruption:** stop writes and use the verified backup/PITR procedure only with
  Aaron's explicit incident approval. A full restore can overwrite newer legitimate data and is not
  the default rollback for this mixed schema/data/scheduler package.

There is no dedicated Production tally feature flag currently proven. Application rollback plus
dormant schema objects is safe only before data transitions. Once the 96 team flags, 341 sessions
or either cron schedule changes, the matching targeted rollback/forward-fix evidence is mandatory. A
rehearsed kill switch would reduce release risk and remains a gap.

## Post-release Production smoke tests

Use an explicitly authorised Production test team and recipient; Dev disposable accounts are not
Production authority.

1. Confirm the Production footer displays the approved commit and the browser uses Production
   Supabase.
2. As an authorised manager, build a clearly labelled test tally from a closed round, select one
   recipient, preview it and publish with external email disabled for the test identity.
3. Confirm the notification deep link opens for the recipient and denies an unrelated authorised
   test identity.
4. Verify 3-2-1 progression, totals, ties/shared rank, podium, refresh persistence, pause/resume,
   replay, skip, speed, reduced motion and keyboard operation.
5. Run Axe on the embedded preview and full-screen route and check console, failed resources and
   horizontal overflow at desktop, tablet and mobile sizes.
6. Withdraw the presentation with an audit reason and prove access is removed while the withdrawn
   row remains retained.
7. Observe notification dispatch, email-reminder and application logs through the rollback window.

## Blockers requiring Aaron before Production approval

1. Approve the scope: the full reconciled staged package, or a separately engineered smaller
   dependency-complete release.
2. Approve a safe Production rehearsal environment and representative data-copy method.
3. Review and accept the exact migration reconciliation and Edge Function allow-list. Explicitly
   exclude the five Dev-only database migrations and provisioning function, and prove later
   migrations do not depend on them.
4. Approve or defer the two known data transitions: 96 inherited team notification flags and 341
   overdue Player MVP sessions. Approve the publish-due and close-due scheduler activations as two
   separate checkpoints.
5. Review the three Production-to-Main workflow files and resolve or explicitly accept the known
   Production scraper failure before a full-package release.
6. Confirm backup/PITR readiness, the rollback window and the people authorised to initiate a
   restore.
7. Nominate authorised Production smoke-test identities and scope.
8. Give separate explicit approval for the newly frozen Main commit after the rehearsal evidence,
   independent review and updated release script pass.

Until those blockers are closed, the correct readiness decision is:

**Vote Tally presentation: ready for Production rehearsal. Full Production release: not yet safe.**
