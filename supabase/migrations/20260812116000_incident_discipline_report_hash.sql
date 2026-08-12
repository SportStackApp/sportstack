-- The pgcrypto extension is installed in the extensions schema on Supabase.
-- Qualify digest because this security-definer function deliberately has an empty search path.

create or replace function public.sign_discipline_report(p_case_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor_id uuid := auth.uid();
  v_case public.discipline_cases%rowtype;
  v_snapshot jsonb;
  v_snapshot_id uuid;
  v_snapshot_number integer;
  v_override public.discipline_natural_justice_overrides%rowtype;
  v_missing_count integer;
begin
  if not private.discipline_has_case_role(p_case_id, array['LEAD_INVESTIGATOR']::text[], v_actor_id) then
    raise exception 'Only the Lead Investigator can sign the investigation report.';
  end if;
  select * into v_case from public.discipline_cases where id = p_case_id;
  if v_case.status <> 'FINDINGS' then raise exception 'The case must be at Findings before report sign-off.'; end if;
  if not exists (select 1 from public.discipline_findings where case_id = p_case_id) then
    raise exception 'Record allegation findings before report sign-off.';
  end if;
  select count(*) into v_missing_count
  from public.discipline_natural_justice_checks check_item
  where check_item.case_id = p_case_id and check_item.required and not check_item.completed;

  if v_missing_count > 0 then
    select * into v_override
    from public.discipline_natural_justice_overrides override_row
    where override_row.case_id = p_case_id and override_row.used_by_snapshot_id is null
    order by override_row.authorised_at desc
    limit 1;
    if v_override.id is null then
      raise exception 'Natural justice checks are incomplete and no Case Coordinator override is authorised.';
    end if;
  end if;

  select coalesce(max(snapshot_number), 0) + 1 into v_snapshot_number
  from public.discipline_report_snapshots where case_id = p_case_id;
  v_snapshot_id := gen_random_uuid();

  select jsonb_build_object(
    'case', to_jsonb(v_case),
    'rule_pack', (select to_jsonb(pack) from public.discipline_rule_packs pack where pack.id = v_case.rule_pack_id),
    'investigator_setup', (select to_jsonb(setup) from public.discipline_investigator_setups setup where setup.case_id = p_case_id order by setup.recorded_at desc limit 1),
    'allegations', coalesce((select jsonb_agg(to_jsonb(a) order by a.allegation_number) from public.discipline_allegations a where a.case_id = p_case_id), '[]'::jsonb),
    'classifications', coalesce((select jsonb_agg(to_jsonb(c) order by c.assessed_at) from public.discipline_classification_assessments c where c.case_id = p_case_id), '[]'::jsonb),
    'evidence_register', coalesce((select jsonb_agg(to_jsonb(e) - 'storage_path' - 'external_url' order by e.created_at) from public.discipline_evidence e where e.case_id = p_case_id), '[]'::jsonb),
    'natural_justice', coalesce((select jsonb_agg(to_jsonb(n) order by n.check_key) from public.discipline_natural_justice_checks n where n.case_id = p_case_id), '[]'::jsonb),
    'findings', coalesce((select jsonb_agg(to_jsonb(f) order by f.recorded_at) from public.discipline_findings f where f.case_id = p_case_id), '[]'::jsonb),
    'signed_at', now(),
    'signed_by', v_actor_id
  ) into v_snapshot;

  insert into public.discipline_report_snapshots (
    id, case_id, snapshot_number, report_data, natural_justice_override_reason,
    signed_by, sha256
  ) values (
    v_snapshot_id, p_case_id, v_snapshot_number, v_snapshot, v_override.reason, v_actor_id,
    encode(extensions.digest(convert_to(v_snapshot::text, 'UTF8'), 'sha256'), 'hex')
  );

  if v_override.id is not null then
    update public.discipline_natural_justice_overrides
    set used_by_snapshot_id = v_snapshot_id where id = v_override.id;
  end if;

  perform set_config('app.discipline_change_reason', 'Lead Investigation Officer signed report snapshot', true);
  perform set_config('app.discipline_actor_id', v_actor_id::text, true);
  update public.discipline_cases set status = 'REPORT_SIGNED', updated_by = v_actor_id where id = p_case_id;
  return v_snapshot_id;
end;
$function$;

revoke all on function public.sign_discipline_report(uuid) from public, anon;
grant execute on function public.sign_discipline_report(uuid) to authenticated;
