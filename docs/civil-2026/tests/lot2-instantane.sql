-- Empreinte des données touchées par le lot 2 (comparée avant / après rollback).
\pset tuples_only on
\pset format unaligned
select 'schools=' || count(*) || ' md5=' || md5(string_agg(id::text || '|' || name || '|' || type || '|' || coalesce(region, '')
       || '|' || coalesce(city, '') || '|' || coalesce(lat::text, '') || '|' || coalesce(lng::text, '') || '|'
       || coalesce(geo_source, ''), E'\n' order by id))
  from public.schools;
select 'organisations_sources=' || count(*) from public.organisations_sources;
