-- Restore the exact authenticated helper permissions that the Coordination
-- migration's schema-wide revoke removed on 17 August 2026.
--
-- These functions already enforce the application's user, scope and module
-- rules. EXECUTE lets the matching authenticated RLS policies and signed-in
-- RPC paths call those checks; it does not grant access to any table row by
-- itself. Anonymous access remains denied.

grant usage on schema private to authenticated;

-- Player MVP Voting management and audit helpers.
revoke execute on function private.mvp_can_manage_team(uuid, uuid) from public, anon;
revoke execute on function private.mvp_can_audit_session(uuid, uuid) from public, anon;
revoke execute on function private.mvp_can_raw_audit_session(uuid, uuid) from public, anon;
revoke execute on function private.mvp_player_is_eligible(uuid, uuid) from public, anon;

grant execute on function private.mvp_can_manage_team(uuid, uuid) to authenticated;
grant execute on function private.mvp_can_audit_session(uuid, uuid) to authenticated;
grant execute on function private.mvp_can_raw_audit_session(uuid, uuid) to authenticated;
grant execute on function private.mvp_player_is_eligible(uuid, uuid) to authenticated;

-- Session-bound module and voting policy helpers.
revoke execute on function private.module_allowed_for_current_session(
  text, uuid, uuid, uuid, uuid
) from public, anon;
revoke execute on function private.player_mvp_team_allowed_for_current_session(uuid, uuid)
  from public, anon;
revoke execute on function private.player_mvp_session_allowed_for_current_session(uuid)
  from public, anon;
revoke execute on function private.player_mvp_vote_allowed_for_current_session(uuid, uuid)
  from public, anon;
revoke execute on function private.player_mvp_fixture_team_allowed_for_current_session(uuid, uuid)
  from public, anon;
revoke execute on function private.player_mvp_session_row_allowed_for_current_session(uuid, uuid)
  from public, anon;
revoke execute on function private.umpire_match_fixture_allowed_for_current_session(uuid)
  from public, anon;
revoke execute on function private.umpire_match_submission_allowed_for_current_session(uuid)
  from public, anon;
revoke execute on function private.umpire_match_submission_row_allowed_for_current_session(
  uuid, uuid, uuid, uuid, uuid
) from public, anon;

grant execute on function private.module_allowed_for_current_session(
  text, uuid, uuid, uuid, uuid
) to authenticated;
grant execute on function private.player_mvp_team_allowed_for_current_session(uuid, uuid)
  to authenticated;
grant execute on function private.player_mvp_session_allowed_for_current_session(uuid)
  to authenticated;
grant execute on function private.player_mvp_vote_allowed_for_current_session(uuid, uuid)
  to authenticated;
grant execute on function private.player_mvp_fixture_team_allowed_for_current_session(uuid, uuid)
  to authenticated;
grant execute on function private.player_mvp_session_row_allowed_for_current_session(uuid, uuid)
  to authenticated;
grant execute on function private.umpire_match_fixture_allowed_for_current_session(uuid)
  to authenticated;
grant execute on function private.umpire_match_submission_allowed_for_current_session(uuid)
  to authenticated;
grant execute on function private.umpire_match_submission_row_allowed_for_current_session(
  uuid, uuid, uuid, uuid, uuid
) to authenticated;

-- Communications policy helpers.
revoke execute on function private.communication_is_super_admin() from public, anon;
revoke execute on function private.communication_has_channel_access(uuid, timestamptz)
  from public, anon;
revoke execute on function private.communication_can_administer(uuid) from public, anon;
revoke execute on function private.communication_can_publish(uuid) from public, anon;
revoke execute on function private.communication_can_moderate(uuid) from public, anon;

grant execute on function private.communication_is_super_admin() to authenticated;
grant execute on function private.communication_has_channel_access(uuid, timestamptz)
  to authenticated;
grant execute on function private.communication_can_administer(uuid) to authenticated;
grant execute on function private.communication_can_publish(uuid) to authenticated;
grant execute on function private.communication_can_moderate(uuid) to authenticated;

-- Fixture, fill-in and team-position policy helpers.
revoke execute on function private.can_manage_fixture_team(uuid, uuid) from public, anon;
revoke execute on function private.has_current_fixture_fill_in_access(uuid, uuid, uuid)
  from public, anon;
revoke execute on function private.is_active_team_member(uuid, uuid) from public, anon;

grant execute on function private.can_manage_fixture_team(uuid, uuid) to authenticated;
grant execute on function private.has_current_fixture_fill_in_access(uuid, uuid, uuid)
  to authenticated;
grant execute on function private.is_active_team_member(uuid, uuid) to authenticated;

-- Safety Hub policy helpers.
revoke execute on function private.rg_is_safety_admin() from public, anon;
revoke execute on function private.rg_can_read_scope(uuid, uuid, uuid) from public, anon;
revoke execute on function private.rg_can_manage_scope(uuid, uuid, uuid) from public, anon;
revoke execute on function private.rg_can_read_settings(uuid) from public, anon;
revoke execute on function private.rg_can_manage_settings(uuid) from public, anon;

grant execute on function private.rg_is_safety_admin() to authenticated;
grant execute on function private.rg_can_read_scope(uuid, uuid, uuid) to authenticated;
grant execute on function private.rg_can_manage_scope(uuid, uuid, uuid) to authenticated;
grant execute on function private.rg_can_read_settings(uuid) to authenticated;
grant execute on function private.rg_can_manage_settings(uuid) to authenticated;

-- Incident and Discipline policy helpers.
revoke execute on function private.discipline_has_case_role(uuid, text[], uuid) from public, anon;
revoke execute on function private.discipline_can_read_case(uuid, uuid) from public, anon;
revoke execute on function private.discipline_can_manage_case(uuid, uuid) from public, anon;
revoke execute on function private.discipline_can_investigate(uuid, uuid) from public, anon;
revoke execute on function private.discipline_can_manage_config(uuid, uuid) from public, anon;
revoke execute on function private.discipline_can_create_case(uuid, uuid) from public, anon;
revoke execute on function private.discipline_has_association_access(uuid, uuid) from public, anon;
revoke execute on function private.discipline_storage_case_id(text) from public, anon;
revoke execute on function private.discipline_can_complete_phase2_stage(uuid, text, uuid)
  from public, anon;

grant execute on function private.discipline_has_case_role(uuid, text[], uuid) to authenticated;
grant execute on function private.discipline_can_read_case(uuid, uuid) to authenticated;
grant execute on function private.discipline_can_manage_case(uuid, uuid) to authenticated;
grant execute on function private.discipline_can_investigate(uuid, uuid) to authenticated;
grant execute on function private.discipline_can_manage_config(uuid, uuid) to authenticated;
grant execute on function private.discipline_can_create_case(uuid, uuid) to authenticated;
grant execute on function private.discipline_has_association_access(uuid, uuid) to authenticated;
grant execute on function private.discipline_storage_case_id(text) to authenticated;
grant execute on function private.discipline_can_complete_phase2_stage(uuid, text, uuid)
  to authenticated;

-- A later Coordination migration created these SECURITY DEFINER helpers after
-- the schema-wide revoke. PostgreSQL's default PUBLIC grant made them
-- anonymously executable. Only the one used directly by an authenticated RLS
-- policy needs a browser-role grant; the others remain internal to triggers or
-- SECURITY DEFINER wrappers.
revoke execute on function private.coordination_direct_bundle_allowed(
  text, uuid, uuid, uuid
) from public, anon, authenticated;
revoke execute on function private.coordination_fixture_id_for_position(uuid)
  from public, anon, authenticated;
revoke execute on function private.coordination_fixture_id_for_recipient(uuid)
  from public, anon, authenticated;
revoke execute on function private.coordination_fixture_id_for_batch(uuid)
  from public, anon, authenticated;
revoke execute on function private.protect_coordination_system_permission_set()
  from public, anon, authenticated;
revoke execute on function private.protect_coordination_system_set_child()
  from public, anon, authenticated;

grant execute on function private.coordination_direct_bundle_allowed(
  text, uuid, uuid, uuid
) to authenticated;
