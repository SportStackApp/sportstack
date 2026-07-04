# SportStack Current State

Last updated: 2026-07-04

This file is the short, current project status for ChatGPT, Codex, and Aaron.

Update this file after every meaningful Codex task, pull request, schema change, deployment, or confirmed live-data check. If this file conflicts with older handoff documents, this file wins unless Aaron says otherwise.

## Source of truth order

1. `AGENTS.md`
2. `docs/current-state.md`
3. `CODEX_HANDOFF.md`
4. `docs/project-brief.md`
5. `TECHNICAL_SPECIFICATION_AND_SYSTEM_HANDOFF.md`
6. `PROJECT_SCOPE_UI_UX_AND_IMPLEMENTATION_PLAN.md`
7. Latest pull requests and commits
8. Live Supabase check

## Current priority

Keep work focused on the existing SportStack web app and the next MVP voting/data-quality work.

Near-term priority areas:

- MVP voting flow reliability
- Admin data quality and import flows
- RevSports scraper/import alignment
- Team, club, association, division, venue, fixture, and player management
- Safe, clear admin workflows

## Current stack

SportStack is a React + TypeScript + Vite single-page app using Tailwind CSS, shadcn/ui, React Router, Supabase, and Vercel.

The backend is Supabase: Postgres, Auth, Storage, Row Level Security, and Edge Functions. RevSports data is scraped by Python scripts and GitHub Actions, staged into `revsports_*` tables, mapped, then imported into live app tables.

## Confirmed operating rules

- Non-workflow changes should go to `dev` first, then merge to `main` when ready.
- Pushes to `main` can deploy to Vercel.
- Treat the live Supabase project as real production data.
- Do not expose `.env`, `.env.local`, Supabase service-role keys, private voting tokens, or other secrets.
- Confirm with Aaron before destructive database work, schema migrations, RLS/auth changes, Edge Function changes, role enum changes, secrets work, or deployment-sensitive work.
- Use Australian English in user-facing text.
- Use `DD/MM/YYYY` dates and respect the association timezone where relevant.

## Recently changed

Recent repo evidence shows MVP voter access and app feedback work landed after the older handoff documents were written.

Known recent themes:

- Voter-only MVP session discovery was adjusted.
- Primary/secondary voter team switching was added.
- App metadata was renamed to SportStack.
- `app_feedback` support was added.
- Some older lint issues may still exist outside the touched files.

## Known broken / uncertain

Treat these as current caution areas unless a newer live check proves otherwise:

- Older handoff docs may be stale in places.
- MVP voting status differs across docs: some say built/live, others say partial. Check current code, latest PRs, and live data before planning voting work.
- Email sending/reminders for MVP voting need confirmation before assuming they are fully implemented.
- Fixture `division_id` / `season_id` reliability needs confirmation before joining fixtures directly to divisions.
- Live Supabase schema can drift from migration files, so verify live schema before database-dependent work.
- Edge Functions in the repo and deployed Edge Functions may be out of sync.
- There is no formal automated test suite yet.

## Current Codex handoff template

After each Codex task, update this section or append a dated entry below.

### Latest handoff entry

Date: 2026-07-04

What changed:

- Added this current-state handoff file.
- Updated agent/human start instructions to read this file before older handoff documents.

Files changed:

- `docs/current-state.md`
- `AGENTS.md`
- `README.md`

Checks run:

- Documentation-only change. No build, lint, or type check required.

What Aaron should test next:

- Ask Codex to read `AGENTS.md` and `docs/current-state.md` first, then confirm it understands the current source-of-truth order before doing code work.

Risk level:

- Low. Documentation-only. No app code, database, secrets, migrations, workflows, or deployment config changed.

## How to update this file

When Codex finishes a task, add a dated entry with:

- What changed
- Files changed
- Checks run
- What Aaron should test next
- Risk level
- Any unknowns that still need confirmation
