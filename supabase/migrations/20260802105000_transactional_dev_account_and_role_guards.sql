-- Transactional database reset for disposable Dev test accounts, plus a
-- null-safe guard that blocks new duplicate role scopes without touching
-- historical rows.

create or replace function public.guard_user_role_duplicate_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('user-role:' || new.user_id::text, 0)
  );

  if exists (
    select 1
    from public.user_roles role_row
    where role_row.user_id = new.user_id
      and role_row.role is not distinct from new.role
      and role_row.association_id is not distinct from new.association_id
      and role_row.club_id is not distinct from new.club_id
      and role_row.team_id is not distinct from new.team_id
  ) then
    raise exception using
      errcode = '23505',
      message = 'This user already has that role in the same scope.';
  end if;

  return new;
end;
$function$;

revoke all on function public.guard_user_role_duplicate_insert() from public, anon, authenticated;

drop trigger if exists user_role_duplicate_insert_guard on public.user_roles;
create trigger user_role_duplicate_insert_guard
before insert on public.user_roles
for each row execute function public.guard_user_role_duplicate_insert();

create or replace function public.provision_dev_test_account_data(
  p_actor_id uuid,
  p_user_id uuid,
  p_email text,
  p_role text,
  p_association_id uuid,
  p_club_id uuid,
  p_team_id uuid,
  p_created boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_role text := upper(trim(coalesce(p_role, '')));
  v_expected_email text;
  v_last_name text;
  v_association_id uuid;
  v_club_id uuid;
  v_team_id uuid;
  v_membership_id uuid;
  v_old_roles jsonb;
  v_old_memberships jsonb;
  v_new_roles jsonb;
  v_new_memberships jsonb;
begin
  if not exists (
    select 1
    from public.user_roles actor_role
    where actor_role.user_id = p_actor_id
      and actor_role.role::text = 'SUPER_ADMIN'
  ) then
    raise exception using
      errcode = '42501',
      message = 'Only an actual Super Admin can provision Dev test accounts.';
  end if;

  v_expected_email := case v_role
    when 'ASSOCIATION_ADMIN' then 'codex.association-admin.dev@sportstackapp.com.au'
    when 'CLUB_ADMIN' then 'codex.club-admin.dev@sportstackapp.com.au'
    when 'TEAM_MANAGER' then 'codex.team-manager.dev@sportstackapp.com.au'
    when 'COACH' then 'codex.coach.dev@sportstackapp.com.au'
    when 'PLAYER' then 'codex.player.dev@sportstackapp.com.au'
    when 'UMPIRE' then 'codex.umpire.dev@sportstackapp.com.au'
    when 'VOTER' then 'codex.voter.dev@sportstackapp.com.au'
    else null
  end;

  if v_expected_email is null or v_email <> v_expected_email then
    raise exception using
      errcode = '22023',
      message = 'The reserved Dev test email does not match the selected role.';
  end if;

  if not exists (
    select 1
    from auth.users auth_user
    where auth_user.id = p_user_id
      and lower(auth_user.email) = v_email
      and coalesce(auth_user.raw_app_meta_data, '{}'::jsonb)
        @> '{"sportstack_dev_test": true}'::jsonb
  ) then
    raise exception using
      errcode = '22023',
      message = 'The Auth user is not the matching disposable Dev test account.';
  end if;

  if v_role = 'ASSOCIATION_ADMIN' then
    if p_association_id is null or p_club_id is not null or p_team_id is not null
      or not exists (
        select 1 from public.associations association
        where association.id = p_association_id
      ) then
      raise exception 'Association Admin requires one valid association scope.';
    end if;
    v_association_id := p_association_id;
  elsif v_role = 'CLUB_ADMIN' then
    if p_association_id is null or p_club_id is null or p_team_id is not null
      or not exists (
        select 1
        from public.clubs club
        where club.id = p_club_id
          and club.association_id = p_association_id
      ) then
      raise exception 'Club Admin requires a club inside the selected association.';
    end if;
    v_association_id := p_association_id;
    v_club_id := p_club_id;
  elsif v_role in ('TEAM_MANAGER', 'COACH', 'PLAYER') then
    if p_association_id is null or p_club_id is null or p_team_id is null
      or not exists (
        select 1
        from public.teams team
        join public.clubs club on club.id = team.club_id
        where team.id = p_team_id
          and team.club_id = p_club_id
          and club.association_id = p_association_id
      ) then
      raise exception 'This role requires a team inside the selected club and association.';
    end if;
    v_association_id := p_association_id;
    v_club_id := p_club_id;
    v_team_id := p_team_id;
  elsif p_association_id is not null or p_club_id is not null or p_team_id is not null then
    raise exception 'This role must not include an organisation scope.';
  end if;

  v_last_name := case v_role
    when 'ASSOCIATION_ADMIN' then 'Association Admin Test'
    when 'CLUB_ADMIN' then 'Club Admin Test'
    when 'TEAM_MANAGER' then 'Team Manager Test'
    when 'COACH' then 'Coach Test'
    when 'PLAYER' then 'Player Test'
    when 'UMPIRE' then 'Umpire Test'
    when 'VOTER' then 'Voter Test'
  end;

  select coalesce(
    jsonb_agg(to_jsonb(role_row) order by role_row.created_at, role_row.id),
    '[]'::jsonb
  )
  into v_old_roles
  from public.user_roles role_row
  where role_row.user_id = p_user_id;

  select coalesce(
    jsonb_agg(to_jsonb(membership) order by membership.created_at, membership.id),
    '[]'::jsonb
  )
  into v_old_memberships
  from public.team_memberships membership
  where membership.user_id = p_user_id;

  insert into public.profiles (
    id,
    first_name,
    last_name,
    phone,
    date_of_birth,
    gender,
    is_placeholder,
    is_umpire,
    updated_at
  ) values (
    p_user_id,
    'Codex',
    v_last_name,
    '0400 000 000',
    '2000-01-01',
    'Other',
    false,
    v_role = 'UMPIRE',
    now()
  )
  on conflict (id) do update set
    first_name = excluded.first_name,
    last_name = excluded.last_name,
    phone = excluded.phone,
    date_of_birth = excluded.date_of_birth,
    gender = excluded.gender,
    is_placeholder = excluded.is_placeholder,
    is_umpire = excluded.is_umpire,
    updated_at = excluded.updated_at;

  delete from public.user_roles role_row
  where role_row.user_id = p_user_id;

  update public.team_memberships membership
  set status = 'INACTIVE'::public.membership_status_enum
  where membership.user_id = p_user_id
    and membership.status <> 'INACTIVE'::public.membership_status_enum;

  insert into public.user_roles (
    user_id,
    role,
    association_id,
    club_id,
    team_id
  ) values (
    p_user_id,
    v_role::public.user_role_enum,
    v_association_id,
    v_club_id,
    v_team_id
  );

  if v_role = 'PLAYER' then
    select membership.id
    into v_membership_id
    from public.team_memberships membership
    where membership.user_id = p_user_id
      and membership.team_id = v_team_id
    order by membership.created_at, membership.id
    limit 1;

    if v_membership_id is null then
      insert into public.team_memberships (
        user_id,
        team_id,
        membership_type,
        status
      ) values (
        p_user_id,
        v_team_id,
        'PRIMARY'::public.membership_type_enum,
        'ACTIVE'::public.membership_status_enum
      );
    else
      update public.team_memberships membership
      set membership_type = 'PRIMARY'::public.membership_type_enum,
          status = 'ACTIVE'::public.membership_status_enum
      where membership.id = v_membership_id;
    end if;
  end if;

  select coalesce(
    jsonb_agg(to_jsonb(role_row) order by role_row.created_at, role_row.id),
    '[]'::jsonb
  )
  into v_new_roles
  from public.user_roles role_row
  where role_row.user_id = p_user_id;

  select coalesce(
    jsonb_agg(to_jsonb(membership) order by membership.created_at, membership.id),
    '[]'::jsonb
  )
  into v_new_memberships
  from public.team_memberships membership
  where membership.user_id = p_user_id;

  insert into public.administration_audit_log (
    actor_id,
    actor_mode,
    action,
    record_type,
    record_id,
    target_user_id,
    association_id,
    club_id,
    team_id,
    old_data,
    new_data
  ) values (
    p_actor_id,
    'SUPER_ADMIN',
    case when coalesce(p_created, false)
      then 'DEV_TEST_ACCOUNT_CREATED'
      else 'DEV_TEST_ACCOUNT_RESET'
    end,
    'DEV_TEST_ACCOUNT',
    p_user_id,
    p_user_id,
    v_association_id,
    v_club_id,
    v_team_id,
    jsonb_build_object(
      'roles', v_old_roles,
      'memberships', v_old_memberships
    ),
    jsonb_build_object(
      'email', v_email,
      'role', v_role,
      'sportstack_dev_test', true,
      'roles', v_new_roles,
      'memberships', v_new_memberships
    )
  );

  return jsonb_build_object(
    'success', true,
    'created', coalesce(p_created, false),
    'user_id', p_user_id,
    'email', v_email,
    'role', v_role
  );
end;
$function$;

revoke all on function public.provision_dev_test_account_data(
  uuid, uuid, text, text, uuid, uuid, uuid, boolean
) from public, anon, authenticated;
grant execute on function public.provision_dev_test_account_data(
  uuid, uuid, text, text, uuid, uuid, uuid, boolean
) to service_role;

comment on function public.provision_dev_test_account_data(
  uuid, uuid, text, text, uuid, uuid, uuid, boolean
) is 'Atomically resets the database data for one reserved disposable SportStack Dev test account. Service role only.';
