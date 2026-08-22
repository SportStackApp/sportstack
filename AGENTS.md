# AGENTS.md

Guidance for AI coding agents (OpenAI Codex, etc.) working in the **SportStack** repository.
Read this file first, then `docs/current-state.md`, then `docs/consolidated-open-items-plan.md`, then
`docs/project-brief.md` before doing anything.
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

## Development autonomy and production boundary

- Routine, non-destructive work on `dev` and `main` is owner-pre-approved. Agents may inspect,
  edit, test, commit and push to either branch without asking for each action, provided the
  required quality checks are run and the intended branch and diff are verified first.
- Intentional `dev` -> `main` staging promotions are also pre-approved after fetching both branches,
  reviewing their divergence and verifying that only the intended tested commits will move.
  `main` is non-production, but it is public staging and shares the Dev database.
- Non-destructive Dev-database work and additive Dev-only migrations, RLS/Auth changes, role-enum
  additions and Edge Function changes may proceed when required by the task only after checking the
  live Dev schema, completing an appropriate dry-run or rollback test, and documenting the result.
- `prod` and every production system remain restricted. Any `prod` commit, push or merge;
  production deployment; Production database, Auth, Storage, Edge Function or secret change; or
  production DNS, Cloudflare, Vercel or automation-policy change requires explicit owner approval.
- Branch autonomy does not authorise force-pushes, history rewrites, branch deletion, check bypass,
  destructive database operations, secret disclosure or changing remote protection rules. These
  remain separately controlled.
- Keep Hermes command approvals in `smart` mode. Do not disable global safety controls to implement
  branch-specific autonomy.
- For unattended work, follow `docs/overnight-agent-plan.md`; its narrower overnight boundaries
  override the broader daytime `dev`/`main` autonomy for that run.

## Source of truth order
1. `AGENTS.md`
2. `docs/current-state.md`
3. `docs/consolidated-open-items-plan.md`
4. `CODEX_HANDOFF.md`
5. `docs/project-brief.md`
6. `TECHNICAL_SPECIFICATION_AND_SYSTEM_HANDOFF.md`
7. `PROJECT_SCOPE_UI_UX_AND_IMPLEMENTATION_PLAN.md`
8. Latest pull requests and commits
9. Live Supabase checks

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

## Dependency and tool readiness

- Before starting a task, check whether the repository already declares the required dependency
  and whether the local installed version matches it.
- If a missing dependency, Codex skill or add-on would materially improve the work, do not silently
  work around it. Install the project-pinned option when the install is safe and within the approved
  task scope; otherwise tell Aaron exactly what is needed, what it enables and what help or approval
  is required.
- Prefer reproducible project dependency files and pinned versions. Do not expose secrets, alter
  Production, or make an irreversible system-wide change as part of setup.
- Verify each installation and record it in the task handoff so the next agent can reuse it.

For the Supabase-backed Python scraper tools, install the pinned client with:

```bash
python -m pip install --requirement scraper/requirements-supabase.txt
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
- **Confirm with the owner before:** any destructive DB op (DELETE/DROP/TRUNCATE), anything touching
  secrets, any Production-system change, and any merge or push to `prod`.
- Dev-only additive schema, RLS/Auth, Edge Function and role-enum work follows the pre-approved
  non-production gates in `Development autonomy and production boundary` above.
- Workflow changes may move through `dev` and `main` without separate approval only when review
  proves they use Dev targets exclusively. Any workflow path capable of selecting Production,
  using Production secrets or changing production schedules requires explicit owner approval.
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
- Before every commit or consequential GitHub CLI action, verify the repository identity is
  `Aaron Mullane <admin@sportstackapp.com.au>` and the active GitHub CLI account is
  `SportStackApp`. Checkouts outside `C:\Projects\SportStack` may need a repository-local Git
  identity override. Keep a working HTTPS remote unless the documented SSH alias has been verified
  on the current Windows profile.
- `.github/workflows/*.yml` are a special case because scheduled workflows run from GitHub's
  default branch (`main`) and select Dev or Production through different secret names. Review the
  target secrets before merging workflow changes to `main`; get owner confirmation whenever a
  Production target, Production secret selector or production schedule can be affected.
- Never force-push `dev`, `main` or `prod`, rewrite their history, delete them or bypass required
  checks without explicit owner approval.
- Branches: `fix/…`, `feat/…`, `chore/…`. Commits: `type(scope): summary`.

## Obsidian / Big Brain vault notes

- The active Obsidian vault is `C:\Users\mulla\OneDrive\Documents\Big Brain`. The committed
  repository notes remain the source of truth. Big Brain contains a generated,
  read-only mirror plus four curated SportStack notes.
- At the start of meaningful work, run
  `pwsh -NoProfile -File scripts/sync-sportstack-notes-to-obsidian.ps1 -Fetch`, then read:
  - `10 Projects/Professional/SportStack/Project.md`
  - `10 Projects/Professional/SportStack/Status and Planning/SportStack Focus.md`
  - `20 Areas/Shared Systems/Technology and Accounts/Status and Planning/Open Items.md`
  - the mirrored `Projects/SportStack Repository/_Index.md`
- During meaningful work, update the appropriate repository source: `docs/current-state.md`,
  `CODEX_HANDOFF.md`, `docs/scraper-operations.md`, `notes/known-issues.md`, or another scoped note.
- After the canonical change is committed and pushed to `dev`, run the sync again followed by
  `pwsh -NoProfile -File scripts/sync-sportstack-notes-to-obsidian.ps1 -Check`. Do not report the
  documentation as complete unless both commands pass.
- Update a curated Big Brain note directly only when its owned boundary, priority or action status
  changes. Do not duplicate changing release detail there; link to the generated repository mirror.
- If the Vault or OneDrive is unavailable, report `OBSIDIAN SYNC PENDING` in the handoff instead of
  silently treating the notes as current.
- The sync whitelist contains only root Markdown and Markdown under `docs/` and `notes/`, plus the
  extensionless Planner note. Never add `.env`, secrets, database dumps, SQL backups, `data/`, logs
  or credentials to the mirror.

## How to report completed work
1. Plain-English summary of what changed and why.
2. List of files changed.
3. Exactly what the owner should test next.
4. Risk level and whether a DB migration is included.
5. Whether `docs/current-state.md` needs updating after the task.
