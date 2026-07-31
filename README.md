# SportStack

SportStack is a private React + TypeScript + Vite sports management app for clubs, associations, teams, players, fixtures, rosters, line-ups, venues, and admin workflows. It uses Tailwind CSS, shadcn/ui, and Supabase.

## Start here

Read these documents before making changes:

- [Agent instructions](AGENTS.md)
- [Current state](docs/current-state.md)
- [Codex handoff](CODEX_HANDOFF.md)
- [Project brief](docs/project-brief.md)
- [Voting modules terminology](docs/project-brief.md#voting-modules)
- [Technical specification and system handoff](TECHNICAL_SPECIFICATION_AND_SYSTEM_HANDOFF.md)
- [Project scope, UI/UX, and implementation plan](PROJECT_SCOPE_UI_UX_AND_IMPLEMENTATION_PLAN.md)
- [Codex handoff extras](CODEX_HANDOFF_EXTRAS.md)

`docs/current-state.md` is the short, living status file. Update it after meaningful Codex tasks, pull requests, schema changes, deployments, or confirmed live-data checks.

## Voting modules

SportStack has two separate modules: **Player MVP Voting** for player-to-player voting, and **Umpire Match Voting** for official votes submitted by assigned or authorised umpires. Use **Player MVP** and **Umpire Votes** only as short UI labels. Do not use a generic "Voting" or "Votes" label where it could refer to either module.

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

## Deployment environments

| Stage | Branch | Address | Database |
|---|---|---|---|
| Development | `dev` | `https://dev.sportstackapp.com.au` | SportStack Dev |
| Main/staging | `main` | `https://main.sportstackapp.com.au` | SportStack Dev |
| Production | `prod` | `https://sportstack.grampianshockey.com.au` | SportStack Production |

App releases move from `dev` to `main`, then to `prod` after explicit production approval.

## Safety warnings

- Never expose Supabase service keys or any other server-only secrets.
- `dev` and `main` share the Dev Supabase project. `prod` uses a separate Production project.
- Treat Production data as real, and still handle Dev data carefully because it is shared by two stages.
- Do not touch database schema/data, RLS, auth, Edge Functions, or merge/push to `prod` without owner confirmation.

## Quality commands

Run these checks before completing work:

```bash
npm run lint:dev-plan
npm run lint
npx tsc --noEmit
npm run build
python -m unittest discover -s tests
```

The Dev Quality workflow runs the focused development-plan lint, TypeScript, build, Python and
workflow checks on every `dev` push and relevant pull request. Repository-wide lint still has a
known legacy backlog, so run it and report the result rather than hiding it. Signed-in user flows
still need the relevant manual smoke test.

## Future documentation

Add or expand these docs as the project matures:

- [Contributing guide](CONTRIBUTING.md)
- [Testing guide](TESTING.md)
- [Security policy](SECURITY.md)
- [Database guide](DATABASE.md)
- [Deployment guide](DEPLOYMENT.md)
