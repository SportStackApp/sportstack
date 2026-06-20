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
