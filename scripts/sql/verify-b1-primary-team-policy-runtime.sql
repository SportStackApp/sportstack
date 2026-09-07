-- Transaction-only proof for association-scoped Primary team membership.
-- The fixed test IDs exist only until the final ROLLBACK.

begin;

insert into auth.users (id, email, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000101', 'b1-primary-player@example.invalid', '{"first_name":"Policy","last_name":"Player"}', now(), now()),
  ('00000000-0000-0000-0000-000000000102', 'b1-primary-manager@example.invalid', '{"first_name":"Team","last_name":"Manager"}', now(), now()),
  ('00000000-0000-0000-0000-000000000103', 'b1-primary-club@example.invalid', '{"first_name":"Club","last_name":"Admin"}', now(), now()),
  ('00000000-0000-0000-0000-000000000104', 'b1-primary-unrelated@example.invalid', '{"first_name":"Unrelated","last_name":"User"}', now(), now());

insert into public.profiles (id, first_name, last_name)
values
  ('00000000-0000-0000-0000-000000000101', 'Policy', 'Player'),
  ('00000000-0000-0000-0000-000000000102', 'Team', 'Manager'),
  ('00000000-0000-0000-0000-000000000103', 'Club', 'Admin'),
  ('00000000-0000-0000-0000-000000000104', 'Unrelated', 'User')
on conflict (id) do nothing;

insert into public.associations (id, name)
values
  ('00000000-0000-0000-0000-000000000201', 'B1 Association A'),
  ('00000000-0000-0000-0000-000000000202', 'B1 Association B');

insert into public.clubs (id, association_id, name)
values
  ('00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000201', 'B1 Club A'),
  ('00000000-0000-0000-0000-000000000302', '00000000-0000-0000-0000-000000000202', 'B1 Club B');

insert into public.teams (id, club_id, name, mvp_enabled, mvp_notifications_enabled)
values
  ('00000000-0000-0000-0000-000000000401', '00000000-0000-0000-0000-000000000301', 'B1 Old A', false, true),
  ('00000000-0000-0000-0000-000000000402', '00000000-0000-0000-0000-000000000301', 'B1 New A', false, true),
  ('00000000-0000-0000-0000-000000000403', '00000000-0000-0000-0000-000000000302', 'B1 Primary B', false, true);

insert into public.team_memberships (user_id, team_id, membership_type, status)
values
  ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000401', 'PRIMARY', 'ACTIVE'),
  ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000403', 'PRIMARY', 'ACTIVE');

insert into public.user_roles (user_id, role, team_id)
values ('00000000-0000-0000-0000-000000000102', 'TEAM_MANAGER', '00000000-0000-0000-0000-000000000402');
insert into public.user_roles (user_id, role, club_id)
values ('00000000-0000-0000-0000-000000000103', 'CLUB_ADMIN', '00000000-0000-0000-0000-000000000301');

do $same_association_guard$
begin
  begin
    insert into public.team_memberships (user_id, team_id, membership_type, status)
    values (
      '00000000-0000-0000-0000-000000000101',
      '00000000-0000-0000-0000-000000000402',
      'PRIMARY',
      'ACTIVE'
    );
    raise exception 'A second active Primary in the same association was accepted.';
  exception
    when others then
      if sqlerrm <> 'This person already has an active primary team in that association.' then raise; end if;
  end;
end;
$same_association_guard$;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000101', true);
set local role authenticated;
select set_config(
  'b1_primary.request_id',
  public.request_primary_team_change('00000000-0000-0000-0000-000000000402')->>'request_id',
  true
);

reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000104', true);
set local role authenticated;
do $unrelated_denied$
begin
  begin
    perform public.approve_primary_team_change(current_setting('b1_primary.request_id')::uuid);
    raise exception 'An unrelated user approved the Primary-team request.';
  exception
    when others then
      if sqlerrm <> 'The primary team change request was not found.' then raise; end if;
  end;
end;
$unrelated_denied$;

reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000102', true);
set local role authenticated;
do $team_manager_approval$
declare
  v_result jsonb;
begin
  v_result := public.approve_primary_team_change(current_setting('b1_primary.request_id')::uuid);
  if v_result->>'status' <> 'COMPLETED' then
    raise exception 'Team Manager approval did not complete the request.';
  end if;
end;
$team_manager_approval$;

reset role;
do $membership_result$
declare
  v_old_a_type text;
  v_new_a_type text;
  v_b_type text;
begin
  select membership_type::text into v_old_a_type
  from public.team_memberships
  where user_id = '00000000-0000-0000-0000-000000000101'
    and team_id = '00000000-0000-0000-0000-000000000401';
  select membership_type::text into v_new_a_type
  from public.team_memberships
  where user_id = '00000000-0000-0000-0000-000000000101'
    and team_id = '00000000-0000-0000-0000-000000000402';
  select membership_type::text into v_b_type
  from public.team_memberships
  where user_id = '00000000-0000-0000-0000-000000000101'
    and team_id = '00000000-0000-0000-0000-000000000403';

  if v_old_a_type <> 'SECONDARY' or v_new_a_type <> 'PRIMARY' or v_b_type <> 'PRIMARY' then
    raise exception 'Association-scoped Primary result was %, %, %.', v_old_a_type, v_new_a_type, v_b_type;
  end if;
end;
$membership_result$;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000101', true);
set local role authenticated;
select set_config(
  'b1_primary.club_request_id',
  public.request_primary_team_change('00000000-0000-0000-0000-000000000401')->>'request_id',
  true
);

reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000103', true);
set local role authenticated;
do $club_admin_approval$
begin
  if public.approve_primary_team_change(
    current_setting('b1_primary.club_request_id')::uuid
  )->>'status' <> 'COMPLETED' then
    raise exception 'Club Admin approval did not complete the request.';
  end if;
end;
$club_admin_approval$;

reset role;
do $privilege_check$
begin
  if pg_catalog.has_function_privilege(
    'authenticated',
    'private.apply_primary_team_for_association(uuid,uuid,uuid)',
    'EXECUTE'
  ) then
    raise exception 'Authenticated callers can execute the internal Primary helper.';
  end if;
  if pg_catalog.has_function_privilege(
    'anon',
    'public.approve_primary_team_change(uuid)',
    'EXECUTE'
  ) then
    raise exception 'Anonymous callers can execute Primary approval.';
  end if;
end;
$privilege_check$;

rollback;

select 'B1_PRIMARY_TEAM_POLICY_RUNTIME_OK';
