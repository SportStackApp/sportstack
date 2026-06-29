-- Add a service-role callable helper for safely claiming confirmed placeholder profiles.
-- Matching is intentionally limited to confirmed identifiers only; there is no fuzzy name matching.

CREATE OR REPLACE FUNCTION public.claim_placeholder_profile(p_real_profile_id uuid)
RETURNS TABLE(status text, placeholder_profile_id uuid, reason text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_real public.profiles%ROWTYPE;
  v_placeholder_id uuid;
  v_match_count integer := 0;
BEGIN
  SELECT * INTO v_real
  FROM public.profiles
  WHERE id = p_real_profile_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 'no_match'::text, NULL::uuid, 'real profile not found'::text;
    RETURN;
  END IF;

  IF COALESCE(v_real.is_placeholder, false) THEN
    RETURN QUERY SELECT 'already_placeholder'::text, NULL::uuid, 'signed-in profile is a placeholder'::text;
    RETURN;
  END IF;

  -- Confirmed identifier path: a real profile has an admin-approved RevSports ID,
  -- and exactly one different placeholder profile has the same ID. Do not match by name.
  IF v_real.revsports_player_id IS NOT NULL AND btrim(v_real.revsports_player_id) <> '' THEN
    SELECT count(*), min(id)
      INTO v_match_count, v_placeholder_id
    FROM public.profiles
    WHERE id <> p_real_profile_id
      AND COALESCE(is_placeholder, false) = true
      AND revsports_player_id = v_real.revsports_player_id;
  END IF;

  IF v_match_count = 0 THEN
    RETURN QUERY SELECT 'no_match'::text, NULL::uuid, 'no confirmed placeholder match'::text;
    RETURN;
  END IF;

  IF v_match_count > 1 THEN
    RETURN QUERY SELECT 'ambiguous'::text, NULL::uuid, 'multiple placeholders share the confirmed identifier; admin review required'::text;
    RETURN;
  END IF;

  -- Resolve duplicate team/role rows before repointing, keeping the real profile's rows.
  DELETE FROM public.team_memberships tm_placeholder
  USING public.team_memberships tm_real
  WHERE tm_placeholder.user_id = v_placeholder_id
    AND tm_real.user_id = p_real_profile_id
    AND tm_placeholder.team_id = tm_real.team_id;

  DELETE FROM public.user_roles ur_placeholder
  USING public.user_roles ur_real
  WHERE ur_placeholder.user_id = v_placeholder_id
    AND ur_real.user_id = p_real_profile_id
    AND ur_placeholder.role = ur_real.role
    AND ur_placeholder.association_id IS NOT DISTINCT FROM ur_real.association_id
    AND ur_placeholder.club_id IS NOT DISTINCT FROM ur_real.club_id
    AND ur_placeholder.team_id IS NOT DISTINCT FROM ur_real.team_id;

  UPDATE public.profiles
  SET is_placeholder = false,
      revsports_player_id = COALESCE(NULLIF(btrim(revsports_player_id), ''), v_real.revsports_player_id),
      updated_at = now()
  WHERE id = p_real_profile_id;

  UPDATE public.team_memberships SET user_id = p_real_profile_id WHERE user_id = v_placeholder_id;
  UPDATE public.team_memberships SET invited_by = p_real_profile_id WHERE invited_by = v_placeholder_id;
  UPDATE public.user_roles SET user_id = p_real_profile_id WHERE user_id = v_placeholder_id;
  UPDATE public.revsports_player_mappings SET profile_id = p_real_profile_id WHERE profile_id = v_placeholder_id;
  UPDATE public.revsports_player_registry SET profile_id = p_real_profile_id WHERE profile_id = v_placeholder_id;
  UPDATE public.revsports_players SET profile_id = p_real_profile_id WHERE profile_id = v_placeholder_id;

  -- MVP/voting and related player references aligned with the admin merge helper.
  UPDATE public.mvp_vote_audit SET changed_by = p_real_profile_id WHERE changed_by = v_placeholder_id;
  UPDATE public.mvp_vote_submissions SET voter_profile_id = p_real_profile_id WHERE voter_profile_id = v_placeholder_id;
  UPDATE public.mvp_votes SET updated_by = p_real_profile_id WHERE updated_by = v_placeholder_id;
  UPDATE public.mvp_votes SET voter_profile_id = p_real_profile_id WHERE voter_profile_id = v_placeholder_id;
  UPDATE public.mvp_voting_sessions SET created_by = p_real_profile_id WHERE created_by = v_placeholder_id;
  UPDATE public.player_vote_edits SET changed_by_id = p_real_profile_id WHERE changed_by_id = v_placeholder_id;
  UPDATE public.player_vote_submissions SET submitted_by_admin_id = p_real_profile_id WHERE submitted_by_admin_id = v_placeholder_id;
  UPDATE public.player_vote_submissions SET umpire_user_id = p_real_profile_id WHERE umpire_user_id = v_placeholder_id;
  UPDATE public.player_vote_submissions SET deleted_by = p_real_profile_id WHERE deleted_by = v_placeholder_id;
  UPDATE public.player_vote_submissions SET proxy_submitter_id = p_real_profile_id WHERE proxy_submitter_id = v_placeholder_id;

  DELETE FROM public.profiles WHERE id = v_placeholder_id;

  RETURN QUERY SELECT 'merged'::text, v_placeholder_id, 'claimed by confirmed RevSports player ID'::text;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_placeholder_profile(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_placeholder_profile(uuid) TO service_role;
