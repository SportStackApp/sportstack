-- Backup of mvp_votes RLS policies BEFORE the votes-privacy fix
-- Taken: 24 June 2026
-- Purpose: restorable record of the original "Admins full access - mvp_votes" policy
-- in case the new narrower policy needs to be rolled back.

-- ORIGINAL POLICY (about to be dropped):
-- Name: "Admins full access - mvp_votes"
-- Command: ALL
-- Roles: public (checked via user_roles table internally)
CREATE POLICY "Admins full access - mvp_votes"
ON mvp_votes
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = ANY (ARRAY[
        'SUPER_ADMIN'::user_role_enum,
        'ASSOCIATION_ADMIN'::user_role_enum,
        'CLUB_ADMIN'::user_role_enum,
        'COACH'::user_role_enum,
        'TEAM_MANAGER'::user_role_enum
      ])
  )
);

-- TO ROLLBACK (restore original wide-open policy):
-- 1. DROP POLICY IF EXISTS "Super Association admin full access - mvp_votes" ON mvp_votes;
-- 2. Re-run the CREATE POLICY block above.

-- Other policies on mvp_votes were NOT changed and don't need backup here:
-- - "Verified token can submit votes" (INSERT)
-- - "Voter can submit own votes" (INSERT)
-- - "Voter can view own votes" (SELECT, voter_profile_id = auth.uid())
