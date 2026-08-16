-- Give rapid append-only events a deterministic order. now() is stable for an
-- entire transaction, so timestamps alone cannot identify the latest event.

alter table public.discipline_evidence_status_events
  add column event_sequence bigint generated always as identity;

create unique index discipline_evidence_status_event_sequence_idx
  on public.discipline_evidence_status_events (event_sequence);

do $rewrite_status_event_order$
declare
  v_definition text;
begin
  select pg_get_functiondef(
    'public.record_discipline_evidence_status_event(uuid,text,uuid,text,text,text,boolean,boolean)'::regprocedure
  ) into v_definition;
  if position('order by event.recorded_at desc, event.id desc' in v_definition) = 0 then
    raise exception 'The evidence-status function ordering did not match the expected version.';
  end if;
  execute replace(
    v_definition,
    'order by event.recorded_at desc, event.id desc',
    'order by event.event_sequence desc'
  );
end;
$rewrite_status_event_order$;

do $rewrite_pending_guard_order$
declare
  v_definition text;
begin
  select pg_get_functiondef(
    'private.discipline_block_pending_evidence_finalisation()'::regprocedure
  ) into v_definition;
  if position(
    'event.recorded_at desc, event.id desc' in v_definition
  ) = 0 then
    raise exception 'The pending-evidence guard ordering did not match the expected version.';
  end if;
  execute replace(
    v_definition,
    'event.recorded_at desc, event.id desc',
    'event.event_sequence desc'
  );
end;
$rewrite_pending_guard_order$;
