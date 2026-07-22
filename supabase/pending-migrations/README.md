# Pending Supabase Migrations

Files in this folder are deliberately parked and are not part of the active
Supabase migration sequence.

- Do not move or copy them into `supabase/migrations/` without Aaron's explicit
  approval.
- Do not apply them to Dev or Production without a fresh live-schema check and
  the required testing listed inside the SQL file.
- Keeping them here prevents `supabase db push` from applying them accidentally.

## Current parked migration

- `lock_down_mvp_voting_access.sql` — wait until the team-owned Player MVP
  Voting UI and reminder function have passed the approved live pilot.
