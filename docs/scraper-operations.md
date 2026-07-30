# SportStack Scraper Operations

Last updated: 30/07/2026

This is the current run and backup routine for the RevSports scrapers. GitHub schedules use UTC;
the comments below also show Melbourne time. Melbourne times move forward by one hour during
daylight saving.

## Routine schedule

### Development

| Task | Routine | Backup |
|---|---|---|
| Hockey Ballarat, Sunraysia and Wimmera match scrapers | Tuesday at 04:00 AEST / 05:00 AEDT | Yes, one compressed archive per source |
| Player registry | Tuesday and Friday mornings | Tuesday only |
| Player history | Tuesday at 06:00 AEST / 07:00 AEDT | Yes |
| Storage retention report | Tuesday at 07:00 AEST / 08:00 AEDT | Read-only report |

### Production

| Task | Routine | Backup |
|---|---|---|
| Due-fixture selector | Every 15 minutes | No |
| Exact fixture refresh | After its calculated finish, with controlled retries | No |
| Full match catch-up | Nightly at 00:30 AEST / 01:30 AEDT | Monday early run, after Sunday matches |
| Player registry | Tuesday and Friday mornings | Tuesday only |
| Player history | Tuesday at 06:00 AEST / 07:00 AEDT | Yes |
| Storage retention report | Monday at 02:00 AEST / 03:00 AEDT | Read-only report |

For each scheduled fixture, the selector uses `scheduled_end_at` when available. Otherwise it adds
the association's default match duration to the fixture start. It then runs the scraper against
that exact RevSports match URL instead of crawling every grade and round. If RevSports has not
posted the result yet, the fixture can retry every 45 minutes for up to 12 hours. Once SportStack
marks it completed, it drops out of the selector.

Targeted runs are temporary GitHub runner files only. They are not uploaded to Storage. The nightly
full scrape catches late or changed results across all grades and associations.

## When to run each manual option

- `hockey-ballarat`, `sunraysia` or `wimmera`: use when only that source is late or incorrect.
- `due-fixture-refresh`: run the same due-fixture selection manually. Production writes still need
  `write_to_production` enabled.
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

- Keep the latest available backup.
- Keep the backups nearest to 1 week, 2 weeks and 4 weeks old.
- After 4 weeks, keep the latest backup from each month for up to 12 months.
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

The sparser policy's read-only Production projection keeps 44 objects using 60,176,404 bytes and
identifies 969 objects using 1,533,329,605 bytes as deletion candidates. A fresh workflow dry run
must still produce the exact guarded plan before any Production apply. This is not approval to
delete existing backups.

Supabase reports Storage Size as an organisation-wide GB-hour average. The usage graph can remain
high after deletion until the averaging window catches up.
