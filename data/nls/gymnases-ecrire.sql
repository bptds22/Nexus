-- Terrains civils validés par BP → lieux_geocodes (carte des matchs, lot B).
-- Généré par scripts/carte-matchs-lot-b/ecrire-lieux.mjs depuis gymnases-revue.csv.
-- 6 terrain(s). Transaction gardée : exactement 6 ligne(s) insérée(s)
-- et 1 ligne admin_operations, sinon RIEN n'est écrit.
do $$
declare
  v_bp uuid;
  n_avant int; n_apres int; n_ops_avant int; n_ops_apres int;
begin
  select id into strict v_bp from public.users where email = 'bptds22@gmail.com';
  select count(*) into n_avant from public.lieux_geocodes;
  select count(*) into n_ops_avant from public.admin_operations;

  insert into public.lieux_geocodes (nom_normalise, nom_affiche, lat, lon, source, revu_par, revu_le)
  select v.cle, v.nom, v.lat, v.lon, v.src, v_bp, now()
    from (values
    ('ecole secondaire dalbe viau court 1', 'École secondaire Dalbé-Viau (Court 1)', 45.4429268, -73.6788523, 'nominatim'),
    ('ecole secondaire dalbe viau court 2', 'École secondaire Dalbé-Viau (Court 2)', 45.4429268, -73.6788523, 'nominatim'),
    ('cegep bois de boulogne court 1', 'Cégep Bois de Boulogne (Court 1)', 45.5383509, -73.6759767, 'nominatim'),
    ('ecole secondaire pointe aux trembles court 1', 'École secondaire Pointe-Aux-Trembles (Court 1)', 45.68561319, -73.495074582, 'manuel'),
    ('college st jean vianney court 1', 'Collège St-Jean-Vianney (Court 1)', 45.6925505, -73.520054, 'nominatim'),
    ('college st jean vianney court 2', 'Collège St-Jean-Vianney (Court 2)', 45.6925505, -73.520054, 'nominatim')
    ) as v(cle, nom, lat, lon, src);

  insert into public.admin_operations (operation, motif, details, par)
  values ('LIEUX_GEOCODES_ECRITS', 'Terrains civils géocodés, revus par BP (carte des matchs, lot B)',
          jsonb_build_object('nombre', 6, 'cles', jsonb_build_array('ecole secondaire dalbe viau court 1', 'ecole secondaire dalbe viau court 2', 'cegep bois de boulogne court 1', 'ecole secondaire pointe aux trembles court 1', 'college st jean vianney court 1', 'college st jean vianney court 2')),
          v_bp);

  select count(*) into n_apres from public.lieux_geocodes;
  select count(*) into n_ops_apres from public.admin_operations;
  if n_apres - n_avant <> 6 or n_ops_apres - n_ops_avant <> 1 then
    raise exception 'NEXUS: garde échouée (lieux +%, ops +%) — rien écrit', n_apres - n_avant, n_ops_apres - n_ops_avant;
  end if;
  raise notice 'OK : % terrain(s) écrit(s), 1 ligne admin_operations', n_apres - n_avant;
end $$;
