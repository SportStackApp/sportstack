-- A confirmed Coordination duty owns the fixture availability value until the
-- assignment is replaced, cancelled, completed or moved to reconfirmation.

create or replace function private.coordination_guard_available_status()
returns trigger
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_fixture_id uuid:=case when tg_op='DELETE' then old.fixture_id else new.fixture_id end;
  v_user_id uuid:=case when tg_op='DELETE' then old.user_id else new.user_id end;
  v_expected_status public.availability_status_enum;
  v_window record;
begin
  select case
    when pt.code in ('UMPIRE','SUPERVISING_UMPIRE') then 'UMPIRING'::public.availability_status_enum
    when pt.code='TECHNICAL_BENCH' then 'TECHNICAL_BENCH'::public.availability_status_enum
    else 'VOLUNTEERING'::public.availability_status_enum
  end
  into v_expected_status
  from public.coordination_assignments a
  join public.coordination_positions p on p.id=a.position_id
  join public.coordination_position_types pt on pt.id=p.position_type_id
  where p.fixture_id=v_fixture_id
    and a.assigned_user_id=v_user_id
    and a.status in ('CONFIRMED','REPLACEMENT_REQUESTED','DISPUTED')
  order by case when pt.code in ('UMPIRE','SUPERVISING_UMPIRE') then 1 else 2 end
  limit 1;

  if v_expected_status is not null then
    if tg_op='DELETE' or new.status<>v_expected_status then
      raise exception 'Confirmed Coordination availability can only change through the assignment workflow.';
    end if;
    return new;
  end if;

  if tg_op='DELETE' then
    return old;
  end if;

  if new.status in ('UMPIRING','TECHNICAL_BENCH','VOLUNTEERING') then
    raise exception 'A Coordination availability status requires a matching confirmed assignment.';
  end if;

  if new.status='AVAILABLE' then
    select * into v_window from private.coordination_fixture_window(new.fixture_id);
    if found and exists(
      select 1
      from public.coordination_assignments a
      where a.assigned_user_id=new.user_id
        and a.status in ('CONFIRMED','RECONFIRMATION_REQUIRED','REPLACEMENT_REQUESTED','DISPUTED')
        and tstzrange(a.starts_at,a.ends_at,'[)') && tstzrange(v_window.starts_at,v_window.ends_at,'[)')
    ) then
      raise exception 'Availability cannot be marked Available over a confirmed Coordination duty.';
    end if;
  end if;

  return new;
end;
$function$;

drop trigger if exists coordination_guard_available_status on public.fixture_availability;
create trigger coordination_guard_available_status
before insert or update of status or delete on public.fixture_availability
for each row execute function private.coordination_guard_available_status();
