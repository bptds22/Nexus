-- Lot 01 — Football : 38 équipe(s) RSEQ 2026 (secondaire), 227 côté(s) de match à relier (relevé prod du 2026-10-08).
-- Généré par scripts/rseq-equipes-2026/generer-lots.mjs. Règles : CLAUDE.md § « Pont RSEQ ».
-- Transaction gardée : exactement 38 équipe(s) créée(s) et exactement les côtés de match relevés
-- (games.home_team_id / visitor_team_id NULL portant un rseq_team_id du lot), sinon RIEN n'est écrit.
-- Aucun match supprimé ; aucune équipe existante modifiée ; seules colonnes écrites dans games :
-- home_team_id et visitor_team_id, et seulement là où elles sont NULL.
do $$
declare
  v_bp uuid;
  n_attendu constant int := 38;
  cotes_releves constant int := 227;  -- relevé à la génération ; recompté et exigé dans la transaction
  n_ins int; n_h int; n_v int; n_h0 int; n_v0 int; n_ops0 int; n_ops1 int; n_teams0 int; n_teams1 int;
begin
  select id into strict v_bp from public.users where email = 'bptds22@gmail.com';
  create temp table _lot (rseq_team_id uuid primary key, school_id uuid not null, sport_id uuid not null,
    name text not null, age_group text, division text, gender text) on commit drop;
  insert into _lot values
    ('007c4209-29af-43c5-842d-0deeb2f274ef'::uuid, '8dbb6f3a-b683-4c96-9088-c5b5168dd970'::uuid, '4b859bf1-5832-4258-897c-e094062926af'::uuid, 'C. Clarétain', 'Cadet', 'D3', 'Masculin'),
    ('029ac415-47a9-4f3d-a9c6-221ba66c68c9'::uuid, '05c846a0-52c6-4a1c-818b-6f8e22b2cb89'::uuid, '4b859bf1-5832-4258-897c-e094062926af'::uuid, 'É.S. La Frontalière', 'Juvénile', 'D3', 'Masculin'),
    ('03a25533-413e-4491-8b98-f229f1a80f0d'::uuid, '5c286b8c-e9f9-43ab-8f70-0633fc36ed9d'::uuid, '4b859bf1-5832-4258-897c-e094062926af'::uuid, 'Séminaire Saint-Joseph', 'Cadet', 'D3', 'Mixte'),
    ('05b90bde-7dc6-45f4-a3e2-3dbc6359fc0f'::uuid, '5c286b8c-e9f9-43ab-8f70-0633fc36ed9d'::uuid, '4b859bf1-5832-4258-897c-e094062926af'::uuid, 'Séminaire Saint-Joseph', 'Benjamin', 'D3', 'Mixte'),
    ('088b30d5-a053-40be-81a3-fe98f1cb0eea'::uuid, 'c1d6d080-a8e4-47b9-bc3b-a1f1e34fa75b'::uuid, '4b859bf1-5832-4258-897c-e094062926af'::uuid, 'É.I. Du Phare', 'Benjamin', 'D3', 'Masculin'),
    ('105410f3-fdb6-471d-b173-07c73188d37b'::uuid, 'eebf1ac9-ee89-4430-969a-6dc5992d6a3d'::uuid, '4b859bf1-5832-4258-897c-e094062926af'::uuid, 'Le Ber', 'Juvénile', 'D3', 'Masculin'),
    ('17fc9e9a-9af7-4bd6-8fc3-35802e163aea'::uuid, 'd7c74852-89d5-4cfa-a767-852f085c9a31'::uuid, '4b859bf1-5832-4258-897c-e094062926af'::uuid, 'Dalbé-Viau', 'Benjamin', null, 'Masculin'),
    ('22db5133-1702-487b-87a3-4d105787b9d1'::uuid, '46453351-3337-44c3-936f-c45c4bcfd8be'::uuid, '4b859bf1-5832-4258-897c-e094062926af'::uuid, 'Paul-Hubert', 'Juvénile', 'D3', 'Mixte'),
    ('24d8b54f-cf55-4909-b395-f9280ce0c4c7'::uuid, '8962bde8-4aa1-4732-aa8f-f289accefc84'::uuid, '4b859bf1-5832-4258-897c-e094062926af'::uuid, 'C.-E. Pouliot', 'Benjamin', 'D3', 'Mixte'),
    ('2c1af6b7-37b1-4e4a-8a4a-156022894295'::uuid, '5c286b8c-e9f9-43ab-8f70-0633fc36ed9d'::uuid, '4b859bf1-5832-4258-897c-e094062926af'::uuid, 'Séminaire Saint-Joseph', 'Juvénile', 'D2', 'Masculin'),
    ('2ff8c6f8-c892-42ea-a212-4186365b113c'::uuid, '4090e900-d790-4d0a-9c3c-e5935a7cb62e'::uuid, '4b859bf1-5832-4258-897c-e094062926af'::uuid, 'P. Montignac', 'Cadet', 'D3', 'Masculin'),
    ('358b887c-0822-4508-b796-d8ceb50072a5'::uuid, '7f256637-7ad2-4306-8324-c72049a43f62'::uuid, '4b859bf1-5832-4258-897c-e094062926af'::uuid, 'É.S. La Ruche - Noirs', 'Benjamin', 'D3', 'Masculin'),
    ('35d3acb8-3abd-43e9-8dfb-a915c1eec0e4'::uuid, 'f7a54b0e-698f-4bc2-9bba-5ee28c91ede6'::uuid, '4b859bf1-5832-4258-897c-e094062926af'::uuid, 'Collège Notre-Dame', 'Benjamin', null, 'Masculin'),
    ('48f658c3-e845-4b7b-bc94-d6eaff9c5e95'::uuid, '7f256637-7ad2-4306-8324-c72049a43f62'::uuid, '4b859bf1-5832-4258-897c-e094062926af'::uuid, 'É.S. La Ruche - Blancs', 'Benjamin', 'D3', 'Masculin'),
    ('4cd02c22-7bf1-4c0b-b3ea-87e8200bf2f2'::uuid, '7a237196-89b0-455a-bdba-c4d248c5a8d0'::uuid, '4b859bf1-5832-4258-897c-e094062926af'::uuid, 'É. s. Bâtisseurs', 'Benjamin', 'D4', 'Masculin'),
    ('4df979c8-afaf-41c9-922f-d83a79edf615'::uuid, '8962bde8-4aa1-4732-aa8f-f289accefc84'::uuid, '4b859bf1-5832-4258-897c-e094062926af'::uuid, 'C.-E. Pouliot', 'Juvénile', 'D3', 'Mixte'),
    ('56086ee8-99f0-4828-9e0e-832d19b769ca'::uuid, '7a237196-89b0-455a-bdba-c4d248c5a8d0'::uuid, '4b859bf1-5832-4258-897c-e094062926af'::uuid, 'É. s. Bâtisseurs', 'Juvénile', 'D4', 'Masculin'),
    ('656e79d2-69d8-4b7a-97cf-24eebaa78bf8'::uuid, '5c7076bb-1b2c-4376-90ed-f1a323a5e6f4'::uuid, '4b859bf1-5832-4258-897c-e094062926af'::uuid, 'É.S. Mitchell', 'Benjamin', 'D3', 'Masculin'),
    ('7147ef6b-00c0-42f0-9489-9c547b24b3a2'::uuid, 'cc920671-951a-4f0d-94df-8225bc4b1558'::uuid, '4b859bf1-5832-4258-897c-e094062926af'::uuid, 'Mistral', 'Juvénile', 'D3', 'Mixte'),
    ('79ab5d2c-38bc-43fc-87d2-cacc6b40a86e'::uuid, '8adc77a6-ad4c-4fd8-a1d5-147421a14ebc'::uuid, '4b859bf1-5832-4258-897c-e094062926af'::uuid, 'Coll. Mont-Sacré-Coeur', 'Juvénile', 'D3', 'Masculin'),
    ('7e67a7bb-a0af-4635-972f-bd96706afddb'::uuid, '8adc77a6-ad4c-4fd8-a1d5-147421a14ebc'::uuid, '4b859bf1-5832-4258-897c-e094062926af'::uuid, 'Coll. Mont-Sacré-Coeur', 'Benjamin', 'D3', 'Masculin'),
    ('7ed76ca6-d854-4446-8478-f2d3db9fcda8'::uuid, 'cc920671-951a-4f0d-94df-8225bc4b1558'::uuid, '4b859bf1-5832-4258-897c-e094062926af'::uuid, 'Mistral', 'Benjamin', 'D3', 'Mixte'),
    ('80de7610-c415-4510-a8a7-558529b48931'::uuid, 'da845de0-6698-4110-98bb-15c0e7c35bfd'::uuid, '4b859bf1-5832-4258-897c-e094062926af'::uuid, 'Matane', 'Benjamin', 'D3', 'Mixte'),
    ('905bc326-4fa1-407a-ac95-9797a4acbfdc'::uuid, '3ba46ee6-bec7-43b4-becd-dde3d36306dc'::uuid, '4b859bf1-5832-4258-897c-e094062926af'::uuid, 'Curé-Antoine-Labelle', 'Benjamin', null, 'Masculin'),
    ('93be76f6-402d-4a29-8b62-8691b3d57eec'::uuid, 'c1d6d080-a8e4-47b9-bc3b-a1f1e34fa75b'::uuid, '4b859bf1-5832-4258-897c-e094062926af'::uuid, 'É.I. Du Phare', 'Juvénile', 'D3', 'Masculin'),
    ('94002818-bc27-4e2e-b185-e5fb1d0c964e'::uuid, 'c1ff638c-e834-4fa0-89f5-b9adbf127121'::uuid, '4b859bf1-5832-4258-897c-e094062926af'::uuid, 'JDNManikoutai', 'Juvénile', 'D4', 'Masculin'),
    ('94afaa73-eee0-40f4-87cc-f926b51afded'::uuid, 'f3401c79-bc55-4ff5-ac85-d368b6eb88f2'::uuid, '4b859bf1-5832-4258-897c-e094062926af'::uuid, 'Laval Jr. Academy', 'Benjamin', null, 'Masculin'),
    ('95f2ba7b-74a8-4ec1-87be-2b7352ca61ee'::uuid, '7df9f46a-631a-436e-9c2e-e0cf173eca9e'::uuid, '4b859bf1-5832-4258-897c-e094062926af'::uuid, 'Selwyn House', 'Benjamin', null, 'Masculin'),
    ('a105718b-7536-4ea0-93fd-f599bc89ad63'::uuid, '1fb7dab1-fab1-4478-963c-3151e22612dc'::uuid, '4b859bf1-5832-4258-897c-e094062926af'::uuid, 'C. St-Bernard', 'Cadet', 'D3', 'Masculin'),
    ('a65940be-f881-4cb7-ab66-8744d4702420'::uuid, '7f256637-7ad2-4306-8324-c72049a43f62'::uuid, '4b859bf1-5832-4258-897c-e094062926af'::uuid, 'É.S. La Ruche', 'Juvénile', 'D3', 'Masculin'),
    ('ace11128-ddee-4e14-84a5-f10cb8ba4747'::uuid, 'eebf1ac9-ee89-4430-969a-6dc5992d6a3d'::uuid, '4b859bf1-5832-4258-897c-e094062926af'::uuid, 'Le Ber', 'Cadet', 'D3', 'Masculin'),
    ('acf04c14-b482-43b4-a21a-1901f4ce05d2'::uuid, '7d59545c-415c-48d1-8a1e-3e02554247f0'::uuid, '4b859bf1-5832-4258-897c-e094062926af'::uuid, 'É.S. du Triolet', 'Benjamin', 'D3', 'Masculin'),
    ('bb9da9d3-78d9-4183-a76b-ac804f96c091'::uuid, '5c286b8c-e9f9-43ab-8f70-0633fc36ed9d'::uuid, '4b859bf1-5832-4258-897c-e094062926af'::uuid, 'Séminaire Saint-Joseph', 'Atome', 'D3', 'Mixte'),
    ('c0a15807-d910-4bc8-a83b-8a97b0cd8457'::uuid, 'c1ff638c-e834-4fa0-89f5-b9adbf127121'::uuid, '4b859bf1-5832-4258-897c-e094062926af'::uuid, 'JDNManikoutai', 'Benjamin', 'D4', 'Masculin'),
    ('d37ae8d9-7b71-49c7-8be6-5edb4428c2d2'::uuid, 'ea11a9e0-aad9-4294-8ac2-2a6302317e0c'::uuid, '4b859bf1-5832-4258-897c-e094062926af'::uuid, 'Collège Jean-Eudes', 'Benjamin', null, 'Masculin'),
    ('eb1874fe-8ff4-4cba-ad5c-0e0b04be5c6b'::uuid, '5d8885c8-037d-4e82-84eb-e6822b59c543'::uuid, '4b859bf1-5832-4258-897c-e094062926af'::uuid, 'S. de Sherbrooke', 'Benjamin', 'D3', 'Masculin'),
    ('f5e2875b-85dd-4760-86dc-282f4da7791e'::uuid, 'a2350c7e-b58f-48eb-841b-8d2249b50c05'::uuid, '4b859bf1-5832-4258-897c-e094062926af'::uuid, 'Collège Bourget', 'Benjamin', null, 'Masculin'),
    ('f7725413-16ee-4ebe-9740-76e8c600697d'::uuid, '05c846a0-52c6-4a1c-818b-6f8e22b2cb89'::uuid, '4b859bf1-5832-4258-897c-e094062926af'::uuid, 'É.S. La Frontalière', 'Cadet', 'D3', 'Masculin');

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
             where l.rseq_team_id <> all (array['acf04c14-b482-43b4-a21a-1901f4ce05d2'::uuid])) then
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
          'Équipes RSEQ 2026 secondaires créées et matchs reliés — lot 01 Football (audit RSEQ, GO BP)',
          jsonb_build_object('lot', '01-football', 'sport', 'Football', 'equipes', n_ins,
                             'cotes_domicile', n_h, 'cotes_visiteur', n_v,
                             'rseq_team_ids', (select jsonb_agg(rseq_team_id order by rseq_team_id) from _lot)),
          v_bp);
  select count(*) into n_ops1 from public.admin_operations;
  select count(*) into n_teams1 from public.teams;

  if n_ins <> n_attendu or n_teams1 - n_teams0 <> n_attendu or n_h <> n_h0 or n_v <> n_v0 or n_ops1 - n_ops0 <> 1 then
    raise exception 'NEXUS: garde échouée (équipes +%, domicile %/%, visiteur %/%, ops +%) — rien écrit',
      n_ins, n_h, n_h0, n_v, n_v0, n_ops1 - n_ops0; end if;
  raise notice 'OK lot 01 Football : % équipe(s), % côté(s) domicile + % côté(s) visiteur reliés, 1 ligne admin_operations',
    n_ins, n_h, n_v;
end $$;
