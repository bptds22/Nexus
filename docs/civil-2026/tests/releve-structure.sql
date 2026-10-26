-- Relevé de structure (lecture seule) comparé avant / après rollback.
\pset tuples_only on
\pset format unaligned
select 'col|' || column_name || '|' || data_type || '|' || is_nullable from information_schema.columns
 where table_schema = 'public' and table_name = 'games' order by column_name;
select 'con|' || conname || '|' || pg_get_constraintdef(oid) from pg_constraint
 where conrelid = 'public.games'::regclass order by conname;
select 'idx|' || indexname || '|' || indexdef from pg_indexes
 where schemaname = 'public' and tablename = 'games' order by indexname;
select 'tab|' || coalesce(to_regclass('public.equipes_sources')::text, '-') || '|'
       || coalesce(to_regclass('public.organisations_sources')::text, '-');
select 'com|' || col_description('public.games'::regclass,
       (select attnum from pg_attribute where attrelid = 'public.games'::regclass and attname = 'source_nom'));
select 'n_games|' || count(*) from public.games;
