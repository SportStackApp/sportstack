-- Complete the operational committee workspace without removing historical data.

alter table public.committee_agenda_template_items
  add column if not exists item_type text not null default 'POINT',
  add column if not exists include_open_actions boolean not null default false;

alter table public.committee_agenda_template_items
  drop constraint if exists committee_agenda_template_items_type_check;
alter table public.committee_agenda_template_items
  add constraint committee_agenda_template_items_type_check
  check (item_type in ('SECTION', 'POINT'));

alter table public.committee_meetings
  add column if not exists attendee_ids uuid[] not null default '{}'::uuid[],
  add column if not exists apology_ids uuid[] not null default '{}'::uuid[];

alter table public.committee_meeting_items
  add column if not exists item_type text not null default 'POINT',
  add column if not exists include_open_actions boolean not null default false;

alter table public.committee_meeting_items
  drop constraint if exists committee_meeting_items_type_check;
alter table public.committee_meeting_items
  add constraint committee_meeting_items_type_check
  check (item_type in ('SECTION', 'POINT'));

-- The original and later constraints used different QI labels. Keep the
-- established short label consistently for both legacy and new links.
alter table public.committee_meeting_items
  drop constraint if exists committee_meeting_items_link_type_check;
alter table public.committee_meeting_items
  drop constraint if exists committee_meeting_items_link_pair_check;
alter table public.committee_meeting_items
  add constraint committee_meeting_items_link_pair_check
  check (
    (linked_record_type is null and linked_record_id is null)
    or (
      linked_record_type in ('RISK', 'ACTION', 'QI', 'BRIGHT_IDEA')
      and linked_record_id is not null
    )
  );

create table if not exists public.committee_meeting_item_links (
  id uuid primary key default gen_random_uuid(),
  meeting_item_id uuid not null references public.committee_meeting_items(id) on delete cascade,
  record_type text not null,
  record_id uuid not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint committee_meeting_item_links_type_check
    check (record_type in ('RISK', 'ACTION', 'QI', 'BRIGHT_IDEA')),
  constraint committee_meeting_item_links_unique
    unique (meeting_item_id, record_type, record_id)
);

create index if not exists committee_meeting_item_links_item_idx
  on public.committee_meeting_item_links (meeting_item_id);
create index if not exists committee_meeting_item_links_record_idx
  on public.committee_meeting_item_links (record_type, record_id);

insert into public.committee_meeting_item_links (
  meeting_item_id, record_type, record_id, created_by
)
select item.id, item.linked_record_type, item.linked_record_id, meeting.created_by
from public.committee_meeting_items item
join public.committee_meetings meeting on meeting.id = item.meeting_id
where item.linked_record_type is not null
  and item.linked_record_id is not null
on conflict (meeting_item_id, record_type, record_id) do nothing;

create or replace function public.validate_committee_meeting_item_link()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_committee_association_id uuid;
  v_committee_club_id uuid;
  v_record_association_id uuid;
  v_record_club_id uuid;
begin
  select committee.association_id, committee.club_id
  into v_committee_association_id, v_committee_club_id
  from public.committee_meeting_items item
  join public.committee_meetings meeting on meeting.id = item.meeting_id
  join public.committees committee on committee.id = meeting.committee_id
  where item.id = new.meeting_item_id;

  if new.record_type = 'RISK' then
    select association_id, club_id into v_record_association_id, v_record_club_id
    from public.rg_risk_register where id = new.record_id;
  elsif new.record_type = 'ACTION' then
    select association_id, club_id into v_record_association_id, v_record_club_id
    from public.rg_be_smart_actions where id = new.record_id;
  elsif new.record_type = 'QI' then
    select association_id, club_id into v_record_association_id, v_record_club_id
    from public.rg_quality_improvement_items where id = new.record_id;
  elsif new.record_type = 'BRIGHT_IDEA' then
    select association_id, club_id into v_record_association_id, v_record_club_id
    from public.rg_bright_ideas where id = new.record_id;
  end if;

  if v_record_association_id is null then
    raise exception 'The selected Safety Hub record does not exist.';
  end if;
  if v_record_association_id is distinct from v_committee_association_id
     or (v_committee_club_id is not null and v_record_club_id is distinct from v_committee_club_id) then
    raise exception 'Committee decisions can only link to Safety Hub records in the same scope.';
  end if;
  return new;
end;
$function$;

drop trigger if exists committee_meeting_item_links_validate
  on public.committee_meeting_item_links;
create trigger committee_meeting_item_links_validate
before insert or update of meeting_item_id, record_type, record_id
on public.committee_meeting_item_links
for each row execute function public.validate_committee_meeting_item_link();

create or replace function public.set_committee_meeting_item_links(
  p_meeting_item_id uuid,
  p_links jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor_id uuid := auth.uid();
  v_committee_id uuid;
  v_link jsonb;
begin
  select meeting.committee_id into v_committee_id
  from public.committee_meeting_items item
  join public.committee_meetings meeting on meeting.id = item.meeting_id
  where item.id = p_meeting_item_id;

  if v_committee_id is null or not (
    public.has_committee_permission(v_committee_id, 'manage_meetings', v_actor_id)
    or public.has_committee_permission(v_committee_id, 'record_minutes', v_actor_id)
  ) then
    raise exception 'You do not have permission to change these meeting links.';
  end if;
  if p_links is null or jsonb_typeof(p_links) <> 'array' then
    raise exception 'Meeting links must be supplied as a list.';
  end if;

  delete from public.committee_meeting_item_links
  where meeting_item_id = p_meeting_item_id;

  for v_link in select value from jsonb_array_elements(p_links)
  loop
    insert into public.committee_meeting_item_links (
      meeting_item_id, record_type, record_id, created_by
    ) values (
      p_meeting_item_id,
      v_link ->> 'record_type',
      (v_link ->> 'record_id')::uuid,
      v_actor_id
    );
  end loop;
end;
$function$;

create or replace function public.get_committee_meeting_item_links(
  p_committee_id uuid
)
returns table (meeting_item_id uuid, record_type text, record_id uuid)
language sql
stable
security definer
set search_path = ''
as $function$
  select link.meeting_item_id, link.record_type, link.record_id
  from public.committee_meeting_item_links link
  join public.committee_meeting_items item on item.id = link.meeting_item_id
  join public.committee_meetings meeting on meeting.id = item.meeting_id
  where meeting.committee_id = p_committee_id
    and public.can_view_committee(p_committee_id, (select auth.uid()));
$function$;

create or replace function public.save_committee_meeting_attendance(
  p_meeting_id uuid,
  p_attendee_ids uuid[],
  p_apology_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor_id uuid := auth.uid();
  v_committee_id uuid;
begin
  select committee_id into v_committee_id
  from public.committee_meetings where id = p_meeting_id;
  if v_committee_id is null or not (
    public.has_committee_permission(v_committee_id, 'manage_meetings', v_actor_id)
    or public.has_committee_permission(v_committee_id, 'record_minutes', v_actor_id)
  ) then
    raise exception 'You do not have permission to update meeting attendance.';
  end if;
  if coalesce(p_attendee_ids, '{}'::uuid[]) && coalesce(p_apology_ids, '{}'::uuid[]) then
    raise exception 'A person cannot be both attending and an apology.';
  end if;

  update public.committee_meetings
  set attendee_ids = coalesce(p_attendee_ids, '{}'::uuid[]),
      apology_ids = coalesce(p_apology_ids, '{}'::uuid[])
  where id = p_meeting_id;
end;
$function$;

create or replace function public.create_committee_agenda_template(
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
declare
  v_actor_id uuid := auth.uid();
  v_template_id uuid;
  v_item jsonb;
  v_order integer := 0;
  v_item_type text;
begin
  if not public.has_committee_permission(p_committee_id, 'manage_meetings', v_actor_id) then
    raise exception 'You do not have permission to create agenda templates.';
  end if;
  if nullif(btrim(p_title), '') is null then raise exception 'Template title is required.'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Add at least one agenda item.';
  end if;

  insert into public.committee_agenda_templates (committee_id, title, description, created_by)
  values (p_committee_id, btrim(p_title), nullif(btrim(p_description), ''), v_actor_id)
  returning id into v_template_id;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    if nullif(btrim(v_item ->> 'title'), '') is null then raise exception 'Every agenda item needs a title.'; end if;
    v_item_type := coalesce(nullif(v_item ->> 'item_type', ''), 'POINT');
    if v_item_type not in ('SECTION', 'POINT') then raise exception 'Agenda item type is not valid.'; end if;
    insert into public.committee_agenda_template_items (
      template_id, title, notes_prompt, presenter, sort_order, item_type, include_open_actions
    ) values (
      v_template_id,
      btrim(v_item ->> 'title'),
      nullif(btrim(v_item ->> 'notes_prompt'), ''),
      nullif(btrim(v_item ->> 'presenter'), ''),
      v_order,
      v_item_type,
      coalesce((v_item ->> 'include_open_actions')::boolean, false)
    );
    v_order := v_order + 1;
  end loop;

  return v_template_id;
end;
$function$;

create or replace function public.create_committee_meeting_from_template(
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
declare
  v_actor_id uuid := auth.uid();
  v_meeting_id uuid;
begin
  if not public.has_committee_permission(p_committee_id, 'manage_meetings', v_actor_id) then
    raise exception 'You do not have permission to create committee meetings.';
  end if;
  if nullif(btrim(p_title), '') is null or p_scheduled_at is null then
    raise exception 'Meeting title and date/time are required.';
  end if;
  if not exists (
    select 1 from public.committee_agenda_templates
    where id = p_template_id and committee_id = p_committee_id and is_active
  ) then
    raise exception 'The selected agenda template is not active for this committee.';
  end if;

  insert into public.committee_meetings (
    committee_id, agenda_template_id, title, scheduled_at, location, created_by
  ) values (
    p_committee_id, p_template_id, btrim(p_title), p_scheduled_at,
    nullif(btrim(p_location), ''), v_actor_id
  ) returning id into v_meeting_id;

  insert into public.committee_meeting_items (
    meeting_id, title, agenda_notes, presenter, sort_order, item_type, include_open_actions
  )
  select v_meeting_id, title, notes_prompt, presenter, sort_order, item_type, include_open_actions
  from public.committee_agenda_template_items
  where template_id = p_template_id
  order by sort_order;

  return v_meeting_id;
end;
$function$;

alter table public.committee_meeting_item_links enable row level security;

create policy committee_meeting_item_links_select
on public.committee_meeting_item_links for select to authenticated
using (
  exists (
    select 1
    from public.committee_meeting_items item
    join public.committee_meetings meeting on meeting.id = item.meeting_id
    where item.id = meeting_item_id
      and public.can_view_committee(meeting.committee_id, (select auth.uid()))
  )
);

-- Mutations go through the scoped function so the complete replacement is atomic.

create or replace function public.audit_committee_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_row jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  v_committee_id uuid;
  v_title text;
  v_record_id uuid;
begin
  v_record_id := nullif(v_row ->> 'id', '')::uuid;
  if tg_table_name = 'committees' then
    v_committee_id := v_record_id;
  elsif v_row ? 'committee_id' then
    v_committee_id := nullif(v_row ->> 'committee_id', '')::uuid;
  elsif tg_table_name = 'committee_member_qualifications' then
    select committee_id into v_committee_id from public.committee_members
    where id = nullif(v_row ->> 'committee_member_id', '')::uuid;
  elsif tg_table_name = 'committee_poll_responses' then
    select committee_id into v_committee_id from public.committee_polls
    where id = nullif(v_row ->> 'poll_id', '')::uuid;
  elsif tg_table_name = 'committee_meeting_items' then
    select committee_id into v_committee_id from public.committee_meetings
    where id = nullif(v_row ->> 'meeting_id', '')::uuid;
  elsif tg_table_name = 'committee_meeting_item_links' then
    select meeting.committee_id into v_committee_id
    from public.committee_meeting_items item
    join public.committee_meetings meeting on meeting.id = item.meeting_id
    where item.id = nullif(v_row ->> 'meeting_item_id', '')::uuid;
  end if;

  if v_committee_id is not null then
    v_title := coalesce(v_row ->> 'title', v_row ->> 'body', v_row ->> 'action_text');
    insert into public.committee_activity_log (
      committee_id, actor_id, action, record_type, record_id, record_title, details
    ) values (
      v_committee_id, auth.uid(), tg_op, tg_table_name, v_record_id,
      left(v_title, 200), jsonb_build_object('changed_at', now(), 'record', v_row)
    );
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$function$;

drop trigger if exists committee_activity_meeting_item_links
  on public.committee_meeting_item_links;
create trigger committee_activity_meeting_item_links
after insert or update or delete on public.committee_meeting_item_links
for each row execute function public.audit_committee_activity();

-- Committee documents live in a private bucket. The first folder is always
-- the committee UUID, which makes the storage policy follow committee scope.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'committee-files',
  'committee-files',
  false,
  20971520,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'image/jpeg',
    'image/png'
  ]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

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
  select public.has_committee_permission(p_committee_id, 'manage_documents', p_user_id)
    or public.has_committee_permission(p_committee_id, 'manage_members', p_user_id)
    or exists (
      select 1 from public.committee_members member
      where member.committee_id = p_committee_id
        and member.user_id = p_user_id
        and member.start_date <= current_date
        and (member.end_date is null or member.end_date >= current_date)
    );
$function$;

create policy committee_files_select
on storage.objects for select to authenticated
using (
  bucket_id = 'committee-files'
  and public.can_view_committee(((storage.foldername(name))[1])::uuid, (select auth.uid()))
);

create policy committee_files_insert
on storage.objects for insert to authenticated
with check (
  bucket_id = 'committee-files'
  and public.can_upload_committee_file(((storage.foldername(name))[1])::uuid, (select auth.uid()))
);

create policy committee_files_update
on storage.objects for update to authenticated
using (
  bucket_id = 'committee-files'
  and public.can_upload_committee_file(((storage.foldername(name))[1])::uuid, (select auth.uid()))
)
with check (
  bucket_id = 'committee-files'
  and public.can_upload_committee_file(((storage.foldername(name))[1])::uuid, (select auth.uid()))
);

revoke all on table public.committee_meeting_item_links from public, anon;
grant select on table public.committee_meeting_item_links to authenticated;
grant all on table public.committee_meeting_item_links to service_role;

revoke all on function public.validate_committee_meeting_item_link() from public, anon, authenticated;
revoke all on function public.set_committee_meeting_item_links(uuid, jsonb) from public, anon;
revoke all on function public.get_committee_meeting_item_links(uuid) from public, anon;
revoke all on function public.save_committee_meeting_attendance(uuid, uuid[], uuid[]) from public, anon;
revoke all on function public.can_upload_committee_file(uuid, uuid) from public, anon;
grant execute on function public.set_committee_meeting_item_links(uuid, jsonb) to authenticated;
grant execute on function public.get_committee_meeting_item_links(uuid) to authenticated;
grant execute on function public.save_committee_meeting_attendance(uuid, uuid[], uuid[]) to authenticated;
grant execute on function public.can_upload_committee_file(uuid, uuid) to authenticated;
