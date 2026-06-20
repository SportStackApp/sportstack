# RevSports Data Model V2

## Purpose

This document describes the preferred fresh-start structure for getting RevSports data into SportStack.

The goal is a sustainable medium-term workflow until a proper API exists.

The core rule is:

```text
RevSports data is source data first.
SportStack data is clean app data second.
Mappings sit between the two.
```

## Current Problem

The current pipeline works, but the structure is hard to maintain because:

- Fixture data and player appearance data are mixed together in `revsports_players`.
- Mapping tables use different shapes and naming rules.
- Some mappings rely on names when RevSports IDs would be safer.
- Some live database changes are not fully represented in local migrations.
- Import scripts need fallback logic for several old schema versions.

## Recommended Data Flow

```text
RevSports pages
  -> scraper
  -> scrape run record
  -> source_revsports_* landing tables
  -> external_entities
  -> external_entity_links
  -> SportStack live tables
```

Definitions:

- Landing table: stores data from RevSports in a tidy source shape, before it becomes SportStack data.
- Mapping: connects a RevSports thing to a SportStack thing.
- Promotion: the import step that writes clean mapped data into SportStack live tables.

## Layer 1: Scrape Runs

### `source_scrape_runs`

One row per scraper run.

This gives an audit trail of what ran, when it ran, and whether it worked.

Suggested columns:

| Column | Purpose |
|---|---|
| `id` | Primary key |
| `source` | Example: `revsports` |
| `scraper_name` | Example: `fixtures`, `current_player_stats`, `player_history` |
| `association_id` | SportStack association, when known |
| `association_name` | Source association name from the scraper |
| `started_at` | When the run started |
| `finished_at` | When the run finished |
| `status` | `running`, `success`, `failed`, `partial` |
| `rows_found` | Number of source rows found |
| `rows_written` | Number of landing rows written |
| `error_message` | Safe error detail if failed |
| `source_config` | JSON details such as URL, competition ID, filters |
| `created_at` | Row creation time |

## Layer 2: RevSports Landing Tables

Landing tables should store RevSports data clearly, without pretending it is already SportStack data.

### `source_revsports_competitions`

One row per RevSports competition.

Suggested columns:

| Column | Purpose |
|---|---|
| `id` | Primary key |
| `scrape_run_id` | Link to `source_scrape_runs` |
| `association_name` | Source association name |
| `revsports_competition_id` | RevSports competition ID |
| `competition_name` | Source competition name |
| `season_year` | Year if known |
| `source_url` | RevSports URL |
| `raw_data` | JSON copy of source details |
| `scraped_at` | When this source row was scraped |

Recommended unique key:

```text
revsports_competition_id
```

### `source_revsports_teams`

One row per RevSports team identity.

Suggested columns:

| Column | Purpose |
|---|---|
| `id` | Primary key |
| `scrape_run_id` | Link to `source_scrape_runs` |
| `association_name` | Source association name |
| `competition_name` | Source competition name |
| `grade` | Source grade/division text |
| `club_name` | Source club name |
| `team_name` | Source team name |
| `team_label` | Full label from RevSports |
| `revsports_team_id` | RevSports team ID, if available |
| `team_url` | Source team URL |
| `raw_data` | JSON copy of source details |
| `scraped_at` | When this source row was scraped |

Recommended unique key:

```text
revsports_team_id when present
otherwise association_name + competition_name + grade + club_name + team_name
```

### `source_revsports_matches`

One row per fixture/match.

Suggested columns:

| Column | Purpose |
|---|---|
| `id` | Primary key |
| `scrape_run_id` | Link to `source_scrape_runs` |
| `association_name` | Source association name |
| `competition_name` | Source competition name |
| `grade` | Source grade/division text |
| `round_name` | Example: `Round 1` |
| `round_number` | Parsed round number, if possible |
| `match_url` | RevSports match URL |
| `game_date` | Source date |
| `game_time` | Source time |
| `venue_name` | Source venue text |
| `pitch_name` | Source pitch text |
| `home_team_name` | Source home team text |
| `home_revsports_team_id` | Source home team ID |
| `away_team_name` | Source away team text |
| `away_revsports_team_id` | Source away team ID |
| `home_score` | Source home score |
| `away_score` | Source away score |
| `umpire_1` | Source umpire text |
| `umpire_2` | Source umpire text |
| `raw_data` | JSON copy of source details |
| `scraped_at` | When this source row was scraped |

Recommended unique key:

```text
match_url
```

### `source_revsports_match_teams`

One row per team per match.

This avoids storing home and away team data only as columns on the match.

Suggested columns:

| Column | Purpose |
|---|---|
| `id` | Primary key |
| `match_id` | Link to `source_revsports_matches` |
| `side` | `home` or `away` |
| `club_name` | Source club name |
| `team_name` | Source team name |
| `team_label` | Full source label |
| `revsports_team_id` | RevSports team ID |
| `team_url` | Source team URL |
| `score` | Team score |

Recommended unique key:

```text
match_id + side
```

### `source_revsports_player_appearances`

One row per player per match.

Suggested columns:

| Column | Purpose |
|---|---|
| `id` | Primary key |
| `scrape_run_id` | Link to `source_scrape_runs` |
| `match_id` | Link to `source_revsports_matches` |
| `match_team_id` | Link to `source_revsports_match_teams` |
| `appearance_key` | Stable source key from scraper |
| `team_side` | `home` or `away` |
| `club_name` | Source club name |
| `team_name` | Source team name |
| `revsports_team_id` | RevSports team ID |
| `player_name` | Source player name |
| `revsports_player_id` | RevSports player ID |
| `jersey` | Source jersey number |
| `attended` | Whether player attended |
| `is_goalkeeper` | Source goalkeeper flag |
| `is_captain` | Source captain flag |
| `is_fillin` | Source fill-in flag |
| `is_removed` | Source removed flag |
| `goals` | Source goals |
| `green_cards` | Source green cards |
| `yellow_cards` | Source yellow cards |
| `red_cards` | Source red cards |
| `raw_data` | JSON copy of source details |
| `scraped_at` | When this source row was scraped |

Recommended unique key:

```text
appearance_key
```

### `source_revsports_player_registry`

One row per current-season player record per competition.

Suggested columns:

| Column | Purpose |
|---|---|
| `id` | Primary key |
| `scrape_run_id` | Link to `source_scrape_runs` |
| `association_name` | Source association name |
| `revsports_competition_id` | Source competition ID |
| `competition_name` | Source competition name |
| `revsports_player_id` | RevSports player ID |
| `player_name` | Cleaned full name |
| `first_name` | Parsed first name |
| `last_name` | Parsed last name |
| `season_attended` | Current season games attended |
| `season_goals` | Current season goals |
| `season_green_cards` | Current season green cards |
| `season_yellow_cards` | Current season yellow cards |
| `season_red_cards` | Current season red cards |
| `raw_data` | JSON copy of source details |
| `scraped_at` | When this source row was scraped |

Recommended unique key:

```text
revsports_player_id + revsports_competition_id
```

### `source_revsports_player_history`

One row per player per historical season.

Suggested columns:

| Column | Purpose |
|---|---|
| `id` | Primary key |
| `scrape_run_id` | Link to `source_scrape_runs` |
| `association_name` | Source association name |
| `revsports_player_id` | RevSports player ID |
| `player_name` | Source player name |
| `season_year` | Historical season year |
| `season_attended` | Historical games attended |
| `season_goals` | Historical goals |
| `season_green_cards` | Historical green cards |
| `season_yellow_cards` | Historical yellow cards |
| `season_red_cards` | Historical red cards |
| `raw_data` | JSON copy of source details |
| `scraped_at` | When this source row was scraped |

Recommended unique key:

```text
revsports_player_id + season_year
```

## Layer 3: External Entity Matching

The mapping layer should be consistent.

Instead of many unrelated mapping table shapes, use one shared external identity table and one shared link table.

### `external_entities`

One row per thing found in an external source.

Examples:

- RevSports player
- RevSports team
- RevSports venue
- RevSports pitch
- RevSports grade
- RevSports competition
- RevSports umpire

Suggested columns:

| Column | Purpose |
|---|---|
| `id` | Primary key |
| `source` | Example: `revsports` |
| `entity_type` | `association`, `competition`, `grade`, `club`, `team`, `venue`, `pitch`, `player`, `umpire`, `match` |
| `external_id` | RevSports ID if available |
| `external_name` | Source display name |
| `association_name` | Source association context |
| `competition_name` | Source competition context |
| `grade` | Source grade context |
| `club_name` | Source club context |
| `team_name` | Source team context |
| `source_url` | Source URL if available |
| `raw_data` | JSON copy of useful source details |
| `first_seen_at` | First time detected |
| `last_seen_at` | Most recent time detected |
| `status` | `active`, `inactive`, `ignored` |

Recommended unique rule:

```text
source + entity_type + external_id when external_id exists
otherwise source + entity_type + association_name + competition_name + grade + club_name + external_name
```

### `external_entity_links`

One row per mapping from an external entity to a SportStack entity.

Suggested columns:

| Column | Purpose |
|---|---|
| `id` | Primary key |
| `external_entity_id` | Link to `external_entities` |
| `target_table` | Example: `teams`, `profiles`, `venues`, `pitches`, `divisions`, `seasons`, `fixtures` |
| `target_id` | SportStack row ID |
| `status` | `unmatched`, `matched`, `ignored`, `needs_review` |
| `confidence` | `exact_id`, `name_context`, `manual`, `fallback` |
| `matched_by` | Admin profile ID, if manual |
| `matched_at` | When matched |
| `notes` | Human notes |
| `created_at` | Row creation time |
| `updated_at` | Row update time |

Recommended unique key:

```text
external_entity_id + target_table
```

## Layer 4: SportStack Live Tables

These remain the clean application tables.

Main promoted targets:

- `fixtures`
- `teams`
- `profiles`
- `venues`
- `pitches`
- `divisions`
- `seasons`
- `competitions`

The React app should read from these clean tables for normal user workflows.

The source tables should mainly support:

- admin mapping
- import preview
- audit and troubleshooting
- voting eligibility until a cleaner attendance model exists

## Promotion Rules

## Change Tracking

Source tables should keep the latest known RevSports version of a row.

When a scrape sees the same source row again:

```text
If nothing changed:
  update last_seen_at only.

If a field changed:
  write one row to source_revsports_change_log.
  update the latest source row.
```

This means late changes are visible.

Examples:

- A score changes four weeks later.
- A card count changes after review.
- A match time changes.
- A player is added to or removed from a match card.

The change log should record:

- which scrape run found the change
- which source row changed
- which field changed
- old value
- new value
- when the change was detected
- whether the change was later promoted into SportStack

Promotion into clean SportStack tables should not always be automatic.

Recommended rules:

- Future fixture date/time changes can usually auto-promote.
- Completed scores and cards should be logged and reviewed or clearly auto-promoted with audit.
- Team, player, venue, pitch, division, and season identity changes should require mapping or review.
- Anything that affects votes, awards, or locked results should require review.

### Fixtures

Promote from:

- `source_revsports_matches`
- `source_revsports_match_teams`
- `external_entity_links`

Write to:

- `fixtures`

Required mappings:

- home team
- away team
- division
- season

Optional mappings:

- venue
- pitch
- umpires

Recommended fixture conflict key:

```text
source = revsports + match_url
```

The current `fixtures.revsports_match_url` can stay as a practical bridge.

### Players

Do not auto-create real user accounts from scraped players.

Preferred approach:

1. Match RevSports player IDs to existing `profiles` where possible.
2. Create placeholder profiles only when needed for app workflows.
3. Mark placeholder profiles clearly with `is_placeholder = true`.
4. Never treat a placeholder as a real login user.

### Player Appearances

Player appearances should become the base for:

- match attendance
- voting eligibility
- player stats
- later line-up history

Do not force all of this straight into `profiles`.

## Matching Priority

Use this order:

1. Exact RevSports ID match.
2. RevSports ID plus association context.
3. Name plus association, club, team, and grade.
4. Name plus association only.
5. Manual review.

Names alone should be treated as weak evidence.

## Admin Workflow

The admin mapping screen should work from `external_entities`, not from raw landing tables directly.

Suggested admin tabs:

- Teams
- Players
- Grades/divisions
- Competitions/seasons
- Venues
- Pitches
- Umpires
- Ignored items

Each row should show:

- source name
- source ID if available
- association
- context, such as club/team/grade
- current SportStack match
- confidence
- last seen date

## Import Preview

Before writing to live tables, show a preview:

- rows scanned
- rows ready to promote
- rows blocked by missing mappings
- rows ignored
- duplicate warnings
- sample problem rows

For risky operations, run preview first and ask for confirmation before applying.

## Recommended Migration Path

Because the existing database has real data, this should be done in stages.

### Stage 1: Add V2 Tables

Add new tables beside the old ones.

Do not delete old tables yet.

### Stage 2: Update Scrapers To Write V2

Change scrapers to write to:

- `source_scrape_runs`
- `source_revsports_matches`
- `source_revsports_match_teams`
- `source_revsports_player_appearances`
- `source_revsports_player_registry`
- `source_revsports_player_history`
- `external_entities`

Keep CSV backup output.

### Stage 3: Build New Mapping Admin

Update the mapping UI to use:

- `external_entities`
- `external_entity_links`

### Stage 4: Build New Promotion Script

Replace `fixture_import.py` with a clearer importer.

Suggested name:

```text
promote_revsports_to_sportstack.py
```

The script should support:

- `--preview`
- `--apply`
- association filter
- competition filter
- round filter
- clear report output

### Stage 5: Compare Results

Run old and new pipelines side by side once or twice.

Compare:

- fixture count
- completed score count
- unmapped team count
- unmapped player count
- voting eligibility player count

### Stage 6: Retire Old Tables

Only after V2 is trusted:

- stop writing to old `revsports_players`
- keep old tables read-only for a while
- archive or delete later after backup and confirmation

## Suggested Table Naming

Use clear prefixes:

| Prefix | Meaning |
|---|---|
| `source_revsports_*` | Data that came from RevSports |
| `external_*` | Shared external-source matching system |
| no prefix | Clean SportStack app tables |

Avoid using `revsports_*` for both source data and app-facing mapping logic.

## What To Avoid

- Do not mix match rows and player rows in one table.
- Do not map by name only when an external ID exists.
- Do not write scraped data directly into clean app tables.
- Do not expose scrape tables publicly unless there is a clear need.
- Do not make each association need custom one-off table structures.
- Do not make the app depend on raw RevSports wording.

## Open Decisions

These should be confirmed before implementation:

1. Should V2 tables live in `public`, or a private schema such as `source`?
2. Should `external_entity_links.target_table` be flexible text, or should there be separate typed link tables?
3. Should placeholder profiles be created during promotion, or only after admin approval?
4. Should player appearance data become a new clean `player_match_appearances` table?
5. Should source tables be readable by admins through the frontend, or service-role only?

## Recommended First Build

Start small.

First build:

1. `source_scrape_runs`
2. `source_revsports_matches`
3. `source_revsports_match_teams`
4. `source_revsports_player_appearances`
5. `external_entities`
6. `external_entity_links`

Then update only the fixture/match-card scraper first.

After that is stable, add:

1. `source_revsports_player_registry`
2. `source_revsports_player_history`
