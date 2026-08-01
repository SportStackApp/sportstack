-- Preserve every earlier message version so participants can verify what changed.
create table if not exists public.communication_message_revisions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.communication_messages(id) on delete cascade,
  revision_number integer not null,
  content text not null,
  edited_by uuid not null references auth.users(id),
  edited_at timestamptz not null default now(),
  unique (message_id, revision_number)
);

alter table public.communication_message_revisions enable row level security;

drop policy if exists "Participants can read message revisions" on public.communication_message_revisions;
create policy "Participants can read message revisions"
on public.communication_message_revisions
for select
to authenticated
using (
  exists (
    select 1
    from public.communication_messages message
    where message.id = communication_message_revisions.message_id
  )
);

create or replace function public.capture_communication_message_revision()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  next_revision integer;
begin
  if new.content is distinct from old.content then
    select coalesce(max(revision_number), 0) + 1
      into next_revision
      from public.communication_message_revisions
     where message_id = old.id;

    insert into public.communication_message_revisions (
      message_id,
      revision_number,
      content,
      edited_by,
      edited_at
    ) values (
      old.id,
      next_revision,
      old.content,
      auth.uid(),
      now()
    );

    new.edited_at := now();
  end if;

  return new;
end;
$$;

drop trigger if exists capture_communication_message_revision on public.communication_messages;
create trigger capture_communication_message_revision
before update of content on public.communication_messages
for each row
execute function public.capture_communication_message_revision();

create index if not exists communication_message_revisions_message_idx
  on public.communication_message_revisions (message_id, revision_number desc);
