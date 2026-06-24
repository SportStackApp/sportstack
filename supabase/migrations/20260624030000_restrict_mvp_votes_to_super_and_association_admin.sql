-- Migration: restrict_mvp_votes_to_super_and_association_admin
-- Date: 24 June 2026
-- Purpose: Close the votes-privacy gap. Only SUPER_ADMIN and ASSOCIATION_ADMIN
-- should be able to read who-voted-for-whom on mvp_votes. CLUB_ADMIN, COACH,
-- and TEAM_MANAGER never use this table in the app (confirmed via codebase check) --
-- they rely on mvp_vote_submissions instead, which is correctly scoped already.
--
-- Verified via screenshot testing on 24 June 2026 across all 5 roles:
-- Player, Team Manager, Club Admin, Association Admin, Super Admin.
-- See notes/2026-06-24-mvp_votes-policy-backup.sql for the original policy text
-- (restorable if this needs to be rolled back).

DROP POLICY IF EXISTS "Admins full access - mvp_votes" ON mvp_votes;

CREATE POLICY "Super Association admin full access - mvp_votes"
ON mvp_votes
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = ANY (ARRAY['SUPER_ADMIN'::user_role_enum, 'ASSOCIATION_ADMIN'::user_role_enum])
  )
);
