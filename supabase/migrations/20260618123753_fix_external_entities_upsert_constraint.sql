-- Allow PostgREST upserts on external source IDs.
-- A normal unique index is needed for on_conflict="source,entity_type,external_id".
-- PostgreSQL still allows multiple NULL external_id values under this index.

CREATE UNIQUE INDEX IF NOT EXISTS external_entities_source_type_external_id_key
  ON public.external_entities (source, entity_type, external_id);

