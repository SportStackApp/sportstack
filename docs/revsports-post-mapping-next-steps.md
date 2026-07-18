# RevSports Post-Mapping Next Steps

Generated after the RevSports entity mapping pass.

## Current baseline

- Competitions, clubs, teams, players, divisions, venues, and pitches are fully mapped.
- Current V2 staged fixtures import cleanly:
  - 574 source matches
  - 574 imported fixtures
  - 0 skipped
  - 0 current fixtures missing home team, division, or season
- Current staged source has 0 byes. This should change after the updated scraper runs.
- Older Wimmera fixture rows outside the current V2 scrape still have 5 incomplete rows. Leave these alone until confirmed.

## After GitHub scrapes finish

Run the readiness report:

```powershell
python scripts/revsports_readiness_report.py
```

Check:

- `Current source byes`
- `Current source fixtures imported`
- `Current imported fixtures missing home/division/season`
- `mapping_summary.csv`
- `fixture_summary.csv`

Then run fixture import dry-run:

```powershell
python scripts/import_revsports_fixtures_v2.py
```

If it reports zero skipped rows, apply:

```powershell
python scripts/import_revsports_fixtures_v2.py --apply
```

Run readiness report again after apply.

## Placeholder player dry-run and guarded apply

The placeholder planner is read-only by default. It reads the current
RevSports and SportStack records, then writes a local CSV.

Required environment variables:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` or `SUPABASE_SERVICE_KEY`

Run the full report:

```powershell
python scripts/revsports_placeholder_plan.py
```

Default output:

```text
data/revsports-placeholder-plan/revsports_placeholder_plan.csv
```

Check one player, such as Max F. (`XereEs8`):

```powershell
python scripts/revsports_placeholder_plan.py --player-id XereEs8 --output data/revsports-placeholder-plan/max-f.csv
```

Review the Max-only CSV before considering an apply. The current shared
SportStack Supabase project is live production data, and the script refuses to
apply when `SUPABASE_URL` points to that known project.

Only after the environment variables point to a separate dev/test Supabase
project, the manual single-player command is:

```powershell
python scripts/revsports_placeholder_plan.py --player-id XereEs8 --apply --confirm-create-placeholder --output data/revsports-placeholder-plan/max-f-apply-plan.csv
```

Apply safety rules:

- `--apply`, exactly one `--player-id`, and
  `--confirm-create-placeholder` are all required.
- Apply only accepts a refreshed `create_placeholder` or `link_existing` row.
- It re-reads the source immediately before writing and verifies the result
  afterwards.
- An ignored, matched, ambiguous, missing-team, multi-team, conflicting-name,
  or otherwise unsafe row is refused without writes.
- A same-name profile with a different RevSports ID remains only a warning.
- A new placeholder gets the dry-run membership type. Fill-in-only players
  cannot receive `PRIMARY`.
- A relevant existing user/team membership is reused, not duplicated.
- External link notes include the planner, RevSports ID, team, membership,
  match basis, and apply timestamp.

The auth user, triggered profile, and database rows cannot share one
transaction through the Python APIs. For a new placeholder, the script writes
the external link last; if an earlier step fails, deleting the newly created
auth shell cascades through its profile and membership. For `link_existing`, a
new membership is removed if the guarded link write fails. If cleanup cannot
be confirmed, the command stops and prints the exact profile or membership ID
that needs manual recovery.

This apply mode is manual only. It is not wired into GitHub Actions, the
RevSports scraper, or any automatic post-scrape workflow.

The planner reads external player and team entities, entity links, all staged
player appearances and their match context, player registry/mapping rows,
profiles, team memberships, and the SportStack association/competition/
division/club/team tables.

Actions in the CSV:

- `create_placeholder`: safe candidate; nothing is created unless the complete
  apply command is used against a separate dev/test project.
- `link_existing`: a profile with the exact RevSports ID already exists.
- `needs_review`: the name, link, membership, or team context is not safe.
- `skip`: already linked, ignored, or missing a RevSports ID.

Display names are used only for the proposed name and warnings. They are never
used to link a RevSports player to a profile.

## Lineup promotion groundwork

The dry-run planner is ready:

```powershell
python scripts/revsports_lineup_promotion_plan.py
```

Current baseline:

- Hockey Ballarat: 2002 attended appearances ready
- Sunraysia: 1666 attended appearances ready
- Missing fixture/profile/team blockers: 0

Do not run apply until approved:

```powershell
python scripts/revsports_lineup_promotion_plan.py --apply
```

This would insert live `lineups` rows from attended RevSports appearances.

## Known blockers

- Wimmera has fixture data, but no V2 player appearances in the current source tables.
- The older player registry/history scrapers only cover Hockey Ballarat and Sunraysia.
- The existing scraper comments say Wimmera player stats are login-protected and need authenticated scraping support.

## Useful report files

Generated under:

```text
data/revsports-readiness/
```

Files:

- `readiness_report.md`
- `mapping_summary.csv`
- `fixture_summary.csv`
- `appearance_summary.csv`
- `player_registry_history_summary.csv`
- `lineup_promotion_plan.md`
- `lineup_promotion_summary.csv`
- `lineup_promotion_ready.csv`
- `lineup_promotion_blockers.csv`
