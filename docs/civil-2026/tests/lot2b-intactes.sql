-- Après l'apply du lot 2b : les coordonnées qui existaient AVANT n'ont pas bougé.
-- _avant est rempli par le banc juste avant l'apply (même session psql : -c + -f enchaînés).
\pset tuples_only on
\pset format unaligned
select 'coordonnees_existantes_modifiees=' || count(*)
  from public._banc_lot2b_avant a join public.schools s on s.id = a.id
 where s.lat is distinct from a.lat or s.lng is distinct from a.lng or s.geo_source is distinct from a.geo_source;
select 'poses_par_le_lot=' || count(*) from public.schools s
 where s.lat is not null and not exists (select 1 from public._banc_lot2b_avant a where a.id = s.id);
