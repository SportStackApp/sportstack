-- Restore the authenticated access required by Player Explorer RLS policies.
-- A later Coordination migration intentionally reset private-schema function
-- privileges but also removed these existing grants.

revoke all on function private.player_explorer_super_admin_mode()
  from public, anon;
revoke all on function private.player_explorer_team_in_scope(uuid)
  from public, anon;
revoke all on function private.player_explorer_appearance_in_scope(uuid)
  from public, anon;
revoke all on function private.player_explorer_match_in_scope(uuid)
  from public, anon;
revoke all on function private.player_explorer_external_entity_in_scope(uuid)
  from public, anon;

grant execute on function private.player_explorer_super_admin_mode()
  to authenticated, service_role;
grant execute on function private.player_explorer_team_in_scope(uuid)
  to authenticated, service_role;
grant execute on function private.player_explorer_appearance_in_scope(uuid)
  to authenticated, service_role;
grant execute on function private.player_explorer_match_in_scope(uuid)
  to authenticated, service_role;
grant execute on function private.player_explorer_external_entity_in_scope(uuid)
  to authenticated, service_role;
