-- Lot 01 — Football : 38 équipe(s) RSEQ 2026 (secondaire), 227 côté(s) de match à relier (relevé prod du 2026-10-08).
-- Généré par scripts/rseq-equipes-2026/generer-lots.mjs. Règles : CLAUDE.md § « Pont RSEQ ».
-- ROLLBACK du lot : remet à NULL les côtés de match reliés aux équipes du lot, puis supprime ces équipes.
-- Gardé : exactement 38 équipe(s) du lot en base, aucune n'a reçu de dépendant (athlète, coach, invitation,
-- page, fanion, événement, besoin, jeton, carte prospect, équipe principale, revendication), sinon RIEN.
do $$
declare
  v_bp uuid; n_attendu constant int := 38;
  n_eq int; n_h int; n_v int; n_del int; n_ops0 int; n_ops1 int;
begin
  select id into strict v_bp from public.users where email = 'bptds22@gmail.com';
  create temp table _lot (rseq_team_id uuid primary key) on commit drop;
  insert into _lot values ('007c4209-29af-43c5-842d-0deeb2f274ef'::uuid), ('029ac415-47a9-4f3d-a9c6-221ba66c68c9'::uuid), ('03a25533-413e-4491-8b98-f229f1a80f0d'::uuid), ('05b90bde-7dc6-45f4-a3e2-3dbc6359fc0f'::uuid), ('088b30d5-a053-40be-81a3-fe98f1cb0eea'::uuid), ('105410f3-fdb6-471d-b173-07c73188d37b'::uuid), ('17fc9e9a-9af7-4bd6-8fc3-35802e163aea'::uuid), ('22db5133-1702-487b-87a3-4d105787b9d1'::uuid), ('24d8b54f-cf55-4909-b395-f9280ce0c4c7'::uuid), ('2c1af6b7-37b1-4e4a-8a4a-156022894295'::uuid), ('2ff8c6f8-c892-42ea-a212-4186365b113c'::uuid), ('358b887c-0822-4508-b796-d8ceb50072a5'::uuid), ('35d3acb8-3abd-43e9-8dfb-a915c1eec0e4'::uuid), ('48f658c3-e845-4b7b-bc94-d6eaff9c5e95'::uuid), ('4cd02c22-7bf1-4c0b-b3ea-87e8200bf2f2'::uuid), ('4df979c8-afaf-41c9-922f-d83a79edf615'::uuid), ('56086ee8-99f0-4828-9e0e-832d19b769ca'::uuid), ('656e79d2-69d8-4b7a-97cf-24eebaa78bf8'::uuid), ('7147ef6b-00c0-42f0-9489-9c547b24b3a2'::uuid), ('79ab5d2c-38bc-43fc-87d2-cacc6b40a86e'::uuid), ('7e67a7bb-a0af-4635-972f-bd96706afddb'::uuid), ('7ed76ca6-d854-4446-8478-f2d3db9fcda8'::uuid), ('80de7610-c415-4510-a8a7-558529b48931'::uuid), ('905bc326-4fa1-407a-ac95-9797a4acbfdc'::uuid), ('93be76f6-402d-4a29-8b62-8691b3d57eec'::uuid), ('94002818-bc27-4e2e-b185-e5fb1d0c964e'::uuid), ('94afaa73-eee0-40f4-87cc-f926b51afded'::uuid), ('95f2ba7b-74a8-4ec1-87be-2b7352ca61ee'::uuid), ('a105718b-7536-4ea0-93fd-f599bc89ad63'::uuid), ('a65940be-f881-4cb7-ab66-8744d4702420'::uuid), ('ace11128-ddee-4e14-84a5-f10cb8ba4747'::uuid), ('acf04c14-b482-43b4-a21a-1901f4ce05d2'::uuid), ('bb9da9d3-78d9-4183-a76b-ac804f96c091'::uuid), ('c0a15807-d910-4bc8-a83b-8a97b0cd8457'::uuid), ('d37ae8d9-7b71-49c7-8be6-5edb4428c2d2'::uuid), ('eb1874fe-8ff4-4cba-ad5c-0e0b04be5c6b'::uuid), ('f5e2875b-85dd-4760-86dc-282f4da7791e'::uuid), ('f7725413-16ee-4ebe-9740-76e8c600697d'::uuid);
  create temp table _eq on commit drop as
    select t.id from public.teams t join _lot l using (rseq_team_id) where t.season = '2026-2027';
  select count(*) into n_eq from _eq;
  if n_eq <> n_attendu then raise exception 'NEXUS: % équipe(s) du lot en base, attendu %', n_eq, n_attendu; end if;
  if exists (select 1 from public.team_athletes x join _eq e on e.id = x.team_id)
     or exists (select 1 from public.team_coaches x join _eq e on e.id = x.team_id)
     or exists (select 1 from public.team_invitations x join _eq e on e.id = x.team_id)
     or exists (select 1 from public.team_page_content x join _eq e on e.id = x.team_id)
     or exists (select 1 from public.team_pennants x join _eq e on e.id = x.team_id)
     or exists (select 1 from public.team_events x join _eq e on e.id = x.team_id)
     or exists (select 1 from public.team_position_needs x join _eq e on e.id = x.team_id)
     or exists (select 1 from public.team_join_tokens x join _eq e on e.id = x.team_id)
     or exists (select 1 from public.cartes_prospect x join _eq e on e.id = x.team_id)
     or exists (select 1 from public.users x join _eq e on e.id = x.primary_team_id)
     or exists (select 1 from public.ambassadeur_revendications x join _eq e on e.id = x.team_id) then
    raise exception 'NEXUS: une équipe du lot a reçu un dépendant — rollback refusé, à trancher par BP'; end if;
  select count(*) into n_ops0 from public.admin_operations;

  update public.games g set home_team_id = null from _eq e where g.home_team_id = e.id;
  get diagnostics n_h = row_count;
  update public.games g set visitor_team_id = null from _eq e where g.visitor_team_id = e.id;
  get diagnostics n_v = row_count;
  delete from public.teams t using _eq e where t.id = e.id;
  get diagnostics n_del = row_count;

  insert into public.admin_operations (operation, motif, details, par)
  values ('EQUIPES_RSEQ_2026_RETIREES', 'Rollback du lot 01 Football (équipes RSEQ 2026 créées par l''audit)',
          jsonb_build_object('lot', '01-football', 'equipes', n_del, 'cotes_domicile', n_h, 'cotes_visiteur', n_v), v_bp);
  select count(*) into n_ops1 from public.admin_operations;
  if n_del <> n_attendu or n_ops1 - n_ops0 <> 1 then
    raise exception 'NEXUS: garde échouée (supprimées %, ops +%) — rien écrit', n_del, n_ops1 - n_ops0; end if;
  raise notice 'OK rollback lot 01 Football : % équipe(s) supprimée(s), % + % côté(s) remis à NULL', n_del, n_h, n_v;
end $$;
