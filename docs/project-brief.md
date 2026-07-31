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

## Deployment Environments

| Stage | Git branch | Public address | Supabase project |
|---|---|---|---|
| Development | `dev` | `https://dev.sportstackapp.com.au` | SportStack Dev `icqegnpjbizccjebjfhb` |
| Main/staging | `main` | `https://main.sportstackapp.com.au` | SportStack Dev `icqegnpjbizccjebjfhb` |
| Production | `prod` | `https://sportstack.grampianshockey.com.au` | SportStack Production `svierarfcolhcfjpmwck` |

App changes move through `dev` -> `main` -> `prod`. `prod` is the Vercel Production Branch and
must not be updated without explicit production approval. `www.sportstackapp.com.au` is outside
this rollout and remains unchanged.

## Current Priority

Keep work focused on the existing SportStack app and the next Player MVP Voting work.

Near-term priority areas:

- Admin data quality and import flows
- Team, club, association, division, venue, fixture, and player management
- Bulk player import reliability
- RevSports data staging
- Player MVP Voting
- Umpire Match Voting
- Safe, clear admin workflows

## Voting modules

SportStack has two separate voting modules. They must not share a generic name in documentation, UI planning, permissions, tests, or future code.

| Canonical name | Audience | Purpose | Short UI label | Suggested future code namespace |
|---|---|---|---|---|
| **Player MVP Voting** | Players | Players vote for their peers after a game | **Player MVP** | `player_mvp` |
| **Umpire Match Voting** | Assigned or authorised umpires | Umpires submit official post-match votes for eligible people associated with a completed fixture | **Umpire Votes** | `umpire_match_votes` |

These modules have separate audiences, permissions, workflows, submissions, and results. Do not describe either one only as "Voting", "Votes", "the voting module", or "the MVP module" where the meaning could be unclear.

### Current identifier mapping

The current code and older exported material use identifiers from different schema snapshots:

| Identifier | Canonical meaning and scope |
|---|---|
| `mvp_*` | Current **Player MVP Voting** implementation. Current examples include `mvp_voting_sessions`, `mvp_vote_submissions`, `mvp_votes`, and `mvp_vote_audit`. |
| `player_vote_*` | Current active **Umpire Match Voting** implementation. The `player_` prefix is historically misleading. Current examples are `player_vote_submissions`, `player_vote_lines`, and `player_vote_edits`. |
| `vote_submissions`, `vote_lines`, `vote_edits` | Older or exported **Umpire Match Voting** identifiers. These exact unprefixed names are not present in the current repository code or generated Supabase types, but documentation must not imply that they never existed. |
| `umpire_vote_*` | A separate umpire-related or umpire-rating schema family. Generated columns describe ratings of umpires linked to `umpire_fixtures`; its current product purpose is **UNKNOWN — needs confirmation**. Do not silently assign it to either canonical module. |

Current routes and code identifiers follow the same mapping:

- Player MVP Voting currently uses `/mvp-votes`, `/mvp-votes/:sessionId`, `/admin/mvp-voting`, `MvpVotes`, `MvpVoteCast`, `MvpVotingAdmin`, and the `mvp_*` objects above.
- Umpire Match Voting currently uses `/umpire/vote`, `/admin/umpire-voting`, `UmpireVoteSubmit`, `UmpireVotingModule`, `umpireVoteSchemes`, and the `player_vote_*` objects above.

Renaming existing routes, components, services, hooks, database objects, tests, or production schema is outside this documentation rule. Any future rename needs its own reviewed compatibility and migration plan.

### Documentation-only follow-up candidates

These existing identifiers are not renamed by this terminology pass:

- Player MVP Voting UI labels: `Voting Sessions`, `Manage Voting`, and `MVP Votes`. Prefer **Player MVP Sessions**, **Manage Player MVP Voting**, **Player MVP Results**, or **Player MVP Ballot** according to context. Use **Player MVP** where space is limited.
- Umpire Match Voting UI labels: `Umpire Voting`, `Vote Submission`, `Vote Submissions`, `Player Votes`, and `UMPIRE VOTE PORTAL`. Prefer **Umpire Match Submissions**, **Manage Umpire Match Voting**, **Umpire Match Results**, **Umpire Match Ballot**, or **Votes Awarded** according to context. Use **Umpire Votes** where space is limited. `Player Votes` is especially ambiguous because it could mean votes cast by players or votes awarded by umpires.
- Cross-module permission and description copy also needs a future UI review. Current examples include `Administer voting sessions`, `View admin results unless separately authorised`, `Umpire voting and related fixture context`, `Their own umpire vote submission`, `Record best-player votes for matches in SportStack`, and `umpire best-player votes`. The last two also narrow the Umpire Match Voting product definition and should be replaced with official post-match or eligible-person wording.
- Player MVP Voting routes/components/services: `/vote/:token`, `/voting`, `/mvp-votes`, `/mvp-votes/:sessionId`, `/admin/mvp-voting`, `VotingPortal`, `MvpVotes`, `MvpVoteCast`, `MvpVotingAdmin`, `mvpVoting`, and `mvp-voting-email-reminders`.
- Umpire Match Voting routes/components/services: `/umpire/vote`, `/admin/umpire-voting`, `UmpireVoteSubmit`, `UmpireVotingModule`, and `umpireVoteSchemes`.
- Database families: `mvp_*` belongs to Player MVP Voting; `player_vote_*` belongs to the active Umpire Match Voting workflow despite its name. The separate `umpire_vote_*` rating family needs confirmation before any rename or reuse.
- No voting-specific hook or current test name was found. Add future tests under explicit `player_mvp` or `umpire_match_votes` naming.

## Player MVP Voting

Player MVP Voting is built and live. It works as follows:

- Players voting 3/2/1 for best-on-ground style points
- Only players who attended a game can vote or be voted for
- No self-votes
- Unique private voting links, not user account login
- A 72-hour voting window
- Reminder emails at 48 hours and 24 hours
- Admin reopen, resend, close, and adjustment tools
- Full audit logging for admin changes
- RevSports scraped data staged before matching to real profiles

Current Player MVP Voting database tables:

- `revsports_players` stores scraped player/game data
- `mvp_voting_sessions` stores one voting session per game
- `mvp_vote_tokens` stores private voting tokens
- `mvp_votes` stores Player MVP Voting vote lines
- `mvp_vote_audit` stores admin change history

## Umpire Match Voting

Umpire Match Voting is the official completed-fixture workflow used by assigned or authorised umpires to submit votes for eligible people associated with the fixture. Its product definition is not restricted to players. The current submission fields and `player_vote_submissions`, `player_vote_lines`, and `player_vote_edits` names are player-specific implementation or legacy naming limitations; they must not be used to narrow the module's purpose or as the module name.

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
- `/vote/:token` (legacy Player MVP Voting token route)

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
- `/voting` (legacy Player MVP Voting portal route)
- `/mvp-votes` (Player MVP Voting)
- `/mvp-votes/:sessionId` (Player MVP Voting submission/result flow)
- `/umpire/vote` (Umpire Match Voting submission)
- `/committee` (private committee setup, polls, meetings, minutes, chat and activity)

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
- `/admin/mvp-voting` (Player MVP Voting administration)
- `/admin/umpire-voting` (Umpire Match Voting administration)
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

- Duplicate team names in fixture import are blocked on Dev unless the exact Club - Division - Team label is used.
- Push notification UI exists but is not wired.
- Formation and saved field-template reliability is implemented on Dev pending owner smoke testing.
- Multi-sport support is a future goal, not current scope.
- Root `test_*.js` files may be old investigation scripts and should be reviewed before cleanup.
- Scoped module controls and committee setup/operations are implemented on Dev. Fine-grained
  Player MVP Voting and Umpire Match Voting submission/result visibility remains parked.
- Safety Hub registers and their guided forms are live on Dev with scoped writes, permanent links,
  risk/committee reviews and append-only audit history. Owner smoke testing is still pending.
- Module settings now inherit from the closest parent and child overrides have warning prompts.
- User profile address structure is parked for a later structured-address pass; keep current address changes small.
- Formation/pitch rotation for mobile is parked for a later lineup/formation builder pass.
