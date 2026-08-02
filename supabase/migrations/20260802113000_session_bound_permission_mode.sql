-- Bind runtime module permissions to the caller's live Supabase Auth session.
-- A browser-supplied mode is not trusted until this migration validates and
-- stores it for that exact auth.sessions row.

create schema if not exists private;

create sequence if not exists private.auth_session_permission_mode_revision_seq;
revoke all on sequence private.auth_session_permission_mode_revision_seq
  from public, anon, authenticated;

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
  primary key (session_id, user_id)
);

alter table private.auth_session_permission_modes enable row level security;
alter table private.auth_session_permission_modes force row level security;
revoke all on table private.auth_session_permission_modes from public, anon, authenticated;

create or replace function public.get_active_permission_mode()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_session_id uuid;
begin
  if v_user_id is null then
    raise exception 'You must be signed in.';
  end if;

  begin
    v_session_id := nullif(auth.jwt()->>'session_id', '')::uuid;
  exception
    when invalid_text_representation then
      raise exception 'The current authentication session is not valid.';
  end;

  if v_session_id is null or not exists (
    select 1
    from auth.sessions session_row
    where session_row.id = v_session_id
      and session_row.user_id = v_user_id
      and (session_row.not_after is null or session_row.not_after > now())
  ) then
    raise exception 'The current authentication session is no longer active.';
  end if;

  return (
    select jsonb_build_object(
      'root_mode', mode_row.root_mode,
      'active_mode', mode_row.active_mode,
      'revision', mode_row.revision
    )
    from private.auth_session_permission_modes mode_row
    where mode_row.session_id = v_session_id
      and mode_row.user_id = v_user_id
  );
end;
$function$;

revoke all on function public.get_active_permission_mode()
  from public, anon, authenticated;
grant execute on function public.get_active_permission_mode()
  to authenticated;

create or replace function public.set_active_permission_mode(
  p_root_mode text,
  p_active_mode text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_session_id uuid;
  v_root_mode text;
  v_active_mode text;
  v_revision bigint;
  v_result jsonb;
begin
  if v_user_id is null then
    raise exception 'You must be signed in.';
  end if;

  begin
    v_session_id := nullif(auth.jwt()->>'session_id', '')::uuid;
  exception
    when invalid_text_representation then
      raise exception 'The current authentication session is not valid.';
  end;

  if v_session_id is null or not exists (
    select 1
    from auth.sessions session_row
    where session_row.id = v_session_id
      and session_row.user_id = v_user_id
      and (session_row.not_after is null or session_row.not_after > now())
  ) then
    raise exception 'The current authentication session is no longer active.';
  end if;

  if lower(trim(coalesce(p_root_mode, ''))) not in (
    'super_admin', 'association', 'club', 'team_manager', 'coach', 'player'
  ) or lower(trim(coalesce(p_active_mode, ''))) not in (
    'super_admin', 'association', 'club', 'team_manager', 'coach', 'player'
  ) then
    raise exception 'The selected mode is not recognised.';
  end if;

  -- Both values are revalidated against assigned account roles. Only a real
  -- Super Admin may keep Super Admin as the root while previewing a lower mode.
  v_root_mode := public.administration_effective_mode(lower(trim(p_root_mode)));
  v_active_mode := public.administration_effective_mode(lower(trim(p_active_mode)));

  if v_root_mode <> 'super_admin' and v_active_mode <> v_root_mode then
    raise exception 'The active mode must match the selected account mode.';
  end if;

  v_revision := nextval('private.auth_session_permission_mode_revision_seq'::regclass);

  insert into private.auth_session_permission_modes (
    session_id,
    user_id,
    root_mode,
    active_mode,
    revision,
    updated_at
  ) values (
    v_session_id,
    v_user_id,
    v_root_mode,
    v_active_mode,
    v_revision,
    now()
  )
  on conflict (session_id, user_id) do update
  set root_mode = excluded.root_mode,
      active_mode = excluded.active_mode,
      revision = excluded.revision,
      updated_at = excluded.updated_at
  where excluded.revision > private.auth_session_permission_modes.revision;

  select jsonb_build_object(
    'root_mode', mode_row.root_mode,
    'active_mode', mode_row.active_mode,
    'revision', mode_row.revision
  )
  into v_result
  from private.auth_session_permission_modes mode_row
  where mode_row.session_id = v_session_id
    and mode_row.user_id = v_user_id;

  return v_result;
end;
$function$;

revoke all on function public.set_active_permission_mode(text, text)
  from public, anon, authenticated;
grant execute on function public.set_active_permission_mode(text, text)
  to authenticated;

create or replace function private.module_allowed_for_current_session(
  p_module_key text,
  p_association_id uuid default null,
  p_club_id uuid default null,
  p_division_id uuid default null,
  p_team_id uuid default null
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_session_id uuid;
  v_mode text;
  v_result jsonb;
begin
  if v_user_id is null then
    return false;
  end if;

  begin
    v_session_id := nullif(auth.jwt()->>'session_id', '')::uuid;
  exception
    when invalid_text_representation then
      return false;
  end;

  if v_session_id is null then
    return false;
  end if;

  select mode_row.active_mode
  into v_mode
  from private.auth_session_permission_modes mode_row
  join auth.sessions session_row
    on session_row.id = mode_row.session_id
   and session_row.user_id = mode_row.user_id
  where mode_row.session_id = v_session_id
    and mode_row.user_id = v_user_id
    and (session_row.not_after is null or session_row.not_after > now());

  -- An authenticated request without a mode initialised for its current live
  -- session is deliberately denied. No account-level fallback is used.
  if v_mode is null then
    return false;
  end if;

  v_result := public.resolve_effective_permission_for_mode(
    'module.' || lower(trim(coalesce(p_module_key, ''))) || '.access',
    v_mode,
    p_association_id,
    p_club_id,
    p_division_id,
    p_team_id
  );

  return coalesce((v_result->>'allowed')::boolean, false);
exception
  -- Unknown modules, invalid cascades, stale roles and resolver failures all
  -- fail closed at the data boundary.
  when others then
    return false;
end;
$function$;

revoke all on function private.module_allowed_for_current_session(
  text, uuid, uuid, uuid, uuid
) from public, anon, authenticated;
grant usage on schema private to authenticated;
grant execute on function private.module_allowed_for_current_session(
  text, uuid, uuid, uuid, uuid
) to authenticated;

comment on table private.auth_session_permission_modes is
  'Private active permission mode for each live Supabase Auth session.';
comment on function public.get_active_permission_mode() is
  'Returns the signed-in caller canonical modes for the current live Auth session.';
comment on function public.set_active_permission_mode(text, text) is
  'Validates and stores the signed-in caller root and active modes for the current live Auth session.';
comment on function private.module_allowed_for_current_session(
  text, uuid, uuid, uuid, uuid
) is
  'Fail-closed module gate bound to auth.uid(), JWT session_id and the stored active session mode.';
