-- Add a covering index for every single-column foreign key in the new module
-- that is not already the first column of an index.

do $discipline_fk_indexes$
declare
  v_fk record;
  v_index_name text;
begin
  for v_fk in
    select
      namespace.nspname as schema_name,
      relation.relname as table_name,
      attribute.attname as column_name
    from pg_constraint constraint_row
    join pg_class relation on relation.oid = constraint_row.conrelid
    join pg_namespace namespace on namespace.oid = relation.relnamespace
    join pg_attribute attribute
      on attribute.attrelid = constraint_row.conrelid
     and attribute.attnum = constraint_row.conkey[1]
    where namespace.nspname = 'public'
      and relation.relname like 'discipline\_%' escape '\'
      and constraint_row.contype = 'f'
      and cardinality(constraint_row.conkey) = 1
      and not exists (
        select 1
        from pg_index index_row
        where index_row.indrelid = constraint_row.conrelid
          and index_row.indisvalid
          and (index_row.indkey::smallint[])[0] = constraint_row.conkey[1]
      )
  loop
    v_index_name := left(
      format('idx_%s_%s_fk', v_fk.table_name, v_fk.column_name),
      63
    );
    execute format(
      'create index if not exists %I on %I.%I (%I)',
      v_index_name,
      v_fk.schema_name,
      v_fk.table_name,
      v_fk.column_name
    );
  end loop;
end
$discipline_fk_indexes$;
