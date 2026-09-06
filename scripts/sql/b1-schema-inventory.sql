-- Read-only structural inventory used by the B1 Dev-to-Production comparison.
-- It returns definitions and privileges only; no application table rows are read.
with enum_inventory as (
  select
    n.nspname as schema_name,
    t.typname::text as object_name,
    jsonb_agg(e.enumlabel order by e.enumsortorder) as definition
  from pg_type t
  join pg_namespace n on n.oid = t.typnamespace
  join pg_enum e on e.enumtypid = t.oid
  where n.nspname in ('public', 'private')
  group by n.nspname, t.typname
),
relation_inventory as (
  select
    n.nspname as schema_name,
    c.relname::text as object_name,
    case c.relkind
      when 'r' then 'table'
      when 'p' then 'partitioned_table'
      when 'v' then 'view'
      when 'm' then 'materialized_view'
      when 'S' then 'sequence'
      else c.relkind::text
    end as object_type,
    jsonb_build_object(
      'rls_enabled', c.relrowsecurity,
      'rls_forced', c.relforcerowsecurity,
      'view_definition', case when c.relkind in ('v', 'm') then pg_get_viewdef(c.oid, true) else null end,
      'columns', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'name', a.attname,
            'type', pg_catalog.format_type(a.atttypid, a.atttypmod),
            'not_null', a.attnotnull,
            'identity', a.attidentity,
            'generated', a.attgenerated,
            'default', pg_get_expr(ad.adbin, ad.adrelid)
          ) order by a.attnum
        )
        from pg_attribute a
        left join pg_attrdef ad on ad.adrelid = a.attrelid and ad.adnum = a.attnum
        where a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
      ), '[]'::jsonb)
    ) as definition
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname in ('public', 'private')
    and c.relkind in ('r', 'p', 'v', 'm', 'S')
),
constraint_inventory as (
  select
    n.nspname as schema_name,
    format('%s.%s', c.relname::text, con.conname::text) as object_name,
    jsonb_build_object(
      'table', c.relname,
      'type', con.contype,
      'definition', pg_get_constraintdef(con.oid, true),
      'validated', con.convalidated,
      'deferrable', con.condeferrable,
      'deferred', con.condeferred
    ) as definition
  from pg_constraint con
  join pg_class c on c.oid = con.conrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname in ('public', 'private')
),
index_inventory as (
  select
    n.nspname as schema_name,
    i.relname::text as object_name,
    to_jsonb(pg_get_indexdef(i.oid)) as definition
  from pg_index x
  join pg_class i on i.oid = x.indexrelid
  join pg_class t on t.oid = x.indrelid
  join pg_namespace n on n.oid = t.relnamespace
  where n.nspname in ('public', 'private')
),
function_inventory as (
  select
    n.nspname as schema_name,
    format('%s(%s)', p.proname::text, pg_get_function_identity_arguments(p.oid)) as object_name,
    jsonb_build_object(
      'result', pg_get_function_result(p.oid),
      'kind', p.prokind,
      'security_definer', p.prosecdef,
      'config', p.proconfig,
      'definition', pg_get_functiondef(p.oid)
    ) as definition
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('public', 'private')
),
trigger_inventory as (
  select
    n.nspname as schema_name,
    format('%s.%s', c.relname::text, t.tgname::text) as object_name,
    to_jsonb(pg_get_triggerdef(t.oid, true)) as definition
  from pg_trigger t
  join pg_class c on c.oid = t.tgrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname in ('public', 'private') and not t.tgisinternal
),
policy_inventory as (
  select
    schemaname as schema_name,
    format('%s.%s', tablename, policyname) as object_name,
    jsonb_build_object(
      'table', tablename,
      'permissive', permissive,
      'roles', roles,
      'command', cmd,
      'using', qual,
      'with_check', with_check
    ) as definition
  from pg_policies
  where schemaname in ('public', 'private')
),
table_grant_inventory as (
  select
    table_schema as schema_name,
    format('%s.%s.%s', table_name, grantee, privilege_type) as object_name,
    jsonb_build_object(
      'table', table_name,
      'grantee', grantee,
      'privilege', privilege_type,
      'grantable', is_grantable
    ) as definition
  from information_schema.role_table_grants
  where table_schema in ('public', 'private')
),
routine_grant_inventory as (
  select
    n.nspname as schema_name,
    format(
      '%s(%s).%s.%s',
      p.proname::text,
      pg_get_function_identity_arguments(p.oid),
      case when access.grantee = 0 then 'PUBLIC' else pg_get_userbyid(access.grantee) end,
      access.privilege_type
    ) as object_name,
    jsonb_build_object(
      'routine', p.proname,
      'identity_arguments', pg_get_function_identity_arguments(p.oid),
      'grantee', case when access.grantee = 0 then 'PUBLIC' else pg_get_userbyid(access.grantee) end,
      'privilege', access.privilege_type,
      'grantable', access.is_grantable
    ) as definition
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) access
  where n.nspname in ('public', 'private')
),
inventory as (
  select 'enum' as object_type, schema_name, object_name, definition from enum_inventory
  union all
  select object_type, schema_name, object_name, definition from relation_inventory
  union all
  select 'constraint', schema_name, object_name, definition from constraint_inventory
  union all
  select 'index', schema_name, object_name, definition from index_inventory
  union all
  select 'function', schema_name, object_name, definition from function_inventory
  union all
  select 'trigger', schema_name, object_name, definition from trigger_inventory
  union all
  select 'policy', schema_name, object_name, definition from policy_inventory
  union all
  select 'table_grant', schema_name, object_name, definition from table_grant_inventory
  union all
  select 'routine_grant', schema_name, object_name, definition from routine_grant_inventory
)
select jsonb_agg(
  jsonb_build_object(
    'object_type', object_type,
    'schema_name', schema_name,
    'object_name', object_name,
    'definition', definition
  ) order by object_type, schema_name, object_name
) as inventory
from inventory;
