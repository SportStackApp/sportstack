# B1d application allow-list — 6 September 2026

## Outcome

**7 September update:** the Production-compatible hosted rehearsal passed and the exact application
candidate is frozen locally at `5994385`. B1e and hosted-rehearsal blockers are closed. Production
remains unauthorised pending the B1c owner walkthrough, Primary-team semantics decisions,
a fresh Production pre-flight and a new exact Production approval. See
`B1-HOSTED-REHEARSAL-2026-09-07.md`. Later historical sections below describe the earlier freeze.

The independent review is now complete with recommendation `hold_for_evidence`. The remaining
release gates are the owner walkthrough, Primary-team semantics, a fresh Production drift
check/verified backup and exact approval. See `B1-PRODUCTION-APPROVAL-PACKET-2026-09-07.md`.

The B1 application boundary is now explicit and reproducible. It is **not yet a Production release
candidate**. The safe slice contains the session permission context, five-module controls, route
gates and the atomic primary-team workflow. It deliberately does not copy the current Dev admin
pages wholesale because they also depend on later Coordination and general membership functions.

Production and Main were not changed.

The machine-readable source of truth is
`docs/production-readiness/B1-APPLICATION-ALLOW-LIST-2026-09-06.json`.

## Pinned source

| Purpose | Commit |
|---|---|
| Current Dev application evidence | `916b5b9a4eada44f405678bfaafafefd4fd6cabc` |
| Clean B1 permission snapshot | `77422f1188eade9f45f36382462dca7849a1081a` |
| Atomic primary-team browser wrapper | `3a52bd94c55b103509e599700b47b2cbf5577f5e` |
| Production base | `a1d23c741b79de02c32763a879597192a1c1ebd5` |
| Main/staging baseline | `af21ae3c06a2d66d2eb9c4edf64bb2c185869927` |

Exact-copy files are pinned by Git blob ID in the JSON manifest. Shared files are patch-only. This
prevents later Expense Hub, Coordination, incident/discipline, scraper and Dev-account work from
entering the B1 package through a broad file copy.

## Included application behaviour

- Server-confirmed active role and organisation scope for the current signed-in session.
- Fail-closed route and module checks.
- Module inheritance and overrides for Player MVP, Umpire Match Voting, Committee, Safety Hub and
  the disabled-by-default Hockey Trace module.
- Permission groups, permission sets, role/group/user assignment and direct module exceptions.
- Primary-team request, approval, confirmation, cancellation and decline through the B1c atomic
  functions.
- Existing Production routes and general membership behaviour are retained unless an exact B1
  patch is named in the manifest.

## Important dependency finding

The current Dev Users and Requests pages call general administration functions that are not in
B1a–B1c and do not exist in the same form in Production. These include role saves, scoped user
listing/profile updates, team membership changes, invites and general request approval. Production
also still grants its legacy six-argument `admin_save_user_roles` function to `PUBLIC` and `anon`.

Those functions require a new additive **B1e administration and membership compatibility bridge**.
Until B1e has been curated, rehearsed and denial-tested:

- do not copy the full Dev Users, Requests or Edit User screens;
- keep Production's existing general membership paths;
- patch only the primary-team handlers required by B1c; and
- do not expose the advanced Users-page actions that depend on the missing functions.

## Explicit exclusions

- No Edge Function, including `provision-dev-test-account`.
- No workflow or scraper change.
- No Coordination or incident/discipline module.
- No Expense Hub change.
- No preferred-name, nickname, coaching, formation or unrelated profile change.
- No broad copy of `App.tsx`, `AppLayout.tsx`, `TeamContext.tsx`, `Profile.tsx`, `Requests.tsx` or
  `UsersManagement.tsx`.
- No hand edit or broad Dev copy of generated Supabase types. Types must be regenerated from the
  hosted rehearsal database.

## Confirmation still required

**B1c owner walkthrough: CONFIRMATION REQUIRED.** Aaron explicitly said he had not performed the
manual walkthrough. His instruction to continue is not evidence that the request, approval,
decline, cancellation and player confirmation flow passed. This gate remains open until it is
observed and recorded.

## Local verification

The manifest verifier passes its owner-status, inventory, dependency, regression and release-manifest
checks. The complete current Dev suite also passes: 46 Vitest files/181 tests, TypeScript,
Production build and focused lint. Full lint remains at the existing 346-error/77-warning baseline
with zero fatal errors. These checks validate the allow-list and current Dev evidence; they do not
replace the B1e or hosted-rehearsal gates.

Allow-list commit `0f703c7` passed Dev Quality run `34030314009`. Vercel deployment `6292379283`
completed successfully, and its deployment URL and `https://dev.sportstackapp.com.au` returned the
same app-shell hash and `index-6P17Mea3.js` bundle. This was a documentation and verification-tool
deployment; the pinned application source remains `916b5b9`.

## Next release sequence

1. Build B1e from live Dev/Production schema comparison without rewriting migration history.
2. Rehearse B1e apply, repeat, rollback, protected-row counts and actual-role denial paths.
3. Construct the exact B1 application candidate from this allow-list on the Production base.
4. Restore and test the complete B1 package in a fresh Production-compatible hosted environment.
5. Regenerate Supabase types, run the complete quality suite and perform actual-role application
   smoke tests.
6. Complete the deferred B1c owner walkthrough and independent review.
7. Ask Aaron for separate approval of the exact frozen Production package.

Production remains unchanged until all seven steps pass.
