-- Add database checks for the full appealed branch and proved-charge closure.

create or replace function private.validate_discipline_phase2_stage_record()
returns trigger
language plpgsql
set search_path = ''
as $function$
declare
  v_charge_proved boolean := false;
begin
  if new.stage = 'APPEAL' and new.status = 'FINAL' and (
    length(btrim(coalesce(new.payload ->> 'panel_appointment_authority', ''))) < 3
    or length(btrim(coalesce(new.payload ->> 'panel_composition', ''))) < 10
    or not coalesce((new.payload ->> 'qualified_chair_confirmed')::boolean, false)
    or not coalesce((new.payload ->> 'panel_independence_confirmed')::boolean, false)
    or not coalesce((new.payload ->> 'affected_people_heard')::boolean, false)
    or not coalesce((new.payload ->> 'new_hearing_on_merits')::boolean, false)
    or length(btrim(coalesce(new.payload ->> 'appeal_majority_basis', ''))) < 10
  ) then
    raise exception 'Complete the Appeal Board appointment, independence, Chair, hearing and majority checks.';
  end if;

  if new.stage = 'CLOSURE' and new.status = 'CLOSED' then
    if length(btrim(coalesce(new.payload ->> 'decision_notice_reference', ''))) < 3 then
      raise exception 'Record the decision-notification reference before closure.';
    end if;
    select coalesce((record.payload ->> 'any_charge_proved')::boolean, false)
      into v_charge_proved
    from public.discipline_phase2_stage_records record
    where record.case_id = new.case_id
      and record.workflow_mode = new.workflow_mode
      and record.stage = 'DETERMINATION'
      and record.status = 'FINAL'
    order by record.revision_number desc limit 1;
    if coalesce(v_charge_proved, false) and (
      not coalesce((new.payload ->> 'sanctions_register_updated')::boolean, false)
      or length(btrim(coalesce(new.payload ->> 'administrative_fee_treatment', ''))) < 10
    ) then
      raise exception 'Record the sanction register and administrative-fee treatment for a proved charge.';
    end if;
  end if;
  return new;
end;
$function$;

revoke all on function private.validate_discipline_phase2_stage_record() from public, anon, authenticated;

create trigger discipline_phase2_stage_records_validate
before insert or update on public.discipline_phase2_stage_records
for each row execute function private.validate_discipline_phase2_stage_record();
