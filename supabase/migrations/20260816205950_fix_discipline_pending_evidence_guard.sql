-- Keep the shared pending-withdrawal guard compatible with both guarded tables.
-- The report snapshot row has no stage or status fields.

create or replace function private.discipline_block_pending_evidence_finalisation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_case_id uuid := new.case_id;
begin
  if tg_table_name = 'discipline_phase2_stage_records' then
    if not (new.stage = 'DETERMINATION' and new.status = 'FINAL') then
      return new;
    end if;
  end if;

  if exists (
    select 1
    from (
      select distinct on (event.target_type, coalesce(event.evidence_id, event.witness_id))
        event.status
      from public.discipline_evidence_status_events event
      where event.case_id = v_case_id
      order by event.target_type, coalesce(event.evidence_id, event.witness_id),
        event.recorded_at desc, event.id desc
    ) latest
    where latest.status = 'WITHDRAWAL_REQUESTED'
  ) then
    raise exception 'Resolve each pending evidence withdrawal request before finalising the report or Tribunal determination.';
  end if;
  return new;
end;
$function$;

revoke all on function private.discipline_block_pending_evidence_finalisation()
from public, anon, authenticated;
