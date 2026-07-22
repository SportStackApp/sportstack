# CODEX HANDOFF — EXTRAS

Companion to `TECHNICAL_SPECIFICATION_AND_SYSTEM_HANDOFF.md` and
`PROJECT_SCOPE_UI_UX_AND_IMPLEMENTATION_PLAN.md`. Contains the four extra outputs (A–D).

---

## A. Recommended repo files to create

| File | Status | Purpose |
|---|---|---|
| `README.md` | exists — refresh | Update setup (npm canonical, port 8081, env vars) and link the handoff docs. |
| `AGENTS.md` | **provided in this package** | Agent operating rules at repo root (Codex reads this first). |
| `CODEX_HANDOFF.md` | create | Short pointer file: "Start with `docs/project-brief.md`, then the two handoff docs, then `AGENTS.md`." |
| `.env.example` | create | Documents required env vars with safe placeholders (no real values). See Doc 1 §5. |
| `CONTRIBUTING.md` | create | Branch strategy (`dev` → `main`; workflows on `main`), commit conventions, PR checklist. |
| `DEPLOYMENT.md` | create | Vercel auto-deploy on `main`, build/output, rollback, env setup, GitHub Actions scraper schedule. |
| `DATABASE.md` | create | Table inventory, enums, RLS approach, the division/season-null caveat, migration policy, the "live schema is source of truth" rule. |
| `TESTING.md` | create | Manual smoke/regression checklist now; plan for Vitest + Playwright; the "run lint/tsc/build before submitting" rule. |
| `SECURITY.md` | create | Secret handling, anon-vs-service key boundary, RLS, historical public-token Player MVP Voting notes, Umpire Match Voting permissions, and how to report issues. |
| `CHANGELOG.md` | create | Human-readable change history (seed it from the `notes/` session handoffs). |

> Many of these can be distilled directly from the two handoff documents and the existing
> `docs/project-brief.md` + `notes/` files — Codex can generate first drafts in Phase 1.

---

## B. Recommended Codex first prompt

Paste this to Codex **after** committing the handoff docs + `AGENTS.md` to the repo:

```
You are taking over the SportStack repository. Do NOT change any code yet — this first task is
read-only investigation and reporting.

1. Read these in order:
   - AGENTS.md
   - docs/project-brief.md
   - TECHNICAL_SPECIFICATION_AND_SYSTEM_HANDOFF.md
   - PROJECT_SCOPE_UI_UX_AND_IMPLEMENTATION_PLAN.md
   - the most recent files in notes/

2. Inspect the repository to confirm the actual stack and structure:
   - package.json (scripts + dependencies), vite.config.ts, vercel.json
   - src/App.tsx (routes), src/integrations/supabase/, src/hooks/useUserRole.ts and useAdminScope.ts
   - scraper/ (especially fixture_import.py) and .github/workflows/
   - supabase/migrations/ and supabase/functions/

3. Confirm setup commands actually work in your environment:
   - npm install
   - npm run lint
   - npx tsc --noEmit
   - npm run build
   Report any failures verbatim.

4. Identify mismatches between the handoff documents and the real repo, for example:
   - npm vs Bun (two lockfiles present)
   - Edge Functions in the repo vs deployed (clear-test-data, bulk-import-players)
   - migrations vs the live schema (note: the live DB is the source of truth)
   - any documented file/route/table that doesn't exist, or anything that exists but isn't documented

5. Produce a written "Findings & Mismatches" report containing:
   - Confirmed stack and working setup commands
   - List of mismatches and unknowns (mark each "UNKNOWN — needs confirmation")
   - The blockers from Doc 2 §13 you need answered
   - A safe, ordered first implementation plan (start with Phase 0/1 from Doc 2)

6. STOP. Do not make any code changes, migrations, or deployments until the owner reviews your
   findings and confirms the plan. Flag explicitly anything that would touch the database, RLS,
   auth, Edge Functions, secrets, or the main branch.
```

---

## C. Missing information checklist (what the owner still needs to provide)

Tick these off; ★ = blocks related implementation.

- [ ] ★ Confirm canonical package manager (npm vs Bun)
- [ ] ★ Email provider decision (Resend or other) + sending domain + DNS (SPF/DKIM/DMARC)
- [ ] ★ Cause of `division_id`/`season_id` nulls (import script only, or missing mappings too?)
- [ ] ★ Whether the `rg_*` risk/governance suite is in SportStack scope
- [ ] ★ Exact contracts for `admin_save_user_roles` overloads and the `create-player` / `bulk-import` / `bulk-import-players` Edge Functions
- [ ] Repo access for Codex (confirm it can read/clone; provide a token if it ever becomes private)
- [ ] Screenshots of key admin screens + both Player MVP Voting and Umpire Match Voting screens (for UI accuracy)
- [x] Production URL is `sportstack.grampianshockey.com.au`; current app DNS is managed in Hostinger
- [x] Vercel project is `sportstack`; Preview Supabase URL/key values use Dev and Production URL/key values use Production (`VITE_SUPABASE_PROJECT_ID` is not required by the current client)
- [ ] Supabase service key kept secret (and rotated if ever exposed)
- [ ] A test game (fixture) to run the Player MVP Voting flow end-to-end
- [ ] A test login (a non-super-admin account per role) for permission testing
- [ ] Whether the Supabase CLI is used locally, or only the SQL editor (affects migrations)
- [ ] GitHub Actions secrets confirmed present: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`
- [ ] player-registry / player-history workflow schedules (cron) — confirm
- [ ] Any recent error logs (Vercel/Supabase) worth investigating
- [ ] Confirm whether `mvp_tokens` (legacy) is dead vs `mvp_vote_tokens`
- [ ] Current top-priority todo (so Codex sequences correctly)
- [ ] Stripe/payments — confirmed out of scope (no action), unless that changes

---

## D. Final quality check (self-review of this handoff package)

| Standard | Met? | Notes |
|---|---|---|
| Detailed enough for Codex? | Yes | Grounded in live DB + real repo, with phased plan and discrete tasks. |
| Unknowns clearly marked? | Yes | "UNKNOWN — needs confirmation" used throughout; blockers listed in Doc 2 §13. |
| Assumptions clearly marked? | Yes | "ASSUMPTION — confirm before implementation" used (naming, package manager, etc.). |
| Setup commands included? | Yes | Doc 1 §6, AGENTS.md, first prompt. |
| Test commands included? | Yes | lint / tsc / build (no suite yet — flagged). |
| Environment variables included? | Yes | Doc 1 §5 + `.env.example` content (no real values). |
| Database details included? | Yes | Full live table inventory, enums, functions, triggers, RLS, ERDs, data issues. |
| Third-party services included? | Yes | Doc 1 §3 (Supabase, Vercel, GitHub, RevSports, Hostinger, Cloudflare, Google, email-planned, etc.). |
| UI/UX details included? | Yes | Doc 2 §5–6, screen-by-screen, UX rules. |
| Tasks small enough? | Yes | Doc 2 §10 task IDs with acceptance criteria + risk + confirm flags. |
| Acceptance criteria included? | Yes | Per phase and per task. |
| Risks included? | Yes | Doc 1 §13 + §14 security review. |
| Future instructions included? | Yes | Doc 2 §14 reusable prompt + AGENTS.md. |
| No real secret values? | Yes | Only variable names and placeholder patterns. |
| No destructive actions recommended without confirmation? | Yes | All destructive/migration/auth tasks flagged "Confirm? Yes". |

**Residual gaps (by design, need the owner):** the five ★ blockers in section C; exact Edge Function
request/response bodies (read the function source to confirm); custom index audit; DNS records;
Vercel/Hostinger/Cloudflare specifics. These are marked UNKNOWN rather than guessed.
