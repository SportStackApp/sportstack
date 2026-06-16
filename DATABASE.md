# Database Notes

## Source of truth

The live Supabase database schema is the source of truth for SportStack. Migration files may have drifted from the live schema, so verify live database structure before making database-dependent changes.

## Migration guidance

- Use additive migrations for new database changes.
- Do not rewrite existing migration history.
- For backfills, do a dry run first and report affected row counts before writing.
- Enums cannot be renamed safely; use `ALTER TYPE ... ADD VALUE IF NOT EXISTS`, then update rows as needed.
- `is_super_admin()` takes no arguments.

## RevSports import model

SportStack stages scraped RevSports data in `revsports_*` tables, maps it via `revsports_*_mappings`, then imports into live app tables such as `fixtures`, `teams`, and `profiles`.

## Fixtures caveat

Some fixture rows currently have unreliable or missing `division_id` and `season_id` values. Until those nulls are fixed, do not join `fixtures` directly to `divisions`; join fixtures to teams via `home_team_id` and `away_team_id` when division context is needed.

## Current data notes

- Prefer `team_divisions` joined to `divisions` when `teams.division` is missing or unreliable.
- `teams.home_venue_id` is used by the Teams admin edit form.
- Bulk player imports should not send invitation emails automatically.
- RevSports scraped player data is staged data, not the final source of player profiles.
