\set ON_ERROR_STOP on

begin;
\i /repo/supabase/migrations/20260906095820_b1_membership_workflow_compatibility.sql

do $b1c_during_rollback$
declare
  v_count integer;
begin
  select count(*)
  into v_count
  from pg_catalog.pg_proc procedure_row
  join pg_catalog.pg_namespace namespace_row
    on namespace_row.oid = procedure_row.pronamespace
  where namespace_row.nspname = 'public'
    and procedure_row.proname in (
      'approve_primary_team_change',
      'can_review_primary_team_change',
      'cancel_primary_team_change',
      'confirm_primary_team_change',
      'decline_primary_team_change',
      'request_primary_team_change'
    );
  if v_count <> 6 then
    raise exception 'B1c did not create all six functions inside the rollback transaction.';
  end if;

  select count(*)
  into v_count
  from pg_catalog.pg_policies policy_row
  where policy_row.schemaname = 'public'
    and policy_row.tablename = 'primary_change_requests';
  if v_count <> 2 then
    raise exception 'B1c did not converge to two read policies inside the rollback transaction.';
  end if;
end;
$b1c_during_rollback$;

rollback;

do $b1c_after_rollback$
declare
  v_count integer;
begin
  select count(*)
  into v_count
  from pg_catalog.pg_proc procedure_row
  join pg_catalog.pg_namespace namespace_row
    on namespace_row.oid = procedure_row.pronamespace
  where namespace_row.nspname = 'public'
    and procedure_row.proname in (
      'approve_primary_team_change',
      'can_review_primary_team_change',
      'cancel_primary_team_change',
      'confirm_primary_team_change',
      'decline_primary_team_change',
      'request_primary_team_change'
    );
  if v_count <> 0 then
    raise exception 'Rollback left % B1c functions on the Production-derived base.', v_count;
  end if;

  select count(*)
  into v_count
  from pg_catalog.pg_policies policy_row
  where policy_row.schemaname = 'public'
    and policy_row.tablename = 'primary_change_requests'
    and policy_row.policyname in (
      'primary_change_requests_insert_own',
      'primary_change_requests_read_own',
      'primary_change_requests_super_admin',
      'primary_change_requests_update_own'
    );
  if v_count <> 4 then
    raise exception 'Rollback did not restore the four Production request policies.';
  end if;

  if not pg_catalog.has_table_privilege(
    'authenticated',
    'public.primary_change_requests',
    'INSERT,UPDATE,DELETE'
  ) then
    raise exception 'Rollback did not restore the Production table privileges.';
  end if;
end;
$b1c_after_rollback$;

select 'B1_MEMBERSHIP_ROLLBACK_OK';
