-- Active team membership updates run a trigger that ensures a scoped PLAYER
-- role exists. Move all placeholder roles first so that trigger sees the
-- transferred PLAYER role and does not create a duplicate before the remaining
-- roles are repointed.

DO $migration$
DECLARE
  v_definition text;
  v_old_order text := $old$
  UPDATE public.team_memberships SET user_id = p_real_profile_id WHERE user_id = v_placeholder_id;
  UPDATE public.team_memberships SET invited_by = p_real_profile_id WHERE invited_by = v_placeholder_id;
  UPDATE public.user_roles SET user_id = p_real_profile_id WHERE user_id = v_placeholder_id;
$old$;
  v_new_order text := $new$
  UPDATE public.user_roles SET user_id = p_real_profile_id WHERE user_id = v_placeholder_id;
  UPDATE public.team_memberships SET user_id = p_real_profile_id WHERE user_id = v_placeholder_id;
  UPDATE public.team_memberships SET invited_by = p_real_profile_id WHERE invited_by = v_placeholder_id;
$new$;
  v_occurrences integer;
BEGIN
  SELECT pg_get_functiondef('public.claim_placeholder_profile(uuid)'::regprocedure)
    INTO v_definition;

  v_occurrences :=
    (length(v_definition) - length(replace(v_definition, v_old_order, '')))
    / length(v_old_order);

  IF v_occurrences <> 1 THEN
    RAISE EXCEPTION
      'Expected one placeholder claim role/team transfer block, found %',
      v_occurrences;
  END IF;

  EXECUTE replace(v_definition, v_old_order, v_new_order);
END;
$migration$;

REVOKE ALL ON FUNCTION public.claim_placeholder_profile(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_placeholder_profile(uuid) TO service_role;
