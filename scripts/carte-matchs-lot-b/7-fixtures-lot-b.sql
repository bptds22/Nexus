-- Fixtures LOCALES du lot B (carte des matchs). Tout porte « Cmatchs » ou un
-- id 77770000-…-00fX ; nettoyage : 9-nettoyer-lot-b.sql. À jouer APRÈS
-- scripts/carte-matchs-preuves/4-fixtures-profils.sql (athlètes « Cprofils »).
begin;
-- Un match CIVIL sans coordonnées, sur un terrain géocodé (lieux_geocodes).
insert into public.games (id, season, phase, game_date, game_time, venue, venue_lat, venue_lon,
                          home_name_raw, visitor_name_raw, sector, source_nom, sport, category, division, league_name, is_released)
values ('77770000-0000-0000-0000-0000000000f1', '2026', 'Saison', '2026-10-10', '18:00', 'Parc des Bénévoles', null, null,
        'Cougars Cmatchs', 'Vikings Cmatchs', null, 'LFMM', 'Football', 'Juvénile', 'D1', 'LFMM Juvénile Cmatchs', true);
-- Un match RSEQ aux coordonnées FAUSSES (0,0) → lieu non précisé.
insert into public.games (id, season, phase, game_date, game_time, venue, venue_lat, venue_lon,
                          home_name_raw, visitor_name_raw, sector, source_nom, sport, category, division, league_name, is_released)
values ('77770000-0000-0000-0000-0000000000f2', '2026-2027', 'Saison', '2026-10-10', '19:00', 'Terrain Zéro Cmatchs', 0, 0,
        'Zéro A Cmatchs', 'Zéro B Cmatchs', 'Secondaire', 'RSEQ', 'Football', 'Cadet', 'D2', 'Football C M D2 Cmatchs', true);
-- Le terrain civil, géocodé (coordonnées Nominatim du CSV de revue).
insert into public.lieux_geocodes (nom_normalise, nom_affiche, lat, lon, source)
values (public.lieu_normalise('Parc des Bénévoles'), 'Parc des Bénévoles', 45.506040, -73.802563, 'nominatim');
commit;
