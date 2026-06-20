alter table public.external_entity_links
  drop constraint if exists external_entity_links_confidence_check;

alter table public.external_entity_links
  add constraint external_entity_links_confidence_check
  check (
    confidence in (
      'exact_id',
      'name_context',
      'manual',
      'fallback',
      'created_placeholder',
      'exact_unique_name_context'
    )
  );
