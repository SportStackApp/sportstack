-- Supabase grants new public functions directly to API roles through default
-- privileges. Remove anonymous execution explicitly from administration RPCs.

revoke execute on function public.administration_effective_mode(text) from public, anon;
revoke execute on function public.administration_scope_allows(text, uuid, uuid, uuid) from public, anon;
revoke execute on function public.admin_save_user_roles(uuid, text[], jsonb, jsonb, uuid[], jsonb, text) from public, anon;
revoke execute on function public.admin_manage_team_membership(uuid, text, text, text) from public, anon;
revoke execute on function public.admin_create_team_invite(uuid, uuid, text, text) from public, anon;
revoke execute on function public.admin_cancel_team_invite(uuid, text) from public, anon;
revoke execute on function public.admin_membership_integrity_report() from public, anon;
revoke execute on function public.admin_visible_profile_ids(text, uuid, uuid, uuid) from public, anon;
revoke execute on function public.admin_update_profile_details(uuid, jsonb, text) from public, anon;

-- This older administrator function also mutates profile data and must never
-- be callable without an authenticated session.
revoke execute on function public.admin_merge_profiles(uuid, uuid, jsonb, jsonb) from public, anon;
grant execute on function public.admin_merge_profiles(uuid, uuid, jsonb, jsonb) to authenticated;
