-- B1a: dormant foundation objects for the later access/identity compatibility
-- package. This migration deliberately creates no functions, policies, grants,
-- triggers or data. New tables therefore remain inaccessible to browser roles
-- until the separately rehearsed B1b security layer is applied.
--
-- Every statement is additive and repeat-safe. On Development, where these
-- objects already exist, this migration is a structural no-op.

create schema if not exists private;

create temporary table b1a_new_objects (
  schema_name text not null,
  object_name text not null,
  object_type text not null,
  primary key (schema_name, object_name)
);

insert into b1a_new_objects (schema_name, object_name, object_type)
select candidate.schema_name, candidate.object_name, candidate.object_type
from (values
  ('public', 'module_feature_flags', 'table'),
  ('public', 'administration_audit_log', 'table'),
  ('public', 'administration_integrity_snapshot_batches', 'table'),
  ('public', 'administration_membership_integrity_snapshot', 'table'),
  ('public', 'permission_catalogue', 'table'),
  ('public', 'permission_groups', 'table'),
  ('public', 'permission_group_members', 'table'),
  ('public', 'permission_sets', 'table'),
  ('public', 'permission_set_permissions', 'table'),
  ('public', 'permission_assignments', 'table'),
  ('public', 'permission_overrides', 'table'),
  ('private', 'auth_session_permission_modes', 'table'),
  ('private', 'auth_session_permission_mode_revision_seq', 'sequence')
) as candidate(schema_name, object_name, object_type)
where to_regclass(format('%I.%I', candidate.schema_name, candidate.object_name)) is null;

create table if not exists public.module_feature_flags (
  id uuid primary key default gen_random_uuid(),
  module_key text not null,
  scope_type text not null,
  scope_id uuid not null,
  enabled boolean not null,
  association_id uuid references public.associations(id) on delete cascade,
  club_id uuid references public.clubs(id) on delete cascade,
  division_id uuid references public.divisions(id) on delete cascade,
  team_id uuid references public.teams(id) on delete cascade,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint module_feature_flags_module_key_check check (
    module_key in (
      'player_mvp',
      'umpire_match_voting',
      'committee',
      'safety_risk',
      'hockey_trace'
    )
  ),
  constraint module_feature_flags_scope_type_check check (
    scope_type in ('ASSOCIATION', 'CLUB', 'DIVISION', 'TEAM')
  )
);

create unique index if not exists module_feature_flags_module_scope_key
  on public.module_feature_flags (module_key, scope_type, scope_id);
create index if not exists module_feature_flags_scope_idx
  on public.module_feature_flags (scope_type, scope_id, module_key);

comment on table public.module_feature_flags is
  'Explicit module enable or disable overrides. Missing rows inherit from the closest parent scope.';

create table if not exists public.administration_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references auth.users(id),
  actor_mode text not null,
  action text not null,
  record_type text not null,
  record_id uuid,
  target_user_id uuid references public.profiles(id),
  association_id uuid references public.associations(id),
  club_id uuid references public.clubs(id),
  team_id uuid references public.teams(id),
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);

create index if not exists administration_audit_actor_idx
  on public.administration_audit_log (actor_id, created_at desc);
create index if not exists administration_audit_target_idx
  on public.administration_audit_log (target_user_id, created_at desc);
create index if not exists administration_audit_scope_idx
  on public.administration_audit_log (association_id, club_id, team_id, created_at desc);

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
  batch_id uuid not null
    references public.administration_integrity_snapshot_batches(id) on delete restrict,
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

create table if not exists public.permission_catalogue (
  permission_key text primary key,
  module_key text not null,
  label text not null,
  description text not null,
  category text not null default 'MODULE',
  default_allowed boolean not null default false,
  created_at timestamptz not null default now(),
  constraint permission_catalogue_category_check
    check (category in ('MODULE', 'ACTION'))
);

create table if not exists public.permission_groups (
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
  constraint permission_groups_scope_check
    check (scope_type in ('ASSOCIATION', 'CLUB', 'DIVISION', 'TEAM')),
  constraint permission_groups_name_check
    check (length(btrim(name)) between 2 and 80)
);

create unique index if not exists permission_groups_active_name_key
  on public.permission_groups (scope_type, scope_id, lower(name))
  where active;

create table if not exists public.permission_group_members (
  group_id uuid not null references public.permission_groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  added_by uuid references public.profiles(id) on delete set null,
  added_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create index if not exists permission_group_members_user_idx
  on public.permission_group_members (user_id, group_id);

create table if not exists public.permission_sets (
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
  constraint permission_sets_scope_check
    check (owner_scope_type in ('ASSOCIATION', 'CLUB', 'DIVISION', 'TEAM')),
  constraint permission_sets_name_check
    check (length(btrim(name)) between 2 and 80)
);

create unique index if not exists permission_sets_active_name_key
  on public.permission_sets (owner_scope_type, owner_scope_id, lower(name))
  where active;

create table if not exists public.permission_set_permissions (
  permission_set_id uuid not null references public.permission_sets(id) on delete cascade,
  permission_key text not null references public.permission_catalogue(permission_key) on delete restrict,
  allowed boolean not null,
  primary key (permission_set_id, permission_key)
);

create table if not exists public.permission_assignments (
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
  constraint permission_assignments_subject_check
    check (subject_type in ('ROLE', 'GROUP', 'USER')),
  constraint permission_assignments_scope_check
    check (scope_type in ('ASSOCIATION', 'CLUB', 'DIVISION', 'TEAM'))
);

create unique index if not exists permission_assignments_active_key
  on public.permission_assignments (
    permission_set_id,
    subject_type,
    subject_key,
    scope_type,
    scope_id
  )
  where active;

create table if not exists public.permission_overrides (
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
  constraint permission_overrides_subject_check
    check (subject_type in ('ROLE', 'GROUP', 'USER')),
  constraint permission_overrides_scope_check
    check (scope_type in ('ASSOCIATION', 'CLUB', 'DIVISION', 'TEAM'))
);

create unique index if not exists permission_overrides_active_key
  on public.permission_overrides (
    permission_key,
    subject_type,
    subject_key,
    scope_type,
    scope_id
  )
  where active;

create sequence if not exists private.auth_session_permission_mode_revision_seq;

create table if not exists private.auth_session_permission_modes (
  session_id uuid not null references auth.sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  root_mode text not null check (
    root_mode in ('super_admin', 'association', 'club', 'team_manager', 'coach', 'player')
  ),
  active_mode text not null check (
    active_mode in ('super_admin', 'association', 'club', 'team_manager', 'coach', 'player')
  ),
  revision bigint not null,
  updated_at timestamptz not null default now(),
  association_id uuid references public.associations(id) on delete set null,
  club_id uuid references public.clubs(id) on delete set null,
  division_id uuid references public.divisions(id) on delete set null,
  team_id uuid references public.teams(id) on delete set null,
  primary key (session_id, user_id)
);

-- Lock the new foundation immediately. Existing Development objects retain
-- their already-tested grants and policies because this migration does not
-- change privileges or policies.
alter table public.module_feature_flags enable row level security;
alter table public.administration_audit_log enable row level security;
alter table public.administration_integrity_snapshot_batches enable row level security;
alter table public.administration_membership_integrity_snapshot enable row level security;
alter table public.permission_catalogue enable row level security;
alter table public.permission_groups enable row level security;
alter table public.permission_group_members enable row level security;
alter table public.permission_sets enable row level security;
alter table public.permission_set_permissions enable row level security;
alter table public.permission_assignments enable row level security;
alter table public.permission_overrides enable row level security;
alter table private.auth_session_permission_modes enable row level security;
alter table private.auth_session_permission_modes force row level security;

do $b1a_lockdown$
declare
  candidate record;
begin
  for candidate in select * from b1a_new_objects loop
    if candidate.object_type = 'table' then
      execute format(
        'revoke all on table %I.%I from public, anon, authenticated',
        candidate.schema_name,
        candidate.object_name
      );
    else
      execute format(
        'revoke all on sequence %I.%I from public, anon, authenticated',
        candidate.schema_name,
        candidate.object_name
      );
    end if;
  end loop;
end;
$b1a_lockdown$;

drop table pg_temp.b1a_new_objects;
