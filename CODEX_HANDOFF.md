# Codex Handoff

Last updated: 2026-07-25

Future agents should start by reading these files in order:

1. `AGENTS.md` — repository rules, safety constraints, release path and testing expectations.
2. `docs/current-state.md` — current implementation, deployment and owner-test status.
3. `docs/project-brief.md` — concise product and architecture context.
4. `TECHNICAL_SPECIFICATION_AND_SYSTEM_HANDOFF.md` — fuller technical context when needed.
5. `PROJECT_SCOPE_UI_UX_AND_IMPLEMENTATION_PLAN.md` — older scope and UI/UX direction.

## Current release state

- `dev` and `origin/dev` are clean and aligned at `b036940`.
- Vercel reports the Dev deployment successful at `https://dev.sportstackapp.com.au`.
- SportStack Dev includes the two additive team-position RLS migrations recorded in
  `docs/current-state.md`. No test rows or destructive data changes remain.
- `main`, `prod`, Production Auth and Production data were not changed in the latest work.
- Aaron has approved non-destructive Development work without a separate confirmation pause.
  Still confirm destructive database actions, secrets, Production changes and promotions to
  `main` or `prod`.

## Latest completed work

- Removed the Player dashboard `Needs attention` strip, Player `Statistics` navigation and the
  confusing duplicate Team dashboard shortcut.
- Fixed Pumas/Lucas HC switching and the Association dashboard header flicker by updating the
  full Association -> Club -> Division -> Team scope atomically.
- Added player Division dashboard access with full-division KPIs, ladder and upcoming fixtures.
- Made player position preferences compact and sourced them from team-owned formation positions.
- Strengthened Primary, Secondary and Fill-in badge colour differences.
- Verified Dev RLS allows active regular members to read only their own team position definitions.

## Verification completed

- Focused ESLint: zero errors and one existing Fast Refresh warning.
- `npx tsc --noEmit`: passed.
- `npm run build`: passed.
- Full lint still has a known repository-wide backlog of 433 errors and 89 warnings outside the
  changed files.
- Authenticated Dev browser checks passed for Pumas landing, Lucas switching, Division dashboards,
  stable Association headers, Profile position panels and 375-pixel mobile width. Console clean.

## Best next owner test

1. Switch Pumas -> Lucas HC -> Pumas and open each Division dashboard.
2. Check the compact position panels and membership badge colours in light mode.
3. Pumas and Lucas HC currently have no team-owned formation positions. When ready, configure one
   position for a team and confirm it appears only for that team's player and coaching profiles.

Keep Player MVP Voting and Umpire Match Voting separate. Hockey Trace remains parked.
