-- The live Dev schema uses public.user_role_enum for public.user_roles.role.
-- The scoped administration migration retained one stale public.app_role cast,
-- which caused Association Admin role saves to fail at runtime.

do $migration$
declare
  v_signature regprocedure := to_regprocedure(
    'public.admin_save_user_roles(uuid,text[],jsonb,jsonb,uuid[],jsonb,text)'
  );
  v_definition text;
begin
  if v_signature is null then
    raise exception 'admin_save_user_roles was not found.';
  end if;

  select pg_get_functiondef(v_signature)
  into v_definition;

  if position('public.app_role' in v_definition) > 0 then
    execute replace(v_definition, 'public.app_role', 'public.user_role_enum');
  elsif position('public.user_role_enum' in v_definition) = 0 then
    raise exception 'admin_save_user_roles does not contain the expected role enum reference.';
  end if;
end;
$migration$;

-- Security-definer administration functions are authenticated-only.
revoke all on function public.admin_save_user_roles(
  uuid,
  text[],
  jsonb,
  jsonb,
  uuid[],
  jsonb,
  text
) from public, anon;

grant execute on function public.admin_save_user_roles(
  uuid,
  text[],
  jsonb,
  jsonb,
  uuid[],
  jsonb,
  text
) to authenticated;
