-- Keep administrative portal access aligned with the association-level module flag.
-- Explicit portal access and assigned-case access remain valid for their own associations.

create or replace function public.get_discipline_portal_context()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $function$
  with actor_access as (
    select
      access.association_id,
      access.account_mode,
      access.can_create_cases,
      access.can_manage_config
    from public.discipline_portal_access access
    where access.user_id = auth.uid() and access.active
  ), case_access as (
    select distinct incident_case.association_id
    from public.discipline_case_members member
    join public.discipline_cases incident_case on incident_case.id = member.case_id
    where member.user_id = auth.uid() and member.active
  ), role_access as (
    select distinct role.association_id
    from public.user_roles role
    where role.user_id = auth.uid()
      and role.role = 'ASSOCIATION_ADMIN'::public.user_role_enum
      and role.association_id is not null
      and exists (
        select 1
        from public.module_feature_flags flag
        where flag.module_key = 'incident_discipline'
          and flag.scope_type = 'ASSOCIATION'
          and flag.scope_id = role.association_id
          and flag.enabled
      )
    union
    select distinct flag.scope_id
    from public.module_feature_flags flag
    where flag.module_key = 'incident_discipline'
      and flag.scope_type = 'ASSOCIATION'
      and flag.enabled
      and exists (
        select 1
        from public.user_roles role
        where role.user_id = auth.uid()
          and role.role = 'SUPER_ADMIN'::public.user_role_enum
      )
  )
  select jsonb_build_object(
    'allowed', exists (select 1 from actor_access)
      or exists (select 1 from case_access)
      or exists (select 1 from role_access),
    'discipline_only', exists (
      select 1 from actor_access where account_mode = 'DISCIPLINE_ONLY'
    ),
    'can_create_cases', exists (
      select 1 from actor_access where can_create_cases or can_manage_config
    ) or exists (select 1 from role_access),
    'can_manage_config', exists (
      select 1 from actor_access where can_manage_config
    ) or exists (select 1 from role_access),
    'association_ids', coalesce((
      select jsonb_agg(distinct association_id)
      from (
        select association_id from actor_access
        union
        select association_id from case_access
        union
        select association_id from role_access
      ) associations
    ), '[]'::jsonb)
  );
$function$;

revoke all on function public.get_discipline_portal_context() from public, anon;
grant execute on function public.get_discipline_portal_context() to authenticated;
