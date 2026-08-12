# Codex Handoff

Last updated: 2026-08-12

Future agents should start by reading these files in order:

1. `AGENTS.md` — repository rules, safety constraints, release path and testing expectations.
2. `docs/current-state.md` — current implementation, deployment and owner-test status.
3. `docs/project-brief.md` — concise product and architecture context.
4. `docs/scraper-operations.md` — current scraper, backup and retention routine.
5. `TECHNICAL_SPECIFICATION_AND_SYSTEM_HANDOFF.md` — fuller technical context when needed.

## 12 August 2026 Incident & Discipline Phase 1

Aaron approved a Dev-first implementation with content accuracy at least as important as page
structure. The hidden direct-address portal is implemented at `/discipline`, `/discipline/new` and
`/discipline/cases/:caseId`. It is intentionally absent from normal navigation. Production,
`main`, `prod`, domains, secrets and Production Supabase were not changed.

### Rule verification and product boundary

- The checked source set is the HB March 2026 addendum, HV 2026 Competition Rules, Regulations and
  Schedules, the linked Incident Report Form, the HB policies page and site-linked Hockey Australia
  Complaints, Disputes and Discipline Policy. Exact official addresses and SHA-256 hashes are in
  `docs/incident-discipline-phase1.md`.
- Phase 1 stops at an HB close or referral decision. Tribunal, mediation, appeal, suspension and
  publication workflows remain Phase 2. The app records guidance but never decides guilt or applies
  a penalty automatically.
- Corrected source interpretation: direct finals timing applies only when the relevant club is
  participating in that competition; 2026 investigation appeals are Rules 7.22-7.25; and direct
  Tribunal screening includes Level 3 language, vilification, Level 3 violent conduct and the
  listed unfair public personal attack.
- The current Schedules show `$500` for contempt while the linked form says `$250`. The Schedules
  amount is guidance with a visible conflict warning, not an automatic fine. The business-day
  definition and all unresolved HB local treatments keep the rule pack at `REVIEW_REQUIRED`.

### Dev implementation and security

- Seven additive local migration files from `20260812110000` to `20260812116000` are applied to
  Dev. The live migration history recorded the same seven names under application-time versions
  `20260812004524` through `20260812011829`; the exact mapping is in
  `docs/incident-discipline-phase1.md`. They add
  26 `discipline_*` tables, rule/deadline/config data, append-only audit and revision records, a
  private 20 MB `discipline-evidence` bucket and role-checking database functions. Generated
  Supabase TypeScript types were refreshed.
- Every exposed discipline table has RLS. Existing admin or committee status does not reveal case
  contents; an active case assignment is required. Portal/config access remains separate from case
  access. Creating a case atomically creates its initial people/allegation, assigns the creator as
  Case Coordinator and starts the applicable deadlines.
- The separate portal layout exposes only Cases, New case where allowed, Profile and Sign out.
  Dedicated accounts can be marked `DISCIPLINE_ONLY`; normal SportStack addresses then redirect to
  the discipline portal. This is an app restriction, not a total database sandbox, because existing
  SportStack shared directory information remains readable by signed-in users.
- The client uses authenticated security-definer RPCs intentionally. Each write rechecks the
  signed-in user and required association/case role. Supabase advisers show no discipline anonymous
  RPC warning and no discipline table without RLS; authenticated-RPC warnings are expected and
  documented. New indexes are only flagged as unused because they have no workload yet.

### Verification and remaining gate

- Migration dry-runs passed before every Dev apply. Rolled-back live tests passed case
  assignment/removal isolation, Easter public-holiday calculations, direct-finals deadlines, all
  Language/Physical/Vilification/Other classification branches and Amber fallback, atomic intake,
  natural-justice blocking, authorised override, immutable SHA-256 report snapshot and audit data.
- The sign-off test exposed an unqualified pgcrypto `digest` call; additive migration
  `20260812116000_incident_discipline_report_hash.sql` fixed it and the complete test then passed.
- The unauthenticated local browser check correctly redirected `/discipline` to sign-in. An
  authenticated owner UI pass is still required. Vercel deployment
  `dpl_F8E2PVxXxEoWGs6vMZF4V7r7gGJe` was `READY` for exact feature commit
  `b517912f6fefc1836060a4b8a6e50e7f03f06710` and was verified through the Dev alias. The Dev address
  returned HTTP 200; the deployed bundle contained the discipline route and commit label, pointed to
  SportStack Dev Supabase and did not contain the Production Supabase project reference. The first owner test is
  intentionally one small action: open the direct Dev `/discipline` address and confirm the private
  case portal appears instead of the normal SportStack layout. Later documentation-only Dev commits
  may change the displayed build label without changing the feature package.

## 11 August 2026 guided Committee workflow

Aaron approved the full Dev-only implementation of the guided Committee and subcommittee plan.
Commit `deea6c0` (`feat(committee): add guided setup workflow`) is pushed to `origin/dev`. Vercel
deployment `dpl_5TWrcvoBeJPPYEUFD3HzTvLmMhTo` is READY for exact commit
`deea6c00613712950e6a204b1152ca5994f6b6c2`; the Dev alias displayed
`v2026.08.11+deea6c0`. Production, `main`, `prod`, Production Supabase, domains and secrets were not
changed.

### Delivered

- A reusable large five-step guided pop-up now handles purpose, structure, details, optional
  positions/members and final review. Main committees support the agreed purpose presets and
  authorised Association or Club scope.
- Top-level committees can create one level of standing or temporary subcommittees. Children show
  under the parent with breadcrumbs, inherit its organisation, cannot create another level and
  keep private meetings, documents, minutes, polls and chat separate.
- The people step supports suggested and custom positions, four access presets, scoped candidate
  search, optional appointments and **Skip roles and members for now**. Presidents forums can
  preview and confirm current scoped Club Presidents; this is a fixed snapshot, not future syncing.
- Draft answers are versioned in session storage, survive reload/window switching, and require
  confirmation before discard. Submission is guarded against double clicks and step-specific
  errors are shown inline.
- Committee listing and existing appointment controls now respect scoped candidates and private
  child visibility, including a child whose parent is not visible to the ordinary appointed member.

### Dev database and security

- Applied additive Dev migrations `20260811090305_guided_committee_workflow` and
  `20260811091322_fix_guided_committee_creation_returning`. They extend `committees` with parent,
  lifecycle and close fields; restrict parent deletion; preserve closed records; block a parent
  close while children are active; and enforce inherited scope, one-level nesting and in-scope
  appointments.
- `create_committee_with_setup(jsonb,jsonb)` is authenticated, security-invoker and creates the
  committee, positions and appointments in one transaction. The follow-up migration generates IDs
  before inserts because the initial dry-run exposed an `INSERT ... RETURNING`/RLS conflict.
- Rolled-back access suites passed for Club Admin, Association Admin, parent setup manager,
  ordinary parent member and explicitly appointed child member. Atomic failure, President matching
  and fixed snapshot, inherited scope, one-level nesting, close retention and active-child close
  guard all passed. Zero rollback committees remain.
- Post-migration Supabase advisers remain at the existing broad baseline of 77 security and 493
  performance notices. The new atomic create function did not add a security-definer warning.
  Candidate and create-authorisation helpers intentionally bind authenticated users to their
  current role/scope and still require later individual adviser review with the existing baseline.

### Verification and remaining owner checks

- All 26 Vitest tests, the four focused Committee tests, changed-file ESLint, TypeScript, build and
  `git diff --check` pass. Full lint remains known baseline debt at 360 errors and 78 warnings.
- Authenticated Dev smoke passed the latest build, first two workflow steps, saved-answer recovery
  after reload, discard confirmation and a 390 px mobile layout. It did not create a real record.
- Owner/session testing remains for: the full Review/create write; Association Admin, Club Admin,
  Super Admin and parent setup-manager UI access; a real standing and temporary child; keyboard-only
  completion; President preview wording; and explicit private-member access in separate sessions.
- Exact next owner test: open **Create Committee**, choose any purpose and continue to **Review**
  without pressing the final create button. Confirm whether the wording and visual flow are clear.

## 10 August 2026 Dev repair and Supabase hardening snapshot

Aaron approved the complete Dev-only repair batch and a deeper Supabase review. Commit `a77f01a`
is pushed to `origin/dev`, Vercel deployment `dpl_EkW4715qFjkTmfzwCwHRwndRW9qn` is READY, and
`https://dev.sportstackapp.com.au` displayed build `v2026.08.10+a77f01a`. Production, `main`,
`prod`, domains, secrets and Production Supabase were not changed.

### Completed repairs

- **Club Admin scope follow-up (`77422f1`):** Aaron's actual AM account showed only a Grampians
  Hockey Club Admin assignment but the header offered every Hockey Ballarat club and retained Blaze.
  The database correctly rejected Blaze. The deployed UI now filters club options from the active
  role's authorised IDs, replaces an invalid retained club with the first assigned club, redirects
  an unauthorised club route, and starts a role change without reusing the previous role's scope.
  Vercel deployment `dpl_5VMTTeGKRFUvXLxHQxUyDYEDsCS9` is READY for exact commit `77422f1`.
  Aaron confirmed the refreshed AM Club Admin selector now behaves correctly. No database migration
  or role row change was needed.
- **AM Player multi-team owner pass:** In Player mode, Aaron confirmed both the Primary Pumas team
  and Secondary Lucas HC team are available. Lucas HC loaded and remained selected without bouncing
  back. This passes the normal Player multi-team switch; a separate account with multiple Team
  Manager role assignments is still needed to close the Team Manager-specific variant.
- Communications now retains account/channel drafts across a full reload, merges edited messages
  without duplication, paginates older messages in batches of 50, and explains that legacy edits
  may have no recorded earlier version. Three focused pagination/merge tests cover the behaviour.
  Aaron confirmed an unsent Team Chat draft survives `Ctrl + Shift + R` on Dev. He also opened an
  edited message and confirmed the dialog shows the current version plus the earlier version with
  its editor and timestamp.
- The top scope switcher now resolves all Team Manager team assignments from the complete role and
  TeamContext data instead of a fragile nested query. A real multi-club login retest is still needed.
- Coach line-up view has explicit **Remove player** and **Clear position** actions.
- Committee Meetings uses neutral wording when there are no recorded meetings, avoiding conflict
  with past meetings visible in Calendar.
- Public Umpire Match Voting candidate loading and submission validation are restricted to the
  selected fixture's two teams, selected fill-ins, line-up assignments and recorded appearances.
  Dev Edge Function `public-umpire-match-voting` version 9 is ACTIVE. A live Round 13 fixture search
  loaded the fixture candidate pool with no browser console error; no ballot was submitted.
- Dependencies were updated, including React Router, Vite and SheetJS. `npm audit` now reports zero
  vulnerabilities.

### Dev Supabase result

- Migration `20260810090000_harden_functions_and_rls_performance.sql` was first run inside a full
  transaction and rolled back successfully. It was then applied to Dev and recorded live as
  `20260810064248_harden_functions_and_rls_performance`.
- The migration fixes two mutable function search paths, removes browser-role execution from six
  trigger-only security-definer functions, converts 61 RLS auth calls to one-time init-plan form,
  and adds 33 missing foreign-key indexes. It contains no delete, drop, truncate or data rewrite.
- Security adviser notices reduced from 85 to 75. Performance adviser notices reduced from 554 to
  493. The actionable `auth_rls_initplan` group reduced from 61 to zero and the missing foreign-key
  index group reduced from 164 to 131.
- Remaining notices were deliberately not blanket-fixed: public ballot RPCs require anonymous
  access, authenticated RPC helpers require individual access review, policy consolidation can
  change permissions, and index/table cleanup would require destructive drops. Supabase leaked
  password protection remains a dashboard Auth setting to enable separately.

### Verification

- Focused changed-file ESLint, `git diff --check`, `npx tsc --noEmit` and `npm run build`: pass.
- Latest Club Admin follow-up: Vitest 22/22, focused permission-context Python 23/23, TypeScript and
  build pass. The earlier complete Python result remains 167 tests plus 29 subtests.
- Full `npm run lint` remains baseline debt at 360 errors and 78 warnings; changed files are clean.
- Vercel deployed the exact `a77f01a` commit and the Dev alias showed the matching build.

### Still open before Dev acceptance

1. Use real disposable Team Manager, Coach and Player sessions to retest the multi-club switcher,
   line-up removal and read-only line-up behaviour. Chrome automation was unavailable during the
   final pass, so these are not marked as owner/session passes.
2. Create one controlled eligible Player MVP Voting round and complete the ballot/history/analytics
   flow with email disabled.
3. Finish the remaining Safety Hub and Committee write/upload checks and responsive tablet/mobile
   review. The broader Roles & modules redesign remains parked by owner decision.
4. Review the remaining Supabase adviser groups separately before any destructive cleanup. Enable
   leaked-password protection in the Dev Auth dashboard when convenient.

## 9 August 2026 unattended Dev test snapshot

Aaron approved a Dev-only unattended actual-role and module test run. Non-blocking defects were
recorded rather than fixed. Production, `main`, `prod`, live domains, secrets and real-user
communications were not changed.

### Release and verification position

- `dev` and `origin/dev` now include commit `e38150d` (`fix(fixtures): preserve local time on admin
  save`). Vercel deployed that exact commit successfully and Dev Quality passed.
- The blocker was an unchanged Association Admin fixture edit shifting `12:15 pm` to `10:15 pm`
  because the local wall-clock value was written as UTC. The repair converts fixture form values
  through the association timezone. A browser retest kept Bobcats vs Pumas at `12:15 pm`; the Dev
  row remained `2026-08-23 02:15:00+00`.
- Verification passed: focused fixture lint, `npx tsc --noEmit`, `npm run build`, 16 Vitest tests,
  148 Python tests, `git diff --check`, Dev Quality and Vercel READY. Full lint remains the existing
  baseline of 360 errors and 78 warnings.
- No migration is included. The four documentation files changed during owner testing were
  deliberately preserved and extended in a separate documentation continuation.

### Actual-role and workflow results

| Area | Result | Evidence / remaining work |
|---|---|---|
| Team Manager route restriction | **Pass** | Direct `/admin/fixtures` returned to `/dashboard`; no fixture editor was exposed. |
| Coach | **Pass** | Correct navigation, Fixtures, Squad (25), Roster (25), Coach line-up controls and direct-admin redirect. |
| Player | **Pass** | Restricted navigation, availability persistence and click-again clearing, plus read-only published line-up. |
| Player -> Coach -> Player line-up | **Pass** | Player availability reached Coach selection; Coach assigned and saved Goalie; Player saw the published read-only position. The exact test assignment was removed and verified absent. |
| Association Admin | **Pass after blocker fix** | Correct association scope, fixture management access and unchanged fixture save. |
| Dashboard/fixtures | **Pass** | Scope links, branding, list/calendar views, byes, results and completed-game participants/statistics loaded. |
| Communications | **Partial** | Existing chat, navigation retention and notification deep-link/read state passed. A full reload clears an unsent draft; the legacy edited message opens an empty revision history; only seven messages meant earlier-page loading could not be exercised. Nothing was published. |
| Multi-club Team Manager | **Fail — parked** | Adding a temporary Lucas HC Team Manager assignment did not provide a club-switch control; the account stayed on Grampians/Pumas. The exact temporary role was removed and verified absent. |
| Player MVP Voting | **Partial** | The real Player route is correctly restricted but shows no rounds because the disposable player has no attended or selected fill-in match. No ballot or analytics write was made; eligible-player end-to-end testing remains. |
| Umpire Match Voting | **Known fail — parked** | Actual Umpire account reached the ballot. Source/live logic still builds suggestions from association-wide profiles, then leaves unrelated people without a fixture team. Required scope is the two fixture teams plus recorded participants/fill-ins. No ballot was submitted. |
| Safety Hub | **Pass, read-only** | Dashboard, Risk Register, Actions, QI Register, Bright Ideas, Matrix/Guidance, Audit History and the guided add-risk form loaded without a write. |
| Committee Management | **Pass with display note** | Calendar, Polls, Chat, Minutes and all administration tabs loaded. Calendar shows a past `Test meeting`, while Meetings says no meetings are scheduled; discuss whether that wording is intentional. Nothing was posted or changed. |

The line-up screen did not expose an obvious way to unassign a saved player; the exact Dev test row
was removed safely through its known identifier. Treat a product-facing Remove/Clear action as a
discussion item, not as evidence that cleanup failed.

### Health-check findings

- `npm audit --omit=dev`: 11 production dependency advisories — 10 high and one moderate. Direct
  packages include `react-router-dom` (fix available) and `xlsx` (no automated fix); review as a
  dedicated dependency update rather than mixing it into owner-test fixes.
- Dev Supabase: 86 applied migrations; all 16 Edge Functions report ACTIVE; the latest 100 Edge
  requests were HTTP 200. Recent Auth warnings were two deliberate invalid disposable-account
  login attempts and one disabled Google-provider attempt.
- Supabase database advisors remain baseline debt: 85 security notices (69 WARN) and 554
  performance notices (239 WARN). Dominant items are executable security-definer functions,
  unindexed foreign keys, multiple permissive policies, unused indexes and RLS init-plan costs.
  Review each against intended RPC/RLS behaviour before changing anything.
- The disposable Umpire account password was rotated after testing. No temporary credential was
  added to repository notes or retained as test evidence.

### Recommended next order

1. Review the parked findings with Aaron: multi-club scope switching, chat reload/history,
   line-up unassign, Committee meeting wording and Umpire suggestion scope.
2. Prepare an eligible Dev-only Player MVP round and complete ballot, history and analytics tests
   without sending email.
3. Run the remaining communication pagination test with at least 51 clearly disposable messages,
   or cover it with a focused automated test instead of publishing to real users.
4. Plan dependency and Supabase-advisor remediation as separate reviewed batches.
5. Only after Aaron accepts Dev, audit `dev` -> `main` divergence and promote the exact intended
   commits. Production remains separately approval-gated.

## 8 August 2026 transfer snapshot

This section is the current transfer brief. The longer sections below preserve implementation and
release detail from earlier work, but some older "pending deployment" wording has been superseded by
this snapshot.

### Repository and release position

- Checkout: `C:\Users\mulla\Projects\SportStackApp\sportstack`.
- Current branch: `dev` at `6246a48`, matching `origin/dev`.
- `origin/dev` is 70 commits ahead of `origin/main`.
- `origin/main` is 12 commits ahead of `origin/prod`.
- `origin/main` ends at `4bcb4fc`; `origin/prod` ends at `682b8ea`.
- No `main`, `prod`, Production Supabase, Production Vercel, DNS, domain, redirect or secret change
  was made during this consolidation.
- Two pre-existing local changes are intentionally unfinished and must be preserved:
  - `src/pages/admin/UsersManagement.tsx`
  - `notes/known-issues.md`
- The generated Obsidian mirror was refreshed from `origin/dev` at `6246a48` on 8 August. It cannot
  include these uncommitted files or this handoff update until they are committed and pushed.

### Active Codex task inventory reviewed

The Codex task list was reviewed on 8 August. Only this consolidation task was actively running.
The following SportStack tasks are the active or parked workstreams that another harness should
carry forward; unrelated Personal, Work and Grampians Hockey chats were excluded.

| Workstream | Current position | What remains |
|---|---|---|
| Owner-test remediation and current Dev plan | The 14-block package is implemented on Dev. Permission, navigation, dashboard, communications, both voting modules, formation, committee and Safety Hub work has extensive automated/read-only evidence. | Complete the actual-role and signed-in workflow matrix in `docs/owner-test-matrix.md`; record Pass, Fail or Needs discussion; only then decide whether Dev is accepted for `main`. |
| Users page reliability | Oversized PostgREST profile requests were fixed, committed and deployed to Dev as `6246a48`. The owner confirmed the Users page loads. | Continue the matrix from Club Admin scope. Retest Super Admin and scoped users. Resolve the rejected-mode visual mismatch where an unauthorised club such as Blaze can remain displayed. |
| Club Admin user protection | Aaron confirmed higher-level accounts may remain visible to Club Admin. On deployed `f3486b0`, Edit Details was disabled for protected higher/peer admin accounts and enabled for ordinary in-scope club users. | Treat edit protection, not account invisibility, as the acceptance rule in future tests. |
| Permissions review boundary | On 8 August Aaron discontinued the current Roles & modules review and parked the broader permission model/UI for a later dedicated pass. Existing server/RLS controls stay active. The Club Admin direct route loaded, but its menu link was absent and the club-selector check was not completed. | During other testing, fix permission failures that cause incorrect access or block the current workflow; record non-blockers for the later review. For every new feature, explicitly decide view/create/edit/approve/publish/export/manage access needs. |
| Focus persistence and scoped role display | Deployed commit `f3486b0` keeps the confirmed Users page mounted during focus rechecks. Aaron confirmed Edit Details and unsaved text survive switching windows, and the Coach row shows its Pumas scope instead of `Unassigned`. Intentional navigation may still reset page state. | Users acceptance is complete. Keep checking scoped rows during the actual-role matrix. |
| Wider focus persistence audit | Roles & Permissions still visibly refreshes when focus returns, despite the Users modal fix. Aaron chose not to interrupt the role matrix for another focus change. | Record other affected screens, then handle them together as a separate follow-up. Include an unsaved form and Safety Hub dialog, while keeping initial/revoked access fail-closed. |
| Fixtures and match presentation | Bye handling, calendar navigation, result colours/scores, completed-match participants/stats, competition ordering and Super/Association Admin-only fixture editing are on Dev through `4cc7070`. | Deployed owner retest across Association Admin, Club/Team views, byes and a scraped completed fixture. My Dashboard's separate bye formatting and any remaining availability duplicates need regression checks. |
| Team Manager scheduled fixture detail | Commits `df5b0ec` and `7d7e67f` fixed the crash, aligned availability with generated enum values, made unselected controls readable, used **Maybe** consistently, persisted responses and added click-again clearing. Dev Quality/build/148 Python tests passed, and Aaron confirmed the complete deployed behaviour. | Availability acceptance is complete. Continue the actual Team Manager lineup workflow. No migration. |
| Actual Team Manager line-up | On deployed `7d7e67f`, the Pumas Team Manager opened the Bobcats vs Pumas line-up with Coach editing controls. Player view remained visible but removed editing controls, and returning to Coach restored them. No line-up data was changed. | Team Manager line-up acceptance is complete; continue with the actual Coach account. |
| Expense Hub Stage 1 and Stage 2 | Manual expense tracking, private attachments, exports, CSV/OFX imports, PDF statement/invoice extraction, OpenAI-to-Claude fallback, approval tracking and AI activity are on Dev through `701edab`. Dev migrations/functions/RLS checks passed. | Signed-in owner smoke test using de-identified files. Before any Production release, separately approve provider privacy/region, billing limits and Production deployment. |
| Umpire Portal Production release | Public portal work and the guarded backup-first release tooling are prepared. Encrypted 30-day Vercel/Supabase access was previously verified. Production remains unchanged. | Revalidate token expiry and branch/preflight state. Production release, Turnstile/Vercel settings, migrations, function deploy and `prod` promotion require a fresh explicit owner approval. |
| Domain rollout | Corrected repository preparation is on Dev: future `hb.sportstackapp.com.au` routes to the SportStack Umpire Portal while current hosts stay unchanged. | Live Vercel, DNS, Supabase Auth redirects, Turnstile, deployment and redirect work remain separately approval-gated. Never merge/cherry-pick superseded `chore/domain-structure` commit `3a7d6cc`. |
| Coordination Module | Discovery only; no code, schema or live data changed. Recommended model uses scoped coordination permissions, separate assignable capabilities, configurable fixture/activity slots and immutable assignment history. | Write a docs-only technical specification first. Resolve Umpire identity/scope mismatches, then design RLS, multi-person atomic offers, deadlines/reminders, offer notes and roster/submission mismatch review before migrations. |
| Historical membership cleanup | New bad writes are blocked. An immutable snapshot records 201 duplicate user/team groups, 44 users with multiple Primary memberships and 490 affected rows. | Produce an exact per-person keep/remove dry run. Any cleanup is destructive and requires separate approval. |
| RevSports fixture mapping | Import safety and the main recovery block are complete. | Do not backfill fixture foreign keys yet: 162 Wimmera fixtures still lack an unambiguous `season_id` mapping. Re-run the dry-run and resolve mappings before proposing writes. |
| Production follow-up and operations | July Production compatibility release, scraper reliability release and storage cleanup completed. Forty-four intended recovery objects remained after cleanup. | Complete signed-in Production smoke testing and continue monitoring email/reminder jobs, scraper runs and organisation Storage GB-hours. Production checks remain read-only unless separately approved. |
| Parked product work | Action-level fine-grained permissions, email-template polish, advanced persistence coverage and broader visual polish remain intentionally parked. Aaron supplied a permissions UI reference: predefined/custom roles on the left, grouped screen/action/module permissions on the right, and assigned members visible. Hockey Trace remains experimental and disabled by default. | Treat the reference as a future scoped role-template and permission-matrix redesign. Preserve Association -> Club -> Division -> Team scope, inheritance, audit and server/RLS enforcement. Prioritise only after the owner-test package and release gates are closed unless Aaron explicitly changes scope. |

### What has already been delivered

- **29-30 July:** completed the approved Production compatibility release, deployed 16 migrations
  and two Edge Functions, enabled notification schedules, released the fault-tolerant scraper and
  reduced Production scraper backups to the intended 44 recovery objects.
- **31 July-1 August:** recovered the RevSports importer, added the guarded Production release path,
  locked the 14-block plan, and implemented formation/line-up, domain preparation, navigation,
  dashboard/availability, communications, voting reliability, core administration, scoped module
  permissions, Committee Management, Safety Hub writes and Dev quality automation.
- **2-3 August:** added session-bound/mode-aware permission enforcement, disposable actual-role Dev
  accounts, route/menu guards and a broad owner-test evidence matrix. Follow-up fixes covered role
  labels, Umpire Match Voting draft/context handling, fixture/availability deduplication,
  notification author exclusion and state retention.
- **4 August:** completed the fixture/calendar presentation batch, Expense Hub Stages 1 and 2, and
  the `/admin/users` broad-query fix now deployed at `6246a48`.

Recent commit history is the strongest concise record of landed work. Start at `6246a48` and review
back through `18aa428` for the owner-test package and `682b8ea` for the last Production-aligned
baseline.

### Known open defects and cautions

- The actual-role browser matrix is not complete. A Viewing-as preview is useful but is not proof
  of the same permissions as a separate account.
- A rejected role/mode switch can leave the wrong club visible even though the backend correctly
  denies access.
- Umpire Match Voting candidate search must be regression-tested against only the fixture's valid
  people; older evidence found overly broad club membership suggestions.
- Broadcast recipient queries previously included the author. A fix landed, but end-to-end
  notification regression testing remains required.
- Live Supabase schema can differ from migration history. Check the live Dev schema before any
  database-dependent change.
- There is no complete automated signed-in browser suite. Desktop evidence exists; tablet/mobile
  integrated testing remains incomplete.
- Full repository lint has known debt. The latest read-only takeover run reported 360 errors and
  78 warnings; TypeScript, production build, 10 Expense Hub tests and 144 Python regression tests
  passed. Separate existing lint debt from regressions in changed files.
- `docs/current-state.md`, `docs/owner-test-matrix.md` and some curated Vault notes contain dated
  status wording. Use dates and commit evidence; do not treat an older "pending deployment" line as
  newer than this snapshot.

### Recommended takeover order

1. Run `git status --short --branch` and preserve the two existing local changes.
2. Read the local diff in `UsersManagement.tsx` and `notes/known-issues.md`; do not overwrite it.
3. Continue `docs/owner-test-matrix.md` from the Users/Club Admin checkpoint using the prepared
   disposable Dev accounts. Temporary credentials must remain ephemeral.
4. Test the local focus-preservation/scoped-role change. If it passes, run the required checks, review the
   exact diff, then commit and push only the intended files to `dev`.
5. Work through fixtures, communications, Player MVP Voting, Umpire Match Voting, Formation,
   Expense Hub, Safety Hub and Committee Management with clearly marked disposable Dev data.
6. Update the matrix and current-state notes with evidence, not assumptions.
7. Present failures and owner-judgement items to Aaron. Promote accepted Dev work to `main` only
   after reviewing divergence and the exact commit set.
8. Keep `prod`, Production systems, domains, secrets and destructive membership cleanup behind
   their separate approval gates.

### Useful transfer references

- `docs/development-plan.md` — planned blocks and implementation state.
- `docs/owner-test-matrix.md` — line-by-line verification checklist and execution order.
- `notes/known-issues.md` — defects and parked work, including the local persistence addition.
- `docs/domain-migration-plan.md` — domain preparation, live rollout and rollback gates.
- `docs/production-release-process.md` — guarded Production release tooling.
- `docs/scraper-operations.md` — scraper schedules, backup and retention routines.

### Documentation state

- This handoff is intentionally the main 8 August transfer snapshot.
- `docs/current-state.md` is still the canonical implementation history and has been corrected for
  the deployed Users fix, but its long dated entries should be read chronologically.
- The curated Vault pages were last edited on 30 July and therefore lag newer Expense Hub, fixture
  and owner-test work. The generated repository mirror is current to committed `origin/dev`.
- Because this task is being completed with existing local work still uncommitted, Obsidian close-out
  remains pending until the intended files are committed and pushed to `dev`, followed by sync and
  `-Check`.

### 8 August 2026 connection readiness audit

- GitHub app access works as `SportStackApp` with administrator permission. GitHub CLI is now
  actively using `SportStackApp`; the HTTPS remote and repository-local commit identity are correct.
- The Supabase app and CLI both reach SportStack Dev and Production. This checkout remains linked to
  Dev, both projects report healthy, and the Dev Edge Function gateway correctly rejects
  unauthenticated calls to protected functions with HTTP 401.
- The Vercel app reaches the `sportstackapps-projects` team and the `sportstack` project. The latest
  Dev deployment for `6246a48` is READY. Local Vercel CLI is authenticated only to Aaron's personal
  account and the checkout has no `.vercel/project.json`; use the Vercel app for routine inspection.
  The guarded Production script retains its separate encrypted access path and cannot complete a
  preflight while the worktree is intentionally dirty.
- Dev, Main and Production public addresses return HTTP 200. The T3 collaborative browser and local
  Playwright Chromium both load Dev successfully. The pinned scraper environment is now aligned at
  `supabase 2.31.0`, `beautifulsoup4 4.15.0`, `playwright 1.61.0` and `requests 2.34.2`.
- Development environment validation, plan lint, TypeScript, production build, 10 Expense Hub tests,
  144 Python tests, Obsidian sync/check and the daily scheduled-task status pass. Full lint remains
  at its known 360-error/78-warning baseline. Docker Desktop is installed but its daemon is stopped;
  Deno is not installed.
- The latest Production scraper run `31238193085` had one failed Sunraysia target because GitHub's
  runner received HTTP 403 from a round page. The same base, game and round URLs returned HTTP 200
  locally, while the other targeted fixture jobs passed, so this is not a Supabase credential
  failure. Monitor or separately harden retry handling before treating it as resolved.
- Dev function inventory has drift: deployed `provider-key-healthcheck` and `update-user-details`
  are absent from the repository function folders, while repository folders `clear-test-data`,
  `profile-claim` and `profile-claim-admin` are not in the deployed Dev list. Reconcile this
  read-only before the next related function edit or deployment.

## Detailed implementation history

The entries below retain earlier technical detail. Where their pending/deployed wording conflicts
with the 8 August snapshot above, the newer snapshot and current Git evidence win.

- The 4 August owner retest found `/admin/users` failing for both broad Super Admin and scoped
  account views. Supabase API logs confirmed `admin_visible_profile_ids` succeeded, then the browser
  sent hundreds of returned UUIDs in one `profiles?id=in.(...)` URL and received HTTP 400. The fix
  batches authorised profile IDs into safe requests before sorting and paging. No database, user,
  role or permission data was changed. It is committed and deployed to Dev as `6246a48`; the page
  now loads and scoped owner testing continues.

- Expense Hub Stage 1 is implemented on the Dev code/database path at `/expense-hub`. It includes
  manual personal/association/club expenses, scoped suppliers/aliases/payment methods/categories,
  GST and business-use calculations, private multi-file attachments, duplicate warnings, archive/
  restore, audit snapshots, combined filtering, dashboard summaries and filter-aware Excel/PDF
  exports. Four additive Dev migrations ending `071327`, `073000`, `074800` and `080500` are active.
  Access is deny-by-default through `expense_hub_access`; Aaron has Dev owner access. Finance
  administrators need an explicit association/club grant, can edit shared records and cannot change
  original ownership. Live rollback tests and Supabase advisers passed. Production is untouched.
  The next checkpoint is Aaron's signed-in Dev workflow test described in `docs/current-state.md`.

- The fixture batch now centralises bye presentation, adds calendar previous/next/current month
  navigation, and colours historical results green/red/orange for the selected team's win/loss/draw
  with its score on the card. It expands completed fixture detail with RevSports
  participants, goals and cards joined to full SportStack profiles where linked. Regular players
  who played appear first, participating fill-ins second and remaining eligible players last.
  Admin Fixtures now mirrors active cascade values in its labelled filters, lower cascade levels
  are not predictively selected, and shared competition lists use senior/Open/Women then descending
  junior order. Fixture Management routes and navigation are limited to Super/Association Admin;
  additive Dev RLS restricts mutations to true Super Admin mode or the selected Association Admin
  scope. No fixture or membership rows were changed. Deployment and browser retesting remain required.

- The Dev feedback log was re-read on 4 August. The newest competition-ordering request is covered
  by this fixture batch, pasted feedback images were already implemented, and no additional fixture
  blocker was found. The other open feedback remains part of the longer development plan.

- The 3 August separate-account discovery found direct-route and contextual-menu failures that a
  Viewing-as preview had not safely proved: Team Manager could open broad admin pages, Coach and
  Player could reach a blank Roles & modules route, Player exposed Umpire administration, Coach
  showed Edit branding, and Umpire/Voter identities lacked team context. A local active-mode route
  gate, non-blank fail-closed screen, contextual menu filtering and Umpire/Voter scoped reset pass
  focused lint, TypeScript, build and 16 regression tests. Additive migration
  `20260803090000_scope_reserved_umpire_voter_accounts.sql` is applied and the reset Edge Function
  is active as version 8. The frontend still needs its `dev` deployment and actual-role retest.
- The 2 August unattended Dev pass is recorded in `docs/owner-test-matrix.md`. It traversed the
  primary permission, navigation, Fixtures, Communications, Player MVP Voting, Umpire Match Voting,
  Coaching/Profile, Formation, Safety Hub and Committee screens without changing test data. The
  detailed matrix distinguishes read-only passes, partial failures and actual-role/write tests that
  are still required.
- Commits `879d184` and `5514996` add frontend guards against the cascade replacing a deliberate
  Super Admin selection. Unit, focused lint, TypeScript, build, Dev Quality runs `30746490223` and
  `30747852160`, and both Vercel deployments passed. Fresh deployed build `5514996` still redirects
  `/admin` to `/dashboard` and restores Team Manager after Super Admin is selected. The remaining
  session-context/navigation cause is open; do not record this workflow as passed.
- The unattended pass found remaining product gaps: mode labels and direct-route restriction can
  disagree with Viewing as; scoped user rows show global rather than contextual roles; My Dashboard
  still misformats byes; the Fixtures calendar is only a grid view; legacy chat edits have no
  revisions; broadcast notification recipients include the author; and Umpire Match Voting search
  is too broad. Source review confirms Player MVP Analytics already has the requested three
  URL-backed tabs. It also confirms the availability-to-line-up workflow exists through My
  Dashboard, fixture detail and Line-up, but its access helper uses stored roles rather than the
  active Viewing-as mode.
- A final read-only browser check on deployed build `9949d2b` confirmed the active **Viewing as**
  preview remained Team Manager while Profile incorrectly said `Viewing as Super Admin` and the
  Lucas HC Admin Dashboard incorrectly showed a `Super Admin` badge. Source review confirmed these
  labels show the root account mode/highest stored role instead of `activeMode`; this is a display
  defect, not evidence that the active preview reset. Profile also rendered one unnamed role/scope
  line because its local role label maps omit the existing `UMPIRE_ADMIN` enum value. Back from Team
  Chat briefly restored `/admin`, then the application asynchronously replaced it with `/dashboard`.
- The Lucas HC fixture detail repeated `James V` and `Tom Batchelor` in availability. The Line-up
  page loaded Coach controls, availability labels, formation positions and Primary/Secondary
  roster relationships; no selection was saved or published.
- Exact source causes are now recorded: the Umpire ballot uses stored roles rather than active mode,
  `/admin/analytics` lacks a direct module gate, Team Manager is treated as an admin by
  `useAdminScope`, the Admin badge uses the highest stored role and Profile uses the root mode label,
  Dashboard duplicates the bye formatter with unconditional fallbacks, and Umpire suggestions load
  active memberships from every team in both fixture clubs. The user Edit Details action is an
  in-page dialog, so its observed Dashboard return belongs to the remaining mode/navigation reset.
  Communications loads the newest 50 messages, paginates earlier batches of 50, excludes the
  sender from Team Chat unread counts and records future edits in immutable revision history.
  Account theme persistence uses `profiles.theme_preference` with local storage only as fallback.
- Read-only Dev checks found no configured permission groups, sets, assignments, overrides or
  module flags, and no communication revision rows. Membership integrity totals remain 201
  duplicate groups, 44 multiple-Primary users and 490 immutable snapshot rows. No database write,
  cleanup, `main`, `prod`, Production, domain or redirect change was made during the unattended pass.
- Current quality checks pass: development-plan lint, TypeScript, production build and all 125
  Python tests. Full repository lint remains at its known 362-error/76-warning baseline.

- The locked Owner-Test remediation package is implemented against SportStack Dev and mapped in
  `docs/owner-test-matrix.md` for integrated owner testing. It covers scoped administration and
  audit, state persistence, cascade/navigation, Fixtures and Communications, both voting modules,
  Coaching/Profile, Safety Hub and Committee Management. `main`, `prod`, Production Supabase, DNS
  and redirects are unchanged.
- All additive Dev migrations in the remediation package are applied. All new public tables have RLS, new administrative
  functions reject anonymous execution, and private committee uploads are limited to 20 MB.
- The 2 August permission extension adds scoped named groups, reusable module-access sets,
  assignments to roles/groups/users and reasoned direct exceptions. Rolled-back Dev tests passed
  for group denial, direct-user precedence, Club Admin hierarchy and clean rollback. The existing
  `is_super_admin()` helper was schema-qualified for reliable use inside hardened functions.
- The actual Admin Sportstack account is now signed into Dev and confirmed as a real `SUPER_ADMIN`.
  The secure `provision-dev-test-account` Edge Function is active as version 6 with JWT verification
  enabled. It validates the live Auth session and current Super Admin role, creates accounts once
  and refuses to reset an existing identity; no authentication bypass was added.
- The first owner test found a stale `public.app_role` cast in `admin_save_user_roles`. Dev actually
  uses `public.user_role_enum`; migration `20260801131220_fix_admin_role_enum_reference.sql` fixed
  that single reference. The corrected save passed its rolled-back Dev transaction check.
- Follow-up migrations `20260802105000_transactional_dev_account_and_role_guards.sql`,
  `20260802106000_mode_aware_permission_management.sql` and
  `20260802107000_mode_aware_permission_listing.sql`, plus
  `20260802108000_harden_permission_group_assignments.sql`,
  `20260802109000_authorise_dev_test_provisioning_session.sql` and
  `20260802110000_mode_aware_runtime_permissions.sql`, passed rollback compile/runtime checks and
  are applied to Dev. Duplicate role rejection, function-access checks and mode isolation passed.
  Mode-aware permission reads and writes are implemented, and group assignments enforce exact
  scope and member hierarchy; the actual-role browser matrix is still pending.
- Migrations `20260802113500_session_bound_permission_context.sql`,
  `20260802114000_enforce_committee_safety_module_access.sql` and
  `20260802115000_enforce_voting_module_access.sql` are applied to Dev. Matching Dev commit
  `a06ae9a` is live, `mvp-voting-email-reminders` version 4 and
  `public-umpire-match-voting` version 5 are active, and their HTTP boundary checks passed.
- Seven isolated Dev test accounts now exist for Association Admin, Club Admin, Team Manager,
  Coach, Player, Umpire and Voter testing. No credentials are stored in the repository. Aaron has
  authorised hands-off password resets and recoverable Dev-only testing changes for these
  disposable identities. Migration `20260802231405_reserved_dev_test_account_lookup.sql` and
  `provision-dev-test-account` version 7 provide an explicit reset path limited to the seven exact
  metadata-marked accounts and still require a current Super Admin session.
- Temporary credentials must remain ephemeral. This standing Dev sandbox authority does not cover
  Production, `prod`, domains, secrets, force-pushes or historical membership cleanup.
- The historical-membership snapshot contains 201 duplicate user/team groups and 44 users with
  multiple active Primary memberships (490 captured rows). New invalid writes are blocked; no
  historical row was changed and cleanup still requires separate approval.
- Quality status for the package: baseline-aware development-plan lint, TypeScript, production
  build and 30 focused migration/security tests pass. Repository-wide lint remains a separate baseline
  of 362 errors and 76 warnings.
- On commit `4390b47`, 32 focused session-context, voting-module, Committee/Safety and SQL-safety
  `unittest` checks passed. Full `npm run lint` still reports the same 362-error/76-warning baseline.
  Fresh 1280 x 720 browser checks found no document-level horizontal overflow on My Dashboard,
  Fixtures, Communications, Roster, Formation Library, Safety Hub or Committee Management. Tablet
  and mobile widths remain unverified in the current fixed-width authenticated browser.

- A guarded, backup-first Umpire Portal Production release script and runbook are prepared for
  `dev` and `main` staging. The script is pinned to the exact Production Supabase project, two
  approved migrations, one Edge Function and the Production Vercel setting. Vercel CLI 58.4.4 is
  installed locally.
- A 30-day Supabase token has been created and verified against both SportStack projects and a
  read-only Production migration listing. The existing Production Turnstile keys are also staged
  with Windows user encryption. No database password was copied, reset or stored; Production DB
  access uses an isolated temporary CLI work directory while the repository stays linked to Dev.
- The isolated dry-run rebuilt 157 live Production history records as empty temporary placeholders
  and confirmed only the two approved Umpire Portal migrations are pending. This prevents older
  filename drift from replaying historical migrations.
- Vercel browser authentication is complete. A verified 30-day SportStack team token is stored in
  the existing Windows-encrypted Production access file outside the repository. Direct Vercel API
  and CLI project checks both passed without exposing the token.
- The unfinished `scraper/fixture_import.py` worktree copy was proven to contain duplicated conflict
  text only, backed up outside the repository and restored exactly to the committed implementation.
  The full 94-test Python suite, TypeScript and production build passed afterward.
- The Production preflight now stops at the branch-alignment gate. The development-plan package is
  ahead of `main`, and the reviewed package includes a workflow capable of selecting Production targets.
  Explicit owner approval is required before that package can move to `main`. No Production action
  was attempted.
- The public Umpire Portal frontend remains on `dev` and `main` only. Production Supabase, Vercel
  settings and `prod` remain unchanged pending the access preflight and approved release execution.
- The fault-tolerant fixture scraper and match-duration package was promoted through `dev`, `main`
  and `prod` on 30 July 2026 at `398f386` after Aaron approved the Production release.
- The follow-up release and storage records brought `dev`, `main` and `prod` to `682b8ea` on
  30 July 2026.
- The consolidated Production scraper workflow is active on GitHub's default branch. Vercel
  Production completed successfully, the public site returned 200, signed-out `/dashboard`
  redirected to `/login`, and the deployed bundle referenced Production Supabase only.
- The approved Production compatibility release is complete. The 16 migrations, two Edge Functions,
  scheduled notification jobs and final Git promotion were completed on 29 July 2026.
- Production signed-in owner smoke testing remains the main release follow-up.
- `supabase/pending-migrations/lock_down_mvp_voting_access.sql` remains parked and excluded.

## Scraper storage state

- The Production excess caused by old hourly weekend backups is resolved. Approved cleanup run
  `30530191487` removed 969 objects using 1,533,329,605 bytes.
- Production `scrape-backups` now contains the intended 44 recovery objects using 60,176,404 bytes.
  Post-delete workflow and database checks agreed, with no approved candidate left behind.
- The released routine selects exact fixtures every 15 minutes after their calculated finish,
  verifies the current RevSports round-card start before scraping, retries late results, runs one
  nightly full catch-up and never backs up the small targeted runs.
- Calculated finish now uses exact fixture finish, division duration, association default, then a
  90-minute fallback. The additive duration migration is applied and verified in Dev and
  Production; all existing divisions remain blank and inherit their association setting.
- Routine match backups are weekly. Retention keeps the latest, nearest 1/2/4-week snapshots, then
  one per month for 12 months. The organisation-wide Supabase GB-hour graph may take time to reflect
  the lower stored total.

## Obsidian note continuity

- Committed repository Markdown is authoritative. Its generated, read-only Hermes mirror is
  `Projects/SportStack Repository`, with `_Index.md` as the entry point.
- The curated Vault notes own only the project boundary, priorities, action register and operating
  procedure. They link back to the generated mirror for changing implementation and release detail.
- `AGENTS.md` requires a refresh/read at the start of meaningful work and a sync plus `-Check` after
  the canonical note changes are pushed to `dev`.
- The current-user Windows task `SportStack Obsidian Note Sync` runs daily at 7:00 pm local time and
  catches up after missed runs. It reads `origin/dev`, so feature branches and uncommitted files
  cannot become the published record.

## Active development order

- The locked 14-block order is recorded in `docs/development-plan.md`.
- Block 1 is complete: the unfinished RevSports importer was safely recovered and verified.
- Block 2 is at its staging approval gate. Its future address is
  `hb.sportstackapp.com.au`, but connecting the domain, changing DNS and promoting Production remain
  separately approval-gated.
- Block 3 is implemented on Dev pending owner smoke testing. The Dev database now has four reusable
  field templates linked to the four existing formations, scoped RLS and least-privilege grants.
  The app adds persistent cropped icons, safer line-up saves, team selection, formation-change
  protection and mobile tap instructions.
- Block 4 repository preparation is complete. `hb.sportstackapp.com.au` is mapped to the public
  Umpire Portal inside this SportStack app, with safe hostname routing, origin preparation and a
  live-rollout checklist in `docs/domain-migration-plan.md`. Vercel, DNS, Supabase Auth, Turnstile,
  redirects and Production are unchanged and approval-gated.
- Block 5 is implemented on Dev pending owner smoke testing. Signed-in menus now follow a consistent
  everyday workflow, expose existing competition and import pages to Super Admin, explicitly scope
  association and club admin choices, and use separate Player MVP Voting and Umpire Match Voting
  names. The route inventory and contextual-page decisions are in `docs/navigation-audit.md`.
- Block 6 is implemented on Dev pending owner smoke testing. The daily dashboard now labels the
  selected team's Primary, Secondary or Fill-in relationship, presents clearer home/away fixture
  information and uses accessible, save-locked availability controls only on eligible fixtures.
  Failed fixture/calendar requests are no longer shown as genuine empty data.
- Block 7 is implemented on Dev pending owner smoke testing. Communications now displays the exact
  selected audience, confirms Club and Association broadcasts before publishing, preserves older
  message deep links, resets permission/reminder state between scopes and reports load/save errors
  without showing stale or false-empty data.
- Block 8 is implemented on Dev pending owner smoke testing. Player MVP Voting's existing atomic
  3-2-1 path passed a live integrity audit. Signed-in Umpire Match Voting now lists completed fixtures
  only, validates the full ballot and writes its header plus lines atomically through the new
  `submit_umpire_match_vote` function. Browser direct inserts are revoked; Production is unchanged.
- Block 9 is implemented on Dev pending owner smoke testing. Fixture import and manual fixture
  editing now preserve division/season scope and block ambiguous team matches. Membership-request
  approval and unused-venue deletion are atomic, server-authorised Dev functions. A read-only audit
  found existing duplicate membership data; it was documented without changing any existing row.
- Block 10 is implemented on Dev pending owner smoke testing. Roles & modules now includes live,
  inherited module controls at association, club, division and team scope. Scoped administrators
  can confirm an enable/disable override or restore inheritance; module routes and navigation use
  the effective setting. Existing modules default to enabled and Hockey Trace defaults to disabled.
- Block 11 is implemented on Dev pending owner smoke testing. Association and club committees now
  support custom positions, President designation, eight position permissions, dated appointments,
  governance document links and qualification/expiry records. Committee data is private to scoped
  administrators and current members; Dev contains no committee records yet.
- Block 12 is implemented on Dev pending owner smoke testing. Committees now have atomic polls with
  free-text, choose-one, choose-multiple and Yes / No / Abstain questions; reusable agenda templates;
  meetings with minutes, decisions and assigned actions; current-member-only chat; and append-only
  activity history. Voting and chat require an active appointment with the explicit position
  permission, including for administrators.
- Block 13 is implemented on Dev pending owner smoke testing. The live Safety Hub forms now save
  Risk, BE SMART Action, QI, Bright Idea, committee-review, risk-review and permanent-link records
  atomically behind existing scoped RLS. Audit history remains append-only. Committee meeting
  decisions can link only to real Safety Hub records inside the committee's association/club scope.
- Block 14 is implemented on Dev with ongoing monitoring. Dev Quality now checks focused plan lint,
  TypeScript, the production build, 100 Python regression tests and all workflow definitions on
  each `dev` push and relevant pull request. Remote run `30654055573` passed at `978737b`.
- The 1 August read-only monitoring snapshot found the latest Dev scraper and five latest scheduled
  Production scraper runs successful. Notification cron jobs reported successful latest runs, and
  Production retained the expected 44 scraper backups using 60,176,404 bytes.
- Do not merge or cherry-pick `chore/domain-structure` commit `3a7d6cc`; it contains the superseded
  assumption that `hb` belongs to the separate ignored Hockey Ballarat module. The corrected work
  is being landed directly on `dev`.

## Local repository cleanup

- The previous eight local stashes were preserved in the verified bundle
  `C:\Users\mulla\AppData\Local\SportStack\backups\local-git\sportstack-stashes-20260730-144716.bundle`.
- The live stash list was then cleared. Keep the bundle until the scraper-routine work is accepted.

## Best next owner test

1. Use the prepared isolated Dev accounts to follow `docs/owner-test-matrix.md` one line at a time.
2. Start with the new permission groups, module sets, role/group/user assignments and direct exceptions,
   then confirm Club Admin user visibility and higher-role protection.
3. Test multi-team cascade selection, Team Overview, tabs, filters, drafts, refresh and incognito
   theme persistence.
4. Test Fixtures/bye display, chat history/pagination, Player MVP identity and status, and Umpire
   Match Voting number-only validation.
5. Test one disposable Safety Hub matrix/link workflow and one Committee meeting, upload, agenda,
   minutes and linked-record workflow.
6. Keep the 201 duplicate membership groups unchanged until Aaron approves the exact cleanup report.
7. Only after acceptance, promote the reviewed package to `main`. Production and domain work remain
   separately approval-gated.

Keep Player MVP Voting and Umpire Match Voting separate. Hockey Trace remains experimental and
disabled by default.
