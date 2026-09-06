begin;

-- Fixture creation is rollback-only. Allow the test teams to use their live
-- Player MVP defaults without weakening the permanent team-settings guard.
select set_config('app.mvp_team_setting_write', 'allowed', true);

-- Isolated fixture identifiers. The transaction is rolled back at the end.
insert into auth.users (id, email, role, aud)
values
  ('b1e00000-0000-0000-0000-000000000001', 'b1e-super@example.invalid', 'authenticated', 'authenticated'),
  ('b1e00000-0000-0000-0000-000000000002', 'b1e-association@example.invalid', 'authenticated', 'authenticated'),
  ('b1e00000-0000-0000-0000-000000000003', 'b1e-club@example.invalid', 'authenticated', 'authenticated'),
  ('b1e00000-0000-0000-0000-000000000004', 'b1e-manager@example.invalid', 'authenticated', 'authenticated'),
  ('b1e00000-0000-0000-0000-000000000005', 'b1e-target@example.invalid', 'authenticated', 'authenticated'),
  ('b1e00000-0000-0000-0000-000000000006', 'b1e-unrelated@example.invalid', 'authenticated', 'authenticated'),
  ('b1e00000-0000-0000-0000-000000000007', 'b1e-unrelated-target@example.invalid', 'authenticated', 'authenticated'),
  ('b1e00000-0000-0000-0000-000000000008', 'b1e-coach@example.invalid', 'authenticated', 'authenticated'),
  ('b1e00000-0000-0000-0000-000000000009', 'b1e-player@example.invalid', 'authenticated', 'authenticated'),
  ('b1e00000-0000-0000-0000-000000000010', 'b1e-request-target@example.invalid', 'authenticated', 'authenticated'),
  ('b1e00000-0000-0000-0000-000000000011', 'b1e-invite-target@example.invalid', 'authenticated', 'authenticated'),
  ('b1e00000-0000-0000-0000-000000000012', 'b1e-membership-target@example.invalid', 'authenticated', 'authenticated'),
  ('b1e00000-0000-0000-0000-000000000013', 'b1e-legacy-role-target@example.invalid', 'authenticated', 'authenticated');

insert into auth.sessions (id, user_id, not_after)
values
  ('b1e60000-0000-0000-0000-000000000001', 'b1e00000-0000-0000-0000-000000000001', now() + interval '1 hour'),
  ('b1e60000-0000-0000-0000-000000000002', 'b1e00000-0000-0000-0000-000000000002', now() + interval '1 hour'),
  ('b1e60000-0000-0000-0000-000000000003', 'b1e00000-0000-0000-0000-000000000003', now() + interval '1 hour'),
  ('b1e60000-0000-0000-0000-000000000004', 'b1e00000-0000-0000-0000-000000000004', now() + interval '1 hour'),
  ('b1e60000-0000-0000-0000-000000000006', 'b1e00000-0000-0000-0000-000000000006', now() + interval '1 hour'),
  ('b1e60000-0000-0000-0000-000000000008', 'b1e00000-0000-0000-0000-000000000008', now() + interval '1 hour'),
  ('b1e60000-0000-0000-0000-000000000009', 'b1e00000-0000-0000-0000-000000000009', now() + interval '1 hour');

insert into public.associations (id, name)
values
  ('b1e10000-0000-0000-0000-000000000001', 'B1e Association A'),
  ('b1e10000-0000-0000-0000-000000000002', 'B1e Association B');

insert into public.clubs (id, association_id, name)
values
  ('b1e20000-0000-0000-0000-000000000001', 'b1e10000-0000-0000-0000-000000000001', 'B1e Club A'),
  ('b1e20000-0000-0000-0000-000000000002', 'b1e10000-0000-0000-0000-000000000002', 'B1e Club B');

insert into public.teams (id, club_id, name)
values
  ('b1e30000-0000-0000-0000-000000000001', 'b1e20000-0000-0000-0000-000000000001', 'B1e Team A'),
  ('b1e30000-0000-0000-0000-000000000002', 'b1e20000-0000-0000-0000-000000000002', 'B1e Team B');

insert into private.auth_session_permission_modes (
  session_id, user_id, root_mode, active_mode, revision,
  association_id, club_id, team_id
)
values
  ('b1e60000-0000-0000-0000-000000000001', 'b1e00000-0000-0000-0000-000000000001', 'super_admin', 'super_admin', 1, null, null, null),
  ('b1e60000-0000-0000-0000-000000000002', 'b1e00000-0000-0000-0000-000000000002', 'association', 'association', 2, 'b1e10000-0000-0000-0000-000000000001', null, null),
  ('b1e60000-0000-0000-0000-000000000003', 'b1e00000-0000-0000-0000-000000000003', 'club', 'club', 3, 'b1e10000-0000-0000-0000-000000000001', 'b1e20000-0000-0000-0000-000000000001', null),
  ('b1e60000-0000-0000-0000-000000000004', 'b1e00000-0000-0000-0000-000000000004', 'team_manager', 'team_manager', 4, 'b1e10000-0000-0000-0000-000000000001', 'b1e20000-0000-0000-0000-000000000001', 'b1e30000-0000-0000-0000-000000000001'),
  ('b1e60000-0000-0000-0000-000000000006', 'b1e00000-0000-0000-0000-000000000006', 'club', 'club', 6, 'b1e10000-0000-0000-0000-000000000002', 'b1e20000-0000-0000-0000-000000000002', null),
  ('b1e60000-0000-0000-0000-000000000008', 'b1e00000-0000-0000-0000-000000000008', 'coach', 'coach', 8, 'b1e10000-0000-0000-0000-000000000001', 'b1e20000-0000-0000-0000-000000000001', 'b1e30000-0000-0000-0000-000000000001'),
  ('b1e60000-0000-0000-0000-000000000009', 'b1e00000-0000-0000-0000-000000000009', 'player', 'player', 9, 'b1e10000-0000-0000-0000-000000000001', 'b1e20000-0000-0000-0000-000000000001', 'b1e30000-0000-0000-0000-000000000001');

insert into public.profiles (id, first_name, last_name)
select id, 'B1e', split_part(email, '@', 1)
from auth.users
where email like 'b1e-%@example.invalid'
on conflict (id) do update
set first_name = excluded.first_name,
    last_name = excluded.last_name;

insert into public.user_roles (user_id, role, association_id, club_id, team_id)
values
  ('b1e00000-0000-0000-0000-000000000001', 'SUPER_ADMIN', null, null, null),
  ('b1e00000-0000-0000-0000-000000000002', 'ASSOCIATION_ADMIN', 'b1e10000-0000-0000-0000-000000000001', null, null),
  ('b1e00000-0000-0000-0000-000000000003', 'CLUB_ADMIN', 'b1e10000-0000-0000-0000-000000000001', 'b1e20000-0000-0000-0000-000000000001', null),
  ('b1e00000-0000-0000-0000-000000000004', 'TEAM_MANAGER', 'b1e10000-0000-0000-0000-000000000001', 'b1e20000-0000-0000-0000-000000000001', 'b1e30000-0000-0000-0000-000000000001'),
  ('b1e00000-0000-0000-0000-000000000006', 'CLUB_ADMIN', 'b1e10000-0000-0000-0000-000000000002', 'b1e20000-0000-0000-0000-000000000002', null),
  ('b1e00000-0000-0000-0000-000000000008', 'COACH', 'b1e10000-0000-0000-0000-000000000001', 'b1e20000-0000-0000-0000-000000000001', 'b1e30000-0000-0000-0000-000000000001'),
  ('b1e00000-0000-0000-0000-000000000009', 'PLAYER', null, null, null);

insert into public.team_memberships (id, user_id, team_id, membership_type, status)
values
  ('b1e40000-0000-0000-0000-000000000005', 'b1e00000-0000-0000-0000-000000000005', 'b1e30000-0000-0000-0000-000000000001', 'PRIMARY', 'ACTIVE'),
  ('b1e40000-0000-0000-0000-000000000007', 'b1e00000-0000-0000-0000-000000000007', 'b1e30000-0000-0000-0000-000000000002', 'PRIMARY', 'ACTIVE'),
  ('b1e40000-0000-0000-0000-000000000012', 'b1e00000-0000-0000-0000-000000000012', 'b1e30000-0000-0000-0000-000000000001', 'SECONDARY', 'ACTIVE');

-- Privilege gates: anonymous users cannot call any B1e function, while the
-- two internal information-bearing helpers are also hidden from authenticated.
do $b1e_privileges$
declare
  v_count integer;
begin
  select count(*) into v_count
  from pg_catalog.pg_proc function_row
  join pg_catalog.pg_namespace namespace_row on namespace_row.oid = function_row.pronamespace
  where namespace_row.nspname = 'public'
    and function_row.proname in (
      'admin_cancel_team_invite', 'admin_create_team_invite',
      'admin_manage_team_membership', 'admin_membership_integrity_report',
      'admin_save_user_roles', 'admin_save_user_roles_unchecked',
      'admin_update_profile_details', 'admin_visible_profile_ids',
      'administration_target_profile_in_scope', 'approve_membership_request',
      'admin_update_profile_details_unbound', 'admin_visible_profile_ids_unbound',
      'administration_target_profile_in_scope_unbound', 'approve_membership_request_unbound',
      'guard_team_membership_integrity', 'guard_user_role_duplicate_insert'
    )
    and pg_catalog.has_function_privilege('anon', function_row.oid, 'EXECUTE');
  if v_count <> 0 then raise exception '% B1e functions remain anonymous-callable.', v_count; end if;

  if pg_catalog.has_function_privilege(
      'authenticated', 'public.administration_target_profile_in_scope(uuid,text)', 'EXECUTE'
    ) or pg_catalog.has_function_privilege(
      'authenticated', 'public.admin_membership_integrity_report()', 'EXECUTE'
    ) or pg_catalog.has_function_privilege(
      'authenticated', 'public.admin_save_user_roles_unchecked(uuid,text[],jsonb,jsonb,uuid[],jsonb,text)', 'EXECUTE'
    ) or pg_catalog.has_function_privilege(
      'authenticated', 'public.admin_visible_profile_ids_unbound(text,uuid,uuid,uuid)', 'EXECUTE'
    ) or pg_catalog.has_function_privilege(
      'authenticated', 'public.admin_update_profile_details_unbound(uuid,jsonb,text)', 'EXECUTE'
  ) or pg_catalog.has_function_privilege(
      'authenticated', 'public.approve_membership_request_unbound(uuid,boolean)', 'EXECUTE'
    ) then
    raise exception 'An internal B1e helper remains browser-callable.';
  end if;

  if pg_catalog.has_function_privilege(
      'authenticated',
      'private.assert_account_wide_simple_roles_unchanged(uuid,text[],text)',
      'EXECUTE'
    ) or pg_catalog.has_function_privilege(
      'authenticated',
      'public.admin_save_user_roles_b1_core(uuid,text[],jsonb,jsonb,uuid[],jsonb,text)',
      'EXECUTE'
    ) then
    raise exception 'An account-wide role helper remains browser-callable.';
  end if;

  if to_regprocedure(
      'public.admin_save_user_access_b1_core(uuid,text[],jsonb,jsonb,uuid[],jsonb,uuid[],jsonb,text)'
    ) is not null and pg_catalog.has_function_privilege(
      'authenticated',
      'public.admin_save_user_access_b1_core(uuid,text[],jsonb,jsonb,uuid[],jsonb,uuid[],jsonb,text)',
      'EXECUTE'
    ) then
    raise exception 'The Dev access core remains browser-callable.';
  end if;
end;
$b1e_privileges$;

-- Super Admin sees all fixture profiles and the hardened legacy six-argument
-- role function remains compatible with the current Production browser.
set local role authenticated;
select set_config('request.jwt.claim.sub', 'b1e00000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"b1e00000-0000-0000-0000-000000000001","role":"authenticated","session_id":"b1e60000-0000-0000-0000-000000000001"}', true);
do $b1e_super$
begin
  if not exists (
    select 1 from public.admin_visible_profile_ids('super_admin', null, null, null)
    where profile_id = 'b1e00000-0000-0000-0000-000000000007'
  ) then raise exception 'Super Admin could not see all profiles.'; end if;

  perform public.admin_save_user_roles(
    'b1e00000-0000-0000-0000-000000000013',
    array['PLAYER','VOTER'], null, null, null, null
  );
end;
$b1e_super$;
reset role;

-- Association Admin can see and administer the first association, but not a
-- profile belonging only to the second association.
set local role authenticated;
select set_config('request.jwt.claim.sub', 'b1e00000-0000-0000-0000-000000000002', true);
select set_config('request.jwt.claims', '{"sub":"b1e00000-0000-0000-0000-000000000002","role":"authenticated","session_id":"b1e60000-0000-0000-0000-000000000002"}', true);
do $b1e_association$
declare
  v_existing_simple_roles text[];
  v_changed_simple_roles text[];
begin
  if not exists (
    select 1 from public.admin_visible_profile_ids(
      'association', 'b1e10000-0000-0000-0000-000000000001', null, null
    ) where profile_id = 'b1e00000-0000-0000-0000-000000000005'
  ) or exists (
    select 1 from public.admin_visible_profile_ids('association', null, null, null)
    where profile_id = 'b1e00000-0000-0000-0000-000000000007'
  ) then raise exception 'Association visibility scope is incorrect.'; end if;

  select coalesce(array_agg(role::text order by role::text), '{}'::text[])
  into v_existing_simple_roles
  from public.user_roles
  where user_id = 'b1e00000-0000-0000-0000-000000000005'
    and role::text in ('PLAYER', 'VOTER')
    and association_id is null
    and club_id is null
    and team_id is null;

  v_changed_simple_roles := case
    when 'VOTER' = any(v_existing_simple_roles)
      then array_remove(v_existing_simple_roles, 'VOTER')
    else array_append(v_existing_simple_roles, 'VOTER')
  end;

  begin
    perform public.admin_save_user_roles(
      'b1e00000-0000-0000-0000-000000000005',
      array_append(v_changed_simple_roles, 'COACH'),
      '[{"association_id":"b1e10000-0000-0000-0000-000000000001","club_id":"b1e20000-0000-0000-0000-000000000001","team_id":"b1e30000-0000-0000-0000-000000000001"}]'::jsonb,
      null, null, null, 'association'
    );
    raise exception 'Association Admin unexpectedly changed an account-wide simple role.';
  exception when insufficient_privilege then
    if sqlerrm <> 'Only a Super Admin can change account-wide Player or Voter roles.' then raise; end if;
  end;

  perform public.admin_save_user_roles(
    'b1e00000-0000-0000-0000-000000000005',
    array_append(v_existing_simple_roles, 'COACH'),
    '[{"association_id":"b1e10000-0000-0000-0000-000000000001","club_id":"b1e20000-0000-0000-0000-000000000001","team_id":"b1e30000-0000-0000-0000-000000000001"}]'::jsonb,
    null, null, null, 'association'
  );

  -- Dev has a broader Coordination-aware save function. When present, its
  -- browser wrapper must enforce the same account-wide boundary while still
  -- accepting an unchanged simple-role set.
  if to_regprocedure(
    'public.admin_save_user_access(uuid,text[],jsonb,jsonb,uuid[],jsonb,uuid[],jsonb,text)'
  ) is not null then
    begin
      execute $sql$
        select public.admin_save_user_access(
          $1, $2, $3, null, null, null, null, '[]'::jsonb, $4
        )
      $sql$
      using
        'b1e00000-0000-0000-0000-000000000005'::uuid,
        array_append(v_changed_simple_roles, 'COACH'),
        '[{"association_id":"b1e10000-0000-0000-0000-000000000001","club_id":"b1e20000-0000-0000-0000-000000000001","team_id":"b1e30000-0000-0000-0000-000000000001"}]'::jsonb,
        'association';
      raise exception 'Association Admin unexpectedly bypassed the Dev access wrapper.';
    exception when insufficient_privilege then
      if sqlerrm <> 'Only a Super Admin can change account-wide Player or Voter roles.' then raise; end if;
    end;

    execute $sql$
      select public.admin_save_user_access(
        $1, $2, $3, null, null, null, null, '[]'::jsonb, $4
      )
    $sql$
    using
      'b1e00000-0000-0000-0000-000000000005'::uuid,
      array_append(v_existing_simple_roles, 'COACH'),
      '[{"association_id":"b1e10000-0000-0000-0000-000000000001","club_id":"b1e20000-0000-0000-0000-000000000001","team_id":"b1e30000-0000-0000-0000-000000000001"}]'::jsonb,
      'association';
  end if;
end;
$b1e_association$;
reset role;

-- Club Admin can update an in-scope profile, while the unrelated Club Admin
-- is denied without receiving target details.
set local role authenticated;
select set_config('request.jwt.claim.sub', 'b1e00000-0000-0000-0000-000000000003', true);
select set_config('request.jwt.claims', '{"sub":"b1e00000-0000-0000-0000-000000000003","role":"authenticated","session_id":"b1e60000-0000-0000-0000-000000000003"}', true);
select public.admin_update_profile_details(
  'b1e00000-0000-0000-0000-000000000005',
  '{"first_name":"B1e updated"}'::jsonb,
  'club'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'b1e00000-0000-0000-0000-000000000006', true);
select set_config('request.jwt.claims', '{"sub":"b1e00000-0000-0000-0000-000000000006","role":"authenticated","session_id":"b1e60000-0000-0000-0000-000000000006"}', true);
do $b1e_unrelated$
begin
  begin
    perform public.admin_update_profile_details(
      'b1e00000-0000-0000-0000-000000000005', '{"first_name":"leak"}'::jsonb, 'club'
    );
    raise exception 'Unrelated Club Admin unexpectedly updated the profile.';
  exception when insufficient_privilege or raise_exception then
    if sqlerrm = 'Unrelated Club Admin unexpectedly updated the profile.' then raise; end if;
  end;
end;
$b1e_unrelated$;
reset role;

-- Team Manager can manage membership in their team, but cannot change roles.
set local role authenticated;
select set_config('request.jwt.claim.sub', 'b1e00000-0000-0000-0000-000000000004', true);
select set_config('request.jwt.claims', '{"sub":"b1e00000-0000-0000-0000-000000000004","role":"authenticated","session_id":"b1e60000-0000-0000-0000-000000000004"}', true);
select public.admin_manage_team_membership(
  'b1e40000-0000-0000-0000-000000000012', 'CHANGE_TYPE', 'FILL_IN', 'team_manager'
);
do $b1e_manager_role_denial$
begin
  begin
    perform public.admin_save_user_roles(
      'b1e00000-0000-0000-0000-000000000012', array['PLAYER'],
      null, null, null, null, 'team_manager'
    );
    raise exception 'Team Manager unexpectedly changed roles.';
  exception when insufficient_privilege or raise_exception then
    if sqlerrm = 'Team Manager unexpectedly changed roles.' then raise; end if;
  end;
end;
$b1e_manager_role_denial$;
reset role;

-- Coach and Player modes intentionally return no administration identities.
set local role authenticated;
select set_config('request.jwt.claim.sub', 'b1e00000-0000-0000-0000-000000000008', true);
select set_config('request.jwt.claims', '{"sub":"b1e00000-0000-0000-0000-000000000008","role":"authenticated","session_id":"b1e60000-0000-0000-0000-000000000008"}', true);
do $b1e_coach$
begin
  if exists (select 1 from public.admin_visible_profile_ids('coach', null, null, null)) then
    raise exception 'Coach unexpectedly received administration identities.';
  end if;
end;
$b1e_coach$;
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'b1e00000-0000-0000-0000-000000000009', true);
select set_config('request.jwt.claims', '{"sub":"b1e00000-0000-0000-0000-000000000009","role":"authenticated","session_id":"b1e60000-0000-0000-0000-000000000009"}', true);
do $b1e_player$
begin
  if exists (select 1 from public.admin_visible_profile_ids('player', null, null, null)) then
    raise exception 'Player unexpectedly received administration identities.';
  end if;
end;
$b1e_player$;
reset role;

-- Team request approval follows the actual Team Manager role and scope.
insert into public.requests (
  id, request_type, requester_id, target_user_id, team_id, association_id,
  club_id, membership_type, status
) values (
  'b1e50000-0000-0000-0000-000000000010', 'PLAYER_REQUEST',
  'b1e00000-0000-0000-0000-000000000010',
  'b1e00000-0000-0000-0000-000000000010',
  'b1e30000-0000-0000-0000-000000000001',
  'b1e10000-0000-0000-0000-000000000001',
  'b1e20000-0000-0000-0000-000000000001', 'SECONDARY', 'PENDING'
);

-- A dormant Super Admin role must not bypass the mode that is active for the
-- current Auth session. All attempted reads and mutations remain rollback-only.
update private.auth_session_permission_modes
set active_mode = 'player', revision = revision + 1
where session_id = 'b1e60000-0000-0000-0000-000000000001';

set local role authenticated;
select set_config('request.jwt.claim.sub', 'b1e00000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"b1e00000-0000-0000-0000-000000000001","role":"authenticated","session_id":"b1e60000-0000-0000-0000-000000000001"}', true);
do $b1e_dormant_super_denials$
begin
  if exists (
    select 1 from public.admin_visible_profile_ids('super_admin', null, null, null)
  ) then
    raise exception 'Dormant Super Admin mode unexpectedly listed profiles.';
  end if;

  begin
    perform public.admin_update_profile_details(
      'b1e00000-0000-0000-0000-000000000005',
      '{"first_name":"mode bypass"}'::jsonb,
      'super_admin'
    );
    raise exception 'Dormant Super Admin mode unexpectedly updated a profile.';
  exception when insufficient_privilege then null;
  end;

  begin
    perform public.admin_save_user_roles(
      'b1e00000-0000-0000-0000-000000000013',
      array['PLAYER','VOTER'], null, null, null, null
    );
    raise exception 'Dormant Super Admin mode unexpectedly changed roles.';
  exception when insufficient_privilege or raise_exception then
    if sqlerrm = 'Dormant Super Admin mode unexpectedly changed roles.' then raise; end if;
  end;

  begin
    perform public.approve_membership_request(
      'b1e50000-0000-0000-0000-000000000010', true
    );
    raise exception 'Dormant Super Admin mode unexpectedly approved a request.';
  exception when insufficient_privilege then null;
  end;
end;
$b1e_dormant_super_denials$;
reset role;

update private.auth_session_permission_modes
set active_mode = 'super_admin', revision = revision + 1
where session_id = 'b1e60000-0000-0000-0000-000000000001';

set local role authenticated;
select set_config('request.jwt.claim.sub', 'b1e00000-0000-0000-0000-000000000004', true);
select set_config('request.jwt.claims', '{"sub":"b1e00000-0000-0000-0000-000000000004","role":"authenticated","session_id":"b1e60000-0000-0000-0000-000000000004"}', true);
select public.approve_membership_request('b1e50000-0000-0000-0000-000000000010', true);
reset role;

-- Association invite creation/cancellation exercises both request functions.
set local role authenticated;
select set_config('request.jwt.claim.sub', 'b1e00000-0000-0000-0000-000000000002', true);
select set_config('request.jwt.claims', '{"sub":"b1e00000-0000-0000-0000-000000000002","role":"authenticated","session_id":"b1e60000-0000-0000-0000-000000000002"}', true);
select public.admin_create_team_invite(
  'b1e00000-0000-0000-0000-000000000011',
  'b1e30000-0000-0000-0000-000000000001', 'FILL_IN', 'association'
);
select public.admin_cancel_team_invite(
  (
    select id from public.requests
    where target_user_id = 'b1e00000-0000-0000-0000-000000000011'
      and request_type::text = 'TEAM_INVITE'
    order by created_at desc limit 1
  ),
  'association'
);
reset role;

-- Confirm the allowed mutations and integrity guards behaved as expected.
do $b1e_results$
begin
  if not exists (
    select 1 from public.user_roles
    where user_id = 'b1e00000-0000-0000-0000-000000000013'
      and role::text = 'VOTER'
  ) then raise exception 'Legacy role wrapper did not save the Voter role.'; end if;

  if not exists (
    select 1 from public.user_roles
    where user_id = 'b1e00000-0000-0000-0000-000000000005'
      and role::text = 'COACH'
      and team_id = 'b1e30000-0000-0000-0000-000000000001'
  ) then raise exception 'Association role save did not persist the scoped Coach role.'; end if;

  if not exists (
    select 1 from public.team_memberships
    where id = 'b1e40000-0000-0000-0000-000000000012'
      and membership_type::text = 'FILL_IN'
  ) then raise exception 'Team Manager membership change did not persist.'; end if;

  if not exists (
    select 1 from public.requests
    where id = 'b1e50000-0000-0000-0000-000000000010'
      and status::text = 'APPROVED'
  ) then raise exception 'Membership request was not approved.'; end if;

  if not exists (
    select 1 from public.requests
    where target_user_id = 'b1e00000-0000-0000-0000-000000000011'
      and request_type::text = 'TEAM_INVITE'
      and status::text = 'CANCELLED'
  ) then raise exception 'Team invite was not cancelled.'; end if;
end;
$b1e_results$;

select 'B1_ADMIN_MEMBERSHIP_RUNTIME_OK' as result;
rollback;
