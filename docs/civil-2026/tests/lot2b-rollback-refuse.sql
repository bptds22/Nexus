-- Le rollback du lot 2b doit REFUSER si une coordonnée posée a été modifiée depuis.
\set ON_ERROR_STOP on
begin;
update public.schools set lat = lat + 0.001
 where id = (select (p->>'id')::uuid from public.admin_operations o, jsonb_array_elements(o.details->'poses') p
              where o.operation = 'CIVIL_GEOCODAGE_VILLES' order by o.le desc limit 1);
\ir ../lot2b/2-rollback.sql
select 'NEXUS: ÉCHEC — le rollback est passé malgré une coordonnée modifiée';
rollback;
