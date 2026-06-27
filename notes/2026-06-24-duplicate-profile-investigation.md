# Duplicate Profile Investigation — 24 June 2026

**Context:** The 24 June 2026 health review flagged 8 name-groups as possible
duplicate profiles needing a merge (similar to the earlier Jason H → Jason
Harris merge). Before merging anything, each group was checked against
RevSports player IDs and club/division history.

**Rule applied:** Different RevSports player ID + different club = different
real person, NOT a duplicate. Same name alone is not enough evidence to merge
— regional hockey has many genuinely different people sharing a first name +
surname initial (confirmed by Aaron from real-world knowledge of the comps).

## Result: 7 of 8 are CONFIRMED DIFFERENT PEOPLE — not bugs, no merge needed

| Name | Profile A | Profile B | Verdict |
|---|---|---|---|
| Claire B | `WgbQbUO` @ Bobcats (Womens) | `PVlLVFP` @ SOBHC (Womens) | Different people |
| Hamish S | `NmNAAIl` @ Blaze (U11 Open) | `v32vbhZ` @ EGC (U11 Open) | Different people |
| Hayden S | `n24X1F8` @ SOBHC (Div 1 Men) | `M1gz2ua` @ Lucas HC (Div 1/2 Men) | Different people |
| Lachlan M | `DPOyquk` @ EGC (U16 Open) | `2qaXAs2` @ SOBHC (Div 1 Men) | Different people |
| Nick T | `XLyDZu8` @ Blaze (Div 2 Men) | `Je9L8F1` @ Bobcats (Div 1 Men) | Different people |
| Reuben P | `020O6t3` @ Blaze (U11 Open) | `lByqZux` @ Grampians/Lucas HC (Div 2 Men / U16) | Different people |
| Riley K | `O8VRGU9` @ EGC (Div 2 Men) | `9KnaZiX` @ EGC (Div 2 Men / U16) | Different people (confirmed by Aaron, same club but two real players) |

**Action:** None. These are correctly separate profiles. No database change made.
The original "8 duplicates" finding in the 24 June health review handover should
be treated as superseded by this investigation for these 7 names.

## Ben S (×4 profiles) — NOT a duplicate-profile problem, do not merge or delete

Initial read (incorrect): 3 of the 4 "Ben S" profiles looked like empty,
unused placeholder accounts (no club/grade/appearances showing in
`revsports_players`, no roles, no votes, no team memberships, never logged
in via `auth.users`).

**A delete was attempted on these 3 profiles and was correctly BLOCKED by a
foreign key constraint** (`revsports_player_registry_profile_id_fkey`) —
this caught a near-miss before any data loss occurred. No deletion was
performed. The `profiles` table is untouched.

**Corrected finding:** all 3 profiles have REAL season stats in
`revsports_player_registry` (a separate season-totals table, not reviewed in
the original 24 June health review):
  - `cbded41a-547e-4451-8750-755575547408` → RevSports ID `XeRO3I8`, Hockey Ballarat comp 26298, 6 games attended
  - `3511de67-ae43-4746-ab09-6537b7ce6afd` → RevSports ID `Vz3w9fw`, Hockey Ballarat comp 26298, 7 games attended
  - `70ecc76f-02ad-4498-aebe-5f1842e6df03` → RevSports ID `Ke6Peum`, Hockey Ballarat comp 26298, 6 games attended

These RevSports IDs match the same 3 real, distinct players seen with full
match-by-match data in `revsports_players` under the names Ben S (EGC), Ben
Schwedes (EGC), and Ben Sturmfels (Blaze). These ARE the correct linked
profiles for 3 real players — they are simply missing club/grade info
specifically in the `revsports_players` table for these 3 profiles, while
having complete season totals in `revsports_player_registry`.

**Action:** None taken. profiles table untouched.

**Next step (not yet done):** investigate why these 3 profiles show
incomplete club/grade data in `revsports_players` while having full season
totals in `revsports_player_registry` — likely a scraper/mapping gap between
the two pipelines (match-by-match scraper vs season-registry scraper), not a
duplicate-profile problem at all. Worth a closer look in a future session.

## Final tally for the original "8 duplicates" finding

All 8 originally-flagged name-groups are now resolved:
- 7 are confirmed different real people — no action needed.
- 1 (Ben S) turned out to be a data-completeness gap between two scraper
  pipelines, not a duplicate — no action needed beyond the investigation
  flagged above.

**No profiles were merged or deleted this session.** The Profile Merge Tool
(rescued into git earlier this session) remains untested against a real
confirmed duplicate — the next genuine candidate for using it has not yet
been found.
