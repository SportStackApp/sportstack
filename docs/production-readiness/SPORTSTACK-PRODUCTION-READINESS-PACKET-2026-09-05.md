# SportStack Production readiness packet — 5 September 2026

## Decision

**Status: not ready for Production approval.**

The Player MVP lifecycle repair is verified on Dev and staged on Main, but the whole Main branch
cannot safely be merged directly to Production. Historical migration drift needs an explicit
Production-baseline reconciliation, and the current Coordinator permission bundle still lacks an
authenticated browser result.

Production remains unchanged at `15223e9f72f36307c1e09d96a1b1bdb9472f6d72`.

## Frozen environment evidence

| Environment | Commit | Deployment result |
| --- | --- | --- |
| Dev | `b8687ec4fc61d58b6411d136ce40ead81cd09c95` | Dev Quality `33969370123` passed; Vercel `dpl_5jLMPt2QRJxUaxYGkvhR7vipNn4V` READY |
| Main staging | `e6fda0fdc8b2e048bac5fa5891713fc9c22040c5` | Vercel `dpl_4vYVWVeH6Sd5djYSHEyfKmq63nnW` READY |
| Production | `15223e9f72f36307c1e09d96a1b1bdb9472f6d72` | unchanged during this run |

The Dev and Main public bundles contain their recorded short commit. Signed-out Main checks for
the Player MVP admin and presentation routes redirect to Login with the correct return path and no
observed browser error.

## What was completed

- Production's unique Player MVP tally commit is now an ancestor of Dev/Main. Conflict resolution
  retained the more complete Dev tally implementation and the Production admin entry point.
- Additive migration
  `20260905131718_restore_player_mvp_voting_lifecycle_after_production_slice.sql` restores the
  deadline closure function, write trigger, one-minute scheduled job, permissions and immediate
  reconciliation after either historical tally path.
- Live Dev reports zero overdue `OPEN` Player MVP sessions, 362 `CLOSED`, one closure job and two
  deadline triggers. A second closure call processed zero rows.
- Live Dev notification count remained 957 and Player MVP email-event count remained 34 across the
  migration. No unintended outbound email work was queued.
- The named-final blank-round scraper repair passed 21 focused tests and one public RevSports
  fixture check on Dev.
- The frozen Dev candidate passed 46 Vitest files/181 tests, TypeScript, Production build, the tally
  feature verifier and the accepted full-lint ceiling of 343 errors/77 warnings.
- Main passed the focused tally verifier and 13 affected tests.

Recent Player MVP presentation playback, responsive, keyboard, reduced-motion, access-denial and
Axe evidence was reused because the relevant runtime files are unchanged since accepted Dev commit
`5338c0a`. The changed admin entry route was reopened. Unchanged line-up, coaching, Safety Hub,
sorting and role results were not repeated.

## Current Production database position

Read-only checks found:

- 647 Player MVP sessions: 355 overdue `OPEN`, 5 `CLOSED`, 287 `PENDING` and none disputed;
- one draft tally presentation with 26 recipient rows;
- 40 Player MVP audit rows;
- 24 notifications;
- 328 Player MVP email-event rows;
- 96 teams with Player MVP email enabled;
- no Player MVP deadline closure function, deadline function, closure job or deadline triggers;
- Production-only migration `20260905040425` is recorded; the earlier broad Dev tally migrations
  are not recorded.

These are reconciliation expectations, not authorisation to change Production.

## Production-derived lifecycle rehearsal

The 5 September logical Production backup was restored into an isolated local database. The exact
Production tally migration was applied before the additive lifecycle migration. Twenty-nine restore
errors were confined to managed Auth/Storage schemas whose local image version differed from the
hosted backup. Public SportStack data restored, and a minimal local-only Storage compatibility
scaffold allowed the tally migration to apply. This validates the application-data lifecycle path;
it is not a completely faithful hosted Auth/Storage restore.

Expected and observed lifecycle result:

| Measure | Before | After |
| --- | ---: | ---: |
| Overdue `OPEN` sessions | 355 | 0 |
| `CLOSED` sessions | 5 | 360 |
| Audit rows | 40 | 395 |
| Notifications | 24 | 24 |
| Player MVP email events | 328 | 328 |
| Teams with email enabled | 96 | 96 |

The transaction rolled back exactly. A separate isolated real apply passed, a second closure call
processed zero rows, disputed sessions were protected, post-deadline vote/submission writes were
rejected, and browser roles could not execute the private closure function.

Sanitised durable evidence is retained at
`docs/production-readiness/PLAYER-MVP-LIFECYCLE-PRODUCTION-BACKUP-REHEARSAL-2026-09-05.md`.

## Exact broad-package inventory

Production is an ancestor of Main. The current Production-to-Main difference contains:

- 259 commits;
- 434 changed paths;
- 115 migration files added on Main;
- one Production-only migration, `20260905040425`, applied in Production but absent from Main's
  fuller historical tree;
- 15 changed Edge Function files;
- three changed workflow files;
- 221 changed application paths under `src`.

The earlier exhaustive inventory at
`docs/production-readiness/PLAYER-MVP-TALLY-PRODUCTION-INVENTORY-2026-09-01.md` covers the first 228
commits, 398 paths, 111 migrations, 12 Edge Function files and three workflows. The later
Main-candidate delta contains 32 commits and 81 paths, including these four migrations:

1. `20260904153312_make_primary_team_change_atomic.sql`
2. `20260904155953_harden_primary_team_change_writes.sql`
3. `20260904160251_scope_primary_team_change_reads.sql`
4. `20260905131718_restore_player_mvp_voting_lifecycle_after_production_slice.sql`

It also contains the three tracked `update-user-details` Edge Function files. The overlap of 228
and 32 reflects their shared reconciliation merge; the authoritative whole-delta figures are the
259-commit and 434-path counts above.

## Proven migration blocker

A broad sequential test used the Production-derived isolated database with external networking
disabled. The first three newly added migrations applied. Migration
`20260801013000_harden_field_template_grants.sql` then failed because
`public.field_templates` does not exist in Production.

This is historical live-schema drift, not a Player MVP lifecycle defect. It proves that filename
order alone is not a safe Production deployment method. Do not mark all 115 migration files as
applied and do not edit old migration history to bypass the failure.

## Required curated Production package

Create a new release branch from Production `15223e9`, then deliberately bring across only reviewed
Production-compatible application and database changes. Before freezing it:

1. Map each of the 115 added migration files to one of: already reflected in Production, required
   and safe to apply, replaced by a later reconciliation migration, Dev-only, or excluded.
2. Preserve Production's recorded `20260905040425` tally slice. Do not reapply or rewrite it.
3. Add only new reconciliation migrations where the live Production schema needs a compatible
   bridge. Apply the lifecycle restoration migration after the tally slice and its required
   dependencies.
4. Inventory each Edge Function by name and version. Deploy only functions used by the curated app
   package, after their database dependencies are present.
5. Deploy the application after database and function verification.
6. Freeze exact hashes for the branch, migration allow-list, function allow-list and application
   build before asking for approval.

## Explicit exclusions

The Production package must exclude unless Aaron separately approves them:

- `.github/workflows/production-scrapers.yml` and the named-final blank-round workflow repair;
- any Production-capable workflow or secret-selector change;
- Dev-only reserved-account provisioning migrations, helpers and Edge Functions;
- staging scaffolds and local rehearsal helpers;
- unrelated backlog improvements not required by the curated application package.

The named-final repair remains on Dev. Its four affected workflow/script/test paths were restored to
their prior Main versions before Main was staged. The broader Production scraper workflow already
differs from Production in other ways, so exclude the entire file rather than only one new line.

The latest four Production Supabase Scrapers runs—`33932103274`, `33945079394`, `33955841032` and
`33965158128`—failed. The latest failure log confirms blank `TARGET_ROUND_NUMBER` values. Therefore
the workflow is currently red; the Dev-only fix does not make the Production workflow ready.

## Backup and deployment order

Before any future Production change:

1. Re-run read-only branch, Vercel, Supabase project and migration-history checks.
2. Capture and verify a fresh logical backup of roles, schema and data, plus current function/job
   definitions and reconciliation counts.
3. Run the exact curated migration allow-list in a transaction against a fresh Production-derived
   isolated database, then run a real isolated apply and idempotence check.
4. Apply approved database migrations in the frozen order.
5. Verify counts, permissions, triggers and scheduled jobs before deploying Edge Functions.
6. Deploy and verify only the frozen Edge Function allow-list.
7. Deploy the frozen application commit.
8. Run the post-release smoke below inside the agreed rollback window.

## Rollback points

- **Before database apply:** stop with no Production change.
- **After a migration failure:** stop application/function deployment. Use the verified backup or
  point-in-time recovery procedure only with explicit owner approval; do not improvise destructive
  reversal statements.
- **After database success but before application:** leave the compatible additive database objects
  in place, investigate, and do not advance.
- **After application deployment:** redeploy the recorded prior Production build only if that exact
  rollback instruction was explicitly pre-approved with the release. Otherwise stop and obtain
  Aaron's approval. Database rollback remains a separate recovery decision because session closures
  and audit rows are real data changes.

The existing 5 September pre-tally backup is valuable rehearsal evidence, but a new backup is
required immediately before the future release.

## Post-release smoke test

Use the nominated Grampians/Pumas manager and recipient identities with external email disabled:

1. Confirm overdue sessions display only as **Closed** and are selectable in the tally builder.
2. Build and preview a clearly labelled test presentation from closed rounds.
3. Publish only to the nominated recipients and confirm no external email event is queued.
4. Open the in-app notification deep link as a recipient.
5. Confirm an unrelated disposable account is denied.
6. Verify the 3-2-1 reveal, rankings, shared ranks, podium, pause/resume, replay, skip, speed and
   refresh persistence.
7. Withdraw the test presentation with an audit reason.
8. Observe at least one closure-job interval and confirm no new overdue `OPEN` session remains.

## Open blockers

1. The 115-file Production migration reconciliation map and curated Production-baseline branch do
   not yet exist. The deterministic `field_templates` failure prevents direct Main promotion.
2. Coordinator access has no current actual-role browser result. The controlled browser is signed
   out and the reserved account helper cannot provision the direct Coordinator permission bundle.
3. The exact Production Edge Function allow-list still depends on the curated application package.
4. The entire Production scraper workflow must remain excluded or receive its own explicit review
   and approval.
5. The exact excluded-path allow-list has not yet been frozen against the curated branch.

## Other open programme readiness gates

The lean run does not close the broader whole-product readiness ledger. These gates remain open and
must either pass or receive an explicit owner-approved deferral before a whole-Dev Production
release:

- R1: complete route, table and form registers with current owners/results;
- R2-R3: every known Blocker/High repair and each Medium repair or accepted deferral;
- R4-R5: complete sorting and persistence contracts across the remaining registered screens;
- R6: actual-role Coordinator acceptance;
- R7-R8: remaining high-risk responsive and route/error/keyboard states;
- R13: complete read-only walk-away evidence with no unresolved High operational finding;
- R16: exact application, migration, function, job and workflow reconciliation;
- R17: complete curated-package rehearsal and recovery proof;
- R18: workflow health or an explicitly accepted exception—the Production scraper workflow is
  currently failing;
- R19: Aaron's approval of the later exact frozen package;
- R20: Production smoke and scheduled-job observation after an approved release.

The Player MVP-specific aim can use a deliberately narrower curated Production package, but that
package and every excluded path still need to be exact before its own approval decision.

## Approval boundary

No Production approval is requested by this packet. After the blockers are resolved, present a new
frozen commit and exact allow-lists to Aaron. Any Production commit, push, deployment, database,
Auth, Storage, Edge Function, secret, DNS or workflow change still requires Aaron's fresh explicit
approval.
