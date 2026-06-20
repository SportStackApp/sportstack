# SportStack

SportStack is a private React + TypeScript + Vite sports management app for clubs, associations, teams, players, fixtures, rosters, line-ups, venues, and admin workflows. It uses Tailwind CSS, shadcn/ui, and Supabase.

## Start here

Read these documents before making changes:

- [Agent instructions](AGENTS.md)
- [Project brief](docs/project-brief.md)
- [Technical specification and system handoff](TECHNICAL_SPECIFICATION_AND_SYSTEM_HANDOFF.md)
- [Project scope, UI/UX, and implementation plan](PROJECT_SCOPE_UI_UX_AND_IMPLEMENTATION_PLAN.md)
- [Codex handoff extras](CODEX_HANDOFF_EXTRAS.md)

## Local setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

The local development server runs at:

```text
http://localhost:8081
```

## Environment variables

Only browser-safe Supabase variables should be used by the frontend:

```bash
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_publishable_key
VITE_SUPABASE_PROJECT_ID=your_project_id
```

Do not commit `.env.local` or any real environment values.

## Safety warnings

- Never expose Supabase service keys or any other server-only secrets.
- The live Supabase database is shared for dev and prod, so treat all data as real.
- Do not touch database schema/data, RLS, auth, Edge Functions, or anything that deploys to `main` without owner confirmation.

## Quality commands

Run these checks before completing work:

```bash
npm run lint
npx tsc --noEmit
npm run build
```

There is no automated test suite yet. Perform the relevant manual smoke test for any user-facing change.

## Future documentation

Add these docs when they are created:

- [Contributing guide](CONTRIBUTING.md)
- [Testing guide](TESTING.md)
- [Security policy](SECURITY.md)
- [Database guide](DATABASE.md)
- [Deployment guide](DEPLOYMENT.md)
