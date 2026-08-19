# Umpire scope backfill — Development

- Date: 19 August 2026
- Target: SportStack Dev only
- Association: Hockey Ballarat
- Result: 17 Umpire rows for 17 people, each with exactly one association-only Hockey Ballarat scope
- Unchanged: profiles, names, emails, team memberships, historical game mappings and three Legacy Umpire Admin rows

## Dry-run evidence

| Umpire | Evidence used |
|---|---|
| Admin Sportstack | Current Hockey Ballarat team or role evidence |
| Ben Sturmfels | Current Hockey Ballarat team or role evidence |
| Codex Umpire Test | Existing Hockey Ballarat scope |
| Craig Stevens | Hockey Ballarat fixture Umpire evidence |
| Daniel Ryan | Hockey Ballarat playing history |
| Ethan Oldaker | Current Hockey Ballarat team or role evidence |
| Hayden Bourne | Current Hockey Ballarat team or role evidence |
| I Edgar | Confirmed old Hockey Ballarat Umpire Portal origin |
| Jeff Sly | Hockey Ballarat fixture Umpire evidence |
| Joshua Sly | Current Hockey Ballarat team or role evidence |
| L Drury | Confirmed old Hockey Ballarat Umpire Portal origin |
| Lily Drury | Confirmed old Hockey Ballarat Umpire Portal origin |
| Mitchell Stevens | Current Hockey Ballarat team or role evidence |
| Nicholas Hargreaves | Current Hockey Ballarat team or role evidence |
| Sara Weuffen-Humphrey | Hockey Ballarat fixture Umpire evidence |
| Shepherd J | Confirmed old Hockey Ballarat Umpire Portal origin |
| Tucker Kooloos | Hockey Ballarat fixture Umpire evidence |

## Verification

- Before: 17 rows, 17 people, 16 unscoped, one Hockey Ballarat row with nested club/team values.
- Rollback test: passed before applying the migration.
- After: 17 rows, 17 people, 17 exact Hockey Ballarat association-only scopes.
- Legacy Umpire Admin: three rows before and three rows after; no conversion or Coordinator assignment.
