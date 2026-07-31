# SportStack Production release process

## Purpose

`scripts/release-production.ps1` removes the need to repeatedly sign in through browser passkeys.
It keeps the Production access details encrypted for the current Windows user and applies strict
checks before anything can reach Production.

This initial version is intentionally pinned to the approved public Umpire Portal release. Update
and review its allow-list before using it for a different release.

## What the script protects

- It only accepts SportStack Production Supabase project `svierarfcolhcfjpmwck`.
- It refuses to run if the repository's normal Supabase link is not still on SportStack Dev.
- It requires `dev` and `main` to be aligned and `prod` to be a clean fast-forward.
- It refuses any database migration outside the two approved Umpire Portal migrations.
- It creates and verifies fresh roles, schema and data backups before database changes.
- It deploys only `public-umpire-match-voting`.
- It sets only the required Production Turnstile and public-portal configuration.
- It never force-pushes or rewrites Git history.
- It verifies the Production function, website and Supabase project reference after release.

## One-time access setup

Required accounts:

- a scoped Vercel team access token for the SportStack project;
- a Supabase personal access token belonging to a SportStack organisation Owner or Administrator;
- Production database access;
- the Production Cloudflare Turnstile site and secret keys.

Run:

```powershell
pwsh -NoProfile -File scripts/release-production.ps1 -Mode ConfigureAccess
```

Paste each value when prompted. Secure prompts do not display the pasted value. The encrypted file
is saved at:

`%LOCALAPPDATA%\SportStack\release\production-access.json`

The file is outside Git and can only be decrypted by the same Windows account on this PC. It is not
a replacement for the original provider-side credentials. Revoke and recreate a token in Vercel or
Supabase if the PC or Windows account is compromised.

## Read-only preflight

Run this before every Production release:

```powershell
pwsh -NoProfile -File scripts/release-production.ps1 -Mode Preflight
```

It checks Git, the GitHub account, the Vercel project, Supabase access, Production database access,
and the exact pending migration list. It does not change Production. If a previous attempt stopped
after the migrations, it only allows a resume when all approved migrations and the matching
pre-migration backup can be independently verified.

## Approved Umpire Portal release

Only after the owner has reviewed the exact commit list and explicitly approved Production:

```powershell
pwsh -NoProfile -File scripts/release-production.ps1 `
  -Mode Release `
  -Confirmation "RELEASE UMPIRE PORTAL TO PRODUCTION"
```

The order is:

1. repeat all preflight checks;
2. create and verify a fresh logical backup;
3. apply the two approved migrations;
4. set the Edge Function secrets and deploy the function;
5. confirm the function returns eligible Hockey Ballarat fixtures;
6. set the Production Vercel Turnstile site key;
7. fast-forward and push `prod`;
8. verify the deployed Umpire Portal and Production Supabase reference.

If the final website check is interrupted after the `prod` push, rerun the read-only verification:

```powershell
pwsh -NoProfile -File scripts/release-production.ps1 -Mode Verify
```

## Important limits

- Production approval is still required for each release. Stored CLI access does not replace that
  approval.
- Never paste tokens, database passwords or Turnstile secrets into chat, source files or `.env`
  files.
- Do not broaden the migration or Edge Function allow-list during a release. Review and commit a
  separate script update first.
- A full backup restore can overwrite newer Production data. Prefer a reviewed forward fix unless a
  genuine recovery event requires a restore.
- After the automated checks pass, complete the normal signed-in owner smoke test.
