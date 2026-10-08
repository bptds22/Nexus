-- Terrains civils validés par BP → lieux_geocodes (carte des matchs, lot B).
-- Généré par scripts/carte-matchs-lot-b/ecrire-lieux.mjs depuis terrains-civils-final.csv.
-- 31 terrain(s). Transaction gardée : exactement 31 ligne(s) insérée(s)
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
    ('centre claude robillard 1', 'Centre Claude-Robillard', 45.551838, -73.635135, 'manuel'),
    ('d arcy mcgee', 'D''Arcy McGee', 45.422141, -75.805595, 'manuel'),
    ('ecole armand corbeil', 'École Armand-Corbeil', 45.707758, -73.641701, 'nominatim'),
    ('ecole secondaire du chene bleu', 'École secondaire du Chêne-Bleu', 45.384671, -73.971427, 'nominatim'),
    ('ecole secondaire le boise', 'École secondaire Le Boisé', 46.061277, -71.941484, 'nominatim'),
    ('ecole secondaire polybel', 'École secondaire Polybel', 45.572022, -73.218695, 'nominatim'),
    ('ecole secondaire polybel polybel', 'École secondaire Polybel', 45.572022, -73.218695, 'nominatim'),
    ('gil o julien park', 'Gil O. Julien Park', 45.428836, -75.661359, 'nominatim'),
    ('glenn f mchugh field', 'Glenn F. McHugh Field', 45.482828, -73.80592, 'manuel'),
    ('nepean sportsplex', 'Nepean Sportsplex', 45.327124, -75.745292, 'nominatim'),
    ('parc catherine bousquet', 'Parc Catherine-Bousquet', 45.788701, -73.420264, 'nominatim'),
    ('parc des benevoles', 'Parc des Bénévoles', 45.442127, -73.884571, 'manuel'),
    ('parc des intendants', 'Parc des Intendants', 45.674929, -73.937787, 'nominatim'),
    ('parc ducharme', 'Parc Ducharme', 45.645518, -73.846218, 'manuel'),
    ('parc empire', 'Parc Empire', 45.493429, -73.489829, 'nominatim'),
    ('parc george springate', 'Parc George-Springate', 45.491381, -73.846179, 'nominatim'),
    ('parc gerry datillio', 'Parc Gerry Datillio', 45.552139, -73.741385, 'manuel'),
    ('parc gerry dattillio', 'Parc Gerry Dattillio', 45.552139, -73.741385, 'manuel'),
    ('parc jeanne mance', 'Parc Jeanne Mance', 45.514971, -73.583169, 'nominatim'),
    ('parc lucie f roussel real brodeur', 'Parc Lucie-F.-Roussel', 45.408697, -73.478513, 'nominatim'),
    ('parc pierre laporte elie saab 1', 'Parc Pierre-Laporte', 45.603557, -73.448803, 'manuel'),
    ('parc rabastaliere', 'Parc Rabastalière', 45.530559, -73.342715, 'nominatim'),
    ('parc raymond millar', 'Parc Raymond-Millar', 45.607384, -73.784132, 'nominatim'),
    ('parc riverside', 'Parc Riverside', 45.420965, -73.611446, 'nominatim'),
    ('parc saint laurent', 'Parc Saint-Laurent', 45.527097, -73.687991, 'nominatim'),
    ('parc st laurent', 'Parc St Laurent', 45.527097, -73.687991, 'nominatim'),
    ('rosemere high school', 'Rosemere High School', 45.64667, -73.784415, 'nominatim'),
    ('stade alphonse desjardins', 'Stade Alphonse-Desjardins', 45.29877, -73.271608, 'nominatim'),
    ('stade hebert', 'Stade Hebert', 45.573958, -73.595063, 'manuel'),
    ('terrain martin charpentier', 'terrain Martin Charpentier', 45.86003, -72.474036, 'manuel'),
    ('westwood jr 2', 'Westwood Jr', 45.434959, -74.150389, 'nominatim')
    ) as v(cle, nom, lat, lon, src);

  insert into public.admin_operations (operation, motif, details, par)
  values ('LIEUX_GEOCODES_ECRITS', 'Terrains civils géocodés, revus par BP (carte des matchs, lot B)',
          jsonb_build_object('nombre', 31, 'cles', jsonb_build_array('centre claude robillard 1', 'd arcy mcgee', 'ecole armand corbeil', 'ecole secondaire du chene bleu', 'ecole secondaire le boise', 'ecole secondaire polybel', 'ecole secondaire polybel polybel', 'gil o julien park', 'glenn f mchugh field', 'nepean sportsplex', 'parc catherine bousquet', 'parc des benevoles', 'parc des intendants', 'parc ducharme', 'parc empire', 'parc george springate', 'parc gerry datillio', 'parc gerry dattillio', 'parc jeanne mance', 'parc lucie f roussel real brodeur', 'parc pierre laporte elie saab 1', 'parc rabastaliere', 'parc raymond millar', 'parc riverside', 'parc saint laurent', 'parc st laurent', 'rosemere high school', 'stade alphonse desjardins', 'stade hebert', 'terrain martin charpentier', 'westwood jr 2')),
          v_bp);

  select count(*) into n_apres from public.lieux_geocodes;
  select count(*) into n_ops_apres from public.admin_operations;
  if n_apres - n_avant <> 31 or n_ops_apres - n_ops_avant <> 1 then
    raise exception 'NEXUS: garde échouée (lieux +%, ops +%) — rien écrit', n_apres - n_avant, n_ops_apres - n_ops_avant;
  end if;
  raise notice 'OK : % terrain(s) écrit(s), 1 ligne admin_operations', n_apres - n_avant;
end $$;
