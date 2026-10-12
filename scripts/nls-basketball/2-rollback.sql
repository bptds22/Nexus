-- ============================================================================
-- NLS Premier League (No Limits Showcases) — basketball, saison 2026-2027 — ROLLBACK
-- Généré par scripts/plan-nls-basketball-teams.mjs depuis data/nls/NLS_S02_equipes.csv.
-- TEXTE À RELIRE — NE PAS APPLIQUER EN PROD SANS LE GO DE BP.
-- ============================================================================
-- Retire les équipes NLS et les clubs que 1-creer.sql a écrits, d'après le
-- journal (admin_operations NLS_EQUIPES_CREEES, moins ce qu'un rollback
-- précédent a déjà retiré). Gardé : les équipes NLS en base sont EXACTEMENT
-- celles du journal (107) ; aucune n'a reçu de dépendant (athlète, coach,
-- invitation, page, fanion, événement, besoin, jeton, carte prospect, équipe
-- principale, revendication, match) ; aucun club créé n'a reçu autre chose que
-- ses équipes NLS. Sinon RIEN.
do $$
declare
  v_bp uuid; n_eq int; n_journal int; n_del int; n_clubs int; n_ops0 int; n_ops1 int;
begin
  select id into v_bp from public.users where email = 'bptds22@gmail.com';
  drop table if exists _nls_j_eq; drop table if exists _nls_j_clubs; drop table if exists _nls_eq;

  create temp table _nls_j_eq on commit drop as
    select (e->>'id')::uuid as id from public.admin_operations o, jsonb_array_elements(o.details->'equipes') e
     where o.operation = 'NLS_EQUIPES_CREEES'
    except
    select (e->>'id')::uuid from public.admin_operations o, jsonb_array_elements(o.details->'equipes') e
     where o.operation = 'NLS_EQUIPES_RETIREES';
  create temp table _nls_j_clubs on commit drop as
    select (e->>'id')::uuid as id from public.admin_operations o, jsonb_array_elements(o.details->'clubs_crees') e
     where o.operation = 'NLS_EQUIPES_CREEES'
    except
    select (e->>'id')::uuid from public.admin_operations o, jsonb_array_elements(o.details->'clubs_crees') e
     where o.operation = 'NLS_EQUIPES_RETIREES';
  create temp table _nls_eq on commit drop as
    select id from public.teams
     where league = 'No Limits Showcases' and season = '2026-2027' and sport_id = '5dd6a7c8-2aa4-4b0e-a150-4ac77255f492';

  select count(*) into n_eq from _nls_eq;
  select count(*) into n_journal from _nls_j_eq;
  if n_eq <> 107 or n_journal <> 107
     or exists (select id from _nls_eq except select id from _nls_j_eq) then
    raise exception 'NEXUS: % équipe(s) NLS en base, % au journal, attendu 107 et les mêmes — rollback refusé', n_eq, n_journal; end if;

  if exists (select 1 from public.team_athletes x join _nls_eq e on e.id = x.team_id)
     or exists (select 1 from public.team_coaches x join _nls_eq e on e.id = x.team_id)
     or exists (select 1 from public.team_invitations x join _nls_eq e on e.id = x.team_id)
     or exists (select 1 from public.team_page_content x join _nls_eq e on e.id = x.team_id)
     or exists (select 1 from public.team_pennants x join _nls_eq e on e.id = x.team_id)
     or exists (select 1 from public.team_events x join _nls_eq e on e.id = x.team_id)
     or exists (select 1 from public.team_position_needs x join _nls_eq e on e.id = x.team_id)
     or exists (select 1 from public.team_join_tokens x join _nls_eq e on e.id = x.team_id)
     or exists (select 1 from public.cartes_prospect x join _nls_eq e on e.id = x.team_id)
     or exists (select 1 from public.users x join _nls_eq e on e.id = x.primary_team_id)
     or exists (select 1 from public.ambassadeur_revendications x join _nls_eq e on e.id = x.team_id)
     or exists (select 1 from public.games g join _nls_eq e on e.id in (g.home_team_id, g.visitor_team_id)) then
    raise exception 'NEXUS: une équipe NLS a reçu un dépendant — rollback refusé, à trancher par BP'; end if;

  if exists (select 1 from public.teams t join _nls_j_clubs c on c.id = t.school_id where t.id not in (select id from _nls_eq))
     or exists (select 1 from public.athletes a join _nls_j_clubs c on c.id = a.school_id)
     or exists (select 1 from public.users u join _nls_j_clubs c on c.id = u.school_id)
     or exists (select 1 from public.school_coaches x join _nls_j_clubs c on c.id = x.school_id)
     or exists (select 1 from public.invitations x join _nls_j_clubs c on c.id = x.school_id) then
    raise exception 'NEXUS: un club créé par l''import a reçu autre chose que ses équipes NLS — rollback refusé'; end if;

  select count(*) into n_ops0 from public.admin_operations;
  delete from public.teams t using _nls_eq e where t.id = e.id;
  get diagnostics n_del = row_count;
  delete from public.schools s using _nls_j_clubs c where s.id = c.id;
  get diagnostics n_clubs = row_count;

  insert into public.admin_operations (operation, motif, details, par)
  values ('NLS_EQUIPES_RETIREES', 'Rollback de l''import NLS Premier League S02 (basketball 2026-2027)',
          jsonb_build_object('ligue', 'No Limits Showcases', 'saison', '2026-2027',
            'equipes', (select coalesce(jsonb_agg(jsonb_build_object('id', id)), '[]') from _nls_eq),
            'clubs_crees', (select coalesce(jsonb_agg(jsonb_build_object('id', id)), '[]') from _nls_j_clubs)),
          v_bp);
  select count(*) into n_ops1 from public.admin_operations;
  if n_del <> 107 or n_clubs <> (select count(*) from _nls_j_clubs) or n_ops1 - n_ops0 <> 1 then
    raise exception 'NEXUS: garde échouée (équipes %, clubs %, journal +%) — rien écrit', n_del, n_clubs, n_ops1 - n_ops0; end if;
  raise notice 'NLS rollback : % équipe(s) et % club(s) retiré(s)', n_del, n_clubs;
end $$;
