# B1 Production approval packet — 7 September 2026

## Current decision

**HOLD FOR OWNER EVIDENCE. Do not deploy yet.**

The independent immutable-patch review is complete. The candidate is technically reproducible and
the hosted rehearsal passed, but Production approval is blocked until Aaron completes the B1c
walkthrough, confirms the Primary-team semantics and account-wide Player/Voter role semantics, and
Production access supports a fresh read-only drift check and verified backup.

## Exact package identity

| Item | Frozen value |
|---|---|
| Repository | `SportStackApp/sportstack` |
| Production base | `a1d23c741b79de02c32763a879597192a1c1ebd5` |
| Candidate | `5994385f403d4a8188de49e14762ac6097f018fa` |
| Candidate branch | `codex/fix-b1-hosted-candidate` |
| Changed files | 26 |
| Binary patch SHA-256 | `41f618fff298ff287a2bffd44ed5d789fa90036c64c2d5a3214368184d13d0f3` |
| Vercel preview | `dpl_GCghG7Hi2fHm6mF8UgqMxtDPzmbi` — READY, HTTP 200 |
| Preview bundle | `index-DnPhkItZ.js` |

The package contains the scoped permission/session application changes and the six migrations
below. It contains no Edge Function, workflow, scraper, secret, DNS or unrelated module change.
Main remains `af21ae3`; it is not the source of this curated release because it contains broader
unapproved work. Any later Production approval must explicitly approve the frozen candidate as the
exception to the normal Dev → Main → Production path.

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

No existing migration may be edited, renamed or marked complete manually.

## Required pre-flight

1. Confirm Git identity `Aaron Mullane <admin@sportstackapp.com.au>` and GitHub account
   `SportStackApp`.
2. Fetch all branches and confirm Production is still exactly `a1d23c7`, the candidate is exactly
   `5994385`, and the candidate is a direct descendant of Production.
3. Restore read-only Production database access. The current Supabase connector returned a
   permission error, so current database drift is **not confirmed**.
4. Capture the current migration list, schema fingerprint, grants, policies, scheduled jobs and
   protected row counts. The six B1 versions must be absent.
5. Create a fresh encrypted logical backup of the affected Production schema and data, record its
   SHA-256, and prove it can be read or restored in isolation. Confirm the platform backup position.
6. Confirm no external email, notification or scraper job can be triggered by the migration run.

Last verified reference counts were 159 Production migration versions, 757 profiles, 1,260 team
memberships and six primary-team requests. These are references only: fresh pre-flight counts become
the actual baseline. After migration, all three protected row counts must equal that fresh baseline.
If Production still has 159 versions, the expected final count is 165. The foundation adds 12 tables
and one sequence without adding application users or membership rows.

## Deployment sequence after exact approval

1. Freeze normal role and membership administration for the short release window.
2. Run the pre-flight above and stop if any identity, hash, count, backup or drift check fails.
3. Apply each migration in the listed order, verifying its recorded version and protected counts
   before continuing.
4. Re-run the B1 static checks, function grants, anonymous denials, actual-role boundaries and
   database advisers.
5. Fast-forward only the Production branch from `a1d23c7` to `5994385`. Do not merge Main or Dev.
6. Confirm the Vercel Production deployment is READY and the public alias serves the recorded
   commit and bundle.
7. Run the post-release smoke test and observe errors before reopening administration work.

## Post-release smoke test

- Sign in as Super Admin and confirm Association → Club → Division → Team cascading.
- Confirm Super, Association, Club, Team Manager, Coach and Player viewing modes use the intended
  scope and persist after refresh.
- Confirm an unrelated account is denied the Roles & Modules and membership administration paths.
- Disable and inherit Player MVP at a disposable scope; direct route access must fail closed.
- Complete one labelled B1c request through request, approve, confirm, decline and cancel paths.
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

- Recommendation: `hold_for_evidence`
- Impact if wrong: high
- Regression likelihood: moderate
- Regression protection: partial
- Recoverability: managed
- Confidence: moderate

Strong controls include server-bound session mode/scope, revoked anonymous execution, actual-role
allow/deny checks, request row locking and a successful hosted Production-shaped rehearsal. The
decision-critical unknown is whether the rehearsed cross-organisation Primary-team demotion and
consent behaviour matches Aaron's intended policy.

A separate read-only source review raised four hypotheses:

- The request-approval check/use race does not survive the complete six-migration package. Migration
  `20260906130000` locks the request row before deriving and authorising its scope, then the delegated
  implementation locks the same row in the same transaction.
- The two cross-scope Primary-team hypotheses are the existing open Primary-team policy decision,
  not new evidence of a different defect.
- The legacy role-save function still lets a scoped administrator request account-wide `PLAYER` or
  `VOTER` changes. The frozen browser shows `PLAYER`, but not `VOTER`, to scoped administrators;
  direct function calls remain server-authorised for both. Whether that legacy account-wide action
  is intended, or must be restricted to Super Admin, requires owner confirmation before release.

## Approval gates

- [ ] B1c owner walkthrough observed and recorded.
- [ ] Cross-organisation Primary-team demotion policy confirmed.
- [ ] Pending Primary request as consent confirmed or rejected.
- [ ] Account-wide Player/Voter role changes by scoped administrators confirmed or restricted and
      retested.
- [ ] Fresh Production drift check and verified backup complete.
- [ ] Exact package approval received.

When every earlier box is complete, the required approval is:

`RELEASE B1 ACCESS PACKAGE 5994385 TO PRODUCTION`

That sentence authorises only the package recorded here. It does not authorise Main, Dev, workflows,
scrapers, Edge Functions, DNS, secrets or any later commit.
