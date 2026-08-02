-- Authorise the Dev-only disposable-account provisioner against the live
-- Auth session as well as the caller's current SUPER_ADMIN database role.
-- The Edge Function calls this with the service role; browser callers cannot.

create or replace function public.authorise_dev_test_account_provisioning(
  p_user_id uuid,
  p_session_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from auth.sessions session_row
    where session_row.id = p_session_id
      and session_row.user_id = p_user_id
      and (session_row.not_after is null or session_row.not_after > now())
  )
  and exists (
    select 1
    from public.user_roles role_row
    where role_row.user_id = p_user_id
      and role_row.role::text = 'SUPER_ADMIN'
  );
$function$;

revoke all on function public.authorise_dev_test_account_provisioning(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.authorise_dev_test_account_provisioning(uuid, uuid)
  to service_role;

comment on function public.authorise_dev_test_account_provisioning(uuid, uuid) is
  'Service-only Dev provisioner gate requiring a live Auth session and current SUPER_ADMIN role.';
