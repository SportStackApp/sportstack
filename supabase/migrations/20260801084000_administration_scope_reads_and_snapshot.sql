-- Scoped administration reads plus a non-destructive snapshot of the
-- historical membership-integrity issues identified during owner testing.

create table if not exists public.administration_integrity_snapshot_batches (
  id uuid primary key default gen_random_uuid(),
  captured_at timestamptz not null default now(),
  captured_by uuid references auth.users(id),
  duplicate_user_team_groups integer not null default 0,
  multiple_primary_users integer not null default 0,
  notes text not null
);

create table if not exists public.administration_membership_integrity_snapshot (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.administration_integrity_snapshot_batches(id) on delete restrict,
  issue_type text not null,
  membership_id uuid not null,
  user_id uuid not null,
  team_id uuid not null,
  membership_type text not null,
  status text not null,
  jersey_number integer,
  position text,
  invited_by uuid,
  created_at timestamptz,
  updated_at timestamptz,
  captured_at timestamptz not null default now(),
  unique (batch_id, issue_type, membership_id)
);

create index if not exists administration_membership_snapshot_user_idx
  on public.administration_membership_integrity_snapshot (batch_id, user_id, issue_type);

alter table public.administration_integrity_snapshot_batches enable row level security;
alter table public.administration_membership_integrity_snapshot enable row level security;
revoke all on public.administration_integrity_snapshot_batches from public, anon, authenticated;
revoke all on public.administration_membership_integrity_snapshot from public, anon, authenticated;
grant select on public.administration_integrity_snapshot_batches to authenticated;
grant select on public.administration_membership_integrity_snapshot to authenticated;

drop policy if exists administration_integrity_batches_super_read on public.administration_integrity_snapshot_batches;
create policy administration_integrity_batches_super_read
on public.administration_integrity_snapshot_batches for select to authenticated
using (public.is_super_admin());

drop policy if exists administration_integrity_snapshot_super_read on public.administration_membership_integrity_snapshot;
create policy administration_integrity_snapshot_super_read
on public.administration_membership_integrity_snapshot for select to authenticated
using (public.is_super_admin());

do $$
declare
  v_batch_id uuid;
  v_duplicate_groups integer;
  v_primary_users integer;
begin
  select
    count(*) filter (where report.issue_type = 'DUPLICATE_USER_TEAM'),
    count(*) filter (where report.issue_type = 'MULTIPLE_ACTIVE_PRIMARY')
  into v_duplicate_groups, v_primary_users
  from public.admin_membership_integrity_report() report;

  insert into public.administration_integrity_snapshot_batches (
    captured_by,
    duplicate_user_team_groups,
    multiple_primary_users,
    notes
  ) values (
    null,
    v_duplicate_groups,
    v_primary_users,
    'Pre-cleanup backup created by the SportStack Owner-Test remediation plan. No membership rows were changed.'
  ) returning id into v_batch_id;

  insert into public.administration_membership_integrity_snapshot (
    batch_id,
    issue_type,
    membership_id,
    user_id,
    team_id,
    membership_type,
    status,
    jersey_number,
    position,
    invited_by,
    created_at,
    updated_at
  )
  select
    v_batch_id,
    report.issue_type,
    membership.id,
    membership.user_id,
    membership.team_id,
    membership.membership_type::text,
    membership.status::text,
    membership.jersey_number,
    membership.position,
    membership.invited_by,
    membership.created_at,
    membership.updated_at
  from public.admin_membership_integrity_report() report
  cross join lateral unnest(report.membership_ids) membership_id
  join public.team_memberships membership on membership.id = membership_id;
end;
$$;

create or replace function public.admin_visible_profile_ids(
  p_actor_mode text default null,
  p_association_id uuid default null,
  p_club_id uuid default null,
  p_team_id uuid default null
)
returns table (profile_id uuid)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_mode text := public.administration_effective_mode(p_actor_mode);
begin
  if v_mode = 'coach' or v_mode = 'player' then
    return;
  end if;

  if v_mode = 'super_admin' then
    return query select profile.id from public.profiles profile;
    return;
  end if;

  return query
  select distinct membership.user_id
  from public.team_memberships membership
  join public.teams team on team.id = membership.team_id
  join public.clubs club on club.id = team.club_id
  where membership.status::text in ('ACTIVE','PENDING','INVITED')
    and (p_association_id is null or club.association_id = p_association_id)
    and (p_club_id is null or club.id = p_club_id)
    and (p_team_id is null or team.id = p_team_id)
    and public.administration_scope_allows(v_mode, club.association_id, club.id, team.id);

  if v_mode in ('association','club') then
    return query select v_actor;
  end if;
end;
$$;

revoke all on function public.admin_visible_profile_ids(text, uuid, uuid, uuid) from public;
grant execute on function public.admin_visible_profile_ids(text, uuid, uuid, uuid) to authenticated;

create or replace function public.admin_update_profile_details(
  p_user_id uuid,
  p_details jsonb,
  p_actor_mode text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_mode text := public.administration_effective_mode(p_actor_mode);
  v_old public.profiles%rowtype;
  v_new public.profiles%rowtype;
  v_target_team_id uuid;
  v_target_club_id uuid;
  v_target_association_id uuid;
begin
  select profile.* into v_old from public.profiles profile where profile.id = p_user_id for update;
  if not found then raise exception 'The selected user was not found.'; end if;

  if v_mode = 'super_admin' then
    null;
  else
    select team.id, club.id, club.association_id
    into v_target_team_id, v_target_club_id, v_target_association_id
    from public.team_memberships membership
    join public.teams team on team.id = membership.team_id
    join public.clubs club on club.id = team.club_id
    where membership.user_id = p_user_id
      and membership.status::text in ('ACTIVE','PENDING','INVITED')
      and public.administration_scope_allows(v_mode, club.association_id, club.id, team.id)
    order by (membership.status::text = 'ACTIVE') desc, membership.created_at
    limit 1;
    if not found then raise exception 'This user is outside your active administration scope.'; end if;

    if (v_mode = 'association' and exists (
      select 1 from public.user_roles r where r.user_id = p_user_id and r.role::text in ('SUPER_ADMIN','ASSOCIATION_ADMIN')
    )) or (v_mode = 'club' and exists (
      select 1 from public.user_roles r where r.user_id = p_user_id and r.role::text in ('SUPER_ADMIN','ASSOCIATION_ADMIN','CLUB_ADMIN')
    )) or v_mode = 'team_manager' then
      raise exception 'You cannot edit this account from the selected mode.';
    end if;
  end if;

  update public.profiles profile
  set
    first_name = case when p_details ? 'first_name' then nullif(trim(p_details->>'first_name'),'') else profile.first_name end,
    last_name = case when p_details ? 'last_name' then nullif(trim(p_details->>'last_name'),'') else profile.last_name end,
    phone = case when p_details ? 'phone' then nullif(trim(p_details->>'phone'),'') else profile.phone end,
    street_address = case when p_details ? 'street_address' then nullif(trim(p_details->>'street_address'),'') else profile.street_address end,
    suburb = case when p_details ? 'suburb' then nullif(trim(p_details->>'suburb'),'') else profile.suburb end,
    date_of_birth = case when p_details ? 'date_of_birth' and nullif(trim(p_details->>'date_of_birth'),'') is not null
      then (p_details->>'date_of_birth')::date
      when p_details ? 'date_of_birth' then null else profile.date_of_birth end,
    gender = case when p_details ? 'gender' then nullif(trim(p_details->>'gender'),'') else profile.gender end,
    emergency_contact_name = case when p_details ? 'emergency_contact_name' then nullif(trim(p_details->>'emergency_contact_name'),'') else profile.emergency_contact_name end,
    emergency_contact_phone = case when p_details ? 'emergency_contact_phone' then nullif(trim(p_details->>'emergency_contact_phone'),'') else profile.emergency_contact_phone end,
    updated_at = now()
  where profile.id = p_user_id
  returning profile.* into v_new;

  insert into public.administration_audit_log (
    actor_id, actor_mode, action, record_type, record_id, target_user_id,
    association_id, club_id, team_id, old_data, new_data
  ) values (
    v_actor, v_mode, 'PROFILE_DETAILS_UPDATED', 'profile', p_user_id, p_user_id,
    v_target_association_id, v_target_club_id, v_target_team_id,
    to_jsonb(v_old) - 'avatar_url', to_jsonb(v_new) - 'avatar_url'
  );

  return to_jsonb(v_new);
end;
$$;

revoke all on function public.admin_update_profile_details(uuid, jsonb, text) from public;
grant execute on function public.admin_update_profile_details(uuid, jsonb, text) to authenticated;
