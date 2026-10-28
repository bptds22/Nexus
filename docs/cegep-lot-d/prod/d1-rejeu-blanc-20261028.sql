-- ════════════════════════════════════════════════════════════════════════════
-- Lot D1 cégep — REJEU À BLANC (finit par ROLLBACK)
-- Les 12 universités québécoises du RSEQ (type UNIVERSITE, province QC) et leurs 84 équipes des
-- sports d'équipe de la saison 2026-2027, lues dans l'API RSEQ (s1.rseq.ca, secteur Universitaire).
-- Fichier GÉNÉRÉ par scripts/cegep-lot-d/generer-d1.mjs <date> <rejeu-blanc|apply|rollback> depuis
-- scripts/cegep-lot-d/d1-universites.json (empreinte 65b87625bc4083c189bfcde5fae2b428). Lancer SANS -1, en postgres.
--
-- Opération de DONNÉES (aucun objet de schéma). Préalables : D0 (20261028000000) et D1a (20261028010000,
-- universités masquées hors admin) en prod, correctif web /college promu.
-- Aucune fiche athlète, aucun compte, aucun classement touché. Les côtés de match NULL qui portent le
-- rseq_team_id d'une équipe créée sont reliés (la veille n'a pas chargé le secteur Universitaire : 0 attendu).
-- Joue aussi le rollback dans la transaction, puis ROLLBACK : rien n'est appliqué.
-- ════════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP 1
\pset pager off
\pset null '·'

begin;
set local lock_timeout = '3s';
set local statement_timeout = '120s';
set local search_path = public, extensions;
set local application_name = 'nexus-rejeu-blanc-cegep-d1';
select now() as debut, current_user;

create temp table _ecoles (rseq_institution_id uuid primary key, name text not null, team_name text, city text,
                           region text, langue text, website text) on commit drop;
insert into _ecoles values
  ('da7f9d58-d02a-4051-8d6b-9b4069d6316f', 'Université Laval', 'Rouge et Or', 'Québec', 'Capitale-Nationale', 'FR', 'https://rougeetor.ulaval.ca/'),
  ('78dbadd2-5d8c-4b45-a8af-1100e081630d', 'Université de Montréal', 'Carabins', 'Montréal', 'Montréal', 'FR', 'https://carabins.umontreal.ca/'),
  ('75ea03e5-4400-4744-a8dc-1ed249e23bdb', 'Université McGill', 'Redbirds et Martlets', 'Montréal', 'Montréal', 'EN', 'https://mcgillathletics.ca/'),
  ('ab6aabd3-3d1b-4de2-8d87-0509f72176ba', 'Université Concordia', 'Stingers', 'Montréal', 'Montréal', 'EN', null),
  ('92b3efd4-7bb5-448e-982c-944d6cbeb0a3', 'Université de Sherbrooke', 'Vert & Or', 'Sherbrooke', 'Estrie', 'FR', 'https://www.usherbrooke.ca/vertetor/'),
  ('f154e932-6a10-4e1d-8951-a08606304efd', 'Université Bishop''s', 'Gaiters', 'Sherbrooke', 'Estrie', 'EN', null),
  ('126d376e-6da9-4bc1-b816-b425bf311bde', 'Université du Québec à Montréal', 'Citadins', 'Montréal', 'Montréal', 'FR', 'https://citadins.uqam.ca/'),
  ('e2c3b581-5ff5-4bb1-b560-1dbeea115d0b', 'Université du Québec à Trois-Rivières', 'Patriotes', 'Trois-Rivières', 'Mauricie', 'FR', null),
  ('8967f2bb-2177-4d0e-942b-90b917b77df6', 'Université du Québec à Chicoutimi', 'Inuk', 'Saguenay', 'Saguenay–Lac-Saint-Jean', 'FR', null),
  ('ad45518b-2e88-45dc-8fc2-94cbe8eae1db', 'École de technologie supérieure', 'Piranhas', 'Montréal', 'Montréal', 'FR', null),
  ('97302265-c674-480e-b71b-a4f14cda3000', 'Université du Québec en Outaouais', 'Torrents', 'Gatineau', 'Outaouais', 'FR', null),
  ('cb477817-eef4-4fdf-83e0-d71316b5bf44', 'Université du Québec à Rimouski', 'Nordet', 'Rimouski', 'Bas-Saint-Laurent', 'FR', 'https://www.uqar.ca/services-a-la-communaute-universitaire/le-nordet');
create temp table _equipes (rseq_team_id uuid primary key, rseq_institution_id uuid not null, nom text not null,
                            sport text not null, gender text, division text, ligue text not null) on commit drop;
insert into _equipes values
  ('5f105854-cc41-42f8-9c0b-47b775302f30', 'f154e932-6a10-4e1d-8951-a08606304efd', 'Bishop''s', 'Basketball', 'Féminin', null, 'Basketball U F'),
  ('3d80bae8-d346-4179-ba55-d424adb25e23', 'f154e932-6a10-4e1d-8951-a08606304efd', 'Bishop''s', 'Basketball', 'Masculin', null, 'Basketball U M'),
  ('6a9c1012-fe7d-48bf-a431-b6c13076bac5', 'f154e932-6a10-4e1d-8951-a08606304efd', 'Bishop''s', 'Football', 'Masculin', null, 'Football U M'),
  ('050a7c62-d2ea-4de5-af23-36a6fe63c47f', 'f154e932-6a10-4e1d-8951-a08606304efd', 'Bishop''s', 'Hockey', 'Féminin', null, 'Hockey U F'),
  ('4c00ece5-bc80-4c38-adba-cf0c6a0f433d', 'f154e932-6a10-4e1d-8951-a08606304efd', 'Bishop''s', 'Rugby', 'Féminin', null, 'Rugby U F'),
  ('5465ba69-4861-4924-a678-5ac0899b408f', 'f154e932-6a10-4e1d-8951-a08606304efd', 'Bishop''s', 'Rugby', 'Masculin', null, 'Rugby U M'),
  ('d55a3e3c-373d-4c6b-b0af-5014e320d1e5', 'f154e932-6a10-4e1d-8951-a08606304efd', 'Bishop''s', 'Soccer intérieur', 'Féminin', null, 'Soccer intérieur U F'),
  ('afd48cf0-d89e-43b2-89cf-0a5579bfaedb', 'f154e932-6a10-4e1d-8951-a08606304efd', 'Bishop''s', 'Soccer', 'Féminin', null, 'Soccer U F'),
  ('506592f6-2f7c-4d43-972b-94f18374c500', 'ab6aabd3-3d1b-4de2-8d87-0509f72176ba', 'Concordia', 'Basketball', 'Féminin', null, 'Basketball U F'),
  ('dc08dc63-1b69-4aa2-86f8-b444a532f39c', 'ab6aabd3-3d1b-4de2-8d87-0509f72176ba', 'Concordia', 'Basketball', 'Masculin', null, 'Basketball U M'),
  ('d0b63533-e9d4-417e-a481-0232b392242e', 'ab6aabd3-3d1b-4de2-8d87-0509f72176ba', 'Concordia', 'Flag football', 'Féminin', null, 'Flag football U F B'),
  ('26271cd6-bce1-44ff-9bd2-830e7b66139c', 'ab6aabd3-3d1b-4de2-8d87-0509f72176ba', 'Concordia', 'Football', 'Masculin', null, 'Football U M'),
  ('24fd589d-ae14-4403-a5a0-0089846a2c26', 'ab6aabd3-3d1b-4de2-8d87-0509f72176ba', 'Concordia', 'Hockey', 'Féminin', null, 'Hockey U F'),
  ('b01d3f40-cdba-41a7-a334-82e5bbac4e45', 'ab6aabd3-3d1b-4de2-8d87-0509f72176ba', 'Concordia', 'Rugby', 'Féminin', null, 'Rugby U F'),
  ('4ead91a4-c0f9-448c-ae65-aefa11e2efe0', 'ab6aabd3-3d1b-4de2-8d87-0509f72176ba', 'Concordia', 'Rugby', 'Masculin', null, 'Rugby U M'),
  ('d20c4f76-6b0a-42fb-babb-2fcc6411612f', 'ab6aabd3-3d1b-4de2-8d87-0509f72176ba', 'Concordia', 'Soccer intérieur', 'Féminin', null, 'Soccer intérieur U F'),
  ('72deeba3-0450-433c-a32b-0310497addfc', 'ab6aabd3-3d1b-4de2-8d87-0509f72176ba', 'Concordia', 'Soccer intérieur', 'Masculin', null, 'Soccer intérieur U M'),
  ('3470444a-361e-470d-aba5-1f2ac64d670a', 'ab6aabd3-3d1b-4de2-8d87-0509f72176ba', 'Concordia', 'Soccer', 'Féminin', null, 'Soccer U F'),
  ('1ccc45dd-8f8e-415f-b7e9-8d8b149d8ed5', 'ab6aabd3-3d1b-4de2-8d87-0509f72176ba', 'Concordia', 'Soccer', 'Masculin', null, 'Soccer U M'),
  ('844393cd-90da-4267-93f4-c4e44e2d378a', 'ad45518b-2e88-45dc-8fc2-94cbe8eae1db', 'ETS', 'Flag football', 'Féminin', null, 'Flag football U F B'),
  ('545357cd-1767-49b4-a2c2-71237bf73ad5', 'ad45518b-2e88-45dc-8fc2-94cbe8eae1db', 'ETS', 'Hockey', 'Masculin', 'D2', 'Hockey U M D2'),
  ('9dd61618-f121-4dc9-8b24-f775000dc895', 'ad45518b-2e88-45dc-8fc2-94cbe8eae1db', 'ETS', 'Rugby', 'Masculin', null, 'Rugby U M'),
  ('a820fb66-c73e-4ee8-97c2-5fba3e08aafe', 'ad45518b-2e88-45dc-8fc2-94cbe8eae1db', 'ETS', 'Volleyball', 'Féminin', null, 'Volleyball U F'),
  ('774e3a85-9ec0-49ca-8ebb-4529a0c54989', 'da7f9d58-d02a-4051-8d6b-9b4069d6316f', 'Laval', 'Basketball', 'Féminin', null, 'Basketball U F'),
  ('ada42b41-7c83-4b45-9386-3e62ffab6206', 'da7f9d58-d02a-4051-8d6b-9b4069d6316f', 'Laval', 'Basketball', 'Masculin', null, 'Basketball U M'),
  ('ba18688e-4d0a-4591-9c65-9eed00a62379', 'da7f9d58-d02a-4051-8d6b-9b4069d6316f', 'Laval', 'Flag football', 'Féminin', null, 'Flag football U F B'),
  ('2f98c3ef-7627-4b7d-8933-f497c21c3cf9', 'da7f9d58-d02a-4051-8d6b-9b4069d6316f', 'Laval', 'Football', 'Masculin', null, 'Football U M'),
  ('44c673d9-491e-4bd4-adcb-170b0d4f399b', 'da7f9d58-d02a-4051-8d6b-9b4069d6316f', 'Laval', 'Hockey', 'Féminin', null, 'Hockey U F'),
  ('c75e77f3-a2aa-471f-ae76-1f160c7d562c', 'da7f9d58-d02a-4051-8d6b-9b4069d6316f', 'Laval', 'Rugby', 'Féminin', null, 'Rugby U F'),
  ('d1d71a75-3425-4fd1-90ea-edb17726c2d9', 'da7f9d58-d02a-4051-8d6b-9b4069d6316f', 'Laval', 'Soccer intérieur', 'Féminin', null, 'Soccer intérieur U F'),
  ('6ed334e6-ac52-428c-ba21-42de67c337f5', 'da7f9d58-d02a-4051-8d6b-9b4069d6316f', 'Laval', 'Soccer intérieur', 'Masculin', null, 'Soccer intérieur U M'),
  ('53543aa9-9a6c-443d-b9c9-9fe34e4111c0', 'da7f9d58-d02a-4051-8d6b-9b4069d6316f', 'Laval', 'Soccer', 'Féminin', null, 'Soccer U F'),
  ('4597b5c1-78ec-469d-92ce-afcb0546351b', 'da7f9d58-d02a-4051-8d6b-9b4069d6316f', 'Laval', 'Soccer', 'Masculin', null, 'Soccer U M'),
  ('6d34e3ee-1fb1-4a60-91ef-235241bd79df', 'da7f9d58-d02a-4051-8d6b-9b4069d6316f', 'Laval', 'Volleyball', 'Féminin', null, 'Volleyball U F'),
  ('70fa06db-d625-4c8c-b1d1-08d645bcfa2d', 'da7f9d58-d02a-4051-8d6b-9b4069d6316f', 'Laval', 'Volleyball', 'Masculin', null, 'Volleyball U M'),
  ('dfee85d0-adbe-434d-8bfc-5150ada604a9', '75ea03e5-4400-4744-a8dc-1ed249e23bdb', 'McGill', 'Basketball', 'Féminin', null, 'Basketball U F'),
  ('5ca94d05-bed5-46bc-85b9-be6fc69eaec1', '75ea03e5-4400-4744-a8dc-1ed249e23bdb', 'McGill', 'Basketball', 'Masculin', null, 'Basketball U M'),
  ('c4e1032f-aa88-4a8b-87dd-c4c773ed980a', '75ea03e5-4400-4744-a8dc-1ed249e23bdb', 'McGill', 'Flag football', 'Féminin', null, 'Flag football U F A'),
  ('3370de45-2cfb-4007-af50-d0b83afe36e6', '75ea03e5-4400-4744-a8dc-1ed249e23bdb', 'McGill', 'Football', 'Masculin', null, 'Football U M'),
  ('fc71063e-48d9-439e-8e2d-dfd104973312', '75ea03e5-4400-4744-a8dc-1ed249e23bdb', 'McGill', 'Hockey', 'Féminin', null, 'Hockey U F'),
  ('6cad5550-80f3-4ec3-8de8-c53bb6cffcb1', '75ea03e5-4400-4744-a8dc-1ed249e23bdb', 'McGill', 'Rugby', 'Masculin', null, 'Rugby U M'),
  ('b82a088d-fb34-466e-8612-76d77947c78b', '75ea03e5-4400-4744-a8dc-1ed249e23bdb', 'McGill', 'Soccer intérieur', 'Féminin', null, 'Soccer intérieur U F'),
  ('f5829bd6-4406-41d4-b1f0-babd05fdb1cb', '75ea03e5-4400-4744-a8dc-1ed249e23bdb', 'McGill', 'Soccer intérieur', 'Masculin', null, 'Soccer intérieur U M'),
  ('8da1c885-51ab-48a0-ae71-e7c01f97f8d7', '75ea03e5-4400-4744-a8dc-1ed249e23bdb', 'McGill', 'Soccer', 'Féminin', null, 'Soccer U F'),
  ('f2b92cbf-7cd2-439d-875e-b169248c62c1', '75ea03e5-4400-4744-a8dc-1ed249e23bdb', 'McGill', 'Soccer', 'Masculin', null, 'Soccer U M'),
  ('86bf569b-acec-4087-a738-9355c68dc222', '75ea03e5-4400-4744-a8dc-1ed249e23bdb', 'McGill', 'Volleyball', 'Féminin', null, 'Volleyball U F'),
  ('8c27e646-480e-4644-ab26-b30f7a49b1e4', '78dbadd2-5d8c-4b45-a8af-1100e081630d', 'Montréal', 'Flag football', 'Féminin', null, 'Flag football U F A'),
  ('793df9bf-39d8-47dd-923a-c34cf31d9974', '78dbadd2-5d8c-4b45-a8af-1100e081630d', 'Montréal', 'Football', 'Masculin', null, 'Football U M'),
  ('d3675dc9-caaa-4503-920b-c955ccf5d9e0', '78dbadd2-5d8c-4b45-a8af-1100e081630d', 'Montréal', 'Hockey', 'Féminin', null, 'Hockey U F'),
  ('c910600d-06d6-40ef-b5a6-2d81bd7cb438', '78dbadd2-5d8c-4b45-a8af-1100e081630d', 'Montréal', 'Rugby', 'Féminin', null, 'Rugby U F'),
  ('ad64dbe9-936d-424b-9488-1038f4a7b291', '78dbadd2-5d8c-4b45-a8af-1100e081630d', 'Montréal', 'Rugby', 'Masculin', null, 'Rugby U M'),
  ('abeada9d-eb63-4325-92f4-921881ef3c1f', '78dbadd2-5d8c-4b45-a8af-1100e081630d', 'Montréal', 'Soccer intérieur', 'Féminin', null, 'Soccer intérieur U F'),
  ('ed0be222-652a-45dd-9444-ccf1380245bd', '78dbadd2-5d8c-4b45-a8af-1100e081630d', 'Montréal', 'Soccer intérieur', 'Masculin', null, 'Soccer intérieur U M'),
  ('f312bcc3-0e7e-4bfc-9d08-5a725a558be6', '78dbadd2-5d8c-4b45-a8af-1100e081630d', 'Montréal', 'Soccer', 'Féminin', null, 'Soccer U F'),
  ('d6fe43e4-2b0f-4b97-9c8d-333916870f0c', '78dbadd2-5d8c-4b45-a8af-1100e081630d', 'Montréal', 'Soccer', 'Masculin', null, 'Soccer U M'),
  ('3889fe85-e149-4e71-b2e0-2c87f101d5f5', '78dbadd2-5d8c-4b45-a8af-1100e081630d', 'Montréal', 'Volleyball', 'Féminin', null, 'Volleyball U F'),
  ('ac731835-41f9-4cab-a830-31d1958977f0', '78dbadd2-5d8c-4b45-a8af-1100e081630d', 'Montréal', 'Volleyball', 'Masculin', null, 'Volleyball U M'),
  ('9857e670-7a99-4b86-b07a-187b1460327e', '92b3efd4-7bb5-448e-982c-944d6cbeb0a3', 'Sherbrooke', 'Flag football', 'Féminin', null, 'Flag football U F A'),
  ('38ca819c-1c2f-4434-a7bf-4deb24db640c', '92b3efd4-7bb5-448e-982c-944d6cbeb0a3', 'Sherbrooke', 'Football', 'Masculin', null, 'Football U M'),
  ('67f55ddb-5d15-4ef2-86fc-d36b41ffdbd8', '92b3efd4-7bb5-448e-982c-944d6cbeb0a3', 'Sherbrooke', 'Hockey', 'Masculin', 'D2', 'Hockey U M D2'),
  ('3760190c-42c5-420f-bf7e-76acaf959664', '92b3efd4-7bb5-448e-982c-944d6cbeb0a3', 'Sherbrooke', 'Rugby', 'Féminin', null, 'Rugby U F'),
  ('a813e518-a7d2-4bba-8252-0bb1f8d02ca1', '92b3efd4-7bb5-448e-982c-944d6cbeb0a3', 'Sherbrooke', 'Soccer intérieur', 'Féminin', null, 'Soccer intérieur U F'),
  ('0a4cd8b9-add1-4f6a-aa83-945737cf8b1b', '92b3efd4-7bb5-448e-982c-944d6cbeb0a3', 'Sherbrooke', 'Soccer intérieur', 'Masculin', null, 'Soccer intérieur U M'),
  ('7335a241-b2c2-4fb8-b1a0-c24ae1e2de51', '92b3efd4-7bb5-448e-982c-944d6cbeb0a3', 'Sherbrooke', 'Soccer', 'Féminin', null, 'Soccer U F'),
  ('0d7d0a80-8b60-4c8c-bed2-2ee3bc4ae772', '92b3efd4-7bb5-448e-982c-944d6cbeb0a3', 'Sherbrooke', 'Soccer', 'Masculin', null, 'Soccer U M'),
  ('3ded2920-fe0b-438e-aa29-4f0657dd3ea6', '92b3efd4-7bb5-448e-982c-944d6cbeb0a3', 'Sherbrooke', 'Volleyball', 'Féminin', null, 'Volleyball U F'),
  ('560e08e2-dae6-494c-b4a3-feb9b50de0fa', '92b3efd4-7bb5-448e-982c-944d6cbeb0a3', 'Sherbrooke', 'Volleyball', 'Masculin', null, 'Volleyball U M'),
  ('490dc7c1-ed27-42a7-abb9-214e07796c05', '8967f2bb-2177-4d0e-942b-90b917b77df6', 'UQAC', 'Hockey', 'Masculin', 'D2', 'Hockey U M D2'),
  ('9e1a409f-d54b-4c26-8353-702662852538', '8967f2bb-2177-4d0e-942b-90b917b77df6', 'UQAC', 'Volleyball', 'Féminin', null, 'Volleyball U F'),
  ('6578caed-d641-471c-bf7b-833a298faa4c', '126d376e-6da9-4bc1-b816-b425bf311bde', 'UQAM', 'Basketball', 'Féminin', null, 'Basketball U F'),
  ('90877391-0df6-4345-a63b-cad6212fdb28', '126d376e-6da9-4bc1-b816-b425bf311bde', 'UQAM', 'Basketball', 'Masculin', null, 'Basketball U M'),
  ('009f55f4-a4b8-42f4-973e-b4d8e23901e0', '126d376e-6da9-4bc1-b816-b425bf311bde', 'UQAM', 'Flag football', 'Féminin', null, 'Flag football U F A'),
  ('932b666d-5dd4-436e-a72e-04b67fa0fbad', '126d376e-6da9-4bc1-b816-b425bf311bde', 'UQAM', 'Soccer intérieur', 'Féminin', null, 'Soccer intérieur U F'),
  ('abcdddf7-9731-440f-9c6e-47b78649fc31', '126d376e-6da9-4bc1-b816-b425bf311bde', 'UQAM', 'Soccer intérieur', 'Masculin', null, 'Soccer intérieur U M'),
  ('6c330bc7-5a4c-45e4-9118-8c8dc9cadc22', '126d376e-6da9-4bc1-b816-b425bf311bde', 'UQAM', 'Soccer', 'Féminin', null, 'Soccer U F'),
  ('5574025c-bc34-41ce-bfd4-bcabc6c98120', '126d376e-6da9-4bc1-b816-b425bf311bde', 'UQAM', 'Soccer', 'Masculin', null, 'Soccer U M'),
  ('c4858621-4dd0-4ce5-85ae-345ec2badce8', '126d376e-6da9-4bc1-b816-b425bf311bde', 'UQAM', 'Volleyball', 'Féminin', null, 'Volleyball U F'),
  ('ddc5b24e-6d7a-4330-b970-517f6b6db433', '97302265-c674-480e-b71b-a4f14cda3000', 'UQO', 'Hockey', 'Masculin', 'D2', 'Hockey U M D2'),
  ('772408da-7808-4a53-b7e2-60b2a251b300', 'e2c3b581-5ff5-4bb1-b560-1dbeea115d0b', 'UQTR', 'Flag football', 'Féminin', null, 'Flag football U F B'),
  ('3746940a-4095-4887-a418-d0582963cef7', 'e2c3b581-5ff5-4bb1-b560-1dbeea115d0b', 'UQTR', 'Soccer intérieur', 'Féminin', null, 'Soccer intérieur U F'),
  ('df33916d-7766-44bf-8079-8c7cd10be850', 'e2c3b581-5ff5-4bb1-b560-1dbeea115d0b', 'UQTR', 'Soccer intérieur', 'Masculin', null, 'Soccer intérieur U M'),
  ('070aa425-59f4-4039-9bfb-af19a23c4e63', 'e2c3b581-5ff5-4bb1-b560-1dbeea115d0b', 'UQTR', 'Soccer', 'Féminin', null, 'Soccer U F'),
  ('f493476b-8c11-4f01-bcb5-5eab25b2f6e8', 'e2c3b581-5ff5-4bb1-b560-1dbeea115d0b', 'UQTR', 'Soccer', 'Masculin', null, 'Soccer U M'),
  ('c43500bf-6497-4d60-8e7f-f917719d366d', 'e2c3b581-5ff5-4bb1-b560-1dbeea115d0b', 'UQTR', 'Volleyball', 'Féminin', null, 'Volleyball U F');

-- ── GARDES D'AVANT ───────────────────────────────────────────────────────────
do $$
begin
  if current_user <> 'postgres' then
    raise exception 'NEXUS: lancer en postgres, pas en %', current_user;
  end if;
  if (select count(*) from _ecoles) <> 12 or (select count(*) from _equipes) <> 84 then
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
  if exists (select 1 from public.schools where type = 'UNIVERSITE') then
    raise exception 'NEXUS: des universités existent déjà';
  end if;
  if exists (select 1 from public.schools s join _ecoles e using (rseq_institution_id)) then
    raise exception 'NEXUS: un rseq_institution_id universitaire est déjà porté par une école';
  end if;
  if exists (select 1 from public.teams t join _equipes q using (rseq_team_id)) then
    raise exception 'NEXUS: une des équipes universitaires existe déjà (rseq_team_id)';
  end if;
  if exists (select 1 from _equipes q left join public.sports s on s.nom = q.sport where s.id is null) then
    raise exception 'NEXUS: un sport des équipes est absent du catalogue Nexus';
  end if;
  if exists (select 1 from _equipes q left join _ecoles e using (rseq_institution_id) where e.name is null) then
    raise exception 'NEXUS: une équipe pointe hors des 12 universités';
  end if;
  if exists (select 1 from public.admin_operations where operation in ('CEGEP_LOT_D1_UNIVERSITES', 'CEGEP_LOT_D1_UNIVERSITES_RETIREES')) then
    raise exception 'NEXUS: le lot D1 a déjà laissé une trace dans admin_operations';
  end if;
end $$;

-- ── Empreinte (hors lignes créées) ───────────────────────────────────────────
create function pg_temp.empreinte() returns table (objet text, n bigint, md5 text) language sql as $$
  select 'schools (hors univ.)', count(*), md5(coalesce(string_agg(id::text || type || name, ',' order by id), '')) from public.schools where type <> 'UNIVERSITE'
  union all
  select 'teams (hors univ.)', count(*), md5(coalesce(string_agg(id::text || school_id::text || name, ',' order by id), ''))
    from public.teams t where not exists (select 1 from _equipes q where q.rseq_team_id = t.rseq_team_id)
  union all
  select 'athletes', count(*), md5(coalesce(string_agg(id::text || coalesce(school_id::text, '·'), ',' order by id), '')) from public.athletes
  union all
  select 'users', count(*), md5(coalesce(string_agg(id::text || coalesce(school_id::text, '·') || coalesce(context, '·'), ',' order by id), '')) from public.users
  union all
  select 'team_athletes', count(*), md5(coalesce(string_agg(id::text || team_id::text, ',' order by id), '')) from public.team_athletes
  union all
  select 'games (côtés hors univ.)', count(*), md5(coalesce(string_agg(id::text || coalesce(home_team_id::text, '·') || coalesce(visitor_team_id::text, '·'), ',' order by id), ''))
    from public.games g
   where not exists (select 1 from _equipes q where q.rseq_team_id in (g.home_rseq_team_id, g.visitor_rseq_team_id));
$$;
create temp table _emp_avant on commit drop as select * from pg_temp.empreinte();
select 'AVANT' as moment, * from _emp_avant order by objet;

create temp table _cotes on commit drop as
select (select count(*) from public.games g join _equipes q on q.rseq_team_id = g.home_rseq_team_id where g.home_team_id is null) as domicile,
       (select count(*) from public.games g join _equipes q on q.rseq_team_id = g.visitor_rseq_team_id where g.visitor_team_id is null) as visiteur;
select 'côtés de match à relier' as quoi, * from _cotes;

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
           where u.role = 'RECRUTEUR'::public.user_role and c.fusionnee_le is null order by c.created_at desc, c.id limit 1),
         (select u.id from public.users u where u.role = 'RECRUTEUR'::public.user_role and u.onboarding_complete order by u.id limit 1))
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
       ut as (select t.id, t.sport_id from public.teams t join _equipes q using (rseq_team_id))
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
    union select t.id::text from public.teams t join _equipes q using (rseq_team_id)) z;
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
insert into public.schools (name, type, province, team_name, city, region, langue, website, rseq_institution_id)
select name, 'UNIVERSITE', 'QC', team_name, city, region, langue, website, rseq_institution_id from _ecoles;

insert into public.teams (school_id, sport_id, name, division, league, season, is_active, age_group, gender, rseq_team_id)
select s.id, sp.id, q.nom, q.division, q.ligue || ' (2026-2027)', '2026-2027', true, 'Universitaire', q.gender, q.rseq_team_id
  from _equipes q
  join public.schools s on s.rseq_institution_id = q.rseq_institution_id and s.type = 'UNIVERSITE'
  join public.sports sp on sp.nom = q.sport;

update public.games g set home_team_id = t.id
  from public.teams t join _equipes q using (rseq_team_id)
 where g.home_team_id is null and g.home_rseq_team_id = t.rseq_team_id;
update public.games g set visitor_team_id = t.id
  from public.teams t join _equipes q using (rseq_team_id)
 where g.visitor_team_id is null and g.visitor_rseq_team_id = t.rseq_team_id;

-- ── Ce qui a été créé (par université) ───────────────────────────────────────
select s.name as universite, s.team_name as programme, s.city as ville, count(t.id) as equipes,
       string_agg(sp.nom || ' ' || left(coalesce(t.gender, '?'), 1) || coalesce(' ' || t.division, ''), ', ' order by sp.nom, t.gender) as detail
  from public.schools s
  left join public.teams t on t.school_id = s.id
  left join public.sports sp on sp.id = t.sport_id
 where s.type = 'UNIVERSITE'
 group by s.name, s.team_name, s.city order by s.name;

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
select 'fiche athlète → Université Laval' as essai,
       pg_temp.essai(format('update public.athletes set school_id = %L where id = %L',
         (select id from public.schools where type = 'UNIVERSITE' and name = 'Université Laval'),
         (select id from public.athletes order by id limit 1))) as resultat
union all
select 'fiche athlète → une équipe universitaire',
       pg_temp.essai(format('insert into public.team_athletes (team_id, athlete_id, sport_id) values (%L, %L, %L)',
         t.id, (select id from public.athletes order by id limit 1), t.sport_id))
  from (select t.id, t.sport_id from public.teams t join _equipes q using (rseq_team_id) order by t.id limit 1) t;
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
declare v text; v_ids uuid[] := (select array_agg(rseq_team_id) from _equipes);  -- lu AVANT de changer de rôle
begin
  begin
    if p_role = 'anon' then
      perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
    else
      perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
    end if;
    perform set_config('role', p_role, true);
    v := pg_temp.compte_vu('select count(*) from public.schools where type = ''UNIVERSITE''', v_ids) || ' / ' ||
         pg_temp.compte_vu('select count(*) from public.teams t where t.rseq_team_id = any ($1)', v_ids);
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
union all select 'recruteur collégial', pg_temp.vu('authenticated', (select u.id from public.users u where u.role = 'RECRUTEUR'::public.user_role order by u.id limit 1))
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
  select count(*) into n from public.schools s join _ecoles e using (rseq_institution_id)
   where s.type = 'UNIVERSITE' and s.province = 'QC' and s.name = e.name;
  if n <> 12 then raise exception 'NEXUS: % université(s) conforme(s), attendu 12', n; end if;
  if (select count(*) from public.schools where type = 'UNIVERSITE') <> 12 then
    raise exception 'NEXUS: le nombre d''universités n''est pas 12';
  end if;
  select count(*) into n from public.teams t join _equipes q using (rseq_team_id)
    join public.schools s on s.id = t.school_id and s.rseq_institution_id = q.rseq_institution_id
   where t.season = '2026-2027' and t.age_group = 'Universitaire' and t.is_active;
  if n <> 84 then raise exception 'NEXUS: % équipe(s) conforme(s), attendu 84', n; end if;
  if (select count(*) from public.games g join public.teams t on t.id = g.home_team_id join _equipes q using (rseq_team_id))
       <> (select domicile from _cotes)
     or (select count(*) from public.games g join public.teams t on t.id = g.visitor_team_id join _equipes q using (rseq_team_id))
       <> (select visiteur from _cotes) then
    raise exception 'NEXUS: les côtés de match reliés ne font pas le compte';
  end if;
  if exists (select 1 from _emp_apres a join _emp_avant b using (objet) where a.n <> b.n or a.md5 <> b.md5) then
    raise exception 'NEXUS: une donnée hors du lot a changé';
  end if;
  if exists (select 1 from _vu where role <> 'admin' and vu not in ('0 / 0', '0 / refusé')) or (select vu from _vu where role = 'admin') <> '12 / 84' then
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
  raise notice 'NEXUS: VERDICT D1 — 12 universités, 84 équipes, rien d''autre ne bouge, invisibles hors admin, verrou tenu';
end $$;
select 'VERDICT' as verdict, 'conforme' as resultat;

-- ── Le rollback, joué dans la même transaction ───────────────────────────────
create temp table _rb on commit drop as select $nexus_rb$do $rb$
declare
  r record; n bigint; v_t uuid[]; v_s uuid[];
begin
  select coalesce(array_agg(t.id), '{}') into v_t from public.teams t join _equipes q using (rseq_team_id);
  select coalesce(array_agg(s.id), '{}') into v_s from public.schools s join _ecoles e using (rseq_institution_id)
   where s.type = 'UNIVERSITE';
  for r in
    select c.conrelid as tbl, a.attname as col, c.confrelid as cible
      from pg_constraint c
      join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
     where c.contype = 'f' and c.confrelid in ('public.teams'::regclass, 'public.schools'::regclass)
  loop
    if (r.tbl = 'public.teams'::regclass and r.col = 'school_id')
       or (r.tbl = 'public.games'::regclass and r.col in ('home_team_id', 'visitor_team_id')) then
      continue;
    end if;
    execute format('select count(*) from %s where %I = any($1)', r.tbl::regclass, r.col)
      into n using case when r.cible = 'public.teams'::regclass then v_t else v_s end;
    if n > 0 then
      raise exception 'NEXUS: rollback D1 refusé : % ligne(s) de %.% pointent vers le lot', n, r.tbl::regclass, r.col;
    end if;
  end loop;
  update public.games set home_team_id = null where home_team_id = any(v_t);
  update public.games set visitor_team_id = null where visitor_team_id = any(v_t);
  delete from public.teams where id = any(v_t);
  delete from public.schools where id = any(v_s);
end $rb$;$nexus_rb$::text as corps;
do $$
begin
  if md5((select corps from _rb)) <> 'aec3088dc513b4e539246cc8906e9fe3' then raise exception 'NEXUS: corps du rollback altéré'; end if;
  execute (select corps from _rb);
end $$;
do $$
begin
  if exists (select 1 from public.schools where type = 'UNIVERSITE')
     or exists (select 1 from public.teams t join _equipes q using (rseq_team_id))
     or exists (select 1 from pg_temp.empreinte() e join _emp_avant b using (objet) where e.n <> b.n or e.md5 <> b.md5) then
    raise exception 'NEXUS: après rollback, l''état n''est pas celui d''avant';
  end if;
  raise notice 'NEXUS: rollback D1 vérifié (0 université, 0 équipe, empreinte identique à AVANT)';
end $$;

rollback;
\echo '== ROLLBACK fait : rien n''est appliqué.'
