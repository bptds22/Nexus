-- ════════════════════════════════════════════════════════════════════════════
-- Lot de données E6 (coordonnées des 59 universités, carte du Canada) — APPLY RÉEL EN PROD (sur GO BP seulement).
-- Source : OpenStreetMap Nominatim (OpenStreetMap Nominatim (https://nominatim.openstreetmap.org), données © contributeurs OpenStreetMap, ODbL), une requête et un objet OSM par ligne
-- (scripts/cegep-lot-d/universites-geo.json, données 8fe0cecee24fbf8c196fb6c241eb09f5). Même voie que les cégeps (geo_source = 'nominatim').
-- Seules lat, lng et geo_source des universités changent ; la lecture des universités reste masquée hors admin
-- (et cégépien sous ON, E1). Lancer SANS -1, en postgres.
-- ════════════════════════════════════════════════════════════════════════════
\set ON_ERROR_STOP 1
\pset pager off
begin;
set local lock_timeout = '3s';
set local statement_timeout = '60s';
set local application_name = 'nexus-apply-cegep-e6-geo';
create temp table _g (universite text primary key, province text not null, lat double precision not null, lng double precision not null,
                      osm text not null, source text not null) on commit drop;
insert into _g values
  ('Acadia University', 'NS', 45.0882491, -64.3665898, 'relation/17539494', 'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=ca&addressdetails=1&accept-language=fr&q=Acadia%20University%2C%20Wolfville%2C%20Nova%20Scotia'),
  ('Algoma University', 'ON', 46.5020266, -84.287464, 'way/597120222', 'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=ca&addressdetails=1&accept-language=fr&q=Algoma%20University%2C%20Sault%20Ste.%20Marie%2C%20Ontario'),
  ('Brandon University', 'MB', 49.84456, -99.9637825, 'relation/13894233', 'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=ca&addressdetails=1&accept-language=fr&q=Brandon%20University%2C%20Brandon%2C%20Manitoba'),
  ('Brock University', 'ON', 43.1177355, -79.2498568, 'relation/16113732', 'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=ca&addressdetails=1&accept-language=fr&q=Brock%20University%2C%20St.%20Catharines%2C%20Ontario'),
  ('Cape Breton University', 'NS', 46.1679892, -60.0905367, 'way/209084181', 'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=ca&addressdetails=1&accept-language=fr&q=Cape%20Breton%20University'),
  ('Carleton University', 'ON', 45.3858581, -75.6950041, 'way/10583513', 'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=ca&addressdetails=1&accept-language=fr&q=Carleton%20University%2C%20Ottawa%2C%20Ontario'),
  ('Dalhousie University', 'NS', 44.636201, -63.5919961, 'relation/17335000', 'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=ca&addressdetails=1&accept-language=fr&q=Dalhousie%20University%2C%20Halifax%2C%20Nova%20Scotia'),
  ('École de technologie supérieure', 'QC', 45.4945155, -73.5628555, 'way/960598270', 'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=ca&addressdetails=1&accept-language=fr&q=%C3%89cole%20de%20technologie%20sup%C3%A9rieure%2C%20Montr%C3%A9al%2C%20Qu%C3%A9bec'),
  ('Lakehead University', 'ON', 48.4203116, -89.2623395, 'way/369361463', 'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=ca&addressdetails=1&accept-language=fr&q=Lakehead%20University%2C%20Thunder%20Bay%2C%20Ontario'),
  ('MacEwan University', 'AB', 53.547357, -113.5075424, 'way/169998562', 'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=ca&addressdetails=1&accept-language=fr&q=MacEwan%20University%2C%20Edmonton%2C%20Alberta'),
  ('McMaster University', 'ON', 43.2639397, -79.9178252, 'way/23122301', 'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=ca&addressdetails=1&accept-language=fr&q=McMaster%20University%2C%20Hamilton%2C%20Ontario'),
  ('Memorial University of Newfoundland', 'NL', 47.5733474, -52.7333092, 'way/843545518', 'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=ca&addressdetails=1&accept-language=fr&q=Memorial%20University%20of%20Newfoundland'),
  ('Mount Allison University', 'NB', 45.8993961, -64.373099, 'way/23903148', 'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=ca&addressdetails=1&accept-language=fr&q=Mount%20Allison%20University%2C%20Sackville%2C%20New%20Brunswick'),
  ('Mount Royal University', 'AB', 51.0116203, -114.1307018, 'way/9333285', 'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=ca&addressdetails=1&accept-language=fr&q=Mount%20Royal%20University%2C%20Calgary%2C%20Alberta'),
  ('Nipissing University', 'ON', 46.3438166, -79.4899208, 'relation/19536675', 'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=ca&addressdetails=1&accept-language=fr&q=Nipissing%20University%2C%20North%20Bay%2C%20Ontario'),
  ('Ontario Tech University', 'ON', 43.9483414, -78.8982025, 'relation/16362741', 'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=ca&addressdetails=1&accept-language=fr&q=Ontario%20Tech%20University%2C%20Oshawa%2C%20Ontario'),
  ('Queen''s University', 'ON', 44.2263489, -76.4957555, 'relation/20513072', 'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=ca&addressdetails=1&accept-language=fr&q=Queen''s%20University%2C%20Kingston%2C%20Ontario'),
  ('Saint Mary''s University', 'NS', 44.6311146, -63.580134, 'relation/17335004', 'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=ca&addressdetails=1&accept-language=fr&q=Saint%20Mary''s%20University%2C%20Halifax%2C%20Nova%20Scotia'),
  ('St. Francis Xavier University', 'NS', 45.6175274, -61.994883, 'relation/17545384', 'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=ca&addressdetails=1&accept-language=fr&q=St.%20Francis%20Xavier%20University%2C%20Antigonish%2C%20Nova%20Scotia'),
  ('St. Thomas University', 'NB', 45.9441541, -66.6458706, 'way/19797972', 'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=ca&addressdetails=1&accept-language=fr&q=St.%20Thomas%20University%2C%20Fredericton%2C%20New%20Brunswick'),
  ('Thompson Rivers University', 'BC', 50.6724455, -120.3640266, 'way/225179703', 'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=ca&addressdetails=1&accept-language=fr&q=Thompson%20Rivers%20University%2C%20Kamloops%2C%20British%20Columbia'),
  ('Toronto Metropolitan University', 'ON', 43.6585342, -79.3784674, 'relation/16358719', 'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=ca&addressdetails=1&accept-language=fr&q=Toronto%20Metropolitan%20University%2C%20Toronto%2C%20Ontario'),
  ('Trent University', 'ON', 44.3572933, -78.2893817, 'way/755549715', 'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=ca&addressdetails=1&accept-language=fr&q=Trent%20University%2C%20Peterborough%2C%20Ontario'),
  ('Trinity Western University', 'BC', 49.140435, -122.5991331, 'way/24594624', 'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=ca&addressdetails=1&accept-language=fr&q=Trinity%20Western%20University%2C%20Langley%2C%20British%20Columbia'),
  ('Université Bishop''s', 'QC', 45.3612321, -71.8413609, 'relation/19344839', 'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=ca&addressdetails=1&accept-language=fr&q=Universit%C3%A9%20Bishop''s%2C%20Sherbrooke%2C%20Qu%C3%A9bec'),
  ('Université Concordia', 'QC', 45.4582595, -73.6393547, 'way/468560154', 'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=ca&addressdetails=1&accept-language=fr&q=Universit%C3%A9%20Concordia%2C%20Montr%C3%A9al%2C%20Qu%C3%A9bec'),
  ('Université d''Ottawa', 'ON', 45.4225271, -75.6833904, 'way/351751481', 'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=ca&addressdetails=1&accept-language=fr&q=University%20of%20Ottawa%2C%2075%20Laurier%20Avenue%20East%2C%20Ottawa'),
  ('Université de Moncton', 'NB', 46.1055872, -64.786989, 'way/98935667', 'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=ca&addressdetails=1&accept-language=fr&q=Universit%C3%A9%20de%20Moncton%2C%20Moncton%2C%20New%20Brunswick'),
  ('Université de Montréal', 'QC', 45.5047577, -73.6145418, 'relation/3437968', 'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=ca&addressdetails=1&accept-language=fr&q=Universit%C3%A9%20de%20Montr%C3%A9al%2C%20Montr%C3%A9al%2C%20Qu%C3%A9bec'),
  ('Université de Sherbrooke', 'QC', 45.3767733, -71.940274, 'relation/11969384', 'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=ca&addressdetails=1&accept-language=fr&q=Universit%C3%A9%20de%20Sherbrooke%2C%20Sherbrooke%2C%20Qu%C3%A9bec'),
  ('Université du Québec à Chicoutimi', 'QC', 48.4187009, -71.0521267, 'relation/21112385', 'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=ca&addressdetails=1&accept-language=fr&q=Universit%C3%A9%20du%20Qu%C3%A9bec%20%C3%A0%20Chicoutimi%2C%20Saguenay%2C%20Qu%C3%A9bec'),
  ('Université du Québec à Montréal', 'QC', 45.5098634, -73.5693377, 'relation/13120077', 'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=ca&addressdetails=1&accept-language=fr&q=Universit%C3%A9%20du%20Qu%C3%A9bec%20%C3%A0%20Montr%C3%A9al'),
  ('Université du Québec à Rimouski', 'QC', 48.4521682, -68.5121389, 'way/473033703', 'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=ca&addressdetails=1&accept-language=fr&q=Universit%C3%A9%20du%20Qu%C3%A9bec%20%C3%A0%20Rimouski%2C%20Rimouski%2C%20Qu%C3%A9bec'),
  ('Université du Québec à Trois-Rivières', 'QC', 46.3460943, -72.5829972, 'way/69828841', 'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=ca&addressdetails=1&accept-language=fr&q=Universit%C3%A9%20du%20Qu%C3%A9bec%20%C3%A0%20Trois-Rivi%C3%A8res%2C%20Trois-Rivi%C3%A8res%2C%20Qu%C3%A9bec'),
  ('Université du Québec en Outaouais', 'QC', 45.4221527, -75.7390907, 'way/162003784', 'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=ca&addressdetails=1&accept-language=fr&q=Universit%C3%A9%20du%20Qu%C3%A9bec%20en%20Outaouais%2C%20Gatineau%2C%20Qu%C3%A9bec'),
  ('Université Laurentienne', 'ON', 46.4666416, -80.9738711, 'node/333473845', 'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=ca&addressdetails=1&accept-language=fr&q=Laurentian%20University%2C%20Ramsey%20Lake%20Road%2C%20Sudbury'),
  ('Université Laval', 'QC', 46.7811677, -71.2741361, 'relation/21100815', 'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=ca&addressdetails=1&accept-language=fr&q=Universit%C3%A9%20Laval%2C%20Qu%C3%A9bec%2C%20Qu%C3%A9bec'),
  ('Université McGill', 'QC', 45.5068861, -73.5787118, 'way/19912449', 'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=ca&addressdetails=1&accept-language=fr&q=McGill%20University'),
  ('University of Alberta', 'AB', 53.52682, -113.5244937, 'relation/10238561', 'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=ca&addressdetails=1&accept-language=fr&q=University%20of%20Alberta%2C%20Edmonton%2C%20Alberta'),
  ('University of British Columbia', 'BC', 49.2578915, -123.2429755, 'relation/11678160', 'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=ca&addressdetails=1&accept-language=fr&q=University%20of%20British%20Columbia%2C%20Vancouver%2C%20British%20Columbia'),
  ('University of British Columbia Okanagan', 'BC', 49.9421753, -119.3990282, 'way/123757617', 'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=ca&addressdetails=1&accept-language=fr&q=University%20of%20British%20Columbia%20Okanagan%2C%20Kelowna%2C%20British%20Columbia'),
  ('University of Calgary', 'AB', 51.075054, -114.138805, 'way/4814074', 'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=ca&addressdetails=1&accept-language=fr&q=University%20of%20Calgary%2C%20Calgary%2C%20Alberta'),
  ('University of Guelph', 'ON', 43.5327864, -80.2249974, 'way/161269498', 'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=ca&addressdetails=1&accept-language=fr&q=University%20of%20Guelph%2C%20Guelph%2C%20Ontario'),
  ('University of Lethbridge', 'AB', 49.6744567, -112.8606051, 'way/18410433', 'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=ca&addressdetails=1&accept-language=fr&q=University%20of%20Lethbridge%2C%20Lethbridge%2C%20Alberta'),
  ('University of Manitoba', 'MB', 49.8091536, -97.1330418, 'relation/19825023', 'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=ca&addressdetails=1&accept-language=fr&q=University%20of%20Manitoba%2C%20Winnipeg%2C%20Manitoba'),
  ('University of New Brunswick', 'NB', 45.9455202, -66.6401861, 'relation/17688619', 'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=ca&addressdetails=1&accept-language=fr&q=University%20of%20New%20Brunswick%2C%20Fredericton%2C%20New%20Brunswick'),
  ('University of Northern British Columbia', 'BC', 53.8925662, -122.8147159, 'way/446564130', 'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=ca&addressdetails=1&accept-language=fr&q=University%20of%20Northern%20British%20Columbia%2C%20Prince%20George%2C%20British%20Columbia'),
  ('University of Prince Edward Island', 'PE', 46.2587601, -63.14019, 'way/398765997', 'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=ca&addressdetails=1&accept-language=fr&q=University%20of%20Prince%20Edward%20Island%2C%20Charlottetown%2C%20Prince%20Edward%20Island'),
  ('University of Regina', 'SK', 50.4152275, -104.589, 'way/155526740', 'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=ca&addressdetails=1&accept-language=fr&q=University%20of%20Regina%2C%20Regina%2C%20Saskatchewan'),
  ('University of Saskatchewan', 'SK', 52.1344194, -106.6277843, 'relation/13754325', 'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=ca&addressdetails=1&accept-language=fr&q=University%20of%20Saskatchewan%2C%20Saskatoon%2C%20Saskatchewan'),
  ('University of the Fraser Valley', 'BC', 49.0283444, -122.284907, 'relation/8909832', 'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=ca&addressdetails=1&accept-language=fr&q=University%20of%20the%20Fraser%20Valley%2C%20Abbotsford%2C%20British%20Columbia'),
  ('University of Toronto', 'ON', 43.6634681, -79.3968165, 'relation/18447148', 'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=ca&addressdetails=1&accept-language=fr&q=University%20of%20Toronto%2C%20Toronto%2C%20Ontario'),
  ('University of Victoria', 'BC', 48.4620599, -123.3114198, 'relation/1373463', 'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=ca&addressdetails=1&accept-language=fr&q=University%20of%20Victoria%2C%20British%20Columbia'),
  ('University of Waterloo', 'ON', 43.4701994, -80.5452429, 'relation/11680616', 'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=ca&addressdetails=1&accept-language=fr&q=University%20of%20Waterloo%2C%20Waterloo%2C%20Ontario'),
  ('University of Windsor', 'ON', 42.3051498, -83.0664983, 'relation/9674137', 'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=ca&addressdetails=1&accept-language=fr&q=University%20of%20Windsor%2C%20Windsor%2C%20Ontario'),
  ('University of Winnipeg', 'MB', 49.8914788, -97.1534174, 'relation/19430583', 'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=ca&addressdetails=1&accept-language=fr&q=University%20of%20Winnipeg%2C%20Winnipeg%2C%20Manitoba'),
  ('Western University', 'ON', 43.0054234, -81.274801, 'way/174869710', 'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=ca&addressdetails=1&accept-language=fr&q=Western%20University%2C%20London%2C%20Ontario'),
  ('Wilfrid Laurier University', 'ON', 43.4727989, -80.5280863, 'way/226405688', 'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=ca&addressdetails=1&accept-language=fr&q=Wilfrid%20Laurier%20University%2C%20Waterloo%2C%20Ontario'),
  ('York University', 'ON', 43.7741755, -79.504749, 'way/15396822', 'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=ca&addressdetails=1&accept-language=fr&q=York%20University%2C%20Toronto%2C%20Ontario');
do $$
begin
  if current_user <> 'postgres' then raise exception 'NEXUS: lancer en postgres'; end if;
  if exists (select 1 from _g g where (select count(*) from public.schools s where s.name = g.universite and s.type = 'UNIVERSITE' and s.province = g.province) <> 1) then
    raise exception 'NEXUS: une université du relevé ne correspond pas à exactement une université';
  end if;
end $$;

do $$ begin
  if exists (select 1 from public.admin_operations where operation like 'CEGEP_LOT_E6_GEO_UNIVERSITES%') then raise exception 'NEXUS: lot déjà tracé'; end if;
  if exists (select 1 from public.schools where type = 'UNIVERSITE' and (lat is not null or lng is not null)) then
    raise exception 'NEXUS: des universités ont déjà des coordonnées — relire';
  end if;
end $$;
create temp table _avant on commit drop as
select md5(string_agg(id::text || coalesce(lat::text, '') || coalesce(lng::text, '') || coalesce(geo_source, ''), ',' order by id)) e
  from public.schools where type <> 'UNIVERSITE';
update public.schools s set lat = g.lat, lng = g.lng, geo_source = 'nominatim'
  from _g g where s.name = g.universite and s.type = 'UNIVERSITE' and s.province = g.province;
select count(*) filter (where lat is not null) as universites_geocodees, count(*) as universites,
       round(min(lat)::numeric, 2) as lat_min, round(max(lat)::numeric, 2) as lat_max, round(min(lng)::numeric, 2) as lng_min, round(max(lng)::numeric, 2) as lng_max
  from public.schools where type = 'UNIVERSITE';
do $$ begin
  if (select count(*) from public.schools where type = 'UNIVERSITE' and lat is not null and geo_source = 'nominatim') <> 59 then
    raise exception 'NEXUS: toutes les universités ne sont pas géocodées';
  end if;
  if (select md5(string_agg(id::text || coalesce(lat::text, '') || coalesce(lng::text, '') || coalesce(geo_source, ''), ',' order by id))
        from public.schools where type <> 'UNIVERSITE') is distinct from (select e from _avant) then
    raise exception 'NEXUS: une école non universitaire a bougé';
  end if;
  raise notice 'NEXUS: VERDICT E6 géo — 59 universités géocodées (Nominatim), rien d''autre ne bouge';
end $$;
select 'VERDICT' as verdict, 'conforme' as resultat;

do $$ begin if public.lancement_universitaire_actif() then raise exception 'NEXUS: l''interrupteur doit rester OFF'; end if; end $$;
insert into public.admin_operations (operation, motif, details, par)
values ('CEGEP_LOT_E6_GEO_UNIVERSITES', 'Chantier cégep, lot E6 : coordonnées des 59 universités (OpenStreetMap Nominatim) pour la carte du Canada (GO BP)',
        jsonb_build_object('universites', 59, 'releve', '2026-10-28', 'empreinte_donnees', '8fe0cecee24fbf8c196fb6c241eb09f5', 'donnees', 'scripts/cegep-lot-d/universites-geo.json'),
        (select id from public.users where id = 'f51384b5-a2c2-4827-9137-8aa8d29a1fe0'));
commit;
\echo '== COMMIT fait : coordonnées des universités en prod.'
