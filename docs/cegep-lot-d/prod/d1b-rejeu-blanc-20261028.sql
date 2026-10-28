-- ════════════════════════════════════════════════════════════════════════════
-- Lot D1b cégep — REJEU À BLANC (finit par ROLLBACK)
-- Les 47 universités U SPORTS hors Québec (OUA, AUS, Canada West ; type UNIVERSITE, avec leur province) et
-- leurs 345 équipes des sports d'équipe de la saison 2026-2027 (sources : U SPORTS et sites des conférences,
-- citées dans scripts/cegep-lot-d/d1b-universites.json, empreinte 8fdef4cfed23d7ff0e74a25fe25c1add).
-- Fichier GÉNÉRÉ par scripts/cegep-lot-d/generer-d1b.mjs <date> <rejeu-blanc|apply|rollback>. Lancer SANS -1, en postgres.
--
-- Opération de DONNÉES (aucun objet de schéma). Préalables : D0, D1a, D1a2, D1 (12 universités du Québec) en prod.
-- Hors RSEQ : pas d'identifiant RSEQ ; chaque école et chaque équipe reçoit un identifiant STABLE calculé à partir de
-- son nom (clé « cle »), pour que le rejeu, l'apply et le rollback désignent les mêmes lignes. Aucun match relié.
-- Aucune fiche athlète, aucun compte, aucun classement touché.
-- Joue aussi le rollback dans la transaction, puis ROLLBACK : rien n'est appliqué.
-- ════════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP 1
\pset pager off
\pset null '·'

begin;
set local lock_timeout = '3s';
set local statement_timeout = '120s';
set local search_path = public, extensions;
set local application_name = 'nexus-rejeu-blanc-cegep-d1b';
select now() as debut, current_user;

create temp table _ecoles (cle uuid primary key, name text not null, team_name text, city text, province text not null,
                           region text, langue text, website text) on commit drop;
insert into _ecoles values
  ('416137e7-8ba7-497a-864e-950788fa0e28', 'Algoma University', 'Thunderbirds', 'Sault Ste. Marie', 'ON', 'Ontario', 'EN', 'https://algomathunderbirds.ca/'),
  ('51b91b4e-312a-4a76-863a-5c755671f94e', 'Brock University', 'Badgers', 'St. Catharines', 'ON', 'Ontario', 'EN', 'https://gobadgers.ca/'),
  ('50c40f3d-1855-4aa5-86ab-d8dedf77383f', 'Carleton University', 'Ravens', 'Ottawa', 'ON', 'Ontario', 'EN', 'https://goravens.ca/'),
  ('1a1eed1a-03db-46f7-80d5-856a9c006b6f', 'University of Guelph', 'Gryphons', 'Guelph', 'ON', 'Ontario', 'EN', 'https://www.home.gryphons.ca/'),
  ('3006598d-a835-4779-81f9-d12398ea49ec', 'Lakehead University', 'Thunderwolves', 'Thunder Bay', 'ON', 'Ontario', 'EN', 'https://lakeheadthunderwolves.com/'),
  ('1debd726-2202-4c83-8f6e-4f956628bfcb', 'Université Laurentienne', 'Voyageurs', 'Sudbury', 'ON', 'Ontario', 'BILINGUE', 'https://luvoyageurs.com/'),
  ('da5d39b4-5a50-48e4-8dea-06a5d8165402', 'McMaster University', 'Marauders', 'Hamilton', 'ON', 'Ontario', 'EN', 'https://marauders.ca/'),
  ('e105da34-db15-4dcf-876c-999d0b86d471', 'Nipissing University', 'Lakers', 'North Bay', 'ON', 'Ontario', 'EN', 'https://nulakers.ca/'),
  ('1eb8ee7c-9043-4b64-8fbc-18c39b25f084', 'Ontario Tech University', 'Ridgebacks', 'Oshawa', 'ON', 'Ontario', 'EN', 'https://goridgebacks.com/'),
  ('35886226-47b0-4288-84e3-67a404766fe9', 'Université d''Ottawa', 'Gee-Gees', 'Ottawa', 'ON', 'Ontario', 'BILINGUE', 'https://geegees.ca/'),
  ('fe8fedd4-68de-4d21-87fa-07388d697dec', 'Queen''s University', 'Gaels', 'Kingston', 'ON', 'Ontario', 'EN', 'https://gogaelsgo.com/'),
  ('72e49b30-e217-493d-8f66-47ef014d32e9', 'Toronto Metropolitan University', 'Bold', 'Toronto', 'ON', 'Ontario', 'EN', 'https://tmubold.ca/'),
  ('8edce991-be39-4674-8142-13cee4df5f16', 'University of Toronto', 'Varsity Blues', 'Toronto', 'ON', 'Ontario', 'EN', 'https://varsityblues.ca/'),
  ('4bede2c3-3a85-404c-839c-1ad8334b66b5', 'Trent University', 'Excalibur', 'Peterborough', 'ON', 'Ontario', 'EN', 'https://trentexcalibur.ca/'),
  ('fab5f58b-34ac-42c8-846a-8edacc5e3dd9', 'University of Waterloo', 'Warriors', 'Waterloo', 'ON', 'Ontario', 'EN', 'https://athletics.uwaterloo.ca/'),
  ('18cc2cb0-651c-431b-8123-d652249909cd', 'Western University', 'Mustangs', 'London', 'ON', 'Ontario', 'EN', 'https://westernmustangs.ca/'),
  ('bf71c110-98a4-4db6-8b8d-1987eaf0656e', 'Wilfrid Laurier University', 'Golden Hawks', 'Waterloo', 'ON', 'Ontario', 'EN', 'https://laurierathletics.com/'),
  ('72e57db2-b407-4e66-840a-12afbac78c8d', 'University of Windsor', 'Lancers', 'Windsor', 'ON', 'Ontario', 'EN', 'https://golancers.ca/'),
  ('9010d36d-6942-426b-8919-451863bba3c3', 'York University', 'Lions', 'Toronto', 'ON', 'Ontario', 'EN', 'https://yorkulions.ca/'),
  ('c421e8ac-11f8-4c1e-8e59-ba1fbcd4d1e3', 'Acadia University', 'Axemen / Axewomen', 'Wolfville', 'NS', 'Nouvelle-Écosse', 'EN', 'https://acadiaathletics.ca/'),
  ('d09e08f6-d24a-4a7d-839c-f12e6aa99174', 'Cape Breton University', 'Capers', 'Sydney', 'NS', 'Nouvelle-Écosse', 'EN', 'https://gocapersgo.ca/'),
  ('1e001765-69bb-4d63-8d4c-7fb2603c9876', 'Dalhousie University', 'Tigers', 'Halifax', 'NS', 'Nouvelle-Écosse', 'EN', 'https://daltigers.ca/'),
  ('ce40deb7-10f5-4463-8998-4f4aa57c8842', 'Memorial University of Newfoundland', 'Sea-Hawks', 'St. John''s', 'NL', 'Terre-Neuve-et-Labrador', 'EN', 'https://goseahawks.ca/'),
  ('f48ba92a-50e8-44a7-86c5-752768298bac', 'Mount Allison University', 'Mounties', 'Sackville', 'NB', 'Nouveau-Brunswick', 'EN', 'https://mountiepride.ca/'),
  ('55caab73-a9ff-4330-8ed7-2d728c85a6cb', 'Université de Moncton', 'Aigles Bleus / Aigles Bleues', 'Moncton', 'NB', 'Nouveau-Brunswick', 'FR', 'https://goaigles.ca/'),
  ('3d67a1e9-b3d8-484c-8303-beb5bdfd3577', 'University of New Brunswick', 'Reds', 'Fredericton', 'NB', 'Nouveau-Brunswick', 'EN', 'https://goredsgo.ca/'),
  ('c70f6a18-1d63-40fc-84d1-050ada42d2cf', 'University of Prince Edward Island', 'Panthers', 'Charlottetown', 'PE', 'Île-du-Prince-Édouard', 'EN', 'https://gopanthersgo.ca/'),
  ('402ff2a8-96d2-4d64-86e1-0da5c3c95c17', 'Saint Mary''s University', 'Huskies', 'Halifax', 'NS', 'Nouvelle-Écosse', 'EN', 'https://smuhuskies.ca/'),
  ('0c9df422-c400-401a-873a-12c8d53765cb', 'St. Francis Xavier University', 'X-Men / X-Women', 'Antigonish', 'NS', 'Nouvelle-Écosse', 'EN', 'https://goxgo.ca/'),
  ('ff857fa9-7659-4e5b-85ab-e9dcc7386d1e', 'St. Thomas University', 'Tommies', 'Fredericton', 'NB', 'Nouveau-Brunswick', 'EN', 'https://gotommies.ca/'),
  ('5490b434-d8e6-485c-86fd-f97beba7e494', 'University of Alberta', 'Golden Bears / Pandas', 'Edmonton', 'AB', 'Alberta', 'EN', 'https://bearsandpandas.ca/'),
  ('7e5c66c4-0655-4935-805a-acac523ff47e', 'Brandon University', 'Bobcats', 'Brandon', 'MB', 'Manitoba', 'EN', 'https://gobobcats.ca/'),
  ('410b0ea4-12a1-4eb3-89dc-de367f653cf8', 'University of British Columbia', 'Thunderbirds', 'Vancouver', 'BC', 'Colombie-Britannique', 'EN', 'https://gothunderbirds.ca/'),
  ('3c0dea0d-511b-4dcc-8123-c1ce2ef4895c', 'University of British Columbia Okanagan', 'Heat', 'Kelowna', 'BC', 'Colombie-Britannique', 'EN', 'https://goheat.ca/'),
  ('06314265-95e9-4771-8a96-d27bf1755562', 'University of Calgary', 'Dinos', 'Calgary', 'AB', 'Alberta', 'EN', 'https://godinos.com/'),
  ('aef7a714-7a93-4229-8461-0b85c435e21f', 'University of the Fraser Valley', 'Cascades', 'Abbotsford', 'BC', 'Colombie-Britannique', 'EN', 'https://gocascades.ca/'),
  ('76408771-119d-4841-8938-8be5f51eddc0', 'University of Lethbridge', 'Pronghorns', 'Lethbridge', 'AB', 'Alberta', 'EN', 'https://gohorns.ca/'),
  ('c8157ffd-85bc-4061-870b-c9278367861c', 'University of Manitoba', 'Bisons', 'Winnipeg', 'MB', 'Manitoba', 'EN', 'https://gobisons.ca/'),
  ('eba4d04f-358b-4b95-8af7-8dd91ea98f0c', 'MacEwan University', 'Griffins', 'Edmonton', 'AB', 'Alberta', 'EN', 'https://macewangriffins.ca/'),
  ('63873d21-d62e-4e9f-89fc-57f8d672c1bc', 'Mount Royal University', 'Cougars', 'Calgary', 'AB', 'Alberta', 'EN', 'https://mrucougars.com/'),
  ('8257c201-3943-40af-8ff4-c268661130f6', 'University of Northern British Columbia', 'Timberwolves', 'Prince George', 'BC', 'Colombie-Britannique', 'EN', 'https://unbctimberwolves.com/'),
  ('a28d1a52-ac84-43bd-834a-fdad61dd5829', 'University of Regina', 'Cougars / Rams (football)', 'Regina', 'SK', 'Saskatchewan', 'EN', 'https://cougarsandrams.com/'),
  ('f905d209-3487-46f7-8ce9-65f52db124c7', 'University of Saskatchewan', 'Huskies', 'Saskatoon', 'SK', 'Saskatchewan', 'EN', 'https://huskies.usask.ca/'),
  ('f2ad98a1-bc23-4262-82f5-3291ae9c10f4', 'Thompson Rivers University', 'WolfPack', 'Kamloops', 'BC', 'Colombie-Britannique', 'EN', 'https://gowolfpack.ca/'),
  ('c85d71cb-6f10-4794-8e31-f028769a2b49', 'Trinity Western University', 'Spartans', 'Langley', 'BC', 'Colombie-Britannique', 'EN', 'https://gospartans.ca/'),
  ('9860e51e-9d23-4169-8d81-4d6aaff81651', 'University of Victoria', 'Vikes', 'Victoria', 'BC', 'Colombie-Britannique', 'EN', 'https://govikesgo.com/'),
  ('189ec720-0041-486d-8d8f-6102dd5e41fb', 'University of Winnipeg', 'Wesmen', 'Winnipeg', 'MB', 'Manitoba', 'EN', 'https://wesmen.ca/');
create temp table _equipes (cle uuid primary key, cle_ecole uuid not null, nom text not null,
                            sport text not null, gender text, division text, ligue text not null) on commit drop;
insert into _equipes values
  ('85cda7a0-c0d7-4eb1-8356-51765eab6eb5', '50c40f3d-1855-4aa5-86ab-d8dedf77383f', 'Ravens', 'Basketball', 'Masculin', null, 'OUA Basketball M'),
  ('3e05e233-7e1b-4915-873b-e6d579a787e5', '35886226-47b0-4288-84e3-67a404766fe9', 'Gee-Gees', 'Basketball', 'Masculin', null, 'OUA Basketball M'),
  ('69a075fc-ee0e-481d-8c42-7855159059e5', 'fe8fedd4-68de-4d21-87fa-07388d697dec', 'Gaels', 'Basketball', 'Masculin', null, 'OUA Basketball M'),
  ('708ca45e-0e2d-4a27-84fd-dc39173eeda7', 'e105da34-db15-4dcf-876c-999d0b86d471', 'Lakers', 'Basketball', 'Masculin', null, 'OUA Basketball M'),
  ('0fbb9414-9087-44f6-89ca-c0d07542e511', '1debd726-2202-4c83-8f6e-4f956628bfcb', 'Voyageurs', 'Basketball', 'Masculin', null, 'OUA Basketball M'),
  ('11e7075e-eb7e-43be-8409-49f718de7963', '1eb8ee7c-9043-4b64-8fbc-18c39b25f084', 'Ridgebacks', 'Basketball', 'Masculin', null, 'OUA Basketball M'),
  ('086b4c78-9cc8-4b17-875c-da8de402a1da', '8edce991-be39-4674-8142-13cee4df5f16', 'Varsity Blues', 'Basketball', 'Masculin', null, 'OUA Basketball M'),
  ('ee99021f-09d0-4ebd-8ecd-0247ee98754c', '51b91b4e-312a-4a76-863a-5c755671f94e', 'Badgers', 'Basketball', 'Masculin', null, 'OUA Basketball M'),
  ('5ea35cfc-931a-4d88-872e-c2a73c7c2b97', 'da5d39b4-5a50-48e4-8dea-06a5d8165402', 'Marauders', 'Basketball', 'Masculin', null, 'OUA Basketball M'),
  ('6b942c7d-7eb1-41aa-8dea-27f5ad617e2f', '9010d36d-6942-426b-8919-451863bba3c3', 'Lions', 'Basketball', 'Masculin', null, 'OUA Basketball M'),
  ('b4d6d015-dfe9-49ff-8975-9d414c6aaed7', '3006598d-a835-4779-81f9-d12398ea49ec', 'Thunderwolves', 'Basketball', 'Masculin', null, 'OUA Basketball M'),
  ('2fee6e90-8653-4141-8859-45a3270b7646', '72e49b30-e217-493d-8f66-47ef014d32e9', 'Bold', 'Basketball', 'Masculin', null, 'OUA Basketball M'),
  ('2dba83f9-3361-4831-8100-2cd26aebcf7c', '18cc2cb0-651c-431b-8123-d652249909cd', 'Mustangs', 'Basketball', 'Masculin', null, 'OUA Basketball M'),
  ('601afccd-2eb4-402e-873d-0c20a61b45bc', 'fab5f58b-34ac-42c8-846a-8edacc5e3dd9', 'Warriors', 'Basketball', 'Masculin', null, 'OUA Basketball M'),
  ('b75d83bc-82c3-4656-8a7d-66d4b8df763a', '1a1eed1a-03db-46f7-80d5-856a9c006b6f', 'Gryphons', 'Basketball', 'Masculin', null, 'OUA Basketball M'),
  ('33dcfd1f-7ab4-4ae5-82e1-dbd101812276', 'bf71c110-98a4-4db6-8b8d-1987eaf0656e', 'Golden Hawks', 'Basketball', 'Masculin', null, 'OUA Basketball M'),
  ('5390b20b-6c99-4ea8-8000-a7ef19d66a65', '72e57db2-b407-4e66-840a-12afbac78c8d', 'Lancers', 'Basketball', 'Masculin', null, 'OUA Basketball M'),
  ('8275d88d-a21c-4364-853e-a8b1ed5465c1', '416137e7-8ba7-497a-864e-950788fa0e28', 'Thunderbirds', 'Basketball', 'Masculin', null, 'OUA Basketball M'),
  ('1ce2082e-c395-490f-8a08-ce3f2d5eb73d', '50c40f3d-1855-4aa5-86ab-d8dedf77383f', 'Ravens', 'Basketball', 'Féminin', null, 'OUA Basketball F'),
  ('b1592ab1-31b7-467b-8e5e-d71194659516', '1debd726-2202-4c83-8f6e-4f956628bfcb', 'Voyageurs', 'Basketball', 'Féminin', null, 'OUA Basketball F'),
  ('7b22c712-9afe-47c1-87e5-0dbb28a1e92a', '1eb8ee7c-9043-4b64-8fbc-18c39b25f084', 'Ridgebacks', 'Basketball', 'Féminin', null, 'OUA Basketball F'),
  ('76f17a46-e7c4-4073-886a-2f14d725782f', 'fe8fedd4-68de-4d21-87fa-07388d697dec', 'Gaels', 'Basketball', 'Féminin', null, 'OUA Basketball F'),
  ('0bce447c-7a4f-4ea6-8a59-b03128115510', 'e105da34-db15-4dcf-876c-999d0b86d471', 'Lakers', 'Basketball', 'Féminin', null, 'OUA Basketball F'),
  ('9ff45b47-86b1-4342-8195-f066e8aa23ee', '35886226-47b0-4288-84e3-67a404766fe9', 'Gee-Gees', 'Basketball', 'Féminin', null, 'OUA Basketball F'),
  ('5447b09d-f242-4ba7-8e50-1ba1197760bf', '9010d36d-6942-426b-8919-451863bba3c3', 'Lions', 'Basketball', 'Féminin', null, 'OUA Basketball F'),
  ('59449fdb-5f77-4185-8c4f-b0cbce135aaa', '51b91b4e-312a-4a76-863a-5c755671f94e', 'Badgers', 'Basketball', 'Féminin', null, 'OUA Basketball F'),
  ('78eba910-696c-4b12-8fb0-15914771815c', 'da5d39b4-5a50-48e4-8dea-06a5d8165402', 'Marauders', 'Basketball', 'Féminin', null, 'OUA Basketball F'),
  ('30f47325-19d5-4394-88a0-523341e8728b', '72e49b30-e217-493d-8f66-47ef014d32e9', 'Bold', 'Basketball', 'Féminin', null, 'OUA Basketball F'),
  ('8de0ded2-1ec7-4972-8ce7-cff52d1e3065', '8edce991-be39-4674-8142-13cee4df5f16', 'Varsity Blues', 'Basketball', 'Féminin', null, 'OUA Basketball F'),
  ('941e3c23-b135-433d-802d-a247427baddb', '3006598d-a835-4779-81f9-d12398ea49ec', 'Thunderwolves', 'Basketball', 'Féminin', null, 'OUA Basketball F'),
  ('06559f2d-203e-4232-8d0e-f67e7016dbf7', 'fab5f58b-34ac-42c8-846a-8edacc5e3dd9', 'Warriors', 'Basketball', 'Féminin', null, 'OUA Basketball F'),
  ('f9fdc016-2db0-490d-892d-d173bb82ae71', '18cc2cb0-651c-431b-8123-d652249909cd', 'Mustangs', 'Basketball', 'Féminin', null, 'OUA Basketball F'),
  ('983feb83-4ee7-4030-8f6f-0c9e80000e81', '72e57db2-b407-4e66-840a-12afbac78c8d', 'Lancers', 'Basketball', 'Féminin', null, 'OUA Basketball F'),
  ('cf134ec8-820c-4df4-8d98-e044027c2fbe', '416137e7-8ba7-497a-864e-950788fa0e28', 'Thunderbirds', 'Basketball', 'Féminin', null, 'OUA Basketball F'),
  ('c675e289-1389-4fd5-8a97-d96ae098246e', '1a1eed1a-03db-46f7-80d5-856a9c006b6f', 'Gryphons', 'Basketball', 'Féminin', null, 'OUA Basketball F'),
  ('839a8dbf-a681-4254-8aa8-7f049c867585', 'bf71c110-98a4-4db6-8b8d-1987eaf0656e', 'Golden Hawks', 'Basketball', 'Féminin', null, 'OUA Basketball F'),
  ('75c778bb-6997-46d8-843d-4ce8cc21e4b8', 'fe8fedd4-68de-4d21-87fa-07388d697dec', 'Gaels', 'Football', 'Masculin', null, 'OUA Football M'),
  ('8ca8c48f-64af-4d8b-827c-f4ee73da013c', '18cc2cb0-651c-431b-8123-d652249909cd', 'Mustangs', 'Football', 'Masculin', null, 'OUA Football M'),
  ('bbf9a4d9-03f4-416d-8eca-d282962ba476', 'da5d39b4-5a50-48e4-8dea-06a5d8165402', 'Marauders', 'Football', 'Masculin', null, 'OUA Football M'),
  ('23f83d45-ecdd-42ce-8836-155d62cdc962', '72e57db2-b407-4e66-840a-12afbac78c8d', 'Lancers', 'Football', 'Masculin', null, 'OUA Football M'),
  ('bba77ed7-b8bb-438e-81ce-a0321fff2077', '1a1eed1a-03db-46f7-80d5-856a9c006b6f', 'Gryphons', 'Football', 'Masculin', null, 'OUA Football M'),
  ('db5f98cb-e042-4b2a-8cbc-9f48252fae1a', '35886226-47b0-4288-84e3-67a404766fe9', 'Gee-Gees', 'Football', 'Masculin', null, 'OUA Football M'),
  ('2cbff9fc-652c-4a68-8e56-60e2c83b813d', 'bf71c110-98a4-4db6-8b8d-1987eaf0656e', 'Golden Hawks', 'Football', 'Masculin', null, 'OUA Football M'),
  ('b2fb1c7c-cebc-4c50-80c7-80698ce6534b', 'fab5f58b-34ac-42c8-846a-8edacc5e3dd9', 'Warriors', 'Football', 'Masculin', null, 'OUA Football M'),
  ('bd20de1a-3a7e-4531-889f-ad711b6309d7', '9010d36d-6942-426b-8919-451863bba3c3', 'Lions', 'Football', 'Masculin', null, 'OUA Football M'),
  ('3ace1a35-e827-4f09-8909-5ef338b8d60e', '50c40f3d-1855-4aa5-86ab-d8dedf77383f', 'Ravens', 'Football', 'Masculin', null, 'OUA Football M'),
  ('96ae52e8-bf04-4e10-8706-758cdf4f0f1f', '8edce991-be39-4674-8142-13cee4df5f16', 'Varsity Blues', 'Football', 'Masculin', null, 'OUA Football M'),
  ('26b1f695-045d-430e-8c1a-dea260d5511a', '35886226-47b0-4288-84e3-67a404766fe9', 'Gee-Gees', 'Hockey', 'Masculin', null, 'OUA Hockey M'),
  ('faddfce4-1df6-4545-86d7-a3a7120165de', 'e105da34-db15-4dcf-876c-999d0b86d471', 'Lakers', 'Hockey', 'Masculin', null, 'OUA Hockey M'),
  ('17587b10-881a-4f21-8ce7-91898c705d7e', '1eb8ee7c-9043-4b64-8fbc-18c39b25f084', 'Ridgebacks', 'Hockey', 'Masculin', null, 'OUA Hockey M'),
  ('139e2930-d53b-4a4c-82d8-988045da04ba', 'fe8fedd4-68de-4d21-87fa-07388d697dec', 'Gaels', 'Hockey', 'Masculin', null, 'OUA Hockey M'),
  ('af0673d9-4e51-4d22-8fc2-c9cdf1030f83', '50c40f3d-1855-4aa5-86ab-d8dedf77383f', 'Ravens', 'Hockey', 'Masculin', null, 'OUA Hockey M'),
  ('2f1351f3-abdd-47ca-8b26-c248de37f30a', '8edce991-be39-4674-8142-13cee4df5f16', 'Varsity Blues', 'Hockey', 'Masculin', null, 'OUA Hockey M'),
  ('b2a8fdfb-8132-4963-85ce-2bc5ae6fba9c', 'fab5f58b-34ac-42c8-846a-8edacc5e3dd9', 'Warriors', 'Hockey', 'Masculin', null, 'OUA Hockey M'),
  ('4628e377-a9fb-4433-8118-5a95580eed45', '72e57db2-b407-4e66-840a-12afbac78c8d', 'Lancers', 'Hockey', 'Masculin', null, 'OUA Hockey M'),
  ('12c9c679-a906-4952-8539-9a0f262a9733', 'bf71c110-98a4-4db6-8b8d-1987eaf0656e', 'Golden Hawks', 'Hockey', 'Masculin', null, 'OUA Hockey M'),
  ('7c7e91d3-6abf-4475-8395-546020ead8a9', '51b91b4e-312a-4a76-863a-5c755671f94e', 'Badgers', 'Hockey', 'Masculin', null, 'OUA Hockey M'),
  ('bc0403a3-c7d3-4ea4-890b-76b06b125d2d', '1a1eed1a-03db-46f7-80d5-856a9c006b6f', 'Gryphons', 'Hockey', 'Masculin', null, 'OUA Hockey M'),
  ('0b547ae6-4d70-45b6-8de5-ec7a2945634a', '3006598d-a835-4779-81f9-d12398ea49ec', 'Thunderwolves', 'Hockey', 'Masculin', null, 'OUA Hockey M'),
  ('c53b7169-a811-4340-8dd4-84e5cbdf1ddc', '18cc2cb0-651c-431b-8123-d652249909cd', 'Mustangs', 'Hockey', 'Masculin', null, 'OUA Hockey M'),
  ('e4019557-f40b-4d2b-8ee9-681607d90cfd', '9010d36d-6942-426b-8919-451863bba3c3', 'Lions', 'Hockey', 'Masculin', null, 'OUA Hockey M'),
  ('7ded7fae-d10a-4335-80fc-72effc80950b', '72e49b30-e217-493d-8f66-47ef014d32e9', 'Bold', 'Hockey', 'Masculin', null, 'OUA Hockey M'),
  ('4a52c7d2-37ca-4005-8ec6-c0affbbfd506', 'fe8fedd4-68de-4d21-87fa-07388d697dec', 'Gaels', 'Hockey', 'Féminin', null, 'OUA Hockey F'),
  ('5190ba1e-9c11-4558-8c19-fdf35d131db4', 'e105da34-db15-4dcf-876c-999d0b86d471', 'Lakers', 'Hockey', 'Féminin', null, 'OUA Hockey F'),
  ('bc8d760f-dc9f-465a-8f25-60d1880bcdc6', '8edce991-be39-4674-8142-13cee4df5f16', 'Varsity Blues', 'Hockey', 'Féminin', null, 'OUA Hockey F'),
  ('2fef1a41-0144-4bfb-86d9-2a25cfc9cda5', '35886226-47b0-4288-84e3-67a404766fe9', 'Gee-Gees', 'Hockey', 'Féminin', null, 'OUA Hockey F'),
  ('6b5a1fe2-2a76-45cd-8920-78c0f2092d25', '72e49b30-e217-493d-8f66-47ef014d32e9', 'Bold', 'Hockey', 'Féminin', null, 'OUA Hockey F'),
  ('338943f2-e463-4ab7-8612-79c59f95da40', '1eb8ee7c-9043-4b64-8fbc-18c39b25f084', 'Ridgebacks', 'Hockey', 'Féminin', null, 'OUA Hockey F'),
  ('5793c0cb-980a-4aa4-8098-058db0e6b9ac', '50c40f3d-1855-4aa5-86ab-d8dedf77383f', 'Ravens', 'Hockey', 'Féminin', null, 'OUA Hockey F'),
  ('8dd64045-fdef-4a7b-844e-b0a0b171fb91', '72e57db2-b407-4e66-840a-12afbac78c8d', 'Lancers', 'Hockey', 'Féminin', null, 'OUA Hockey F'),
  ('b457c0db-b627-4313-8b99-2aa16fa4f1cb', 'bf71c110-98a4-4db6-8b8d-1987eaf0656e', 'Golden Hawks', 'Hockey', 'Féminin', null, 'OUA Hockey F'),
  ('32d952dd-750e-408b-8f8c-3fa231b513d2', '18cc2cb0-651c-431b-8123-d652249909cd', 'Mustangs', 'Hockey', 'Féminin', null, 'OUA Hockey F'),
  ('96c5961a-9c14-4185-8400-1392872bb829', 'fab5f58b-34ac-42c8-846a-8edacc5e3dd9', 'Warriors', 'Hockey', 'Féminin', null, 'OUA Hockey F'),
  ('a5671464-959d-4eac-8a6a-8d4e64040dee', '1a1eed1a-03db-46f7-80d5-856a9c006b6f', 'Gryphons', 'Hockey', 'Féminin', null, 'OUA Hockey F'),
  ('dc3723b7-dec3-4e4e-8c1d-9f05961d584b', '51b91b4e-312a-4a76-863a-5c755671f94e', 'Badgers', 'Hockey', 'Féminin', null, 'OUA Hockey F'),
  ('810e07ab-5452-49bd-8772-e75cb555a57d', '9010d36d-6942-426b-8919-451863bba3c3', 'Lions', 'Hockey', 'Féminin', null, 'OUA Hockey F'),
  ('92772e87-06ef-483a-8ad7-e27be2c6b1da', 'fe8fedd4-68de-4d21-87fa-07388d697dec', 'Gaels', 'Volleyball', 'Masculin', null, 'OUA Volleyball M'),
  ('52192fde-7d8b-494e-8ce1-5ca4d1609537', '4bede2c3-3a85-404c-839c-1ad8334b66b5', 'Excalibur', 'Volleyball', 'Masculin', null, 'OUA Volleyball M'),
  ('69c2b23e-c3af-4e42-8eaf-164207de6cca', '8edce991-be39-4674-8142-13cee4df5f16', 'Varsity Blues', 'Volleyball', 'Masculin', null, 'OUA Volleyball M'),
  ('9e3ae65e-947e-4461-88a5-877b3ab60e6e', '9010d36d-6942-426b-8919-451863bba3c3', 'Lions', 'Volleyball', 'Masculin', null, 'OUA Volleyball M'),
  ('8d3ff19e-7748-4f6f-8693-8261290732f4', '72e49b30-e217-493d-8f66-47ef014d32e9', 'Bold', 'Volleyball', 'Masculin', null, 'OUA Volleyball M'),
  ('52dea84f-88e7-43a7-847a-7c6e745d2d25', '1a1eed1a-03db-46f7-80d5-856a9c006b6f', 'Gryphons', 'Volleyball', 'Masculin', null, 'OUA Volleyball M'),
  ('a0f547b5-3b30-4e23-8ae3-4005dce62863', '51b91b4e-312a-4a76-863a-5c755671f94e', 'Badgers', 'Volleyball', 'Masculin', null, 'OUA Volleyball M'),
  ('f71908fc-6550-40fa-873c-d2a38204529d', 'fab5f58b-34ac-42c8-846a-8edacc5e3dd9', 'Warriors', 'Volleyball', 'Masculin', null, 'OUA Volleyball M'),
  ('808cc643-9070-4726-8fda-91cc3e3a8c33', '18cc2cb0-651c-431b-8123-d652249909cd', 'Mustangs', 'Volleyball', 'Masculin', null, 'OUA Volleyball M'),
  ('14431083-8405-4de4-8d9a-95b1b6591765', 'da5d39b4-5a50-48e4-8dea-06a5d8165402', 'Marauders', 'Volleyball', 'Masculin', null, 'OUA Volleyball M'),
  ('d7efce44-4b36-4908-8dae-106748267d46', '72e57db2-b407-4e66-840a-12afbac78c8d', 'Lancers', 'Volleyball', 'Masculin', null, 'OUA Volleyball M'),
  ('36b651e6-b9c9-4d6f-8c5b-7d971e3e45b1', 'e105da34-db15-4dcf-876c-999d0b86d471', 'Lakers', 'Volleyball', 'Masculin', null, 'OUA Volleyball M'),
  ('5b1bea68-03b0-4bed-81cd-98eedb8ca111', '18cc2cb0-651c-431b-8123-d652249909cd', 'Mustangs', 'Volleyball', 'Féminin', null, 'OUA Volleyball F'),
  ('5a7e576d-60a6-4b1f-8fc6-e8ce2fc3c485', 'fab5f58b-34ac-42c8-846a-8edacc5e3dd9', 'Warriors', 'Volleyball', 'Féminin', null, 'OUA Volleyball F'),
  ('a562d7a7-8b7b-4202-84f8-399c90057b0c', '51b91b4e-312a-4a76-863a-5c755671f94e', 'Badgers', 'Volleyball', 'Féminin', null, 'OUA Volleyball F'),
  ('46527b69-91a8-439d-82f1-c1152286f953', '4bede2c3-3a85-404c-839c-1ad8334b66b5', 'Excalibur', 'Volleyball', 'Féminin', null, 'OUA Volleyball F'),
  ('da4d044f-bb49-4954-8fb4-f750c8d223bf', '72e49b30-e217-493d-8f66-47ef014d32e9', 'Bold', 'Volleyball', 'Féminin', null, 'OUA Volleyball F'),
  ('f8def7e6-2db8-4ede-8ba1-44e0abec5289', '72e57db2-b407-4e66-840a-12afbac78c8d', 'Lancers', 'Volleyball', 'Féminin', null, 'OUA Volleyball F'),
  ('bf7f2902-eea2-4a4b-8cd7-dd11cde8e521', '9010d36d-6942-426b-8919-451863bba3c3', 'Lions', 'Volleyball', 'Féminin', null, 'OUA Volleyball F'),
  ('d9961308-40e5-4b97-8bef-677b3862cef1', '1a1eed1a-03db-46f7-80d5-856a9c006b6f', 'Gryphons', 'Volleyball', 'Féminin', null, 'OUA Volleyball F'),
  ('a86bd053-9cbe-4b7c-8f78-b6bccba3f98d', 'fe8fedd4-68de-4d21-87fa-07388d697dec', 'Gaels', 'Volleyball', 'Féminin', null, 'OUA Volleyball F'),
  ('1be12f03-032d-430c-8355-805495b0fb45', '3006598d-a835-4779-81f9-d12398ea49ec', 'Thunderwolves', 'Volleyball', 'Féminin', null, 'OUA Volleyball F'),
  ('de6548a9-faaa-4312-8cf2-3ba1fafaf072', 'da5d39b4-5a50-48e4-8dea-06a5d8165402', 'Marauders', 'Volleyball', 'Féminin', null, 'OUA Volleyball F'),
  ('515b6380-e68a-4e92-8822-d4bfe48a8665', 'e105da34-db15-4dcf-876c-999d0b86d471', 'Lakers', 'Volleyball', 'Féminin', null, 'OUA Volleyball F'),
  ('53f103d8-d866-4c0c-8c9e-7de7d9f97d37', '35886226-47b0-4288-84e3-67a404766fe9', 'Gee-Gees', 'Volleyball', 'Féminin', null, 'OUA Volleyball F'),
  ('bc137e85-f83b-42fe-865f-0ae5769d43fc', '8edce991-be39-4674-8142-13cee4df5f16', 'Varsity Blues', 'Volleyball', 'Féminin', null, 'OUA Volleyball F'),
  ('29e22811-96ba-4d36-81d2-6fa78b89b1bd', '72e49b30-e217-493d-8f66-47ef014d32e9', 'Bold', 'Soccer', 'Masculin', null, 'OUA Soccer M'),
  ('d8f6bf31-74f8-47de-8e91-e38db2c7b54d', '1eb8ee7c-9043-4b64-8fbc-18c39b25f084', 'Ridgebacks', 'Soccer', 'Masculin', null, 'OUA Soccer M'),
  ('caf6cdfe-8b71-46e0-85c4-22cb19a7109e', '4bede2c3-3a85-404c-839c-1ad8334b66b5', 'Excalibur', 'Soccer', 'Masculin', null, 'OUA Soccer M'),
  ('e12df74f-dc96-462a-8e84-dba1b066fc43', '1debd726-2202-4c83-8f6e-4f956628bfcb', 'Voyageurs', 'Soccer', 'Masculin', null, 'OUA Soccer M'),
  ('7e8e762b-01f8-46bd-83ea-15831f46e053', '50c40f3d-1855-4aa5-86ab-d8dedf77383f', 'Ravens', 'Soccer', 'Masculin', null, 'OUA Soccer M'),
  ('82d3dbcd-57ac-482c-8645-fb488adff472', '8edce991-be39-4674-8142-13cee4df5f16', 'Varsity Blues', 'Soccer', 'Masculin', null, 'OUA Soccer M'),
  ('aa4bd6e3-4514-4f45-8f88-897848d796bb', 'fe8fedd4-68de-4d21-87fa-07388d697dec', 'Gaels', 'Soccer', 'Masculin', null, 'OUA Soccer M'),
  ('7fbec5d1-57d1-4e8c-8d97-25ad41e1463b', 'e105da34-db15-4dcf-876c-999d0b86d471', 'Lakers', 'Soccer', 'Masculin', null, 'OUA Soccer M'),
  ('a6353c15-8043-4fe4-85ac-b4082b9295a2', '9010d36d-6942-426b-8919-451863bba3c3', 'Lions', 'Soccer', 'Masculin', null, 'OUA Soccer M'),
  ('1940f7e4-4654-4064-8045-b8bcfdd23783', '18cc2cb0-651c-431b-8123-d652249909cd', 'Mustangs', 'Soccer', 'Masculin', null, 'OUA Soccer M'),
  ('f4032162-7475-49bb-8c80-dea9ea150a33', 'da5d39b4-5a50-48e4-8dea-06a5d8165402', 'Marauders', 'Soccer', 'Masculin', null, 'OUA Soccer M'),
  ('12698992-c0b1-4bf2-8baf-9edcb95c21c8', 'fab5f58b-34ac-42c8-846a-8edacc5e3dd9', 'Warriors', 'Soccer', 'Masculin', null, 'OUA Soccer M'),
  ('dfb7091c-53a7-48d5-8139-77a491f5fb41', '1a1eed1a-03db-46f7-80d5-856a9c006b6f', 'Gryphons', 'Soccer', 'Masculin', null, 'OUA Soccer M'),
  ('cf4e8f5e-7879-46cd-8fff-276fac73df3b', '51b91b4e-312a-4a76-863a-5c755671f94e', 'Badgers', 'Soccer', 'Masculin', null, 'OUA Soccer M'),
  ('98049305-574f-4c4e-8a85-8677a58607e2', 'bf71c110-98a4-4db6-8b8d-1987eaf0656e', 'Golden Hawks', 'Soccer', 'Masculin', null, 'OUA Soccer M'),
  ('59a794ba-deaa-4038-88cc-414ec41de855', '72e57db2-b407-4e66-840a-12afbac78c8d', 'Lancers', 'Soccer', 'Masculin', null, 'OUA Soccer M'),
  ('2fbdf59a-b375-412f-8b4b-67f204163225', '416137e7-8ba7-497a-864e-950788fa0e28', 'Thunderbirds', 'Soccer', 'Masculin', null, 'OUA Soccer M'),
  ('a21c034c-2b08-4ea9-8909-f4748f9d2269', '35886226-47b0-4288-84e3-67a404766fe9', 'Gee-Gees', 'Soccer', 'Féminin', null, 'OUA Soccer F'),
  ('4701a64f-9f7b-4589-8b5c-d57b63d33932', 'e105da34-db15-4dcf-876c-999d0b86d471', 'Lakers', 'Soccer', 'Féminin', null, 'OUA Soccer F'),
  ('59ab1cfa-3021-41f9-8790-955436ed3c1c', '8edce991-be39-4674-8142-13cee4df5f16', 'Varsity Blues', 'Soccer', 'Féminin', null, 'OUA Soccer F'),
  ('62bc29f1-e045-4acf-8cec-42a1c5b021cb', 'fe8fedd4-68de-4d21-87fa-07388d697dec', 'Gaels', 'Soccer', 'Féminin', null, 'OUA Soccer F'),
  ('c8e1b19e-2592-4349-8628-88cf11c3095a', '1eb8ee7c-9043-4b64-8fbc-18c39b25f084', 'Ridgebacks', 'Soccer', 'Féminin', null, 'OUA Soccer F'),
  ('7ad44ee0-baad-46b5-8ecc-16824a90faef', '72e49b30-e217-493d-8f66-47ef014d32e9', 'Bold', 'Soccer', 'Féminin', null, 'OUA Soccer F'),
  ('45ccec23-7cca-41da-8936-2d64c7658804', '50c40f3d-1855-4aa5-86ab-d8dedf77383f', 'Ravens', 'Soccer', 'Féminin', null, 'OUA Soccer F'),
  ('7c265c1a-8d88-4ee6-86b4-d6b89f8d00d5', '1debd726-2202-4c83-8f6e-4f956628bfcb', 'Voyageurs', 'Soccer', 'Féminin', null, 'OUA Soccer F'),
  ('58b0ed33-4950-447a-8e05-d63a822a85b9', '4bede2c3-3a85-404c-839c-1ad8334b66b5', 'Excalibur', 'Soccer', 'Féminin', null, 'OUA Soccer F'),
  ('db44117c-0b16-4c87-8d61-ca3b2204ec2c', '1a1eed1a-03db-46f7-80d5-856a9c006b6f', 'Gryphons', 'Soccer', 'Féminin', null, 'OUA Soccer F'),
  ('ef9ff0af-f1dd-4321-8103-85d12112aa15', '9010d36d-6942-426b-8919-451863bba3c3', 'Lions', 'Soccer', 'Féminin', null, 'OUA Soccer F'),
  ('100814ac-03a7-418b-85ea-3cb4c4a6e9f2', '51b91b4e-312a-4a76-863a-5c755671f94e', 'Badgers', 'Soccer', 'Féminin', null, 'OUA Soccer F'),
  ('8ad77abe-2455-474a-8160-e90be3066a23', 'bf71c110-98a4-4db6-8b8d-1987eaf0656e', 'Golden Hawks', 'Soccer', 'Féminin', null, 'OUA Soccer F'),
  ('b6403bc7-79f0-41cc-8dae-0497d995b8dc', '18cc2cb0-651c-431b-8123-d652249909cd', 'Mustangs', 'Soccer', 'Féminin', null, 'OUA Soccer F'),
  ('e54b2e95-6d00-4199-8050-47159f4a7fc2', '72e57db2-b407-4e66-840a-12afbac78c8d', 'Lancers', 'Soccer', 'Féminin', null, 'OUA Soccer F'),
  ('82c791a1-6477-4bbb-87f0-b14bd20ae3f7', 'da5d39b4-5a50-48e4-8dea-06a5d8165402', 'Marauders', 'Soccer', 'Féminin', null, 'OUA Soccer F'),
  ('e6f68339-339d-4160-8750-0cbf817c055b', 'fab5f58b-34ac-42c8-846a-8edacc5e3dd9', 'Warriors', 'Soccer', 'Féminin', null, 'OUA Soccer F'),
  ('9331f238-38d6-4b9c-8c4a-ad9349706dae', '416137e7-8ba7-497a-864e-950788fa0e28', 'Thunderbirds', 'Soccer', 'Féminin', null, 'OUA Soccer F'),
  ('478b5c9d-6516-43f9-8253-88ce3ed7384c', '1a1eed1a-03db-46f7-80d5-856a9c006b6f', 'Gryphons', 'Rugby', 'Masculin', null, 'OUA Rugby M'),
  ('547d1edf-b246-4faa-8c0b-59137b2bc0be', '18cc2cb0-651c-431b-8123-d652249909cd', 'Mustangs', 'Rugby', 'Masculin', null, 'OUA Rugby M'),
  ('400feac6-92e9-4239-89f3-eb8d51b72979', '8edce991-be39-4674-8142-13cee4df5f16', 'Varsity Blues', 'Rugby', 'Masculin', null, 'OUA Rugby M'),
  ('4fc451bb-8e33-4e4b-8155-30619c8f2edd', 'fe8fedd4-68de-4d21-87fa-07388d697dec', 'Gaels', 'Rugby', 'Masculin', null, 'OUA Rugby M'),
  ('1af816f7-c4ad-451d-8638-17bafc61076b', 'bf71c110-98a4-4db6-8b8d-1987eaf0656e', 'Golden Hawks', 'Rugby', 'Masculin', null, 'OUA Rugby M'),
  ('ec8501d6-4426-4b6b-887e-230d726758ad', '4bede2c3-3a85-404c-839c-1ad8334b66b5', 'Excalibur', 'Rugby', 'Masculin', null, 'OUA Rugby M'),
  ('835ea1b1-4293-4f12-80bf-245a3def70ef', 'fab5f58b-34ac-42c8-846a-8edacc5e3dd9', 'Warriors', 'Rugby', 'Masculin', null, 'OUA Rugby M'),
  ('23c48025-a903-40a2-80be-8228264b5f3b', 'da5d39b4-5a50-48e4-8dea-06a5d8165402', 'Marauders', 'Rugby', 'Masculin', null, 'OUA Rugby M'),
  ('9aa4c600-067d-4fd8-8808-8abb3da5a9ce', '51b91b4e-312a-4a76-863a-5c755671f94e', 'Badgers', 'Rugby', 'Masculin', null, 'OUA Rugby M'),
  ('471683b2-b740-46f4-8a69-e2f45214a0ba', '72e49b30-e217-493d-8f66-47ef014d32e9', 'Bold', 'Rugby', 'Masculin', null, 'OUA Rugby M'),
  ('70b06818-1d7d-4305-8734-026ad5615d46', '9010d36d-6942-426b-8919-451863bba3c3', 'Lions', 'Rugby', 'Masculin', null, 'OUA Rugby M'),
  ('96490ea6-8dec-4193-8f91-9e3c67c73203', '1a1eed1a-03db-46f7-80d5-856a9c006b6f', 'Gryphons', 'Rugby', 'Féminin', null, 'OUA Rugby F'),
  ('62f48d6b-c463-4c45-80cc-b3fd7d5276ca', 'fe8fedd4-68de-4d21-87fa-07388d697dec', 'Gaels', 'Rugby', 'Féminin', null, 'OUA Rugby F'),
  ('b9a4d2a4-4527-4bd6-818e-a95b12f8653b', '18cc2cb0-651c-431b-8123-d652249909cd', 'Mustangs', 'Rugby', 'Féminin', null, 'OUA Rugby F'),
  ('a25477bf-238d-4fbd-8094-d3ed5a1c5425', '51b91b4e-312a-4a76-863a-5c755671f94e', 'Badgers', 'Rugby', 'Féminin', null, 'OUA Rugby F'),
  ('9faad05f-4053-4943-8c72-e4e1acdf2072', 'da5d39b4-5a50-48e4-8dea-06a5d8165402', 'Marauders', 'Rugby', 'Féminin', null, 'OUA Rugby F'),
  ('bf9f2ccf-149c-42c9-8961-0f58c9668624', 'bf71c110-98a4-4db6-8b8d-1987eaf0656e', 'Golden Hawks', 'Rugby', 'Féminin', null, 'OUA Rugby F'),
  ('53cf0dab-85d4-4969-8c55-c18f92bfea21', 'fab5f58b-34ac-42c8-846a-8edacc5e3dd9', 'Warriors', 'Rugby', 'Féminin', null, 'OUA Rugby F'),
  ('2c570d94-c0c8-4e62-8064-88eaeac98bdc', '9010d36d-6942-426b-8919-451863bba3c3', 'Lions', 'Rugby', 'Féminin', null, 'OUA Rugby F'),
  ('1e16a240-1e27-4e4c-8ebc-b2058024294e', '4bede2c3-3a85-404c-839c-1ad8334b66b5', 'Excalibur', 'Rugby', 'Féminin', null, 'OUA Rugby F'),
  ('b22c3290-5e2a-44d6-8bba-461c808c2290', '8edce991-be39-4674-8142-13cee4df5f16', 'Varsity Blues', 'Rugby', 'Féminin', null, 'OUA Rugby F'),
  ('c009137a-3873-467d-879d-42c719a52ea1', 'f2ad98a1-bc23-4262-82f5-3291ae9c10f4', 'WolfPack', 'Basketball', 'Masculin', null, 'Canada West Basketball M'),
  ('a324ff4d-8f16-4f4b-89a2-a253f7194952', 'c85d71cb-6f10-4794-8e31-f028769a2b49', 'Spartans', 'Basketball', 'Masculin', null, 'Canada West Basketball M'),
  ('41cfd8a0-19fa-435f-8755-3e97f511c5d1', '9860e51e-9d23-4169-8d81-4d6aaff81651', 'Vikes', 'Basketball', 'Masculin', null, 'Canada West Basketball M'),
  ('765bc01c-2022-4120-8f62-9183fa48e62c', '410b0ea4-12a1-4eb3-89dc-de367f653cf8', 'Thunderbirds', 'Basketball', 'Masculin', null, 'Canada West Basketball M'),
  ('004302f0-aac6-4c82-8891-9f8730fe8343', '3c0dea0d-511b-4dcc-8123-c1ce2ef4895c', 'Heat', 'Basketball', 'Masculin', null, 'Canada West Basketball M'),
  ('9104a720-4a5c-415d-8b9e-a7098edd2f5b', 'aef7a714-7a93-4229-8461-0b85c435e21f', 'Cascades', 'Basketball', 'Masculin', null, 'Canada West Basketball M'),
  ('3f7b7ce1-d702-412a-86bd-fd8a449e23e2', '8257c201-3943-40af-8ff4-c268661130f6', 'Timberwolves', 'Basketball', 'Masculin', null, 'Canada West Basketball M'),
  ('a9414540-8d8c-41fe-88f1-5370cb0a0ddf', '189ec720-0041-486d-8d8f-6102dd5e41fb', 'Wesmen', 'Basketball', 'Masculin', null, 'Canada West Basketball M'),
  ('aaac6150-2469-4c21-84fa-a0cbb1c1c678', '5490b434-d8e6-485c-86fd-f97beba7e494', 'Golden Bears / Pandas', 'Basketball', 'Masculin', null, 'Canada West Basketball M'),
  ('0f600b80-88c0-48b9-8fc3-eae0e9848456', '06314265-95e9-4771-8a96-d27bf1755562', 'Dinos', 'Basketball', 'Masculin', null, 'Canada West Basketball M'),
  ('d8f389d9-f7ae-4888-8ef2-77fb8cc488e3', '76408771-119d-4841-8938-8be5f51eddc0', 'Pronghorns', 'Basketball', 'Masculin', null, 'Canada West Basketball M'),
  ('978898dc-7536-49ce-806e-f6815dfcfe12', 'eba4d04f-358b-4b95-8af7-8dd91ea98f0c', 'Griffins', 'Basketball', 'Masculin', null, 'Canada West Basketball M'),
  ('7a14dfae-f102-4e43-820e-8f53f0f9332c', 'c8157ffd-85bc-4061-870b-c9278367861c', 'Bisons', 'Basketball', 'Masculin', null, 'Canada West Basketball M'),
  ('d0958531-318c-49aa-8e4e-97f02e5c5ef6', '63873d21-d62e-4e9f-89fc-57f8d672c1bc', 'Cougars', 'Basketball', 'Masculin', null, 'Canada West Basketball M'),
  ('32411db6-243e-45e5-86db-e67ba5646d54', 'a28d1a52-ac84-43bd-834a-fdad61dd5829', 'Cougars / Rams (football)', 'Basketball', 'Masculin', null, 'Canada West Basketball M'),
  ('a02aed1e-cd9b-408d-8ffe-09a95c6c36e5', 'f905d209-3487-46f7-8ce9-65f52db124c7', 'Huskies', 'Basketball', 'Masculin', null, 'Canada West Basketball M'),
  ('5a9d58b8-3c87-4c22-89b7-7fa1c58a0521', '7e5c66c4-0655-4935-805a-acac523ff47e', 'Bobcats', 'Basketball', 'Masculin', null, 'Canada West Basketball M'),
  ('3fa3266e-0229-473f-89b6-84414c84b1cd', 'f2ad98a1-bc23-4262-82f5-3291ae9c10f4', 'WolfPack', 'Basketball', 'Féminin', null, 'Canada West Basketball F'),
  ('e25e8ce0-796a-4e06-85fe-83661dd885dd', 'c85d71cb-6f10-4794-8e31-f028769a2b49', 'Spartans', 'Basketball', 'Féminin', null, 'Canada West Basketball F'),
  ('56fee832-da67-4e75-8918-80be8c6f855b', '9860e51e-9d23-4169-8d81-4d6aaff81651', 'Vikes', 'Basketball', 'Féminin', null, 'Canada West Basketball F'),
  ('9853421a-da97-4d64-8c1a-ed019a8452ec', '410b0ea4-12a1-4eb3-89dc-de367f653cf8', 'Thunderbirds', 'Basketball', 'Féminin', null, 'Canada West Basketball F'),
  ('a9f0c642-bee8-4f06-8c6a-1ae974bb332c', '3c0dea0d-511b-4dcc-8123-c1ce2ef4895c', 'Heat', 'Basketball', 'Féminin', null, 'Canada West Basketball F'),
  ('3fb0b72c-703d-4491-8681-42fa81f9f9b0', 'aef7a714-7a93-4229-8461-0b85c435e21f', 'Cascades', 'Basketball', 'Féminin', null, 'Canada West Basketball F'),
  ('aa5737f0-23c7-499d-8fa2-d66809184efb', '8257c201-3943-40af-8ff4-c268661130f6', 'Timberwolves', 'Basketball', 'Féminin', null, 'Canada West Basketball F'),
  ('503aac8a-4871-4f91-8202-67941476c76a', '189ec720-0041-486d-8d8f-6102dd5e41fb', 'Wesmen', 'Basketball', 'Féminin', null, 'Canada West Basketball F'),
  ('6050eb6b-961d-417f-8cf3-a415ade5867d', '5490b434-d8e6-485c-86fd-f97beba7e494', 'Golden Bears / Pandas', 'Basketball', 'Féminin', null, 'Canada West Basketball F'),
  ('e1465c7c-1974-44e9-8111-c7934c5a1fcf', '06314265-95e9-4771-8a96-d27bf1755562', 'Dinos', 'Basketball', 'Féminin', null, 'Canada West Basketball F'),
  ('0011a414-6a3b-4be0-8ea5-fc66259fd5b9', '76408771-119d-4841-8938-8be5f51eddc0', 'Pronghorns', 'Basketball', 'Féminin', null, 'Canada West Basketball F'),
  ('6f5ae8ad-3c3c-446a-8411-09cec73abce3', 'eba4d04f-358b-4b95-8af7-8dd91ea98f0c', 'Griffins', 'Basketball', 'Féminin', null, 'Canada West Basketball F'),
  ('fa041557-94a2-4ea0-8ee2-91f54499a29f', 'c8157ffd-85bc-4061-870b-c9278367861c', 'Bisons', 'Basketball', 'Féminin', null, 'Canada West Basketball F'),
  ('1c20da86-1ec7-47f8-8423-56249231277e', '63873d21-d62e-4e9f-89fc-57f8d672c1bc', 'Cougars', 'Basketball', 'Féminin', null, 'Canada West Basketball F'),
  ('d234f1a5-7f32-4830-8fcf-bdc92c08f74c', 'a28d1a52-ac84-43bd-834a-fdad61dd5829', 'Cougars / Rams (football)', 'Basketball', 'Féminin', null, 'Canada West Basketball F'),
  ('920693fc-38cf-4dcb-8c96-3b45178fb854', 'f905d209-3487-46f7-8ce9-65f52db124c7', 'Huskies', 'Basketball', 'Féminin', null, 'Canada West Basketball F'),
  ('bad07f71-2c1a-4e31-869f-49b0e6fd86a6', '7e5c66c4-0655-4935-805a-acac523ff47e', 'Bobcats', 'Basketball', 'Féminin', null, 'Canada West Basketball F'),
  ('02e297e0-219d-45d6-82aa-e9d074da9f9a', 'f905d209-3487-46f7-8ce9-65f52db124c7', 'Huskies', 'Football', 'Masculin', null, 'Canada West Football M'),
  ('9420e6aa-19c6-4646-8722-464d30336c7a', 'c8157ffd-85bc-4061-870b-c9278367861c', 'Bisons', 'Football', 'Masculin', null, 'Canada West Football M'),
  ('3fdd4bda-4644-4f7c-81ee-4ef1ac4e0677', 'a28d1a52-ac84-43bd-834a-fdad61dd5829', 'Cougars / Rams (football)', 'Football', 'Masculin', null, 'Canada West Football M'),
  ('333807e0-1041-4ca0-8848-81a67d32fcf9', '06314265-95e9-4771-8a96-d27bf1755562', 'Dinos', 'Football', 'Masculin', null, 'Canada West Football M'),
  ('a6a767e0-694f-4019-8a8e-68759c99d49a', '5490b434-d8e6-485c-86fd-f97beba7e494', 'Golden Bears / Pandas', 'Football', 'Masculin', null, 'Canada West Football M'),
  ('feee8ce8-1889-4b01-816e-32e15e6804af', '410b0ea4-12a1-4eb3-89dc-de367f653cf8', 'Thunderbirds', 'Football', 'Masculin', null, 'Canada West Football M'),
  ('d5237fc2-e1f1-47ba-81a7-57e1bd7fd313', 'f905d209-3487-46f7-8ce9-65f52db124c7', 'Huskies', 'Hockey', 'Masculin', null, 'Canada West Hockey M'),
  ('43fc0ea2-bb4a-41a3-8d94-60a37ea790bd', '63873d21-d62e-4e9f-89fc-57f8d672c1bc', 'Cougars', 'Hockey', 'Masculin', null, 'Canada West Hockey M'),
  ('13a2cf30-199c-4308-8eed-2063651310c7', 'c8157ffd-85bc-4061-870b-c9278367861c', 'Bisons', 'Hockey', 'Masculin', null, 'Canada West Hockey M'),
  ('f77bea72-9792-4e2c-8cbc-3dc12ee0af8f', '5490b434-d8e6-485c-86fd-f97beba7e494', 'Golden Bears / Pandas', 'Hockey', 'Masculin', null, 'Canada West Hockey M'),
  ('62047e67-1409-4237-8131-80751b5ba2db', 'a28d1a52-ac84-43bd-834a-fdad61dd5829', 'Cougars / Rams (football)', 'Hockey', 'Masculin', null, 'Canada West Hockey M'),
  ('683aa304-0297-4f49-849d-f16552beb02d', '06314265-95e9-4771-8a96-d27bf1755562', 'Dinos', 'Hockey', 'Masculin', null, 'Canada West Hockey M'),
  ('54083cdd-3208-47a4-8a68-5753a3ddd85b', 'eba4d04f-358b-4b95-8af7-8dd91ea98f0c', 'Griffins', 'Hockey', 'Masculin', null, 'Canada West Hockey M'),
  ('eab2558e-9b8e-4294-867a-fd65004790dc', 'c85d71cb-6f10-4794-8e31-f028769a2b49', 'Spartans', 'Hockey', 'Masculin', null, 'Canada West Hockey M'),
  ('365af13b-ebed-4776-8fad-83f67b809467', '410b0ea4-12a1-4eb3-89dc-de367f653cf8', 'Thunderbirds', 'Hockey', 'Masculin', null, 'Canada West Hockey M'),
  ('1abc2475-2ee6-4352-84eb-4331d43ebc25', '63873d21-d62e-4e9f-89fc-57f8d672c1bc', 'Cougars', 'Hockey', 'Féminin', null, 'Canada West Hockey F'),
  ('add729ea-c46f-4f83-84a1-801287c61329', 'f905d209-3487-46f7-8ce9-65f52db124c7', 'Huskies', 'Hockey', 'Féminin', null, 'Canada West Hockey F'),
  ('9e51c297-ede9-4fdd-8c01-8ec3a49328c4', 'c85d71cb-6f10-4794-8e31-f028769a2b49', 'Spartans', 'Hockey', 'Féminin', null, 'Canada West Hockey F'),
  ('505ead86-d9e4-4cea-8168-503227216ff9', 'c8157ffd-85bc-4061-870b-c9278367861c', 'Bisons', 'Hockey', 'Féminin', null, 'Canada West Hockey F'),
  ('026cd064-e975-4138-8fa9-5efc89da1959', '06314265-95e9-4771-8a96-d27bf1755562', 'Dinos', 'Hockey', 'Féminin', null, 'Canada West Hockey F'),
  ('7bfd5772-0f64-41aa-86be-4199d17a454a', 'a28d1a52-ac84-43bd-834a-fdad61dd5829', 'Cougars / Rams (football)', 'Hockey', 'Féminin', null, 'Canada West Hockey F'),
  ('906a293c-c1fd-4ae6-809f-4bd7a65dc420', '5490b434-d8e6-485c-86fd-f97beba7e494', 'Golden Bears / Pandas', 'Hockey', 'Féminin', null, 'Canada West Hockey F'),
  ('bda64c88-dcee-4305-8a0b-c13336c5243d', 'eba4d04f-358b-4b95-8af7-8dd91ea98f0c', 'Griffins', 'Hockey', 'Féminin', null, 'Canada West Hockey F'),
  ('0e2a3776-785c-4f71-8025-1c4ba5c67ba4', '410b0ea4-12a1-4eb3-89dc-de367f653cf8', 'Thunderbirds', 'Hockey', 'Féminin', null, 'Canada West Hockey F'),
  ('fed6a104-9e0c-43a3-81f6-57db597d0c9f', '189ec720-0041-486d-8d8f-6102dd5e41fb', 'Wesmen', 'Volleyball', 'Masculin', null, 'Canada West Volleyball M'),
  ('42817173-da58-42a4-848a-25cb1b9f8a93', 'f905d209-3487-46f7-8ce9-65f52db124c7', 'Huskies', 'Volleyball', 'Masculin', null, 'Canada West Volleyball M'),
  ('359534aa-a16e-4fc7-8e76-0303014b7f73', '63873d21-d62e-4e9f-89fc-57f8d672c1bc', 'Cougars', 'Volleyball', 'Masculin', null, 'Canada West Volleyball M'),
  ('dde189b6-e063-42c8-8ba9-f57f2fa9246d', 'c85d71cb-6f10-4794-8e31-f028769a2b49', 'Spartans', 'Volleyball', 'Masculin', null, 'Canada West Volleyball M'),
  ('f6436755-fc56-4d89-86e5-15aa9198e76a', '7e5c66c4-0655-4935-805a-acac523ff47e', 'Bobcats', 'Volleyball', 'Masculin', null, 'Canada West Volleyball M'),
  ('da92ec5b-cc0f-4728-85b2-a435ba8b1ad0', '5490b434-d8e6-485c-86fd-f97beba7e494', 'Golden Bears / Pandas', 'Volleyball', 'Masculin', null, 'Canada West Volleyball M'),
  ('148a662e-47a4-438a-8af3-30df531264cc', 'c8157ffd-85bc-4061-870b-c9278367861c', 'Bisons', 'Volleyball', 'Masculin', null, 'Canada West Volleyball M'),
  ('9ecbde7e-6289-4b6c-887d-fc72e0226dd4', 'f2ad98a1-bc23-4262-82f5-3291ae9c10f4', 'WolfPack', 'Volleyball', 'Masculin', null, 'Canada West Volleyball M'),
  ('3295133a-5258-4b92-88c3-223fd2a62adb', '06314265-95e9-4771-8a96-d27bf1755562', 'Dinos', 'Volleyball', 'Masculin', null, 'Canada West Volleyball M'),
  ('790b5e17-f79d-4512-8bf7-bab314bbd138', 'eba4d04f-358b-4b95-8af7-8dd91ea98f0c', 'Griffins', 'Volleyball', 'Masculin', null, 'Canada West Volleyball M'),
  ('476697c1-67fe-4bd2-8388-47b09089ef14', '410b0ea4-12a1-4eb3-89dc-de367f653cf8', 'Thunderbirds', 'Volleyball', 'Masculin', null, 'Canada West Volleyball M'),
  ('22bc0e80-40cb-41b0-89c1-009bef471427', '3c0dea0d-511b-4dcc-8123-c1ce2ef4895c', 'Heat', 'Volleyball', 'Masculin', null, 'Canada West Volleyball M'),
  ('cf27b1d6-e8a3-44a6-895f-b29f4c7c4432', 'aef7a714-7a93-4229-8461-0b85c435e21f', 'Cascades', 'Volleyball', 'Masculin', null, 'Canada West Volleyball M'),
  ('a1b9945c-2461-4dcd-8ea6-58fd58c4d888', '5490b434-d8e6-485c-86fd-f97beba7e494', 'Golden Bears / Pandas', 'Volleyball', 'Féminin', null, 'Canada West Volleyball F'),
  ('19a6c51f-9a2a-45e9-8035-6ed09edf5cbe', 'c85d71cb-6f10-4794-8e31-f028769a2b49', 'Spartans', 'Volleyball', 'Féminin', null, 'Canada West Volleyball F'),
  ('f812bee7-57e2-43ea-88d5-b3cf54f2c9a1', '189ec720-0041-486d-8d8f-6102dd5e41fb', 'Wesmen', 'Volleyball', 'Féminin', null, 'Canada West Volleyball F'),
  ('56532f4f-c4ce-4a85-8568-1eb030f14b07', 'f2ad98a1-bc23-4262-82f5-3291ae9c10f4', 'WolfPack', 'Volleyball', 'Féminin', null, 'Canada West Volleyball F'),
  ('41468457-44bd-4867-8a91-2ba25eb5231d', 'f905d209-3487-46f7-8ce9-65f52db124c7', 'Huskies', 'Volleyball', 'Féminin', null, 'Canada West Volleyball F'),
  ('38411238-e501-496b-867f-cb0dea81e02b', '63873d21-d62e-4e9f-89fc-57f8d672c1bc', 'Cougars', 'Volleyball', 'Féminin', null, 'Canada West Volleyball F'),
  ('42c46900-1741-44b2-8726-1fb0684393f4', '06314265-95e9-4771-8a96-d27bf1755562', 'Dinos', 'Volleyball', 'Féminin', null, 'Canada West Volleyball F'),
  ('c17e682f-3dfb-43d7-8625-4ca81ab35a8f', 'eba4d04f-358b-4b95-8af7-8dd91ea98f0c', 'Griffins', 'Volleyball', 'Féminin', null, 'Canada West Volleyball F'),
  ('d76ff827-905f-4cdd-8bb2-b0e0e1b56e89', '7e5c66c4-0655-4935-805a-acac523ff47e', 'Bobcats', 'Volleyball', 'Féminin', null, 'Canada West Volleyball F'),
  ('b500a0ac-2c2e-426e-8909-523632c3a658', 'c8157ffd-85bc-4061-870b-c9278367861c', 'Bisons', 'Volleyball', 'Féminin', null, 'Canada West Volleyball F'),
  ('4828230d-2247-4401-89a1-ad29caf3bbaa', 'a28d1a52-ac84-43bd-834a-fdad61dd5829', 'Cougars / Rams (football)', 'Volleyball', 'Féminin', null, 'Canada West Volleyball F'),
  ('356af394-cb6d-44de-803c-ca8de583818f', '410b0ea4-12a1-4eb3-89dc-de367f653cf8', 'Thunderbirds', 'Volleyball', 'Féminin', null, 'Canada West Volleyball F'),
  ('b766de54-af3a-49ee-828f-b768b67d52ac', '3c0dea0d-511b-4dcc-8123-c1ce2ef4895c', 'Heat', 'Volleyball', 'Féminin', null, 'Canada West Volleyball F'),
  ('6ef8f415-a438-49fc-8599-401d6c7174cc', 'aef7a714-7a93-4229-8461-0b85c435e21f', 'Cascades', 'Volleyball', 'Féminin', null, 'Canada West Volleyball F'),
  ('e86114c0-d534-4ee6-8beb-f32584a5f1ef', '9860e51e-9d23-4169-8d81-4d6aaff81651', 'Vikes', 'Soccer', 'Masculin', null, 'Canada West Soccer M'),
  ('3f24fde2-cd55-4fd2-8346-7f966856b6e4', 'f2ad98a1-bc23-4262-82f5-3291ae9c10f4', 'WolfPack', 'Soccer', 'Masculin', null, 'Canada West Soccer M'),
  ('50460fa8-5bc8-4983-853a-db7615ac6543', 'c85d71cb-6f10-4794-8e31-f028769a2b49', 'Spartans', 'Soccer', 'Masculin', null, 'Canada West Soccer M'),
  ('a9ed8716-bc4a-4347-8587-f8f3c7d3bfed', '410b0ea4-12a1-4eb3-89dc-de367f653cf8', 'Thunderbirds', 'Soccer', 'Masculin', null, 'Canada West Soccer M'),
  ('485eca04-89a9-41bd-843d-c352f279e324', '3c0dea0d-511b-4dcc-8123-c1ce2ef4895c', 'Heat', 'Soccer', 'Masculin', null, 'Canada West Soccer M'),
  ('7655f137-25b4-46eb-815c-8118b5f601a2', 'aef7a714-7a93-4229-8461-0b85c435e21f', 'Cascades', 'Soccer', 'Masculin', null, 'Canada West Soccer M'),
  ('cbee44fa-2567-45ba-8ed8-bb771c08d15d', '8257c201-3943-40af-8ff4-c268661130f6', 'Timberwolves', 'Soccer', 'Masculin', null, 'Canada West Soccer M'),
  ('52bec6ae-1451-4954-8994-78db2981c3a8', '06314265-95e9-4771-8a96-d27bf1755562', 'Dinos', 'Soccer', 'Masculin', null, 'Canada West Soccer M'),
  ('ef9c999a-1417-4799-8d41-03da4c96aa69', '63873d21-d62e-4e9f-89fc-57f8d672c1bc', 'Cougars', 'Soccer', 'Masculin', null, 'Canada West Soccer M'),
  ('f7b0a4e3-4d4c-445f-8e2e-9d5b72e5b3a5', '5490b434-d8e6-485c-86fd-f97beba7e494', 'Golden Bears / Pandas', 'Soccer', 'Masculin', null, 'Canada West Soccer M'),
  ('50d33d66-1393-40df-8332-3ea0b2830295', '76408771-119d-4841-8938-8be5f51eddc0', 'Pronghorns', 'Soccer', 'Masculin', null, 'Canada West Soccer M'),
  ('399574d0-0f59-489c-8b37-26fe6f3a36a8', 'f905d209-3487-46f7-8ce9-65f52db124c7', 'Huskies', 'Soccer', 'Masculin', null, 'Canada West Soccer M'),
  ('5607bb73-50f7-422b-835f-d29cfc7c4cc1', 'eba4d04f-358b-4b95-8af7-8dd91ea98f0c', 'Griffins', 'Soccer', 'Masculin', null, 'Canada West Soccer M'),
  ('b4eab13b-1f0e-4e2f-8389-d1a8d458734e', 'f2ad98a1-bc23-4262-82f5-3291ae9c10f4', 'WolfPack', 'Soccer', 'Féminin', null, 'Canada West Soccer F'),
  ('68f3391c-62df-4547-85ad-a3f481dc19fc', 'c85d71cb-6f10-4794-8e31-f028769a2b49', 'Spartans', 'Soccer', 'Féminin', null, 'Canada West Soccer F'),
  ('49cf6285-d8d0-4b27-8883-5f3245f77689', '9860e51e-9d23-4169-8d81-4d6aaff81651', 'Vikes', 'Soccer', 'Féminin', null, 'Canada West Soccer F'),
  ('7393d81c-2fc6-4e38-8e5b-4a9cd7d25adc', '410b0ea4-12a1-4eb3-89dc-de367f653cf8', 'Thunderbirds', 'Soccer', 'Féminin', null, 'Canada West Soccer F'),
  ('f2a2c49c-b3e2-4f12-8da6-622307cc3166', '3c0dea0d-511b-4dcc-8123-c1ce2ef4895c', 'Heat', 'Soccer', 'Féminin', null, 'Canada West Soccer F'),
  ('d5d0ffa0-bc7e-4a31-858c-ccde2b7f412c', 'aef7a714-7a93-4229-8461-0b85c435e21f', 'Cascades', 'Soccer', 'Féminin', null, 'Canada West Soccer F'),
  ('db834fa7-fc6f-4b24-853a-e68ea24fc3e1', '8257c201-3943-40af-8ff4-c268661130f6', 'Timberwolves', 'Soccer', 'Féminin', null, 'Canada West Soccer F'),
  ('9794cba3-ec7b-4f6b-85d2-ceb391a1a077', '06314265-95e9-4771-8a96-d27bf1755562', 'Dinos', 'Soccer', 'Féminin', null, 'Canada West Soccer F'),
  ('ae08d006-e501-47ea-8d7b-21ec21de5271', '63873d21-d62e-4e9f-89fc-57f8d672c1bc', 'Cougars', 'Soccer', 'Féminin', null, 'Canada West Soccer F'),
  ('ce97880a-7ca6-44d8-88fc-7c942cd2c821', 'f905d209-3487-46f7-8ce9-65f52db124c7', 'Huskies', 'Soccer', 'Féminin', null, 'Canada West Soccer F'),
  ('890c04b7-7f95-43f6-8c74-7627fa7a26dd', 'eba4d04f-358b-4b95-8af7-8dd91ea98f0c', 'Griffins', 'Soccer', 'Féminin', null, 'Canada West Soccer F'),
  ('086f9dba-739c-49d7-8044-b29d43359d40', 'c8157ffd-85bc-4061-870b-c9278367861c', 'Bisons', 'Soccer', 'Féminin', null, 'Canada West Soccer F'),
  ('e9e88f5d-d3a4-4df2-86bf-bbc8b23380a1', '5490b434-d8e6-485c-86fd-f97beba7e494', 'Golden Bears / Pandas', 'Soccer', 'Féminin', null, 'Canada West Soccer F'),
  ('d05d1953-564b-488b-894f-da36262041e3', '76408771-119d-4841-8938-8be5f51eddc0', 'Pronghorns', 'Soccer', 'Féminin', null, 'Canada West Soccer F'),
  ('7b53f2b3-2c4e-4314-8770-1050e520caa0', 'a28d1a52-ac84-43bd-834a-fdad61dd5829', 'Cougars / Rams (football)', 'Soccer', 'Féminin', null, 'Canada West Soccer F'),
  ('16238147-7b41-44d1-828b-5fb983ed86ed', '9860e51e-9d23-4169-8d81-4d6aaff81651', 'Vikes', 'Rugby', 'Féminin', null, 'Canada West Rugby F'),
  ('41c92004-c827-4383-8a8e-846e957a67b8', '76408771-119d-4841-8938-8be5f51eddc0', 'Pronghorns', 'Rugby', 'Féminin', null, 'Canada West Rugby F'),
  ('0522989d-1834-4cdc-8bf0-20ad9606cd2d', '5490b434-d8e6-485c-86fd-f97beba7e494', 'Golden Bears / Pandas', 'Rugby', 'Féminin', null, 'Canada West Rugby F'),
  ('3d9b53f8-5f8d-4596-86a4-d448d3269565', '06314265-95e9-4771-8a96-d27bf1755562', 'Dinos', 'Rugby', 'Féminin', null, 'Canada West Rugby F'),
  ('792f55c1-f55a-4ccd-8788-8b56e52a9936', '410b0ea4-12a1-4eb3-89dc-de367f653cf8', 'Thunderbirds', 'Rugby', 'Féminin', null, 'Canada West Rugby F'),
  ('de5b88df-39c2-4170-8e14-f26fa3d9afa4', '0c9df422-c400-401a-873a-12c8d53765cb', 'X-Men / X-Women', 'Basketball', 'Masculin', null, 'AUS Basketball M'),
  ('8cd68a94-297a-4224-8bf0-7c52c0a76515', 'c421e8ac-11f8-4c1e-8e59-ba1fbcd4d1e3', 'Axemen / Axewomen', 'Basketball', 'Masculin', null, 'AUS Basketball M'),
  ('11867410-3a96-49a8-8617-209f47072665', '1e001765-69bb-4d63-8d4c-7fb2603c9876', 'Tigers', 'Basketball', 'Masculin', null, 'AUS Basketball M'),
  ('d6916569-30fd-4d31-8b91-fa68572953dc', 'd09e08f6-d24a-4a7d-839c-f12e6aa99174', 'Capers', 'Basketball', 'Masculin', null, 'AUS Basketball M'),
  ('e002c7ff-9ce2-446d-8bd5-52b510804c51', '402ff2a8-96d2-4d64-86e1-0da5c3c95c17', 'Huskies', 'Basketball', 'Masculin', null, 'AUS Basketball M'),
  ('67e63f6e-0314-454e-89e5-476905769b04', 'ce40deb7-10f5-4463-8998-4f4aa57c8842', 'Sea-Hawks', 'Basketball', 'Masculin', null, 'AUS Basketball M'),
  ('ecbc25e9-6ed8-4c65-8940-9c480b823862', '3d67a1e9-b3d8-484c-8303-beb5bdfd3577', 'Reds', 'Basketball', 'Masculin', null, 'AUS Basketball M'),
  ('7b030214-8674-4304-8a7a-8c713429943b', 'c70f6a18-1d63-40fc-84d1-050ada42d2cf', 'Panthers', 'Basketball', 'Masculin', null, 'AUS Basketball M'),
  ('2f0ea5dc-7634-4dc4-8bb8-b78f246b654c', 'c421e8ac-11f8-4c1e-8e59-ba1fbcd4d1e3', 'Axemen / Axewomen', 'Basketball', 'Féminin', null, 'AUS Basketball F'),
  ('29815e5f-399b-4f70-8a62-38dd35490801', '402ff2a8-96d2-4d64-86e1-0da5c3c95c17', 'Huskies', 'Basketball', 'Féminin', null, 'AUS Basketball F'),
  ('728d0e38-ecd0-472f-8dd8-02d042b963a9', 'd09e08f6-d24a-4a7d-839c-f12e6aa99174', 'Capers', 'Basketball', 'Féminin', null, 'AUS Basketball F'),
  ('948ca8da-7fee-4a44-8ab3-70a64a37462c', '1e001765-69bb-4d63-8d4c-7fb2603c9876', 'Tigers', 'Basketball', 'Féminin', null, 'AUS Basketball F'),
  ('5d04631e-3955-4cb4-8090-e8ca7964dcac', '0c9df422-c400-401a-873a-12c8d53765cb', 'X-Men / X-Women', 'Basketball', 'Féminin', null, 'AUS Basketball F'),
  ('9868d395-d35c-4ef9-88f2-721d74be5e02', 'ce40deb7-10f5-4463-8998-4f4aa57c8842', 'Sea-Hawks', 'Basketball', 'Féminin', null, 'AUS Basketball F'),
  ('6de15281-0b87-4d59-8c0b-c3c3bd5ba1bb', '3d67a1e9-b3d8-484c-8303-beb5bdfd3577', 'Reds', 'Basketball', 'Féminin', null, 'AUS Basketball F'),
  ('c36bb638-90d6-441e-89d6-88a15052b0f9', 'c70f6a18-1d63-40fc-84d1-050ada42d2cf', 'Panthers', 'Basketball', 'Féminin', null, 'AUS Basketball F'),
  ('e36571b0-c988-4747-841e-e6f4341b97a3', '402ff2a8-96d2-4d64-86e1-0da5c3c95c17', 'Huskies', 'Football', 'Masculin', null, 'AUS Football M'),
  ('0cd8b04a-710e-4396-834d-786acb7ad9ac', '0c9df422-c400-401a-873a-12c8d53765cb', 'X-Men / X-Women', 'Football', 'Masculin', null, 'AUS Football M'),
  ('02725bbd-1b56-4183-8fe8-e90086e8c0fb', 'f48ba92a-50e8-44a7-86c5-752768298bac', 'Mounties', 'Football', 'Masculin', null, 'AUS Football M'),
  ('b5d4adaa-80ec-4904-8ea8-ac8ff1ea6415', 'c421e8ac-11f8-4c1e-8e59-ba1fbcd4d1e3', 'Axemen / Axewomen', 'Football', 'Masculin', null, 'AUS Football M'),
  ('1cd541d2-af05-4dfd-8535-5846189e53ca', '0c9df422-c400-401a-873a-12c8d53765cb', 'X-Men / X-Women', 'Hockey', 'Masculin', null, 'AUS Hockey M'),
  ('ab100b71-2bde-4a79-8ef0-f4c85c0c5c1c', '55caab73-a9ff-4330-8ed7-2d728c85a6cb', 'Aigles Bleus / Aigles Bleues', 'Hockey', 'Masculin', null, 'AUS Hockey M'),
  ('da9e4434-67d5-46ba-8d58-2348f92c131d', '402ff2a8-96d2-4d64-86e1-0da5c3c95c17', 'Huskies', 'Hockey', 'Masculin', null, 'AUS Hockey M'),
  ('3e6d11cc-2b0e-4b9e-8918-73cd52966f71', 'c421e8ac-11f8-4c1e-8e59-ba1fbcd4d1e3', 'Axemen / Axewomen', 'Hockey', 'Masculin', null, 'AUS Hockey M'),
  ('f689e37a-d8f3-478c-8640-f72146871628', '1e001765-69bb-4d63-8d4c-7fb2603c9876', 'Tigers', 'Hockey', 'Masculin', null, 'AUS Hockey M'),
  ('e544d889-7842-45a9-8c44-e8928d70e9ca', '3d67a1e9-b3d8-484c-8303-beb5bdfd3577', 'Reds', 'Hockey', 'Masculin', null, 'AUS Hockey M'),
  ('549bc3d0-3ef2-4c38-88c6-a40917c6abbe', 'c70f6a18-1d63-40fc-84d1-050ada42d2cf', 'Panthers', 'Hockey', 'Masculin', null, 'AUS Hockey M'),
  ('3e7bc58c-1157-4271-8836-7df21fd2782c', 'ff857fa9-7659-4e5b-85ab-e9dcc7386d1e', 'Tommies', 'Hockey', 'Féminin', null, 'AUS Hockey F'),
  ('68b4ffbf-00ef-4e58-8ee1-ad922a6ca6e3', '0c9df422-c400-401a-873a-12c8d53765cb', 'X-Men / X-Women', 'Hockey', 'Féminin', null, 'AUS Hockey F'),
  ('b86e46f9-ea92-4b85-8806-442e213b94cd', '402ff2a8-96d2-4d64-86e1-0da5c3c95c17', 'Huskies', 'Hockey', 'Féminin', null, 'AUS Hockey F'),
  ('36959ed3-e7c7-4140-8a8d-c90e90ff030c', '1e001765-69bb-4d63-8d4c-7fb2603c9876', 'Tigers', 'Hockey', 'Féminin', null, 'AUS Hockey F'),
  ('33969897-9843-439d-890d-aad98af9cb80', '55caab73-a9ff-4330-8ed7-2d728c85a6cb', 'Aigles Bleus / Aigles Bleues', 'Hockey', 'Féminin', null, 'AUS Hockey F'),
  ('40308c47-00cc-4dcd-813b-382d57662b92', 'f48ba92a-50e8-44a7-86c5-752768298bac', 'Mounties', 'Hockey', 'Féminin', null, 'AUS Hockey F'),
  ('baf0fa6a-d103-4c5d-86f3-e6d827ba74b4', '3d67a1e9-b3d8-484c-8303-beb5bdfd3577', 'Reds', 'Hockey', 'Féminin', null, 'AUS Hockey F'),
  ('9b2b1ca8-9e2b-426a-8ee3-ceabad0d0ff7', 'c70f6a18-1d63-40fc-84d1-050ada42d2cf', 'Panthers', 'Hockey', 'Féminin', null, 'AUS Hockey F'),
  ('5352f043-1527-4129-8272-a6691f9bb67e', '1e001765-69bb-4d63-8d4c-7fb2603c9876', 'Tigers', 'Volleyball', 'Féminin', null, 'AUS Volleyball F'),
  ('4d4b98e6-037f-47e8-8857-4584b936a516', 'c421e8ac-11f8-4c1e-8e59-ba1fbcd4d1e3', 'Axemen / Axewomen', 'Volleyball', 'Féminin', null, 'AUS Volleyball F'),
  ('51546eb2-1acb-41c8-8419-89e9b90905b4', '55caab73-a9ff-4330-8ed7-2d728c85a6cb', 'Aigles Bleus / Aigles Bleues', 'Volleyball', 'Féminin', null, 'AUS Volleyball F'),
  ('2c24d6c1-e3e4-45f1-81f9-d9b0e3c90cb2', '402ff2a8-96d2-4d64-86e1-0da5c3c95c17', 'Huskies', 'Volleyball', 'Féminin', null, 'AUS Volleyball F'),
  ('7274687f-85f9-474b-863c-3c6ce0e48217', 'ce40deb7-10f5-4463-8998-4f4aa57c8842', 'Sea-Hawks', 'Volleyball', 'Féminin', null, 'AUS Volleyball F'),
  ('eab59b65-3974-40b7-8314-c21793bf8383', '3d67a1e9-b3d8-484c-8303-beb5bdfd3577', 'Reds', 'Volleyball', 'Féminin', null, 'AUS Volleyball F'),
  ('26917066-0829-4d84-850e-cd435950c268', '0c9df422-c400-401a-873a-12c8d53765cb', 'X-Men / X-Women', 'Soccer', 'Masculin', null, 'AUS Soccer M'),
  ('18013771-b275-4b8b-811c-fac876173fa9', 'd09e08f6-d24a-4a7d-839c-f12e6aa99174', 'Capers', 'Soccer', 'Masculin', null, 'AUS Soccer M'),
  ('01eb239c-8580-4fec-8564-854c27739559', '1e001765-69bb-4d63-8d4c-7fb2603c9876', 'Tigers', 'Soccer', 'Masculin', null, 'AUS Soccer M'),
  ('2f048652-c5d2-443c-89ee-4a8b4eb144d0', '55caab73-a9ff-4330-8ed7-2d728c85a6cb', 'Aigles Bleus / Aigles Bleues', 'Soccer', 'Masculin', null, 'AUS Soccer M'),
  ('c4f24714-a2d6-4f69-876f-e5536a564006', 'c421e8ac-11f8-4c1e-8e59-ba1fbcd4d1e3', 'Axemen / Axewomen', 'Soccer', 'Masculin', null, 'AUS Soccer M'),
  ('eff94dc9-d6d7-4d08-8d5a-057c5b803095', 'ce40deb7-10f5-4463-8998-4f4aa57c8842', 'Sea-Hawks', 'Soccer', 'Masculin', null, 'AUS Soccer M'),
  ('e607c055-636f-497e-8746-2d2ca73edb2d', '402ff2a8-96d2-4d64-86e1-0da5c3c95c17', 'Huskies', 'Soccer', 'Masculin', null, 'AUS Soccer M'),
  ('2e506281-f4d5-4792-8623-a8a976a431ec', 'f48ba92a-50e8-44a7-86c5-752768298bac', 'Mounties', 'Soccer', 'Masculin', null, 'AUS Soccer M'),
  ('4df7859d-d740-40ba-8202-444b65f80146', '3d67a1e9-b3d8-484c-8303-beb5bdfd3577', 'Reds', 'Soccer', 'Masculin', null, 'AUS Soccer M'),
  ('b20b724f-f24f-4531-8ebd-bc89b71f0c37', 'c70f6a18-1d63-40fc-84d1-050ada42d2cf', 'Panthers', 'Soccer', 'Masculin', null, 'AUS Soccer M'),
  ('3194991f-a052-47b5-87cc-35c3a058b345', 'd09e08f6-d24a-4a7d-839c-f12e6aa99174', 'Capers', 'Soccer', 'Féminin', null, 'AUS Soccer F'),
  ('7f6bd2d4-fa12-4946-8d38-bbdd5db4733d', '1e001765-69bb-4d63-8d4c-7fb2603c9876', 'Tigers', 'Soccer', 'Féminin', null, 'AUS Soccer F'),
  ('984fd30a-f0be-4be3-8c69-00117626f0c8', '0c9df422-c400-401a-873a-12c8d53765cb', 'X-Men / X-Women', 'Soccer', 'Féminin', null, 'AUS Soccer F'),
  ('060b6b8e-f502-4da1-801b-5c1c6ff50f09', 'ce40deb7-10f5-4463-8998-4f4aa57c8842', 'Sea-Hawks', 'Soccer', 'Féminin', null, 'AUS Soccer F'),
  ('b8cf31e1-1bbb-4081-81ff-59bcb20b0316', 'c421e8ac-11f8-4c1e-8e59-ba1fbcd4d1e3', 'Axemen / Axewomen', 'Soccer', 'Féminin', null, 'AUS Soccer F'),
  ('6caa0fc4-6816-4306-8671-4eba4acdf135', '55caab73-a9ff-4330-8ed7-2d728c85a6cb', 'Aigles Bleus / Aigles Bleues', 'Soccer', 'Féminin', null, 'AUS Soccer F'),
  ('68a3b7c0-5d5c-4216-8a10-eea45fb0c393', '402ff2a8-96d2-4d64-86e1-0da5c3c95c17', 'Huskies', 'Soccer', 'Féminin', null, 'AUS Soccer F'),
  ('19595598-0263-4726-8c31-6fd9e26fdd61', 'f48ba92a-50e8-44a7-86c5-752768298bac', 'Mounties', 'Soccer', 'Féminin', null, 'AUS Soccer F'),
  ('b4f57d95-4290-470c-825e-aa5d7eb5f9ad', '3d67a1e9-b3d8-484c-8303-beb5bdfd3577', 'Reds', 'Soccer', 'Féminin', null, 'AUS Soccer F'),
  ('815e8e78-e8a2-4936-80b9-a3713297f745', 'c70f6a18-1d63-40fc-84d1-050ada42d2cf', 'Panthers', 'Soccer', 'Féminin', null, 'AUS Soccer F'),
  ('16e248e5-d039-4efd-840d-774a4241618b', 'c421e8ac-11f8-4c1e-8e59-ba1fbcd4d1e3', 'Axemen / Axewomen', 'Rugby', 'Féminin', null, 'AUS Rugby F'),
  ('57146f9e-b24e-44f6-8b27-8ea4db539adc', '0c9df422-c400-401a-873a-12c8d53765cb', 'X-Men / X-Women', 'Rugby', 'Féminin', null, 'AUS Rugby F'),
  ('444fbe2b-eb9e-497a-87e8-40b4a567deb9', '402ff2a8-96d2-4d64-86e1-0da5c3c95c17', 'Huskies', 'Rugby', 'Féminin', null, 'AUS Rugby F'),
  ('193a4962-076c-4fc9-8d2a-0b52c8b53ce8', 'c70f6a18-1d63-40fc-84d1-050ada42d2cf', 'Panthers', 'Rugby', 'Féminin', null, 'AUS Rugby F'),
  ('b83e73c9-689d-4083-892b-dc707ac97b9c', '1e001765-69bb-4d63-8d4c-7fb2603c9876', 'Tigers', 'Volleyball', 'Masculin', null, 'RSEQ Volleyball M'),
  ('ed8b2845-011a-4936-8dc8-a883de39e7ec', '3d67a1e9-b3d8-484c-8303-beb5bdfd3577', 'Reds', 'Volleyball', 'Masculin', null, 'RSEQ Volleyball M'),
  ('d3246c75-d973-4d0c-8520-7484402ec80c', '50c40f3d-1855-4aa5-86ab-d8dedf77383f', 'Ravens', 'Rugby', 'Féminin', null, 'RSEQ Rugby F'),
  ('3018d97c-97d0-46d2-8040-470b2b4dce15', '35886226-47b0-4288-84e3-67a404766fe9', 'Gee-Gees', 'Rugby', 'Féminin', null, 'RSEQ Rugby F');

-- ── GARDES D'AVANT ───────────────────────────────────────────────────────────
do $$
begin
  if current_user <> 'postgres' then
    raise exception 'NEXUS: lancer en postgres, pas en %', current_user;
  end if;
  if (select count(*) from _ecoles) <> 47 or (select count(*) from _equipes) <> 345 then
    raise exception 'NEXUS: données embarquées incomplètes';
  end if;
  if not exists (select 1 from supabase_migrations.schema_migrations where version = '20261028000000')
     or to_regprocedure('public.verrou_universites()') is null then
    raise exception 'NEXUS: préalable D0 (20261028000000) absent';
  end if;
  if (select count(*) from pg_policies where policyname = 'universites_masquees' and permissive = 'RESTRICTIVE'
         and cmd = 'SELECT' and tablename in ('schools', 'teams')) <> 2 then
    raise exception 'NEXUS: préalable D1a (universités masquées) absent — rien ne doit être importé avant';
  end if;
  if to_regprocedure('public.ids_universites()') is not null
     or to_regprocedure('nexus_prive.ids_universites()') is null
     or to_regprocedure('public.verrou_reference_universite()') is null then
    raise exception 'NEXUS: préalable D1a2 (fonctions DEFINER fermées) absent — rien ne doit être importé avant';
  end if;
  if (select count(*) from public.schools where type = 'UNIVERSITE') <> 12
     or not exists (select 1 from public.admin_operations where operation = 'CEGEP_LOT_D1_UNIVERSITES') then
    raise exception 'NEXUS: préalable D1 (12 universités du Québec) absent ou autre état';
  end if;
  if exists (select 1 from public.schools s join _ecoles e on e.cle = s.id or lower(e.name) = lower(s.name)) then
    raise exception 'NEXUS: une des universités existe déjà (identifiant ou nom)';
  end if;
  if exists (select 1 from public.teams t join _equipes q on q.cle = t.id) then
    raise exception 'NEXUS: une des équipes universitaires existe déjà';
  end if;
  if exists (select 1 from _ecoles where province = 'QC' or province is null) then
    raise exception 'NEXUS: une université du lot est au Québec ou sans province';
  end if;
  if exists (select 1 from _equipes q left join public.sports s on s.nom = q.sport where s.id is null) then
    raise exception 'NEXUS: un sport des équipes est absent du catalogue Nexus';
  end if;
  if exists (select 1 from _equipes q left join _ecoles e on e.cle = q.cle_ecole where e.name is null) then
    raise exception 'NEXUS: une équipe pointe hors des universités du lot';
  end if;
  if exists (select 1 from public.admin_operations where operation in ('CEGEP_LOT_D1B_UNIVERSITES_CANADA', 'CEGEP_LOT_D1B_UNIVERSITES_CANADA_RETIREES')) then
    raise exception 'NEXUS: le lot D1b a déjà laissé une trace dans admin_operations';
  end if;
end $$;

-- ── Empreinte (hors lignes créées) ───────────────────────────────────────────
create function pg_temp.empreinte() returns table (objet text, n bigint, md5 text) language sql as $$
  select 'schools (hors lot)', count(*), md5(coalesce(string_agg(id::text || type || name, ',' order by id), '')) from public.schools s where not exists (select 1 from _ecoles e where e.cle = s.id)
  union all
  select 'teams (hors lot)', count(*), md5(coalesce(string_agg(id::text || school_id::text || name, ',' order by id), ''))
    from public.teams t where not exists (select 1 from _equipes q where q.cle = t.id)
  union all
  select 'athletes', count(*), md5(coalesce(string_agg(id::text || coalesce(school_id::text, '·'), ',' order by id), '')) from public.athletes
  union all
  select 'users', count(*), md5(coalesce(string_agg(id::text || coalesce(school_id::text, '·') || coalesce(context, '·'), ',' order by id), '')) from public.users
  union all
  select 'team_athletes', count(*), md5(coalesce(string_agg(id::text || team_id::text, ',' order by id), '')) from public.team_athletes
  union all
  select 'games (côtés hors univ.)', count(*), md5(coalesce(string_agg(id::text || coalesce(home_team_id::text, '·') || coalesce(visitor_team_id::text, '·'), ',' order by id), ''))
    from public.games g;
$$;
create temp table _emp_avant on commit drop as select * from pg_temp.empreinte();
select 'AVANT' as moment, * from _emp_avant order by objet;

-- Hors RSEQ : aucun match à relier (aucun identifiant RSEQ).
create temp table _cotes on commit drop as select 0::bigint as domicile, 0::bigint as visiteur;

-- ── Banc des fonctions SECURITY DEFINER et des vues propriétaire ─────────────
-- Toute fonction qu'un client peut appeler (/rpc) et qui lit écoles ou équipes est appelée avec les claims
-- d'un vrai compte de chaque rôle non admin (ce que PostgREST pose depuis le jeton : request.jwt.claims +
-- rôle authenticated / anon), AVANT puis APRÈS la création, chaque appel défait aussitôt. Les arguments
-- d'identifiant reçoivent ceux des universités (pire cas : un client qui les connaîtrait). FUITE = un
-- identifiant d'université ou d'équipe universitaire dans la réponse, ou plus de noms universitaires
-- qu'avant la création. Les fonctions booléennes ou réservées à l'admin sont classées dans D1-AUDIT-DEFINER.md.
set local statement_timeout = '600s';
create temp table _banc_roles on commit drop as
select 1 as o, 'athlète' as role, (select u.id from public.users u join public.athletes a on a.user_id = u.id
         where u.role = 'ATHLETE'::public.user_role and exists (select 1 from public.team_athletes ta where ta.athlete_id = a.id)
         order by u.id limit 1) as uid
union all select 2, 'parent', (select u.id from public.users u where u.role = 'PARENT'::public.user_role order by u.id limit 1)
union all select 3, 'coach', (select u.id from public.users u where u.role = 'COACH'::public.user_role
         and exists (select 1 from public.team_coaches tc where tc.coach_id = u.id) order by u.id limit 1)
union all select 4, 'recruteur collégial', coalesce(
         (select c.cree_par from public.cartes_prospect c join public.users u on u.id = c.cree_par
           where u.role = 'RECRUTEUR'::public.user_role and u.context is distinct from 'universitaire' and c.fusionnee_le is null order by c.created_at desc, c.id limit 1),
         (select u.id from public.users u where u.role = 'RECRUTEUR'::public.user_role and u.context is distinct from 'universitaire' and u.onboarding_complete order by u.id limit 1))
union all select 5, 'partenaire', (select mp.user_id from public.media_partners mp join public.users u on u.id = mp.user_id
         where u.role = 'PARTNER'::public.user_role
         order by exists (select 1 from _equipes q join public.sports s on s.nom = q.sport
                           where public.partenaire_peut_evaluer(mp.id, s.id)) desc,
                  (select count(*) from public.partenaire_prospects pp where pp.partner_id = mp.id) desc, mp.user_id limit 1)
union all select 6, 'anon (site public)', null::uuid;
do $$
begin
  if exists (select 1 from _banc_roles where uid is null and role not like 'anon%') then
    raise exception 'NEXUS: banc — un compte témoin manque';
  end if;
end $$;

-- Arguments, lus en postgres AVANT de changer de rôle. Avant la création, les ids universitaires sont factices.
create function pg_temp.ctx() returns jsonb language sql as $$
  with mp as (select mp.id from public.media_partners mp where mp.user_id = (select uid from _banc_roles where o = 5)),
       ut as (select t.id, t.sport_id from public.teams t join _equipes q on q.cle = t.id)
  select jsonb_build_object(
    'U',   coalesce((select s.id from public.schools s where s.type = 'UNIVERSITE' order by s.name limit 1), '00000000-0000-4000-8000-0000000000d1'),
    'UA',  coalesce((select array_agg(s.id) from public.schools s where s.type = 'UNIVERSITE'), '{}'),
    'T',   coalesce((select id from ut order by id limit 1), '00000000-0000-4000-8000-0000000000d2'),
    'TA',  coalesce((select array_agg(id) from ut), '{}'),
    'TP',  coalesce((select ut.id from ut, mp where public.partenaire_peut_evaluer(mp.id, ut.sport_id) order by ut.id limit 1),
                    (select id from ut order by id limit 1), '00000000-0000-4000-8000-0000000000d2'),
    'TPS', coalesce((select ut.sport_id from ut, mp where public.partenaire_peut_evaluer(mp.id, ut.sport_id) order by ut.id limit 1),
                    (select sport_id from ut order by id limit 1), (select sport_id from public.teams order by id limit 1)),
    'ATH', (select array_agg(id) from (select a.id from public.athletes a order by a.id limit 200) x),
    'A1',  (select a.id from public.athletes a order by a.id limit 1),
    'CP',  coalesce((select array_agg(id) from (select c.id from public.cartes_prospect c order by c.id limit 300) x), '{}'),
    'G',   (select g.id from public.games g where g.game_date >= current_date order by g.game_date, g.id limit 1),
    'CEG', coalesce((select c.unite_cegep_id from public.cartes_prospect c where c.cree_par = (select uid from _banc_roles where o = 4)
                      and c.fusionnee_le is null order by c.created_at desc, c.id limit 1),
                    (select u.school_id from public.users u where u.id = (select uid from _banc_roles where o = 4))),
    'CR',  (select c.id from public.cartes_prospect c where c.cree_par = (select uid from _banc_roles where o = 4)
             and c.fusionnee_le is null order by c.created_at desc, c.id limit 1),
    'TC',  coalesce((select ut.id from ut where ut.sport_id = (select c.unite_sport_id from public.cartes_prospect c
                       where c.cree_par = (select uid from _banc_roles where o = 4) and c.fusionnee_le is null
                       order by c.created_at desc, c.id limit 1) order by ut.id limit 1),
                    (select id from ut order by id limit 1), '00000000-0000-4000-8000-0000000000d2'),
    'INV', (select ti.id from public.team_invitations ti order by ti.created_at desc limit 1));
$$;
create function pg_temp.remplir(p_tpl text, c jsonb) returns text language plpgsql as $$
declare k text; v text;
begin
  foreach k in array array['UA', 'TA', 'TPS', 'TP', 'ATH', 'A1', 'CP', 'CEG', 'CR', 'TC', 'INV', 'U', 'T', 'G'] loop
    v := case when jsonb_typeof(c -> k) = 'array'
              then quote_literal(coalesce((select '{' || string_agg(x, ',') || '}' from jsonb_array_elements_text(c -> k) x), '{}')) || '::uuid[]'
              when c ->> k is null then 'null::uuid'
              else quote_literal(c ->> k) || '::uuid' end;
    p_tpl := replace(p_tpl, '{' || k || '}', v);
  end loop;
  return p_tpl;
end $$;

create temp table _appels (n int primary key, objet text not null, appel text not null) on commit drop;
insert into _appels values
  (1,  'admin_cegeps_sans_programme()',            'select jsonb_agg(x)::text from public.admin_cegeps_sans_programme() x'),
  (2,  'athletes_nom_proche(…, université)',       'select jsonb_agg(x)::text from public.athletes_nom_proche(''Jean'', ''Tremblay'', {U}) x'),
  (3,  'cartes_par_ids(300 cartes)',               'select public.cartes_par_ids({CP})::text'),
  (4,  'coachs_nommables_equipe(équipe univ.)',    'select jsonb_agg(x)::text from public.coachs_nommables_equipe({T}) x'),
  (5,  'depistage_profils_match(prochain match)',  'select jsonb_agg(x)::text from public.depistage_profils_match({G}) x'),
  (6,  'get_my_children()',                        'select jsonb_agg(x)::text from public.get_my_children() x'),
  (7,  'ids_universites() — /rpc public',          'select public.ids_universites()::text'),
  (8,  'invitation_equipe_coach(dernière)',        'select public.invitation_equipe_coach({INV})::text'),
  (9,  'list_interested_recruiters()',             'select jsonb_agg(x)::text from public.list_interested_recruiters() x'),
  (10, 'list_team_commits(équipe univ.)',          'select jsonb_agg(x)::text from public.list_team_commits({T}) x'),
  (11, 'lookup_civil_unclaimed_by_email(''a'')',   'select jsonb_agg(x)::text from public.lookup_civil_unclaimed_by_email(''a'') x'),
  (12, 'matchs_recherche(31 jours)',                'select jsonb_agg(x)::text from public.matchs_recherche(current_date, current_date + 30) x'),
  (13, 'matchs_recherche(équipes univ.)',          'select jsonb_agg(x)::text from public.matchs_recherche(current_date - 200, current_date + 200, null, null, null, {TA}) x'),
  (14, 'matchs_recherche(texte « laval »)',        'select jsonb_agg(x)::text from public.matchs_recherche(current_date, current_date + 30, null, null, ''laval'') x'),
  (15, 'matchs_suggestions(« laval »)',            'select jsonb_agg(x)::text from public.matchs_suggestions(''laval'') x'),
  (16, 'matchs_suggestions(« université »)',       'select jsonb_agg(x)::text from public.matchs_suggestions(''université'') x'),
  (17, 'matchs_suggestions(« rouge et or »)',      'select jsonb_agg(x)::text from public.matchs_suggestions(''rouge et or'') x'),
  (18, 'matchs_suggestions(« carabins »)',         'select jsonb_agg(x)::text from public.matchs_suggestions(''carabins'') x'),
  (19, 'partenaire_depistage_cartes(univ., équipes univ.)', 'select jsonb_agg(x)::text from public.partenaire_depistage_cartes({UA}, {TA}) x'),
  (20, 'partenaire_mes_athletes()',                'select jsonb_agg(x)::text from public.partenaire_mes_athletes() x'),
  (21, 'partenaire_prospects_terminees()',         'select jsonb_agg(x)::text from public.partenaire_prospects_terminees() x'),
  (22, 'partenaire_rapprochements()',              'select jsonb_agg(x)::text from public.partenaire_rapprochements() x'),
  (23, 'partenaire_rapprochements_refuses()',      'select jsonb_agg(x)::text from public.partenaire_rapprochements_refuses() x'),
  (24, 'partner_athlete_profile(une fiche)',       'select jsonb_agg(x)::text from public.partner_athlete_profile({A1}) x'),
  (25, 'partner_newsroom_events()',                'select jsonb_agg(x)::text from public.partner_newsroom_events() x'),
  (26, 'processus_cartes(université)',             'select public.processus_cartes({U}, null, true)::text'),
  (27, 'processus_cartes(son cégep)',              'select public.processus_cartes({CEG}, null, true)::text'),
  (28, 'rapprochements_refuses_unite()',           'select jsonb_agg(x)::text from public.rapprochements_refuses_unite() x'),
  (29, 'rapprochements_unite()',                   'select jsonb_agg(x)::text from public.rapprochements_unite() x'),
  (30, 'recruiter_athlete_cards(200 fiches)',      'select jsonb_agg(x)::text from public.recruiter_athlete_cards({ATH}) x'),
  (31, 'recruiter_athlete_profile(une fiche)',     'select jsonb_agg(x)::text from public.recruiter_athlete_profile({A1}) x'),
  (32, 'recruiter_search_athletes()',              'select jsonb_agg(x)::text from public.recruiter_search_athletes() x'),
  (33, 'recruiter_search_athletes(« laval »)',     'select jsonb_agg(x)::text from public.recruiter_search_athletes(''laval'') x'),
  (34, 'team_record_hint(équipe univ.)',           'select public.team_record_hint({T})'),
  (35, 'vue top_athletes_view',                    'select jsonb_agg(v)::text from (select * from public.top_athletes_view limit 1000) v'),
  (36, 'vue trending_athletes_view',               'select jsonb_agg(v)::text from (select * from public.trending_athletes_view limit 1000) v');

-- Rend « ok <ids univ.> <noms univ.> », « refusé <sqlstate> », « absente » (fonction retirée de l'API) ou « ERREUR ».
create function pg_temp.appel(p_role text, p_uid uuid, p_sql text, p_ids text[], p_noms text[]) returns text
language plpgsql as $$
declare v text; n_id int; n_nom int;
begin
  begin
    if p_uid is null then
      perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
      perform set_config('role', 'anon', true);
    else
      perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
    end if;
    execute p_sql into v;
    v := lower(coalesce(v, ''));
    select count(*) into n_id from unnest(p_ids) m where strpos(v, m) > 0;
    -- Occurrences (pas seulement présence) : un nom déjà présent avant la création ne masque pas un ajout.
    select coalesce(sum((length(v) - length(replace(v, m, ''))) / length(m)), 0) into n_nom from unnest(p_noms) m;
    raise exception using errcode = 'NX000', message = 'ok ' || n_id || ' ' || n_nom;
  exception
    when sqlstate 'NX000' then return sqlerrm;
    when undefined_function then return 'absente';
    when insufficient_privilege then return 'refusé 42501';
    when others then
      if sqlerrm like 'NEXUS%' then return 'refusé ' || sqlstate; end if;
      return 'ERREUR ' || sqlstate || ' ' || left(sqlerrm, 70);
  end;
end $$;
create temp table _banc (moment text, o int, role text, n int, resultat text) on commit drop;
create function pg_temp.banc(p_moment text) returns void language plpgsql as $$
declare c jsonb := pg_temp.ctx(); r record; a record;
        v_ids text[]; v_noms text[];
begin
  select coalesce(array_agg(x), '{}') into v_ids from (
    select s.id::text as x from public.schools s where s.type = 'UNIVERSITE'
    union select t.id::text from public.teams t join _equipes q on q.cle = t.id) z;
  select coalesce(array_agg(distinct x), '{}') into v_noms from (
    select lower(name) as x from _ecoles union select lower(team_name) from _ecoles union select lower(nom) from _equipes) z
   where length(x) >= 5;
  for r in select * from _banc_roles order by o loop
    for a in select * from _appels order by n loop
      insert into _banc values (p_moment, r.o, r.role, a.n, pg_temp.appel(r.role, r.uid, pg_temp.remplir(a.appel, c), v_ids, v_noms));
    end loop;
  end loop;
end $$;
select pg_temp.banc('avant');

-- ── Création ─────────────────────────────────────────────────────────────────
insert into public.schools (id, name, type, province, team_name, city, region, langue, website)
select cle, name, 'UNIVERSITE', province, team_name, city, region, langue, website from _ecoles;

insert into public.teams (id, school_id, sport_id, name, division, league, season, is_active, age_group, gender)
select q.cle, q.cle_ecole, sp.id, q.nom, q.division, q.ligue || ' (2026-2027)', '2026-2027', true, 'Universitaire', q.gender
  from _equipes q
  join public.sports sp on sp.nom = q.sport;

-- ── Ce qui a été créé (par université) ───────────────────────────────────────
select s.province, s.name as universite, s.team_name as programme, s.city as ville, count(t.id) as equipes,
       string_agg(sp.nom || ' ' || left(coalesce(t.gender, '?'), 1) || coalesce(' ' || t.division, ''), ', ' order by sp.nom, t.gender) as detail
  from public.schools s
  left join public.teams t on t.school_id = s.id
  left join public.sports sp on sp.id = t.sport_id
 where s.id in (select cle from _ecoles)
 group by s.province, s.name, s.team_name, s.city order by s.province, s.name;

create temp table _emp_apres on commit drop as select * from pg_temp.empreinte();
select 'APRÈS' as moment, a.objet, a.n, a.md5, case when a.n = b.n and a.md5 = b.md5 then '=' else 'CHANGE' end as vs_avant
  from _emp_apres a join _emp_avant b using (objet) order by objet;

-- Le verrou D0 tient sur les nouvelles lignes (essai défait aussitôt).
create function pg_temp.essai(p_sql text) returns text language plpgsql as $$
begin
  begin
    execute p_sql;
    raise exception using errcode = 'NX000', message = 'accepté';
  exception
    when sqlstate 'NX000' then return 'accepté';
    when others then return 'REFUSÉ ' || sqlstate || case when sqlerrm like 'NEXUS%' then ' ' || left(sqlerrm, 60) else '' end;
  end;
end $$;
create temp table _verrou on commit drop as
select 'fiche athlète → une université du lot' as essai,
       pg_temp.essai(format('update public.athletes set school_id = %L where id = %L',
         (select cle from _ecoles order by name limit 1),
         (select id from public.athletes order by id limit 1))) as resultat
union all
select 'fiche athlète → une équipe universitaire',
       pg_temp.essai(format('insert into public.team_athletes (team_id, athlete_id, sport_id) values (%L, %L, %L)',
         t.id, (select id from public.athletes order by id limit 1), t.sport_id))
  from (select t.id, t.sport_id from public.teams t join _equipes q on q.cle = t.id order by t.id limit 1) t;
select * from _verrou;

-- Ce que voient les utilisateurs (policies D1a), essai défait aussitôt : écoles univ. / équipes univ.
-- En prod, anon ne lit aucune équipe : « refusé ».
create function pg_temp.compte_vu(q text, ids uuid[]) returns text language plpgsql as $$
declare n bigint;
begin
  execute q into n using ids; return n::text;
exception when insufficient_privilege then return 'refusé';
end $$;
create function pg_temp.vu(p_role text, p_uid uuid) returns text language plpgsql as $$
declare v text; v_ids uuid[] := (select array_agg(cle) from _equipes);  -- lu AVANT de changer de rôle
begin
  begin
    if p_role = 'anon' then
      perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
    else
      perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
    end if;
    perform set_config('role', p_role, true);
    v := pg_temp.compte_vu('select count(*) from public.schools where type = ''UNIVERSITE''', v_ids) || ' / ' ||
         pg_temp.compte_vu('select count(*) from public.teams t where t.id = any ($1)', v_ids);
    raise exception using errcode = 'NX000', message = v;
  exception
    when sqlstate 'NX000' then return sqlerrm;
    when others then return 'ERREUR ' || sqlstate;
  end;
end $$;
create temp table _vu on commit drop as
select 'anon (site public)' as role, pg_temp.vu('anon', null) as vu
union all select 'athlète', pg_temp.vu('authenticated', (select u.id from public.users u where u.role = 'ATHLETE'::public.user_role order by u.id limit 1))
union all select 'coach', pg_temp.vu('authenticated', (select u.id from public.users u where u.role = 'COACH'::public.user_role order by u.id limit 1))
union all select 'recruteur collégial', pg_temp.vu('authenticated', (select u.id from public.users u where u.role = 'RECRUTEUR'::public.user_role and u.context is distinct from 'universitaire' order by u.id limit 1))
union all select 'partenaire', pg_temp.vu('authenticated', (select u.id from public.users u where u.role = 'PARTNER'::public.user_role order by u.id limit 1))
union all select 'admin', pg_temp.vu('authenticated', (select u.id from public.users u where u.role = 'ADMIN'::public.user_role order by u.id limit 1));
select role, vu as "écoles univ / équipes univ" from _vu;

-- Banc APRÈS la création, puis les chemins d'écriture qui feraient afficher une université par ces
-- fonctions (chaque essai défait aussitôt).
select pg_temp.banc('apres');
create function pg_temp.ecrire(p_uid uuid, p_sql text) returns text language plpgsql as $$
declare n bigint;
begin
  begin
    perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
    perform set_config('role', 'authenticated', true);
    execute p_sql;
    get diagnostics n = row_count;
    raise exception using errcode = 'NX000', message = 'accepté ' || n;
  exception
    when sqlstate 'NX000' then return sqlerrm;
    when others then return 'refusé ' || sqlstate || case when sqlerrm like 'NEXUS%' then ' ' || left(sqlerrm, 70) else '' end;
  end;
end $$;
create temp table _ecritures on commit drop as
with c as (select pg_temp.ctx() as c),
     e (o, role, essai, tpl) as (values
  (1, 'athlète', 'fiche : committed_school_id → université',
      'update public.athletes set committed_school_id = {U} where user_id = auth.uid()'),
  (3, 'coach', 'compte : primary_team_id → équipe univ.',
      'update public.users set primary_team_id = {T} where id = auth.uid()'),
  (3, 'coach', 'team_coaches : se rattacher à une équipe univ.',
      'insert into public.team_coaches (team_id, coach_id) values ({T}, auth.uid())'),
  (3, 'coach', 'create_team_join_token(équipe univ.)',
      'select public.create_team_join_token({T}, null, null)'),
  (4, 'recruteur collégial', 'carte prospect : school_id → université',
      'update public.cartes_prospect set school_id = {U} where id = {CR}'),
  (4, 'recruteur collégial', 'carte prospect : team_id → équipe univ.',
      'update public.cartes_prospect set team_id = {TC} where id = {CR}'),
  (4, 'recruteur collégial', 'changer_rattachement_recruteur(université)',
      'select public.changer_rattachement_recruteur(auth.uid(), {U}, ''Football'')'),
  (5, 'partenaire', 'partenaire_prospect_enregistrer(université, équipe univ.)',
      'select public.partenaire_prospect_enregistrer(null, ''Témoin'', ''Banc D1'', {TPS}, null, {U}, {TP}, null, true)'))
select e.o, e.role, e.essai, pg_temp.ecrire(r.uid, pg_temp.remplir(e.tpl, c.c)) as resultat
  from e cross join c join _banc_roles r on r.o = e.o;

-- Tableau : une ligne par fonction, une colonne par rôle (valeur APRÈS ; « ok ids noms »).
create temp table _banc_vu on commit drop as
select a.n, a.objet, ap.o, ap.role, ap.resultat as apres, av.resultat as avant,
       case when ap.resultat like 'ERREUR%' then 'ERREUR'
            when ap.resultat like 'ok %' and (split_part(ap.resultat, ' ', 2)::int > 0
                 or split_part(ap.resultat, ' ', 3)::int > coalesce(nullif(split_part(av.resultat, ' ', 3), '')::int, 0)
                    and av.resultat like 'ok %') then 'FUITE'
            when ap.resultat like 'ok %' and av.resultat not like 'ok %' and split_part(ap.resultat, ' ', 3)::int > 0 then 'FUITE'
            else '' end as alerte
  from _appels a
  join _banc ap on ap.n = a.n and ap.moment = 'apres'
  join _banc av on av.n = a.n and av.o = ap.o and av.moment = 'avant';
select n, objet,
       max(apres) filter (where o = 1) as athlete, max(apres) filter (where o = 2) as parent,
       max(apres) filter (where o = 3) as coach, max(apres) filter (where o = 4) as recruteur_collegial,
       max(apres) filter (where o = 5) as partenaire, max(apres) filter (where o = 6) as anon,
       coalesce(nullif(string_agg(distinct nullif(alerte, ''), ','), ''), '—') as alerte
  from _banc_vu group by n, objet order by n;
select role, essai, resultat from _ecritures order by o, essai;
select count(*) filter (where alerte = 'FUITE') as appels_qui_fuient,
       count(*) filter (where alerte = 'ERREUR') as appels_en_erreur,
       count(*) as appels,
       (select count(*) from _ecritures where resultat like 'accepté%' and resultat <> 'accepté 0') as ecritures_acceptees
  from _banc_vu;

do $$
declare n int;
begin
  select count(*) into n from public.schools s join _ecoles e on e.cle = s.id
   where s.type = 'UNIVERSITE' and s.province = e.province and s.name = e.name and s.rseq_institution_id is null;
  if n <> 47 then raise exception 'NEXUS: % université(s) conforme(s), attendu 47', n; end if;
  if (select count(*) from public.schools where type = 'UNIVERSITE') <> 12 + 47 then
    raise exception 'NEXUS: le nombre d''universités n''est pas 12 + 47';
  end if;
  select count(*) into n from public.teams t join _equipes q on q.cle = t.id
   where t.school_id = q.cle_ecole and t.season = '2026-2027' and t.age_group = 'Universitaire' and t.is_active
     and t.rseq_team_id is null;
  if n <> 345 then raise exception 'NEXUS: % équipe(s) conforme(s), attendu 345', n; end if;
  if exists (select 1 from _emp_apres a join _emp_avant b using (objet) where a.n <> b.n or a.md5 <> b.md5) then
    raise exception 'NEXUS: une donnée hors du lot a changé';
  end if;
  if exists (select 1 from _vu where role <> 'admin' and vu not in ('0 / 0', '0 / refusé')) or (select vu from _vu where role = 'admin') <> (12 + 47) || ' / 345' then
    raise exception 'NEXUS: un utilisateur non admin voit une université ou une équipe universitaire';
  end if;
  if exists (select 1 from _verrou where resultat not like 'REFUSÉ 42501 NEXUS: Une fiche athlète%') then
    raise exception 'NEXUS: le verrou D0 ne refuse pas une fiche athlète vers une université';
  end if;
  if exists (select 1 from _banc_vu where alerte = 'ERREUR') then
    raise exception 'NEXUS: banc — un appel a échoué sans être un refus (voir le tableau)';
  end if;
  if exists (select 1 from _banc_vu where alerte = 'FUITE') then
    raise exception 'NEXUS: banc — une fonction DEFINER rend une université ou une équipe universitaire';
  end if;
  if exists (select 1 from _ecritures where resultat like 'accepté%' and resultat <> 'accepté 0') then
    raise exception 'NEXUS: banc — un client peut faire pointer une ligne vers une université';
  end if;
  raise notice 'NEXUS: VERDICT D1b — 47 universités hors Québec, 345 équipes, rien d''autre ne bouge, invisibles hors admin, verrou tenu';
end $$;
select 'VERDICT' as verdict, 'conforme' as resultat;

-- ── Le rollback, joué dans la même transaction ───────────────────────────────
create temp table _rb on commit drop as select $nexus_rb$do $rb$
declare
  r record; n bigint; v_t uuid[]; v_s uuid[];
begin
  select coalesce(array_agg(t.id), '{}') into v_t from public.teams t join _equipes q on q.cle = t.id;
  select coalesce(array_agg(s.id), '{}') into v_s from public.schools s join _ecoles e on e.cle = s.id where s.type = 'UNIVERSITE';
  for r in
    select c.conrelid as tbl, a.attname as col, c.confrelid as cible
      from pg_constraint c
      join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
     where c.contype = 'f' and c.confrelid in ('public.teams'::regclass, 'public.schools'::regclass)
  loop
    if r.tbl = 'public.teams'::regclass and r.col = 'school_id' then
      continue;
    end if;
    execute format('select count(*) from %s where %I = any($1)', r.tbl::regclass, r.col)
      into n using case when r.cible = 'public.teams'::regclass then v_t else v_s end;
    if n > 0 then
      raise exception 'NEXUS: rollback D1b refusé : % ligne(s) de %.% pointent vers le lot', n, r.tbl::regclass, r.col;
    end if;
  end loop;
  delete from public.teams where id = any(v_t);
  delete from public.schools where id = any(v_s);
end $rb$;$nexus_rb$::text as corps;
do $$
begin
  if md5((select corps from _rb)) <> 'e13a94f5c0edd44845521a75f6522e50' then raise exception 'NEXUS: corps du rollback altéré'; end if;
  execute (select corps from _rb);
end $$;
do $$
begin
  if exists (select 1 from public.schools s join _ecoles e on e.cle = s.id)
     or exists (select 1 from public.teams t join _equipes q on q.cle = t.id)
     or exists (select 1 from pg_temp.empreinte() e join _emp_avant b using (objet) where e.n <> b.n or e.md5 <> b.md5) then
    raise exception 'NEXUS: après rollback, l''état n''est pas celui d''avant';
  end if;
  raise notice 'NEXUS: rollback D1b vérifié (0 université du lot, 0 équipe, empreinte identique à AVANT)';
end $$;

rollback;
\echo '== ROLLBACK fait : rien n''est appliqué.'
