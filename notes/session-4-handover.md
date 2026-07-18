# 🔁 SportStack — Session Handover
**Date:** 23 May 2026 (Session 4)
**Dev branch:** `dev` | **Production:** `main` → sportstack.vercel.app
**Supabase project:** `svierarfcolhcfjpmwck` (SportStackApp)
**Local path:** `C:\Users\mulla\Projects\SportStackApp\sportstack`
**Local dev URL:** `http://localhost:8081`

---

## ✅ Completed This Session

### 1. Team Mappings page — grade/division context
- Added `grade` column to `revsports_team_mappings` table
- Changed unique constraint from `revsports_team_name` alone → compound `(revsports_team_name, grade)`
- Updated `RevSportsTeamMappings.tsx`:
  - Left column now shows: **Team Name · Grade** (e.g. "Blaze · Division 1 Men")
  - Right dropdown now shows: **Team — Division, Club** (e.g. "Blaze — Division 1, Hockey Ballarat")
  - Mappings state key is now a compound string: `"TeamName|||Grade"`
  - Save/upsert uses `onConflict: "revsports_team_name,grade"`
- ✅ Committed and pushed to `dev`

### 2. VOTER role added to the app
- Ran `ALTER TYPE user_role_enum ADD VALUE 'VOTER'` in Supabase (permanent — cannot be removed)
- Updated `src/integrations/supabase/types.ts` — added `"VOTER"` to the `app_role` union and Constants array
- Updated `src/hooks/useUserRole.ts` — added VOTER to hierarchy, display name ("Voter"), emoji (🗳️), and badge colour (amber)
- Updated `src/pages/admin/UsersManagement.tsx` — added VOTER to `ALL_ROLES` (NOT in `ROLES_NEEDING_SCOPE`)
- ✅ Build passed, committed and pushed to `dev`

---

## 📋 Full To-Do List (Prioritised)

> Ordered: quick wins → medium tasks → complex tasks with dependencies
> Times are rough estimates for a single focused session with Copilot assistance.

---

### 🟢 QUICK WINS — Under 30 minutes each

#### 1. Fix Venues bug — editing a venue fails
**What:** "Failed to update venue" error when editing any venue.
**Why first:** It's a bug blocking normal use. Likely a simple field type mismatch or missing column in the update payload.
**How:** Open Venues page → try editing → check browser console for the exact error → read `VenuesManagement.tsx` → fix the payload.
**Time:** ~20 min

#### 2. Fix Fixtures bug — teams not loading in Add Fixture form
**What:** Home Team / Away Team dropdowns are empty when adding a fixture.
**Why:** Broken query or missing filter — teams need a context (association/division) to load properly.
**How:** Read `FixturesManagement.tsx`, check the teams fetch query and what filters/state it depends on.
**Time:** ~30 min

#### 3. Investigate the legacy Player MVP Voting `VotingPortal.tsx` — token lookup returns "invalid"
**What:** the historical Player MVP Voting route `/vote/test-token-abc123` shows "Invalid Link" even though the token exists in the DB.
**Context:** RLS policies are confirmed correct. Likely a query structure issue in `VotingPortal.tsx` — the token lookup may be querying the wrong column or using the wrong filter.
**How:** Open browser console on `/vote/test-token-abc123`, read the error, check the Supabase query in `VotingPortal.tsx`.
**Time:** ~20–30 min

---

### 🟡 MEDIUM TASKS — 30–60 minutes each

#### 4. Teams page — add filters and Association column
**What:**
- Add filter controls (by Association, Club, Division) to the Teams page
- Add an "Association" column to the teams table display
**Note:** Associations are linked via Club → association_id (not directly on teams). The display name needs to be looked up via the club.
**Time:** ~45 min

#### 5. Teams edit/create form — add Association field + cascade selector
**What:** When creating or editing a team, the form should let you:
1. Pick an Association
2. Then pick a Club (filtered to that association)
3. Then pick a Division (filtered to that association)
**Why this order:** Fix for "Bobcats White Unknown" in Team Mappings depends on this being done first (the team was saved without an association link — needs to be re-saved with one).
**Time:** ~60 min

#### 6. Fix "Bobcats White" — Unknown in Team Mappings
**What:** Appears as "Unknown" in the right-side dropdown of Team Mappings because it has no association linked.
**Depends on:** Task 5 (cascade selector) must be done first.
**How:** After Task 5 is done, find Bobcats White in Teams page → edit → assign correct Association → save.
**Time:** ~15 min (trivial once Task 5 is done)

#### 7. Venue Mappings page
**What:** New page to map scraped venue names (from `revsports_players`) to Venues in the SportStack system.
**How:** Same pattern as Team Mappings page (use `RevSportsTeamMappings.tsx` as a template).
- New table needed: `revsports_venue_mappings` (columns: `revsports_venue_name`, `venue_id`, `created_at`)
- Page: scraped venue name on left → SportStack venue dropdown on right → Save All button
**Time:** ~45 min

#### 8. Venues page — change Association to multi-select
**What:** A venue currently supports one association. It should support multiple (e.g. a shared ground used by two associations).
**Requires:** DB schema change — new junction table `venue_associations(venue_id, association_id)` replacing the current `association_id` column on `venues`.
**⚠️ Risk:** Schema change affects existing venue data — must migrate existing `association_id` values to the new junction table before dropping the old column.
**Time:** ~45–60 min

---

### 🔴 COMPLEX TASKS — 60–120 minutes, some have dependencies

#### 9. Player Mappings — RevSports Hub Players tab
**What:** Map RevSports player names to SportStack player accounts.
- Left side: scraped player name + context (e.g. "Jason H. · Pumas · Division 1 Men")
- Right dropdown: SportStack player (e.g. "Jason Harris — Pumas, Division 1")
**Requires:** New DB table `revsports_player_mappings(id, revsports_player_name, grade, team, player_id FK → profiles, created_at)`
**Note:** Player disambiguation is harder than teams — names may be partial (first name + last initial only in RevSports). May need fuzzy matching.
**Time:** ~90 min

#### 10. Expand RevSports Mappings Hub to full tabbed view
**What:** Rename nav item to "RevSports Mappings", add tabs: Teams | Players | Clubs | Venues
- Teams tab: already exists ✅
- Players tab: Task 9 above
- Venues tab: Task 7 above (repackaged as a tab)
- Clubs tab: similar pattern, new table `revsports_club_mappings`
**Depends on:** Tasks 7 and 9
**Time:** ~60 min for the tab shell + wiring existing pages in

#### 11. VOTER dashboard
**What:** When a user with the VOTER role logs in, redirect them to a stripped-down dashboard (no sidebar) showing:
- Open Player MVP Voting sessions for games where scrape data confirms they played
- Their own historical Player MVP Voting choices
**Depends on:** Player Mappings (Task 9) — without this, the app can't know which games a voter played in.
**How:**
1. In `AuthContext.tsx` or `ProtectedRoute.tsx`, detect VOTER role → redirect to `/voter/dashboard`
2. Create `src/pages/VoterDashboard.tsx` — minimal layout, no sidebar
3. Add route in `App.tsx` outside the `<AppLayout>` wrapper
4. Query: Player MVP voter profile → player mapping → RevSports games → `mvp_voting_sessions`
**Time:** ~90–120 min

#### 12. Force password change on first VOTER login
**What:** When an admin creates a VOTER account, flag it so the voter must set a new password on their first login.
**How:**
1. Set `must_change_password: true` in Supabase user metadata when account is created
2. Check this flag in `AuthContext.tsx` on login
3. Redirect to a password change page if flag is set
4. Clear the flag after successful change
**Time:** ~60 min

---

### 🔧 MAINTENANCE & SECURITY

#### 13. WHA division data cleanup
**What:** Wimmera Hockey Association only has Under 16, Women, and Open. Under 11, 12, and 14 divisions don't exist in WHA but may be in the system.
**How:** Go to Supabase → Divisions table → delete incorrect WHA divisions. Also add WHA venue data if missing.
**Time:** ~20 min

#### 14. Duplicate team names across the app
**What:** Multiple teams called "Blaze", "Pumas" etc. with no disambiguation — causes confusion in dropdowns throughout the app.
**Options documented in:** `notes/known-issues.md`
**Time:** ~30 min (once an approach is agreed on)

#### 15. .env security — rotate credentials and purge Git history
**What:** Supabase credentials were accidentally committed to the GitHub repo. The file was removed from tracking but the credentials still exist in Git history.
**Steps:**
1. Rotate Supabase `anon` key and `service_role` key in Supabase dashboard
2. Update `.env` locally with new keys
3. Use `git filter-repo` or BFG Repo Cleaner to purge the old `.env` from history
4. Force-push the cleaned history to GitHub
**⚠️ Risk:** Force-pushing rewrites history — coordinate so no one else has a stale clone.
**Priority:** Low until closer to public launch, but should be done before going live.
**Time:** ~60 min

---

## 🛠️ Technical Notes (carry forward)

- `vercel.json` catch-all rewrite is required for SPA routing on Vercel — already in place ✅
- Never use `value=""` in shadcn `<SelectItem>` — use `"__none__"` as sentinel value
- PostgREST nested joins with aliases cause HTTP 500s — always use two separate queries instead
- PowerShell multi-line string edits are unreliable — use line-number array splicing
- Supabase "Success. No rows returned" on DDL (ALTER TABLE, etc.) is correct — not an error
- Dev server at localhost:8081 may need a re-navigate after Copilot saves files
- Supabase MCP auth token expires — if you see a permissions error on `list_migrations`, disconnect and reconnect the Supabase connector in Claude.ai Settings

---

## 🧰 Tools & Access

| Tool | Detail |
|---|---|
| AI coding | GitHub Copilot (VS Code) |
| Supabase dashboard | https://supabase.com/dashboard/project/svierarfcolhcfjpmwck |
| Vercel dashboard | https://vercel.com/sportstackapps-projects |
| GitHub repo | https://github.com/SportStackApp/sportstack |
| Active branch | `dev` → merge to `main` to deploy |
| MCP tools | Windows MCP, Chrome MCP, Supabase MCP, Vercel MCP |

---

## 🚀 Start of Next Session — Begin Here

1. Open VS Code and make sure you're on the `dev` branch (`git status`)
2. Start the dev server: `npm run dev`
3. Pick the first unfinished item from the to-do list above
4. Share this file with Claude to resume context
