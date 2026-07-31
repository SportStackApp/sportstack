-- Association and club committee setup. Position permissions flow to current
-- appointments; committee records are private to scoped administrators and
-- current committee members.

create table public.committees (
  id uuid primary key default gen_random_uuid(),
  association_id uuid not null references public.associations(id) on delete cascade,
  club_id uuid references public.clubs(id) on delete cascade,
  scope_type text not null,
  name text not null,
  description text,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint committees_scope_type_check check (scope_type in ('ASSOCIATION', 'CLUB')),
  constraint committees_scope_shape_check check (
    (scope_type = 'ASSOCIATION' and club_id is null)
    or (scope_type = 'CLUB' and club_id is not null)
  ),
  constraint committees_name_not_blank check (btrim(name) <> '')
);

create unique index committees_scope_name_key
  on public.committees (
    association_id,
    coalesce(club_id, '00000000-0000-0000-0000-000000000000'::uuid),
    lower(name)
  );

create table public.committee_positions (
  id uuid primary key default gen_random_uuid(),
  committee_id uuid not null references public.committees(id) on delete cascade,
  title text not null,
  description text,
  is_president boolean not null default false,
  permissions jsonb not null default '{}'::jsonb,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint committee_positions_title_not_blank check (btrim(title) <> ''),
  constraint committee_positions_permissions_object check (jsonb_typeof(permissions) = 'object'),
  constraint committee_positions_title_key unique (committee_id, title)
);

create unique index committee_positions_one_president_idx
  on public.committee_positions (committee_id)
  where is_president and is_active;

create table public.committee_members (
  id uuid primary key default gen_random_uuid(),
  committee_id uuid not null references public.committees(id) on delete cascade,
  position_id uuid not null references public.committee_positions(id) on delete restrict,
  user_id uuid not null references public.profiles(id) on delete cascade,
  start_date date not null default current_date,
  end_date date,
  appointment_notes text,
  appointed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint committee_members_date_check check (end_date is null or end_date >= start_date)
);

create unique index committee_members_current_appointment_key
  on public.committee_members (committee_id, position_id, user_id)
  where end_date is null;

create index committee_members_user_idx
  on public.committee_members (user_id, committee_id, start_date, end_date);

create table public.committee_member_qualifications (
  id uuid primary key default gen_random_uuid(),
  committee_member_id uuid not null references public.committee_members(id) on delete cascade,
  title text not null,
  issuer text,
  obtained_date date,
  expiry_date date,
  document_url text,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint committee_qualifications_title_not_blank check (btrim(title) <> ''),
  constraint committee_qualifications_date_check check (
    expiry_date is null or obtained_date is null or expiry_date >= obtained_date
  )
);

create table public.committee_documents (
  id uuid primary key default gen_random_uuid(),
  committee_id uuid not null references public.committees(id) on delete cascade,
  title text not null,
  document_type text not null default 'Governance',
  document_url text not null,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint committee_documents_title_not_blank check (btrim(title) <> ''),
  constraint committee_documents_url_not_blank check (btrim(document_url) <> '')
);

create or replace function public.can_manage_committee_scope(
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
  select p_user_id is not null
    and exists (
      select 1
      from public.user_roles role_row
      where role_row.user_id = p_user_id
        and (
          role_row.role = 'SUPER_ADMIN'::public.user_role_enum
          or (
            role_row.role = 'ASSOCIATION_ADMIN'::public.user_role_enum
            and role_row.association_id = p_association_id
          )
          or (
            p_club_id is not null
            and role_row.role = 'CLUB_ADMIN'::public.user_role_enum
            and role_row.club_id = p_club_id
          )
        )
    );
$function$;

create or replace function public.is_active_committee_member(
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
    and exists (
      select 1
      from public.committee_members member_row
      join public.committees committee on committee.id = member_row.committee_id
      join public.committee_positions position on position.id = member_row.position_id
      where member_row.committee_id = p_committee_id
        and member_row.user_id = p_user_id
        and member_row.start_date <= current_date
        and (member_row.end_date is null or member_row.end_date >= current_date)
        and committee.is_active
        and position.is_active
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
  select p_permission_key in (
    'manage_committee',
    'manage_members',
    'manage_documents',
    'manage_polls',
    'vote',
    'manage_meetings',
    'record_minutes',
    'chat'
  )
  and (
    exists (
      select 1
      from public.committees committee
      where committee.id = p_committee_id
        and public.can_manage_committee_scope(
          p_user_id,
          committee.association_id,
          committee.club_id
        )
    )
    or exists (
      select 1
      from public.committee_members member_row
      join public.committee_positions position on position.id = member_row.position_id
      join public.committees committee on committee.id = member_row.committee_id
      where member_row.committee_id = p_committee_id
        and member_row.user_id = p_user_id
        and member_row.start_date <= current_date
        and (member_row.end_date is null or member_row.end_date >= current_date)
        and committee.is_active
        and position.is_active
        and position.permissions -> p_permission_key = 'true'::jsonb
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
  select exists (
    select 1
    from public.committees committee
    where committee.id = p_committee_id
      and (
        public.can_manage_committee_scope(p_user_id, committee.association_id, committee.club_id)
        or public.is_active_committee_member(committee.id, p_user_id)
      )
  );
$function$;

create or replace function public.validate_committee_scope()
returns trigger
language plpgsql
set search_path = ''
as $function$
declare
  v_club_association_id uuid;
begin
  if new.scope_type = 'CLUB' then
    select association_id into v_club_association_id
    from public.clubs
    where id = new.club_id;
    if v_club_association_id is null or v_club_association_id <> new.association_id then
      raise exception 'The selected club does not belong to the selected association.';
    end if;
  end if;
  return new;
end;
$function$;

create or replace function public.validate_committee_member_position()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if not exists (
    select 1 from public.committee_positions position
    where position.id = new.position_id
      and position.committee_id = new.committee_id
  ) then
    raise exception 'The selected position does not belong to this committee.';
  end if;
  return new;
end;
$function$;

create or replace function public.set_committee_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  new.updated_at := now();
  return new;
end;
$function$;

create trigger committees_validate_scope
before insert or update on public.committees
for each row execute function public.validate_committee_scope();

create trigger committee_members_validate_position
before insert or update on public.committee_members
for each row execute function public.validate_committee_member_position();

create trigger committees_set_updated_at
before update on public.committees
for each row execute function public.set_committee_updated_at();
create trigger committee_positions_set_updated_at
before update on public.committee_positions
for each row execute function public.set_committee_updated_at();
create trigger committee_members_set_updated_at
before update on public.committee_members
for each row execute function public.set_committee_updated_at();
create trigger committee_qualifications_set_updated_at
before update on public.committee_member_qualifications
for each row execute function public.set_committee_updated_at();
create trigger committee_documents_set_updated_at
before update on public.committee_documents
for each row execute function public.set_committee_updated_at();

alter table public.committees enable row level security;
alter table public.committee_positions enable row level security;
alter table public.committee_members enable row level security;
alter table public.committee_member_qualifications enable row level security;
alter table public.committee_documents enable row level security;

create policy committees_select on public.committees
for select to authenticated
using (
  public.can_manage_committee_scope((select auth.uid()), association_id, club_id)
  or public.is_active_committee_member(id, (select auth.uid()))
);
create policy committees_insert on public.committees
for insert to authenticated
with check (public.can_manage_committee_scope((select auth.uid()), association_id, club_id));
create policy committees_update on public.committees
for update to authenticated
using (public.has_committee_permission(id, 'manage_committee', (select auth.uid())))
with check (public.has_committee_permission(id, 'manage_committee', (select auth.uid())));
create policy committees_delete on public.committees
for delete to authenticated
using (public.can_manage_committee_scope((select auth.uid()), association_id, club_id));

create policy committee_positions_select on public.committee_positions
for select to authenticated
using (public.can_view_committee(committee_id, (select auth.uid())));
create policy committee_positions_write on public.committee_positions
for all to authenticated
using (public.has_committee_permission(committee_id, 'manage_committee', (select auth.uid())))
with check (public.has_committee_permission(committee_id, 'manage_committee', (select auth.uid())));

create policy committee_members_select on public.committee_members
for select to authenticated
using (public.can_view_committee(committee_id, (select auth.uid())));
create policy committee_members_write on public.committee_members
for all to authenticated
using (public.has_committee_permission(committee_id, 'manage_members', (select auth.uid())))
with check (public.has_committee_permission(committee_id, 'manage_members', (select auth.uid())));

create policy committee_qualifications_select on public.committee_member_qualifications
for select to authenticated
using (
  exists (
    select 1 from public.committee_members member_row
    where member_row.id = committee_member_id
      and public.can_view_committee(member_row.committee_id, (select auth.uid()))
  )
);
create policy committee_qualifications_write on public.committee_member_qualifications
for all to authenticated
using (
  exists (
    select 1 from public.committee_members member_row
    where member_row.id = committee_member_id
      and (
        member_row.user_id = (select auth.uid())
        or public.has_committee_permission(member_row.committee_id, 'manage_members', (select auth.uid()))
      )
  )
)
with check (
  exists (
    select 1 from public.committee_members member_row
    where member_row.id = committee_member_id
      and (
        member_row.user_id = (select auth.uid())
        or public.has_committee_permission(member_row.committee_id, 'manage_members', (select auth.uid()))
      )
  )
);

create policy committee_documents_select on public.committee_documents
for select to authenticated
using (public.can_view_committee(committee_id, (select auth.uid())));
create policy committee_documents_write on public.committee_documents
for all to authenticated
using (public.has_committee_permission(committee_id, 'manage_documents', (select auth.uid())))
with check (public.has_committee_permission(committee_id, 'manage_documents', (select auth.uid())));

revoke all on table public.committees from public, anon;
revoke all on table public.committee_positions from public, anon;
revoke all on table public.committee_members from public, anon;
revoke all on table public.committee_member_qualifications from public, anon;
revoke all on table public.committee_documents from public, anon;
grant select, insert, update, delete on table public.committees to authenticated;
grant select, insert, update, delete on table public.committee_positions to authenticated;
grant select, insert, update, delete on table public.committee_members to authenticated;
grant select, insert, update, delete on table public.committee_member_qualifications to authenticated;
grant select, insert, update, delete on table public.committee_documents to authenticated;
grant all on table public.committees to service_role;
grant all on table public.committee_positions to service_role;
grant all on table public.committee_members to service_role;
grant all on table public.committee_member_qualifications to service_role;
grant all on table public.committee_documents to service_role;

revoke all on function public.can_manage_committee_scope(uuid, uuid, uuid) from public, anon;
revoke all on function public.is_active_committee_member(uuid, uuid) from public, anon;
revoke all on function public.has_committee_permission(uuid, text, uuid) from public, anon;
revoke all on function public.can_view_committee(uuid, uuid) from public, anon;
grant execute on function public.can_manage_committee_scope(uuid, uuid, uuid) to authenticated;
grant execute on function public.is_active_committee_member(uuid, uuid) to authenticated;
grant execute on function public.has_committee_permission(uuid, text, uuid) to authenticated;
grant execute on function public.can_view_committee(uuid, uuid) to authenticated;

comment on table public.committee_positions is
  'Custom committee positions with permissions inherited by current appointments.';
comment on table public.committee_member_qualifications is
  'Qualification and expiry records attached to a committee appointment.';
