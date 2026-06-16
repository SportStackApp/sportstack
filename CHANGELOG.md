# Changelog

All notable repository-level changes should be recorded here.

## Unreleased

### Added

- Added repo-root documentation handoff files for future agents and contributors:
  - `CODEX_HANDOFF.md`
  - `.env.example`
  - `CONTRIBUTING.md`
  - `TESTING.md`
  - `SECURITY.md`
  - `DATABASE.md`
  - `DEPLOYMENT.md`
  - `CHANGELOG.md`

## Known milestones

- SportStack established as a private React + TypeScript + Vite SPA using Tailwind CSS, shadcn/ui, React Router, Supabase, and Vercel.
- Supabase is used for auth, database, storage, migrations, and Edge Functions, with one shared project for development and production data.
- RevSports scraping workflows stage external hockey data into `revsports_*` tables before mapping and importing into live app tables.
- Admin data quality and import workflows are active priority areas.
- MVP voting module direction documented, including private voting links, 3/2/1 votes, attendance eligibility, voting windows, reminders, admin controls, and audit logging.
