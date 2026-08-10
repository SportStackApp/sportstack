-- Tighten direct function access, fix two mutable search paths and address
-- the verified RLS/FK performance advisories without changing policy semantics.

alter function public.update_updated_at() set search_path = pg_catalog;
alter function public.update_requests_updated_at() set search_path = pg_catalog;

revoke all on function public.update_updated_at() from public, anon, authenticated;
revoke all on function public.update_requests_updated_at() from public, anon, authenticated;
revoke all on function public.capture_communication_message_revision() from public, anon, authenticated;
revoke all on function public.ensure_player_role_for_active_membership() from public, anon, authenticated;
revoke all on function public.guard_team_membership_integrity() from public, anon, authenticated;
revoke all on function public.rls_auto_enable() from public, anon, authenticated;

grant execute on function public.update_updated_at() to service_role;
grant execute on function public.update_requests_updated_at() to service_role;
grant execute on function public.capture_communication_message_revision() to service_role;
grant execute on function public.ensure_player_role_for_active_membership() to service_role;
grant execute on function public.guard_team_membership_integrity() to service_role;
grant execute on function public.rls_auto_enable() to service_role;

do $$
declare
  policy_row record;
  next_qual text;
  next_check text;
  using_clause text;
  check_clause text;
begin
  for policy_row in
    select policy.*
    from pg_policies policy
    join (
      values
      ('administration_audit_log', 'administration_audit_read_scoped'),
      ('fixture_availability', 'fixture_avail_own'),
      ('fixture_availability', 'fixture_avail_read'),
      ('fixtures', 'fixtures_read'),
      ('formations', 'Association admins manage their association formations'),
      ('formations', 'Club admins manage their club formations'),
      ('formations', 'Team managers manage their team formations'),
      ('mvp_vote_submissions', 'Admins full access - mvp_vote_submissions'),
      ('mvp_vote_submissions', 'Voter manages own submission'),
      ('mvp_vote_tokens', 'Admins full access - mvp_vote_tokens'),
      ('mvp_votes', 'Super Association admin full access - mvp_votes'),
      ('mvp_votes', 'Voter can view own votes'),
      ('mvp_voting_sessions', 'Admins full access - mvp_voting_sessions'),
      ('notification_preferences', 'notif_prefs_own'),
      ('notifications', 'notifications_own'),
      ('pending_signups', 'pending_signups_own'),
      ('permission_assignments', 'permission_assignments_scoped_read'),
      ('permission_group_members', 'permission_group_members_scoped_read'),
      ('permission_groups', 'permission_groups_scoped_read'),
      ('permission_overrides', 'permission_overrides_scoped_read'),
      ('permission_set_permissions', 'permission_set_permissions_scoped_read'),
      ('permission_sets', 'permission_sets_scoped_read'),
      ('pitches', 'pitches_read'),
      ('player_vote_lines', 'Umpires can insert vote lines'),
      ('player_vote_lines', 'Umpires can view own vote lines'),
      ('player_vote_submissions', 'Umpires can insert submissions'),
      ('player_vote_submissions', 'Umpires can view own submissions'),
      ('primary_change_requests', 'primary_change_requests_insert_own'),
      ('primary_change_requests', 'primary_change_requests_read_own'),
      ('primary_change_requests', 'primary_change_requests_update_own'),
      ('profiles', 'profiles_insert_own'),
      ('profiles', 'profiles_read'),
      ('profiles', 'profiles_update_own'),
      ('requests', 'requests_association_admin_read'),
      ('requests', 'requests_association_admin_write'),
      ('requests', 'requests_club_admin_read'),
      ('requests', 'requests_club_admin_write'),
      ('requests', 'requests_insert_as_requester'),
      ('requests', 'requests_player_select'),
      ('requests', 'requests_player_update'),
      ('requests', 'requests_team_manager_read'),
      ('requests', 'requests_team_manager_write'),
      ('revsports_club_mappings', 'Super admins can manage revsports_club_mappings'),
      ('revsports_fixture_mappings', 'Super admins can manage revsports_fixture_mappings'),
      ('revsports_grade_mappings', 'Super admins can manage revsports_grade_mappings'),
      ('revsports_pitch_mappings', 'Super admins can manage revsports_pitch_mappings'),
      ('revsports_player_mappings', 'Super admins can manage revsports_player_mappings'),
      ('revsports_players', 'Admins full access - revsports_players'),
      ('revsports_team_mappings', 'Super admins can manage revsports_team_mappings'),
      ('revsports_team_mappings', 'Super admins can manage team mappings'),
      ('revsports_umpire_mappings', 'Super admins can manage revsports_umpire_mappings'),
      ('revsports_venue_mappings', 'Super admins can manage revsports_venue_mappings'),
      ('seasons', 'seasons_read'),
      ('sport_position_aliases', 'Scoped admins manage position aliases'),
      ('team_divisions', 'team_divisions_read'),
      ('team_memberships', 'team_memberships_own'),
      ('team_memberships', 'team_memberships_read'),
      ('umpire_fixtures', 'umpire_fixtures_read'),
      ('umpire_rounds', 'umpire_rounds_read'),
      ('user_roles', 'user_roles_read'),
      ('venues', 'venues_read')
    ) as target(table_name, policy_name)
      on target.table_name = policy.tablename
     and target.policy_name = policy.policyname
    where policy.schemaname = 'public'
  loop
    next_qual := replace(
      replace(
        replace(policy_row.qual, 'auth.uid()', '(select auth.uid())'),
        'auth.role()', '(select auth.role())'
      ),
      'auth.jwt()', '(select auth.jwt())'
    );
    next_check := replace(
      replace(
        replace(policy_row.with_check, 'auth.uid()', '(select auth.uid())'),
        'auth.role()', '(select auth.role())'
      ),
      'auth.jwt()', '(select auth.jwt())'
    );

    using_clause := case when next_qual is null then '' else format(' using (%s)', next_qual) end;
    check_clause := case when next_check is null then '' else format(' with check (%s)', next_check) end;

    execute format(
      'alter policy %I on public.%I%s%s',
      policy_row.policyname,
      policy_row.tablename,
      using_clause,
      check_clause
    );
  end loop;
end
$$;

create index if not exists idx_error_logs_user_id_fk on public.error_logs (user_id);
create index if not exists idx_expense_statement_lines_category_id_fk on public.expense_statement_lines (category_id);
create index if not exists idx_expense_statement_lines_expense_id_fk on public.expense_statement_lines (expense_id);
create index if not exists idx_expense_statement_lines_payment_method_id_fk on public.expense_statement_lines (payment_method_id);
create index if not exists idx_expense_statement_lines_reviewed_by_fk on public.expense_statement_lines (reviewed_by);
create index if not exists idx_expense_statement_lines_supplier_id_fk on public.expense_statement_lines (supplier_id);
create index if not exists idx_external_entity_links_matched_by_fk on public.external_entity_links (matched_by);
create index if not exists idx_fixtures_pitch_id_fk on public.fixtures (pitch_id);
create index if not exists idx_fixtures_venue_id_fk on public.fixtures (venue_id);
create index if not exists idx_mvp_votes_updated_by_fk on public.mvp_votes (updated_by);
create index if not exists idx_mvp_votes_player_id_fk on public.mvp_votes (player_id);
create index if not exists idx_mvp_voting_sessions_closed_by_fk on public.mvp_voting_sessions (closed_by);
create index if not exists idx_mvp_voting_sessions_created_by_fk on public.mvp_voting_sessions (created_by);
create index if not exists idx_mvp_voting_sessions_locked_by_fk on public.mvp_voting_sessions (locked_by);
create index if not exists idx_mvp_voting_sessions_opened_by_fk on public.mvp_voting_sessions (opened_by);
create index if not exists idx_mvp_voting_sessions_results_confirmed_by_fk on public.mvp_voting_sessions (results_confirmed_by);
create index if not exists idx_notifications_game_id_fk on public.notifications (game_id);
create index if not exists idx_player_vote_edits_changed_by_id_fk on public.player_vote_edits (changed_by_id);
create index if not exists idx_player_vote_edits_submission_id_fk on public.player_vote_edits (submission_id);
create index if not exists idx_player_vote_lines_team_id_fk on public.player_vote_lines (team_id);
create index if not exists idx_profile_claim_audit_placeholder_profile_id_fk on public.profile_claim_audit (placeholder_profile_id);
create index if not exists idx_revsports_player_mappings_profile_id_fk on public.revsports_player_mappings (profile_id);
create index if not exists idx_revsports_player_registry_profile_id_fk on public.revsports_player_registry (profile_id);
create index if not exists idx_revsports_players_fixture_id_fk on public.revsports_players (fixture_id);
create index if not exists idx_revsports_players_profile_id_fk on public.revsports_players (profile_id);
create index if not exists idx_revsports_team_mappings_team_id_fk on public.revsports_team_mappings (team_id);
create index if not exists idx_source_revsports_change_log_scrape_run_id_fk on public.source_revsports_change_log (scrape_run_id);
create index if not exists idx_source_revsports_matches_scrape_run_id_fk on public.source_revsports_matches (scrape_run_id);
create index if not exists idx_source_revsports_player_appearances_match_id_fk on public.source_revsports_player_appearances (match_id);
create index if not exists idx_source_revsports_player_appearances_match_team_id_fk on public.source_revsports_player_appearances (match_team_id);
create index if not exists idx_source_revsports_player_appearances_scrape_run_id_fk on public.source_revsports_player_appearances (scrape_run_id);
create index if not exists idx_source_scrape_runs_association_id_fk on public.source_scrape_runs (association_id);
create index if not exists idx_team_memberships_invited_by_fk on public.team_memberships (invited_by);
