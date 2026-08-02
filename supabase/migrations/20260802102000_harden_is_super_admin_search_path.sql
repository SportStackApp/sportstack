-- Keep Super Admin checks reliable when called by functions that use an empty
-- search path. Schema-qualified names also prevent object-shadowing attacks.
create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.user_roles
    where user_id = auth.uid()
      and role = 'SUPER_ADMIN'
  );
$function$;
