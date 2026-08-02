-- Keep permission-management profile searches inside the caller's real scope.
-- Internal SECURITY DEFINER helpers are deliberately not Data API endpoints.

create or replace function public.permission_visible_profiles_for_mode(
  p_scope_type text,
  p_scope_id uuid,
  p_actor_mode text default null
)
returns table (profile_id uuid, display_name text)
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is null then
    raise exception 'You must be signed in.';
  end if;
  if not public.can_manage_module_scope(v_actor, p_scope_type, p_scope_id) then
    raise exception 'You cannot view permission subjects at this scope.';
  end if;

  return query
  select profile.id,
    coalesce(nullif(btrim(concat_ws(' ', profile.first_name, profile.last_name)), ''), profile.id::text)
  from public.profiles profile
  where public.permission_user_in_scope(profile.id, p_scope_type, p_scope_id)
    and public.permission_subject_manageable(p_actor_mode, 'USER', profile.id::text)
  order by 2;
end;
$function$;

-- Owner-to-owner helpers only. They are called by the authenticated wrapper
-- functions below and do not need direct browser execution rights.
revoke all on function public.permission_scope_details(text, uuid) from public, anon, authenticated;
revoke all on function public.permission_user_in_scope(uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.permission_subject_matches(uuid, text, text, uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.permission_subject_manageable(text, text, text) from public, anon, authenticated;
revoke all on function public.permission_save_group_unchecked(uuid, text, text, text, uuid, uuid[], boolean, text) from public, anon, authenticated;
revoke all on function public.permission_save_assignment_unchecked(uuid, uuid, text, text, text, uuid, boolean, text) from public, anon, authenticated;
revoke all on function public.permission_save_override_unchecked(text, text, text, text, uuid, boolean, text, boolean, text) from public, anon, authenticated;
revoke all on function public.permission_visible_profiles(text, uuid) from public, anon, authenticated;

-- Explicit Data API boundary: only the signed-in API role may call these
-- wrappers. Each wrapper still performs its own role and scope checks.
revoke all on function public.is_super_admin() from public, anon, authenticated;
revoke all on function public.resolve_effective_permission(text, uuid, uuid, uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.has_effective_permission(text, uuid, uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.permission_visible_profiles_for_mode(text, uuid, text) from public, anon, authenticated;
revoke all on function public.save_permission_group(uuid, text, text, text, uuid, uuid[], boolean, text) from public, anon, authenticated;
revoke all on function public.save_permission_set(uuid, text, text, text, uuid, jsonb, boolean, text) from public, anon, authenticated;
revoke all on function public.save_permission_assignment(uuid, uuid, text, text, text, uuid, boolean, text) from public, anon, authenticated;
revoke all on function public.save_permission_override(text, text, text, text, uuid, boolean, text, boolean, text) from public, anon, authenticated;

grant execute on function public.is_super_admin() to authenticated;
grant execute on function public.resolve_effective_permission(text, uuid, uuid, uuid, uuid, uuid) to authenticated;
grant execute on function public.has_effective_permission(text, uuid, uuid, uuid, uuid) to authenticated;
grant execute on function public.permission_visible_profiles_for_mode(text, uuid, text) to authenticated;
grant execute on function public.save_permission_group(uuid, text, text, text, uuid, uuid[], boolean, text) to authenticated;
grant execute on function public.save_permission_set(uuid, text, text, text, uuid, jsonb, boolean, text) to authenticated;
grant execute on function public.save_permission_assignment(uuid, uuid, text, text, text, uuid, boolean, text) to authenticated;
grant execute on function public.save_permission_override(text, text, text, text, uuid, boolean, text, boolean, text) to authenticated;
