# Fixture and Player Data Quality Audit — 23/07/2026

## Scope

Read-only review of the SportStack **Development** database before the daily dashboard,
availability and communications build. No records were repaired, merged or deleted.
Production was not changed.

## Testing decision

**Suitable for the planned Aaron/Pumas dashboard test.** Aaron's real profile, Auth link,
PLAYER role, primary Pumas membership and secondary Lucas HC membership are consistent.
Pumas has five upcoming fixtures available for testing.

## Blocking problems

No issue currently blocks the focused Pumas dashboard and availability test.

The following items would block a safe whole-of-database clean-up or broad rollout and need
their own reviewed repair plan:

- **68 past fixtures are still marked `SCHEDULED`.** These can create misleading historical
  status and should be reconciled against the source competition data.
- **202 users have duplicate active memberships for the same team.** Of these, 195 are
  placeholder profiles and 7 are real profiles. A dry-run merge/reconciliation plan is needed
  before any records are changed.
- **44 users have more than one active primary membership.** All 44 are placeholders; no real
  player currently has this problem.
- **13 active membership users do not have a PLAYER role.** These need identity-by-identity
  review before adding roles because some may be deliberately non-player records.

## Fixture findings

| Check | Result | Assessment |
|---|---:|---|
| Total fixtures | 630 | Information |
| Future, not cancelled | 179 | Suitable test pool |
| Missing fixture date | 0 | Clean |
| Missing division | 0 | Clean |
| Missing season | 162 | General clean-up |
| Missing venue | 1 | General clean-up |
| Duplicate fixture signatures | 2 groups | Review before repair |
| Duplicate RevSports URLs | 0 | Clean |
| Home team equals away team | 1 | Review source record |
| Past fixture still `SCHEDULED` | 68 | Important clean-up |
| Future fixture marked completed | 0 | Clean |
| Negative score | 0 | Clean |
| Cross-association team links | 0 | Clean |

Duplicate signature groups found:

- Rivaside Blue v Waratahs — 12/07/2026 03:00 UTC, round 10 — two records.
- Rivaside Red v Koowinda Purple — 12/07/2026 04:30 UTC, round 10 — two records.

The home-equals-away record is Mildura Wanderers v Mildura Wanderers, completed on
12/06/2026 UTC.

## Player and membership findings

| Check | Result | Assessment |
|---|---:|---|
| Profiles | 733 | Information |
| Placeholder profiles | 694 | Expected import backlog, needs governance |
| Profiles missing names | 2 | General clean-up |
| Duplicate real names/RevSports IDs | 0 | Clean |
| Active memberships | 1,235 | Backfill dry-run count |
| Duplicate active user/team groups | 202 | Review before repair |
| Duplicate groups involving real profiles | 7 | Important clean-up |
| Multiple active primaries | 44 | All placeholders |
| Real users with multiple active primaries | 0 | Clean |
| Active users without any primary | 1 | Placeholder only |
| Active memberships without Auth user | 0 | Clean |
| Auth users without a profile | 1 | General clean-up |
| Active users without PLAYER role | 13 | Review before repair |

## Approved-build dry run

Adding `team_memberships.activated_at` will backfill **1,235 ACTIVE memberships** using their
existing membership creation time. Inactive memberships remain unset. The migration does not
delete, merge or silently repair any fixture/player record.

## Build validation

- The approved Dev migration backfilled all **1,235 ACTIVE memberships** with an activation
  date; the before-and-after counts matched.
- All 13 new persisted communications/reminder tables have RLS enabled.
- Live rollback-only checks confirmed unrelated teams cannot read or insert into each other's
  communications.
- Team reminder schedules start disabled; no reminder was sent during the deployment smoke test.
- The reminder Edge Function returned HTTP 200 with zero claimed, sent or failed items in the
  disabled-team test state.
- No fixture or player quality finding in this report was automatically repaired.

## Recommended later clean-up order

1. Reconcile the 68 past scheduled fixtures and the three suspicious fixture groups with
   RevSports source data.
2. Review the seven real duplicate membership groups individually.
3. Define placeholder merge rules, then dry-run the 195 placeholder duplicate groups.
4. Review the 13 missing PLAYER roles and the one Auth user without a profile.
5. Backfill missing season and venue values only after confirming the correct source mapping.

These clean-up actions are outside the current build and require separate approval.
