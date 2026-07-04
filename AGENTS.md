# AGENTS.md

Guidance for AI coding agents (OpenAI Codex, etc.) working in the **SportStack** repository.
Read this file first, then `docs/current-state.md`, then `docs/project-brief.md` before doing anything.
Fuller context lives in `TECHNICAL_SPECIFICATION_AND_SYSTEM_HANDOFF.md` and
`PROJECT_SCOPE_UI_UX_AND_IMPLEMENTATION_PLAN.md`.

## Project overview
SportStack is a private React + TypeScript + Vite SPA (Tailwind + shadcn/ui) with a Supabase
backend (Postgres, Auth, Storage, Edge Functions), deployed on Vercel (auto-deploys on push to
`main`). It aggregates hockey data scraped from RevSports (Python scripts in GitHub Actions),
stages it in `revsports_*` tables, maps it via `revsports_*_mappings`, and imports it to live
tables (`fixtures`, `teams`, `profiles`, ...). Supabase project: `svierarfcolhcfjpmwck`
(**one project for dev AND prod — treat all data as real**). The **live DB schema is the source
of truth**; migration files may have drifted.

## Source of truth order
1. `AGENTS.md`
2. `docs/current-state.md`
3. `CODEX_HANDOFF.md`
4. `docs/project-brief.md`
5. `TECHNICAL_SPECIFICATION_AND_SYSTEM_HANDOFF.md`
6. `PROJECT_SCOPE_UI_UX_AND_IMPLEMENTATION_PLAN.md`
7. Latest pull requests and commits
8. Live Supabase check

If this order conflicts with older documentation, use the newer/current source and mark anything uncertain as `UNKNOWN — needs confirmation`.

## Setup commands
```bash
npm install
cp .env.example .env.local      # fill VITE_SUPABASE_* (ask the owner; never commit)
npm run dev                     # http://localhost:8081
```

## Test / quality commands (run ALL before completing work)
```bash
npm run lint
npx tsc --noEmit
npm run build
```
There is no automated test suite yet. Do the relevant manual smoke test and say what to test next.

## Coding style
- Reuse existing shadcn/ui components and established app patterns. Keep changes small and scoped.
- TypeScript; **Australian English** in all user-facing text; **DD/MM/YYYY** dates; respect the
  association timezone (`associations.timezone`, default `Australia/Melbourne`).
- Never use `value=""` on a shadcn `<SelectItem>` — use a `"__none__"` sentinel.
- Table dropdowns: `SelectTrigger` → `className="w-full min-w-0 overflow-hidden"`; display cell →
  `className="w-64 max-w-xs"`; truncate with ellipsis, never widen columns.

## Safety rules
- **Confirm with the owner before:** any destructive DB op (DELETE/DROP/TRUNCATE), any schema
  migration, any change to RLS/auth/Edge Functions/the role enum, anything touching secrets, and
  anything that auto-deploys to `main`.
- Never read, print, or expose `.env` / `.env.local` or the Supabase **service** key.
- The frontend may only use the **anon/publishable** key. The service key is server/CI-only.
- If a fact isn't in the handoff docs, latest repo history, or the live DB, mark it `UNKNOWN — needs confirmation` and ask.

## Files to avoid editing (unless explicitly asked)
- `src/components/ui/*` (generated shadcn)
- `src/integrations/supabase/client.ts` and `types.ts` (auto-generated — regenerate, don't hand-edit)
- existing `supabase/migrations/*` (append new migrations; never rewrite history)
- `data/*` (scraper output)
- `bun.lock`, `bun.lockb`, `package-lock.json` (lockfiles)

## Environment variables
- Public (browser-safe): `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`.
- Server/CI only: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` (scrapers also expect `SUPABASE_SERVICE_ROLE_KEY`).
- See `.env.example`. Never add a secret behind a `VITE_` prefix.

## Database changes
- The live schema wins over migration files. Verify against the live DB before changing anything.
- Use additive migrations; for backfills, do a **dry-run** and report counts first.
- Enums can't be renamed — `ALTER TYPE ... ADD VALUE IF NOT EXISTS`, then `UPDATE` rows.
- `is_super_admin()` takes **no** arguments. Don't join `fixtures → divisions` until the
  `division_id`/`season_id` nulls are fixed — join `fixtures` to `teams` via `home_team_id`/`away_team_id`.

## UI changes
- Match existing layout/navigation and the Association→Club→Division→Team scope cascade
  (switching a level resets all levels below). Keep it mobile-friendly.

## Branch & commit conventions
- `.github/workflows/*.yml` → may commit to `main`. **All other changes → `dev` first, then merge
  to `main`** (which triggers the Vercel deploy).
- Branches: `fix/…`, `feat/…`, `chore/…`. Commits: `type(scope): summary`.

## How to report completed work
1. Plain-English summary of what changed and why.
2. List of files changed.
3. Exactly what the owner should test next.
4. Risk level and whether a DB migration is included.
5. Whether `docs/current-state.md` needs updating after the task.
