-- ════════════════════════════════════════════════════════════════════════════
-- Badges NLS + GP au catalogue « Nexus » — APPLY RÉEL (GO BP après le rejeu à blanc).
--
-- Lancer depuis la racine du dépôt, SANS -1 (le fichier tient sa propre transaction) :
--   psql "<connexion>" -X -v nexus_attendu=<uuid du partenaire Nexus> -f docs/badges-nls-gp/prod/apply.sql
-- Prod : nexus_attendu = f3751302-cdce-44a6-ac0d-bf4802968637.
-- Prérequis : les 10 icônes déposées et vérifiées (televerser-icones.mjs --envoyer, sortie « OK »).
--
-- UNE transaction : cible → relevé AVANT → AJOUT (operation.sql, qui écrit admin_operations
-- BADGES_NLS_GP_NEXUS) → contrôles APRÈS (rien d'autre n'a bougé) → COMMIT. Toute garde qui
-- échoue arrête psql AVANT le COMMIT : rien n'est appliqué.
-- Données seulement : aucune inscription dans schema_migrations.
-- Rollback : docs/badges-nls-gp/prod/rollback.sql (sur GO).
-- ════════════════════════════════════════════════════════════════════════════

\encoding UTF8
\set ON_ERROR_STOP 1
\pset pager off
\pset null '·'

\if :{?nexus_attendu}
\else
  \echo 'ARRÊT : passer -v nexus_attendu=<uuid du partenaire Nexus>'
  \quit
\endif

begin;
set local lock_timeout = '3s';
set local statement_timeout = '60s';
set local search_path = public, extensions;
set local application_name = 'nexus-apply-badges-nls-gp';
select now() as debut, current_database(), current_user, current_setting('server_version') as version,
       set_config('nexus.attendu', :'nexus_attendu', true) as nexus_attendu;

-- ── 0. La cible ─────────────────────────────────────────────────────────────
do $$
declare v uuid;
begin
  select mp.id into v from public.media_partners mp join public.users u on u.id = mp.user_id
   where u.email = 'bpdesfosses@gmail.com';
  if v is distinct from current_setting('nexus.attendu')::uuid then
    raise exception 'NEXUS: partenaire de bpdesfosses = %, attendu % — mauvaise base ?', v, current_setting('nexus.attendu');
  end if;
end $$;

-- ── 1. Relevé AVANT ─────────────────────────────────────────────────────────
create temp table _avant on commit drop as
select (select md5(coalesce(string_agg(to_jsonb(b)::text, '|' order by b.id), '')) from public.partner_badges b) as catalogue,
       (select count(*) from public.partner_badges) as nb_catalogue,
       (select md5(coalesce(string_agg(to_jsonb(x)::text, '|' order by x.id), '')) from public.partner_athlete_badges x) as poses,
       (select md5(coalesce(string_agg(to_jsonb(m)::text, '|' order by m.id), '')) from public.media_partners m) as partenaires,
       (select md5(coalesce(string_agg(o.name || ':' || coalesce(o.metadata->>'size', ''), '|' order by o.name), ''))
          from storage.objects o where o.bucket_id = 'partner-badges') as fichiers,
       (select count(*) from public.admin_operations) as nb_ops;
select nb_catalogue, nb_ops from _avant;

-- ── 2. AJOUT ────────────────────────────────────────────────────────────────
\ir ../operation.sql

-- ── 3. Contrôles APRÈS ──────────────────────────────────────────────────────
\ir controles-apres-ajout.sql

select libelle, ordre, icone_path, actif from public.partner_badges
 where partner_id = :'nexus_attendu'::uuid order by ordre, libelle;
select operation, le, details->'libelles' as libelles from public.admin_operations where operation = 'BADGES_NLS_GP_NEXUS';
select clock_timestamp() as avant_commit;
commit;
\echo '== COMMIT fait : 10 badges NLS + GP au catalogue Nexus.'
