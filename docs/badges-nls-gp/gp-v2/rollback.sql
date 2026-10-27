-- ════════════════════════════════════════════════════════════════════════════
-- Badges GP v2 — ROLLBACK (sur GO BP) : les 5 lignes GP reviennent aux fichiers v1.
-- Si les v1 ont déjà été retirés du stockage, les redéposer d'abord :
--   televerser-icones.mjs --partenaire <uuid> --fichiers gp-prospect.png,gp-top50.png,gp-top25.png,gp-top10.png,gp-mvp.png --envoyer
--   psql "<connexion>" -X -v nexus_attendu=<uuid Nexus> -f docs/badges-nls-gp/gp-v2/rollback.sql
-- UNE transaction : cible + AVANT → retour (trace BADGES_GP_ICONES_V2_RETOUR) → contrôles → COMMIT.
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
set local application_name = 'nexus-rollback-badges-gp-v2';
select now() as debut, current_database(), current_user,
       set_config('nexus.attendu', :'nexus_attendu', true) as nexus_attendu;

\ir releve-avant.sql
\ir retour.sql

do $$
declare n int;
begin
  if (select md5(coalesce(string_agg(to_jsonb(b)::text, '|' order by b.id), ''))
        from public.partner_badges b where b.id not in (select id from _gp)) is distinct from (select autres_badges from _avant)
     or (select md5(string_agg((to_jsonb(b) - 'icone_path' - 'updated_at')::text, '|' order by b.id))
           from public.partner_badges b where b.id in (select id from _gp)) is distinct from (select gp_hors_icone from _avant)
     or (select md5(coalesce(string_agg(to_jsonb(x)::text, '|' order by x.id), '')) from public.partner_athlete_badges x) is distinct from (select poses from _avant) then
    raise exception 'NEXUS: un autre badge, une ligne GP hors icône, ou une pose a bougé';
  end if;
  select count(*) into n from public.partner_badges b
   where b.id in (select id from _gp)
     and b.icone_path = current_setting('nexus.attendu') || '/gp-' || replace(lower(split_part(b.libelle, U&' \00B7 ', 2)), ' ', '') || '.png';
  if n <> 5 then
    raise exception 'NEXUS: % ligne(s) GP revenue(s) au fichier v1, attendu 5', n;
  end if;
  if (select count(*) from public.admin_operations) <> (select nb_ops from _avant) + 1 then
    raise exception 'NEXUS: admin_operations : attendu exactement 1 ligne de plus';
  end if;
end $$;

select b.libelle, b.icone_path from public.partner_badges b where b.id in (select id from _gp) order by b.ordre;
commit;
\echo '== COMMIT fait : les 5 badges GP pointent de nouveau sur les fichiers v1.'
