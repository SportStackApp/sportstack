insert into public.external_entities (
  source,
  entity_type,
  external_id,
  external_name,
  association_name,
  competition_name,
  raw_data,
  first_seen_at,
  last_seen_at,
  status
)
select
  cs.source,
  'competition',
  null,
  cs.competition_name,
  cs.association_name,
  cs.competition_name,
  jsonb_build_object('derived_from', 'external_entities.competition_name'),
  now(),
  now(),
  'active'
from (
  select distinct
    source,
    association_name,
    competition_name
  from public.external_entities
  where source = 'revsports'
    and nullif(btrim(competition_name), '') is not null
    and entity_type in ('club', 'team', 'grade', 'match', 'player', 'venue', 'pitch')
) cs
where not exists (
  select 1
  from public.external_entities ee
  where ee.source = cs.source
    and ee.entity_type = 'competition'
    and coalesce(ee.association_name, '') = coalesce(cs.association_name, '')
    and coalesce(ee.competition_name, '') = coalesce(cs.competition_name, '')
    and ee.external_name = cs.competition_name
);
