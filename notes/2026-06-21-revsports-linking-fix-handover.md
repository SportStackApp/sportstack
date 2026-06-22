# Session Handover — RevSports Player Linking Fix (Grampians Pumas)

**Date:** Sunday 21 June 2026, evening session
**Branch:** merged to `main` — deployed to production

---

## What this session covered

Started from a real bug you spotted: opposition players (and an umpire) were
showing up as eligible MVP voters. Tracing that down led to a much bigger
discovery — the whole system for linking a scraped RevSports row to a real
SportStack profile was broken in a way that went well beyond MVP voting.

## What we found

There were three separate, disconnected places trying to link people to
RevSports data, and none of them talked to each other:

1. `profiles.revsports_player_id` — typed in manually via a text box
   (Admin > Users > Roles & Teams)
2. `revsports_player_mappings` — a table built via the "RevSports Mappings"
   admin page, matching by name + club + grade + team + jersey
3. `revsports_players.profile_id` — the field that actually matters (used by
   fixtures, MVP voting, everything) — **nothing wrote to this automatically**

So even when you'd correctly linked someone via #1 or #2, the real gameplay
data in #3 never found out about it. That's why Harley S. and Reuben P. (both
genuine fill-ins, both correctly flagged `is_fillin = true`) couldn't appear
as MVP voters — no `profile_id` on their rows at all.

## What we fixed

**1. One-off backfill (already live):** Joined every `revsports_players` row
against `profiles.revsports_player_id` (exact ID match, not name-guessing) and
filled in every blank `profile_id` where a match existed. Result: 9,158 rows
fixed across the whole database in one safe pass — never overwrites an
existing value, only fills blanks. Verified Harley S. and Reuben P. are now
correctly linked.

**2. Permanent fix in the scraper (now live in production):** `scraper.py`
now fetches all profiles with a `revsports_player_id` set, and links every
scraped row the same way, every single scrape, going forward. Verified live
against a real game: ran scoped to Hockey Ballarat / Division 2 Men / Round 7,
confirmed "Loaded 687 profiles for player linking", and all 15 Grampians rows
linked correctly with zero errors. Same safe rule as the backfill — only adds,
never overwrites.

**3. Fixed a genuine wrong link:** "Joanne S." (a real Lucas HC player) had
25 of her 26 scraped rows wrongly pointing to an unrelated profile called
"Shepherd J" — looks like a manual mapping mistake. There's a real, correct
"Joanne S" profile in the system; all 28 rows (after tonight's Round 7 scrape
added 2 more) now correctly point to her, not Shepherd J.

## A bonus discovery worth knowing about

Round 7 has actually been played: **Grampians 5 – 6 Lucas HC** (close loss).
Found this purely as a side effect of testing the scraper fix — you may not
have seen the result yet.

## What's NOT fixed / still open

- **The 11 cross-club players with no SportStack account at all**
  (Cooper P., Max F., abbiegail peters, Willem McGregor, Demi Atkinson,
  Kayd Divola, Michael Fotheringham, Anthony D., Hannah F., Kate Madden) —
  not broken, just genuinely unlinkable until they have accounts. None are
  Grampians-affiliated, so this likely doesn't matter unless SportStack
  expands to other clubs.
- The query to check this list yourself is saved as a Supabase favourite-able
  snippet — ask if you want it again, it's quick to re-run.
- Email/reminders, session auto-open/close — same as before, still mock/manual.

## Files changed (all merged to `main`, deployed)

- `scraper/scraper.py` — added the `profiles_lookup` step
- `.gitignore` — scraper test output files now ignored

## Database changes (direct SQL, already applied to production)

- Backfilled `profile_id` on ~9,158 `revsports_players` rows
- Fixed the Joanne S. / Shepherd J wrong link on 25 rows
- Backup table `revsports_players_profile_id_backup_20260621` still sits in
  the database if anything ever needs reverting

## Suggested next steps

1. Check out the Round 7 result (Grampians 5–6 Lucas HC) if you haven't seen it
2. Worth a quick look at the MVP voting admin page for Round 7 once a session
   is opened for it, to see the linking working live in the real UI
3. No urgent action needed — everything here is deployed and stable
