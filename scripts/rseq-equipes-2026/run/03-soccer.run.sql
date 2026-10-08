begin;
-- Lot 03 — Soccer : 203 équipe(s) RSEQ 2026 (secondaire), 1354 côté(s) de match à relier (relevé prod du 2026-10-08).
-- Généré par scripts/rseq-equipes-2026/generer-lots.mjs. Règles : CLAUDE.md § « Pont RSEQ ».
-- Transaction gardée : exactement 203 équipe(s) créée(s) et exactement les côtés de match relevés
-- (games.home_team_id / visitor_team_id NULL portant un rseq_team_id du lot), sinon RIEN n'est écrit.
-- Aucun match supprimé ; aucune équipe existante modifiée ; seules colonnes écrites dans games :
-- home_team_id et visitor_team_id, et seulement là où elles sont NULL.
do $$
declare
  v_bp uuid;
  n_attendu constant int := 203;
  cotes_releves constant int := 1354;  -- relevé à la génération ; recompté et exigé dans la transaction
  n_ins int; n_h int; n_v int; n_h0 int; n_v0 int; n_ops0 int; n_ops1 int; n_teams0 int; n_teams1 int;
begin
  select id into strict v_bp from public.users where email = 'bptds22@gmail.com';
  create temp table _lot (rseq_team_id uuid primary key, school_id uuid not null, sport_id uuid not null,
    name text not null, age_group text, division text, gender text) on commit drop;
  insert into _lot values
    ('015c99b8-2f4e-455b-adfc-9838bfdddd10'::uuid, 'f4fdd087-617c-4e9b-997b-9a6922acbe0c'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'Aubier 2', 'Benjamin', 'D3', 'Masculin'),
    ('025c9650-1f57-45bd-8df5-6ccbbe3fbff8'::uuid, '6213dfb4-19f6-4c9f-a43d-63c0b5d89e59'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'LCC', 'Benjamin', 'D3', 'Féminin'),
    ('037b21eb-b6f8-4be7-8cd8-9b3c7ade73ed'::uuid, '4cc1761f-3d71-4d58-8a3b-98701fafaa61'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'Coll. des Compagnons', 'Benjamin', 'D4', 'Masculin'),
    ('04e881e3-744a-4c0f-9146-b5ee8ccbf57e'::uuid, '3cea1ea3-4485-4588-ac4d-48efc95cb399'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'Loyola', 'Juvénile', 'D3', 'Masculin'),
    ('0654bbe2-6891-4a17-bbd5-e0b26f9088a2'::uuid, '882225d5-7097-4c09-8903-73f16c949282'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'RVALE', 'Benjamin', 'D4', 'Féminin'),
    ('07bf301e-d7f8-4192-a130-b85bc8a7f046'::uuid, 'b1963b97-f46a-4afc-86bd-ccca5f7175e1'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'Mt Ste-Anne', 'Juvénile', 'D4', 'Féminin'),
    ('07c65767-913b-4c32-a919-c16ee5dd0efc'::uuid, '8d31a73c-ab71-4d5c-9aaa-816ca0746659'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'LAURN', 'Juvénile', 'D4', 'Féminin'),
    ('07feb5e7-955a-4b9c-9556-6f6c92f0991d'::uuid, 'd5a41baa-fb63-4477-8f9c-7657856168b5'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'MMA', 'Juvénile', 'D4', 'Masculin'),
    ('08220e99-1254-4914-a69e-462e5f3ec90b'::uuid, '4cb4b962-e10c-4c5a-a116-9e3f834a9d6d'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'Villa-Maria', 'Juvénile', 'D4', 'Masculin'),
    ('0eb7addf-fb35-447c-9066-e31ae0d1e2a9'::uuid, '4cb4b962-e10c-4c5a-a116-9e3f834a9d6d'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'Villa-Maria', 'Benjamin', 'D4', 'Masculin'),
    ('0f1debf5-49f9-44b0-9ef0-992fae2d3c09'::uuid, 'e4613552-b565-4d75-ab0f-1655ab932cc5'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'Billings', 'Benjamin', 'D4', 'Masculin'),
    ('11b9b557-0172-4cb3-a0db-f5684cad406b'::uuid, '436f6e8e-2618-43cd-90a6-dbce004b6940'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'Du Plateau', 'Benjamin', 'D4', 'Masculin'),
    ('11c3b514-330c-41d0-836f-dd1a316aa299'::uuid, 'd3f457f4-3873-49dd-a92a-dcc6c6a27ab1'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'Coll. Mariste 2', 'Cadet', 'D4', 'Féminin'),
    ('12166bf5-03f2-450a-b4cc-7c25eafca14c'::uuid, '56a79a3f-3fac-4719-a35b-ddd8116648ea'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'Westmount HS', 'Juvénile', 'D4', 'Masculin'),
    ('1494250d-23c2-4080-bcbf-34dd3e9598cc'::uuid, '3309a357-72fc-4da3-9689-0b6882d8f98a'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'LMAC', 'Juvénile', 'D4', 'Féminin'),
    ('14c797df-aa3d-4156-8171-da252a2fe2d2'::uuid, '5f2f489a-2079-41a7-b1cf-441a38ffdd9c'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'KUP', 'Juvénile', 'D4', 'Féminin'),
    ('152dcf04-0b9a-4725-bcb1-1403acdb43ea'::uuid, '1fd7ac22-adb2-48bd-9904-d8ffdc9b0a29'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'WWHS Sr', 'Benjamin', 'D4', 'Masculin'),
    ('15fd73ef-ed59-4eef-a140-6288768e5398'::uuid, 'ea66f367-c55a-496f-a257-fb9032493455'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'WIC', 'Benjamin', 'D3', 'Masculin'),
    ('16485cc4-fa24-404f-b7ba-00f28a215316'::uuid, '56a79a3f-3fac-4719-a35b-ddd8116648ea'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'Westmount HS', 'Benjamin', 'D4', 'Masculin'),
    ('176788a9-d0a8-46b9-bdc1-814cb3eb5bbb'::uuid, '882225d5-7097-4c09-8903-73f16c949282'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'RVALE', 'Benjamin', 'D4', 'Masculin'),
    ('17f81cba-7831-43e5-b4b0-237c8069c393'::uuid, '4cb4b962-e10c-4c5a-a116-9e3f834a9d6d'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'Villa-Maria', 'Benjamin', 'D4', 'Masculin'),
    ('1801139a-3239-4743-9342-71cdc59c039e'::uuid, '1c629d33-eb80-4799-a20c-4b42ae772a4a'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'Coll. Jésus-Marie de Sillery', 'Juvénile', 'D3', 'Masculin'),
    ('1a95ada7-6470-4858-adb2-fc9b200d8e70'::uuid, '96003581-8844-4650-a66d-6b98a0fb4061'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'ES.St-Charles (BEL)', 'Juvénile', 'D4', 'Masculin'),
    ('1ad1ccdb-db54-48d6-8faa-27238dd3eb55'::uuid, 'd35768e1-b37d-4488-9f7b-171753bdf6fb'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'Beaconsfield HS', 'Cadet', 'D4', 'Masculin'),
    ('1b867c1c-eca0-4ba0-96e3-ed8db8bd244f'::uuid, 'e4613552-b565-4d75-ab0f-1655ab932cc5'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'Billings', 'Juvénile', 'D4', 'Masculin'),
    ('1b99f555-b098-4906-b6ae-9aa26f2dd456'::uuid, 'de7f87c3-2831-4123-8efe-f908e926864e'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'Edgar Cramp', 'Benjamin', 'D4', 'Féminin'),
    ('1e97f638-e316-4f5f-822b-8566b26137e9'::uuid, '14d6f138-e08c-449f-9278-1b242b47a4e7'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'KELLS', 'Juvénile', 'D4', 'Masculin'),
    ('20f1d5e9-0a87-439f-9b7b-7a93f6afd443'::uuid, '7df9f46a-631a-436e-9c2e-e0cf173eca9e'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'Selwyn House', 'Cadet', 'D4', 'Masculin'),
    ('23587f1d-875e-45d7-ab81-3a0bb2f61af4'::uuid, 'f37087f7-0671-45b2-98e1-574926b664d3'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'STUDY', 'Cadet', 'D4', 'Féminin'),
    ('2494177d-46a2-48bd-8037-eeb044362a43'::uuid, '6213dfb4-19f6-4c9f-a43d-63c0b5d89e59'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'LCC', 'Cadet', 'D4', 'Masculin'),
    ('24f3f378-251a-47d0-9ef7-397887ae730b'::uuid, '5f2f489a-2079-41a7-b1cf-441a38ffdd9c'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'KUP', 'Benjamin', 'D4', 'Féminin'),
    ('25615c45-411d-40cd-898e-a0553dffb28c'::uuid, '7c2689d3-440f-4951-adaa-d8536e2a8e5c'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'Kahnawake Survival', 'Juvénile', 'D4', 'Féminin'),
    ('267b951a-b9a8-4bff-bcd0-0d1ed1354410'::uuid, 'e738f48d-11aa-4527-ad76-fe38b3d0bd1a'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'Bialik', 'Benjamin', 'D4', 'Masculin'),
    ('27830e58-b5a3-4d21-9626-843da85c2976'::uuid, '5f2f489a-2079-41a7-b1cf-441a38ffdd9c'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'KUP', 'Juvénile', 'D4', 'Masculin'),
    ('2ae47b9d-0fe3-4f6b-94d0-62b4c932c1c1'::uuid, '5579c371-bb06-49d3-b5c5-84f161cf1773'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'Poly. Black-Lake', 'Benjamin', 'D4', 'Féminin'),
    ('2bd4f2eb-6fd9-45f0-832e-3f2e0dcb025d'::uuid, '6213dfb4-19f6-4c9f-a43d-63c0b5d89e59'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'LCC', 'Benjamin', 'D4', 'Féminin'),
    ('2bddbca1-8976-43d1-9a63-501585aadb97'::uuid, '6213dfb4-19f6-4c9f-a43d-63c0b5d89e59'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'LCC', 'Juvénile', 'D4', 'Masculin'),
    ('2d822742-7759-4efe-8a4b-717a78999a62'::uuid, '2c79f18c-9e49-411e-ace9-7bb54dc68438'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'Acad. Saint-Louis', 'Cadet', 'D3', 'Féminin'),
    ('2e9a1dcd-9d1d-4d85-96c7-22021769b28c'::uuid, '4cb4b962-e10c-4c5a-a116-9e3f834a9d6d'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'Villa-Maria', 'Cadet', 'D4', 'Féminin'),
    ('2ef876fd-bb28-4680-ada7-dbec022dbf0f'::uuid, '2a5c01e4-78b4-4c59-9e72-ccf2a27aa4d5'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'HA', 'Juvénile', 'D4', 'Masculin'),
    ('322a3339-4f3b-4371-ba2e-6ab7ecdeb042'::uuid, '24ee7ebf-fede-47dd-b666-bd1530b303ad'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'Collège St-Jean-Vianney', 'Benjamin', 'D4', 'Masculin'),
    ('32ae9b9f-a289-41f5-9535-b25e7015a1b0'::uuid, 'f4fdd087-617c-4e9b-997b-9a6922acbe0c'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'Aubier 4', 'Benjamin', 'D4', 'Masculin'),
    ('33a46e2e-0ce8-4896-b869-ae272fcf61e4'::uuid, '4cc1761f-3d71-4d58-8a3b-98701fafaa61'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'Coll. des Compagnons 2', 'Benjamin', 'D4', 'Masculin'),
    ('34c90bdd-7b46-44c0-8ca8-63fd026af8c7'::uuid, '436f6e8e-2618-43cd-90a6-dbce004b6940'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'Du Plateau', 'Juvénile', 'D4', 'Masculin'),
    ('34ca41fb-b9da-4bc2-8e6c-899c45ffb113'::uuid, '8d31a73c-ab71-4d5c-9aaa-816ca0746659'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'LAURN', 'Benjamin', 'D4', 'Féminin'),
    ('35fda0a1-066c-486a-8021-3c8cec443155'::uuid, '4f318633-a0c4-4bd0-ac1f-0587106d50ff'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'PCHS', 'Benjamin', 'D4', 'Masculin'),
    ('365a0479-f02b-4be2-85b6-ebe51525fc4a'::uuid, '20cd57dc-0001-4313-9889-2b1e480bfefa'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'St-Patrick''s HS', 'Cadet', 'D4', 'Féminin'),
    ('38de4d9d-42ba-45c1-b2de-abbe41a80888'::uuid, '820e782a-b66f-4999-90f6-ec507418814f'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'Rosemere High', 'Benjamin', 'D4', 'Masculin'),
    ('3a77bb06-db33-4662-bc1b-ae70249d03ed'::uuid, '3d98b714-fbdf-45ad-bb8f-ec24e3a824fd'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'Collège Sainte-Anne', 'Benjamin', 'D4', 'Masculin'),
    ('3ad79579-28f9-43a3-b42d-056fc2a0171a'::uuid, '506408d1-a176-4744-bb57-687bc9a41a1e'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'Collège Jean-de-Brébeuf', 'Benjamin', 'D4', 'Féminin'),
    ('3e671bd3-77d4-499a-a861-3565e82e5bfc'::uuid, '670b385d-82a2-4be2-9d36-ecec92e61083'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'St-Aubin', 'Juvénile', 'D4', 'Masculin'),
    ('3e9dc9c5-4f67-45f2-a12c-fb9c707a77af'::uuid, 'd3f457f4-3873-49dd-a92a-dcc6c6a27ab1'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'Coll. Mariste', 'Juvénile', 'D4', 'Masculin'),
    ('3fa640dc-9be8-4246-8aed-38756d597319'::uuid, 'd3f457f4-3873-49dd-a92a-dcc6c6a27ab1'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'Coll. Mariste', 'Cadet', 'D3', 'Masculin'),
    ('402d2733-0e49-446d-b7ee-bea16301dd83'::uuid, '7df9f46a-631a-436e-9c2e-e0cf173eca9e'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'Selwyn House', 'Benjamin', 'D3', 'Masculin'),
    ('445596b1-4afc-499a-a69f-9dd3bd090ecf'::uuid, '4f0e52ad-e9c7-4797-9b7b-92b25ed1307b'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'Saint-Jean-Eudes', 'Cadet', 'D3', 'Féminin'),
    ('45b65e01-71d2-4e1d-a008-4900f883a814'::uuid, '071398ea-2de1-4738-8cdf-439b35a8de06'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'Louis-Jobin', 'Cadet', 'D4', 'Féminin'),
    ('475a3370-ddee-4a05-a018-f95dc950cb27'::uuid, 'be771fe1-2f25-41ea-8e4e-6d51f2656963'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'LaSalle CCHS', 'Juvénile', 'D4', 'Masculin'),
    ('47899bff-8ad2-42df-a715-a71c1a453880'::uuid, '3da801a3-a14e-4677-9e05-c4f321459983'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'Neufchâtel', 'Juvénile', 'D4', 'Masculin'),
    ('47abeaca-c303-4bab-a4c9-269622bfeb30'::uuid, '3d98b714-fbdf-45ad-bb8f-ec24e3a824fd'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'Collège Sainte-Anne 2', 'Cadet', 'D3', 'Masculin'),
    ('49996de7-96d1-4d44-a9d3-3df5a4c424e3'::uuid, '3d98b714-fbdf-45ad-bb8f-ec24e3a824fd'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'Collège Sainte-Anne 2', 'Juvénile', 'D3', 'Masculin'),
    ('4b7c326b-3f47-4a1b-bb59-cb6ebc6efedf'::uuid, '9da1dcdf-6fe7-48c5-8dd8-c7e289382461'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'MACD', 'Juvénile', 'D4', 'Féminin'),
    ('4cfc5064-1b26-4500-b8f4-612e4960bbb6'::uuid, '5f2f489a-2079-41a7-b1cf-441a38ffdd9c'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'KUP', 'Benjamin', 'D4', 'Masculin'),
    ('4e3d45c5-68cd-4921-bcfe-c2a12416219c'::uuid, 'd35768e1-b37d-4488-9f7b-171753bdf6fb'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'Beaconsfield HS', 'Benjamin', 'D4', 'Masculin'),
    ('51a85904-d944-4057-be28-9f523370f8df'::uuid, 'f13cf9cd-59c6-45aa-9388-f3622398f870'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'John-Rennie', 'Benjamin', 'D4', 'Masculin'),
    ('52b63563-0e68-49cd-9d1d-58bdc9dd37b1'::uuid, '1d63f9f8-d0fc-4750-8344-7f2bdd6aee64'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'Vincent Massey', 'Juvénile', 'D4', 'Féminin'),
    ('53e5a076-9186-4eea-9275-76b2bd4318e4'::uuid, '1fd7ac22-adb2-48bd-9904-d8ffdc9b0a29'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'WWHS Sr', 'Juvénile', 'D4', 'Masculin'),
    ('54ed8151-1961-4a83-90c2-bba3cab6ea77'::uuid, 'e738f48d-11aa-4527-ad76-fe38b3d0bd1a'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'Bialik', 'Juvénile', 'D4', 'Masculin'),
    ('55b6da60-16e5-49bc-bf0e-894e46c9e9a7'::uuid, '4cc1761f-3d71-4d58-8a3b-98701fafaa61'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'Coll. des Compagnons', 'Juvénile', 'D3', 'Féminin'),
    ('56179875-cc4b-4639-8543-b4476bd97ef3'::uuid, '2c79f18c-9e49-411e-ace9-7bb54dc68438'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'Acad. Saint-Louis 2', 'Benjamin', 'D4', 'Masculin'),
    ('5a0bf7ca-c602-4c73-afaf-19f006f152b4'::uuid, '952f5c82-cb72-4510-b2d2-958f54194ec1'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'Du Phare', 'Juvénile', 'D3', 'Masculin'),
    ('5a201e3a-db5b-411c-a1eb-099c3e984142'::uuid, 'cd5c8d95-db2c-468a-8b42-e827793515f5'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'St-Charles-Garnier', 'Benjamin', 'D4', 'Masculin'),
    ('5c46fd45-be75-4309-9158-8145bdf9f987'::uuid, '8d31a73c-ab71-4d5c-9aaa-816ca0746659'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'LAURN', 'Benjamin', 'D4', 'Masculin'),
    ('5c488d1b-2053-4a78-9b5a-2160d897873e'::uuid, '4cb4b962-e10c-4c5a-a116-9e3f834a9d6d'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'Villa-Maria', 'Benjamin', 'D4', 'Féminin'),
    ('5fc175fe-1018-426e-be37-1f69a0cfd919'::uuid, '9df5cd0a-f9bb-4743-bf14-dddc78fac0e6'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'TRAF', 'Juvénile', 'D4', 'Féminin'),
    ('613b8264-e327-4296-98e2-0476fddd40cd'::uuid, '4ccd2925-00e4-4427-a421-7f9c222abcdc'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'Quebec HS', 'Benjamin', 'D4', 'Masculin'),
    ('621d4dcf-ca73-4c97-a0ed-bb02c2b1725e'::uuid, '1fd7ac22-adb2-48bd-9904-d8ffdc9b0a29'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'WWHS Sr', 'Benjamin', 'D4', 'Féminin'),
    ('62b47390-1c96-4a9e-88bb-33bf3afd8e6d'::uuid, '7df9f46a-631a-436e-9c2e-e0cf173eca9e'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'Selwyn House', 'Juvénile', 'D4', 'Masculin'),
    ('62ddfbef-199d-4bd3-aa14-e7c8520597ad'::uuid, 'ac594d8e-5628-455d-a375-3b94d0f5106f'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'Royal', 'Juvénile', 'D4', 'Masculin'),
    ('6305ba56-c3b1-411c-aede-6074c191132a'::uuid, '2c79f18c-9e49-411e-ace9-7bb54dc68438'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'Acad. Saint-Louis 2', 'Benjamin', 'D3', 'Féminin'),
    ('65484544-8382-4ce5-906d-6f6cf4af8381'::uuid, 'ac594d8e-5628-455d-a375-3b94d0f5106f'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'Royal', 'Benjamin', 'D3', 'Féminin'),
    ('6637685b-db92-4b71-8a51-24745b18f976'::uuid, 'ea66f367-c55a-496f-a257-fb9032493455'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'WIC', 'Juvénile', 'D3', 'Féminin'),
    ('69af8d42-5b3d-4dd6-ae7b-c4b8742ebcdd'::uuid, '4ccd2925-00e4-4427-a421-7f9c222abcdc'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'Quebec HS', 'Juvénile', 'D4', 'Masculin'),
    ('69fddb6b-2a1c-4f98-9542-97e8e4f719e4'::uuid, '506408d1-a176-4744-bb57-687bc9a41a1e'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'Collège Jean-de-Brébeuf', 'Benjamin', 'D4', 'Masculin'),
    ('6aa5a092-ab6c-4a83-b3f7-87cf33a6f0e0'::uuid, '6213dfb4-19f6-4c9f-a43d-63c0b5d89e59'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'LCC', 'Benjamin', 'D4', 'Masculin'),
    ('6b4c8820-9a1d-4cca-a1a3-de680c7d83b8'::uuid, '5579c371-bb06-49d3-b5c5-84f161cf1773'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'Poly. Black-Lake', 'Cadet', 'D4', 'Féminin'),
    ('6b5d31dd-34a8-4f91-afc6-1e0f68d84822'::uuid, '7df9f46a-631a-436e-9c2e-e0cf173eca9e'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'Selwyn House', 'Juvénile', 'D4', 'Masculin'),
    ('6c28c568-a53c-47d4-8a7e-8511e4fafcf7'::uuid, '7f9dde82-8bb4-4dca-a51c-52681bfd181f'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'Mt St-Sacrement', 'Juvénile', 'D3', 'Féminin'),
    ('6f39e91c-4048-4372-906e-c74081d58095'::uuid, '24ee7ebf-fede-47dd-b666-bd1530b303ad'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'Collège St-Jean-Vianney', 'Cadet', 'D3', 'Féminin'),
    ('70989e0a-555b-4fc0-b2b8-f79dfb3ed1eb'::uuid, '3d35c260-0587-4e0d-bf62-ea3e47022f08'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'RHS', 'Juvénile', 'D4', 'Masculin'),
    ('7252c310-3e56-460f-8339-f9e018431954'::uuid, '24ee7ebf-fede-47dd-b666-bd1530b303ad'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'Vincent Massey', 'Benjamin', 'D3', 'Masculin'),
    ('75176593-0d18-4b04-bdd7-8768f534c154'::uuid, 'f3401c79-bc55-4ff5-ac85-d368b6eb88f2'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'Laval Jr. Academy', 'Benjamin', 'D4', 'Masculin'),
    ('77122855-f3a1-42f2-8c6a-16d3ba3efe0c'::uuid, 'deeb91d4-d07f-4100-b8aa-6008da51004f'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'La Seigneurie', 'Juvénile', 'D3', 'Féminin'),
    ('776fc1ed-0e3c-4c57-b37b-d2599f37a91f'::uuid, 'c17501b1-e41d-4472-8afb-61e53b312e01'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'Marcelle-Mallet', 'Cadet', 'D4', 'Masculin'),
    ('7ab1e9fc-cc33-4ee3-877b-3e6fa3d48343'::uuid, '4ed911f3-8a10-4cdc-adf3-5747da513f95'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'FACE', 'Cadet', 'D4', 'Masculin'),
    ('7e09e6ab-b6d6-4783-863e-7616d9d78a79'::uuid, '6eb8dc0e-5b12-42ad-972d-51a3203383f9'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'Camaradière', 'Benjamin', 'D4', 'Masculin'),
    ('7f724672-f416-416e-81f6-0dc15fe68a15'::uuid, '3d98b714-fbdf-45ad-bb8f-ec24e3a824fd'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'Collège Sainte-Anne', 'Juvénile', 'D4', 'Féminin'),
    ('7fbec5ff-70e9-40c3-b2ab-0b2f2599d84e'::uuid, '63d3290f-9dc3-47dd-a659-552cf4daa100'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'Sacred Heart', 'Juvénile', 'D4', 'Féminin'),
    ('818e843d-4bf3-4e71-bce5-3c929a44c234'::uuid, '1d63f9f8-d0fc-4750-8344-7f2bdd6aee64'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'Vincent Massey', 'Cadet', 'D3', 'Féminin'),
    ('83d5dca1-928a-4157-9e95-1026cd7a053d'::uuid, '5579c371-bb06-49d3-b5c5-84f161cf1773'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'Poly. Black-Lake', 'Cadet', 'D3', 'Féminin'),
    ('846710c7-578d-4b29-bb6b-6268ab070c25'::uuid, 'c17501b1-e41d-4472-8afb-61e53b312e01'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'Marcelle-Mallet', 'Cadet', 'D4', 'Féminin'),
    ('849de16a-8e25-4a0b-885a-10a039cb346b'::uuid, '3cea1ea3-4485-4588-ac4d-48efc95cb399'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'Loyola', 'Benjamin', 'D4', 'Masculin'),
    ('85af7077-f001-49d4-a9e9-3ba0fa78757c'::uuid, '506408d1-a176-4744-bb57-687bc9a41a1e'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'LBPHS', 'Cadet', 'D4', 'Féminin'),
    ('88b6fa93-3264-407a-8a7b-872f9c2c66e2'::uuid, 'ac594d8e-5628-455d-a375-3b94d0f5106f'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'Royal', 'Juvénile', 'D3', 'Féminin'),
    ('8b246664-82bb-48b4-ae61-08e9901801f4'::uuid, 'd35768e1-b37d-4488-9f7b-171753bdf6fb'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'Beaconsfield HS', 'Benjamin', 'D4', 'Féminin'),
    ('8c0408a9-1f91-444c-aaeb-4bcb47d79df6'::uuid, 'ea66f367-c55a-496f-a257-fb9032493455'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'WIC', 'Juvénile', 'D3', 'Masculin'),
    ('8c78562c-dd57-42bc-81ce-d250b5afac26'::uuid, '3309a357-72fc-4da3-9689-0b6882d8f98a'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'LMAC', 'Cadet', 'D4', 'Masculin'),
    ('8d116e1f-fde0-43d4-928d-296c25de4b99'::uuid, '9883ed08-5dfc-4594-88fd-54aba887681e'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'Ancienne-Lorette', 'Juvénile', 'D3', 'Masculin'),
    ('8d7f72ab-f808-4604-a1c9-d94f55a678a8'::uuid, 'ffe0eb63-f851-4032-933b-45eacd6f7220'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'Laval Sr. Academy', 'Cadet', 'D3', 'Masculin'),
    ('8df6cab2-de32-4834-aa4d-9cf2039cfd27'::uuid, '4ed911f3-8a10-4cdc-adf3-5747da513f95'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'FACE', 'Juvénile', 'D4', 'Masculin'),
    ('8df9f608-84ab-49ad-a01d-4690eb6a4892'::uuid, 'f4fdd087-617c-4e9b-997b-9a6922acbe0c'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'Aubier', 'Benjamin', 'D3', 'Féminin'),
    ('92bc5334-df8f-47b3-958a-bd1b07533894'::uuid, '6213dfb4-19f6-4c9f-a43d-63c0b5d89e59'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'LCC', 'Benjamin', 'D3', 'Masculin'),
    ('93c36d0b-c886-43f6-934b-5cae49a5c81e'::uuid, '4f0e52ad-e9c7-4797-9b7b-92b25ed1307b'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'Saint-Jean-Eudes', 'Benjamin', 'D4', 'Masculin'),
    ('967ce34f-7333-4cd2-b2a5-635394f35d08'::uuid, 'b1d612af-364d-41a5-9c26-da3f062d99d1'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'Benoit-Vachon', 'Benjamin', 'D4', 'Masculin'),
    ('97843788-fdec-4f8c-bbcf-b5cf1d10aeb4'::uuid, '9883ed08-5dfc-4594-88fd-54aba887681e'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'Ancienne-Lorette', 'Benjamin', 'D4', 'Masculin'),
    ('979e8d63-24cf-4e5a-ae71-cbc2ae815437'::uuid, '70e1d8ae-a112-46c0-9138-7ff02f733abe'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'Yavné', 'Juvénile', 'D4', 'Masculin'),
    ('9a1ebfce-ffd0-470b-aad4-69a9297fa565'::uuid, 'd3f457f4-3873-49dd-a92a-dcc6c6a27ab1'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'Coll. Mariste', 'Benjamin', 'D4', 'Masculin'),
    ('9b3f09e8-0374-49a4-9262-34268941486a'::uuid, 'cd5c8d95-db2c-468a-8b42-e827793515f5'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'St-Charles-Garnier', 'Benjamin', 'D4', 'Masculin'),
    ('9c37980b-aef5-45e3-8dab-593a1b77c546'::uuid, '4cc1761f-3d71-4d58-8a3b-98701fafaa61'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'Coll. des Compagnons', 'Benjamin', 'D4', 'Masculin'),
    ('9c99e838-993f-41b9-935e-b9c0db080507'::uuid, '6213dfb4-19f6-4c9f-a43d-63c0b5d89e59'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'LCC', 'Juvénile', 'D3', 'Féminin'),
    ('9d707a2a-c33e-4954-a9a8-bd48c8560b53'::uuid, '5579c371-bb06-49d3-b5c5-84f161cf1773'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'Poly. Black-Lake', 'Cadet', 'D3', 'Masculin'),
    ('9d7c38a7-4b2b-47c9-bcb4-27d2471212fd'::uuid, 'e738f48d-11aa-4527-ad76-fe38b3d0bd1a'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'Bialik', 'Juvénile', 'D4', 'Féminin'),
    ('9f6e7df2-8ff1-45b0-8782-6156d53703df'::uuid, '4cc1761f-3d71-4d58-8a3b-98701fafaa61'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'Coll. des Compagnons', 'Juvénile', 'D4', 'Masculin'),
    ('a03f81c4-8171-4ba4-99d0-e0ef6af2d940'::uuid, 'd35768e1-b37d-4488-9f7b-171753bdf6fb'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'Beaconsfield HS', 'Cadet', 'D4', 'Féminin'),
    ('a33d8a8e-8709-4e12-aebd-f254cd7df80d'::uuid, 'be771fe1-2f25-41ea-8e4e-6d51f2656963'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'LaSalle CCHS', 'Benjamin', 'D3', 'Masculin'),
    ('a3726115-4de6-4dbc-a559-c8786333b854'::uuid, '506408d1-a176-4744-bb57-687bc9a41a1e'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'Collège Jean-de-Brébeuf', 'Cadet', 'D4', 'Masculin'),
    ('a5d128d2-f4b0-421a-9054-24b34449a51e'::uuid, '7df9f46a-631a-436e-9c2e-e0cf173eca9e'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'Selwyn House', 'Benjamin', 'D4', 'Masculin'),
    ('a748635d-0877-42b6-a5e2-eeceb15a34a0'::uuid, '3d98b714-fbdf-45ad-bb8f-ec24e3a824fd'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'WWHS Sr', 'Benjamin', 'D4', 'Féminin'),
    ('aa9f6d02-3328-4dde-9a46-3d4b052c965b'::uuid, 'cd5c8d95-db2c-468a-8b42-e827793515f5'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'St-Charles-Garnier', 'Cadet', 'D4', 'Masculin'),
    ('ac9c44ba-4555-43c5-b751-4986435203dd'::uuid, 'cd5c8d95-db2c-468a-8b42-e827793515f5'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'St-Charles-Garnier', 'Juvénile', 'D4', 'Féminin'),
    ('ac9f4dad-ff7a-4c09-b186-32d64727d56e'::uuid, 'b1d612af-364d-41a5-9c26-da3f062d99d1'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'Benoit-Vachon', 'Juvénile', 'D3', 'Féminin'),
    ('adb91e7b-eb02-4ea0-bf97-eae358062681'::uuid, 'b1d612af-364d-41a5-9c26-da3f062d99d1'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'Benoit-Vachon', 'Cadet', 'D4', 'Féminin'),
    ('ae429cde-a3cb-451a-a62e-21d6a887f058'::uuid, '3da801a3-a14e-4677-9e05-c4f321459983'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'Neufchâtel', 'Benjamin', 'D4', 'Masculin'),
    ('ae8a68c6-ac9c-44c0-8076-12ee0ee8911e'::uuid, '7f9dde82-8bb4-4dca-a51c-52681bfd181f'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'Mt St-Sacrement', 'Benjamin', 'D4', 'Féminin'),
    ('aecc0b52-d866-4c8a-861c-64d199252287'::uuid, 'd3f457f4-3873-49dd-a92a-dcc6c6a27ab1'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'Coll. Mariste', 'Juvénile', 'D4', 'Féminin'),
    ('af82b10d-2ca1-42c1-b497-2ee123b5a820'::uuid, '1d63f9f8-d0fc-4750-8344-7f2bdd6aee64'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'Vincent Massey', 'Benjamin', 'D3', 'Masculin'),
    ('b0bd476c-642e-4dc5-bda7-ba463c4e2842'::uuid, 'd5a41baa-fb63-4477-8f9c-7657856168b5'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'MMA', 'Cadet', 'D4', 'Masculin'),
    ('b3095a63-c01f-4e21-91c2-47e19f1cc743'::uuid, '2b66bd02-9db6-4cc0-a777-e8a14a9d822c'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'Samuel-Champlain 2', 'Benjamin', 'D3', 'Masculin'),
    ('b3ca78df-0af6-4e94-a197-83f55b5e70d7'::uuid, '8d31a73c-ab71-4d5c-9aaa-816ca0746659'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'LAURN', 'Juvénile', 'D4', 'Masculin'),
    ('b4a0ede7-ec81-458a-93a7-d8e0db1009ca'::uuid, '4ccd2925-00e4-4427-a421-7f9c222abcdc'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'Quebec HS', 'Juvénile', 'D4', 'Féminin'),
    ('b57c8a52-ab39-4ac2-841d-09d23221194a'::uuid, '820e782a-b66f-4999-90f6-ec507418814f'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'Vincent Massey', 'Benjamin', 'D4', 'Masculin'),
    ('b5b7daf6-24e5-4980-98a7-0124d4e191b3'::uuid, 'a07c15c8-8aaf-4618-8895-c62a1a1d5730'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'Acad. Ste-Marie', 'Benjamin', 'D4', 'Masculin'),
    ('b63a2b08-fb41-4101-9c56-5929557b0f7f'::uuid, '1d63f9f8-d0fc-4750-8344-7f2bdd6aee64'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'Rosemere High', 'Juvénile', 'D4', 'Masculin'),
    ('b7a24242-d47f-40a2-9148-d0ce20652c8f'::uuid, '820e782a-b66f-4999-90f6-ec507418814f'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'Rosemere High', 'Juvénile', 'D4', 'Féminin'),
    ('b86409a0-ad4c-448a-85bb-48c8efb11945'::uuid, '1d63f9f8-d0fc-4750-8344-7f2bdd6aee64'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'Vincent Massey', 'Benjamin', 'D4', 'Féminin'),
    ('b865ff0e-424a-489f-9c3c-c809530a2e45'::uuid, '071398ea-2de1-4738-8cdf-439b35a8de06'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'Louis-Jobin', 'Juvénile', 'D4', 'Féminin'),
    ('b9fd978a-9f7f-49ee-98a9-d18236ff93ee'::uuid, 'ffe0eb63-f851-4032-933b-45eacd6f7220'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'Laval Sr. Academy', 'Juvénile', 'D3', 'Féminin'),
    ('bdfb08b9-35e0-4de9-8749-ba49bdefff90'::uuid, 'b1d612af-364d-41a5-9c26-da3f062d99d1'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'Benoit-Vachon', 'Juvénile', 'D4', 'Masculin'),
    ('c0dc6685-eaa3-49e3-aa1d-878431fceee9'::uuid, '1fd7ac22-adb2-48bd-9904-d8ffdc9b0a29'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'WWHS Sr', 'Juvénile', 'D4', 'Féminin'),
    ('c3c72aee-834f-4926-bc57-50ee0dc840a7'::uuid, '6213dfb4-19f6-4c9f-a43d-63c0b5d89e59'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'LCC', 'Juvénile', 'D4', 'Féminin'),
    ('c3f8bb0b-dd44-4fcc-bcb2-c3b9cfa8fd8b'::uuid, 'd35768e1-b37d-4488-9f7b-171753bdf6fb'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'Beaconsfield HS', 'Juvénile', 'D4', 'Masculin'),
    ('c4996c15-3038-41c9-8ee0-e895d315124e'::uuid, '5579c371-bb06-49d3-b5c5-84f161cf1773'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'Poly. Black-Lake', 'Benjamin', 'D4', 'Masculin'),
    ('c6434b5f-9c07-4df2-b168-be003d28e33d'::uuid, '9da1dcdf-6fe7-48c5-8dd8-c7e289382461'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'MACD', 'Juvénile', 'D3', 'Masculin'),
    ('c6749619-65c6-4467-a3cf-57d095a5f809'::uuid, 'ea66f367-c55a-496f-a257-fb9032493455'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'WIC', 'Benjamin', 'D3', 'Féminin'),
    ('c7d5a42c-8e66-4ee2-a439-3826c53bf72c'::uuid, '4f318633-a0c4-4bd0-ac1f-0587106d50ff'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'PCHS', 'Juvénile', 'D4', 'Féminin'),
    ('c98cba66-3e8f-40cd-857e-4c854a940b24'::uuid, 'a07c15c8-8aaf-4618-8895-c62a1a1d5730'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'Acad. Ste-Marie 2', 'Benjamin', 'D4', 'Masculin'),
    ('ca610ec1-c97a-4bcf-8b4c-df4cd51455c8'::uuid, '820e782a-b66f-4999-90f6-ec507418814f'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'Vincent Massey', 'Juvénile', 'D4', 'Masculin'),
    ('caeffa1d-856f-4cac-8338-523f1d4ac3b8'::uuid, '19b3fe49-d05e-4762-84c4-b8ba13061b43'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'St-Marc', 'Benjamin', 'D4', 'Masculin'),
    ('ccde3377-5cfc-47bf-8b6c-646c17e37954'::uuid, 'd0eb0d14-ab1a-4024-b2e3-98a5d4511737'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'JFKHS', 'Juvénile', 'D4', 'Masculin'),
    ('ccfbb4b9-7cda-414a-9e05-92d0dc593ffd'::uuid, '071398ea-2de1-4738-8cdf-439b35a8de06'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'Louis-Jobin', 'Benjamin', 'D4', 'Masculin'),
    ('cd963eb4-10c8-4ba5-878e-d5a4563592c8'::uuid, 'd3f457f4-3873-49dd-a92a-dcc6c6a27ab1'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'Coll. Mariste', 'Benjamin', 'D4', 'Masculin'),
    ('cdfe1833-62bc-4d7c-89c0-4d95c223ad08'::uuid, 'ffe0eb63-f851-4032-933b-45eacd6f7220'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'Laval Sr. Academy', 'Juvénile', 'D4', 'Masculin'),
    ('cf7cdc8e-de81-4fec-a107-03c9f7a189d9'::uuid, '9da1dcdf-6fe7-48c5-8dd8-c7e289382461'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'MACD', 'Benjamin', 'D4', 'Masculin'),
    ('cfb7f010-e714-43ec-8aac-f3318074ad54'::uuid, '7df9f46a-631a-436e-9c2e-e0cf173eca9e'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'Selwyn House', 'Benjamin', 'D4', 'Masculin'),
    ('d01f921d-8e3d-4e92-a3d8-5e55061fecad'::uuid, '6213dfb4-19f6-4c9f-a43d-63c0b5d89e59'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'LCC', 'Cadet', 'D4', 'Féminin'),
    ('d0269144-a204-4899-84fb-b7a4c47e06ec'::uuid, '4cb4b962-e10c-4c5a-a116-9e3f834a9d6d'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'Villa-Maria', 'Cadet', 'D4', 'Masculin'),
    ('d06914b3-a678-4aab-931a-00c68a2b5483'::uuid, 'e041bfa5-f429-4bae-8cf8-a6ff96ef3bd6'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'Coll. Champigny', 'Cadet', 'D4', 'Masculin'),
    ('d4853d74-db86-40de-9149-9d653eaf6374'::uuid, 'd3f457f4-3873-49dd-a92a-dcc6c6a27ab1'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'Coll. Mariste', 'Benjamin', 'D4', 'Féminin'),
    ('d523672d-b3c4-4c16-8f6d-731a69d1e364'::uuid, '3309a357-72fc-4da3-9689-0b6882d8f98a'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'LMAC', 'Benjamin', 'D4', 'Féminin'),
    ('d533b473-1e73-4171-9b80-1420b38da4d1'::uuid, '5994fb8e-825f-4927-89cf-72625c0daac6'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'HZHS', 'Benjamin', 'D4', 'Masculin'),
    ('d72cf746-a10d-4ce1-8f65-08a996a46156'::uuid, '3f8b9d99-da9e-4f63-9481-af0dc808bd13'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'Collège Jean-de-Brébeuf', 'Cadet', 'D4', 'Féminin'),
    ('d78bd57e-592c-46be-a67f-87e5f738f567'::uuid, '6213dfb4-19f6-4c9f-a43d-63c0b5d89e59'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'LCC', 'Juvénile', 'D3', 'Masculin'),
    ('d9568fdb-bce6-4c02-b7f2-6622d5426f38'::uuid, 'd0fe3933-cfda-4ea2-9216-b1ee909632ff'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'EMCS', 'Benjamin', 'D4', 'Masculin'),
    ('d967f686-1cc5-4605-8c62-572d551fb1d9'::uuid, '9da1dcdf-6fe7-48c5-8dd8-c7e289382461'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'MACD', 'Cadet', 'D4', 'Masculin'),
    ('d9f139d9-93a3-46d2-84a2-c25181fe9962'::uuid, '3f8b9d99-da9e-4f63-9481-af0dc808bd13'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'LBPHS', 'Benjamin', 'D4', 'Masculin'),
    ('dbf27606-e969-4c30-9845-4f5a5dde3e95'::uuid, 'be771fe1-2f25-41ea-8e4e-6d51f2656963'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'LaSalle CCHS', 'Cadet', 'D4', 'Féminin'),
    ('e0862bf2-ee28-4fc5-9218-1119692c6640'::uuid, '1d63f9f8-d0fc-4750-8344-7f2bdd6aee64'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'Rosemere High', 'Benjamin', 'D4', 'Masculin'),
    ('e08b2277-f799-47c9-a0f4-0facf74f3058'::uuid, '7f9dde82-8bb4-4dca-a51c-52681bfd181f'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'Mt St-Sacrement', 'Benjamin', 'D4', 'Masculin'),
    ('e49a56fa-8ede-45d7-b075-eba0b87d35ff'::uuid, '820e782a-b66f-4999-90f6-ec507418814f'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'Rosemere High', 'Benjamin', 'D4', 'Féminin'),
    ('e58f9e01-8366-4a4d-8f36-422929bb538c'::uuid, 'de7f87c3-2831-4123-8efe-f908e926864e'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'Edgar Cramp', 'Juvénile', 'D3', 'Féminin'),
    ('e5996340-f284-44b2-b4fd-ec725e677e0b'::uuid, '882225d5-7097-4c09-8903-73f16c949282'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'RVALE', 'Juvénile', 'D4', 'Masculin'),
    ('e5c226ea-063a-4f17-9729-bc94b6e812c4'::uuid, '3f8b9d99-da9e-4f63-9481-af0dc808bd13'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'LBPHS', 'Cadet', 'D3', 'Masculin'),
    ('e61b1a8a-dcb5-4654-9843-a24659457ea3'::uuid, '4f318633-a0c4-4bd0-ac1f-0587106d50ff'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'PCHS', 'Juvénile', 'D4', 'Masculin'),
    ('e85d1f12-5582-4fc1-a08b-10b91697e285'::uuid, '4ea8e12b-4b05-4cde-b008-49c36706a54b'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'LA', 'Cadet', 'D4', 'Masculin'),
    ('e9fcdc14-eaca-4d56-ab68-50381d96a0cf'::uuid, '1fd7ac22-adb2-48bd-9904-d8ffdc9b0a29'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'WWHS Sr', 'Cadet', 'D4', 'Masculin'),
    ('eae16d61-b3f2-409c-b4a2-0f12b808a307'::uuid, 'b1963b97-f46a-4afc-86bd-ccca5f7175e1'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'Mt Ste-Anne', 'Juvénile', 'D4', 'Masculin'),
    ('ec5ddf4e-1ce1-4a81-9941-dd8e30e57d2b'::uuid, 'f4fdd087-617c-4e9b-997b-9a6922acbe0c'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'Aubier 3', 'Benjamin', 'D4', 'Masculin'),
    ('ecd8bb85-e35d-4b4b-91e6-0abe1285d4cb'::uuid, 'b47c1d8c-4263-4616-a4f1-7681955de19c'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'MACD', 'Benjamin', 'D4', 'Féminin'),
    ('eec8a904-0c77-4ece-b267-1ebef945a10f'::uuid, '3d98b714-fbdf-45ad-bb8f-ec24e3a824fd'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'Collège Sainte-Anne', 'Benjamin', 'D3', 'Masculin'),
    ('f0d2ea09-8b5c-47d9-9372-ee8efb89edcd'::uuid, 'f3401c79-bc55-4ff5-ac85-d368b6eb88f2'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'Laval Jr. Academy', 'Benjamin', 'D4', 'Masculin'),
    ('f0e5835a-b85a-401d-a813-089f0b8c2a69'::uuid, 'cd60be16-0a36-47ad-ae90-d3a4d065d66c'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'Sém. Chicoutimi', 'Benjamin', 'D4', 'Masculin'),
    ('f3063596-5cac-4762-a73a-d18152b55a85'::uuid, 'aad2a33e-ece0-4db1-9c96-66a5918f6679'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'Sém. St-François', 'Benjamin', 'D4', 'Masculin'),
    ('f3188a3a-3fc5-4a20-bcdf-4d2f9d8ab2c8'::uuid, '63d3290f-9dc3-47dd-a659-552cf4daa100'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'Sacred Heart', 'Cadet', 'D4', 'Féminin'),
    ('f544163e-54be-41cd-b23e-7acb9e053974'::uuid, 'd35768e1-b37d-4488-9f7b-171753bdf6fb'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'Beaconsfield HS', 'Juvénile', 'D4', 'Féminin'),
    ('f5718a6a-9646-40e4-97cb-150d64c76b3d'::uuid, '20cd57dc-0001-4313-9889-2b1e480bfefa'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'St-Patrick''s HS', 'Juvénile', 'D4', 'Féminin'),
    ('f6ddb99d-14bf-47a7-bee5-223e611d75a5'::uuid, '9da1dcdf-6fe7-48c5-8dd8-c7e289382461'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'MACD', 'Benjamin', 'D4', 'Féminin'),
    ('f75bba8f-257f-4374-86f9-28dff101de8e'::uuid, 'd3f457f4-3873-49dd-a92a-dcc6c6a27ab1'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'Coll. Mariste', 'Cadet', 'D3', 'Féminin'),
    ('fc02ed2e-6bed-4f61-9de9-bfc90870a510'::uuid, '2a5c01e4-78b4-4c59-9e72-ccf2a27aa4d5'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'HA', 'Benjamin', 'D4', 'Masculin'),
    ('fc2c25df-7edb-475c-a1c6-77515a001d8a'::uuid, '4f0e52ad-e9c7-4797-9b7b-92b25ed1307b'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'Saint-Jean-Eudes', 'Cadet', 'D4', 'Masculin'),
    ('fc4f3f63-986d-4053-8970-3f117488e636'::uuid, '3309a357-72fc-4da3-9689-0b6882d8f98a'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'LMAC', 'Benjamin', 'D4', 'Masculin'),
    ('fd6b1808-b18f-4acd-9d2a-8967ac976909'::uuid, '7f9dde82-8bb4-4dca-a51c-52681bfd181f'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'Mt St-Sacrement', 'Juvénile', 'D4', 'Masculin'),
    ('fdfbfd3e-0e24-4bd0-83b6-9f309d093493'::uuid, '4ccd2925-00e4-4427-a421-7f9c222abcdc'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'Quebec HS', 'Benjamin', 'D4', 'Masculin'),
    ('ff0328a7-ba33-466f-b13a-9d561c09becd'::uuid, '56a79a3f-3fac-4719-a35b-ddd8116648ea'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'Westmount HS', 'Cadet', 'D4', 'Masculin'),
    ('ffc8a50b-5456-4616-bfb2-8a91bd8838a2'::uuid, 'ac594d8e-5628-455d-a375-3b94d0f5106f'::uuid, 'aa2d1f97-989d-4491-b733-9236129ba154'::uuid, 'Royal', 'Benjamin', 'D4', 'Masculin');

  -- Gardes (dédoublonnage du Pont RSEQ)
  if (select count(*) from _lot) <> n_attendu then
    raise exception 'NEXUS: lot de % ligne(s), attendu %', (select count(*) from _lot), n_attendu; end if;
  if exists (select 1 from public.teams t join _lot l using (rseq_team_id)) then
    raise exception 'NEXUS: % rseq_team_id du lot déjà en base — régénérer',
      (select count(*) from public.teams t join _lot l using (rseq_team_id)); end if;
  if exists (select 1 from _lot l left join public.schools s on s.id = l.school_id
              where s.id is null or s.type <> 'SECONDAIRE') then
    raise exception 'NEXUS: école absente ou non SECONDAIRE dans le lot'; end if;
  if exists (select 1 from _lot l join public.teams t
               on t.school_id = l.school_id and t.sport_id = l.sport_id and t.season = '2026-2027'
              and coalesce(t.age_group, '') = coalesce(l.age_group, '')
              and regexp_replace(lower(coalesce(t.division, '')), '^division\s*', 'd') = regexp_replace(lower(coalesce(l.division, '')), '^division\s*', 'd')
             where l.rseq_team_id <> all (array[]::uuid[])) then
    raise exception 'NEXUS: doublon école + sport + catégorie + division + saison non tranché par BP'; end if;

  select count(*) into n_h0 from public.games g join _lot l on l.rseq_team_id = g.home_rseq_team_id where g.home_team_id is null;
  select count(*) into n_v0 from public.games g join _lot l on l.rseq_team_id = g.visitor_rseq_team_id where g.visitor_team_id is null;
  if n_h0 + n_v0 <> cotes_releves then
    raise exception 'NEXUS: % côté(s) de match à relier aujourd''hui, % au relevé — la veille a bougé, régénérer',
      n_h0 + n_v0, cotes_releves; end if;
  select count(*) into n_ops0 from public.admin_operations;
  select count(*) into n_teams0 from public.teams;

  insert into public.teams (school_id, sport_id, name, age_group, division, gender, season, rseq_team_id)
  select school_id, sport_id, name, age_group, division, gender, '2026-2027', rseq_team_id from _lot;
  get diagnostics n_ins = row_count;

  update public.games g set home_team_id = t.id
    from public.teams t join _lot l using (rseq_team_id)
   where g.home_rseq_team_id = t.rseq_team_id and g.home_team_id is null;
  get diagnostics n_h = row_count;
  update public.games g set visitor_team_id = t.id
    from public.teams t join _lot l using (rseq_team_id)
   where g.visitor_rseq_team_id = t.rseq_team_id and g.visitor_team_id is null;
  get diagnostics n_v = row_count;

  insert into public.admin_operations (operation, motif, details, par)
  values ('EQUIPES_RSEQ_2026_CREEES',
          'Équipes RSEQ 2026 secondaires créées et matchs reliés — lot 03 Soccer (audit RSEQ, GO BP)',
          jsonb_build_object('lot', '03-soccer', 'sport', 'Soccer', 'equipes', n_ins,
                             'cotes_domicile', n_h, 'cotes_visiteur', n_v,
                             'rseq_team_ids', (select jsonb_agg(rseq_team_id order by rseq_team_id) from _lot)),
          v_bp);
  select count(*) into n_ops1 from public.admin_operations;
  select count(*) into n_teams1 from public.teams;

  if n_ins <> n_attendu or n_teams1 - n_teams0 <> n_attendu or n_h <> n_h0 or n_v <> n_v0 or n_ops1 - n_ops0 <> 1 then
    raise exception 'NEXUS: garde échouée (équipes +%, domicile %/%, visiteur %/%, ops +%) — rien écrit',
      n_ins, n_h, n_h0, n_v, n_v0, n_ops1 - n_ops0; end if;
  raise notice 'OK lot 03 Soccer : % équipe(s), % côté(s) domicile + % côté(s) visiteur reliés, 1 ligne admin_operations',
    n_ins, n_h, n_v;
end $$;

-- CONTRÔLE DE SIGNATURE (ajouté autour du lot, même transaction) : les équipes créées par ce lot doivent
-- reproduire exactement le contenu du fichier 03-soccer.sql (md5 du fichier b41b04e0b6a88a66677a27d0d4e7822d).
do $ctl$
declare n int; s text;
begin
  select count(*), md5(string_agg(t.rseq_team_id || '|' || t.school_id || '|' || t.sport_id || '|' || t.name || '|'
           || coalesce(t.age_group, '') || '|' || coalesce(t.division, '') || '|' || coalesce(t.gender, ''), ';' order by t.rseq_team_id))
    into n, s
    from public.teams t
    join (select distinct (jsonb_array_elements_text(details -> 'rseq_team_ids'))::uuid r
            from public.admin_operations
           where operation = 'EQUIPES_RSEQ_2026_CREEES' and details ->> 'lot' = '03-soccer') a on a.r = t.rseq_team_id
   where t.season = '2026-2027';
  if n <> 203 or s is distinct from '8bdf1bed390140c2eb4c2708d15d9495' then
    raise exception 'NEXUS: signature de contenu du lot 03-soccer : % équipe(s), signature %, attendu 203 / 8bdf1bed390140c2eb4c2708d15d9495 — transaction annulée', n, s;
  end if;
end $ctl$;
commit;
