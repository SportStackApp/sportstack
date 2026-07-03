# SportStack Project Brief

## What This Project Is

SportStack is a private browser-based sports management app for clubs, associations, teams, players, fixtures, rosters, line-ups, venues, and admin workflows.

The current app is hockey-focused, but decisions should avoid blocking future multi-sport support.

## Current Stack

- React
- TypeScript
- Vite
- Tailwind CSS
- shadcn/ui components
- React Router
- Supabase for auth, database, storage, migrations, and Edge Functions
- Vercel for deployment

## Current Priority

Keep work focused on the existing SportStack app and the next MVP voting module work.

Near-term priority areas:

- Admin data quality and import flows
- Team, club, association, division, venue, fixture, and player management
- Bulk player import reliability
- RevSports data staging
- MVP voting module
- Safe, clear admin workflows

## MVP Voting Module

The MVP voting module is built and live. It works as follows:

- Players voting 3/2/1 for best-on-ground style points
- Only players who attended a game can vote or be voted for
- No self-votes
- Unique private voting links, not user account login
- A 72-hour voting window
- Reminder emails at 48 hours and 24 hours
- Admin reopen, resend, close, and adjustment tools
- Full audit logging for admin changes
- RevSports scraped data staged before matching to real profiles

Current voting-related database tables:

- `revsports_players` stores scraped player/game data
- `mvp_voting_sessions` stores one voting session per game
- `mvp_vote_tokens` stores private voting tokens
- `mvp_votes` stores vote lines
- `mvp_vote_audit` stores admin change history

## Architecture Rules

- Supabase is the source of truth for shared app data.
- Keep admin scope checks in place. Do not bypass role or team/club/association restrictions.
- Keep public links private and token-based where required.
- Do not expose private tokens, admin-only data, or sensitive player details in public screens.
- Prefer readable, direct code over clever abstractions.
- Keep changes small unless a broader refactor is explicitly requested.
- If a database field has moved to a join table, use the join table as the source of truth.
- For team divisions, prefer `team_divisions` joined to `divisions` when the plain text `teams.division` field is missing or unreliable.
- For team membership status, use the real enum values in the database.
- Any team picker must use the full cascade: association, then club, then division, then team. Do not allow team selection before division because many teams share names such as Gold, Blue, Blaze, or Pumas across divisions.

## Current Data Notes

- Teams may have a plain text `division` value, but the stronger source is `team_divisions` joined to `divisions`.
- `teams.home_venue_id` is used by the Teams admin edit form.
- Bulk import should not send invitation emails to players.
- Bulk imported users may be created without a real password flow and invited separately later.
- RevSports scraper output is not yet the final source of player profiles.

## Important Routes

Public and auth:

- `/`
- `/login`
- `/signup`
- `/forgot-password`
- `/reset-password`
- `/pending`
- `/vote/:token` (public token-based voting link)

Protected app:

- `/dashboard`
- `/games`
- `/games/:id`
- `/games/:id/lineup`
- `/roster`
- `/coaching`
- `/coaching/:playerId`
- `/chat`
- `/profile`
- `/voting`
- `/mvp-votes`
- `/mvp-votes/:sessionId`
- `/umpire/vote`

Admin:

- `/admin`
- `/admin/associations`
- `/admin/competitions`
- `/admin/clubs`
- `/admin/teams`
- `/admin/divisions`
- `/admin/users`
- `/admin/add-player`
- `/admin/bulk-import`
- `/admin/revsports-mappings`
- `/admin/revsports-unmatched`
- `/admin/revsports-entities`
- `/admin/fixtures`
- `/admin/fixture-import`
- `/admin/venues`
- `/admin/requests`
- `/admin/mvp-voting`
- `/admin/analytics`

Entity dashboards:

- `/associations/:id`
- `/clubs/:id`
- `/admin/division`
- `/teams/:id`

## Do Not Build Unless Explicitly Asked

- Commercial or multi-tenant features
- Broad multi-sport rewrites
- Full custom formation builder
- Push notification wiring
- New major modules outside the requested task
- Large UI redesigns when a small admin fix was requested

## Working Rules For Codex

Before coding:

- Read this file.
- Check the exact file or flow the user named.
- Confirm the files planned for editing when the task is broad.
- Keep the scope tight.

When coding:

- Do not change unrelated files.
- Do not refactor nearby code just for neatness.
- Use existing app patterns and components.
- Keep user-facing text in Australian English.
- Do not read, print, or expose `.env` or `.env.local`.
- Confirm before destructive actions.

After coding:

- Explain what changed in plain language.
- List the files changed.
- Run `npm run build` for code changes unless there is a clear reason not to.
- Tell Aaron exactly what to test next.

## Useful Commands

```bash
npm install
npm run dev
npm run build
npm run lint
```

## Known Parked Items

- Duplicate team names in fixture import can cause the importer to pick the wrong team. A preview warning is the preferred short-term direction.
- Push notification UI exists but is not wired.
- Custom formation builder is parked until core features are stable.
- Multi-sport support is a future goal, not current scope.
- Root `test_*.js` files may be old investigation scripts and should be reviewed before cleanup.
- Permission re-scope: add explicit concepts for vote-submission visibility, committee access, committee president access, and module enable/disable by association, club, division, and team.
- Permission re-scope: parent permissions should flow down, but child scopes need clear exclude/override rules with warning prompts.
- User profile address structure is parked for a later structured-address pass; keep current address changes small.
- Formation/pitch rotation for mobile is parked for a later lineup/formation builder pass.
