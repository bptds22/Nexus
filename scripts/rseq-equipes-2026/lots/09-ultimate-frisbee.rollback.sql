-- Lot 09 — Ultimate frisbee : 7 équipe(s) RSEQ 2026 (secondaire), 60 côté(s) de match à relier (relevé prod du 2026-10-08).
-- Généré par scripts/rseq-equipes-2026/generer-lots.mjs. Règles : CLAUDE.md § « Pont RSEQ ».
-- ROLLBACK du lot : remet à NULL les côtés de match reliés aux équipes du lot, puis supprime ces équipes.
-- Gardé : exactement 7 équipe(s) du lot en base, aucune n'a reçu de dépendant (athlète, coach, invitation,
-- page, fanion, événement, besoin, jeton, carte prospect, équipe principale, revendication), sinon RIEN.
do $$
declare
  v_bp uuid; n_attendu constant int := 7;
  n_eq int; n_h int; n_v int; n_del int; n_ops0 int; n_ops1 int;
begin
  select id into strict v_bp from public.users where email = 'bptds22@gmail.com';
  create temp table _lot (rseq_team_id uuid primary key) on commit drop;
  insert into _lot values ('43f5bb6f-eacd-4eae-841d-cf66afe5b97f'::uuid), ('4c31c836-460c-4d95-978e-7cab43ae34fa'::uuid), ('944c79f8-27bc-4c1a-be1b-d167554f88f8'::uuid), ('b24069cd-e8df-497c-bd63-f8c544421a87'::uuid), ('d9af89c8-f758-4c72-840b-590b13770c6a'::uuid), ('dcaf3e35-713e-4b00-abd5-b50bc371c336'::uuid), ('eb5300a0-a2ad-4fb6-8d8c-d23a3ac96d83'::uuid);
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
  values ('EQUIPES_RSEQ_2026_RETIREES', 'Rollback du lot 09 Ultimate frisbee (équipes RSEQ 2026 créées par l''audit)',
          jsonb_build_object('lot', '09-ultimate-frisbee', 'equipes', n_del, 'cotes_domicile', n_h, 'cotes_visiteur', n_v), v_bp);
  select count(*) into n_ops1 from public.admin_operations;
  if n_del <> n_attendu or n_ops1 - n_ops0 <> 1 then
    raise exception 'NEXUS: garde échouée (supprimées %, ops +%) — rien écrit', n_del, n_ops1 - n_ops0; end if;
  raise notice 'OK rollback lot 09 Ultimate frisbee : % équipe(s) supprimée(s), % + % côté(s) remis à NULL', n_del, n_h, n_v;
end $$;
