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

For each scheduled fixture, the selector calculates its finish in this order:

1. Exact fixture finish (`scheduled_end_at`).
2. Division match duration.
3. Association default match duration.
4. Safe system fallback of 90 minutes.

Before any result scrape, a preflight fetches only that fixture's RevSports round page and verifies
the current start time. If RevSports moved the start later, SportStack updates the fixture, keeps
the same exact duration when one was set, and postpones the result scrape. If the page fetch,
fixture lookup or start-time check fails, the result scrape does not run early; the selector tries
again on a later check and the nightly full catch-up remains the final safety net.

Once verified and due, the scraper requests only the exact RevSports match URL instead of crawling
every grade and round. If RevSports has not posted the result yet, the fixture can retry every 45
minutes for up to 12 hours. Once SportStack marks it completed, it drops out of the selector.

Targeted runs are temporary GitHub runner files only. They are not uploaded to Storage. The nightly
full scrape catches late or changed results across all grades and associations.

Division administrators may leave match duration blank to inherit the association value. Existing
divisions are deliberately left blank until an administrator enters a verified duration. Fill-in
access expiry uses the same finish hierarchy plus the association's existing grace period.

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

Production workflow dry-run `30529006936` keeps 44 objects using 60,176,404 bytes and identifies
969 objects using 1,533,329,605 bytes as deletion candidates. Its exact plan SHA-256 is
`0f76b636191078b6e5c6fe971110058d4ad8560142617398299069fa2ee549c2`. These values are the required
apply guards, but they are not approval to delete existing backups.

Supabase reports Storage Size as an organisation-wide GB-hour average. The usage graph can remain
high after deletion until the averaging window catches up.
