-- Meeting decisions can link to Safety Hub records, but only within the
-- committee's organisation scope and only to a real supported record.
alter table public.committee_meeting_items
  add constraint committee_meeting_items_link_pair_check
  check (
    (linked_record_type is null and linked_record_id is null)
    or (
      linked_record_type in ('RISK', 'ACTION', 'QI', 'BRIGHT_IDEA')
      and linked_record_id is not null
    )
  );

create index committee_meeting_items_linked_record_idx
  on public.committee_meeting_items (linked_record_type, linked_record_id)
  where linked_record_id is not null;

create or replace function public.validate_committee_meeting_safety_link()
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
  if new.linked_record_id is null then return new; end if;

  select committee.association_id, committee.club_id
  into v_committee_association_id, v_committee_club_id
  from public.committee_meetings meeting
  join public.committees committee on committee.id = meeting.committee_id
  where meeting.id = new.meeting_id;

  if new.linked_record_type = 'RISK' then
    select association_id, club_id into v_record_association_id, v_record_club_id
    from public.rg_risk_register where id = new.linked_record_id;
  elsif new.linked_record_type = 'ACTION' then
    select association_id, club_id into v_record_association_id, v_record_club_id
    from public.rg_be_smart_actions where id = new.linked_record_id;
  elsif new.linked_record_type = 'QI' then
    select association_id, club_id into v_record_association_id, v_record_club_id
    from public.rg_quality_improvement_items where id = new.linked_record_id;
  elsif new.linked_record_type = 'BRIGHT_IDEA' then
    select association_id, club_id into v_record_association_id, v_record_club_id
    from public.rg_bright_ideas where id = new.linked_record_id;
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

create trigger committee_meeting_items_validate_safety_link
before insert or update of meeting_id, linked_record_type, linked_record_id
on public.committee_meeting_items
for each row execute function public.validate_committee_meeting_safety_link();

revoke all on function public.validate_committee_meeting_safety_link()
  from public, anon, authenticated;
