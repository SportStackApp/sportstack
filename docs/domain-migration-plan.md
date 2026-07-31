# SportStack Domain Rollout Plan

Last reviewed: 1 August 2026

Status: repository preparation only. No domain, DNS, Vercel, Supabase Auth, Turnstile, redirect,
deployment or Production change has been made.

## Locked mapping

- `hb.sportstackapp.com.au` will be the SportStack Umpire Portal.
- It will use the existing SportStack application and the public `/umpire` workflow.
- When the approved alias is connected, opening the `hb` root will show the Umpire Portal landing
  page. Existing nested Umpire Portal links will continue to work.
- The current SportStack, Development, Main/staging, root and `www` addresses remain operating.
- No old-to-new redirect is included in this rollout. Redirects require a later explicit decision.

## Repository preparation included

- Recognise `hb.sportstackapp.com.au` as a Production hostname.
- Show the Umpire Portal landing page at `/` only when the browser hostname is `hb`.
- Keep all other hostnames on the normal SportStack landing page.
- Add `hb` to the public Umpire Match Voting Edge Function origin allow-list.
- Document browser-safe URL variables and a server-side `SPORTSTACK_APP_URL` variable.
- Keep email and profile-access links on the requesting origin, with the current SportStack
  Production address as the server fallback.

These code changes do not connect or publish the new hostname by themselves.

## Current live evidence

Read-only checks on 1 August 2026 confirmed:

- Current SportStack Production, Development, Main/staging and `www.sportstackapp.com.au` return
  HTTP 200.
- `sportstackapp.com.au` still returns HTTP 307 to `www.sportstackapp.com.au`.
- `hb.sportstackapp.com.au` has no DNS record and cannot be opened yet.

No live setting was changed during these checks.

## Approval-gated live rollout

The following steps must be completed together after Aaron approves the exact package:

1. Confirm the `sportstack` Vercel Production Branch is still `prod` and its Production variables
   still target SportStack Production Supabase.
2. Add `hb.sportstackapp.com.au` to the same Vercel `sportstack` Production project.
3. Copy Vercel's exact DNS requirement into Hostinger. Do not guess or reuse a target.
4. Leave every existing DNS record and Vercel domain unchanged.
5. Add both `https://hb.sportstackapp.com.au/` and
   `https://hb.sportstackapp.com.au/**` to the Production Supabase Auth redirect list. Keep the
   current Site URL and every existing redirect entry.
6. Add `hb.sportstackapp.com.au` to the Production Cloudflare Turnstile widget hostname list.
7. Confirm `PUBLIC_UMPIRE_ALLOWED_ORIGINS` retains the existing Production origin. The released
   Edge Function code also includes `hb` explicitly.
8. Wait for DNS propagation and Vercel-managed HTTPS before testing.

Production deployment, Production Supabase or Edge Function changes, Vercel environment changes,
DNS changes and Turnstile hostname changes all require explicit owner approval.

## Verification checklist

- Existing `sportstack.grampianshockey.com.au`, `dev.sportstackapp.com.au`,
  `main.sportstackapp.com.au`, `sportstackapp.com.au` and `www.sportstackapp.com.au` behaviour is
  unchanged.
- `hb.sportstackapp.com.au` opens the Umpire Portal landing page with valid HTTPS.
- Direct refresh works on `/umpire`, `/umpire/public-vote`, `/login` and `/reset-password`.
- Umpire login without an account works.
- Umpire login with an account returns to the Umpire Portal.
- One clearly marked test ballot passes Turnstile, saves once and appears in admin review.
- Password reset and sign-in links return to the hostname that initiated the request.
- Browser console, CORS, Auth redirect and Turnstile checks show no errors.
- The `hb` bundle uses SportStack Production Supabase only.
- Existing bookmarks and voting links continue to work without redirecting.

## Rollback

If the new alias fails after an approved rollout:

1. Remove only `hb.sportstackapp.com.au` from the SportStack Vercel project.
2. Remove only its newly added Hostinger DNS record.
3. Remove only its newly added Supabase redirect entries and Turnstile hostname.
4. Keep all old domains and the existing Production Site URL unchanged.
5. Re-test the current SportStack Production and Umpire Portal `/umpire` addresses.

No force-push, Production database rollback or old-domain deletion is part of this plan.

## Parked decisions

- Whether `app.sportstackapp.com.au` becomes a future main SportStack alias.
- Whether any old address should redirect after a proven coexistence period.
- Preferred domains for future QR codes, emails, documentation and support material.
