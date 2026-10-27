-- Contrôles après l'apply du lot 2 (lecture seule).
\pset tuples_only on
\pset format unaligned
with o as (select * from public.admin_operations where operation = 'CIVIL_ORGANISATIONS_CREEES' order by le desc limit 1),
     ids as (select jsonb_array_elements_text(o.details->'nouvelles_ids')::uuid as id from o)
select 'creees=' || count(*) || ' ligue_civile=' || count(*) filter (where s.type = 'LIGUE_CIVILE')
       || ' geocodees=' || count(s.lat) || ' approx=' || count(*) filter (where s.geo_source = 'approx')
       || ' avec_region=' || count(s.region) || ' avec_ville=' || count(s.city)
  from public.schools s join ids using (id);
select 'existantes geocodees par le lot=' || count(*)
  from public.schools s, (select * from public.admin_operations where operation = 'CIVIL_ORGANISATIONS_CREEES' order by le desc limit 1) o,
       jsonb_array_elements(o.details->'geo_existantes') g
 where s.id = (g->>'id')::uuid and s.geo_source = 'approx';
select 'accents corrompus (octets = caracteres sur un nom accentue)=' || count(*)
  from public.schools where type = 'LIGUE_CIVILE' and name ~ '[éèêàâôîçÉÈÀÎ]' and octet_length(name) = char_length(name);
select 'coordonnees hors Quebec/Ontario=' || count(*)
  from public.schools where geo_source = 'approx' and type = 'LIGUE_CIVILE' and not (lat between 44 and 63 and lng between -80 and -57);
select 'correspondances=' || count(*) || ' cles distinctes=' || count(distinct (source_nom, source_cle))
  from public.organisations_sources;
