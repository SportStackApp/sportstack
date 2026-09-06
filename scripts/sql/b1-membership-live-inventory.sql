-- Aggregate-only inventory for the B1c primary-team change workflow.
-- It deliberately returns no user, team, request or membership identifiers.
with metrics as (
  select 'requests_total'::text as metric, count(*)::bigint as value
  from public.primary_change_requests

  union all

  select 'requests_invalid_status', count(*)
  from public.primary_change_requests
  where status not in (
    'PENDING',
    'ADMIN_APPROVED',
    'COMPLETED',
    'APPROVED',
    'DECLINED',
    'CANCELLED'
  )

  union all

  select 'requests_pending', count(*)
  from public.primary_change_requests
  where status = 'PENDING'

  union all

  select 'requests_admin_approved', count(*)
  from public.primary_change_requests
  where status = 'ADMIN_APPROVED'

  union all

  select 'duplicate_active_primary_users', count(*)
  from (
    select membership.user_id
    from public.team_memberships membership
    where membership.status = 'ACTIVE'::public.membership_status_enum
      and membership.membership_type = 'PRIMARY'::public.membership_type_enum
    group by membership.user_id
    having count(*) > 1
  ) duplicate_user

  union all

  select 'duplicate_user_team_memberships', count(*)
  from (
    select membership.user_id, membership.team_id
    from public.team_memberships membership
    group by membership.user_id, membership.team_id
    having count(*) > 1
  ) duplicate_pair

  union all

  select 'duplicate_active_primary_pairs', count(*)
  from (
    select membership.user_id, membership.team_id
    from public.team_memberships membership
    where membership.status = 'ACTIVE'::public.membership_status_enum
      and membership.membership_type = 'PRIMARY'::public.membership_type_enum
    group by membership.user_id, membership.team_id
    having count(*) > 1
  ) duplicate_pair

  union all

  select 'multi_team_active_primary_users', count(*)
  from (
    select membership.user_id
    from public.team_memberships membership
    where membership.status = 'ACTIVE'::public.membership_status_enum
      and membership.membership_type = 'PRIMARY'::public.membership_type_enum
    group by membership.user_id
    having count(distinct membership.team_id) > 1
  ) duplicate_user

  union all

  select 'admin_approved_request_users_with_multiple_active_primaries', count(*)
  from public.primary_change_requests request_row
  where request_row.status = 'ADMIN_APPROVED'
    and (
      select count(*)
      from public.team_memberships membership
      where membership.user_id = request_row.user_id
        and membership.status = 'ACTIVE'::public.membership_status_enum
        and membership.membership_type = 'PRIMARY'::public.membership_type_enum
    ) > 1

  union all

  select 'admin_approved_requests_with_duplicate_destination', count(*)
  from public.primary_change_requests request_row
  where request_row.status = 'ADMIN_APPROVED'
    and (
      select count(*)
      from public.team_memberships membership
      where membership.user_id = request_row.user_id
        and membership.team_id = request_row.to_team_id
    ) > 1

  union all

  select 'orphan_destination_teams', count(*)
  from public.primary_change_requests request_row
  left join public.teams team on team.id = request_row.to_team_id
  where team.id is null
),
function_inventory as (
  select
    procedure.proname as function_name,
    procedure.prosecdef as security_definer,
    exists (
      select 1
      from unnest(coalesce(procedure.proconfig, array[]::text[])) setting
      where setting in ('search_path=', 'search_path=""')
    ) as empty_search_path,
    has_function_privilege('anon', procedure.oid, 'EXECUTE') as anon_execute,
    has_function_privilege('authenticated', procedure.oid, 'EXECUTE') as authenticated_execute,
    has_function_privilege('service_role', procedure.oid, 'EXECUTE') as service_role_execute
  from pg_proc procedure
  join pg_namespace namespace on namespace.oid = procedure.pronamespace
  where namespace.nspname = 'public'
    and procedure.proname in (
      'request_primary_team_change',
      'approve_primary_team_change',
      'confirm_primary_team_change',
      'cancel_primary_team_change',
      'decline_primary_team_change',
      'can_review_primary_team_change'
    )
),
policy_inventory as (
  select
    policy.policyname,
    policy.cmd,
    policy.roles
  from pg_policies policy
  where policy.schemaname = 'public'
    and policy.tablename = 'primary_change_requests'
)
select jsonb_build_object(
  'metrics', (select jsonb_object_agg(metric, value order by metric) from metrics),
  'functions', coalesce(
    (select jsonb_agg(to_jsonb(function_row) order by function_name) from function_inventory function_row),
    '[]'::jsonb
  ),
  'policies', coalesce(
    (select jsonb_agg(to_jsonb(policy_row) order by policyname) from policy_inventory policy_row),
    '[]'::jsonb
  ),
  'table_privileges', jsonb_build_object(
    'anon_select', has_table_privilege('anon', 'public.primary_change_requests', 'SELECT'),
    'anon_insert', has_table_privilege('anon', 'public.primary_change_requests', 'INSERT'),
    'anon_update', has_table_privilege('anon', 'public.primary_change_requests', 'UPDATE'),
    'anon_delete', has_table_privilege('anon', 'public.primary_change_requests', 'DELETE'),
    'authenticated_select', has_table_privilege('authenticated', 'public.primary_change_requests', 'SELECT'),
    'authenticated_insert', has_table_privilege('authenticated', 'public.primary_change_requests', 'INSERT'),
    'authenticated_update', has_table_privilege('authenticated', 'public.primary_change_requests', 'UPDATE'),
    'authenticated_delete', has_table_privilege('authenticated', 'public.primary_change_requests', 'DELETE')
  )
) as b1_membership_inventory;
