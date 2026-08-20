-- Transactional regression test for private helpers used by signed-in RLS
-- policies and RPC wrappers. No application data is changed.
begin;

do $test$
declare
  v_signature text;
begin
  foreach v_signature in array array[
    'private.mvp_can_manage_team(uuid,uuid)',
    'private.mvp_can_audit_session(uuid,uuid)',
    'private.mvp_can_raw_audit_session(uuid,uuid)',
    'private.mvp_player_is_eligible(uuid,uuid)',
    'private.module_allowed_for_current_session(text,uuid,uuid,uuid,uuid)',
    'private.player_mvp_team_allowed_for_current_session(uuid,uuid)',
    'private.player_mvp_session_allowed_for_current_session(uuid)',
    'private.player_mvp_vote_allowed_for_current_session(uuid,uuid)',
    'private.player_mvp_fixture_team_allowed_for_current_session(uuid,uuid)',
    'private.player_mvp_session_row_allowed_for_current_session(uuid,uuid)',
    'private.umpire_match_fixture_allowed_for_current_session(uuid)',
    'private.umpire_match_submission_allowed_for_current_session(uuid)',
    'private.umpire_match_submission_row_allowed_for_current_session(uuid,uuid,uuid,uuid,uuid)',
    'private.communication_is_super_admin()',
    'private.communication_has_channel_access(uuid,timestamp with time zone)',
    'private.communication_can_administer(uuid)',
    'private.communication_can_publish(uuid)',
    'private.communication_can_moderate(uuid)',
    'private.can_manage_fixture_team(uuid,uuid)',
    'private.has_current_fixture_fill_in_access(uuid,uuid,uuid)',
    'private.is_active_team_member(uuid,uuid)',
    'private.rg_is_safety_admin()',
    'private.rg_can_read_scope(uuid,uuid,uuid)',
    'private.rg_can_manage_scope(uuid,uuid,uuid)',
    'private.rg_can_read_settings(uuid)',
    'private.rg_can_manage_settings(uuid)',
    'private.discipline_has_case_role(uuid,text[],uuid)',
    'private.discipline_can_read_case(uuid,uuid)',
    'private.discipline_can_manage_case(uuid,uuid)',
    'private.discipline_can_investigate(uuid,uuid)',
    'private.discipline_can_manage_config(uuid,uuid)',
    'private.discipline_can_create_case(uuid,uuid)',
    'private.discipline_has_association_access(uuid,uuid)',
    'private.discipline_storage_case_id(text)',
    'private.discipline_can_complete_phase2_stage(uuid,text,uuid)',
    'private.coordination_direct_bundle_allowed(text,uuid,uuid,uuid)'
  ] loop
    if not has_function_privilege('authenticated', v_signature, 'EXECUTE') then
      raise exception 'Authenticated EXECUTE is missing for %.', v_signature;
    end if;
    if has_function_privilege('anon', v_signature, 'EXECUTE') then
      raise exception 'Anonymous EXECUTE is present for %.', v_signature;
    end if;
  end loop;

  foreach v_signature in array array[
    'private.coordination_fixture_id_for_position(uuid)',
    'private.coordination_fixture_id_for_recipient(uuid)',
    'private.coordination_fixture_id_for_batch(uuid)',
    'private.protect_coordination_system_permission_set()',
    'private.protect_coordination_system_set_child()'
  ] loop
    if has_function_privilege('authenticated', v_signature, 'EXECUTE')
       or has_function_privilege('anon', v_signature, 'EXECUTE') then
      raise exception 'Internal helper remains browser-executable: %.', v_signature;
    end if;
  end loop;
end
$test$;

-- Exercise one policy-backed read per affected area as an authenticated role
-- without a signed-in user. The expected result is no rows and, importantly,
-- no function permission error.
select set_config('request.jwt.claims', '{"role":"authenticated"}', true);
set local role authenticated;

select count(*) from public.mvp_voting_sessions;
select count(*) from public.communication_channels;
select count(*) from public.fixture_fill_ins;
select count(*) from public.discipline_cases;
select count(*) from public.rg_risk_register;
select count(*) from public.player_vote_submissions;

reset role;
rollback;
