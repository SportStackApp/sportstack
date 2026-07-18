# SportStack — Session Handoff

## Umpire Match Voting UI — Phase 4 & 5 Complete

> Terminology clarification added 16 July 2026: this historical record is about **Umpire Match Voting**, not Player MVP Voting. The active workflow uses the historical `player_vote_submissions`, `player_vote_lines`, and `player_vote_edits` identifiers. Historical screen labels such as "Player Votes" are preserved where quoted. They describe the player-specific fields in the implementation at the time, not a product rule restricting Umpire Match Voting to players; the canonical purpose covers eligible people associated with the completed fixture.

**Date:** 1 June 2026

---

## What We Did This Session

Built the Umpire Match Voting submission UI in SportStack and completed all
umpire account setup. The old HB Umpire Portal data was already
migrated (previous session). This session focused on creating umpire
accounts and building the core Umpire Match Voting interface.

---

## Phase 4 — Umpire Accounts ✅

### New role added
- `UMPIRE_ADMIN` added to the `user_role_enum` enum in SportStack's
  Supabase database (`svierarfcolhcfjpmwck`)

### 18 umpire accounts created
All created with `test+` prefixed emails so no real emails are sent.
Profiles populated with names, `is_umpire = true` set on all.

| Name | Test Email | Role |
|---|---|---|
| Ben Sturmfels | test+ben@stumbles.id.au | UMPIRE |
| Mitchell Stevens | test+mitchstevo2020@gmail.com | UMPIRE |
| Jo (President) | test+president@hockeyballarat.com.au | UMPIRE_ADMIN |
| I Edgar | test+i.edgar@hotmail.com | UMPIRE |
| Treasurer HB | test+treasurer@hockeyballarat.com.au | UMPIRE_ADMIN |
| Tucker Kooloos | test+kooloostucker@gmail.com | UMPIRE |
| Sara Weuffen-Humphrey | test+saxa8207@hotmail.com | UMPIRE |
| Ethan Oldaker | test+ethanoldaker238@gmail.com | UMPIRE |
| Jason Hargreaves | test+jasonh@countpro.com.au | UMPIRE |
| Shepherd J | test+shepherdj03@gmail.com | UMPIRE |
| Joshua Sly | test+joshuasly@mail.com | UMPIRE |
| Jeff Sly | test+jeff.sly@mail.com | UMPIRE |
| L Drury | test+ldrury1981@gmail.com | UMPIRE |
| Lily Drury | test+lilydrury25@gmail.com | UMPIRE |
| Nicholas Hargreaves | test+n.excalibur@hotmail.com | UMPIRE |
| Hayden Bourne | test+haydenbourne421@gmail.com | UMPIRE |
| Craig Stevens | test+craigstevens7171@gmail.com | UMPIRE |
| Daniel Ryan | test+diryan@outlook.com | UMPIRE |

**Note:** `ldrury1981` and `shepherdj03` only had usernames —
placeholder names used (L Drury, Shepherd J). Update when real
names are known.

### Umpire Match Voting submissions re-linked
- 48 of 49 submissions in `player_vote_submissions` now have
  `umpire_user_id` populated
- 1 submission remains NULL (no email stored in old portal —
  unfixable)
- Re-link was done by matching `legacy_umpire_email` to
  `test+` + email in `auth.users`

### Re-link SQL (safe to re-run anytime)
When umpires eventually sign up with their real emails, update
their `auth.users` email from `test+x` to `x` and all history
stays intact. Or run this after real accounts are created:

```sql
UPDATE public.player_vote_submissions pvs
SET umpire_user_id = u.id
FROM auth.users u
WHERE u.email = pvs.legacy_umpire_email
  AND pvs.umpire_user_id IS NULL;
```

---

## Phase 5 — Umpire Match Voting Submission UI ✅

### New file created
`src/pages/umpire/UmpireVoteSubmit.tsx`

### New route added in App.tsx
`/umpire/vote` — protected, UMPIRE and UMPIRE_ADMIN roles only.
Non-umpires are redirected to `/dashboard`.

### Features built
- 3-step wizard: Match Info → Player Votes → Confirm & Submit
- **Association-aware filtering:**
  - Super Admin → shows Association dropdown (all 3 associations)
  - Single-association user → auto-selects, no dropdown shown
  - Multi-association user → shows dropdown
- **Cascade dropdowns:** Association → Round → Division → Fixture
  (each activates only after the one above is selected)
- **Umpire Match Voting proxy submission:** checkbox at top of Step 1; when ticked shows
  umpire name + reason fields (both required)
- **Vote structure by division type:**
  - Senior (Division 1 Open, Division 1 Women, Division 2 Open):
    3 cards — Best on Ground (3pts), Second Best (2pts), Third Best (1pt)
  - Junior (Under 11/13/14/16): 4 cards — Best Male (2pts),
    Second Male (1pt), Best Female (2pts), Second Female (1pt)
- **Player name autocomplete** from `player_vote_lines.player_name`
  (ILIKE, min 2 chars)
- **Validation:** each card requires name OR number (not both)
- **Submit:** inserts into `player_vote_submissions` then
  `player_vote_lines` sequentially
- **Success state:** "Vote Submitted Successfully!" with
  Submit Another Vote button

### Key schema notes
- `player_vote_lines` uses column `votes` not `points`
- `player_vote_lines` has no `vote_rank` column (omitted)
- Bye fixtures filtered by `away_team_id IS NOT NULL`
  (no `is_bye` column in SportStack fixtures)
- PostgREST inner join used for association filtering:
  `divisions!inner(association_id)` with `(supabase as any)` cast
  to avoid TypeScript errors from outdated type definitions

### Testing confirmed
- ✅ Non-umpire redirected to dashboard
- ✅ Super Admin sees association dropdown with all 3 associations
- ✅ Selecting Hockey Ballarat shows only HB divisions (no duplicates)
- ✅ Full vote submitted end-to-end successfully
- ✅ Zero TypeScript errors (`npx tsc --noEmit` passed)
- ✅ Committed and pushed to `dev` branch

---

## What Was NOT Done This Session

- ❌ Admin Submissions list page not yet built
- ❌ Leaderboard page not yet built
- ❌ Admin Dashboard not yet built
- ❌ `UMPIRE` role not yet visible in the Manage Roles UI
  (currently only assignable via database)
- ❌ Sidebar menu not yet simplified for umpire-role users
- ❌ "Lucas HC vs Gold" team display name — "Gold" should show
  full name (e.g. EGC Gold) — likely a short name issue in the
  teams table
- ❌ Umpires not yet invited with real emails (all still on
  test+ prefix)
- ❌ Old portal still live (do not shut down yet)

---

## Other SportStack Items Still in Queue

| Item | Notes |
|---|---|
| Teams page filters + Association column | Deferred |
| Venues edit bug | Fails with "Failed to update venue" |
| Fixtures form team dropdowns | Not populating |
| Bobcats White unknown mapping | Waiting on cascade selector |
| SUPER_ADMIN seed migration | Not started |
| RLS policies for Player MVP Voting tables | Required before go-live |
| Player MVP Voting admin dashboard | Not started |
| RevSports full scrape re-import | Not completed |

---

## Branch Status

- All Umpire Match Voting work committed and pushed to `dev`
- `main` branch unchanged
- Merge to `main` when ready for production deploy
