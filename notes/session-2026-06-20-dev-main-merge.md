# Session Handover — 20 June 2026: Dev → Main Merge & RevSports V2 Verification

## Summary

Today's session covered three things: catching up on the RevSports V2 data
model plan, investigating and verifying a large overnight Codex commit on
`dev`, and merging that work into `main` (live deploy).

---

## 1. Caught up on RevSports V2 data model plan

Reviewed the previously-agreed fresh-start data model:

- `source_scrape_runs` — audit log of every scrape attempt
- `source_revsports_*` landing tables — raw scraped data, split properly
  by type (matches, player appearances, registry, history) instead of one
  overloaded table
- `external_entities` + `external_entity_links` — shared identity/mapping
  layer connecting RevSports records to SportStack records
- Clean SportStack tables (`fixtures`, `teams`, `profiles`, etc.) — the app
  reads from these, not from scrape data directly

Also confirmed the "facts vs identities" rule: simple facts (scores, cards,
dates) can flow through with light checking; identities (team, player,
venue, division) need mapping. Agreed that staging data should be kept even
for facts, with a change-log approach rather than silent overwrites, so a
score correction four weeks later is recorded, not lost.

Full design lives in `docs/revsports-data-model-v2.md`.

---

## 2. Investigated overnight Codex commit on `dev`

Aaron had used Codex overnight to build a V2 fixture importer using the
`external_entities` / `external_entity_links` mappings, then merged it into
`dev` this morning. This caused some confusion during the session:

- **Branch-switch confusion** — local checkout flipped between `main` and
  `dev` a few times (once due to us creating a temporary look-back branch,
  once for an unclear reason — possibly an IDE click or background agent
  action). Each time, this made it look like files had "disappeared," when
  really we were just looking at a different branch. No data was ever lost.
- **Created `review-before-v2-importer`** — a temporary local-only branch
  pointing at the commit just before the importer, used to safely compare
  old vs new code without touching `dev`. Can be deleted any time
  (`git branch -D review-before-v2-importer`).

### What the overnight commit actually contained
Commit `a24c3d1` — "implement RevSports v2 data ingestion pipeline,
matching scripts, audit tooling, and admin review interface":

- Real code: `scraper/fixture_import.py` (rewritten), new `scripts/`
  folder (6 new Python scripts — readiness report, lineup promotion plan,
  player match audit, strong/unique match appliers, fixtures v2 importer)
- New docs: `docs/revsports-data-model-v2.md`,
  `docs/revsports-post-mapping-next-steps.md`
- Large generated data dumps committed to git (FLAGGED, see below) —
  multiple CSV/JSON scrape output files, including one 102,528 lines long.
  These are scraper output, not source code, and probably shouldn't be
  tracked in git long-term. Not cleaned up yet — flagged for a future
  session.

### Database impact verified
Confirmed the importer script had already been run and had updated, not
created, fixtures:
- 579 total fixtures, 0 newly created, 425 updated in the prior 6 hours
- 574 of 579 fixtures now have division_id and season_id set — this fixes
  the long-standing bug where these were null on all fixtures
- 245 fixtures now have scores filled in

Aaron confirmed this was the intended outcome, so no rollback was needed.

---

## 3. Migration audit before merging to Main

Before merging `dev` into `main`, checked whether 8 new Supabase migration
files in the commit had actually been applied to the live database.

Found a version-mismatch pattern: one migration
(add_revsports_player_id_to_profiles) was applied to the live database
under a different timestamp than the file in git history — same SQL
content, different version number recorded in
supabase_migrations.schema_migrations. This made Supabase's own tracking
table look like 4-5 migrations were "missing" when they weren't.

Verified directly against actual data/schema (not just the tracking table)
that all the following had genuinely already been applied:
- Add revsports_player_id to revsports_player_mappings (+ hardcoded list
  of 28 confirmed player/umpire mappings, including Aaron's own qzrbDcZ)
- Add revsports_team_id to revsports_team_mappings
- Backfill competition-type rows into external_entities (4 found)
- Loosen the external_entity_links confidence check constraint to allow
  created_placeholder and exact_unique_name_context

Conclusion: database already matched what the new code expects. No
migrations needed to be run manually.

FLAGGED for later: the migration version-number mismatch itself hasn't
been fixed. The file
20260619010500_add_revsports_player_id_to_profiles.sql in the repo
doesn't match the version (20260619114321) actually recorded as applied.
Should be tidied up (rename the file to match, or otherwise reconcile) so
Supabase's migration tooling doesn't get confused later.

---

## 4. Merged dev into main and pushed (live deploy triggered)

- Local merge (dev into main) completed with zero conflicts
- Pushed to GitHub main — commit 958f9e0
- This brings the full V2 importer, new scripts, docs, and earlier pending
  fixes (fixture_import script, layout/profile mapping display update)
  into production
- Vercel auto-deploy should now be running — worth checking the Vercel
  dashboard to confirm a clean build

---

## Open items for next session

1. Clean up large committed data files in data/* folders — move to
   .gitignore or a separate non-tracked location; repo history is now
   bloated with multi-hundred-thousand-line JSON/CSV dumps
2. Reconcile the migration version-number mismatch described above
3. Confirm Vercel deploy succeeded after this merge
4. Continue toward the V2 data model's remaining layers (scrape run
   logging table, full landing-table split) — current work covers the
   mapping/identity layer but not yet the dedicated source_scrape_runs
   audit table
