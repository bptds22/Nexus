-- Relevé du lot 2b (lecture seule) : points avant / après, coordonnées existantes intactes, zone.
\pset tuples_only on
\pset format unaligned
select 'ligue_civile=' || count(*) || ' avec_point=' || count(lat) from public.schools where type = 'LIGUE_CIVILE';
select 'empreinte_toutes_coordonnees=' || md5(string_agg(id::text || '|' || coalesce(lat::text, '') || '|' || coalesce(lng::text, '')
       || '|' || coalesce(geo_source, ''), E'\n' order by id)) from public.schools;
select 'hors_quebec_ontario=' || count(*) from public.schools
 where type = 'LIGUE_CIVILE' and lat is not null and not (lat between 44 and 63 and lng between -80 and -57);
