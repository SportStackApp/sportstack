-- Enforce session-bound module access at the Committee Management and Safety
-- Hub data boundaries. This migration depends on 20260802113500.

create schema if not exists private;

-- Committee and Safety records are commonly scoped only to an association or
-- club. Lower active modes must still be evaluated through one of the caller's
-- real descendant teams, rather than being trusted at a broader scope.
create or replace function private.module_allowed_in_accessible_scope_for_current_session(
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
  v_root_mode text;
  v_mode text;
  v_stored_association_id uuid;
  v_stored_club_id uuid;
  v_stored_division_id uuid;
  v_stored_team_id uuid;
  v_requested_association_id uuid;
  v_requested_club_id uuid;
  v_requested_division_id uuid;
  v_requested_team_id uuid;
  v_use_stored_scope boolean;
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

  select
    mode_row.root_mode,
    mode_row.active_mode,
    mode_row.association_id,
    mode_row.club_id,
    mode_row.division_id,
    mode_row.team_id
  into
    v_root_mode,
    v_mode,
    v_stored_association_id,
    v_stored_club_id,
    v_stored_division_id,
    v_stored_team_id
  from private.auth_session_permission_modes mode_row
  join auth.sessions session_row
    on session_row.id = mode_row.session_id
   and session_row.user_id = mode_row.user_id
  where mode_row.session_id = v_session_id
    and mode_row.user_id = v_user_id
    and (session_row.not_after is null or session_row.not_after > now());

  if v_mode is null then
    return false;
  end if;

  select
    scope.association_id,
    scope.club_id,
    scope.division_id,
    scope.team_id
  into
    v_requested_association_id,
    v_requested_club_id,
    v_requested_division_id,
    v_requested_team_id
  from private.permission_context_canonical_scope(
    p_association_id,
    p_club_id,
    p_division_id,
    p_team_id
  ) scope;

  -- Global records are intentionally available only in a real Super Admin
  -- mode. Never derive an organisation merely because one is accessible.
  if v_requested_association_id is null
     and v_requested_club_id is null
     and v_requested_division_id is null
     and v_requested_team_id is null then
    if v_mode <> 'super_admin' then
      return false;
    end if;
    return private.module_allowed_for_current_session(
      p_module_key, null, null, null, null
    );
  end if;

  -- True Super Admin mode may inspect any explicit organisation scope. A
  -- Super Admin previewing another mode stays bound to the stored cascade.
  if v_root_mode = 'super_admin'
     and v_mode = 'super_admin'
     and public.is_super_admin() then
    return private.module_allowed_for_current_session(
      p_module_key,
      v_requested_association_id,
      v_requested_club_id,
      v_requested_division_id,
      v_requested_team_id
    );
  end if;

  if v_stored_association_id is null then
    return false;
  end if;

  -- Prove the requested record is inside the active mode boundary. Parent
  -- records are allowed only when they contain the stored cascade. Descendant
  -- records remain available to Association and Club administrators inside
  -- their selected organisation. Sibling scopes always fail closed.
  if v_mode = 'association' then
    if v_requested_association_id is distinct from v_stored_association_id then
      return false;
    end if;
  elsif v_mode = 'club' then
    if v_requested_association_id is distinct from v_stored_association_id
       or (
         v_requested_club_id is not null
         and v_requested_club_id is distinct from v_stored_club_id
       ) then
      return false;
    end if;
  elsif v_mode in ('team_manager', 'coach', 'player') then
    if v_requested_association_id is distinct from v_stored_association_id
       or (
         v_requested_club_id is not null
         and v_requested_club_id is distinct from v_stored_club_id
       )
       or (
         v_requested_division_id is not null
         and v_requested_division_id is distinct from v_stored_division_id
       )
       or (
         v_requested_team_id is not null
         and v_requested_team_id is distinct from v_stored_team_id
       ) then
      return false;
    end if;
  else
    return false;
  end if;

  -- If the record is an ancestor of the current cascade, evaluate the module
  -- at the stored deepest scope so a child deny still wins. If the record is a
  -- different descendant inside an administrator boundary, evaluate that
  -- explicit record scope instead.
  v_use_stored_scope :=
    (v_requested_association_id is null or v_requested_association_id = v_stored_association_id)
    and (v_requested_club_id is null or v_requested_club_id = v_stored_club_id)
    and (v_requested_division_id is null or v_requested_division_id = v_stored_division_id)
    and (v_requested_team_id is null or v_requested_team_id = v_stored_team_id);

  return private.module_allowed_for_current_session(
    p_module_key,
    case when v_use_stored_scope then v_stored_association_id else v_requested_association_id end,
    case when v_use_stored_scope then v_stored_club_id else v_requested_club_id end,
    case when v_use_stored_scope then v_stored_division_id else v_requested_division_id end,
    case when v_use_stored_scope then v_stored_team_id else v_requested_team_id end
  );
exception
  when others then
    return false;
end;
$function$;

revoke all on function private.module_allowed_in_accessible_scope_for_current_session(
  text, uuid, uuid, uuid, uuid
) from public, anon, authenticated;

comment on function private.module_allowed_in_accessible_scope_for_current_session(
  text, uuid, uuid, uuid, uuid
) is
  'Fail-closed module check that derives only a real scope available in the caller active session mode.';

-- Global Safety Hub guidance is inherited by lower administrator modes, but
-- its module decision must still be resolved at the server-validated selected
-- scope. This also lets a real Super Admin preview Association or Club mode
-- without needing a duplicate lower-role row.
create or replace function private.module_allowed_in_stored_scope_for_current_session(
  p_module_key text
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
  v_root_mode text;
  v_mode text;
  v_association_id uuid;
  v_club_id uuid;
  v_division_id uuid;
  v_team_id uuid;
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

  select
    mode_row.root_mode,
    mode_row.active_mode,
    mode_row.association_id,
    mode_row.club_id,
    mode_row.division_id,
    mode_row.team_id
  into
    v_root_mode,
    v_mode,
    v_association_id,
    v_club_id,
    v_division_id,
    v_team_id
  from private.auth_session_permission_modes mode_row
  join auth.sessions session_row
    on session_row.id = mode_row.session_id
   and session_row.user_id = mode_row.user_id
  where mode_row.session_id = v_session_id
    and mode_row.user_id = v_user_id
    and (session_row.not_after is null or session_row.not_after > now());

  if v_mode is null then
    return false;
  end if;

  if v_root_mode = 'super_admin'
     and v_mode = 'super_admin'
     and public.is_super_admin() then
    return private.module_allowed_for_current_session(
      p_module_key, null, null, null, null
    );
  end if;

  if v_association_id is null then
    return false;
  end if;

  return private.module_allowed_for_current_session(
    p_module_key,
    v_association_id,
    v_club_id,
    v_division_id,
    v_team_id
  );
exception
  when others then
    return false;
end;
$function$;

revoke all on function private.module_allowed_in_stored_scope_for_current_session(text)
  from public, anon, authenticated;

-- Role rows on an account are cumulative, but authorisation must use only the
-- role currently selected for this exact live Auth session. Keeping this lookup
-- private prevents callers from supplying a more privileged mode to an RLS
-- helper.
create or replace function private.active_permission_mode_for_current_session()
returns text
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_session_id uuid;
  v_mode text;
begin
  if v_user_id is null then
    return null;
  end if;

  begin
    v_session_id := nullif(auth.jwt()->>'session_id', '')::uuid;
  exception
    when invalid_text_representation then
      return null;
  end;

  if v_session_id is null then
    return null;
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

  return v_mode;
end;
$function$;

revoke all on function private.active_permission_mode_for_current_session()
  from public, anon, authenticated;

comment on function private.active_permission_mode_for_current_session() is
  'Returns the server-stored active mode for the caller current live Auth session, or NULL when unavailable.';

-- ---------------------------------------------------------------------------
-- Committee Management central helpers. Existing RLS and Storage policies
-- call these functions, so one fail-closed gate protects every normal table
-- and committee-files path.
-- ---------------------------------------------------------------------------

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
    and p_user_id = (select auth.uid())
    and private.module_allowed_in_accessible_scope_for_current_session(
      'committee', p_association_id, p_club_id, null, null
    )
    and exists (
      select 1
      from public.user_roles role_row
      where role_row.user_id = p_user_id
        and (
          (
            private.active_permission_mode_for_current_session() = 'super_admin'
            and role_row.role::text = 'SUPER_ADMIN'
          )
          or (
            private.active_permission_mode_for_current_session() = 'association'
            and (
              (
                role_row.role::text = 'ASSOCIATION_ADMIN'
                and role_row.association_id = p_association_id
              )
              or role_row.role::text = 'SUPER_ADMIN'
            )
          )
          or (
            private.active_permission_mode_for_current_session() = 'club'
            and p_club_id is not null
            and (
              (
                role_row.role::text = 'CLUB_ADMIN'
                and role_row.club_id = p_club_id
              )
              or role_row.role::text = 'SUPER_ADMIN'
            )
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
    and p_user_id = (select auth.uid())
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
        and private.module_allowed_in_accessible_scope_for_current_session(
          'committee', committee.association_id, committee.club_id, null, null
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
            and public.can_manage_committee_scope(
              p_user_id,
              committee.association_id,
              committee.club_id
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
        )
    );
$function$;

create or replace function public.can_upload_committee_file(
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
      where committee.id = p_committee_id
        and private.module_allowed_in_accessible_scope_for_current_session(
          'committee', committee.association_id, committee.club_id, null, null
        )
        and (
          public.has_committee_permission(
            p_committee_id, 'manage_documents', p_user_id
          )
          or public.has_committee_permission(
            p_committee_id, 'manage_members', p_user_id
          )
          or public.is_active_committee_member(p_committee_id, p_user_id)
        )
    );
$function$;

-- These original policies contained owner-only branches that did not call a
-- central Committee helper. Require module-aware committee visibility first.
drop policy if exists committee_qualifications_write
  on public.committee_member_qualifications;
create policy committee_qualifications_write
on public.committee_member_qualifications for all to authenticated
using (
  exists (
    select 1
    from public.committee_members member_row
    where member_row.id = committee_member_id
      and public.can_view_committee(
        member_row.committee_id, (select auth.uid())
      )
      and (
        member_row.user_id = (select auth.uid())
        or public.has_committee_permission(
          member_row.committee_id, 'manage_members', (select auth.uid())
        )
      )
  )
)
with check (
  exists (
    select 1
    from public.committee_members member_row
    where member_row.id = committee_member_id
      and public.can_view_committee(
        member_row.committee_id, (select auth.uid())
      )
      and (
        member_row.user_id = (select auth.uid())
        or public.has_committee_permission(
          member_row.committee_id, 'manage_members', (select auth.uid())
        )
      )
  )
);

drop policy if exists committee_poll_responses_select
  on public.committee_poll_responses;
create policy committee_poll_responses_select
on public.committee_poll_responses for select to authenticated
using (
  exists (
    select 1
    from public.committee_polls poll
    where poll.id = poll_id
      and public.can_view_committee(poll.committee_id, (select auth.uid()))
      and (
        user_id = (select auth.uid())
        or public.has_committee_permission(
          poll.committee_id, 'manage_polls', (select auth.uid())
        )
      )
  )
);

drop policy if exists committee_poll_answers_select
  on public.committee_poll_answers;
create policy committee_poll_answers_select
on public.committee_poll_answers for select to authenticated
using (
  exists (
    select 1
    from public.committee_poll_responses response
    join public.committee_polls poll on poll.id = response.poll_id
    where response.id = response_id
      and public.can_view_committee(poll.committee_id, (select auth.uid()))
      and (
        response.user_id = (select auth.uid())
        or public.has_committee_permission(
          poll.committee_id, 'manage_polls', (select auth.uid())
        )
      )
  )
);

-- ---------------------------------------------------------------------------
-- Defence in depth for browser-callable Committee SECURITY DEFINER writes.
-- The existing winning implementations are retained under private-by-grant
-- implementation names; public signatures become guarded wrappers.
-- ---------------------------------------------------------------------------

create or replace function private.assert_committee_module_allowed(
  p_committee_id uuid
)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_allowed boolean;
begin
  select private.module_allowed_in_accessible_scope_for_current_session(
    'committee', committee.association_id, committee.club_id, null, null
  )
  into v_allowed
  from public.committees committee
  where committee.id = p_committee_id;

  if not coalesce(v_allowed, false) then
    raise exception using
      errcode = '42501',
      message = 'Committee Management is not available in the active mode and scope.';
  end if;
end;
$function$;

create or replace function private.assert_committee_poll_module_allowed(
  p_poll_id uuid
)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_committee_id uuid;
begin
  select poll.committee_id into v_committee_id
  from public.committee_polls poll
  where poll.id = p_poll_id;

  perform private.assert_committee_module_allowed(v_committee_id);
end;
$function$;

create or replace function private.assert_committee_meeting_module_allowed(
  p_meeting_id uuid
)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_committee_id uuid;
begin
  select meeting.committee_id into v_committee_id
  from public.committee_meetings meeting
  where meeting.id = p_meeting_id;

  perform private.assert_committee_module_allowed(v_committee_id);
end;
$function$;

create or replace function private.assert_committee_meeting_item_module_allowed(
  p_meeting_item_id uuid
)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_committee_id uuid;
begin
  select meeting.committee_id into v_committee_id
  from public.committee_meeting_items item
  join public.committee_meetings meeting on meeting.id = item.meeting_id
  where item.id = p_meeting_item_id;

  perform private.assert_committee_module_allowed(v_committee_id);
end;
$function$;

revoke all on function private.assert_committee_module_allowed(uuid)
  from public, anon, authenticated;
revoke all on function private.assert_committee_poll_module_allowed(uuid)
  from public, anon, authenticated;
revoke all on function private.assert_committee_meeting_module_allowed(uuid)
  from public, anon, authenticated;
revoke all on function private.assert_committee_meeting_item_module_allowed(uuid)
  from public, anon, authenticated;

alter function public.create_committee_poll(
  uuid, text, text, timestamptz, text, jsonb
) rename to create_committee_poll_module_impl;
alter function public.submit_committee_poll_response(uuid, jsonb)
  rename to submit_committee_poll_response_module_impl;
alter function public.create_committee_agenda_template(uuid, text, text, jsonb)
  rename to create_committee_agenda_template_module_impl;
alter function public.create_committee_meeting_from_template(
  uuid, uuid, text, timestamptz, text
) rename to create_committee_meeting_from_template_module_impl;
alter function public.set_committee_meeting_item_links(uuid, jsonb)
  rename to set_committee_meeting_item_links_module_impl;
alter function public.save_committee_meeting_attendance(uuid, uuid[], uuid[])
  rename to save_committee_meeting_attendance_module_impl;

revoke all on function public.create_committee_poll_module_impl(
  uuid, text, text, timestamptz, text, jsonb
) from public, anon, authenticated;
revoke all on function public.submit_committee_poll_response_module_impl(uuid, jsonb)
  from public, anon, authenticated;
revoke all on function public.create_committee_agenda_template_module_impl(
  uuid, text, text, jsonb
) from public, anon, authenticated;
revoke all on function public.create_committee_meeting_from_template_module_impl(
  uuid, uuid, text, timestamptz, text
) from public, anon, authenticated;
revoke all on function public.set_committee_meeting_item_links_module_impl(uuid, jsonb)
  from public, anon, authenticated;
revoke all on function public.save_committee_meeting_attendance_module_impl(
  uuid, uuid[], uuid[]
) from public, anon, authenticated;

create function public.create_committee_poll(
  p_committee_id uuid,
  p_title text,
  p_description text,
  p_closes_at timestamptz,
  p_status text,
  p_questions jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
begin
  perform private.assert_committee_module_allowed(p_committee_id);
  return public.create_committee_poll_module_impl(
    p_committee_id, p_title, p_description, p_closes_at, p_status, p_questions
  );
end;
$function$;

create function public.submit_committee_poll_response(
  p_poll_id uuid,
  p_answers jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
begin
  perform private.assert_committee_poll_module_allowed(p_poll_id);
  return public.submit_committee_poll_response_module_impl(p_poll_id, p_answers);
end;
$function$;

create function public.create_committee_agenda_template(
  p_committee_id uuid,
  p_title text,
  p_description text,
  p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
begin
  perform private.assert_committee_module_allowed(p_committee_id);
  return public.create_committee_agenda_template_module_impl(
    p_committee_id, p_title, p_description, p_items
  );
end;
$function$;

create function public.create_committee_meeting_from_template(
  p_committee_id uuid,
  p_template_id uuid,
  p_title text,
  p_scheduled_at timestamptz,
  p_location text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
begin
  perform private.assert_committee_module_allowed(p_committee_id);
  return public.create_committee_meeting_from_template_module_impl(
    p_committee_id, p_template_id, p_title, p_scheduled_at, p_location
  );
end;
$function$;

create function public.set_committee_meeting_item_links(
  p_meeting_item_id uuid,
  p_links jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
begin
  perform private.assert_committee_meeting_item_module_allowed(p_meeting_item_id);
  perform public.set_committee_meeting_item_links_module_impl(
    p_meeting_item_id, p_links
  );
end;
$function$;

create function public.save_committee_meeting_attendance(
  p_meeting_id uuid,
  p_attendee_ids uuid[],
  p_apology_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
begin
  perform private.assert_committee_meeting_module_allowed(p_meeting_id);
  perform public.save_committee_meeting_attendance_module_impl(
    p_meeting_id, p_attendee_ids, p_apology_ids
  );
end;
$function$;

revoke all on function public.create_committee_poll(
  uuid, text, text, timestamptz, text, jsonb
) from public, anon;
revoke all on function public.submit_committee_poll_response(uuid, jsonb)
  from public, anon;
revoke all on function public.create_committee_agenda_template(
  uuid, text, text, jsonb
) from public, anon;
revoke all on function public.create_committee_meeting_from_template(
  uuid, uuid, text, timestamptz, text
) from public, anon;
revoke all on function public.set_committee_meeting_item_links(uuid, jsonb)
  from public, anon;
revoke all on function public.save_committee_meeting_attendance(
  uuid, uuid[], uuid[]
) from public, anon;

grant execute on function public.create_committee_poll(
  uuid, text, text, timestamptz, text, jsonb
) to authenticated;
grant execute on function public.submit_committee_poll_response(uuid, jsonb)
  to authenticated;
grant execute on function public.create_committee_agenda_template(
  uuid, text, text, jsonb
) to authenticated;
grant execute on function public.create_committee_meeting_from_template(
  uuid, uuid, text, timestamptz, text
) to authenticated;
grant execute on function public.set_committee_meeting_item_links(uuid, jsonb)
  to authenticated;
grant execute on function public.save_committee_meeting_attendance(
  uuid, uuid[], uuid[]
) to authenticated;

-- ---------------------------------------------------------------------------
-- Safety Hub central RLS helpers. Safety write RPCs are SECURITY INVOKER, so
-- these module-aware policies remain the write boundary as well as the read
-- boundary.
-- ---------------------------------------------------------------------------

create or replace function private.rg_is_safety_admin()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $function$
  select private.module_allowed_in_accessible_scope_for_current_session(
    'safety_risk', null, null, null, null
  )
  and exists (
    select 1
    from public.user_roles role_row
    where role_row.user_id = (select auth.uid())
      and role_row.role::text = 'SUPER_ADMIN'
  );
$function$;

create or replace function private.rg_can_read_scope(
  p_association_id uuid,
  p_club_id uuid,
  p_team_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $function$
  select private.module_allowed_in_accessible_scope_for_current_session(
    'safety_risk', p_association_id, p_club_id, null, p_team_id
  )
  and exists (
    select 1
    from public.user_roles role_row
    left join public.clubs admin_club on admin_club.id = role_row.club_id
    where role_row.user_id = (select auth.uid())
      and (
        (
          private.active_permission_mode_for_current_session() = 'super_admin'
          and role_row.role::text = 'SUPER_ADMIN'
        )
        or (
          private.active_permission_mode_for_current_session() = 'association'
          and (
            (
              role_row.role::text = 'ASSOCIATION_ADMIN'
              and role_row.association_id = p_association_id
            )
            or role_row.role::text = 'SUPER_ADMIN'
          )
        )
        or (
          private.active_permission_mode_for_current_session() = 'club'
          and (
            (
              role_row.role::text = 'CLUB_ADMIN'
              and (
                role_row.club_id = p_club_id
                or (
                  p_club_id is null
                  and admin_club.association_id = p_association_id
                )
              )
            )
            or role_row.role::text = 'SUPER_ADMIN'
          )
        )
      )
  );
$function$;

create or replace function private.rg_can_manage_scope(
  p_association_id uuid,
  p_club_id uuid,
  p_team_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $function$
  select private.module_allowed_in_accessible_scope_for_current_session(
    'safety_risk', p_association_id, p_club_id, null, p_team_id
  )
  and exists (
    select 1
    from public.user_roles role_row
    where role_row.user_id = (select auth.uid())
      and (
        (
          private.active_permission_mode_for_current_session() = 'super_admin'
          and role_row.role::text = 'SUPER_ADMIN'
        )
        or (
          private.active_permission_mode_for_current_session() = 'association'
          and (
            (
              role_row.role::text = 'ASSOCIATION_ADMIN'
              and role_row.association_id = p_association_id
            )
            or role_row.role::text = 'SUPER_ADMIN'
          )
        )
        or (
          private.active_permission_mode_for_current_session() = 'club'
          and p_club_id is not null
          and (
            (
              role_row.role::text = 'CLUB_ADMIN'
              and role_row.club_id = p_club_id
            )
            or role_row.role::text = 'SUPER_ADMIN'
          )
        )
      )
  );
$function$;

create or replace function private.rg_can_read_settings(
  p_settings_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $function$
  select exists (
    select 1
    from public.rg_risk_settings settings
    where settings.id = p_settings_id
      and (
        (
          settings.scope_level <> 'GLOBAL'
          and private.rg_can_read_scope(
            settings.association_id,
            case when settings.scope_level = 'CLUB' then settings.club_id else null end,
            null
          )
        )
        or (
          settings.scope_level = 'GLOBAL'
          and (
            private.rg_is_safety_admin()
            or (
              private.active_permission_mode_for_current_session() in ('association', 'club')
              and private.module_allowed_in_stored_scope_for_current_session(
                'safety_risk'
              )
            )
          )
        )
        )
  );
$function$;

create or replace function private.rg_can_manage_settings(
  p_settings_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $function$
  select exists (
    select 1
    from public.rg_risk_settings settings
    where settings.id = p_settings_id
      and (
        (
          settings.scope_level = 'GLOBAL'
          and private.rg_is_safety_admin()
        )
        or (
          settings.scope_level <> 'GLOBAL'
          and private.rg_can_manage_scope(
            settings.association_id,
            case when settings.scope_level = 'CLUB' then settings.club_id else null end,
            null
          )
        )
      )
  );
$function$;

revoke all on function private.rg_is_safety_admin()
  from public, anon, authenticated;
revoke all on function private.rg_can_read_scope(uuid, uuid, uuid)
  from public, anon, authenticated;
revoke all on function private.rg_can_manage_scope(uuid, uuid, uuid)
  from public, anon, authenticated;
revoke all on function private.rg_can_read_settings(uuid)
  from public, anon, authenticated;
revoke all on function private.rg_can_manage_settings(uuid)
  from public, anon, authenticated;

grant execute on function private.rg_is_safety_admin()
  to authenticated;
grant execute on function private.rg_can_read_scope(uuid, uuid, uuid)
  to authenticated;
grant execute on function private.rg_can_manage_scope(uuid, uuid, uuid)
  to authenticated;
grant execute on function private.rg_can_read_settings(uuid)
  to authenticated;
grant execute on function private.rg_can_manage_settings(uuid)
  to authenticated;

comment on function private.rg_is_safety_admin() is
  'Global Safety Hub check, restricted to an enabled real Super Admin session mode.';
comment on function private.rg_can_read_scope(uuid, uuid, uuid) is
  'Safety Hub scope read check with session-bound module enforcement.';
comment on function private.rg_can_manage_scope(uuid, uuid, uuid) is
  'Safety Hub scope management check with session-bound module enforcement.';
comment on function private.rg_can_read_settings(uuid) is
  'Safety Hub settings read check with session-bound module enforcement.';
comment on function private.rg_can_manage_settings(uuid) is
  'Safety Hub settings management check with session-bound module enforcement.';
