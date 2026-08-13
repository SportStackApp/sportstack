-- Restore the authenticated policy-helper grant after replacing the function,
-- and cover each new foreign key used for case access and audit lookups.

grant execute on function private.discipline_can_read_case(uuid, uuid)
to authenticated;

create index discipline_tribunal_members_profile_idx
  on public.discipline_tribunal_members (profile_id)
  where profile_id is not null;
create index discipline_tribunal_members_created_by_idx
  on public.discipline_tribunal_members (created_by);
create index discipline_tribunal_members_updated_by_idx
  on public.discipline_tribunal_members (updated_by);
create index discipline_tribunal_preparations_created_by_idx
  on public.discipline_tribunal_preparations (created_by);
create index discipline_tribunal_preparations_updated_by_idx
  on public.discipline_tribunal_preparations (updated_by);
