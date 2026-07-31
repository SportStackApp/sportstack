-- Committee polls, meeting templates/minutes, decisions/actions, private chat
-- and append-only activity history.

-- Scoped administrators can administer committee records, but voting and chat
-- always require a current appointment with the explicit position permission.
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
    (
      p_permission_key in (
        'manage_committee',
        'manage_members',
        'manage_documents',
        'manage_polls',
        'manage_meetings',
        'record_minutes'
      )
      and exists (
        select 1
        from public.committees committee
        where committee.id = p_committee_id
          and public.can_manage_committee_scope(
            p_user_id,
            committee.association_id,
            committee.club_id
          )
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

create table public.committee_polls (
  id uuid primary key default gen_random_uuid(),
  committee_id uuid not null references public.committees(id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'DRAFT',
  closes_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint committee_polls_title_not_blank check (btrim(title) <> ''),
  constraint committee_polls_status_check check (status in ('DRAFT', 'OPEN', 'CLOSED'))
);

create table public.committee_poll_questions (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.committee_polls(id) on delete cascade,
  prompt text not null,
  question_type text not null,
  options jsonb not null default '[]'::jsonb,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint committee_poll_questions_prompt_not_blank check (btrim(prompt) <> ''),
  constraint committee_poll_questions_type_check check (
    question_type in ('FREE_TEXT', 'SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'YES_NO_ABSTAIN')
  ),
  constraint committee_poll_questions_options_array check (jsonb_typeof(options) = 'array')
);

create table public.committee_poll_responses (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.committee_polls(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  submitted_at timestamptz not null default now(),
  constraint committee_poll_responses_one_per_user unique (poll_id, user_id)
);

create table public.committee_poll_answers (
  id uuid primary key default gen_random_uuid(),
  response_id uuid not null references public.committee_poll_responses(id) on delete cascade,
  question_id uuid not null references public.committee_poll_questions(id) on delete cascade,
  free_text text,
  selected_options jsonb not null default '[]'::jsonb,
  constraint committee_poll_answers_one_per_question unique (response_id, question_id),
  constraint committee_poll_answers_options_array check (jsonb_typeof(selected_options) = 'array')
);

create index committee_poll_questions_poll_idx
  on public.committee_poll_questions (poll_id, sort_order);
create index committee_poll_responses_poll_idx
  on public.committee_poll_responses (poll_id, submitted_at);

create table public.committee_agenda_templates (
  id uuid primary key default gen_random_uuid(),
  committee_id uuid not null references public.committees(id) on delete cascade,
  title text not null,
  description text,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint committee_agenda_templates_title_not_blank check (btrim(title) <> ''),
  constraint committee_agenda_templates_title_key unique (committee_id, title)
);

create table public.committee_agenda_template_items (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.committee_agenda_templates(id) on delete cascade,
  title text not null,
  notes_prompt text,
  presenter text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint committee_agenda_template_items_title_not_blank check (btrim(title) <> '')
);

create table public.committee_meetings (
  id uuid primary key default gen_random_uuid(),
  committee_id uuid not null references public.committees(id) on delete cascade,
  agenda_template_id uuid references public.committee_agenda_templates(id) on delete set null,
  title text not null,
  scheduled_at timestamptz not null,
  location text,
  status text not null default 'SCHEDULED',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint committee_meetings_title_not_blank check (btrim(title) <> ''),
  constraint committee_meetings_status_check check (status in ('DRAFT', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'))
);

create table public.committee_meeting_items (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.committee_meetings(id) on delete cascade,
  title text not null,
  agenda_notes text,
  presenter text,
  minutes text,
  decision text,
  action_text text,
  action_owner_id uuid references public.profiles(id) on delete set null,
  action_due_date date,
  linked_record_type text,
  linked_record_id uuid,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint committee_meeting_items_title_not_blank check (btrim(title) <> ''),
  constraint committee_meeting_items_link_type_check check (
    linked_record_type is null
    or linked_record_type in ('RISK', 'ACTION', 'QUALITY_IMPROVEMENT', 'BRIGHT_IDEA')
  )
);

create index committee_meeting_items_meeting_idx
  on public.committee_meeting_items (meeting_id, sort_order);

create table public.committee_messages (
  id uuid primary key default gen_random_uuid(),
  committee_id uuid not null references public.committees(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  reply_to_id uuid references public.committee_messages(id) on delete set null,
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  constraint committee_messages_body_not_blank check (btrim(body) <> ''),
  constraint committee_messages_body_length check (char_length(body) <= 4000)
);

create index committee_messages_committee_created_idx
  on public.committee_messages (committee_id, created_at desc);

create table public.committee_activity_log (
  id bigint generated always as identity primary key,
  committee_id uuid not null references public.committees(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  record_type text not null,
  record_id uuid,
  record_title text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index committee_activity_log_committee_idx
  on public.committee_activity_log (committee_id, created_at desc);

create or replace function public.create_committee_poll(
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
declare
  v_actor_id uuid := auth.uid();
  v_poll_id uuid;
  v_question jsonb;
  v_type text;
  v_options jsonb;
  v_order integer := 0;
begin
  if not public.has_committee_permission(p_committee_id, 'manage_polls', v_actor_id) then
    raise exception 'You do not have permission to create committee polls.';
  end if;
  if nullif(btrim(p_title), '') is null then
    raise exception 'Poll title is required.';
  end if;
  if p_status not in ('DRAFT', 'OPEN') then
    raise exception 'A new poll must be Draft or Open.';
  end if;
  if jsonb_typeof(p_questions) <> 'array' or jsonb_array_length(p_questions) = 0 then
    raise exception 'Add at least one poll question.';
  end if;

  insert into public.committee_polls (
    committee_id, title, description, status, closes_at, created_by
  ) values (
    p_committee_id,
    btrim(p_title),
    nullif(btrim(p_description), ''),
    p_status,
    p_closes_at,
    v_actor_id
  ) returning id into v_poll_id;

  for v_question in select value from jsonb_array_elements(p_questions)
  loop
    v_type := v_question ->> 'question_type';
    v_options := coalesce(v_question -> 'options', '[]'::jsonb);
    if nullif(btrim(v_question ->> 'prompt'), '') is null then
      raise exception 'Every poll question needs text.';
    end if;
    if v_type not in ('FREE_TEXT', 'SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'YES_NO_ABSTAIN') then
      raise exception 'Unknown poll question type.';
    end if;
    if v_type in ('SINGLE_CHOICE', 'MULTIPLE_CHOICE') then
      if jsonb_typeof(v_options) <> 'array' or jsonb_array_length(v_options) < 2 then
        raise exception 'Choice questions need at least two options.';
      end if;
      if exists (
        select 1 from jsonb_array_elements(v_options) option_value
        where jsonb_typeof(option_value) <> 'string'
          or nullif(btrim(option_value #>> '{}'), '') is null
      ) then
        raise exception 'Poll choices must be non-empty text.';
      end if;
    elsif v_type = 'YES_NO_ABSTAIN' then
      v_options := '["Yes", "No", "Abstain"]'::jsonb;
    else
      v_options := '[]'::jsonb;
    end if;

    insert into public.committee_poll_questions (
      poll_id, prompt, question_type, options, sort_order
    ) values (
      v_poll_id,
      btrim(v_question ->> 'prompt'),
      v_type,
      v_options,
      v_order
    );
    v_order := v_order + 1;
  end loop;

  return v_poll_id;
end;
$function$;

create or replace function public.submit_committee_poll_response(
  p_poll_id uuid,
  p_answers jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor_id uuid := auth.uid();
  v_poll public.committee_polls%rowtype;
  v_response_id uuid;
  v_question public.committee_poll_questions%rowtype;
  v_answer jsonb;
  v_selected jsonb;
  v_text text;
  v_answer_count integer;
begin
  select * into v_poll
  from public.committee_polls
  where id = p_poll_id
  for update;
  if not found then raise exception 'Committee poll not found.'; end if;
  if v_poll.status <> 'OPEN' then raise exception 'This committee poll is not open.'; end if;
  if v_poll.closes_at is not null and v_poll.closes_at <= now() then
    raise exception 'This committee poll has closed.';
  end if;
  if not public.has_committee_permission(v_poll.committee_id, 'vote', v_actor_id) then
    raise exception 'You do not have permission to vote in this committee poll.';
  end if;
  if jsonb_typeof(p_answers) <> 'array' then raise exception 'Poll answers must be a list.'; end if;

  select count(*) into v_answer_count from jsonb_array_elements(p_answers);
  if v_answer_count <> (select count(*) from public.committee_poll_questions where poll_id = p_poll_id) then
    raise exception 'Answer every poll question once.';
  end if;

  insert into public.committee_poll_responses (poll_id, user_id)
  values (p_poll_id, v_actor_id)
  returning id into v_response_id;

  for v_question in
    select * from public.committee_poll_questions where poll_id = p_poll_id order by sort_order
  loop
    select value into v_answer
    from jsonb_array_elements(p_answers)
    where value ->> 'question_id' = v_question.id::text;
    if v_answer is null then raise exception 'Answer every poll question once.'; end if;

    v_text := nullif(btrim(v_answer ->> 'free_text'), '');
    v_selected := coalesce(v_answer -> 'selected_options', '[]'::jsonb);
    if jsonb_typeof(v_selected) <> 'array' then raise exception 'Selected choices must be a list.'; end if;

    if v_question.question_type = 'FREE_TEXT' then
      if v_text is null then raise exception 'Free-text answers cannot be blank.'; end if;
      v_selected := '[]'::jsonb;
    elsif v_question.question_type in ('SINGLE_CHOICE', 'YES_NO_ABSTAIN') then
      if jsonb_array_length(v_selected) <> 1 then raise exception 'Choose one answer for each single-choice question.'; end if;
    elsif v_question.question_type = 'MULTIPLE_CHOICE' and jsonb_array_length(v_selected) = 0 then
      raise exception 'Choose at least one answer for each multiple-choice question.';
    end if;

    if v_question.question_type <> 'FREE_TEXT' and exists (
      select 1 from jsonb_array_elements(v_selected) selected_value
      where not (v_question.options @> jsonb_build_array(selected_value))
    ) then
      raise exception 'A selected poll choice is not valid for its question.';
    end if;

    insert into public.committee_poll_answers (
      response_id, question_id, free_text, selected_options
    ) values (
      v_response_id, v_question.id, v_text, v_selected
    );
  end loop;

  return v_response_id;
exception
  when unique_violation then
    raise exception 'You have already voted in this committee poll.';
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
    insert into public.committee_agenda_template_items (
      template_id, title, notes_prompt, presenter, sort_order
    ) values (
      v_template_id,
      btrim(v_item ->> 'title'),
      nullif(btrim(v_item ->> 'notes_prompt'), ''),
      nullif(btrim(v_item ->> 'presenter'), ''),
      v_order
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
    p_committee_id,
    p_template_id,
    btrim(p_title),
    p_scheduled_at,
    nullif(btrim(p_location), ''),
    v_actor_id
  ) returning id into v_meeting_id;

  insert into public.committee_meeting_items (
    meeting_id, title, agenda_notes, presenter, sort_order
  )
  select v_meeting_id, title, notes_prompt, presenter, sort_order
  from public.committee_agenda_template_items
  where template_id = p_template_id
  order by sort_order;

  return v_meeting_id;
end;
$function$;

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
  end if;

  if v_committee_id is not null then
    v_title := coalesce(v_row ->> 'title', v_row ->> 'body', v_row ->> 'action_text');
    insert into public.committee_activity_log (
      committee_id, actor_id, action, record_type, record_id, record_title, details
    ) values (
      v_committee_id,
      auth.uid(),
      tg_op,
      tg_table_name,
      v_record_id,
      left(v_title, 200),
      jsonb_build_object('changed_at', now())
    );
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$function$;

create trigger committee_activity_committees after insert or update on public.committees for each row execute function public.audit_committee_activity();
create trigger committee_activity_positions after insert or update on public.committee_positions for each row execute function public.audit_committee_activity();
create trigger committee_activity_members after insert or update on public.committee_members for each row execute function public.audit_committee_activity();
create trigger committee_activity_qualifications after insert or update on public.committee_member_qualifications for each row execute function public.audit_committee_activity();
create trigger committee_activity_documents after insert or update on public.committee_documents for each row execute function public.audit_committee_activity();
create trigger committee_activity_polls after insert or update on public.committee_polls for each row execute function public.audit_committee_activity();
create trigger committee_activity_poll_responses after insert on public.committee_poll_responses for each row execute function public.audit_committee_activity();
create trigger committee_activity_templates after insert or update on public.committee_agenda_templates for each row execute function public.audit_committee_activity();
create trigger committee_activity_meetings after insert or update on public.committee_meetings for each row execute function public.audit_committee_activity();
create trigger committee_activity_meeting_items after update on public.committee_meeting_items for each row execute function public.audit_committee_activity();
create trigger committee_activity_messages after insert or update on public.committee_messages for each row execute function public.audit_committee_activity();

create trigger committee_polls_set_updated_at before update on public.committee_polls for each row execute function public.set_committee_updated_at();
create trigger committee_templates_set_updated_at before update on public.committee_agenda_templates for each row execute function public.set_committee_updated_at();
create trigger committee_meetings_set_updated_at before update on public.committee_meetings for each row execute function public.set_committee_updated_at();
create trigger committee_meeting_items_set_updated_at before update on public.committee_meeting_items for each row execute function public.set_committee_updated_at();

alter table public.committee_polls enable row level security;
alter table public.committee_poll_questions enable row level security;
alter table public.committee_poll_responses enable row level security;
alter table public.committee_poll_answers enable row level security;
alter table public.committee_agenda_templates enable row level security;
alter table public.committee_agenda_template_items enable row level security;
alter table public.committee_meetings enable row level security;
alter table public.committee_meeting_items enable row level security;
alter table public.committee_messages enable row level security;
alter table public.committee_activity_log enable row level security;

create policy committee_polls_select on public.committee_polls for select to authenticated
using (public.can_view_committee(committee_id, (select auth.uid())));
create policy committee_polls_write on public.committee_polls for all to authenticated
using (public.has_committee_permission(committee_id, 'manage_polls', (select auth.uid())))
with check (public.has_committee_permission(committee_id, 'manage_polls', (select auth.uid())));

create policy committee_poll_questions_select on public.committee_poll_questions for select to authenticated
using (exists (select 1 from public.committee_polls poll where poll.id = poll_id and public.can_view_committee(poll.committee_id, (select auth.uid()))));
create policy committee_poll_questions_write on public.committee_poll_questions for all to authenticated
using (exists (select 1 from public.committee_polls poll where poll.id = poll_id and public.has_committee_permission(poll.committee_id, 'manage_polls', (select auth.uid()))))
with check (exists (select 1 from public.committee_polls poll where poll.id = poll_id and public.has_committee_permission(poll.committee_id, 'manage_polls', (select auth.uid()))));

create policy committee_poll_responses_select on public.committee_poll_responses for select to authenticated
using (user_id = (select auth.uid()) or exists (select 1 from public.committee_polls poll where poll.id = poll_id and public.has_committee_permission(poll.committee_id, 'manage_polls', (select auth.uid()))));
create policy committee_poll_answers_select on public.committee_poll_answers for select to authenticated
using (exists (select 1 from public.committee_poll_responses response where response.id = response_id and (response.user_id = (select auth.uid()) or exists (select 1 from public.committee_polls poll where poll.id = response.poll_id and public.has_committee_permission(poll.committee_id, 'manage_polls', (select auth.uid()))))));

create policy committee_templates_select on public.committee_agenda_templates for select to authenticated
using (public.can_view_committee(committee_id, (select auth.uid())));
create policy committee_templates_write on public.committee_agenda_templates for all to authenticated
using (public.has_committee_permission(committee_id, 'manage_meetings', (select auth.uid())))
with check (public.has_committee_permission(committee_id, 'manage_meetings', (select auth.uid())));
create policy committee_template_items_select on public.committee_agenda_template_items for select to authenticated
using (exists (select 1 from public.committee_agenda_templates template where template.id = template_id and public.can_view_committee(template.committee_id, (select auth.uid()))));
create policy committee_template_items_write on public.committee_agenda_template_items for all to authenticated
using (exists (select 1 from public.committee_agenda_templates template where template.id = template_id and public.has_committee_permission(template.committee_id, 'manage_meetings', (select auth.uid()))))
with check (exists (select 1 from public.committee_agenda_templates template where template.id = template_id and public.has_committee_permission(template.committee_id, 'manage_meetings', (select auth.uid()))));

create policy committee_meetings_select on public.committee_meetings for select to authenticated
using (public.can_view_committee(committee_id, (select auth.uid())));
create policy committee_meetings_write on public.committee_meetings for all to authenticated
using (public.has_committee_permission(committee_id, 'manage_meetings', (select auth.uid())))
with check (public.has_committee_permission(committee_id, 'manage_meetings', (select auth.uid())));
create policy committee_meeting_items_select on public.committee_meeting_items for select to authenticated
using (exists (select 1 from public.committee_meetings meeting where meeting.id = meeting_id and public.can_view_committee(meeting.committee_id, (select auth.uid()))));
create policy committee_meeting_items_write on public.committee_meeting_items for all to authenticated
using (exists (select 1 from public.committee_meetings meeting where meeting.id = meeting_id and (public.has_committee_permission(meeting.committee_id, 'manage_meetings', (select auth.uid())) or public.has_committee_permission(meeting.committee_id, 'record_minutes', (select auth.uid())))))
with check (exists (select 1 from public.committee_meetings meeting where meeting.id = meeting_id and (public.has_committee_permission(meeting.committee_id, 'manage_meetings', (select auth.uid())) or public.has_committee_permission(meeting.committee_id, 'record_minutes', (select auth.uid())))));

create policy committee_messages_select on public.committee_messages for select to authenticated
using (public.is_active_committee_member(committee_id, (select auth.uid())));
create policy committee_messages_insert on public.committee_messages for insert to authenticated
with check (user_id = (select auth.uid()) and public.has_committee_permission(committee_id, 'chat', (select auth.uid())));
create policy committee_messages_update on public.committee_messages for update to authenticated
using (user_id = (select auth.uid()) and public.has_committee_permission(committee_id, 'chat', (select auth.uid())))
with check (user_id = (select auth.uid()) and public.has_committee_permission(committee_id, 'chat', (select auth.uid())));

create policy committee_activity_select on public.committee_activity_log for select to authenticated
using (public.can_view_committee(committee_id, (select auth.uid())));

revoke all on table public.committee_polls, public.committee_poll_questions, public.committee_poll_responses, public.committee_poll_answers, public.committee_agenda_templates, public.committee_agenda_template_items, public.committee_meetings, public.committee_meeting_items, public.committee_messages, public.committee_activity_log from public, anon;
grant select, insert, update, delete on table public.committee_polls, public.committee_poll_questions, public.committee_agenda_templates, public.committee_agenda_template_items, public.committee_meetings, public.committee_meeting_items, public.committee_messages to authenticated;
grant select on table public.committee_poll_responses, public.committee_poll_answers, public.committee_activity_log to authenticated;
grant all on table public.committee_polls, public.committee_poll_questions, public.committee_poll_responses, public.committee_poll_answers, public.committee_agenda_templates, public.committee_agenda_template_items, public.committee_meetings, public.committee_meeting_items, public.committee_messages, public.committee_activity_log to service_role;

revoke all on function public.create_committee_poll(uuid, text, text, timestamptz, text, jsonb) from public, anon;
revoke all on function public.submit_committee_poll_response(uuid, jsonb) from public, anon;
revoke all on function public.create_committee_agenda_template(uuid, text, text, jsonb) from public, anon;
revoke all on function public.create_committee_meeting_from_template(uuid, uuid, text, timestamptz, text) from public, anon;
grant execute on function public.create_committee_poll(uuid, text, text, timestamptz, text, jsonb) to authenticated;
grant execute on function public.submit_committee_poll_response(uuid, jsonb) to authenticated;
grant execute on function public.create_committee_agenda_template(uuid, text, text, jsonb) to authenticated;
grant execute on function public.create_committee_meeting_from_template(uuid, uuid, text, timestamptz, text) to authenticated;

do $realtime$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'committee_messages'
  ) then
    alter publication supabase_realtime add table public.committee_messages;
  end if;
end;
$realtime$;

comment on table public.committee_activity_log is
  'Append-only activity history for committee setup, polls, meetings, minutes and chat.';
comment on table public.committee_messages is
  'Private chat visible only to current committee members; posting also requires the position chat permission.';
