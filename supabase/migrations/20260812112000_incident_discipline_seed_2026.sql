-- Verified 2026 source material for Hockey Ballarat. The rule pack is kept in
-- REVIEW_REQUIRED until Hockey Ballarat approves the recorded local choices.

do $seed_discipline_2026$
declare
  v_association_id uuid;
  v_rule_pack_id uuid;
  v_hv_rules_url text := 'https://cdn.revolutionise.com.au/cups/vichockey/files/tuqrabulv5ovd3og.pdf';
  v_hv_schedules_url text := 'https://cdn.revolutionise.com.au/cups/vichockey/files/jnpjob9q1ytyxveo.pdf';
  v_hv_form_url text := 'https://cdn.revolutionise.com.au/cups/vichockey/files/qwitffhsg8wpy0lk.docx';
  v_hb_addendum_url text := 'https://www.hockeyballarat.com.au/uploads/1/4/8/3/148316959/hb_by-law_addendum_2026.pdf';
  v_nif_url text := 'https://www.hockeyballarat.com.au/uploads/1/4/8/3/148316959/de3wntx1qsqupsyp.pdf';
begin
  select id into v_association_id
  from public.associations
  where lower(name) = 'hockey ballarat'
  limit 1;
  if v_association_id is null then
    raise exception 'Hockey Ballarat association was not found; the discipline rule pack was not seeded.';
  end if;

  insert into public.module_feature_flags (
    module_key, scope_type, scope_id, enabled, association_id, notes
  ) values (
    'incident_discipline', 'ASSOCIATION', v_association_id, true, v_association_id,
    'Phase 1 Dev module. Case content still requires explicit assignment.'
  )
  on conflict (module_key, scope_type, scope_id) do update set
    enabled = excluded.enabled,
    association_id = excluded.association_id,
    notes = excluded.notes,
    updated_at = now();

  insert into public.discipline_rule_packs (
    association_id, code, title, version, status, timezone,
    source_manifest, approval_notes, effective_from
  ) values (
    v_association_id,
    'HB_HV_2026',
    'Hockey Ballarat / Hockey Victoria 2026',
    '2026.1-review',
    'REVIEW_REQUIRED',
    'Australia/Melbourne',
    jsonb_build_array(
      jsonb_build_object(
        'document', 'Hockey Ballarat Local By-Law Addendum 2026',
        'url', v_hb_addendum_url,
        'sha256', 'fe9791a976758bb78bd1631405b17358db6f5b3d88c6a2a35cb0138bee4e1d05',
        'checked_on', '2026-08-12'
      ),
      jsonb_build_object(
        'document', 'Hockey Victoria Competition Rules 2026',
        'url', v_hv_rules_url,
        'sha256', '92654e41812679cb3f1e6243b0b3ec5a2a594b89680f73b60f52c1a97bde7910',
        'checked_on', '2026-08-12'
      ),
      jsonb_build_object(
        'document', 'Hockey Victoria Competition Regulations 2026',
        'url', 'https://cdn.revolutionise.com.au/cups/vichockey/files/bkbdi3qf9bpigpaf.pdf',
        'sha256', 'f93e1e4de2725783fca0248ca265c1854474e5761ce6e7c075befdbd10fb5b1d',
        'checked_on', '2026-08-12'
      ),
      jsonb_build_object(
        'document', 'Hockey Victoria Competition Schedules 2026',
        'url', v_hv_schedules_url,
        'sha256', '19897ff337c9d411e7fd0645bc3f7b4f81ffc829f9e142e675a4dbf554e1a02f',
        'checked_on', '2026-08-12'
      ),
      jsonb_build_object(
        'document', 'Hockey Victoria Incident Report Form',
        'url', v_hv_form_url,
        'sha256', '8a0d83c4c6c385c1e5e7163016658383eb5b1866f87a42a0c898fb9dca24f117',
        'checked_on', '2026-08-12'
      ),
      jsonb_build_object(
        'document', 'Hockey Australia Complaints, Disputes and Discipline Policy',
        'url', v_nif_url,
        'sha256', 'bee72d81a8912f558a523fc021b501f3d4e9ecc5c135bb47bee2528f820471c4',
        'checked_on', '2026-08-12',
        'warning', 'Still linked by Hockey Ballarat, but the document review date was July 2025.'
      )
    ),
    'HB approval is still required for the business-day interpretation and local-variation register.',
    date '2026-03-01'
  )
  on conflict (association_id, code, version) do update set
    title = excluded.title,
    status = excluded.status,
    timezone = excluded.timezone,
    source_manifest = excluded.source_manifest,
    approval_notes = excluded.approval_notes,
    effective_from = excluded.effective_from
  returning id into v_rule_pack_id;

  delete from public.discipline_rule_clauses where rule_pack_id = v_rule_pack_id;
  insert into public.discipline_rule_clauses (
    rule_pack_id, reference, title, verified_summary, source_url,
    source_page, item_type, source_status, sort_order
  ) values
    (v_rule_pack_id, 'HB 2.1', 'HB administration', 'The Hockey Ballarat Committee executes the addendum and may administer a specific case.', v_hb_addendum_url, 1, 'RULE', 'VERIFIED', 10),
    (v_rule_pack_id, 'HB 3.1', 'Adoption of HV documents', 'HB follows the latest HV Rules, Regulations and Schedules subject to HB local changes; HV is read as HB insofar as practicable.', v_hb_addendum_url, 1, 'RULE', 'VERIFIED', 20),
    (v_rule_pack_id, 'HB 7.1', 'HB no-fine approach for clubs', 'HB does not fine clubs; it works with the club on a solution and identifies premiership points as an effective penalty where required.', v_hb_addendum_url, 3, 'RULE', 'VERIFIED', 30),
    (v_rule_pack_id, 'HV 7.1', 'Report and finals condition', 'A complete written report uses the prescribed form and is due by the applicable time. Direct finals timing also requires the relevant club to be participating in that competition.', v_hv_rules_url, 27, 'RULE', 'VERIFIED', 40),
    (v_rule_pack_id, 'HV 7.2', 'Other credible matters', 'HB may investigate another relevant matter supported by a club report, another report or credible evidence, and may dismiss a vexatious matter.', v_hv_rules_url, 27, 'RULE', 'VERIFIED', 50),
    (v_rule_pack_id, 'HV 7.7', 'Available investigation outcomes', 'Available pathways include penalty guidance, Tribunal, mediation, a combination, no action or another appropriate course.', v_hv_rules_url, 28, 'RULE', 'VERIFIED', 60),
    (v_rule_pack_id, 'HV 7.9', 'Penalty considerations', 'Human decision factors include seriousness, loss or damage, reputation, disciplinary history and preventative action.', v_hv_rules_url, 28, 'RULE', 'VERIFIED', 70),
    (v_rule_pack_id, 'HV 7.11', 'Early guilty plea', 'An early guilty plea is time-limited and may affect investigation and penalty. The 2026 sequencing needs local operating confirmation.', v_hv_rules_url, 29, 'SOURCE_AMBIGUITY', 'REVIEW_REQUIRED', 80),
    (v_rule_pack_id, 'HV 7.12', 'Investigation Officer', 'The investigator may be internal or independent external, must be conflict-free and appropriately experienced, and recommends action under Rule 7.7.', v_hv_rules_url, 29, 'RULE', 'VERIFIED', 90),
    (v_rule_pack_id, 'HV 7.15', 'Mediation', 'Mediation is without prejudice, the mediator does not decide the matter, and a resolution must be recorded in a signed written agreement.', v_hv_rules_url, 30, 'RULE', 'VERIFIED', 100),
    (v_rule_pack_id, 'HV Schedule 1 cl 4.1', 'Investigation and discipline timelines', 'The Schedule sets separate regular-round and qualifying last-round/finals deadlines.', v_hv_schedules_url, 19, 'RULE', 'VERIFIED', 110),
    (v_rule_pack_id, 'HV Schedule 1 cl 4.2', 'Misconduct Penalty System', 'The Schedule lists classification-based guidance and whether a charge is immediately referred to a Tribunal.', v_hv_schedules_url, 19, 'RULE', 'VERIFIED', 120),
    (v_rule_pack_id, 'HV Schedule 2 cl 13', 'Incident Report Form', 'The form records reporter, match, allegation, witnesses, events, injuries and a mandatory desired outcome, and warns that the report is shared with relevant parties.', v_hv_schedules_url, 36, 'RULE', 'VERIFIED', 130),
    (v_rule_pack_id, 'NIF 6.7', 'Jurisdiction', 'Safeguarding or discrimination matters may be managed through Sport Integrity Australia or Hockey Australia; competition-rule matters are not managed by Sport Integrity Australia.', v_nif_url, 12, 'RULE', 'REVIEW_REQUIRED', 140),
    (v_rule_pack_id, 'NIF 7.1-7.2', 'Triage and case categorisation', 'A human determines scope and pathway. Immediate child-safety risk is reported externally as soon as possible.', v_nif_url, 14, 'RULE', 'REVIEW_REQUIRED', 150),
    (v_rule_pack_id, 'NIF 7.5-7.6', 'Procedural fairness and proof', 'Where the NIF policy applies, parties receive a reasonable opportunity to be heard and substantive decisions use the balance of probabilities.', v_nif_url, 15, 'RULE', 'REVIEW_REQUIRED', 160),
    (v_rule_pack_id, 'HB LOCAL BUSINESS DAY', 'Business-day calculation', 'Weekends and configured HB exclusions are skipped. This interpretation is not defined in the checked HV documents and still requires HB approval.', v_hv_schedules_url, 19, 'LOCAL_INTERPRETATION', 'REVIEW_REQUIRED', 170),
    (v_rule_pack_id, 'SOURCE CONFLICT - CONTEMPT', 'Contempt amount conflict', 'The linked form shows $250 while the 2026 Schedules show $500. The Schedules figure is retained with a visible warning.', v_hv_schedules_url, 21, 'SOURCE_AMBIGUITY', 'CONFLICT', 180);

  delete from public.discipline_deadline_definitions where rule_pack_id = v_rule_pack_id;
  insert into public.discipline_deadline_definitions (
    rule_pack_id, pathway, action_key, label, business_day_number,
    due_local_time, rule_reference, sort_order
  ) values
    (v_rule_pack_id, 'REGULAR', 'REPORT_DUE', 'Report submitted', 2, time '13:00', 'HV Rule 7.1; Schedule 1 cl 4.1', 10),
    (v_rule_pack_id, 'REGULAR', 'INVESTIGATOR_APPOINTED', 'Investigation Officer appointed', 3, time '10:00', 'Schedule 1 cl 4.1', 20),
    (v_rule_pack_id, 'REGULAR', 'AFFECTED_PARTIES_NOTIFIED', 'Affected parties notified', 3, time '10:00', 'Schedule 1 cl 4.1', 30),
    (v_rule_pack_id, 'REGULAR', 'INVESTIGATION_COMPLETED', 'Investigation completed', 7, time '12:00', 'Schedule 1 cl 4.1', 40),
    (v_rule_pack_id, 'REGULAR', 'OUTCOME_NOTIFIED', 'Outcome notified', 7, time '17:00', 'Schedule 1 cl 4.1', 50),
    (v_rule_pack_id, 'DIRECT_TRIBUNAL', 'REPORT_DUE', 'Report submitted', 1, time '11:00', 'HV Rule 7.1; Schedule 1 cl 4.1', 10),
    (v_rule_pack_id, 'DIRECT_TRIBUNAL', 'TRIBUNAL_REFERRAL', 'Charge referred to Tribunal', 2, time '10:00', 'Schedule 1 cl 4.1', 20),
    (v_rule_pack_id, 'DIRECT_TRIBUNAL', 'AFFECTED_PARTIES_NOTIFIED', 'Affected parties notified', 2, time '10:00', 'Schedule 1 cl 4.1', 30),
    (v_rule_pack_id, 'DIRECT_TRIBUNAL', 'TRIBUNAL_COMPLETED', 'Tribunal completed', 4, time '12:00', 'Schedule 1 cl 4.1', 40),
    (v_rule_pack_id, 'DIRECT_TRIBUNAL', 'OUTCOME_NOTIFIED', 'Outcome notified', 4, time '17:00', 'Schedule 1 cl 4.1', 50);

  delete from public.discipline_classification_rules where rule_pack_id = v_rule_pack_id;

  -- Language Level 1.
  insert into public.discipline_classification_rules (
    rule_pack_id, classification_code, label, criteria, person_category,
    recommended_penalty_value, recommended_penalty_unit, recommended_penalty_text,
    tribunal_required, rule_reference, priority
  ) values (
    v_rule_pack_id, 'LANGUAGE_L1', 'Language Level 1',
    '{"category":"LANGUAGE","frustration_only":true,"offensive":false,"repeated":false,"incitement_to_violence":false,"person_category":"N_A"}'::jsonb,
    'N_A', 1, 'MATCH', '1 match suspension', false, 'Schedule 1 cl 4.2', 100
  );

  -- Language Level 2 by person category.
  insert into public.discipline_classification_rules (
    rule_pack_id, classification_code, label, criteria, person_category,
    recommended_penalty_value, recommended_penalty_unit, recommended_penalty_text,
    tribunal_required, rule_reference, priority
  ) values
    (v_rule_pack_id, 'LANGUAGE_L2', 'Language Level 2', '{"category":"LANGUAGE","frustration_only":false,"offensive":true,"repeated":false,"incitement_to_violence":false,"person_category":"MATCH_PARTICIPANT"}', 'MATCH_PARTICIPANT', 2, 'MATCH', '2 match suspension', false, 'Schedule 1 cl 4.2', 100),
    (v_rule_pack_id, 'LANGUAGE_L2', 'Language Level 2', '{"category":"LANGUAGE","frustration_only":false,"offensive":true,"repeated":false,"incitement_to_violence":false,"person_category":"SPECTATOR"}', 'SPECTATOR', 1, 'MATCH', '1 match suspension', false, 'Schedule 1 cl 4.2', 100),
    (v_rule_pack_id, 'LANGUAGE_L2', 'Language Level 2', '{"category":"LANGUAGE","frustration_only":false,"offensive":true,"repeated":false,"incitement_to_violence":false,"person_category":"OFFICIAL"}', 'OFFICIAL', 3, 'MATCH', '3 match suspension', false, 'Schedule 1 cl 4.2', 100);

  -- Language Level 3. Separate rows represent the Schedule's repeated-use OR incitement test.
  insert into public.discipline_classification_rules (
    rule_pack_id, classification_code, label, criteria, person_category,
    recommended_penalty_value, recommended_penalty_unit, recommended_penalty_text,
    tribunal_required, rule_reference, priority
  )
  select
    v_rule_pack_id,
    'LANGUAGE_L3',
    'Language Level 3',
    jsonb_build_object(
      'category', 'LANGUAGE',
      'repeated', condition.repeated,
      'incitement_to_violence', condition.incitement,
      'person_category', person.category
    ),
    person.category,
    person.penalty,
    'MATCH',
    person.penalty::text || ' match suspension',
    true,
    'Schedule 1 cl 4.2',
    200
  from (values
    (true, false), (false, true), (true, true)
  ) as condition(repeated, incitement)
  cross join (values
    ('MATCH_PARTICIPANT', 4::numeric),
    ('SPECTATOR', 4::numeric),
    ('OFFICIAL', 6::numeric)
  ) as person(category, penalty);

  -- Violent conduct by factual conduct type and person category.
  insert into public.discipline_classification_rules (
    rule_pack_id, classification_code, label, criteria, person_category,
    recommended_penalty_value, recommended_penalty_unit, recommended_penalty_text,
    tribunal_required, rule_reference, priority
  )
  select
    v_rule_pack_id,
    conduct.code,
    conduct.label,
    jsonb_build_object(
      'category', 'PHYSICAL',
      'physical_kind', conduct.kind,
      'contact_made', conduct.contact_made,
      'person_category', person.category
    ),
    person.category,
    case person.category
      when 'OFFICIAL' then conduct.official_penalty
      when 'SPECTATOR' then conduct.spectator_penalty
      else conduct.participant_penalty
    end,
    'MATCH',
    (case person.category
      when 'OFFICIAL' then conduct.official_penalty
      when 'SPECTATOR' then conduct.spectator_penalty
      else conduct.participant_penalty
    end)::text || ' match suspension',
    conduct.tribunal,
    'Schedule 1 cl 4.2',
    200
  from (values
    ('VIOLENT_L1', 'Violent Conduct Level 1', 'PUSH_GRAB_TRIP', true, 2::numeric, 2::numeric, 3::numeric, false),
    ('VIOLENT_L2', 'Violent Conduct Level 2', 'ATTEMPTED_STRIKE', false, 6::numeric, 6::numeric, 8::numeric, false),
    ('VIOLENT_L3', 'Violent Conduct Level 3', 'STRIKE', true, 8::numeric, 8::numeric, 10::numeric, true)
  ) as conduct(code, label, kind, contact_made, participant_penalty, spectator_penalty, official_penalty, tribunal)
  cross join (values
    ('MATCH_PARTICIPANT'), ('SPECTATOR'), ('OFFICIAL')
  ) as person(category);

  -- Vilification by person category.
  insert into public.discipline_classification_rules (
    rule_pack_id, classification_code, label, criteria, person_category,
    recommended_penalty_value, recommended_penalty_unit, recommended_penalty_text,
    tribunal_required, rule_reference, priority
  ) values
    (v_rule_pack_id, 'VILIFICATION', 'Vilification', '{"category":"VILIFICATION","protected_characteristic":true,"person_category":"MATCH_PARTICIPANT"}', 'MATCH_PARTICIPANT', 6, 'MATCH', '6 match suspension', true, 'Schedule 1 cl 4.2', 300),
    (v_rule_pack_id, 'VILIFICATION', 'Vilification', '{"category":"VILIFICATION","protected_characteristic":true,"person_category":"SPECTATOR"}', 'SPECTATOR', 6, 'MATCH', '6 match suspension', true, 'Schedule 1 cl 4.2', 300),
    (v_rule_pack_id, 'VILIFICATION', 'Vilification', '{"category":"VILIFICATION","protected_characteristic":true,"person_category":"OFFICIAL"}', 'OFFICIAL', 7, 'MATCH', '7 match suspension', true, 'Schedule 1 cl 4.2', 300);

  -- Other misconduct. These exact Schedule entries must also be available to screening.
  insert into public.discipline_classification_rules (
    rule_pack_id, classification_code, label, criteria, person_category,
    recommended_penalty_value, recommended_penalty_unit, recommended_penalty_text,
    tribunal_required, rule_reference, priority, source_warning
  ) values
    (v_rule_pack_id, 'OTHER_INFLUENCE_OFFICIAL', 'Repeated attempts to influence an official', '{"category":"OTHER","other_offence":"INFLUENCE_OFFICIAL"}', 'ANY', null, 'REPRIMAND', 'Reprimand', false, 'Schedule 1 cl 4.2', 100, null),
    (v_rule_pack_id, 'OTHER_PUBLIC_STATEMENT', 'Unfair public personal attack', '{"category":"OTHER","other_offence":"PUBLIC_PERSONAL_ATTACK"}', 'ANY', 3, 'WEEK', '3 week suspension', true, 'Schedule 1 cl 4.2', 200, 'The Schedule marks this listed offence as immediate Tribunal despite the form clarification mentioning only Level 3 and vilification.'),
    (v_rule_pack_id, 'OTHER_NOT_LEAVING_FIELD', 'Not leaving the field when directed', '{"category":"OTHER","other_offence":"NOT_LEAVING_FIELD"}', 'ANY', 2, 'MATCH', '2 match suspension', false, 'Schedule 1 cl 4.2', 100, null),
    (v_rule_pack_id, 'OTHER_UNFIT_STATE', 'Participation in an unfit state', '{"category":"OTHER","other_offence":"UNFIT_STATE"}', 'ANY', 4, 'MATCH', '4 match suspension', false, 'Schedule 1 cl 4.2', 100, null),
    (v_rule_pack_id, 'OTHER_UNAUTHORISED_ENTRY', 'Unauthorised field entry', '{"category":"OTHER","other_offence":"UNAUTHORISED_FIELD_ENTRY"}', 'ANY', 2, 'MATCH', '2 match suspension', false, 'Schedule 1 cl 4.2', 100, null),
    (v_rule_pack_id, 'OTHER_DISREPUTE', 'Bringing the game into disrepute', '{"category":"OTHER","other_offence":"DISREPUTE"}', 'ANY', 5, 'MATCH', '5 match suspension', false, 'Schedule 1 cl 4.2', 100, null),
    (v_rule_pack_id, 'OTHER_CONTEMPT', 'Contempt of Tribunal or appeal process', '{"category":"OTHER","other_offence":"CONTEMPT"}', 'ANY', 500, 'DOLLAR', '$500', false, 'Schedule 1 cl 4.2', 100, 'The linked incident form shows $250; the 2026 Schedules show $500. HB treatment must be confirmed, including clause 7.1 for club fines.');

  delete from public.discipline_calendar_exclusions where association_id = v_association_id
    and exclusion_type = 'VICTORIAN_PUBLIC_HOLIDAY'
    and exclusion_date between date '2026-01-01' and date '2026-12-31';
  insert into public.discipline_calendar_exclusions (
    association_id, exclusion_date, label, exclusion_type, source_url
  ) values
    (v_association_id, date '2026-01-01', 'New Year''s Day', 'VICTORIAN_PUBLIC_HOLIDAY', 'https://business.vic.gov.au/business-information/public-holidays/victorian-public-holidays-2026'),
    (v_association_id, date '2026-01-26', 'Australia Day', 'VICTORIAN_PUBLIC_HOLIDAY', 'https://business.vic.gov.au/business-information/public-holidays/victorian-public-holidays-2026'),
    (v_association_id, date '2026-03-09', 'Labour Day', 'VICTORIAN_PUBLIC_HOLIDAY', 'https://business.vic.gov.au/business-information/public-holidays/victorian-public-holidays-2026'),
    (v_association_id, date '2026-04-03', 'Good Friday', 'VICTORIAN_PUBLIC_HOLIDAY', 'https://business.vic.gov.au/business-information/public-holidays/victorian-public-holidays-2026'),
    (v_association_id, date '2026-04-04', 'Saturday before Easter Sunday', 'VICTORIAN_PUBLIC_HOLIDAY', 'https://business.vic.gov.au/business-information/public-holidays/victorian-public-holidays-2026'),
    (v_association_id, date '2026-04-05', 'Easter Sunday', 'VICTORIAN_PUBLIC_HOLIDAY', 'https://business.vic.gov.au/business-information/public-holidays/victorian-public-holidays-2026'),
    (v_association_id, date '2026-04-06', 'Easter Monday', 'VICTORIAN_PUBLIC_HOLIDAY', 'https://business.vic.gov.au/business-information/public-holidays/victorian-public-holidays-2026'),
    (v_association_id, date '2026-04-25', 'ANZAC Day', 'VICTORIAN_PUBLIC_HOLIDAY', 'https://business.vic.gov.au/business-information/public-holidays/victorian-public-holidays-2026'),
    (v_association_id, date '2026-06-08', 'King''s Birthday', 'VICTORIAN_PUBLIC_HOLIDAY', 'https://business.vic.gov.au/business-information/public-holidays/victorian-public-holidays-2026'),
    (v_association_id, date '2026-09-25', 'Friday before the AFL Grand Final', 'VICTORIAN_PUBLIC_HOLIDAY', 'https://business.vic.gov.au/business-information/public-holidays/victorian-public-holidays-2026'),
    (v_association_id, date '2026-11-03', 'Melbourne Cup Day', 'VICTORIAN_PUBLIC_HOLIDAY', 'https://business.vic.gov.au/business-information/public-holidays/victorian-public-holidays-2026'),
    (v_association_id, date '2026-12-25', 'Christmas Day', 'VICTORIAN_PUBLIC_HOLIDAY', 'https://business.vic.gov.au/business-information/public-holidays/victorian-public-holidays-2026'),
    (v_association_id, date '2026-12-26', 'Boxing Day', 'VICTORIAN_PUBLIC_HOLIDAY', 'https://business.vic.gov.au/business-information/public-holidays/victorian-public-holidays-2026'),
    (v_association_id, date '2026-12-28', 'Additional Boxing Day public holiday', 'VICTORIAN_PUBLIC_HOLIDAY', 'https://business.vic.gov.au/business-information/public-holidays/victorian-public-holidays-2026');

  delete from public.discipline_local_variations where rule_pack_id = v_rule_pack_id;
  insert into public.discipline_local_variations (
    rule_pack_id, variation_key, rule_reference, hv_requirement,
    issue, proposed_hb_treatment, status
  ) values
    (v_rule_pack_id, 'business_day', 'HV Rule 7.1; Schedule 1 cl 4.1', 'Deadlines are expressed in business days.', 'No business-day definition was located in the checked 2026 HV source set.', 'Use weekdays excluding the HB calendar until HB approves or replaces the interpretation.', 'REVIEW_REQUIRED'),
    (v_rule_pack_id, 'authority_mapping', 'HB 2.1 and 3.1', 'Several HV provisions name the CEO or delegate.', 'HB needs to identify the person or committee authorised for each decision.', null, 'REVIEW_REQUIRED'),
    (v_rule_pack_id, 'report_destination', 'Schedule 2 cl 13', 'The HV form names an HV email and HV prior-presentation contacts.', 'Those HV destinations cannot simply be relabelled as HB without a local decision.', null, 'REVIEW_REQUIRED'),
    (v_rule_pack_id, 'natural_justice_checklist', 'HV 7.12; NIF 7.5', 'The source documents contain different procedural-fairness detail for different pathways.', 'The proposed investigation checklist is broader than the express Rule 7.12 wording.', 'Use it as an HB operating safeguard and label it as such until approved.', 'REVIEW_REQUIRED'),
    (v_rule_pack_id, 'incident_form_conflict', 'Schedule 1 cl 4.2 and linked form', 'The current penalty table should be used for guidance.', 'The linked incident form shows $250 for contempt; the 2026 Schedules show $500.', 'Display $500 from the Schedules with a source-conflict warning; do not auto-apply it.', 'REVIEW_REQUIRED'),
    (v_rule_pack_id, 'club_fines', 'HB 7.1', 'HV documents contain several fees and fines.', 'HB expressly says it does not fine clubs.', 'Require a human HB decision and show the clause 7.1 warning whenever money guidance appears.', 'REVIEW_REQUIRED'),
    (v_rule_pack_id, 'publication', 'HV 7.13', 'HV publishes guilty charges and penalties.', 'HB has not confirmed the practicable local publication treatment.', null, 'REVIEW_REQUIRED'),
    (v_rule_pack_id, 'tribunal_chair', 'HV 7.17', 'The Tribunal chair is legally qualified under the HV rule.', 'HB practicality and any lawful local variation require approval.', null, 'REVIEW_REQUIRED'),
    (v_rule_pack_id, 'suspension_scope', 'HV 7.16', 'The HV rule describes suspension scope, counting and carry-over.', 'HB must confirm reach beyond its competitions.', null, 'REVIEW_REQUIRED'),
    (v_rule_pack_id, 'early_guilty_plea', 'HV 7.11', 'An early guilty plea can change investigation and penalty handling.', 'The 2026 sequence is not sufficiently clear for automation.', 'Record the fact and require human rule advice; do not automate a reduction.', 'REVIEW_REQUIRED'),
    (v_rule_pack_id, 'source_cross_references', 'Schedule 1 cl 4.1 and 4.2; HV 7.22', 'Internal references should point to the governing provisions.', 'Several apparent cross-reference errors were located in the source documents.', 'Display the printed reference and an ambiguity note; do not silently rewrite the source.', 'REVIEW_REQUIRED'),
    (v_rule_pack_id, 'nif_current_status', 'HA NIF Complaints, Disputes and Discipline Policy', 'The relevant current integrity policy should govern prohibited-conduct referrals.', 'The policy is linked by HB but its stated review date was July 2025.', 'Use for triage warnings only until HB confirms the current adopted version.', 'REVIEW_REQUIRED');
end
$seed_discipline_2026$;
