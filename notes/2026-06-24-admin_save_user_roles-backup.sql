-- Backup of all four admin_save_user_roles overloads BEFORE cleanup
-- Captured: 24 June 2026, before dropping the 3 stale copies.
-- KEEPER (the one the app calls): admin_save_user_roles(uuid, text[], jsonb, jsonb, uuid[], jsonb)
-- To restore any dropped version, re-run its CREATE OR REPLACE block below.


-- ===== STALE #1: admin_save_user_roles(uuid,text[],uuid[],uuid[]) =====
CREATE OR REPLACE FUNCTION public.admin_save_user_roles(p_user_id uuid, p_roles text[], p_coach_teams uuid[], p_manager_teams uuid[])
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_caller_is_super_admin BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid() AND role = 'SUPER_ADMIN'
  ) INTO v_caller_is_super_admin;

  IF NOT v_caller_is_super_admin THEN
    RAISE EXCEPTION 'Only super admins can manage roles';
  END IF;

  DELETE FROM user_roles WHERE user_id = p_user_id;

  IF 'SUPER_ADMIN' = ANY(p_roles) THEN
    INSERT INTO user_roles (user_id, role) VALUES (p_user_id, 'SUPER_ADMIN');
  END IF;
  IF 'PLAYER' = ANY(p_roles) THEN
    INSERT INTO user_roles (user_id, role) VALUES (p_user_id, 'PLAYER');
  END IF;
  IF 'VOTER' = ANY(p_roles) THEN
    INSERT INTO user_roles (user_id, role) VALUES (p_user_id, 'VOTER');
  END IF;
  IF 'COACH' = ANY(p_roles) AND p_coach_teams IS NOT NULL THEN
    INSERT INTO user_roles (user_id, role, team_id)
    SELECT p_user_id, 'COACH', unnest(p_coach_teams);
  END IF;
  IF 'TEAM_MANAGER' = ANY(p_roles) AND p_manager_teams IS NOT NULL THEN
    INSERT INTO user_roles (user_id, role, team_id)
    SELECT p_user_id, 'TEAM_MANAGER', unnest(p_manager_teams);
  END IF;
END;
$function$;


-- ===== STALE #2: admin_save_user_roles(uuid,text[],uuid[],uuid[],uuid[],uuid[]) =====
CREATE OR REPLACE FUNCTION public.admin_save_user_roles(p_user_id uuid, p_roles text[], p_coach_teams uuid[], p_manager_teams uuid[], p_association_admin_associations uuid[] DEFAULT NULL::uuid[], p_club_admin_clubs uuid[] DEFAULT NULL::uuid[])
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_caller_is_super_admin BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid() AND role = 'SUPER_ADMIN'
  ) INTO v_caller_is_super_admin;

  IF NOT v_caller_is_super_admin THEN
    RAISE EXCEPTION 'Only super admins can manage roles';
  END IF;

  IF p_roles IS NULL OR array_length(p_roles, 1) IS NULL THEN
    RAISE EXCEPTION 'Cannot save a user with no roles assigned';
  END IF;

  IF p_user_id = auth.uid() AND NOT ('SUPER_ADMIN' = ANY(p_roles)) THEN
    RAISE EXCEPTION 'You cannot remove your own Super Admin role';
  END IF;

  DELETE FROM user_roles WHERE user_id = p_user_id;

  IF 'SUPER_ADMIN' = ANY(p_roles) THEN
    INSERT INTO user_roles (user_id, role) VALUES (p_user_id, 'SUPER_ADMIN');
  END IF;
  IF 'PLAYER' = ANY(p_roles) THEN
    INSERT INTO user_roles (user_id, role) VALUES (p_user_id, 'PLAYER');
  END IF;
  IF 'VOTER' = ANY(p_roles) THEN
    INSERT INTO user_roles (user_id, role) VALUES (p_user_id, 'VOTER');
  END IF;
  IF 'COACH' = ANY(p_roles) AND p_coach_teams IS NOT NULL THEN
    INSERT INTO user_roles (user_id, role, team_id)
    SELECT p_user_id, 'COACH', unnest(p_coach_teams);
  END IF;
  IF 'TEAM_MANAGER' = ANY(p_roles) AND p_manager_teams IS NOT NULL THEN
    INSERT INTO user_roles (user_id, role, team_id)
    SELECT p_user_id, 'TEAM_MANAGER', unnest(p_manager_teams);
  END IF;
  IF 'ASSOCIATION_ADMIN' = ANY(p_roles) AND p_association_admin_associations IS NOT NULL THEN
    INSERT INTO user_roles (user_id, role, association_id)
    SELECT p_user_id, 'ASSOCIATION_ADMIN', unnest(p_association_admin_associations);
  END IF;
  IF 'CLUB_ADMIN' = ANY(p_roles) AND p_club_admin_clubs IS NOT NULL THEN
    INSERT INTO user_roles (user_id, role, club_id)
    SELECT p_user_id, 'CLUB_ADMIN', unnest(p_club_admin_clubs);
  END IF;
END;
$function$;


-- ===== STALE #3: admin_save_user_roles(uuid,text[],jsonb,jsonb,uuid[],uuid[]) =====
CREATE OR REPLACE FUNCTION public.admin_save_user_roles(p_user_id uuid, p_roles text[], p_coach_scopes jsonb DEFAULT NULL::jsonb, p_manager_scopes jsonb DEFAULT NULL::jsonb, p_association_admin_associations uuid[] DEFAULT NULL::uuid[], p_club_admin_clubs uuid[] DEFAULT NULL::uuid[])
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_caller_is_super_admin BOOLEAN;
  v_scope JSONB;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid() AND role = 'SUPER_ADMIN'
  ) INTO v_caller_is_super_admin;

  IF NOT v_caller_is_super_admin THEN
    RAISE EXCEPTION 'Only super admins can manage roles';
  END IF;

  IF p_roles IS NULL OR array_length(p_roles, 1) IS NULL THEN
    RAISE EXCEPTION 'Cannot save a user with no roles assigned';
  END IF;

  IF p_user_id = auth.uid() AND NOT ('SUPER_ADMIN' = ANY(p_roles)) THEN
    RAISE EXCEPTION 'You cannot remove your own Super Admin role';
  END IF;

  DELETE FROM user_roles WHERE user_id = p_user_id;

  IF 'SUPER_ADMIN' = ANY(p_roles) THEN
    INSERT INTO user_roles (user_id, role) VALUES (p_user_id, 'SUPER_ADMIN');
  END IF;
  IF 'PLAYER' = ANY(p_roles) THEN
    INSERT INTO user_roles (user_id, role) VALUES (p_user_id, 'PLAYER');
  END IF;
  IF 'VOTER' = ANY(p_roles) THEN
    INSERT INTO user_roles (user_id, role) VALUES (p_user_id, 'VOTER');
  END IF;
  IF 'COACH' = ANY(p_roles) AND p_coach_scopes IS NOT NULL THEN
    FOR v_scope IN SELECT * FROM jsonb_array_elements(p_coach_scopes)
    LOOP
      INSERT INTO user_roles (user_id, role, association_id, club_id, team_id)
      VALUES (p_user_id, 'COACH',
        NULLIF((v_scope->>'association_id'), '')::UUID,
        NULLIF((v_scope->>'club_id'), '')::UUID,
        NULLIF((v_scope->>'team_id'), '')::UUID);
    END LOOP;
  END IF;
  IF 'TEAM_MANAGER' = ANY(p_roles) AND p_manager_scopes IS NOT NULL THEN
    FOR v_scope IN SELECT * FROM jsonb_array_elements(p_manager_scopes)
    LOOP
      INSERT INTO user_roles (user_id, role, association_id, club_id, team_id)
      VALUES (p_user_id, 'TEAM_MANAGER',
        NULLIF((v_scope->>'association_id'), '')::UUID,
        NULLIF((v_scope->>'club_id'), '')::UUID,
        NULLIF((v_scope->>'team_id'), '')::UUID);
    END LOOP;
  END IF;
  IF 'ASSOCIATION_ADMIN' = ANY(p_roles) AND p_association_admin_associations IS NOT NULL THEN
    INSERT INTO user_roles (user_id, role, association_id)
    SELECT p_user_id, 'ASSOCIATION_ADMIN', unnest(p_association_admin_associations);
  END IF;
  IF 'CLUB_ADMIN' = ANY(p_roles) AND p_club_admin_clubs IS NOT NULL THEN
    INSERT INTO user_roles (user_id, role, club_id)
    SELECT p_user_id, 'CLUB_ADMIN', unnest(p_club_admin_clubs);
  END IF;
END;
$function$;


-- ===== KEEPER: admin_save_user_roles(uuid,text[],jsonb,jsonb,uuid[],jsonb) =====
-- This is the version the app calls. NOT dropped. Included for reference.
CREATE OR REPLACE FUNCTION public.admin_save_user_roles(p_user_id uuid, p_roles text[], p_coach_scopes jsonb DEFAULT NULL::jsonb, p_manager_scopes jsonb DEFAULT NULL::jsonb, p_association_admin_associations uuid[] DEFAULT NULL::uuid[], p_club_admin_scopes jsonb DEFAULT NULL::jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_caller_is_super_admin BOOLEAN;
  v_scope JSONB;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid() AND role = 'SUPER_ADMIN'
  ) INTO v_caller_is_super_admin;

  IF NOT v_caller_is_super_admin THEN
    RAISE EXCEPTION 'Only super admins can manage roles';
  END IF;

  IF p_roles IS NULL OR array_length(p_roles, 1) IS NULL THEN
    RAISE EXCEPTION 'Cannot save a user with no roles assigned';
  END IF;

  IF p_user_id = auth.uid() AND NOT ('SUPER_ADMIN' = ANY(p_roles)) THEN
    RAISE EXCEPTION 'You cannot remove your own Super Admin role';
  END IF;

  DELETE FROM user_roles WHERE user_id = p_user_id;

  IF 'SUPER_ADMIN' = ANY(p_roles) THEN
    INSERT INTO user_roles (user_id, role) VALUES (p_user_id, 'SUPER_ADMIN');
  END IF;
  IF 'PLAYER' = ANY(p_roles) THEN
    INSERT INTO user_roles (user_id, role) VALUES (p_user_id, 'PLAYER');
  END IF;
  IF 'VOTER' = ANY(p_roles) THEN
    INSERT INTO user_roles (user_id, role) VALUES (p_user_id, 'VOTER');
  END IF;
  IF 'COACH' = ANY(p_roles) AND p_coach_scopes IS NOT NULL THEN
    FOR v_scope IN SELECT * FROM jsonb_array_elements(p_coach_scopes)
    LOOP
      INSERT INTO user_roles (user_id, role, association_id, club_id, team_id)
      VALUES (p_user_id, 'COACH',
        NULLIF((v_scope->>'association_id'), '')::UUID,
        NULLIF((v_scope->>'club_id'), '')::UUID,
        NULLIF((v_scope->>'team_id'), '')::UUID);
    END LOOP;
  END IF;
  IF 'TEAM_MANAGER' = ANY(p_roles) AND p_manager_scopes IS NOT NULL THEN
    FOR v_scope IN SELECT * FROM jsonb_array_elements(p_manager_scopes)
    LOOP
      INSERT INTO user_roles (user_id, role, association_id, club_id, team_id)
      VALUES (p_user_id, 'TEAM_MANAGER',
        NULLIF((v_scope->>'association_id'), '')::UUID,
        NULLIF((v_scope->>'club_id'), '')::UUID,
        NULLIF((v_scope->>'team_id'), '')::UUID);
    END LOOP;
  END IF;
  IF 'ASSOCIATION_ADMIN' = ANY(p_roles) AND p_association_admin_associations IS NOT NULL THEN
    INSERT INTO user_roles (user_id, role, association_id)
    SELECT p_user_id, 'ASSOCIATION_ADMIN', unnest(p_association_admin_associations);
  END IF;
  IF 'CLUB_ADMIN' = ANY(p_roles) AND p_club_admin_scopes IS NOT NULL THEN
    FOR v_scope IN SELECT * FROM jsonb_array_elements(p_club_admin_scopes)
    LOOP
      INSERT INTO user_roles (user_id, role, association_id, club_id)
      VALUES (p_user_id, 'CLUB_ADMIN',
        NULLIF((v_scope->>'association_id'), '')::UUID,
        NULLIF((v_scope->>'club_id'), '')::UUID);
    END LOOP;
  END IF;
END;
$function$;
