-- Contrôles après l'apply du lot 3 (lecture seule).
\pset tuples_only on
\pset format unaligned
with o as (select * from public.admin_operations where operation = 'CIVIL_EQUIPES_MOINS18_CREEES' order by le desc limit 1),
     ids as (select jsonb_array_elements_text(o.details->'ids')::uuid as id from o)
select 'creees=' || count(*) || ' actives=' || count(*) filter (where t.is_active) || ' saison_2026_2027='
       || count(*) filter (where t.season = '2026-2027') || ' sous_ligue_civile=' || count(*) filter (where s.type = 'LIGUE_CIVILE')
       || ' sous_ecole=' || count(*) filter (where s.type = 'SECONDAIRE')
  from public.teams t join ids using (id) join public.schools s on s.id = t.school_id;
with o as (select * from public.admin_operations where operation = 'CIVIL_EQUIPES_MOINS18_CREEES' order by le desc limit 1),
     ids as (select jsonb_array_elements_text(o.details->'ids')::uuid as id from o)
select sp.nom || ' ' || t.age_group || '=' || count(*)
  from public.teams t join ids using (id) join public.sports sp on sp.id = t.sport_id group by sp.nom, t.age_group order by 1;
with o as (select * from public.admin_operations where operation = 'CIVIL_EQUIPES_MOINS18_CREEES' order by le desc limit 1),
     ids as (select jsonb_array_elements_text(o.details->'ids')::uuid as id from o)
select 'sans_cle_source=' || count(*) from ids where not exists (select 1 from public.equipes_sources e where e.team_id = ids.id);
select 'equipes_sources=' || count(*) || ' par_source=' || string_agg(distinct source_nom, ',') from public.equipes_sources;
select 'accents corrompus=' || count(*) from public.teams
 where name ~ '[éèêàâôîçÉÈÀÎ]' and octet_length(name) = char_length(name);
select 'initiales (XX) restantes=' || count(*) from public.teams t join public.equipes_sources e on e.team_id = t.id
 where t.name ~ '\((?!SR|AA|AS|CS|SC|FC)[A-Z]{2,3}\)\s*$';
