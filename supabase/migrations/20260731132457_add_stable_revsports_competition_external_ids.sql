-- Give RevSports competitions a stable synthetic source ID so future scraper
-- runs update the same mapping row instead of creating duplicates.
update public.external_entities ee
set
  external_id = concat_ws(
    '|',
    regexp_replace(btrim(ee.association_name), '\s+', ' ', 'g'),
    'competition',
    regexp_replace(btrim(ee.competition_name), '\s+', ' ', 'g')
  ),
  raw_data = coalesce(ee.raw_data, '{}'::jsonb) || jsonb_build_object('synthetic_external_id', true),
  updated_at = now()
where ee.source = 'revsports'
  and ee.entity_type = 'competition'
  and nullif(btrim(ee.external_id), '') is null
  and nullif(btrim(ee.association_name), '') is not null
  and nullif(btrim(ee.competition_name), '') is not null
  and not exists (
    select 1
    from public.external_entities existing
    where existing.id <> ee.id
      and existing.source = ee.source
      and existing.entity_type = ee.entity_type
      and existing.external_id = concat_ws(
        '|',
        regexp_replace(btrim(ee.association_name), '\s+', ' ', 'g'),
        'competition',
        regexp_replace(btrim(ee.competition_name), '\s+', ' ', 'g')
      )
  );
