-- Lot 07 — Baseball : 15 équipe(s) RSEQ 2026 (secondaire), 90 côté(s) de match à relier (relevé prod du 2026-10-08).
-- Généré par scripts/rseq-equipes-2026/generer-lots.mjs. Règles : CLAUDE.md § « Pont RSEQ ».
-- ROLLBACK du lot : remet à NULL les côtés de match reliés aux équipes du lot, puis supprime ces équipes.
-- Gardé : exactement 15 équipe(s) du lot en base, aucune n'a reçu de dépendant (athlète, coach, invitation,
-- page, fanion, événement, besoin, jeton, carte prospect, équipe principale, revendication), sinon RIEN.
do $$
declare
  v_bp uuid; n_attendu constant int := 15;
  n_eq int; n_h int; n_v int; n_del int; n_ops0 int; n_ops1 int;
begin
  select id into strict v_bp from public.users where email = 'bptds22@gmail.com';
  create temp table _lot (rseq_team_id uuid primary key) on commit drop;
  insert into _lot values ('047af42f-bfe6-4ff5-b558-5a6f034665fe'::uuid), ('04c3296e-6b67-4a8a-8bf4-db76fe7b8080'::uuid), ('16f75bb9-5fdd-4ba1-b24e-a312cfb691a2'::uuid), ('1e845758-236e-4669-be4f-ba9a61b915d1'::uuid), ('2c695741-f28d-4a80-b03d-3313d6c88a9e'::uuid), ('5a3a2797-dd01-4c22-a838-ab361571aced'::uuid), ('64c5e9bd-9789-4441-a7c8-c1e880cb21ea'::uuid), ('8281ef6b-29a5-474c-b5e7-6a70b1c8e768'::uuid), ('8d88b52c-3f0c-4ca3-ad17-6b86b3e49836'::uuid), ('ce59066f-0de3-4e57-a0ec-aa755a4c1556'::uuid), ('cee2a792-a44b-43d5-9afa-e5ba2fc63417'::uuid), ('dda1449e-b482-4b31-9cb7-bc64ca613f18'::uuid), ('e51220b4-3b46-4a82-83c8-db4a228a5d55'::uuid), ('edfb006f-90df-41b1-a056-44ff75d9ac56'::uuid), ('fb4ecfd4-2718-4960-9ab8-f59282221048'::uuid);
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
  values ('EQUIPES_RSEQ_2026_RETIREES', 'Rollback du lot 07 Baseball (équipes RSEQ 2026 créées par l''audit)',
          jsonb_build_object('lot', '07-baseball', 'equipes', n_del, 'cotes_domicile', n_h, 'cotes_visiteur', n_v), v_bp);
  select count(*) into n_ops1 from public.admin_operations;
  if n_del <> n_attendu or n_ops1 - n_ops0 <> 1 then
    raise exception 'NEXUS: garde échouée (supprimées %, ops +%) — rien écrit', n_del, n_ops1 - n_ops0; end if;
  raise notice 'OK rollback lot 07 Baseball : % équipe(s) supprimée(s), % + % côté(s) remis à NULL', n_del, n_h, n_v;
end $$;
