-- ════════════════════════════════════════════════════════════════════════════
-- Lot D1 cégep — APPLY RÉEL EN PROD (sur GO BP seulement, après le rejeu à blanc)
-- Les 12 universités québécoises du RSEQ (type UNIVERSITE, province QC) et leurs 84 équipes des
-- sports d'équipe de la saison 2026-2027, lues dans l'API RSEQ (s1.rseq.ca, secteur Universitaire).
-- Fichier GÉNÉRÉ par scripts/cegep-lot-d/generer-d1.mjs <date> <rejeu-blanc|apply|rollback> depuis
-- scripts/cegep-lot-d/d1-universites.json (empreinte 65b87625bc4083c189bfcde5fae2b428). Lancer SANS -1, en postgres.
--
-- Opération de DONNÉES (aucun objet de schéma). Préalables : D0 (20261028000000) et D1a (20261028010000,
-- universités masquées hors admin) en prod, correctif web /college promu.
-- Aucune fiche athlète, aucun compte, aucun classement touché. Les côtés de match NULL qui portent le
-- rseq_team_id d'une équipe créée sont reliés (la veille n'a pas chargé le secteur Universitaire : 0 attendu).
-- Finit par admin_operations CEGEP_LOT_D1_UNIVERSITES et COMMIT.
-- ════════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP 1
\pset pager off
\pset null '·'

begin;
set local lock_timeout = '3s';
set local statement_timeout = '120s';
set local search_path = public, extensions;
set local application_name = 'nexus-apply-cegep-d1';
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
    select (select count(*) from public.schools where type = 'UNIVERSITE') || ' / ' ||
           (select count(*) from public.teams t where t.rseq_team_id = any (v_ids))
      into v;
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
  if exists (select 1 from _vu where role <> 'admin' and vu <> '0 / 0') or (select vu from _vu where role = 'admin') <> '12 / 84' then
    raise exception 'NEXUS: un utilisateur non admin voit une université ou une équipe universitaire';
  end if;
  if exists (select 1 from _verrou where resultat not like 'REFUSÉ 42501 NEXUS: Une fiche athlète%') then
    raise exception 'NEXUS: le verrou D0 ne refuse pas une fiche athlète vers une université';
  end if;
  raise notice 'NEXUS: VERDICT D1 — 12 universités, 84 équipes, rien d''autre ne bouge, invisibles hors admin, verrou tenu';
end $$;
select 'VERDICT' as verdict, 'conforme' as resultat;

insert into public.admin_operations (operation, motif, details, par)
select 'CEGEP_LOT_D1_UNIVERSITES',
       'Chantier cégep, lot D1 : les 12 universités québécoises du RSEQ et leurs équipes 2026-2027 des sports d''équipe (API RSEQ ; GO BP 2026-10-28)',
       jsonb_build_object('universites', 12, 'equipes', 84,
                          'cotes_domicile', (select domicile from _cotes), 'cotes_visiteur', (select visiteur from _cotes),
                          'empreinte_donnees', '65b87625bc4083c189bfcde5fae2b428',
                          'rseq_institution_ids', (select jsonb_agg(rseq_institution_id order by rseq_institution_id) from _ecoles),
                          'fichier', 'docs/cegep-lot-d/prod/d1-apply-20261028.sql', 'voie', 'psql (session pooler)'),
       (select id from public.users where id = 'f51384b5-a2c2-4827-9137-8aa8d29a1fe0');  -- BP ; NULL hors prod
select (select count(*) from public.schools where type = 'UNIVERSITE') as universites,
       (select count(*) from public.teams t join _equipes q using (rseq_team_id)) as equipes,
       clock_timestamp() as avant_commit;
commit;
\echo '== COMMIT fait : lot D1 cégep en prod (12 universités et leurs équipes).'
