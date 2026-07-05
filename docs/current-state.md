# SportStack Current State

Last updated: 2026-07-05

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

Date: 2026-07-05

What changed:

- Formation Library remains the front door for saved formations, templates, and assets.
- `/coaching/formations` now opens the Formation Library; `/coaching/formations/builder` keeps the existing Formation Builder workbench.
- `/coaching/formations/templates/builder` opens the new Template Builder for reusable surface/template setup.
- Library cards show surface previews, position counts, owner level, default/hidden badges, search, owner/status filters, and tabs for Formations, Templates, and Assets.
- Builder links now support opening a selected formation from the library.
- Formation Builder's left mini-library panel was removed and replaced with a Canvas tools panel focused on position placement.
- Builder library-management controls were removed from the Builder: show hidden, favourite, hide/unhide, delete, and formation switching.
- Builder technical template controls were removed from the visible canvas area: surface image upload, rows, columns, and boundary sliders.
- Canvas tools now include read-only template summary, add-position fields, empty-template quick-pick messaging, show-grid toggle, snap-to-grid toggle, and front-end-only marker size.
- Position markers can be selected from the canvas or the positions list, dragged on the canvas, and highlighted while selected.
- Builder now warns about unsaved changes before leaving, creating a new formation, or changing template.
- Shared surface canvas behaviour now supports rotation, zoom in, zoom out, fit, reset, click placement, and drag placement.
- Template Builder includes template/surface controls, surface image selection/upload, grid and boundary settings, marker-size default, and a quick-pick placeholder where backend support is still missing.
- Library now combines surface images and icons under an Assets tab with front-end filters.
- Builder and Template Builder now save local front-end drafts so unsaved work can be restored after a window/tab refresh.
- Canvas zoom now keeps the canvas container stable and zooms the surface inside the scrollable viewport.
- Formation saves now keep copied surface/grid/boundary settings on the formation and clear the template link when the column is available, so later template changes do not alter saved formations.
- Formation and Template Builder toolbars show a saved timestamp after a successful save.
- Formation Library Assets now has separate type filters and ownership filters, including a Symbols placeholder.
- Formation Library now includes an Add asset dialog with type selection, upload preview, and icon/symbol focus controls as a front-end placeholder.
- Formation and template cards now show Delete buttons with confirmation, but real live deletion is blocked until backend usage checks are added.
- Template Builder now supports front-end local quick-pick position tiles that Formation Builder can load for the selected template.
- Formation Builder's positions list is more compact and no longer shows grid/percentage coordinates.
- Tidy-up pass: rotated canvas markers keep normal orientation, canvas zoom no longer leaves a large empty viewport at zoomed-out sizes, asset cards now show Delete, and Template Builder quick-pick inputs start blank.
- MVP vote casting page now shows a scoreboard-style match header with team logos/banners, score, round, time, pitch/venue, and date, and the duplicated "Round Round" label was removed from the visible page.
- MVP vote scoreboard now loads fixture score/date first, then team branding, venue, and pitch separately so one missing relationship does not blank the whole banner.
- MVP vote scoreboard now has a stronger sports-graphic layout, missing-score `VS` fallback, clickable score panels, and a goal-scorer dialog.
- Goal-scorer detail uses existing imported player goal counts when available. Timed goal events are not available yet, so scorer minutes remain future backend/import work.
- MVP vote scoreboard polish pass removed the visible duplicate division label, uses association context in the top pill when available, adds a clickable-score hint, and tightens team logo/name spacing.
- Backend migration `20260705044608_add_team_logo_url` added `teams.logo_url` for team-specific scoreboard logos and was applied to live Supabase.
- Admin Teams management now includes a team logo URL field, preview, and table thumbnail so team logos can be set without touching schema again.
- App version bumped to `v2026.07.05.0051`.

Files changed:

- `src/App.tsx`
- `src/components/formation/SurfaceCanvas.tsx`
- `src/lib/formationLocalState.ts`
- `src/pages/coaching/FormationLibrary.tsx`
- `src/pages/coaching/FormationBuilder.tsx`
- `src/pages/coaching/TemplateBuilder.tsx`
- `src/components/lineup/HockeyPitch.tsx`
- `src/pages/MvpVoteCast.tsx`
- `src/pages/admin/TeamsManagement.tsx`
- `src/lib/appVersion.ts`
- `supabase/migrations/20260705044608_add_team_logo_url.sql`
- `docs/current-state.md`

Checks run:

- `npx tsc --noEmit` passed.
- Focused ESLint passed with existing React hook dependency warnings only.
- `npm run build` passed.
- `npm run lint` was run and still fails on existing unrelated lint errors across older `modules/*` and other untouched files.
- Browser smoke check passed: Library loaded with Add asset/Create template/Create formation, formation cards showed Open/Delete, Assets showed separate Asset type and Ownership filters plus Symbols, Add asset opened the preview dialog, Formation Builder opened with Canvas tools and no mini-library controls, compact positions no longer showed grid coordinates, and Template Builder showed the quick-pick section. Tidy-up pass also passed TypeScript and focused ESLint before build.

What Aaron should test next:

- Open `/coaching/formations`.
- Check the Formation Library tabs: Formations, Templates, Assets.
- Open a template into Template Builder, add a quick-pick position, save, then create/open a formation from that template and confirm the quick-pick appears in Canvas tools.
- Search for a formation and open it into the builder.
- Confirm the Builder left panel says Canvas tools, not Library.
- Confirm there is no show hidden, favourite, hide, delete, formation-switching list, surface upload, row/column input, or boundary slider in the Builder.
- Add a custom position, place it on the surface, drag it, select it from the marker and compact positions list, then save and reopen the formation if you are happy to change that saved formation.
- Make an unsaved edit, switch away long enough for the app/browser to refresh, and confirm the draft restores when you return.

Risk level:

- Medium. App-code only. No database migration, no generated Supabase type edits, and no real Library delete operation added.

## How to update this file

When Codex finishes a task, add a dated entry with:

- What changed
- Files changed
- Checks run
- What Aaron should test next
- Risk level
- Any unknowns that still need confirmation
