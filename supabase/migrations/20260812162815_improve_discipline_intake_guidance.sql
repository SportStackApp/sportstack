-- Make discipline intake easier to explain and complete without weakening the
-- evidence record. Existing text fields remain as immutable-style snapshots;
-- optional foreign keys only link those snapshots to current SportStack data.

alter table public.discipline_cases
  add column if not exists competition_id uuid references public.competitions(id) on delete set null,
  add column if not exists division_id uuid references public.divisions(id) on delete set null,
  add column if not exists home_team_id uuid references public.teams(id) on delete set null,
  add column if not exists away_team_id uuid references public.teams(id) on delete set null,
  add column if not exists venue_id uuid references public.venues(id) on delete set null;

alter table public.discipline_case_people
  add column if not exists profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists club_id uuid references public.clubs(id) on delete set null;

create table public.discipline_tags (
  id uuid primary key default gen_random_uuid(),
  association_id uuid not null references public.associations(id) on delete cascade,
  tag_scope text not null,
  tag_key text not null,
  label text not null,
  description text not null,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint discipline_tags_scope_check check (
    tag_scope in ('JURISDICTION_REASON', 'SAFETY_RISK', 'ALLEGATION_DESCRIPTOR')
  ),
  constraint discipline_tags_key_check check (tag_key ~ '^[A-Z0-9_]{2,80}$'),
  constraint discipline_tags_label_check check (length(btrim(label)) between 2 and 100),
  constraint discipline_tags_description_check check (length(btrim(description)) between 3 and 500),
  unique (association_id, tag_scope, tag_key)
);

create table public.discipline_case_tags (
  case_id uuid not null references public.discipline_cases(id) on delete cascade,
  tag_id uuid not null references public.discipline_tags(id) on delete restrict,
  tag_context text not null,
  assigned_by uuid references public.profiles(id) on delete set null,
  assigned_at timestamptz not null default now(),
  constraint discipline_case_tags_context_check check (
    tag_context in ('JURISDICTION', 'SAFETY')
  ),
  primary key (case_id, tag_id, tag_context)
);

create table public.discipline_allegation_tags (
  allegation_id uuid not null references public.discipline_allegations(id) on delete cascade,
  tag_id uuid not null references public.discipline_tags(id) on delete restrict,
  assigned_by uuid references public.profiles(id) on delete set null,
  assigned_at timestamptz not null default now(),
  primary key (allegation_id, tag_id)
);

create index discipline_tags_lookup_idx
  on public.discipline_tags (association_id, tag_scope, active, sort_order);
create index discipline_case_tags_tag_idx on public.discipline_case_tags (tag_id);
create index discipline_allegation_tags_tag_idx on public.discipline_allegation_tags (tag_id);

alter table public.discipline_tags enable row level security;
alter table public.discipline_case_tags enable row level security;
alter table public.discipline_allegation_tags enable row level security;

create policy discipline_tags_select on public.discipline_tags
for select to authenticated
using (
  private.discipline_can_create_case(association_id, (select auth.uid()))
  or exists (
    select 1
    from public.discipline_cases incident_case
    where incident_case.association_id = discipline_tags.association_id
      and private.discipline_can_read_case(incident_case.id, (select auth.uid()))
  )
);

create policy discipline_case_tags_select on public.discipline_case_tags
for select to authenticated
using (private.discipline_can_read_case(case_id, (select auth.uid())));

create policy discipline_allegation_tags_select on public.discipline_allegation_tags
for select to authenticated
using (
  exists (
    select 1
    from public.discipline_allegations allegation
    where allegation.id = allegation_id
      and private.discipline_can_read_case(allegation.case_id, (select auth.uid()))
  )
);

revoke all on table public.discipline_tags, public.discipline_case_tags,
  public.discipline_allegation_tags from public, anon, authenticated;
grant select on table public.discipline_tags, public.discipline_case_tags,
  public.discipline_allegation_tags to authenticated;
grant all on table public.discipline_tags, public.discipline_case_tags,
  public.discipline_allegation_tags to service_role;

do $seed_discipline_intake_tags$
declare
  v_association_id uuid;
begin
  select id into v_association_id
  from public.associations
  where lower(name) = 'hockey ballarat'
  limit 1;

  if v_association_id is null then
    raise exception 'Hockey Ballarat association was not found; intake tags were not seeded.';
  end if;

  insert into public.discipline_tags (
    association_id, tag_scope, tag_key, label, description, sort_order
  ) values
    (v_association_id, 'JURISDICTION_REASON', 'MATCH_RELATED', 'Match-related conduct', 'The reported conduct happened during, or in connection with, a hockey match.', 10),
    (v_association_id, 'JURISDICTION_REASON', 'AFFILIATE_ASSOCIATED_PERSON', 'Affiliate-associated person', 'The reported person is described as a player, official or another person associated with an affiliate.', 20),
    (v_association_id, 'JURISDICTION_REASON', 'WRITTEN_REPORT_RECEIVED', 'Written incident report received', 'A written incident report or equivalent account has been received.', 30),
    (v_association_id, 'JURISDICTION_REASON', 'OTHER_CREDIBLE_INFORMATION', 'Other credible information', 'The matter came from a club complaint, umpire report, another report or other credible evidence rather than the prescribed form.', 40),
    (v_association_id, 'JURISDICTION_REASON', 'SAFEGUARDING_OR_INTEGRITY', 'Safeguarding or integrity concern', 'The reported facts may also engage safeguarding, discrimination, member protection or another integrity policy.', 50),
    (v_association_id, 'JURISDICTION_REASON', 'CRIMINAL_OR_REGULATORY', 'Possible criminal or regulatory concern', 'The reported facts may require police, child protection, medical or another external authority response.', 60),
    (v_association_id, 'JURISDICTION_REASON', 'JURISDICTION_UNCLEAR', 'Jurisdiction unclear', 'The available facts are not yet enough to select a final pathway.', 70),
    (v_association_id, 'JURISDICTION_REASON', 'OTHER_PROCESS_MAY_APPLY', 'Another process may apply', 'Another policy, organisation or process may be better placed to manage the matter.', 80),

    (v_association_id, 'SAFETY_RISK', 'CHILD_IMMEDIATE_RISK', 'Immediate risk to a child or young person', 'A child or young person may be at immediate risk of harm.', 10),
    (v_association_id, 'SAFETY_RISK', 'FURTHER_HARM_RISK', 'Risk of further harm', 'There is a current risk of repeated or escalating harm.', 20),
    (v_association_id, 'SAFETY_RISK', 'SERIOUS_INJURY_OR_MEDICAL', 'Serious injury or medical attention', 'Serious injury is reported or urgent medical attention may be required.', 30),
    (v_association_id, 'SAFETY_RISK', 'ALLEGED_CRIMINAL_CONDUCT', 'Possible criminal conduct', 'The reported facts may involve criminal conduct and require external reporting.', 40),
    (v_association_id, 'SAFETY_RISK', 'EMERGENCY_SERVICES_CONTACTED', 'Emergency services contacted', 'Police, ambulance or another emergency service has been contacted.', 50),
    (v_association_id, 'SAFETY_RISK', 'CHILD_PROTECTION_ACTION', 'Child protection action', 'A child protection report has been considered or made.', 60),
    (v_association_id, 'SAFETY_RISK', 'INTERIM_SEPARATION', 'Interim separation or no-contact action', 'People have been separated or a temporary no-contact step has been taken.', 70),
    (v_association_id, 'SAFETY_RISK', 'VENUE_SAFETY_ACTION', 'Venue safety action', 'A venue, match-day or access-control safety step has been taken.', 80),
    (v_association_id, 'SAFETY_RISK', 'WELFARE_SUPPORT', 'Welfare support arranged', 'Welfare, medical or other support has been offered or arranged.', 90),

    (v_association_id, 'ALLEGATION_DESCRIPTOR', 'LANGUAGE_OR_GESTURES', 'Language or gestures', 'Reported language, signs or gestures are part of this allegation.', 10),
    (v_association_id, 'ALLEGATION_DESCRIPTOR', 'REPEATED_CONDUCT', 'Repeated conduct', 'The same or similar reported conduct occurred more than once.', 20),
    (v_association_id, 'ALLEGATION_DESCRIPTOR', 'THREAT_OR_INCITEMENT', 'Threat or incitement', 'A threat or encouragement of violence is reported.', 30),
    (v_association_id, 'ALLEGATION_DESCRIPTOR', 'PHYSICAL_CONDUCT', 'Physical conduct', 'Physical conduct is reported without making a finding about what occurred.', 40),
    (v_association_id, 'ALLEGATION_DESCRIPTOR', 'ATTEMPTED_STRIKE', 'Attempted strike', 'An attempted strike is reported.', 50),
    (v_association_id, 'ALLEGATION_DESCRIPTOR', 'CONTACT_OR_STRIKE', 'Contact or strike alleged', 'Physical contact or a strike is reported.', 60),
    (v_association_id, 'ALLEGATION_DESCRIPTOR', 'IMPLEMENT_INVOLVED', 'Stick or other implement involved', 'A stick or another implement is reported as involved.', 70),
    (v_association_id, 'ALLEGATION_DESCRIPTOR', 'VILIFICATION_BASIS_ALLEGED', 'Vilification characteristic alleged', 'The reported conduct is said to relate to a protected characteristic; this is a descriptor, not a finding.', 80),
    (v_association_id, 'ALLEGATION_DESCRIPTOR', 'OFFICIAL_DECISION_INFLUENCE', 'Influence on an official', 'The reported conduct concerns an attempt to influence an official or their decision.', 90),
    (v_association_id, 'ALLEGATION_DESCRIPTOR', 'REFUSAL_TO_LEAVE', 'Refusal to leave', 'A refusal to leave the field or venue is reported.', 100),
    (v_association_id, 'ALLEGATION_DESCRIPTOR', 'UNAUTHORISED_ENTRY', 'Unauthorised field entry', 'Unauthorised entry onto the field of play is reported.', 110),
    (v_association_id, 'ALLEGATION_DESCRIPTOR', 'DISREPUTE_OR_PUBLIC_CONDUCT', 'Disrepute or public conduct', 'Public conduct or a statement said to bring the game into disrepute is reported.', 120),
    (v_association_id, 'ALLEGATION_DESCRIPTOR', 'JUNIOR_INVOLVED', 'Junior involved', 'A child or junior is reported as involved.', 130),
    (v_association_id, 'ALLEGATION_DESCRIPTOR', 'INJURY_ALLEGED', 'Injury alleged', 'An injury is reported as connected with this allegation.', 140),
    (v_association_id, 'ALLEGATION_DESCRIPTOR', 'WITNESS_IDENTIFIED', 'Witness identified', 'One or more possible witnesses have been identified.', 150),
    (v_association_id, 'ALLEGATION_DESCRIPTOR', 'MEDIA_EVIDENCE', 'Video, photo or audio evidence', 'Video, photo or audio material is reported as available.', 160),
    (v_association_id, 'ALLEGATION_DESCRIPTOR', 'OTHER_REPORTED_CONDUCT', 'Other reported conduct', 'The reported conduct does not fit the available descriptive tags.', 170)
  on conflict (association_id, tag_scope, tag_key) do update set
    label = excluded.label,
    description = excluded.description,
    sort_order = excluded.sort_order,
    active = true;
end
$seed_discipline_intake_tags$;

create or replace function public.get_discipline_intake_options(p_association_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor_id uuid := auth.uid();
  v_timezone text;
begin
  if v_actor_id is null then raise exception 'Sign in is required.'; end if;
  if not private.discipline_can_create_case(p_association_id, v_actor_id) then
    raise exception 'You do not have permission to create a discipline case for this association.';
  end if;

  select coalesce(association.timezone, 'Australia/Melbourne') into v_timezone
  from public.associations association
  where association.id = p_association_id;

  return jsonb_build_object(
    'fixtures', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', fixture.id,
        'label', concat_ws(' · ',
          to_char(fixture.fixture_date at time zone v_timezone, 'DD/MM/YYYY HH24:MI'),
          home_team.name || ' v ' || away_team.name,
          division.name
        ),
        'fixture_at', fixture.fixture_date,
        'match_concluded_at', coalesce(
          fixture.scheduled_end_at,
          fixture.fixture_date + make_interval(mins => coalesce(division.default_match_duration_minutes, 90))
        ),
        'competition_id', competition.id,
        'competition', competition.name,
        'division_id', division.id,
        'grade', division.name,
        'round_label', coalesce(fixture.round_name, case when fixture.round_number is null then null else 'Round ' || fixture.round_number end),
        'home_team_id', home_team.id,
        'home_team', home_team.name,
        'away_team_id', away_team.id,
        'away_team', away_team.name,
        'venue_id', venue.id,
        'venue', venue.name
      ) order by fixture.fixture_date desc)
      from public.fixtures fixture
      join public.teams home_team on home_team.id = fixture.home_team_id
      join public.clubs home_club on home_club.id = home_team.club_id
      join public.teams away_team on away_team.id = fixture.away_team_id
      join public.clubs away_club on away_club.id = away_team.club_id
      left join public.divisions division on division.id = home_team.division_id
      left join public.competitions competition on competition.id = division.competition_id
      left join public.venues venue on venue.id = fixture.venue_id
      where home_club.association_id = p_association_id
         or away_club.association_id = p_association_id
    ), '[]'::jsonb),
    'competitions', coalesce((
      select jsonb_agg(jsonb_build_object('id', competition.id, 'label', competition.name) order by lower(competition.name))
      from public.competitions competition
      where competition.association_id = p_association_id
    ), '[]'::jsonb),
    'grades', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', division.id,
        'label', division.name,
        'competition_id', division.competition_id
      ) order by lower(division.name))
      from public.divisions division
      where division.association_id = p_association_id
    ), '[]'::jsonb),
    'teams', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', team.id,
        'label', team.name,
        'club_id', club.id,
        'club', club.name,
        'division_id', team.division_id
      ) order by lower(team.name))
      from public.teams team
      join public.clubs club on club.id = team.club_id
      where club.association_id = p_association_id
    ), '[]'::jsonb),
    'venues', coalesce((
      select jsonb_agg(jsonb_build_object('id', venue.id, 'label', venue.name) order by lower(venue.name))
      from public.venues venue
      where venue.association_id = p_association_id
    ), '[]'::jsonb),
    'clubs', coalesce((
      select jsonb_agg(jsonb_build_object('id', club.id, 'label', club.name) order by lower(club.name))
      from public.clubs club
      where club.association_id = p_association_id
    ), '[]'::jsonb),
    'profiles', coalesce((
      select jsonb_agg(profile_row.profile_json order by lower(profile_row.full_name))
      from (
        select distinct on (profile.id)
          profile.id,
          concat_ws(' ', nullif(btrim(profile.first_name), ''), nullif(btrim(profile.last_name), '')) as full_name,
          jsonb_build_object(
            'id', profile.id,
            'label', concat_ws(' ', nullif(btrim(profile.first_name), ''), nullif(btrim(profile.last_name), '')),
            'club_id', club.id,
            'club', club.name
          ) as profile_json
        from public.profiles profile
        left join public.clubs club on club.id = profile.registered_club_id
        where nullif(concat_ws(' ', nullif(btrim(profile.first_name), ''), nullif(btrim(profile.last_name), '')), '') is not null
          and (
            club.association_id = p_association_id
            or exists (
              select 1
              from public.team_memberships membership
              join public.teams member_team on member_team.id = membership.team_id
              join public.clubs member_club on member_club.id = member_team.club_id
              where membership.user_id = profile.id
                and member_club.association_id = p_association_id
            )
          )
        order by profile.id, club.name nulls last
      ) profile_row
    ), '[]'::jsonb),
    'tags', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', tag.id,
        'scope', tag.tag_scope,
        'key', tag.tag_key,
        'label', tag.label,
        'description', tag.description
      ) order by tag.tag_scope, tag.sort_order, lower(tag.label))
      from public.discipline_tags tag
      where tag.association_id = p_association_id and tag.active
    ), '[]'::jsonb)
  );
end;
$function$;

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
  v_allegations jsonb := coalesce(p_intake -> 'allegations', '[]'::jsonb);
  v_allegation jsonb;
  v_allegation_id uuid;
  v_allegation_number integer := 0;
  v_fixture_id uuid := nullif(p_intake ->> 'fixture_id', '')::uuid;
  v_competition_id uuid := nullif(p_intake ->> 'competition_id', '')::uuid;
  v_division_id uuid := nullif(p_intake ->> 'division_id', '')::uuid;
  v_home_team_id uuid := nullif(p_intake ->> 'home_team_id', '')::uuid;
  v_away_team_id uuid := nullif(p_intake ->> 'away_team_id', '')::uuid;
  v_venue_id uuid := nullif(p_intake ->> 'venue_id', '')::uuid;
begin
  if v_actor_id is null then raise exception 'Sign in is required.'; end if;
  if v_association_id is null or not private.discipline_can_create_case(v_association_id, v_actor_id) then
    raise exception 'You do not have permission to create a discipline case for this association.';
  end if;
  if v_match_concluded_at is null then raise exception 'Match conclusion time is required.'; end if;
  if nullif(btrim(p_intake ->> 'title'), '') is null then raise exception 'Case title is required.'; end if;
  if length(btrim(coalesce(p_intake ->> 'jurisdiction_reason', ''))) < 5 then
    raise exception 'Record a brief factual reason for the selected jurisdiction pathway.';
  end if;
  if v_round_type not in ('REGULAR', 'LAST_REGULAR', 'FINALS') then raise exception 'Round type is not valid.'; end if;
  if v_round_type <> 'REGULAR' and v_relevant_club_participating is null then
    raise exception 'Record whether the relevant club is participating in that competition.';
  end if;
  if v_jurisdiction not in ('UNASSESSED', 'COMPETITION_RULE_7', 'NIF_REFERRAL', 'EXTERNAL_SAFETY_REFERRAL', 'OTHER_REFERRAL') then
    raise exception 'Jurisdiction path is not valid.';
  end if;
  if v_immediate_risk and length(btrim(coalesce(p_intake ->> 'immediate_safety_action', ''))) < 5 then
    raise exception 'Record the immediate safety action taken.';
  end if;

  if jsonb_typeof(v_allegations) <> 'array' then
    raise exception 'Allegations must be supplied as a list.';
  end if;
  if jsonb_array_length(v_allegations) = 0 and nullif(btrim(p_intake #>> '{initial_allegation,title}'), '') is not null then
    v_allegations := jsonb_build_array(p_intake -> 'initial_allegation');
  end if;
  if jsonb_array_length(v_allegations) = 0 then
    raise exception 'Add at least one neutral allegation from the incident report.';
  end if;
  for v_allegation in select value from jsonb_array_elements(v_allegations)
  loop
    if length(btrim(coalesce(v_allegation ->> 'title', ''))) < 3
       or length(btrim(coalesce(v_allegation ->> 'description', ''))) < 5 then
      raise exception 'Every allegation requires a title and factual description.';
    end if;
  end loop;

  if v_rule_pack_id is null then
    select pack.id into v_rule_pack_id
    from public.discipline_rule_packs pack
    where pack.association_id = v_association_id and pack.status in ('PUBLISHED', 'REVIEW_REQUIRED')
    order by case pack.status when 'PUBLISHED' then 0 else 1 end, pack.created_at desc
    limit 1;
  end if;
  if not exists (select 1 from public.discipline_rule_packs pack where pack.id = v_rule_pack_id and pack.association_id = v_association_id) then
    raise exception 'An association rule pack is required.';
  end if;

  if v_fixture_id is not null and not exists (
    select 1 from public.fixtures fixture
    join public.teams home_team on home_team.id = fixture.home_team_id
    join public.clubs home_club on home_club.id = home_team.club_id
    join public.teams away_team on away_team.id = fixture.away_team_id
    join public.clubs away_club on away_club.id = away_team.club_id
    where fixture.id = v_fixture_id and (home_club.association_id = v_association_id or away_club.association_id = v_association_id)
  ) then raise exception 'The selected fixture is not available for this association.'; end if;
  if v_competition_id is not null and not exists (select 1 from public.competitions where id = v_competition_id and association_id = v_association_id) then raise exception 'The selected competition is not available for this association.'; end if;
  if v_division_id is not null and not exists (select 1 from public.divisions where id = v_division_id and association_id = v_association_id) then raise exception 'The selected grade is not available for this association.'; end if;
  if v_home_team_id is not null and not exists (select 1 from public.teams team join public.clubs club on club.id = team.club_id where team.id = v_home_team_id and club.association_id = v_association_id) then raise exception 'The selected home team is not available for this association.'; end if;
  if v_away_team_id is not null and not exists (select 1 from public.teams team join public.clubs club on club.id = team.club_id where team.id = v_away_team_id and club.association_id = v_association_id) then raise exception 'The selected away team is not available for this association.'; end if;
  if v_venue_id is not null and not exists (select 1 from public.venues where id = v_venue_id and association_id = v_association_id) then raise exception 'The selected venue is not available for this association.'; end if;
  if nullif(v_reporter ->> 'club_id', '') is not null and not exists (
    select 1 from public.clubs where id = (v_reporter ->> 'club_id')::uuid and association_id = v_association_id
  ) then raise exception 'The selected reporter club is not available for this association.'; end if;
  if nullif(v_reported_person ->> 'club_id', '') is not null and not exists (
    select 1 from public.clubs where id = (v_reported_person ->> 'club_id')::uuid and association_id = v_association_id
  ) then raise exception 'The selected reported-person club is not available for this association.'; end if;
  if nullif(v_reporter ->> 'profile_id', '') is not null and not exists (
    select 1
    from public.profiles profile
    left join public.clubs registered_club on registered_club.id = profile.registered_club_id
    where profile.id = (v_reporter ->> 'profile_id')::uuid
      and (
        registered_club.association_id = v_association_id
        or exists (
          select 1 from public.team_memberships membership
          join public.teams member_team on member_team.id = membership.team_id
          join public.clubs member_club on member_club.id = member_team.club_id
          where membership.user_id = profile.id and member_club.association_id = v_association_id
        )
      )
  ) then raise exception 'The selected reporter is not available for this association.'; end if;
  if nullif(v_reported_person ->> 'profile_id', '') is not null and not exists (
    select 1
    from public.profiles profile
    left join public.clubs registered_club on registered_club.id = profile.registered_club_id
    where profile.id = (v_reported_person ->> 'profile_id')::uuid
      and (
        registered_club.association_id = v_association_id
        or exists (
          select 1 from public.team_memberships membership
          join public.teams member_team on member_team.id = membership.team_id
          join public.clubs member_club on member_club.id = member_team.club_id
          where membership.user_id = profile.id and member_club.association_id = v_association_id
        )
      )
  ) then raise exception 'The selected reported person is not available for this association.'; end if;

  -- Immediate safety action is recorded alongside the jurisdiction decision. It
  -- does not by itself close the internal process; an explicit referral path does.
  if v_jurisdiction in ('NIF_REFERRAL', 'EXTERNAL_SAFETY_REFERRAL', 'OTHER_REFERRAL') then
    v_pathway := 'EXTERNAL_REFERRAL';
    v_status := 'REFERRED';
  elsif v_jurisdiction = 'UNASSESSED' then
    v_pathway := 'REVIEW_REQUIRED';
  elsif v_round_type in ('LAST_REGULAR', 'FINALS') and v_relevant_club_participating then
    v_pathway := 'DIRECT_TRIBUNAL';
  else
    v_pathway := 'REGULAR';
  end if;

  v_case_number := format('HB-DIS-%s-%s', extract(year from (v_match_concluded_at at time zone 'Australia/Melbourne'))::integer, lpad(nextval('public.discipline_case_number_seq')::text, 4, '0'));
  perform set_config('app.discipline_change_reason', 'Initial case creation', true);
  perform set_config('app.discipline_actor_id', v_actor_id::text, true);

  insert into public.discipline_cases (
    case_number, association_id, rule_pack_id, status, title,
    jurisdiction_path, jurisdiction_reason, immediate_safety_risk, immediate_safety_action,
    fixture_id, competition_id, division_id, home_team_id, away_team_id, venue_id,
    safety_record_id, committee_id, competition, grade, round_label, round_type,
    relevant_club_participating, first_named_team, second_named_team,
    match_concluded_at, incident_at, venue, incident_location, report_received_at,
    report_method, report_in_writing, prescribed_form_used, report_complete,
    desired_outcome_included, prior_presentation_completed, pathway, created_by, updated_by
  ) values (
    v_case_number, v_association_id, v_rule_pack_id, v_status, btrim(p_intake ->> 'title'),
    v_jurisdiction, btrim(p_intake ->> 'jurisdiction_reason'), v_immediate_risk,
    nullif(btrim(p_intake ->> 'immediate_safety_action'), ''),
    v_fixture_id, v_competition_id, v_division_id, v_home_team_id, v_away_team_id, v_venue_id,
    nullif(p_intake ->> 'safety_record_id', '')::uuid, nullif(p_intake ->> 'committee_id', '')::uuid,
    nullif(btrim(p_intake ->> 'competition'), ''), nullif(btrim(p_intake ->> 'grade'), ''),
    nullif(btrim(p_intake ->> 'round_label'), ''), v_round_type, v_relevant_club_participating,
    nullif(btrim(p_intake ->> 'first_named_team'), ''), nullif(btrim(p_intake ->> 'second_named_team'), ''),
    v_match_concluded_at, nullif(p_intake ->> 'incident_at', '')::timestamptz,
    nullif(btrim(p_intake ->> 'venue'), ''), nullif(btrim(p_intake ->> 'incident_location'), ''),
    nullif(p_intake ->> 'report_received_at', '')::timestamptz, nullif(btrim(p_intake ->> 'report_method'), ''),
    nullif(p_intake ->> 'report_in_writing', '')::boolean, nullif(p_intake ->> 'prescribed_form_used', '')::boolean,
    nullif(p_intake ->> 'report_complete', '')::boolean, nullif(p_intake ->> 'desired_outcome_included', '')::boolean,
    nullif(p_intake ->> 'prior_presentation_completed', '')::boolean,
    v_pathway, v_actor_id, v_actor_id
  ) returning id into v_case_id;

  insert into public.discipline_case_members (case_id, user_id, case_role, assignment_reason, assigned_by)
  values (v_case_id, v_actor_id, 'CASE_COORDINATOR', 'Automatically assigned as case creator.', v_actor_id);

  if nullif(btrim(v_reporter ->> 'full_name'), '') is not null then
    insert into public.discipline_case_people (
      case_id, case_role, full_name, organisation, person_role, email, phone,
      is_junior, notes, profile_id, club_id, created_by, updated_by
    ) values (
      v_case_id, 'REPORTER', btrim(v_reporter ->> 'full_name'), nullif(btrim(v_reporter ->> 'organisation'), ''),
      nullif(btrim(v_reporter ->> 'person_role'), ''), nullif(btrim(v_reporter ->> 'email'), ''),
      nullif(btrim(v_reporter ->> 'phone'), ''), nullif(v_reporter ->> 'is_junior', '')::boolean,
      nullif(btrim(v_reporter ->> 'notes'), ''), nullif(v_reporter ->> 'profile_id', '')::uuid,
      nullif(v_reporter ->> 'club_id', '')::uuid, v_actor_id, v_actor_id
    );
  end if;

  if nullif(btrim(v_reported_person ->> 'full_name'), '') is not null then
    insert into public.discipline_case_people (
      case_id, case_role, full_name, organisation, person_role, email, phone,
      is_junior, notes, profile_id, club_id, created_by, updated_by
    ) values (
      v_case_id, 'REPORTED_PERSON', btrim(v_reported_person ->> 'full_name'), nullif(btrim(v_reported_person ->> 'organisation'), ''),
      nullif(btrim(v_reported_person ->> 'person_role'), ''), nullif(btrim(v_reported_person ->> 'email'), ''),
      nullif(btrim(v_reported_person ->> 'phone'), ''), nullif(v_reported_person ->> 'is_junior', '')::boolean,
      nullif(btrim(v_reported_person ->> 'notes'), ''), nullif(v_reported_person ->> 'profile_id', '')::uuid,
      nullif(v_reported_person ->> 'club_id', '')::uuid, v_actor_id, v_actor_id
    );
  end if;

  insert into public.discipline_case_tags (case_id, tag_id, tag_context, assigned_by)
  select v_case_id, tag.id, 'JURISDICTION', v_actor_id
  from public.discipline_tags tag
  where tag.association_id = v_association_id
    and tag.tag_scope = 'JURISDICTION_REASON'
    and tag.active
    and tag.id in (select value::uuid from jsonb_array_elements_text(coalesce(p_intake -> 'jurisdiction_tag_ids', '[]'::jsonb)));

  insert into public.discipline_case_tags (case_id, tag_id, tag_context, assigned_by)
  select v_case_id, tag.id, 'SAFETY', v_actor_id
  from public.discipline_tags tag
  where tag.association_id = v_association_id
    and tag.tag_scope = 'SAFETY_RISK'
    and tag.active
    and tag.id in (select value::uuid from jsonb_array_elements_text(coalesce(p_intake -> 'safety_tag_ids', '[]'::jsonb)));

  for v_allegation in select value from jsonb_array_elements(v_allegations)
  loop
    v_allegation_number := v_allegation_number + 1;
    insert into public.discipline_allegations (
      case_id, allegation_number, title, description, incident_at, location, created_by, updated_by
    ) values (
      v_case_id, v_allegation_number, btrim(v_allegation ->> 'title'), btrim(v_allegation ->> 'description'),
      nullif(v_allegation ->> 'incident_at', '')::timestamptz,
      nullif(btrim(v_allegation ->> 'location'), ''), v_actor_id, v_actor_id
    ) returning id into v_allegation_id;

    insert into public.discipline_allegation_tags (allegation_id, tag_id, assigned_by)
    select v_allegation_id, tag.id, v_actor_id
    from public.discipline_tags tag
    where tag.association_id = v_association_id
      and tag.tag_scope = 'ALLEGATION_DESCRIPTOR'
      and tag.active
      and tag.id in (select value::uuid from jsonb_array_elements_text(coalesce(v_allegation -> 'tag_ids', '[]'::jsonb)));
  end loop;

  insert into public.discipline_natural_justice_checks (case_id, check_key, label)
  values
    (v_case_id, 'allegations_particularised', 'Every allegation and sufficient particulars were provided.'),
    (v_case_id, 'evidence_identified', 'Evidence relied upon was identified or provided.'),
    (v_case_id, 'response_opportunity', 'A reasonable opportunity to respond was provided.'),
    (v_case_id, 'response_received_or_noted', 'The response received, or the absence of a response, was recorded.'),
    (v_case_id, 'investigator_independence', 'Investigator independence and conflicts were checked.'),
    (v_case_id, 'changes_put_to_person', 'Any new allegation or changed classification was put before reliance.');

  if v_pathway in ('REGULAR', 'DIRECT_TRIBUNAL') then
    perform private.discipline_initialise_deadlines(v_case_id, v_actor_id, 'Initial calculation when the case was created.');
  end if;
  return v_case_id;
end;
$function$;

create or replace function public.save_discipline_intake(p_case_id uuid, p_intake jsonb, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor_id uuid := auth.uid();
  v_before public.discipline_cases%rowtype;
  v_round_type text;
  v_relevant boolean;
  v_pathway text;
  v_needs_recalculation boolean;
begin
  if not private.discipline_can_manage_case(p_case_id, v_actor_id) then raise exception 'Only a Case Coordinator can update intake.'; end if;
  if nullif(btrim(p_reason), '') is null then raise exception 'A change reason is required.'; end if;
  select * into v_before from public.discipline_cases where id = p_case_id;
  if v_before.status in ('REPORT_SIGNED', 'HB_DECISION', 'CLOSED', 'REFERRED') then raise exception 'Signed or final cases cannot be changed through intake.'; end if;

  v_round_type := coalesce(nullif(p_intake ->> 'round_type', ''), v_before.round_type);
  v_relevant := coalesce(nullif(p_intake ->> 'relevant_club_participating', '')::boolean, v_before.relevant_club_participating);
  if v_round_type <> 'REGULAR' and v_relevant is null then raise exception 'Record whether the relevant club is participating in that competition.'; end if;
  v_pathway := case
    when coalesce(nullif(p_intake ->> 'jurisdiction_path', ''), v_before.jurisdiction_path) in ('NIF_REFERRAL', 'EXTERNAL_SAFETY_REFERRAL', 'OTHER_REFERRAL') then 'EXTERNAL_REFERRAL'
    when coalesce(nullif(p_intake ->> 'jurisdiction_path', ''), v_before.jurisdiction_path) = 'UNASSESSED' then 'REVIEW_REQUIRED'
    when v_round_type in ('LAST_REGULAR', 'FINALS') and v_relevant then 'DIRECT_TRIBUNAL'
    else 'REGULAR'
  end;
  v_needs_recalculation := coalesce(nullif(p_intake ->> 'match_concluded_at', '')::timestamptz, v_before.match_concluded_at) is distinct from v_before.match_concluded_at or v_pathway is distinct from v_before.pathway;
  perform set_config('app.discipline_change_reason', btrim(p_reason), true);
  perform set_config('app.discipline_actor_id', v_actor_id::text, true);

  update public.discipline_cases set
    title = coalesce(nullif(btrim(p_intake ->> 'title'), ''), title),
    jurisdiction_path = coalesce(nullif(p_intake ->> 'jurisdiction_path', ''), jurisdiction_path),
    jurisdiction_reason = coalesce(nullif(btrim(p_intake ->> 'jurisdiction_reason'), ''), jurisdiction_reason),
    immediate_safety_risk = coalesce(nullif(p_intake ->> 'immediate_safety_risk', '')::boolean, immediate_safety_risk),
    immediate_safety_action = coalesce(nullif(btrim(p_intake ->> 'immediate_safety_action'), ''), immediate_safety_action),
    competition = coalesce(nullif(btrim(p_intake ->> 'competition'), ''), competition),
    grade = coalesce(nullif(btrim(p_intake ->> 'grade'), ''), grade),
    round_label = coalesce(nullif(btrim(p_intake ->> 'round_label'), ''), round_label),
    round_type = v_round_type, relevant_club_participating = v_relevant,
    first_named_team = coalesce(nullif(btrim(p_intake ->> 'first_named_team'), ''), first_named_team),
    second_named_team = coalesce(nullif(btrim(p_intake ->> 'second_named_team'), ''), second_named_team),
    match_concluded_at = coalesce(nullif(p_intake ->> 'match_concluded_at', '')::timestamptz, match_concluded_at),
    incident_at = coalesce(nullif(p_intake ->> 'incident_at', '')::timestamptz, incident_at),
    venue = coalesce(nullif(btrim(p_intake ->> 'venue'), ''), venue),
    incident_location = coalesce(nullif(btrim(p_intake ->> 'incident_location'), ''), incident_location),
    report_received_at = coalesce(nullif(p_intake ->> 'report_received_at', '')::timestamptz, report_received_at),
    report_method = coalesce(nullif(btrim(p_intake ->> 'report_method'), ''), report_method),
    report_in_writing = coalesce(nullif(p_intake ->> 'report_in_writing', '')::boolean, report_in_writing),
    prescribed_form_used = coalesce(nullif(p_intake ->> 'prescribed_form_used', '')::boolean, prescribed_form_used),
    report_complete = coalesce(nullif(p_intake ->> 'report_complete', '')::boolean, report_complete),
    desired_outcome_included = coalesce(nullif(p_intake ->> 'desired_outcome_included', '')::boolean, desired_outcome_included),
    prior_presentation_completed = coalesce(nullif(p_intake ->> 'prior_presentation_completed', '')::boolean, prior_presentation_completed),
    pathway = v_pathway,
    status = case when v_pathway = 'EXTERNAL_REFERRAL' then 'REFERRED' else status end,
    updated_by = v_actor_id
  where id = p_case_id;

  return jsonb_build_object('case_id', p_case_id, 'pathway', v_pathway, 'deadlines_need_recalculation', v_needs_recalculation);
end;
$function$;

create or replace function public.save_discipline_allegation_with_tags(
  p_case_id uuid,
  p_allegation_id uuid,
  p_title text,
  p_description text,
  p_incident_at timestamptz,
  p_location text,
  p_change_reason text,
  p_tag_ids uuid[] default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor_id uuid := auth.uid();
  v_allegation_id uuid;
  v_association_id uuid;
begin
  if not private.discipline_can_investigate(p_case_id, v_actor_id) then
    raise exception 'You do not have permission to change allegations.';
  end if;
  v_allegation_id := public.save_discipline_allegation(
    p_case_id, p_allegation_id, p_title, p_description,
    p_incident_at, p_location, p_change_reason
  );

  if p_tag_ids is not null then
    select association_id into v_association_id from public.discipline_cases where id = p_case_id;
    delete from public.discipline_allegation_tags where allegation_id = v_allegation_id;
    insert into public.discipline_allegation_tags (allegation_id, tag_id, assigned_by)
    select v_allegation_id, tag.id, v_actor_id
    from public.discipline_tags tag
    where tag.association_id = v_association_id
      and tag.tag_scope = 'ALLEGATION_DESCRIPTOR'
      and tag.active
      and tag.id = any(p_tag_ids);
  end if;
  return v_allegation_id;
end;
$function$;

revoke all on function public.get_discipline_intake_options(uuid) from public, anon;
revoke all on function public.create_discipline_case(jsonb) from public, anon;
revoke all on function public.save_discipline_intake(uuid, jsonb, text) from public, anon;
revoke all on function public.save_discipline_allegation_with_tags(uuid, uuid, text, text, timestamptz, text, text, uuid[]) from public, anon;
grant execute on function public.get_discipline_intake_options(uuid) to authenticated;
grant execute on function public.create_discipline_case(jsonb) to authenticated;
grant execute on function public.save_discipline_intake(uuid, jsonb, text) to authenticated;
grant execute on function public.save_discipline_allegation_with_tags(uuid, uuid, text, text, timestamptz, text, text, uuid[]) to authenticated;
