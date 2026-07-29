# Production Release Readiness — 29 July 2026

## Decision

**The Production compatibility gate is complete.** The verified backup, 16 migrations, two Edge
Functions and both scheduled jobs are in place. Current `main` is approved for the final
fast-forward to `prod`.

The baseline sections below preserve the read-only audit that preceded the release. The release
execution section records the approved Production changes completed afterwards.

## Release execution

- Created and independently verified a restricted manual logical backup at
  `C:\Users\mulla\AppData\Local\SportStack\backups\prod\2026-07-29-pre-release-3f531a0`:
  `roles.sql` (297 bytes), `schema.sql` (346,651 bytes) and `data.sql` (46,324,074 bytes).
- Repeated the guarded Umpire Match Voting preflight immediately before migration. The live values
  remained 271 vote lines, checksum `64e69e27af02befeae361a75c9046f6c`, one audit actor, seven
  existing edit rows and no duplicate non-empty profile RevSports IDs.
- Applied all 16 approved migrations in order. The backfill linked 250 vote lines to 143 profiles,
  left the reviewed 21 unmatched lines unlinked and created the expected 492 audit rows.
- Verified all expected tables and functions exist, every new public table has RLS enabled, the
  sensitive notification functions remain service-role-only, and anonymous callers cannot execute
  the signed-in admin functions.
- Corrected two stale audit names: current source uses `profiles.theme_preference`, not
  `profiles.account_theme`; feedback photos use `app_feedback_attachments.storage_path`, not an
  `app_feedback.attachment_paths` column.
- Deployed Production `mvp-voting-email-reminders` version 6 and
  `sportstack-notification-dispatch` version 1 with their existing custom authentication and
  `verify_jwt = false` settings. Unauthorised test calls returned HTTP 401 for both functions.
- Verified `mvp-voting-email-reminders` is active every minute and
  `sportstack-notification-dispatch` is active every 15 minutes. The notification credential exists
  in Vault and its value was not read or logged.
- Re-ran Supabase advisers. The release-linked warnings are limited to three intentional signed-in
  `SECURITY DEFINER` admin functions that perform their own permission checks; anonymous execution
  is denied. The broader existing adviser backlog remains separate.
- Confirmed the staging landing page loads and `/dashboard` redirects signed-out visitors to
  `/login`. A signed-in staging browser session was not available, so signed-in workflow checks
  remain part of the Production owner smoke test.

## Audited baseline

- `dev` and `main` were aligned at `266afe2` before this release-readiness documentation change.
- `prod` was at `426935d`, 42 commits behind `main`.
- The Git diff from `prod` to `main` covered 115 files, with 20,080 insertions and 1,829 deletions.
- SportStack Dev Supabase: `icqegnpjbizccjebjfhb`.
- SportStack Production Supabase: `svierarfcolhcfjpmwck`.
- Both projects reported `ACTIVE_HEALTHY` during the audit.
- The SportStack Supabase organisation is on the Free plan. A verified manual logical backup is
  therefore required before Production schema work; do not assume an automatic daily backup exists.

## Confirmed Production compatibility gap

Current application source expects these Production objects, but the live Production audit found
them missing.

### Tables

- `communication_channels`
- `communication_permissions`
- `communication_messages`
- `communication_reactions`
- `communication_mentions`
- `communication_read_state`
- `communication_moderation_audit`
- `notification_category_preferences`
- `club_availability_reminder_settings`
- `team_availability_reminder_settings`
- `availability_reminder_dispatches`
- `availability_reminder_delivery_log`
- `communication_email_deliveries`
- `fixture_fill_ins`
- `app_feedback_attachments`

### Columns

- `player_vote_lines.profile_id`
- `teams.mvp_notifications_enabled`
- `profiles.registered_club_id`
- `profiles.theme_preference`
- `team_memberships.activated_at`
- `player_position_preferences.team_id`

### Functions

- `private.communication_has_channel_access`
- `private.mvp_initial_close_at`
- `public.claim_sportstack_notification_work`
- `public.complete_sportstack_notification_work`
- `public.review_umpire_vote_submission`
- `public.set_team_mvp_notifications_enabled`

## Production migration set

Production already contains the four 18 July placeholder-claim fixes under its live migration
history. Do not replay those files. The following 16 active migrations remain to be applied in
filename order after a fresh preflight and backup:

1. `20260719091405_add_umpire_vote_player_identity.sql`
2. `20260719091412_backfill_umpire_vote_player_identity.sql`
3. `20260719093832_fix_umpire_vote_review_search_path.sql`
4. `20260720100536_auto_open_team_mvp_voting.sql`
5. `20260721085522_add_team_mvp_notification_setting.sql`
6. `20260723203546_daily_dashboard_communications.sql`
7. `20260723211649_fix_availability_reminder_status.sql`
8. `20260723212630_fix_reminder_association_scope.sql`
9. `20260723214712_harden_daily_dashboard_communications.sql`
10. `20260724103000_fixture_fill_in_access_and_theme_inheritance.sql`
11. `20260724221410_consolidate_feedback_profile_preferences.sql`
12. `20260724224215_fix_team_position_scope_checks.sql`
13. `20260724224716_harden_feedback_position_policies.sql`
14. `20260725120835_allow_team_members_to_read_team_positions.sql`
15. `20260725121432_consolidate_team_formation_read_policy.sql`
16. `20260729010000_fix_mvp_initial_close_at_greatest.sql`

The final migration corrects the invalid `greatest` qualification introduced by the automatic
Player MVP opening migration. Apply the ordered set in one controlled maintenance window and verify
the installed function after migration 16.

`supabase/pending-migrations/lock_down_mvp_voting_access.sql` remains deliberately parked. It is not
part of this release and must not be applied without the separately approved Player MVP pilot gate.

The 29 July read-only Umpire Match Voting preflight still matches the migration's guarded baseline:
271 vote lines, snapshot checksum `64e69e27af02befeae361a75c9046f6c`, exactly one audit actor and
no duplicate non-empty profile RevSports IDs. The seven existing vote-edit rows predate the
backfill. Repeat this check immediately before applying the migration.

## Edge Functions and scheduled work

- Update `mvp-voting-email-reminders` from current source. The deployed Production source does not
  yet honour `teams.mvp_notifications_enabled` or `fixture_fill_ins`.
- Deploy the new `sportstack-notification-dispatch` function with its existing custom cron-secret
  authentication and `verify_jwt = false` setting.
- Run `public.configure_sportstack_notification_cron` with the Production Supabase URL after the
  communications migration and function deployment, then verify the 15-minute job exists and is
  active.
- The existing Production `mvp-voting-email-reminders` scheduled job is active. Its schedule is
  expected to change from every 15 minutes to every minute during the ordered migration set.
- `send-profile-access-link` does not need a release solely for this Git difference: live Production
  source already contains the current safe RevSports ID transfer behaviour.

Do not read, print or copy either cron secret. Verify only its presence and the authorised call
result.

## Required release sequence

1. Re-fetch `dev`, `main` and `prod`; confirm the intended histories and a clean working tree.
2. Create a secure manual logical backup of Production schema, data and roles. Verify the files are
   non-empty, record checksums and keep credentials out of logs and the repository.
3. Run fresh read-only data preflights, especially for the Umpire Match Voting identity backfill.
4. Apply the 16 active Production migrations in the order above and verify the migration history,
   expected objects, grants and RLS policies.
5. Deploy the two required Edge Functions and configure the communications notification job.
6. Re-run Supabase security advisers and targeted database checks. Treat the wider existing adviser
   backlog separately; do not silently broaden this release.
7. Smoke-test current staging, then fast-forward `prod` from current `main` and push it.
8. Verify the Production deployment, signed-in dashboard, Communications, availability, Profile,
   Player MVP administration, Umpire Match Voting administration and key admin pages. Monitor Edge
   Function and database logs during the first scheduled runs.

## Recovery position

- App: restore the previous `prod` commit through a normal reviewed revert or redeploy; never
  force-push the protected release history.
- Edge Functions: retain the previous deployed versions and redeploy them if the new code fails.
- Database: these are forward migrations and several include data backfills. Prefer a reviewed
  forward fix. Use the verified logical backup only for a genuine recovery event because a full
  restore can overwrite newer Production data.

## Approval

The owner approved the Production backup, 16 migrations, two Edge Function deployments, scheduled
job configuration and Git `prod` promotion. The compatibility gate is complete; the Git promotion
remains last in the controlled sequence above.
