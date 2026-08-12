-- Keep the initial reporter, reported person and first allegation in the same
-- transaction as case creation. This avoids partially-created intake records.

create or replace function public.create_discipline_case(p_intake jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor_id uuid := auth.uid();
  v_association_id uuid := nullif(p_intake ->> 'association_id', '')::uuid;
  v_rule_pack_id uuid := nullif(p_intake ->> 'rule_pack_id', '')::uuid;
  v_case_id uuid;
  v_case_number text;
  v_round_type text := coalesce(nullif(p_intake ->> 'round_type', ''), 'REGULAR');
  v_relevant_club_participating boolean := nullif(p_intake ->> 'relevant_club_participating', '')::boolean;
  v_jurisdiction text := coalesce(nullif(p_intake ->> 'jurisdiction_path', ''), 'UNASSESSED');
  v_immediate_risk boolean := coalesce((p_intake ->> 'immediate_safety_risk')::boolean, false);
  v_pathway text;
  v_status text := 'DRAFT';
  v_match_concluded_at timestamptz := nullif(p_intake ->> 'match_concluded_at', '')::timestamptz;
  v_reporter jsonb := coalesce(p_intake -> 'reporter', '{}'::jsonb);
  v_reported_person jsonb := coalesce(p_intake -> 'reported_person', '{}'::jsonb);
  v_allegation jsonb := coalesce(p_intake -> 'initial_allegation', '{}'::jsonb);
begin
  if v_actor_id is null then raise exception 'Sign in is required.'; end if;
  if v_association_id is null or not private.discipline_can_create_case(v_association_id, v_actor_id) then
    raise exception 'You do not have permission to create a discipline case for this association.';
  end if;
  if v_match_concluded_at is null then raise exception 'Match conclusion time is required.'; end if;
  if nullif(btrim(p_intake ->> 'title'), '') is null then raise exception 'Case title is required.'; end if;
  if v_round_type not in ('REGULAR', 'LAST_REGULAR', 'FINALS') then raise exception 'Round type is not valid.'; end if;
  if v_round_type <> 'REGULAR' and v_relevant_club_participating is null then
    raise exception 'Record whether the relevant club is participating in that competition.';
  end if;
  if v_jurisdiction not in (
    'UNASSESSED', 'COMPETITION_RULE_7', 'NIF_REFERRAL',
    'EXTERNAL_SAFETY_REFERRAL', 'OTHER_REFERRAL'
  ) then raise exception 'Jurisdiction path is not valid.'; end if;
  if v_immediate_risk and nullif(btrim(p_intake ->> 'immediate_safety_action'), '') is null then
    raise exception 'Record the immediate safety action taken.';
  end if;
  if nullif(btrim(v_allegation ->> 'title'), '') is not null
     and length(btrim(coalesce(v_allegation ->> 'description', ''))) < 5 then
    raise exception 'The initial allegation requires a description.';
  end if;

  if v_rule_pack_id is null then
    select pack.id into v_rule_pack_id
    from public.discipline_rule_packs pack
    where pack.association_id = v_association_id
      and pack.status in ('PUBLISHED', 'REVIEW_REQUIRED')
    order by case pack.status when 'PUBLISHED' then 0 else 1 end, pack.created_at desc
    limit 1;
  end if;
  if not exists (
    select 1 from public.discipline_rule_packs pack
    where pack.id = v_rule_pack_id and pack.association_id = v_association_id
  ) then raise exception 'An association rule pack is required.'; end if;

  if v_immediate_risk or v_jurisdiction in ('NIF_REFERRAL', 'EXTERNAL_SAFETY_REFERRAL', 'OTHER_REFERRAL') then
    v_pathway := 'EXTERNAL_REFERRAL';
    v_status := 'REFERRED';
  elsif v_jurisdiction = 'UNASSESSED' then
    v_pathway := 'REVIEW_REQUIRED';
  elsif v_round_type in ('LAST_REGULAR', 'FINALS') and v_relevant_club_participating then
    v_pathway := 'DIRECT_TRIBUNAL';
  else
    v_pathway := 'REGULAR';
  end if;

  v_case_number := format(
    'HB-DIS-%s-%s',
    extract(year from (v_match_concluded_at at time zone 'Australia/Melbourne'))::integer,
    lpad(nextval('public.discipline_case_number_seq')::text, 4, '0')
  );

  perform set_config('app.discipline_change_reason', 'Initial case creation', true);
  perform set_config('app.discipline_actor_id', v_actor_id::text, true);

  insert into public.discipline_cases (
    case_number, association_id, rule_pack_id, status, title,
    jurisdiction_path, jurisdiction_reason, immediate_safety_risk,
    immediate_safety_action, fixture_id, safety_record_id, committee_id,
    competition, grade, round_label, round_type, relevant_club_participating,
    first_named_team, second_named_team, match_concluded_at, incident_at,
    venue, incident_location, report_received_at, report_method,
    report_in_writing, prescribed_form_used, report_complete,
    desired_outcome_included, prior_presentation_completed,
    pathway, created_by, updated_by
  ) values (
    v_case_number, v_association_id, v_rule_pack_id, v_status, btrim(p_intake ->> 'title'),
    v_jurisdiction, nullif(btrim(p_intake ->> 'jurisdiction_reason'), ''), v_immediate_risk,
    nullif(btrim(p_intake ->> 'immediate_safety_action'), ''),
    nullif(p_intake ->> 'fixture_id', '')::uuid,
    nullif(p_intake ->> 'safety_record_id', '')::uuid,
    nullif(p_intake ->> 'committee_id', '')::uuid,
    nullif(btrim(p_intake ->> 'competition'), ''), nullif(btrim(p_intake ->> 'grade'), ''),
    nullif(btrim(p_intake ->> 'round_label'), ''), v_round_type, v_relevant_club_participating,
    nullif(btrim(p_intake ->> 'first_named_team'), ''), nullif(btrim(p_intake ->> 'second_named_team'), ''),
    v_match_concluded_at, nullif(p_intake ->> 'incident_at', '')::timestamptz,
    nullif(btrim(p_intake ->> 'venue'), ''), nullif(btrim(p_intake ->> 'incident_location'), ''),
    nullif(p_intake ->> 'report_received_at', '')::timestamptz,
    nullif(btrim(p_intake ->> 'report_method'), ''),
    nullif(p_intake ->> 'report_in_writing', '')::boolean,
    nullif(p_intake ->> 'prescribed_form_used', '')::boolean,
    nullif(p_intake ->> 'report_complete', '')::boolean,
    nullif(p_intake ->> 'desired_outcome_included', '')::boolean,
    nullif(p_intake ->> 'prior_presentation_completed', '')::boolean,
    v_pathway, v_actor_id, v_actor_id
  ) returning id into v_case_id;

  insert into public.discipline_case_members (
    case_id, user_id, case_role, assignment_reason, assigned_by
  ) values (
    v_case_id, v_actor_id, 'CASE_COORDINATOR', 'Automatically assigned as case creator.', v_actor_id
  );

  if nullif(btrim(v_reporter ->> 'full_name'), '') is not null then
    insert into public.discipline_case_people (
      case_id, case_role, full_name, organisation, person_role, email, phone,
      is_junior, notes, created_by, updated_by
    ) values (
      v_case_id, 'REPORTER', btrim(v_reporter ->> 'full_name'),
      nullif(btrim(v_reporter ->> 'organisation'), ''), nullif(btrim(v_reporter ->> 'person_role'), ''),
      nullif(btrim(v_reporter ->> 'email'), ''), nullif(btrim(v_reporter ->> 'phone'), ''),
      nullif(v_reporter ->> 'is_junior', '')::boolean, nullif(btrim(v_reporter ->> 'notes'), ''),
      v_actor_id, v_actor_id
    );
  end if;

  if nullif(btrim(v_reported_person ->> 'full_name'), '') is not null then
    insert into public.discipline_case_people (
      case_id, case_role, full_name, organisation, person_role, email, phone,
      is_junior, notes, created_by, updated_by
    ) values (
      v_case_id, 'REPORTED_PERSON', btrim(v_reported_person ->> 'full_name'),
      nullif(btrim(v_reported_person ->> 'organisation'), ''), nullif(btrim(v_reported_person ->> 'person_role'), ''),
      nullif(btrim(v_reported_person ->> 'email'), ''), nullif(btrim(v_reported_person ->> 'phone'), ''),
      nullif(v_reported_person ->> 'is_junior', '')::boolean, nullif(btrim(v_reported_person ->> 'notes'), ''),
      v_actor_id, v_actor_id
    );
  end if;

  if nullif(btrim(v_allegation ->> 'title'), '') is not null then
    insert into public.discipline_allegations (
      case_id, allegation_number, title, description, incident_at, location,
      created_by, updated_by
    ) values (
      v_case_id, 1, btrim(v_allegation ->> 'title'), btrim(v_allegation ->> 'description'),
      nullif(v_allegation ->> 'incident_at', '')::timestamptz,
      nullif(btrim(v_allegation ->> 'location'), ''), v_actor_id, v_actor_id
    );
  end if;

  insert into public.discipline_natural_justice_checks (case_id, check_key, label)
  values
    (v_case_id, 'allegations_particularised', 'Every allegation and sufficient particulars were provided.'),
    (v_case_id, 'evidence_identified', 'Evidence relied upon was identified or provided.'),
    (v_case_id, 'response_opportunity', 'A reasonable opportunity to respond was provided.'),
    (v_case_id, 'response_received_or_noted', 'The response received, or the absence of a response, was recorded.'),
    (v_case_id, 'investigator_independence', 'Investigator independence and conflicts were checked.'),
    (v_case_id, 'changes_put_to_person', 'Any new allegation or changed classification was put before reliance.');

  if v_pathway in ('REGULAR', 'DIRECT_TRIBUNAL') then
    perform private.discipline_initialise_deadlines(
      v_case_id, v_actor_id, 'Initial calculation when the case was created.'
    );
  end if;

  return v_case_id;
end;
$function$;

insert into public.discipline_natural_justice_checks (case_id, check_key, label)
select incident_case.id, 'response_received_or_noted',
  'The response received, or the absence of a response, was recorded.'
from public.discipline_cases incident_case
on conflict (case_id, check_key) do nothing;

revoke all on function public.create_discipline_case(jsonb) from public, anon;
grant execute on function public.create_discipline_case(jsonb) to authenticated;
