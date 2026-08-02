-- Reusable permission groups, named permission sets and direct user/role/group
-- overrides. Organisation module flags remain the baseline; the closest
-- subject-specific rule can make a narrower exception.

create table public.permission_catalogue (
  permission_key text primary key,
  module_key text not null,
  label text not null,
  description text not null,
  category text not null default 'MODULE',
  default_allowed boolean not null default false,
  created_at timestamptz not null default now(),
  constraint permission_catalogue_category_check check (category in ('MODULE', 'ACTION'))
);

insert into public.permission_catalogue
  (permission_key, module_key, label, description, category, default_allowed)
values
  ('module.player_mvp.access', 'player_mvp', 'Access Player MVP Voting', 'Open Player MVP Voting routes and navigation.', 'MODULE', true),
  ('module.umpire_match_voting.access', 'umpire_match_voting', 'Access Umpire Match Voting', 'Open Umpire Match Voting routes and navigation.', 'MODULE', true),
  ('module.committee.access', 'committee', 'Access Committee Management', 'Open committee work and administration where committee membership also permits it.', 'MODULE', true),
  ('module.safety_risk.access', 'safety_risk', 'Access Safety Hub', 'Open Risk and Quality Improvement workflows inside the selected scope.', 'MODULE', true),
  ('module.hockey_trace.access', 'hockey_trace', 'Access Hockey Trace Lab', 'Open the experimental Hockey Trace tools.', 'MODULE', false),
  ('player_mvp.submit', 'player_mvp', 'Submit Player MVP ballot', 'Submit an eligible Player MVP ballot.', 'ACTION', true),
  ('player_mvp.view_results', 'player_mvp', 'View Player MVP results', 'View Player MVP result and leaderboard information permitted by scope.', 'ACTION', false),
  ('umpire_match_voting.submit', 'umpire_match_voting', 'Submit Umpire Match ballot', 'Submit an authorised Umpire Match ballot.', 'ACTION', true),
  ('umpire_match_voting.manage', 'umpire_match_voting', 'Manage Umpire Match voting', 'Review, correct and approve Umpire Match voting submissions.', 'ACTION', false),
  ('committee.chat.post', 'committee', 'Post committee chat', 'Post to private committee chat when committee position access also permits it.', 'ACTION', false),
  ('committee.poll.vote', 'committee', 'Vote in committee polls', 'Respond to committee polls when committee position access also permits it.', 'ACTION', false),
  ('safety_risk.manage', 'safety_risk', 'Manage Safety Hub records', 'Create and update in-scope Risk and Quality Improvement records.', 'ACTION', false)
on conflict (permission_key) do update set
  module_key = excluded.module_key,
  label = excluded.label,
  description = excluded.description,
  category = excluded.category;

create table public.permission_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  scope_type text not null,
  scope_id uuid not null,
  active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint permission_groups_scope_check check (scope_type in ('ASSOCIATION', 'CLUB', 'DIVISION', 'TEAM')),
  constraint permission_groups_name_check check (length(btrim(name)) between 2 and 80)
);
create unique index permission_groups_active_name_key
  on public.permission_groups (scope_type, scope_id, lower(name)) where active;

create table public.permission_group_members (
  group_id uuid not null references public.permission_groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  added_by uuid references public.profiles(id) on delete set null,
  added_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
create index permission_group_members_user_idx
  on public.permission_group_members (user_id, group_id);

create table public.permission_sets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  owner_scope_type text not null,
  owner_scope_id uuid not null,
  active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint permission_sets_scope_check check (owner_scope_type in ('ASSOCIATION', 'CLUB', 'DIVISION', 'TEAM')),
  constraint permission_sets_name_check check (length(btrim(name)) between 2 and 80)
);
create unique index permission_sets_active_name_key
  on public.permission_sets (owner_scope_type, owner_scope_id, lower(name)) where active;

create table public.permission_set_permissions (
  permission_set_id uuid not null references public.permission_sets(id) on delete cascade,
  permission_key text not null references public.permission_catalogue(permission_key) on delete restrict,
  allowed boolean not null,
  primary key (permission_set_id, permission_key)
);

create table public.permission_assignments (
  id uuid primary key default gen_random_uuid(),
  permission_set_id uuid not null references public.permission_sets(id) on delete cascade,
  subject_type text not null,
  subject_key text not null,
  scope_type text not null,
  scope_id uuid not null,
  active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint permission_assignments_subject_check check (subject_type in ('ROLE', 'GROUP', 'USER')),
  constraint permission_assignments_scope_check check (scope_type in ('ASSOCIATION', 'CLUB', 'DIVISION', 'TEAM'))
);
create unique index permission_assignments_active_key
  on public.permission_assignments (permission_set_id, subject_type, subject_key, scope_type, scope_id)
  where active;

create table public.permission_overrides (
  id uuid primary key default gen_random_uuid(),
  permission_key text not null references public.permission_catalogue(permission_key) on delete restrict,
  subject_type text not null,
  subject_key text not null,
  scope_type text not null,
  scope_id uuid not null,
  allowed boolean not null,
  reason text,
  active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint permission_overrides_subject_check check (subject_type in ('ROLE', 'GROUP', 'USER')),
  constraint permission_overrides_scope_check check (scope_type in ('ASSOCIATION', 'CLUB', 'DIVISION', 'TEAM'))
);
create unique index permission_overrides_active_key
  on public.permission_overrides (permission_key, subject_type, subject_key, scope_type, scope_id)
  where active;

create or replace function public.permission_scope_details(
  p_scope_type text,
  p_scope_id uuid
)
returns table (association_id uuid, club_id uuid, division_id uuid, team_id uuid)
language plpgsql
stable
security definer
set search_path = ''
as $function$
begin
  if p_scope_type = 'ASSOCIATION' then
    return query select association.id, null::uuid, null::uuid, null::uuid
    from public.associations association where association.id = p_scope_id;
  elsif p_scope_type = 'CLUB' then
    return query select club.association_id, club.id, null::uuid, null::uuid
    from public.clubs club where club.id = p_scope_id;
  elsif p_scope_type = 'DIVISION' then
    return query select division.association_id, null::uuid, division.id, null::uuid
    from public.divisions division where division.id = p_scope_id;
  elsif p_scope_type = 'TEAM' then
    return query
    select club.association_id, team.club_id, team.division_id, team.id
    from public.teams team
    join public.clubs club on club.id = team.club_id
    where team.id = p_scope_id;
  end if;
end;
$function$;

create or replace function public.permission_user_in_scope(
  p_user_id uuid,
  p_scope_type text,
  p_scope_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  with scope as (
    select * from public.permission_scope_details(p_scope_type, p_scope_id)
  )
  select exists (
    select 1
    from scope
    where exists (
      select 1
      from public.team_memberships membership
      join public.teams team on team.id = membership.team_id
      join public.clubs club on club.id = team.club_id
      where membership.user_id = p_user_id
        and membership.status::text in ('ACTIVE', 'PENDING', 'INVITED')
        and (scope.team_id is null or team.id = scope.team_id)
        and (scope.division_id is null or team.division_id = scope.division_id)
        and (scope.club_id is null or club.id = scope.club_id)
        and club.association_id = scope.association_id
    )
    or exists (
      select 1
      from public.user_roles role_row
      where role_row.user_id = p_user_id
        and (
          role_row.role::text = 'SUPER_ADMIN'
          or (role_row.role::text = 'ASSOCIATION_ADMIN' and role_row.association_id = scope.association_id)
          or (role_row.role::text = 'CLUB_ADMIN' and role_row.club_id = scope.club_id)
          or (role_row.role::text in ('TEAM_MANAGER', 'COACH') and role_row.team_id = scope.team_id)
        )
    )
  );
$function$;

create or replace function public.permission_subject_matches(
  p_user_id uuid,
  p_subject_type text,
  p_subject_key text,
  p_association_id uuid,
  p_club_id uuid,
  p_team_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select case p_subject_type
    when 'USER' then p_subject_key = p_user_id::text
    when 'GROUP' then exists (
      select 1
      from public.permission_group_members member
      join public.permission_groups group_row on group_row.id = member.group_id and group_row.active
      where member.user_id = p_user_id and group_row.id::text = p_subject_key
    )
    when 'ROLE' then exists (
      select 1
      from public.user_roles role_row
      where role_row.user_id = p_user_id
        and role_row.role::text = p_subject_key
        and (
          role_row.role::text in ('SUPER_ADMIN', 'UMPIRE', 'VOTER', 'UMPIRE_ADMIN')
          or (role_row.role::text = 'ASSOCIATION_ADMIN' and role_row.association_id = p_association_id)
          or (role_row.role::text = 'CLUB_ADMIN' and role_row.club_id = p_club_id)
          or (role_row.role::text in ('TEAM_MANAGER', 'COACH') and role_row.team_id = p_team_id)
          or (role_row.role::text = 'PLAYER' and (
            role_row.team_id = p_team_id
            or exists (
              select 1 from public.team_memberships membership
              where membership.user_id = p_user_id
                and membership.team_id = p_team_id
                and membership.status::text = 'ACTIVE'
            )
          ))
        )
    )
    else false
  end;
$function$;

create or replace function public.permission_visible_profiles(
  p_scope_type text,
  p_scope_id uuid
)
returns table (profile_id uuid, display_name text)
language plpgsql
stable
security definer
set search_path = ''
as $function$
begin
  if not public.can_manage_module_scope(auth.uid(), p_scope_type, p_scope_id) then
    raise exception 'You cannot view permission subjects at this scope.';
  end if;
  return query
  select profile.id,
         coalesce(nullif(btrim(concat_ws(' ', profile.first_name, profile.last_name)), ''), 'Unnamed user')
  from public.profiles profile
  where public.permission_user_in_scope(profile.id, p_scope_type, p_scope_id)
  order by profile.first_name nulls last, profile.last_name nulls last, profile.id;
end;
$function$;

create or replace function public.resolve_effective_permission(
  p_permission_key text,
  p_user_id uuid default null,
  p_association_id uuid default null,
  p_club_id uuid default null,
  p_division_id uuid default null,
  p_team_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := coalesce(p_user_id, auth.uid());
  v_module_key text;
  v_default boolean;
  v_allowed boolean;
  v_source text;
  v_scope_type text;
  v_scope_id uuid;
begin
  if v_user_id is null then raise exception 'You must be signed in.'; end if;
  if p_user_id is not null and p_user_id <> auth.uid() and not public.is_super_admin() then
    raise exception 'Only a Super Admin can preview another user''s effective permissions.';
  end if;

  select catalogue.module_key, catalogue.default_allowed
  into v_module_key, v_default
  from public.permission_catalogue catalogue
  where catalogue.permission_key = p_permission_key;
  if not found then raise exception 'Unknown permission key.'; end if;

  with scope_chain as (
    select 'ASSOCIATION'::text as scope_type, p_association_id as scope_id, 1 as scope_rank where p_association_id is not null
    union all select 'CLUB', p_club_id, 2 where p_club_id is not null
    union all select 'DIVISION', p_division_id, 3 where p_division_id is not null
    union all select 'TEAM', p_team_id, 4 where p_team_id is not null
  ), candidates as (
    select override_row.allowed, 'DIRECT_' || override_row.subject_type as source,
           chain.scope_type, chain.scope_id, chain.scope_rank,
           case override_row.subject_type when 'USER' then 300 when 'GROUP' then 200 else 100 end as subject_rank,
           20 as rule_rank, override_row.updated_at
    from public.permission_overrides override_row
    join scope_chain chain on chain.scope_type = override_row.scope_type and chain.scope_id = override_row.scope_id
    where override_row.permission_key = p_permission_key
      and override_row.active
      and public.permission_subject_matches(
        v_user_id, override_row.subject_type, override_row.subject_key,
        p_association_id, p_club_id, p_team_id
      )
    union all
    select set_permission.allowed, 'SET_' || assignment.subject_type,
           chain.scope_type, chain.scope_id, chain.scope_rank,
           case assignment.subject_type when 'USER' then 300 when 'GROUP' then 200 else 100 end,
           10, assignment.updated_at
    from public.permission_assignments assignment
    join public.permission_sets set_row on set_row.id = assignment.permission_set_id and set_row.active
    join public.permission_set_permissions set_permission on set_permission.permission_set_id = set_row.id
    join scope_chain chain on chain.scope_type = assignment.scope_type and chain.scope_id = assignment.scope_id
    where set_permission.permission_key = p_permission_key
      and assignment.active
      and public.permission_subject_matches(
        v_user_id, assignment.subject_type, assignment.subject_key,
        p_association_id, p_club_id, p_team_id
      )
  )
  select candidate.allowed, candidate.source, candidate.scope_type, candidate.scope_id
  into v_allowed, v_source, v_scope_type, v_scope_id
  from candidates candidate
  order by candidate.scope_rank desc, candidate.subject_rank desc, candidate.rule_rank desc,
           candidate.allowed asc, candidate.updated_at desc
  limit 1;

  if v_allowed is null and p_permission_key like 'module.%.access' then
    v_allowed := public.resolve_module_enabled(
      v_module_key, p_association_id, p_club_id, p_division_id, p_team_id
    );
    v_source := 'MODULE_SCOPE';
  end if;
  if v_allowed is null then
    v_allowed := v_default;
    v_source := 'CATALOGUE_DEFAULT';
  end if;

  return jsonb_build_object(
    'permission_key', p_permission_key,
    'allowed', v_allowed,
    'source', v_source,
    'scope_type', v_scope_type,
    'scope_id', v_scope_id
  );
end;
$function$;

create or replace function public.has_effective_permission(
  p_permission_key text,
  p_association_id uuid default null,
  p_club_id uuid default null,
  p_division_id uuid default null,
  p_team_id uuid default null
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select coalesce((public.resolve_effective_permission(
    p_permission_key, auth.uid(), p_association_id, p_club_id, p_division_id, p_team_id
  )->>'allowed')::boolean, false);
$function$;

create or replace function public.save_permission_group(
  p_group_id uuid,
  p_name text,
  p_description text,
  p_scope_type text,
  p_scope_id uuid,
  p_member_ids uuid[] default '{}',
  p_active boolean default true,
  p_actor_mode text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_mode text := public.administration_effective_mode(p_actor_mode);
  v_id uuid := coalesce(p_group_id, gen_random_uuid());
  v_details record;
  v_old jsonb;
begin
  if not public.can_manage_module_scope(v_actor, p_scope_type, p_scope_id) then
    raise exception 'You cannot manage permission groups at this scope.';
  end if;
  select * into v_details from public.permission_scope_details(p_scope_type, p_scope_id);
  if not found then raise exception 'The selected permission scope was not found.'; end if;
  select to_jsonb(group_row) into v_old from public.permission_groups group_row where group_row.id = v_id for update;
  if v_old is not null and not public.can_manage_module_scope(
    v_actor, v_old->>'scope_type', (v_old->>'scope_id')::uuid
  ) then raise exception 'The existing permission group is outside your authority.'; end if;
  if exists (
    select 1 from unnest(coalesce(p_member_ids, '{}'::uuid[])) member_id
    where member_id is not null
      and not public.permission_user_in_scope(member_id, p_scope_type, p_scope_id)
  ) then raise exception 'A selected group member is outside this permission scope.'; end if;

  insert into public.permission_groups (
    id, name, description, scope_type, scope_id, active, created_by, updated_by
  ) values (
    v_id, btrim(p_name), nullif(btrim(p_description), ''), p_scope_type, p_scope_id,
    p_active, v_actor, v_actor
  )
  on conflict (id) do update set
    name = excluded.name, description = excluded.description, active = excluded.active,
    updated_by = v_actor, updated_at = now();

  delete from public.permission_group_members member where member.group_id = v_id;
  insert into public.permission_group_members (group_id, user_id, added_by)
  select v_id, member_id, v_actor
  from unnest(coalesce(p_member_ids, '{}'::uuid[])) member_id
  where member_id is not null
  on conflict do nothing;

  insert into public.administration_audit_log (
    actor_id, actor_mode, action, record_type, record_id,
    association_id, club_id, team_id, old_data, new_data
  ) values (
    v_actor, v_mode, case when p_group_id is null then 'PERMISSION_GROUP_CREATED' else 'PERMISSION_GROUP_UPDATED' end,
    'permission_group', v_id, v_details.association_id, v_details.club_id, v_details.team_id,
    v_old, jsonb_build_object('name', btrim(p_name), 'active', p_active, 'member_ids', coalesce(p_member_ids, '{}'::uuid[]))
  );
  return v_id;
end;
$function$;

create or replace function public.save_permission_set(
  p_permission_set_id uuid,
  p_name text,
  p_description text,
  p_scope_type text,
  p_scope_id uuid,
  p_permissions jsonb,
  p_active boolean default true,
  p_actor_mode text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_mode text := public.administration_effective_mode(p_actor_mode);
  v_id uuid := coalesce(p_permission_set_id, gen_random_uuid());
  v_details record;
  v_old jsonb;
begin
  if not public.can_manage_module_scope(v_actor, p_scope_type, p_scope_id) then
    raise exception 'You cannot manage permission sets at this scope.';
  end if;
  select * into v_details from public.permission_scope_details(p_scope_type, p_scope_id);
  if not found then raise exception 'The selected permission scope was not found.'; end if;
  if jsonb_typeof(p_permissions) <> 'object' then raise exception 'Permissions must be supplied as an object.'; end if;
  if exists (
    select 1 from jsonb_object_keys(p_permissions) supplied(permission_key)
    where not exists (select 1 from public.permission_catalogue catalogue where catalogue.permission_key = supplied.permission_key)
  ) then raise exception 'One or more permission keys are not recognised.'; end if;

  select to_jsonb(set_row) into v_old from public.permission_sets set_row where set_row.id = v_id for update;
  if v_old is not null and not public.can_manage_module_scope(
    v_actor, v_old->>'owner_scope_type', (v_old->>'owner_scope_id')::uuid
  ) then raise exception 'The existing permission set is outside your authority.'; end if;
  insert into public.permission_sets (
    id, name, description, owner_scope_type, owner_scope_id, active, created_by, updated_by
  ) values (
    v_id, btrim(p_name), nullif(btrim(p_description), ''), p_scope_type, p_scope_id,
    p_active, v_actor, v_actor
  )
  on conflict (id) do update set
    name = excluded.name, description = excluded.description, active = excluded.active,
    updated_by = v_actor, updated_at = now();

  delete from public.permission_set_permissions set_permission where set_permission.permission_set_id = v_id;
  insert into public.permission_set_permissions (permission_set_id, permission_key, allowed)
  select v_id, entry.key, (entry.value #>> '{}')::boolean
  from jsonb_each(p_permissions) entry;

  insert into public.administration_audit_log (
    actor_id, actor_mode, action, record_type, record_id,
    association_id, club_id, team_id, old_data, new_data
  ) values (
    v_actor, v_mode, case when p_permission_set_id is null then 'PERMISSION_SET_CREATED' else 'PERMISSION_SET_UPDATED' end,
    'permission_set', v_id, v_details.association_id, v_details.club_id, v_details.team_id,
    v_old, jsonb_build_object('name', btrim(p_name), 'active', p_active, 'permissions', p_permissions)
  );
  return v_id;
end;
$function$;

create or replace function public.save_permission_assignment(
  p_assignment_id uuid,
  p_permission_set_id uuid,
  p_subject_type text,
  p_subject_key text,
  p_scope_type text,
  p_scope_id uuid,
  p_active boolean default true,
  p_actor_mode text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_mode text := public.administration_effective_mode(p_actor_mode);
  v_id uuid := coalesce(p_assignment_id, gen_random_uuid());
  v_details record;
  v_old jsonb;
  v_set public.permission_sets%rowtype;
  v_group public.permission_groups%rowtype;
begin
  if p_subject_type not in ('ROLE', 'GROUP', 'USER') then raise exception 'Unknown permission subject type.'; end if;
  if not public.can_manage_module_scope(v_actor, p_scope_type, p_scope_id) then
    raise exception 'You cannot assign permissions at this scope.';
  end if;
  select * into v_set from public.permission_sets set_row
  where set_row.id = p_permission_set_id and set_row.active;
  if not found then raise exception 'The selected permission set was not found.'; end if;
  if not public.can_manage_module_scope(v_actor, v_set.owner_scope_type, v_set.owner_scope_id) then
    raise exception 'The selected permission set is outside your authority.';
  end if;
  if p_subject_type = 'ROLE' and p_subject_key not in (
    'SUPER_ADMIN','ASSOCIATION_ADMIN','CLUB_ADMIN','TEAM_MANAGER','COACH','PLAYER','UMPIRE','VOTER','UMPIRE_ADMIN'
  ) then raise exception 'The selected role was not recognised.'; end if;
  if p_subject_type = 'GROUP' then
    select * into v_group from public.permission_groups group_row
    where group_row.id::text = p_subject_key and group_row.active;
    if not found then raise exception 'The selected permission group was not found.'; end if;
    if not public.can_manage_module_scope(v_actor, v_group.scope_type, v_group.scope_id) then
      raise exception 'The selected permission group is outside your authority.';
    end if;
  end if;
  if p_subject_type = 'USER' and not public.permission_user_in_scope(
    p_subject_key::uuid, p_scope_type, p_scope_id
  ) then raise exception 'The selected user is outside this permission scope.'; end if;

  select * into v_details from public.permission_scope_details(p_scope_type, p_scope_id);
  if not found then raise exception 'The selected permission scope was not found.'; end if;
  select to_jsonb(assignment) into v_old from public.permission_assignments assignment where assignment.id = v_id for update;
  if v_old is not null and not public.can_manage_module_scope(
    v_actor, v_old->>'scope_type', (v_old->>'scope_id')::uuid
  ) then raise exception 'The existing permission assignment is outside your authority.'; end if;

  insert into public.permission_assignments (
    id, permission_set_id, subject_type, subject_key, scope_type, scope_id,
    active, created_by, updated_by
  ) values (
    v_id, p_permission_set_id, p_subject_type, p_subject_key, p_scope_type, p_scope_id,
    p_active, v_actor, v_actor
  )
  on conflict (id) do update set
    permission_set_id = excluded.permission_set_id, subject_type = excluded.subject_type,
    subject_key = excluded.subject_key, scope_type = excluded.scope_type, scope_id = excluded.scope_id,
    active = excluded.active, updated_by = v_actor, updated_at = now();

  insert into public.administration_audit_log (
    actor_id, actor_mode, action, record_type, record_id,
    association_id, club_id, team_id, old_data, new_data
  ) values (
    v_actor, v_mode, 'PERMISSION_ASSIGNMENT_SAVED', 'permission_assignment', v_id,
    v_details.association_id, v_details.club_id, v_details.team_id, v_old,
    jsonb_build_object('permission_set_id', p_permission_set_id, 'subject_type', p_subject_type,
      'subject_key', p_subject_key, 'active', p_active)
  );
  return v_id;
end;
$function$;

create or replace function public.save_permission_override(
  p_permission_key text,
  p_subject_type text,
  p_subject_key text,
  p_scope_type text,
  p_scope_id uuid,
  p_allowed boolean,
  p_reason text default null,
  p_active boolean default true,
  p_actor_mode text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_mode text := public.administration_effective_mode(p_actor_mode);
  v_id uuid;
  v_details record;
  v_old jsonb;
begin
  if not exists (select 1 from public.permission_catalogue catalogue where catalogue.permission_key = p_permission_key) then
    raise exception 'Unknown permission key.';
  end if;
  if p_subject_type not in ('ROLE', 'GROUP', 'USER') then raise exception 'Unknown permission subject type.'; end if;
  if not public.can_manage_module_scope(v_actor, p_scope_type, p_scope_id) then
    raise exception 'You cannot set permission overrides at this scope.';
  end if;
  select * into v_details from public.permission_scope_details(p_scope_type, p_scope_id);
  if not found then raise exception 'The selected permission scope was not found.'; end if;
  if p_subject_type = 'ROLE' and p_subject_key not in (
    'SUPER_ADMIN','ASSOCIATION_ADMIN','CLUB_ADMIN','TEAM_MANAGER','COACH','PLAYER','UMPIRE','VOTER','UMPIRE_ADMIN'
  ) then raise exception 'The selected role was not recognised.'; end if;
  if p_subject_type = 'GROUP' and not exists (
    select 1 from public.permission_groups group_row
    where group_row.id::text = p_subject_key
      and group_row.active
      and public.can_manage_module_scope(v_actor, group_row.scope_type, group_row.scope_id)
  ) then raise exception 'The selected permission group was not found in your scope.'; end if;
  if p_subject_type = 'USER' and not public.permission_user_in_scope(
    p_subject_key::uuid, p_scope_type, p_scope_id
  ) then raise exception 'The selected user is outside this permission scope.'; end if;

  select override_row.id, to_jsonb(override_row)
  into v_id, v_old
  from public.permission_overrides override_row
  where override_row.permission_key = p_permission_key
    and override_row.subject_type = p_subject_type
    and override_row.subject_key = p_subject_key
    and override_row.scope_type = p_scope_type
    and override_row.scope_id = p_scope_id
    and override_row.active
  for update;
  v_id := coalesce(v_id, gen_random_uuid());

  insert into public.permission_overrides (
    id, permission_key, subject_type, subject_key, scope_type, scope_id,
    allowed, reason, active, created_by, updated_by
  ) values (
    v_id, p_permission_key, p_subject_type, p_subject_key, p_scope_type, p_scope_id,
    p_allowed, nullif(btrim(p_reason), ''), p_active, v_actor, v_actor
  )
  on conflict (id) do update set
    allowed = excluded.allowed, reason = excluded.reason, active = excluded.active,
    updated_by = v_actor, updated_at = now();

  insert into public.administration_audit_log (
    actor_id, actor_mode, action, record_type, record_id,
    association_id, club_id, team_id, old_data, new_data
  ) values (
    v_actor, v_mode, 'PERMISSION_OVERRIDE_SAVED', 'permission_override', v_id,
    v_details.association_id, v_details.club_id, v_details.team_id, v_old,
    jsonb_build_object('permission_key', p_permission_key, 'subject_type', p_subject_type,
      'subject_key', p_subject_key, 'allowed', p_allowed, 'active', p_active, 'reason', p_reason)
  );
  return v_id;
end;
$function$;

alter table public.permission_catalogue enable row level security;
alter table public.permission_groups enable row level security;
alter table public.permission_group_members enable row level security;
alter table public.permission_sets enable row level security;
alter table public.permission_set_permissions enable row level security;
alter table public.permission_assignments enable row level security;
alter table public.permission_overrides enable row level security;

create policy permission_catalogue_authenticated_read on public.permission_catalogue
  for select to authenticated using (true);
create policy permission_groups_scoped_read on public.permission_groups
  for select to authenticated using (public.can_manage_module_scope(auth.uid(), scope_type, scope_id));
create policy permission_group_members_scoped_read on public.permission_group_members
  for select to authenticated using (exists (
    select 1 from public.permission_groups group_row
    where group_row.id = group_id
      and public.can_manage_module_scope(auth.uid(), group_row.scope_type, group_row.scope_id)
  ));
create policy permission_sets_scoped_read on public.permission_sets
  for select to authenticated using (public.can_manage_module_scope(auth.uid(), owner_scope_type, owner_scope_id));
create policy permission_set_permissions_scoped_read on public.permission_set_permissions
  for select to authenticated using (exists (
    select 1 from public.permission_sets set_row
    where set_row.id = permission_set_id
      and public.can_manage_module_scope(auth.uid(), set_row.owner_scope_type, set_row.owner_scope_id)
  ));
create policy permission_assignments_scoped_read on public.permission_assignments
  for select to authenticated using (public.can_manage_module_scope(auth.uid(), scope_type, scope_id));
create policy permission_overrides_scoped_read on public.permission_overrides
  for select to authenticated using (public.can_manage_module_scope(auth.uid(), scope_type, scope_id));

revoke all on public.permission_catalogue, public.permission_groups, public.permission_group_members,
  public.permission_sets, public.permission_set_permissions, public.permission_assignments,
  public.permission_overrides from public, anon, authenticated;
grant select on public.permission_catalogue, public.permission_groups, public.permission_group_members,
  public.permission_sets, public.permission_set_permissions, public.permission_assignments,
  public.permission_overrides to authenticated;
grant all on public.permission_catalogue, public.permission_groups, public.permission_group_members,
  public.permission_sets, public.permission_set_permissions, public.permission_assignments,
  public.permission_overrides to service_role;

revoke all on function public.permission_scope_details(text, uuid) from public, anon;
revoke all on function public.permission_user_in_scope(uuid, text, uuid) from public, anon;
revoke all on function public.permission_subject_matches(uuid, text, text, uuid, uuid, uuid) from public, anon;
revoke all on function public.permission_visible_profiles(text, uuid) from public, anon;
revoke all on function public.resolve_effective_permission(text, uuid, uuid, uuid, uuid, uuid) from public, anon;
revoke all on function public.has_effective_permission(text, uuid, uuid, uuid, uuid) from public, anon;
revoke all on function public.save_permission_group(uuid, text, text, text, uuid, uuid[], boolean, text) from public, anon;
revoke all on function public.save_permission_set(uuid, text, text, text, uuid, jsonb, boolean, text) from public, anon;
revoke all on function public.save_permission_assignment(uuid, uuid, text, text, text, uuid, boolean, text) from public, anon;
revoke all on function public.save_permission_override(text, text, text, text, uuid, boolean, text, boolean, text) from public, anon;

grant execute on function public.resolve_effective_permission(text, uuid, uuid, uuid, uuid, uuid) to authenticated;
grant execute on function public.has_effective_permission(text, uuid, uuid, uuid, uuid) to authenticated;
grant execute on function public.permission_visible_profiles(text, uuid) to authenticated;
grant execute on function public.save_permission_group(uuid, text, text, text, uuid, uuid[], boolean, text) to authenticated;
grant execute on function public.save_permission_set(uuid, text, text, text, uuid, jsonb, boolean, text) to authenticated;
grant execute on function public.save_permission_assignment(uuid, uuid, text, text, text, uuid, boolean, text) to authenticated;
grant execute on function public.save_permission_override(text, text, text, text, uuid, boolean, text, boolean, text) to authenticated;

comment on function public.resolve_effective_permission(text, uuid, uuid, uuid, uuid, uuid) is
  'Resolves the closest permission rule in this order: scope, individual/group/role, direct/set, deny on an exact tie, then module or catalogue default.';
