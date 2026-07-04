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

- Formation Builder Phase 1 field-template compatibility support was added without applying migrations or changing live Supabase data.
- Existing formations still fall back to legacy pitch/grid/boundary fields when `field_templates` is unavailable.
- Formation Builder reliability was improved: safer position saves, stable position edit keys, hidden formation recovery, whole-tile library clicks, save validation, and stable default seeding.
- Formation Builder library safety was improved: real delete button, delete confirmation, fixture-line-up usage block before delete, clearer hide/unhide controls, and unsaved-change protection before switching formations or starting a new draft.
- App version bumped to `v2026.07.04.2123`.

Files changed:

- `src/lib/formationPlanner.ts`
- `src/pages/coaching/FormationBuilder.tsx`
- `src/components/lineup/LineupView.tsx`
- `src/lib/appVersion.ts`
- `docs/current-state.md`

Checks run:

- `npx tsc --noEmit` passed.
- Focused ESLint passed with existing React hook dependency warnings only.
- `npm run build` passed.
- Browser smoke check confirmed `/coaching/formations` loads and the Delete confirmation dialog renders.

What Aaron should test next:

- Aaron confirmed the Formation Builder reliability and library-safety block passed manual testing.
- Next test block should focus on the remaining pitch/position controls: position movement/editing, icon sizing, pitch zoom, and orientation controls.

Risk level:

- Medium. App-code only. No database migration, no live Supabase data changes, no generated Supabase type edits, no feedback items closed.

## How to update this file

When Codex finishes a task, add a dated entry with:

- What changed
- Files changed
- Checks run
- What Aaron should test next
- Risk level
- Any unknowns that still need confirmation
