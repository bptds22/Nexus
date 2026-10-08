-- Lot 08 — Rugby : 6 équipe(s) RSEQ 2026 (secondaire), 48 côté(s) de match à relier (relevé prod du 2026-10-08).
-- Généré par scripts/rseq-equipes-2026/generer-lots.mjs. Règles : CLAUDE.md § « Pont RSEQ ».
-- ROLLBACK du lot : remet à NULL les côtés de match reliés aux équipes du lot, puis supprime ces équipes.
-- Gardé : exactement 6 équipe(s) du lot en base, aucune n'a reçu de dépendant (athlète, coach, invitation,
-- page, fanion, événement, besoin, jeton, carte prospect, équipe principale, revendication), sinon RIEN.
do $$
declare
  v_bp uuid; n_attendu constant int := 6;
  n_eq int; n_h int; n_v int; n_del int; n_ops0 int; n_ops1 int;
begin
  select id into strict v_bp from public.users where email = 'bptds22@gmail.com';
  create temp table _lot (rseq_team_id uuid primary key) on commit drop;
  insert into _lot values ('0692d466-62e8-45e7-a9ae-b55b977fb871'::uuid), ('23c7f41d-99e8-4cb0-bb16-86c8be93175b'::uuid), ('2d8e0275-6e31-4598-b7bd-66eae3f14fc4'::uuid), ('46e6c761-e8e2-49bc-bfce-5846146816d8'::uuid), ('9aab2b1e-0e61-4e24-a60a-7c312ca02f1f'::uuid), ('dbb3971e-fd75-4ab0-a439-7f2fb0f6d3d6'::uuid);
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
  values ('EQUIPES_RSEQ_2026_RETIREES', 'Rollback du lot 08 Rugby (équipes RSEQ 2026 créées par l''audit)',
          jsonb_build_object('lot', '08-rugby', 'equipes', n_del, 'cotes_domicile', n_h, 'cotes_visiteur', n_v), v_bp);
  select count(*) into n_ops1 from public.admin_operations;
  if n_del <> n_attendu or n_ops1 - n_ops0 <> 1 then
    raise exception 'NEXUS: garde échouée (supprimées %, ops +%) — rien écrit', n_del, n_ops1 - n_ops0; end if;
  raise notice 'OK rollback lot 08 Rugby : % équipe(s) supprimée(s), % + % côté(s) remis à NULL', n_del, n_h, n_v;
end $$;
