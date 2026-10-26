-- ════════════════════════════════════════════════════════════════════════════
-- Chantier cégep — ROLLBACK RÉEL EN PROD des 12 équipes RSEQ de cégep. À lancer SEULEMENT sur GO BP.
-- Fichier GÉNÉRÉ par scripts/cegep-equipes-12/generer.sh <date> rollback : le rollback (retirer.sql) y
-- est embarqué tel quel (LF, même texte que celui du rejeu, md5 gardé).
--
-- UNE transaction : gardes AVANT (les 12 sont là) → rollback (par la liste des 12 rseq_team_id ; il
-- refuse si une équipe a reçu un dépendant ; côtés de match, classements et alertes remis à NULL ;
-- équipes supprimées ; alertes rouvertes ; admin_operations CEGEP_EQUIPES_RSEQ_12_RETIREES) → gardes
-- APRÈS → COMMIT. Aucun match supprimé. Lancer SANS -1.
-- ════════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP 1
\pset pager off
\pset null '·'

begin;
set local lock_timeout = '3s';
set local statement_timeout = '120s';
set local search_path = public, extensions;
set local application_name = 'nexus-rollback-cegep-12';
select now() as debut, current_user;

-- ── 0. Gardes AVANT ──────────────────────────────────────────────────────────
do $$
begin
  if extract(isodow from now() at time zone 'America/Toronto') = 2
     or (extract(isodow from now() at time zone 'America/Toronto') = 3
         and extract(hour from now() at time zone 'America/Toronto') < 12) then
    raise exception 'NEXUS: pas de prod le mardi, ni le mercredi matin';
  end if;
  if (select count(*) from public.admin_operations where operation = 'CEGEP_EQUIPES_RSEQ_12') <> 1 then
    raise exception 'NEXUS: les 12 ne sont pas inscrites — rien à défaire';
  end if;
  if exists (select 1 from public.admin_operations where operation = 'CEGEP_EQUIPES_RSEQ_12_RETIREES') then
    raise exception 'NEXUS: les 12 ont déjà été retirées';
  end if;
end $$;

create temp table _ids on commit drop as
select jsonb_array_elements_text(details->'team_ids')::uuid as id
  from public.admin_operations where operation = 'CEGEP_EQUIPES_RSEQ_12';
create temp table _avant on commit drop as
select (select md5(string_agg(to_jsonb(t)::text, '|' order by t.id)) from public.teams t where t.id not in (select id from _ids)) as equipes_hors,
       (select md5(string_agg((to_jsonb(g) - 'home_team_id' - 'visitor_team_id')::text, '|' order by g.id)) from public.games g) as matchs_sans_liaison,
       (select md5(coalesce(string_agg(to_jsonb(a)::text, '|' order by a.id), '')) from public.athletes a) as athletes,
       (select count(*) from public.teams where id in (select id from _ids)) as presentes;
select presentes from _avant;

-- ── 1. Le rollback, texte gardé par son md5 ─────────────────────────────────
create temp table _rb on commit drop as select $nexus_rb$-- ════════════════════════════════════════════════════════════════════════════
-- ROLLBACK des 12 équipes RSEQ de cégep (scripts/cegep-equipes-12/creer.sql), par la LISTE des 12
-- rseq_team_id (relevé prod 2026-10-26, empreinte 8836addd…).
-- Refuse si une des 12 a reçu un dépendant (athlète, coach, page, fanion, événement, besoin de position,
-- jeton, invitation, carte prospect, prospect partenaire, revendication d'ambassadeur, équipe principale
-- d'un compte). Sinon : remet à NULL les côtés de match, rseq_standings.team_id et rseq_sync_alerts.team_id
-- qui pointent ces équipes (aucun match supprimé), supprime les 12 équipes, rouvre les 12 alertes dans
-- leur état d'avant (OUVERTE, sans note ni traitement), écrit admin_operations CEGEP_EQUIPES_RSEQ_12_RETIREES.
-- ════════════════════════════════════════════════════════════════════════════

do $$
declare
  v_rids uuid[] := array[
    '028950e6-34ca-4f08-b8b5-7337529be45c',
    '2a991ddd-1782-4bbb-993e-d16c67db5e84',
    '68599a7b-b6d7-4b1b-bce7-caa55600af22',
    '73e3a35a-e00a-41d9-828a-ac7ef5ac7214',
    '8c0749c7-13a0-4d3a-928a-cba989ca65ec',
    '8d15b218-9005-4513-b2d8-17a5ed4fbd71',
    '931b39c9-12d8-4df9-8072-01ace9ee1ce5',
    '9f7f1bf2-11a8-4a56-ab47-6561f199989d',
    'b7c0e77d-76f5-401e-a3ea-beacbf8d27a8',
    'b96f844d-43a5-4854-8bb8-f08ebb6fd830',
    'ca0983e7-85d6-4d8b-9684-89eef3418a9a',
    'f4c5f91f-2ae4-4b71-a90d-52f160af3ef4'
  ]::uuid[];
  v_teams uuid[]; n int; nh int; nv int; ns int; na int;
begin
  if cardinality(v_rids) <> 12
     or md5(array_to_string(array(select x from unnest(v_rids) x order by x), ',')) <> '8836addda230b40f74d227d2af3f0f3b' then
    raise exception 'NEXUS: liste des 12 altérée';
  end if;
  select array_agg(id order by id) into v_teams from public.teams where rseq_team_id = any(v_rids);
  if coalesce(cardinality(v_teams), 0) <> 12 then
    raise exception 'NEXUS: % des 12 équipes en base, attendu 12 — rien écrit', coalesce(cardinality(v_teams), 0);
  end if;

  if exists (select 1 from public.team_athletes where team_id = any(v_teams))
     or exists (select 1 from public.team_coaches where team_id = any(v_teams))
     or exists (select 1 from public.team_events where team_id = any(v_teams))
     or exists (select 1 from public.team_invitations where team_id = any(v_teams))
     or exists (select 1 from public.team_join_tokens where team_id = any(v_teams))
     or exists (select 1 from public.team_page_content where team_id = any(v_teams))
     or exists (select 1 from public.team_pennants where team_id = any(v_teams))
     or exists (select 1 from public.team_position_needs where team_id = any(v_teams))
     or exists (select 1 from public.cartes_prospect where team_id = any(v_teams))
     or exists (select 1 from public.partenaire_prospects where team_id = any(v_teams))
     or exists (select 1 from public.ambassadeur_revendications where team_id = any(v_teams))
     or exists (select 1 from public.users where primary_team_id = any(v_teams)) then
    raise exception 'NEXUS: une des 12 équipes a reçu un dépendant — rollback refusé, rien écrit';
  end if;

  update public.games set home_team_id = null where home_team_id = any(v_teams);
  get diagnostics nh = row_count;
  update public.games set visitor_team_id = null where visitor_team_id = any(v_teams);
  get diagnostics nv = row_count;
  update public.rseq_standings set team_id = null where team_id = any(v_teams);
  get diagnostics ns = row_count;
  update public.rseq_sync_alerts set team_id = null where team_id = any(v_teams);

  delete from public.teams where id = any(v_teams);
  get diagnostics n = row_count;
  if n <> 12 then raise exception 'NEXUS: % équipe(s) supprimée(s), attendu 12 — rien écrit', n; end if;

  update public.rseq_sync_alerts
     set statut = 'OUVERTE', traite_le = null, traite_par = null, note = null
   where type = 'NOUVELLE_EQUIPE' and statut = 'TRAITEE' and rseq_team_id = any(v_rids);
  get diagnostics na = row_count;
  if na <> 12 then raise exception 'NEXUS: % alerte(s) rouverte(s), attendu 12 — rien écrit', na; end if;

  insert into public.admin_operations (operation, motif, details, par)
  values ('CEGEP_EQUIPES_RSEQ_12_RETIREES', 'Rollback des 12 équipes RSEQ de cégep',
          jsonb_build_object('equipes', n, 'cotes_domicile', nh, 'cotes_visiteur', nv, 'classements', ns,
                             'alertes_rouvertes', na, 'empreinte_rseq_team_ids', '8836addda230b40f74d227d2af3f0f3b'),
          'f51384b5-a2c2-4827-9137-8aa8d29a1fe0');
end $$;
$nexus_rb$::text as contenu;
do $rb$
begin
  if (select md5(contenu) from _rb) <> 'fb7ea44ee907a948ceeee1dbccdc537b' then
    raise exception 'NEXUS: texte du rollback altéré (md5 %)', (select md5(contenu) from _rb);
  end if;
  execute (select contenu from _rb);
end $rb$;

-- ── 2. Gardes APRÈS ──────────────────────────────────────────────────────────
do $$
begin
  if exists (select 1 from public.teams where id in (select id from _ids)) then
    raise exception 'NEXUS: une des 12 équipes reste en base';
  end if;
  if exists (select 1 from public.games where home_team_id in (select id from _ids) or visitor_team_id in (select id from _ids)) then
    raise exception 'NEXUS: un côté de match pointe encore une des 12';
  end if;
  if (select md5(string_agg(to_jsonb(t)::text, '|' order by t.id)) from public.teams t) is distinct from (select equipes_hors from _avant) then
    raise exception 'NEXUS: une autre équipe a changé';
  end if;
  if (select md5(string_agg((to_jsonb(g) - 'home_team_id' - 'visitor_team_id')::text, '|' order by g.id)) from public.games g)
     is distinct from (select matchs_sans_liaison from _avant) then
    raise exception 'NEXUS: un match a changé ailleurs que dans ses liaisons';
  end if;
  if (select md5(coalesce(string_agg(to_jsonb(a)::text, '|' order by a.id), '')) from public.athletes a) is distinct from (select athletes from _avant) then
    raise exception 'NEXUS: les athlètes ont bougé';
  end if;
  if (select count(*) from public.admin_operations where operation = 'CEGEP_EQUIPES_RSEQ_12_RETIREES') <> 1 then
    raise exception 'NEXUS: ligne admin_operations CEGEP_EQUIPES_RSEQ_12_RETIREES absente';
  end if;
end $$;

select (select count(*) from public.rseq_sync_alerts where type = 'NOUVELLE_EQUIPE' and statut = 'OUVERTE') as alertes_ouvertes,
       clock_timestamp() as avant_commit;
commit;
\echo '== COMMIT fait : les 12 équipes cégep sont retirées de la prod.'
