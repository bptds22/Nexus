-- ════════════════════════════════════════════════════════════════════════════
-- Badges GP v2 — APPLY RÉEL (GO BP après le rejeu à blanc). SANS -1.
--   psql "<connexion>" -X -v nexus_attendu=<uuid Nexus> -f docs/badges-nls-gp/gp-v2/apply.sql
-- Prod : nexus_attendu = f3751302-cdce-44a6-ac0d-bf4802968637.
-- UNE transaction : cible + AVANT → mise à jour (trace BADGES_GP_ICONES_V2) → contrôles → COMMIT.
-- Ensuite seulement : retirer les 5 anciens fichiers
--   (televerser-icones.mjs --fichiers gp-prospect.png,gp-top50.png,gp-top25.png,gp-top10.png,gp-mvp.png --retirer).
-- Rollback : gp-v2/rollback.sql (après avoir redéposé les v1 s'ils ont été retirés).
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
set local application_name = 'nexus-apply-badges-gp-v2';
select now() as debut, current_database(), current_user,
       set_config('nexus.attendu', :'nexus_attendu', true) as nexus_attendu;

\ir releve-avant.sql
\ir operation.sql
\ir controles-apres.sql

select operation, le, details->'changements' as changements from public.admin_operations where operation = 'BADGES_GP_ICONES_V2';
select clock_timestamp() as avant_commit;
commit;
\echo '== COMMIT fait : les 5 badges GP pointent sur les fichiers v2.'
