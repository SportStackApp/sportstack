# AGENTS.md

Guidance for AI coding agents (OpenAI Codex, etc.) working in the **SportStack** repository.
Read this file first, then `docs/current-state.md`, then `docs/project-brief.md` before doing anything.
Fuller context lives in `TECHNICAL_SPECIFICATION_AND_SYSTEM_HANDOFF.md` and
`PROJECT_SCOPE_UI_UX_AND_IMPLEMENTATION_PLAN.md`.

## Project overview
SportStack is a private React + TypeScript + Vite SPA (Tailwind + shadcn/ui) with a Supabase
backend (Postgres, Auth, Storage, Edge Functions), deployed on Vercel. It aggregates hockey data
scraped from RevSports (Python scripts in GitHub Actions), stages it in `revsports_*` tables,
maps it via `revsports_*_mappings`, and imports it to live tables (`fixtures`, `teams`,
`profiles`, ...). The **live DB schema is the source of truth**; migration files may have
drifted.

## Environments and release path

| Stage | Git branch | Public address | Supabase project |
|---|---|---|---|
| Development | `dev` | `https://dev.sportstackapp.com.au` | SportStack Dev `icqegnpjbizccjebjfhb` |
| Main/staging | `main` | `https://main.sportstackapp.com.au` | SportStack Dev `icqegnpjbizccjebjfhb` |
| Production | `prod` | `https://sportstack.grampianshockey.com.au` | SportStack Production `svierarfcolhcfjpmwck` |

- `dev` and `main` deliberately share the Dev database.
- `prod` is the Vercel Production Branch and uses a separate production database.
- `www.sportstackapp.com.au` is not part of this rollout and must remain untouched unless Aaron
  explicitly approves a later change.
- The release path for app changes is `dev` -> `main` -> `prod`. Promotion to `prod` requires
  separate owner approval because it changes the public production deployment.

## Source of truth order
1. `AGENTS.md`
2. `docs/current-state.md`
3. `CODEX_HANDOFF.md`
4. `docs/project-brief.md`
5. `TECHNICAL_SPECIFICATION_AND_SYSTEM_HANDOFF.md`
6. `PROJECT_SCOPE_UI_UX_AND_IMPLEMENTATION_PLAN.md`
7. Latest pull requests and commits
8. Live Supabase checks

If this order conflicts with older documentation, use the newer/current source and mark anything uncertain as `UNKNOWN — needs confirmation`.

## Voting terminology

SportStack has two separate voting modules. Always name the intended module:

- **Player MVP Voting**: players vote for their peers after a game. Use **Player MVP** only where UI space is limited. Suggested namespace for future code: `player_mvp`.
- **Umpire Match Voting**: assigned or authorised umpires submit official post-match votes for eligible people associated with a completed fixture. Use **Umpire Votes** only where UI space is limited. Suggested namespace for future code: `umpire_match_votes`.

Do not call either module only "Voting", "Votes", "the voting module", or "the MVP module" when the meaning could be unclear. The modules have separate audiences, permissions, workflows, submissions, and results. See `docs/project-brief.md#voting-modules` for the current route, component, and database-identifier mapping.

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
  any merge or push to `prod`. Workflow changes merged to the default `main` branch can also alter
  scheduled live automation and require confirmation.
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
- App changes go to `dev` first, then `main` for staging. After explicit release approval, merge
  `main` to `prod`; a `prod` push triggers the Vercel production deployment.
- `.github/workflows/*.yml` are a special case because scheduled workflows run from GitHub's
  default branch (`main`) and select Dev or Production through different secret names. Review the
  target secrets and get owner confirmation before merging workflow changes to `main`.
- Branches: `fix/…`, `feat/…`, `chore/…`. Commits: `type(scope): summary`.

## How to report completed work
1. Plain-English summary of what changed and why.
2. List of files changed.
3. Exactly what the owner should test next.
4. Risk level and whether a DB migration is included.
5. Whether `docs/current-state.md` needs updating after the task.
