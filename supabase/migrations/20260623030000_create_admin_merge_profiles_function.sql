-- Migration: create_admin_merge_profiles_function
-- Description: Creates a PostgreSQL function to safely merge two user profiles.
-- This function is restricted to Super Admins and is transaction-safe.

CREATE OR REPLACE FUNCTION public.admin_merge_profiles(
  p_keep_id uuid,
  p_merge_id uuid,
  p_field_choices jsonb,
  p_conflict_resolutions jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
/*
  ==============================================================================
  SportStack Profile Merging Tool
  
  This function safely merges two user profiles into one.
  It is a Super Admin only tool used to resolve duplicate player records.
  
  Arguments:
    - p_keep_id: The UUID of the profile to KEEP.
    - p_merge_id: The UUID of the profile to MERGE (which will be deleted).
    - p_field_choices: JSON object specifying which profile value wins for each 
      field. E.g. {"first_name": "keep", "last_name": "merge", "phone": "merge"}
    - p_conflict_resolutions: JSON array containing objects that specify which
      duplicate rows in team_memberships and user_roles to delete prior to the 
      merge. E.g. [{"table": "team_memberships", "row_id_to_keep": "uuid", "row_id_to_delete": "uuid"}]
      
  Checks:
    - Verifies the caller is a SUPER_ADMIN.
    - Ensures a profile is not being merged into itself.
    - Confirms that both profiles actually exist.
    - Performs conflict checks on team memberships and roles. If an unresolved
      conflict is detected, an exception is raised so the caller can handle it.
  ==============================================================================
*/
DECLARE
  r_keep public.profiles%ROWTYPE;
  r_merge public.profiles%ROWTYPE;
  r_tm_conflict record;
  r_ur_conflict record;
  r_res record;
BEGIN
  -- 1. Security check: Verify caller is a SUPER_ADMIN in user_roles
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'SUPER_ADMIN'
  ) THEN
    RAISE EXCEPTION 'Only super admins can merge profiles';
  END IF;

  -- 2. Safety checks
  IF p_keep_id = p_merge_id THEN
    RAISE EXCEPTION 'Cannot merge a profile into itself';
  END IF;

  SELECT * INTO r_keep FROM public.profiles WHERE id = p_keep_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Keep profile % does not exist', p_keep_id;
  END IF;

  SELECT * INTO r_merge FROM public.profiles WHERE id = p_merge_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Merge profile % does not exist', p_merge_id;
  END IF;

  -- 3. Apply field choices to the retained profile (r_keep)
  -- For each field, if the choice is 'merge', override with the value from r_merge
  IF p_field_choices->>'first_name' = 'merge' THEN
    r_keep.first_name := r_merge.first_name;
  END IF;
  IF p_field_choices->>'last_name' = 'merge' THEN
    r_keep.last_name := r_merge.last_name;
  END IF;
  IF p_field_choices->>'phone' = 'merge' THEN
    r_keep.phone := r_merge.phone;
  END IF;
  IF p_field_choices->>'date_of_birth' = 'merge' THEN
    r_keep.date_of_birth := r_merge.date_of_birth;
  END IF;
  IF p_field_choices->>'gender' = 'merge' THEN
    r_keep.gender := r_merge.gender;
  END IF;
  IF p_field_choices->>'suburb' = 'merge' THEN
    r_keep.suburb := r_merge.suburb;
  END IF;
  IF p_field_choices->>'avatar_url' = 'merge' THEN
    r_keep.avatar_url := r_merge.avatar_url;
  END IF;
  IF p_field_choices->>'hockey_vic_number' = 'merge' THEN
    r_keep.hockey_vic_number := r_merge.hockey_vic_number;
  END IF;
  IF p_field_choices->>'emergency_contact_name' = 'merge' THEN
    r_keep.emergency_contact_name := r_merge.emergency_contact_name;
  END IF;
  IF p_field_choices->>'emergency_contact_phone' = 'merge' THEN
    r_keep.emergency_contact_phone := r_merge.emergency_contact_phone;
  END IF;
  IF p_field_choices->>'is_umpire' = 'merge' THEN
    r_keep.is_umpire := r_merge.is_umpire;
  END IF;
  IF p_field_choices->>'is_placeholder' = 'merge' THEN
    r_keep.is_placeholder := r_merge.is_placeholder;
  END IF;
  IF p_field_choices->>'revsports_player_id' = 'merge' THEN
    r_keep.revsports_player_id := r_merge.revsports_player_id;
  END IF;
  IF p_field_choices->>'street_address' = 'merge' THEN
    r_keep.street_address := r_merge.street_address;
  END IF;

  -- Perform the update on p_keep_id profile
  UPDATE public.profiles
  SET
    first_name = r_keep.first_name,
    last_name = r_keep.last_name,
    phone = r_keep.phone,
    date_of_birth = r_keep.date_of_birth,
    gender = r_keep.gender,
    suburb = r_keep.suburb,
    avatar_url = r_keep.avatar_url,
    hockey_vic_number = r_keep.hockey_vic_number,
    emergency_contact_name = r_keep.emergency_contact_name,
    emergency_contact_phone = r_keep.emergency_contact_phone,
    is_umpire = r_keep.is_umpire,
    is_placeholder = r_keep.is_placeholder,
    revsports_player_id = r_keep.revsports_player_id,
    street_address = r_keep.street_address,
    updated_at = now()
  WHERE id = p_keep_id;

  -- 4. Conflict detection
  -- Check team_memberships conflicts (same team_id for both profiles)
  FOR r_tm_conflict IN (
    SELECT 
      tm_keep.id AS keep_row_id,
      tm_merge.id AS merge_row_id,
      tm_keep.team_id
    FROM public.team_memberships tm_keep
    JOIN public.team_memberships tm_merge ON tm_keep.team_id = tm_merge.team_id
    WHERE tm_keep.user_id = p_keep_id
      AND tm_merge.user_id = p_merge_id
  ) LOOP
    IF NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(p_conflict_resolutions) AS res
      WHERE (res->>'table') = 'team_memberships'
        AND (
          ((res->>'row_id_to_keep')::uuid = r_tm_conflict.keep_row_id AND (res->>'row_id_to_delete')::uuid = r_tm_conflict.merge_row_id)
          OR
          ((res->>'row_id_to_keep')::uuid = r_tm_conflict.merge_row_id AND (res->>'row_id_to_delete')::uuid = r_tm_conflict.keep_row_id)
        )
    ) THEN
      RAISE EXCEPTION 'Unresolved conflict in team_memberships: row % and row % for team % must be resolved.',
        r_tm_conflict.keep_row_id, r_tm_conflict.merge_row_id, r_tm_conflict.team_id;
    END IF;
  END LOOP;

  -- Check user_roles conflicts (same role and scope parameters for both profiles)
  FOR r_ur_conflict IN (
    SELECT 
      ur_keep.id AS keep_row_id,
      ur_merge.id AS merge_row_id,
      ur_keep.role,
      ur_keep.team_id
    FROM public.user_roles ur_keep
    JOIN public.user_roles ur_merge ON ur_keep.role = ur_merge.role
      AND ur_keep.association_id IS NOT DISTINCT FROM ur_merge.association_id
      AND ur_keep.club_id IS NOT DISTINCT FROM ur_merge.club_id
      AND ur_keep.team_id IS NOT DISTINCT FROM ur_merge.team_id
    WHERE ur_keep.user_id = p_keep_id
      AND ur_merge.user_id = p_merge_id
  ) LOOP
    IF NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(p_conflict_resolutions) AS res
      WHERE (res->>'table') = 'user_roles'
        AND (
          ((res->>'row_id_to_keep')::uuid = r_ur_conflict.keep_row_id AND (res->>'row_id_to_delete')::uuid = r_ur_conflict.merge_row_id)
          OR
          ((res->>'row_id_to_keep')::uuid = r_ur_conflict.merge_row_id AND (res->>'row_id_to_delete')::uuid = r_ur_conflict.keep_row_id)
        )
    ) THEN
      RAISE EXCEPTION 'Unresolved conflict in user_roles: row % and row % (role %, team %) must be resolved.',
        r_ur_conflict.keep_row_id, r_ur_conflict.merge_row_id, r_ur_conflict.role, r_ur_conflict.team_id;
    END IF;
  END LOOP;

  -- 5. Apply conflict resolutions (deletions)
  IF p_conflict_resolutions IS NOT NULL AND jsonb_array_length(p_conflict_resolutions) > 0 THEN
    FOR r_res IN (
      SELECT 
        res->>'table' AS tbl,
        (res->>'row_id_to_delete')::uuid AS delete_id
      FROM jsonb_array_elements(p_conflict_resolutions) AS res
    ) LOOP
      IF r_res.tbl = 'team_memberships' THEN
        DELETE FROM public.team_memberships WHERE id = r_res.delete_id;
      ELSIF r_res.tbl = 'user_roles' THEN
        DELETE FROM public.user_roles WHERE id = r_res.delete_id;
      END IF;
    END LOOP;
  END IF;

  -- 6. Repoint references from p_merge_id to p_keep_id (38 reference updates)
  UPDATE public.coach_position_assessments SET player_id = p_keep_id WHERE player_id = p_merge_id;
  UPDATE public.coach_position_assessments SET coach_id = p_keep_id WHERE coach_id = p_merge_id;
  UPDATE public.external_entity_links SET matched_by = p_keep_id WHERE matched_by = p_merge_id;
  UPDATE public.fixture_availability SET user_id = p_keep_id WHERE user_id = p_merge_id;
  UPDATE public.lineups SET player_id = p_keep_id WHERE player_id = p_merge_id;
  UPDATE public.mvp_vote_audit SET changed_by = p_keep_id WHERE changed_by = p_merge_id;
  UPDATE public.mvp_vote_submissions SET voter_profile_id = p_keep_id WHERE voter_profile_id = p_merge_id;
  UPDATE public.mvp_votes SET updated_by = p_keep_id WHERE updated_by = p_merge_id;
  UPDATE public.mvp_votes SET voter_profile_id = p_keep_id WHERE voter_profile_id = p_merge_id;
  UPDATE public.mvp_voting_sessions SET created_by = p_keep_id WHERE created_by = p_merge_id;
  UPDATE public.notification_preferences SET user_id = p_keep_id WHERE user_id = p_merge_id;
  UPDATE public.notifications SET user_id = p_keep_id WHERE user_id = p_merge_id;
  UPDATE public.player_position_preferences SET player_id = p_keep_id WHERE player_id = p_merge_id;
  UPDATE public.player_vote_edits SET changed_by_id = p_keep_id WHERE changed_by_id = p_merge_id;
  UPDATE public.player_vote_submissions SET submitted_by_admin_id = p_keep_id WHERE submitted_by_admin_id = p_merge_id;
  UPDATE public.player_vote_submissions SET umpire_user_id = p_keep_id WHERE umpire_user_id = p_merge_id;
  UPDATE public.player_vote_submissions SET deleted_by = p_keep_id WHERE deleted_by = p_merge_id;
  UPDATE public.player_vote_submissions SET proxy_submitter_id = p_keep_id WHERE proxy_submitter_id = p_merge_id;
  UPDATE public.requests SET cancelled_by = p_keep_id WHERE cancelled_by = p_merge_id;
  UPDATE public.requests SET requester_id = p_keep_id WHERE requester_id = p_merge_id;
  UPDATE public.requests SET target_user_id = p_keep_id WHERE target_user_id = p_merge_id;
  UPDATE public.requests SET responded_by = p_keep_id WHERE responded_by = p_merge_id;
  UPDATE public.revsports_player_mappings SET profile_id = p_keep_id WHERE profile_id = p_merge_id;
  UPDATE public.revsports_player_registry SET profile_id = p_keep_id WHERE profile_id = p_merge_id;
  UPDATE public.revsports_players SET profile_id = p_keep_id WHERE profile_id = p_merge_id;
  UPDATE public.revsports_umpire_mappings SET profile_id = p_keep_id WHERE profile_id = p_merge_id;
  UPDATE public.rg_audit_log SET user_id = p_keep_id WHERE user_id = p_merge_id;
  UPDATE public.rg_be_smart_actions SET assigned_to = p_keep_id WHERE assigned_to = p_merge_id;
  UPDATE public.rg_comments SET user_id = p_keep_id WHERE user_id = p_merge_id;
  UPDATE public.rg_quality_improvement_items SET created_by = p_keep_id WHERE created_by = p_merge_id;
  UPDATE public.rg_risk_register SET owner_id = p_keep_id WHERE owner_id = p_merge_id;
  UPDATE public.rg_risk_reviews SET reviewed_by = p_keep_id WHERE reviewed_by = p_merge_id;
  UPDATE public.team_memberships SET user_id = p_keep_id WHERE user_id = p_merge_id;
  UPDATE public.team_memberships SET invited_by = p_keep_id WHERE invited_by = p_merge_id;
  UPDATE public.team_messages SET user_id = p_keep_id WHERE user_id = p_merge_id;
  UPDATE public.umpire_audit_log SET user_id = p_keep_id WHERE user_id = p_merge_id;
  UPDATE public.umpire_vote_edits SET edited_by = p_keep_id WHERE edited_by = p_merge_id;
  UPDATE public.umpire_vote_lines SET umpire_user_id = p_keep_id WHERE umpire_user_id = p_merge_id;
  UPDATE public.umpire_vote_submissions SET submitted_by = p_keep_id WHERE submitted_by = p_merge_id;
  UPDATE public.user_roles SET user_id = p_keep_id WHERE user_id = p_merge_id;

  -- 7. Delete the merged profile
  DELETE FROM public.profiles WHERE id = p_merge_id;
END;
$$;
