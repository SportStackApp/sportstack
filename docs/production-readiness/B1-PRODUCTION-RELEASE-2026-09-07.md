# B1 Production release — 7 September 2026

## Outcome

Aaron approved exactly:

`RELEASE B1 ACCESS PACKAGE 3d9bc53 TO PRODUCTION`

The approved package is live in Production. `origin/prod` is exactly
`3d9bc530b04ada938da751d68b1fea908371c5b0`. Main and Dev were not merged into Production,
and no Edge Function, workflow, scraper, secret or DNS change was made.

## Database result

- Applied the ten approved additive migrations in the frozen order.
- Migration history moved from 159 to 169 versions.
- Protected counts remained unchanged: 757 profiles, 1,260 team memberships and six Primary-team
  requests.
- The first release attempt stopped safely after migration one because the local working-tree copy
  of later migrations differed from the frozen candidate. No application push had occurred.
- The release runner was corrected to extract every migration from immutable commit `3d9bc53`,
  normalise Windows line endings, verify the approved SHA-256 digest and resume only from an exact
  migration prefix. It then applied and verified migrations two through ten.
- A fresh post-release schema audit records 169 Production migrations, 11 Edge Functions and schema
  SHA-256 `285e89c3f5cb45ecd8b978a3d6c5f7c047c701c78e1d4ad3cacbe6135fa1ce6b`.
- A fresh Production-only membership audit confirms all six lifecycle functions are security
  definers with empty search paths, authenticated/service execution only and no anonymous
  execution. There are zero duplicate user/team Primary pairs and zero duplicate approved request
  destinations.
- Database advisers returned no error-level findings during release and independent post-release
  verification.

People may be Primary in more than one association. The 44 users with multiple active Primaries
therefore match Aaron's confirmed policy; there are no duplicate active Primary user/team pairs.

## Application result

- The live Production bundle is `/assets/index-BjjGD6cn.js`, built on 7 September 2026.
- It identifies release `v2026.09.07+3d9bc53`.
- It contains the Production Supabase project reference and does not contain the Dev reference.
- `/`, `/login` and `/admin/roles-permissions` return HTTP 200 from Vercel.
- A clean browser session is redirected from the protected roles route to the sign-in screen with no
  browser errors observed.

The currently connected Vercel CLI account cannot resolve the custom Production domain or its
owning project, even though the live response is served by Vercel and the new candidate bundle is
live. Reconcile that Vercel team/project access before the next Production release so deployment
status can be checked directly rather than inferred from the live alias and bundle.

## Backup and recovery

The verified encrypted pre-release backup remains at:

`C:\Users\mulla\AppData\Local\SportStack\backups\prod\2026-09-07-141416-pre-b1-3d9bc53`

It was authenticated, decrypted, extracted and hash-checked in isolation before release. No
plaintext SQL remains. The database changes are additive and remain compatible with the previous
application commit `a1d23c7`; if an application defect is found, restore that application version
first and preserve database evidence before considering an additive correction.

## Remaining owner confirmation

When Aaron is next available, complete the authenticated Production role/scope smoke test:

1. Confirm Association → Club → Division → Team cascading and refresh persistence.
2. Check Super, Association, Club, Team Manager, Coach and Player viewing modes.
3. Confirm an unrelated account is denied Roles & Modules and membership administration.
4. Complete one clearly labelled Primary-team request through the supported UI, then clean it up
   through supported application actions.

This manual follow-up is flagged as unconfirmed; the automated Production release gates pass.
