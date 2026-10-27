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
create temp table _rb on commit drop as select $nexus_rb$@@ROLLBACK@@$nexus_rb$::text as contenu;
do $rb$
begin
  if (select md5(contenu) from _rb) <> '@@MD5_ROLLBACK@@' then
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
