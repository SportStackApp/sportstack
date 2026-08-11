-- Guided committee creation and one-level private subcommittees.
-- Existing committees remain standing root committees with their current access.

alter table public.committees
  add column if not exists parent_committee_id uuid,
  add column if not exists lifecycle_type text not null default 'STANDING',
  add column if not exists starts_on date not null default current_date,
  add column if not exists target_end_on date,
  add column if not exists closed_at timestamptz,
  add column if not exists closed_by uuid references public.profiles(id) on delete set null;

update public.committees
set closed_at = coalesce(updated_at, created_at, now())
where not is_active
  and closed_at is null;

alter table public.committees
  add constraint committees_parent_committee_id_fkey
  foreign key (parent_committee_id)
  references public.committees(id)
  on delete restrict;

alter table public.committees
  add constraint committees_lifecycle_type_check
  check (lifecycle_type in ('STANDING', 'TEMPORARY')),
  add constraint committees_lifecycle_dates_check
  check (target_end_on is null or target_end_on >= starts_on),
  add constraint committees_closed_state_check
  check (
    (is_active and closed_at is null)
    or (not is_active and closed_at is not null)
  );

create index if not exists committees_parent_committee_idx
  on public.committees (parent_committee_id)
  where parent_committee_id is not null;

create or replace function private.is_committee_setup_manager(
  p_committee_id uuid,
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select p_user_id is not null
    and p_user_id = (select auth.uid())
    and exists (
      select 1
      from public.committees committee
      join public.committee_members member_row
        on member_row.committee_id = committee.id
      join public.committee_positions position
        on position.id = member_row.position_id
      where committee.id = p_committee_id
        and committee.is_active
        and position.is_active
        and member_row.user_id = p_user_id
        and member_row.start_date <= current_date
        and (member_row.end_date is null or member_row.end_date >= current_date)
        and position.permissions -> 'manage_committee' = 'true'::jsonb
        and private.module_allowed_in_accessible_scope_for_current_session(
          'committee', committee.association_id, committee.club_id, null, null
        )
    );
$function$;

revoke all on function private.is_committee_setup_manager(uuid, uuid)
  from public, anon, authenticated;

create or replace function public.can_create_committee(
  p_user_id uuid,
  p_association_id uuid,
  p_club_id uuid default null,
  p_parent_committee_id uuid default null
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select p_user_id is not null
    and p_user_id = (select auth.uid())
    and private.module_allowed_in_accessible_scope_for_current_session(
      'committee', p_association_id, p_club_id, null, null
    )
    and (
      public.can_manage_committee_scope(
        p_user_id, p_association_id, p_club_id
      )
      or (
        p_parent_committee_id is not null
        and private.is_committee_setup_manager(
          p_parent_committee_id, p_user_id
        )
        and exists (
          select 1
          from public.committees parent
          where parent.id = p_parent_committee_id
            and parent.parent_committee_id is null
            and parent.is_active
            and parent.association_id = p_association_id
            and parent.club_id is not distinct from p_club_id
        )
      )
    );
$function$;

create or replace function public.has_committee_permission(
  p_committee_id uuid,
  p_permission_key text,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select p_user_id is not null
    and p_user_id = (select auth.uid())
    and p_permission_key in (
      'manage_committee',
      'manage_members',
      'manage_documents',
      'manage_polls',
      'vote',
      'manage_meetings',
      'record_minutes',
      'chat'
    )
    and exists (
      select 1
      from public.committees committee
      where committee.id = p_committee_id
        and private.module_allowed_in_accessible_scope_for_current_session(
          'committee', committee.association_id, committee.club_id, null, null
        )
        and (
          (
            p_permission_key in (
              'manage_committee',
              'manage_members',
              'manage_documents',
              'manage_polls',
              'manage_meetings',
              'record_minutes'
            )
            and (
              public.can_manage_committee_scope(
                p_user_id,
                committee.association_id,
                committee.club_id
              )
              or (
                committee.parent_committee_id is not null
                and private.is_committee_setup_manager(
                  committee.parent_committee_id, p_user_id
                )
              )
            )
          )
          or exists (
            select 1
            from public.committee_members member_row
            join public.committee_positions position
              on position.id = member_row.position_id
            where member_row.committee_id = committee.id
              and member_row.user_id = p_user_id
              and member_row.start_date <= current_date
              and (member_row.end_date is null or member_row.end_date >= current_date)
              and committee.is_active
              and position.is_active
              and position.permissions -> p_permission_key = 'true'::jsonb
          )
        )
    );
$function$;

create or replace function public.can_view_committee(
  p_committee_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select p_user_id is not null
    and p_user_id = (select auth.uid())
    and exists (
      select 1
      from public.committees committee
      where committee.id = p_committee_id
        and private.module_allowed_in_accessible_scope_for_current_session(
          'committee', committee.association_id, committee.club_id, null, null
        )
        and (
          public.can_manage_committee_scope(
            p_user_id, committee.association_id, committee.club_id
          )
          or public.is_active_committee_member(committee.id, p_user_id)
          or (
            committee.parent_committee_id is not null
            and private.is_committee_setup_manager(
              committee.parent_committee_id, p_user_id
            )
          )
        )
    );
$function$;

create or replace function private.is_committee_candidate(
  p_user_id uuid,
  p_association_id uuid,
  p_club_id uuid default null
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.profiles profile
    where profile.id = p_user_id
      and not profile.is_placeholder
      and (
        exists (
          select 1
          from public.team_memberships membership
          join public.teams team on team.id = membership.team_id
          join public.clubs club on club.id = team.club_id
          where membership.user_id = profile.id
            and membership.status::text = 'ACTIVE'
            and (
              (p_club_id is not null and club.id = p_club_id)
              or (p_club_id is null and club.association_id = p_association_id)
            )
        )
        or exists (
          select 1
          from public.user_roles role_row
          left join public.teams team on team.id = role_row.team_id
          left join public.clubs role_club
            on role_club.id = coalesce(role_row.club_id, team.club_id)
          where role_row.user_id = profile.id
            and (
              (
                p_club_id is not null
                and (
                  role_row.club_id = p_club_id
                  or team.club_id = p_club_id
                )
              )
              or (
                p_club_id is null
                and (
                  role_row.association_id = p_association_id
                  or role_club.association_id = p_association_id
                )
              )
            )
        )
      )
  );
$function$;

revoke all on function private.is_committee_candidate(uuid, uuid, uuid)
  from public, anon, authenticated;

create or replace function public.list_committee_candidates(
  p_association_id uuid,
  p_club_id uuid default null,
  p_parent_committee_id uuid default null
)
returns table (
  profile_id uuid,
  display_name text,
  is_current_club_president boolean
)
language sql
stable
security definer
set search_path = ''
as $function$
  select
    profile.id as profile_id,
    coalesce(
      nullif(btrim(concat_ws(' ', profile.first_name, profile.last_name)), ''),
      'Unnamed user'
    ) as display_name,
    exists (
      select 1
      from public.committee_members president_member
      join public.committee_positions president_position
        on president_position.id = president_member.position_id
      join public.committees club_committee
        on club_committee.id = president_member.committee_id
      where president_member.user_id = profile.id
        and president_position.is_president
        and president_position.is_active
        and club_committee.is_active
        and club_committee.parent_committee_id is null
        and club_committee.scope_type = 'CLUB'
        and club_committee.association_id = p_association_id
        and president_member.start_date <= current_date
        and (
          president_member.end_date is null
          or president_member.end_date >= current_date
        )
    ) as is_current_club_president
  from public.profiles profile
  where public.can_create_committee(
      (select auth.uid()),
      p_association_id,
      p_club_id,
      p_parent_committee_id
    )
    and private.is_committee_candidate(
      profile.id, p_association_id, p_club_id
    )
  order by display_name, profile.id;
$function$;

create or replace function public.validate_committee_hierarchy()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_parent public.committees%rowtype;
begin
  if tg_op = 'UPDATE' and (
    old.parent_committee_id is distinct from new.parent_committee_id
    or old.association_id is distinct from new.association_id
    or old.club_id is distinct from new.club_id
    or old.scope_type is distinct from new.scope_type
  ) then
    raise exception 'A committee organisation or parent cannot be changed after creation.';
  end if;

  if new.parent_committee_id is not null then
    if new.parent_committee_id = new.id then
      raise exception 'A committee cannot be its own parent.';
    end if;

    select * into v_parent
    from public.committees
    where id = new.parent_committee_id;

    if not found then
      raise exception 'The selected parent committee does not exist.';
    end if;
    if v_parent.parent_committee_id is not null then
      raise exception 'Subcommittees cannot contain another subcommittee.';
    end if;
    if not v_parent.is_active then
      raise exception 'A subcommittee cannot be added to a closed committee.';
    end if;
    if v_parent.association_id <> new.association_id
      or v_parent.club_id is distinct from new.club_id
      or v_parent.scope_type <> new.scope_type then
      raise exception 'A subcommittee must use its parent committee organisation.';
    end if;
  end if;

  if new.is_active then
    new.closed_at := null;
    new.closed_by := null;
  elsif new.closed_at is null then
    new.closed_at := now();
  end if;

  if tg_op = 'UPDATE' and old.is_active and not new.is_active then
    new.closed_by := (select auth.uid());
  end if;

  if tg_op = 'UPDATE' and old.is_active and not new.is_active
    and exists (
      select 1
      from public.committees child
      where child.parent_committee_id = old.id
        and child.is_active
    ) then
    raise exception 'Close active subcommittees before closing this committee.';
  end if;

  return new;
end;
$function$;

create or replace function public.validate_committee_member_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_association_id uuid;
  v_club_id uuid;
begin
  select association_id, club_id
  into v_association_id, v_club_id
  from public.committees
  where id = new.committee_id;

  if not private.is_committee_candidate(
    new.user_id, v_association_id, v_club_id
  ) then
    raise exception 'The selected person is not linked to this committee organisation.';
  end if;

  return new;
end;
$function$;

drop trigger if exists committees_validate_hierarchy on public.committees;
create trigger committees_validate_hierarchy
before insert or update on public.committees
for each row execute function public.validate_committee_hierarchy();

drop trigger if exists committee_members_validate_scope on public.committee_members;
create trigger committee_members_validate_scope
before insert or update on public.committee_members
for each row execute function public.validate_committee_member_scope();

revoke all on function public.validate_committee_hierarchy()
  from public, anon, authenticated;
revoke all on function public.validate_committee_member_scope()
  from public, anon, authenticated;

drop policy if exists committees_select on public.committees;
create policy committees_select on public.committees
for select to authenticated
using (public.can_view_committee(id, (select auth.uid())));

drop policy if exists committees_insert on public.committees;
create policy committees_insert on public.committees
for insert to authenticated
with check (
  public.can_create_committee(
    (select auth.uid()),
    association_id,
    club_id,
    parent_committee_id
  )
);

create or replace function public.create_committee_with_setup(
  p_committee jsonb,
  p_positions jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_user_id uuid := (select auth.uid());
  v_committee_id uuid;
  v_parent_id uuid;
  v_association_id uuid;
  v_club_id uuid;
  v_scope_type text;
  v_position jsonb;
  v_position_id uuid;
  v_member_id_text text;
  v_permissions jsonb;
begin
  if v_user_id is null then
    raise exception 'You must be signed in to create a committee.';
  end if;
  if jsonb_typeof(p_committee) <> 'object'
    or jsonb_typeof(p_positions) <> 'array' then
    raise exception 'Committee setup data is not valid.';
  end if;
  if nullif(btrim(p_committee ->> 'name'), '') is null
    or nullif(btrim(p_committee ->> 'description'), '') is null then
    raise exception 'A committee name and purpose are required.';
  end if;

  v_parent_id := nullif(p_committee ->> 'parent_committee_id', '')::uuid;
  if v_parent_id is not null then
    select association_id, club_id, scope_type
    into v_association_id, v_club_id, v_scope_type
    from public.committees
    where id = v_parent_id;
    if not found then
      raise exception 'The selected parent committee does not exist.';
    end if;
  else
    v_association_id := nullif(p_committee ->> 'association_id', '')::uuid;
    v_club_id := nullif(p_committee ->> 'club_id', '')::uuid;
    v_scope_type := coalesce(nullif(p_committee ->> 'scope_type', ''), 'ASSOCIATION');
  end if;

  insert into public.committees (
    association_id,
    club_id,
    scope_type,
    parent_committee_id,
    lifecycle_type,
    starts_on,
    target_end_on,
    name,
    description,
    created_by
  ) values (
    v_association_id,
    case when v_scope_type = 'CLUB' then v_club_id else null end,
    v_scope_type,
    v_parent_id,
    coalesce(nullif(p_committee ->> 'lifecycle_type', ''), 'STANDING'),
    coalesce(nullif(p_committee ->> 'starts_on', '')::date, current_date),
    nullif(p_committee ->> 'target_end_on', '')::date,
    btrim(p_committee ->> 'name'),
    nullif(btrim(p_committee ->> 'description'), ''),
    v_user_id
  )
  returning id into v_committee_id;

  for v_position in select value from jsonb_array_elements(p_positions)
  loop
    if nullif(btrim(v_position ->> 'title'), '') is null then
      raise exception 'Every selected position needs a title.';
    end if;
    v_permissions := jsonb_build_object(
      'manage_committee', coalesce((v_position -> 'permissions' ->> 'manage_committee')::boolean, false),
      'manage_members', coalesce((v_position -> 'permissions' ->> 'manage_members')::boolean, false),
      'manage_documents', coalesce((v_position -> 'permissions' ->> 'manage_documents')::boolean, false),
      'manage_polls', coalesce((v_position -> 'permissions' ->> 'manage_polls')::boolean, false),
      'vote', coalesce((v_position -> 'permissions' ->> 'vote')::boolean, false),
      'manage_meetings', coalesce((v_position -> 'permissions' ->> 'manage_meetings')::boolean, false),
      'record_minutes', coalesce((v_position -> 'permissions' ->> 'record_minutes')::boolean, false),
      'chat', coalesce((v_position -> 'permissions' ->> 'chat')::boolean, false)
    );

    insert into public.committee_positions (
      committee_id,
      title,
      description,
      is_president,
      permissions,
      sort_order
    ) values (
      v_committee_id,
      btrim(v_position ->> 'title'),
      nullif(btrim(v_position ->> 'description'), ''),
      coalesce((v_position ->> 'is_president')::boolean, false),
      v_permissions,
      coalesce((v_position ->> 'sort_order')::integer, 0)
    )
    returning id into v_position_id;

    for v_member_id_text in
      select value
      from jsonb_array_elements_text(
        coalesce(v_position -> 'member_ids', '[]'::jsonb)
      )
    loop
      insert into public.committee_members (
        committee_id,
        position_id,
        user_id,
        start_date,
        appointed_by
      ) values (
        v_committee_id,
        v_position_id,
        v_member_id_text::uuid,
        coalesce(nullif(p_committee ->> 'starts_on', '')::date, current_date),
        v_user_id
      );
    end loop;
  end loop;

  return v_committee_id;
end;
$function$;

revoke all on function public.can_create_committee(uuid, uuid, uuid, uuid)
  from public, anon;
revoke all on function public.list_committee_candidates(uuid, uuid, uuid)
  from public, anon;
revoke all on function public.create_committee_with_setup(jsonb, jsonb)
  from public, anon;

grant execute on function public.can_create_committee(uuid, uuid, uuid, uuid)
  to authenticated;
grant execute on function public.list_committee_candidates(uuid, uuid, uuid)
  to authenticated;
grant execute on function public.create_committee_with_setup(jsonb, jsonb)
  to authenticated;

grant execute on function public.can_create_committee(uuid, uuid, uuid, uuid)
  to service_role;
grant execute on function public.list_committee_candidates(uuid, uuid, uuid)
  to service_role;
grant execute on function public.create_committee_with_setup(jsonb, jsonb)
  to service_role;

comment on column public.committees.parent_committee_id is
  'Optional one-level parent. Subcommittee records and membership remain private and separate.';
comment on column public.committees.lifecycle_type is
  'STANDING for ongoing committees or TEMPORARY for panels and working groups.';
comment on function public.create_committee_with_setup(jsonb, jsonb) is
  'Atomically creates an authorised committee or subcommittee with optional positions and appointments.';
