# Production Release Readiness — 29 July 2026

## Decision

**Do not push current `main` to `prod` until the Production database and Edge Functions are made
compatible.** The application release is approved in principle, but publishing the Git branch first
would expose code that expects database objects that Production does not yet have.

This document records a read-only audit. No Production database, function, secret, scheduled job or
deployment was changed during the audit.

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
- `profiles.account_theme`
- `team_memberships.activated_at`
- `player_position_preferences.team_id`
- `app_feedback.attachment_paths`

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

## Approval still required

The owner must explicitly approve the Production backup, the 16 Production migrations, the two
Edge Function deployments and the scheduled-job configuration. The Git `prod` promotion is already
approved, but it remains last in the sequence above.
