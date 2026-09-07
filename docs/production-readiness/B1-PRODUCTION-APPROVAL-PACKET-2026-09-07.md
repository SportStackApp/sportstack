# B1 Production approval packet — 7 September 2026

## Current decision

**HOLD FOR PRODUCTION PRE-FLIGHT. Do not deploy yet.**

The candidate is technically reproducible, the hosted rehearsal passed and the actual-role
Player-to-Team-Manager Primary-team walkthrough passed on Development. Aaron confirmed all open
Primary-team and account-wide Player/Voter policy questions. Production approval remains blocked
until Production access supports a fresh read-only drift check, a verified backup is taken and
Aaron gives exact approval for this frozen candidate.

## Exact package identity

| Item | Frozen value |
|---|---|
| Repository | `SportStackApp/sportstack` |
| Production base | `a1d23c741b79de02c32763a879597192a1c1ebd5` |
| Candidate | `3d9bc530b04ada938da751d68b1fea908371c5b0` |
| Candidate branch | `fix/b1-global-simple-role-boundary` |
| Changed files | 38 |
| Binary patch SHA-256 | `c51d468e2015189488b4689acc691acf725f021a51b64ffbce51556cf5fd0216` |
| Vercel preview | deployment `6301360025` — SUCCESS and HTTP 200 |
| Final security scan | `e155580f-c97f-4134-99bb-ff4bd6bcce17` — complete, zero findings across six surfaces |

The package contains the scoped permission/session application changes and the ten migrations
below. It contains no Edge Function, workflow, scraper, secret, DNS or unrelated module change.
Main remains `af21ae3`; it is not the source of this curated release because it contains broader
unapproved work. Any later Production approval must explicitly approve the frozen candidate as the
exception to the normal Dev → Main → Production path.

The final security scan reviewed the exact `a1d23c7..3d9bc53` range. Delegated reviewers and the
TAC advisory connector were unavailable, so the parent completed the review sequentially and
recorded those limitations. Fresh Production schema drift and backup verification remain outside
that source-diff scan and must be completed during Production pre-flight.

## Database order

Apply only in this order and stop on the first discrepancy:

1. `20260906063905_b1_foundation_compatibility.sql`
   SHA-256 `97991bc7dcf62ba1c3cedd77c1d2a32025176a2d9377abcebcef543a3793dc62`
2. `20260906075102_b1_security_compatibility.sql`
   SHA-256 `7d450a8cdff1d5deeef9d66938def1e69b74e05df6daaef8cde3f9722d200db9`
3. `20260906095820_b1_membership_workflow_compatibility.sql`
   SHA-256 `42d3488eefd2b65fee27be1e5ccf1d09baae2b5102c6df6ee06cfab3801658c2`
4. `20260906114318_b1_administration_membership_compatibility.sql`
   SHA-256 `9bb09d1dfc9dbe21f28f6efbbce3cfa53a49797504a58c4c07e4360311671758`
5. `20260906123500_b1_administration_session_binding_hardening.sql`
   SHA-256 `e30f947446f48d6d18aa7054dee762bac9f3492ee90fd7573133917c1008e682`
6. `20260906130000_b1_request_approval_scope_lock.sql`
   SHA-256 `67c1c8aa5fb663fbaaa422ba1ee79b7de1d1b08beff7bb54e9ca8b133d12bd66`
7. `20260907101500_b1_restrict_account_wide_simple_roles.sql`
   SHA-256 `d93e7c51e566e9769b17c5074554c1216514801dc20367c810bd1b220c8809ed`
8. `20260907103000_b1_primary_team_per_association.sql`
   SHA-256 `3630c10db02bac03478e5567434489e444a4cec3f51e5581757b10e1180c0543`
9. `20260907104500_b1_primary_team_per_association_lint_fix.sql`
   SHA-256 `47e7d445732f11bf7545109bfa886e0b74485b4764e6af98dd32d479c14884df`
10. `20260907131500_allow_derived_registered_club_sync.sql`
    SHA-256 `f460e8fcd2e22cd9c91a4d21a5bce1201406be059609f65221231cb1a5d2f852`

No existing migration may be edited, renamed or marked complete manually.

## Required pre-flight

1. Confirm Git identity `Aaron Mullane <admin@sportstackapp.com.au>` and GitHub account
   `SportStackApp`.
2. Fetch all branches and confirm Production is still exactly `a1d23c7`, the candidate is exactly
   `3d9bc53`, and the candidate is a direct descendant of Production.
3. Restore read-only Production database access. The current Supabase connector returned a
   permission error, so current database drift is **not confirmed**.
4. Capture the current migration list, schema fingerprint, grants, policies, scheduled jobs and
   protected row counts. The ten B1 versions must be absent.
5. Create a fresh encrypted logical backup of the affected Production schema and data, record its
   SHA-256, and prove it can be read or restored in isolation. Confirm the platform backup position.
6. Confirm no external email, notification or scraper job can be triggered by the migration run.

Last verified reference counts were 159 Production migration versions, 757 profiles, 1,260 team
memberships and six primary-team requests. These are references only: fresh pre-flight counts become
the actual baseline. After migration, all three protected row counts must equal that fresh baseline.
If Production still has 159 versions, the expected final count is 169. The foundation adds 12 tables
and one sequence without adding application users or membership rows.

## Deployment sequence after exact approval

1. Freeze normal role and membership administration for the short release window.
2. Run the pre-flight above and stop if any identity, hash, count, backup or drift check fails.
3. Apply each migration in the listed order, verifying its recorded version and protected counts
   before continuing.
4. Re-run the B1 static checks, function grants, anonymous denials, actual-role boundaries and
   database advisers.
5. Fast-forward only the Production branch from `a1d23c7` to `3d9bc53`. Do not merge Main or Dev.
6. Confirm the Vercel Production deployment is READY and the public alias serves the recorded
   commit and bundle.
7. Run the post-release smoke test and observe errors before reopening administration work.

## Post-release smoke test

- Sign in as Super Admin and confirm Association → Club → Division → Team cascading.
- Confirm Super, Association, Club, Team Manager, Coach and Player viewing modes use the intended
  scope and persist after refresh.
- Confirm an unrelated account is denied the Roles & Modules and membership administration paths.
- Disable and inherit Player MVP at a disposable scope; direct route access must fail closed.
- Complete one labelled player-submitted B1c request through request and destination approval; it
  must complete without another player action. Separately check decline and cancellation paths.
- Confirm protected row counts change only for that labelled smoke record, then clean it up through
  supported application actions.
- Check browser console, failed network requests, Vercel errors and Supabase logs.

## Rollback

**Application-only failure:** immediately point Vercel back to the last verified `a1d23c7`
Production deployment. The database changes are additive and were designed to remain compatible
with the old application.

**Database or permission failure:** keep the old application deployed, stop affected administration
actions, preserve logs and counts, and assess a new additive corrective migration first. If the
database must be restored, use the verified pre-release backup and reconcile any legitimate writes
made after it. Never delete migration-history rows or rewrite an applied migration.

## Independent risk review

- Recommendation: `hold_for_production_preflight`
- Impact if wrong: high
- Regression likelihood: moderate
- Regression protection: substantial
- Recoverability: managed
- Confidence: high

Strong controls include server-bound session mode/scope, revoked anonymous execution, actual-role
allow/deny checks, request row locking, a successful hosted Production-shaped rehearsal and the
observed Development Player-to-Team-Manager walkthrough. Aaron confirmed that demotion is limited
to the current association and a player-submitted request supplies consent.

A separate read-only source review raised four hypotheses:

- The request-approval check/use race does not survive the complete seven-migration package. Migration
  `20260906130000` locks the request row before deriving and authorising its scope, then the delegated
  implementation locks the same row in the same transaction.
- The two cross-scope Primary-team hypotheses were resolved by Aaron's confirmed one-Primary-per-
  association policy and the actual-role walkthrough.
- Aaron confirmed that only Super Admin may add or remove account-wide `PLAYER` or `VOTER` roles.
  Migration `20260907101500` enforces that boundary on both Production-compatible role-save calls
  and the optional Dev access-save call. Lower-admin add/remove attempts are denied, unchanged saves
  pass, team-scoped Player membership is preserved and Super Admin add/remove passes. A fresh
  independent post-fix review found no confirmed issue.

## Approval gates

- [x] B1c Player-to-Team-Manager walkthrough observed and recorded.
- [x] Cross-association Primary-team demotion policy confirmed.
- [x] Player-submitted Primary request as consent confirmed.
- [x] Account-wide Player/Voter changes restricted to Super Admin and retested on staging and Dev.
- [ ] Fresh Production drift check and verified backup complete.
- [ ] Exact package approval received.

When every earlier box is complete, the required approval is:

`RELEASE B1 ACCESS PACKAGE 3d9bc53 TO PRODUCTION`

That sentence authorises only the package recorded here. It does not authorise Main, Dev, workflows,
scrapers, Edge Functions, DNS, secrets or any later commit.
