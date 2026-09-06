# B1e administration and membership rehearsal — 6 September 2026

## Outcome

B1e is applied on Development only. It supplies the general Users and Requests database functions
that B1d needs, preserves the legacy six-argument role-save call, removes anonymous execution and
accepts `FILL_IN` consistently. A later additive migration binds the affected browser functions to
the active mode and scope stored for the current Auth session. A third additive migration locks a
request before its scope is authorised, preventing that scope from changing during approval.

Production was inspected read-only and was not changed. Main was not changed.

## Exact package

- `20260906114318_b1_administration_membership_compatibility.sql`
  - SHA-256 `8C50800FB8B3674F883B6F1E3DDE1F1ED498111CB15EC4607BDC793A4DFA83FF`
  - 13 function signatures and two integrity triggers.
  - Eight browser-facing signatures are authenticated; internal helpers are service-only.
  - Zero anonymous function grants.
  - Request and membership handling includes `FILL_IN`.
- `20260906123500_b1_administration_session_binding_hardening.sql`
  - SHA-256 `E30F947446F48D6D18AA7054DEE762BAC9F3492EE90FD7573133917C1008E682`
  - Adds four session-bound wrappers without rewriting the already-applied B1e migration.
  - The renamed implementations are service-only.
  - Profile listing, profile editing, role saving and request approval cannot use a dormant role
    while another mode is active for the session.
- `20260906130000_b1_request_approval_scope_lock.sql`
  - SHA-256 `67C1C8AA5FB663FBAAA422BA1EE79B7DE1D1B08BEFF7BB54E9CA8B133D12BD66`
  - Locks the membership request row before deriving and authorising its organisation scope.
  - Preserves authenticated browser and service-role access with zero anonymous access.

The reusable Dev apply script is hard-coded to project `icqegnpjbizccjebjfhb`. Migration names,
versions, success markers and optional runtime-check paths are constrained before they reach file
or query operations.

## Rehearsal and runtime evidence

An isolated Production-derived PostgreSQL 17 database with no published host port passed:

- first apply and repeat apply;
- actual-role Super Admin, Association Admin, Club Admin, Team Manager, Coach, Player, unrelated
  administrator and anonymous allow/deny checks;
- `FILL_IN` create, change, approval and cancellation behaviour;
- session-mode denial for profile list, profile update, role save and request approval;
- transactional rollback of all three B1e migrations.

The logical Production backup does not include a faithful hosted Auth service, so the rehearsal
used a local-only `auth.sessions` compatibility table. This limitation is why a fresh hosted
Production-compatible rehearsal remains a release gate.

Development then passed exact apply, repeat apply, protected-count comparison, error-level database
lint and the rollback-only runtime suite. The suite confirmed its 13 fixture Auth users were absent
after rollback.

The final read-only environment audit at
`outputs/b1-environment-audit-2026-09-06-v11/manifest.json` records:

| Environment | Migration versions | Edge Functions | Schema SHA-256 |
|---|---:|---:|---|
| Development | 149 | 19 | `8c8b5a9fb56dee16f80a84ed4e3cffe8ad0ea3e1d1f0a92916fadfed6cc17a31` |
| Production | 159 | 11 | `a8a570fafd21145bf13f66cd6291856ef8ed852f04e736a07382b742790dc488` |

Production's schema hash is unchanged from the pre-apply audit.

## Security and quality gates

The frozen B1e security review completed with zero reportable findings. It identified four real
active-mode consistency defects; they do not give an attacker authority the account does not
already hold, but the additive session-binding migration closes them as a safety and consistency
measure. A later independent pass found a request-approval check/use race; the third migration
closes it by holding a row lock across the permission check and approval. Focused negative runtime
checks pass.

Two related Primary-team semantics remain **CONFIRMATION REQUIRED**:

1. whether making an in-scope membership Primary may demote a previous Primary belonging to
   another organisation;
2. whether a person's pending Primary request is sufficient consent for that automatic demotion.

The current global one-Primary invariant is unchanged until Aaron confirms the intended rule.

Final local checks pass:

- static B1e/security verifier;
- focused lint for the JavaScript verification tools;
- 46 Vitest files / 181 tests;
- TypeScript;
- Production build.

Full lint remains at the established baseline of 346 errors and 77 warnings, with no B1e
regression.

The exact code commits are `99367e4` and `4104617`. Dev Quality run `34034923963` passed. Vercel
deployment `dpl_GmvpBYE62GJKWDwxStjk8zmVHLv7` is READY for commit `4104617` and aliases
`dev.sportstackapp.com.au`; an unauthenticated route-shell request returned HTTP 200 with the
application root. Final security scan `a939dc44-ad09-4ee3-be34-7f5dd82412bf` completed with zero
reportable findings and only the two Primary semantics below deferred.

## Remaining release gates

- B1c owner walkthrough remains **CONFIRMATION REQUIRED**; it was not converted into a pass.
- Build the exact B1d allow-listed application on a fresh hosted Production-compatible rehearsal
  environment and repeat actual-role denial and application smoke tests.
- Regenerate Supabase types against that hosted candidate.
- Promote only the reviewed B1 package to Main after the hosted rehearsal passes.
- Production still requires a separate exact-package approval from Aaron.
