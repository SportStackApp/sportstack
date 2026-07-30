# SportStack Scraper Operations

Last updated: 30/07/2026

This is the current run and backup routine for the RevSports scrapers. GitHub schedules use UTC;
the comments below also show Melbourne time. Melbourne times move forward by one hour during
daylight saving.

## Routine schedule

### Development

| Task | Routine | Backup |
|---|---|---|
| Hockey Ballarat, Sunraysia and Wimmera match scrapers | Daily at 04:00 AEST / 05:00 AEDT | Yes, one compressed archive per source |
| Player registry | Monday and Thursday at 05:00 AEST / 06:00 AEDT | Yes |
| Player history | Monday at 06:00 AEST / 07:00 AEDT | Yes |
| Storage retention report | Monday at 07:00 AEST / 08:00 AEDT | Read-only report |

### Production

| Task | Routine | Backup |
|---|---|---|
| All three match scrapers | Daily at 04:00 AEST / 05:00 AEDT | Yes, one compressed archive per source |
| Sunraysia indoor refresh window | Friday at 18:00 and 22:00 AEST | No routine backup |
| Weekend match refresh window | Saturday and Sunday at 12:00, 16:00 and 20:00 AEST | No routine backup |
| Player registry | Monday and Thursday at 05:00 AEST / 06:00 AEDT | Yes |
| Player history | Monday at 06:00 AEST / 07:00 AEDT | Yes |
| Storage retention report | Monday at 07:00 AEST / 08:00 AEDT | Read-only report |

The extra match-day runs update the database but do not save another near-identical backup. The
daily baseline is the recoverable snapshot for that day.

## When to run each manual option

- `hockey-ballarat`, `sunraysia` or `wimmera`: use when only that source is late or incorrect.
- `match-scrapers`: use after a broad fixture/result correction or a missed match-day schedule.
- `player-registry`: use after player lists or season totals change. It does not need to run after
  every match refresh.
- `player-history`: use after the registry has refreshed when career-history data needs updating.
- `all`: reserve for recovery, a scraper release check, or a full data refresh. It is not the normal
  daily choice.
- `storage-diagnostics`: read-only bucket and source totals. Run when Supabase reports a storage
  warning.
- `storage-retention-dry-run`: read-only proposed deletion totals and a plan SHA-256.
- `storage-retention-apply`: destructive. Use only after the exact count, bytes and SHA-256 from a
  fresh dry run have been approved.

Manual Production scraper runs default to no database write and no backup. A match scraper can run
read-only, but Player Registry and Player History are skipped until `write_to_production` is enabled
because those scripts always upsert their results. The legacy single-source workflows are
manual-only fallbacks and must not be scheduled.

## Backup format

Each selected backup run stores one private `.tar.gz` archive per source instead of separate raw
CSV, JSON and text objects. This reduces both object count and stored bytes. Extract a downloaded
archive with:

```powershell
tar -xzf source-name.tar.gz
```

## Retention policy

Retention is calculated per scraper source and per complete upload run:

- First 3 days: keep the earliest and latest run from each day.
- Days 4 to 14: keep the latest run from each day.
- Days 15 to 60: keep the latest run from each ISO week.
- Days 61 to 365: keep the latest run from each month.
- Older than 365 days: delete.
- Any object with an unexpected path is kept for manual review.

The weekly scheduled task produces a read-only plan. Deletion is never automatic. An apply run
must match the approved object count, byte count and SHA-256 exactly, then verify every approved
deletion and retained object after the Storage API call.

Production apply also requires this exact confirmation phrase:

```text
DELETE PRODUCTION SCRAPE BACKUPS
```

## Current storage baseline

Read-only checks on 30/07/2026 found:

| Project | Scrape objects | Scrape bytes |
|---|---:|---:|
| Development | 124 | 181,040,447 |
| Production | 1,013 | 1,593,506,009 |

The new policy's read-only Production projection keeps 155 objects using about 216 MB and identifies
858 objects using about 1.27 GB as deletion candidates. This is not approval to delete them. A fresh
workflow dry run must produce the exact guarded plan before any Production apply.

Supabase reports Storage Size as an organisation-wide GB-hour average. The usage graph can remain
high after deletion until the averaging window catches up.
