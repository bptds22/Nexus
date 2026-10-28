-- ════════════════════════════════════════════════════════════════════════════
-- Badges NLS + GP au catalogue « Nexus » — ROLLBACK (sur GO BP seulement).
--
--   psql "<connexion>" -X -v nexus_attendu=<uuid du partenaire Nexus> -f docs/badges-nls-gp/prod/rollback.sql
-- Prod : nexus_attendu = f3751302-cdce-44a6-ac0d-bf4802968637.
--
-- UNE transaction : cible → relevé AVANT → RETRAIT (retrait.sql : SUPPRESSION si aucun des 10
-- n'a jamais été posé, sinon DÉSACTIVATION — actif = false, poses et traces gardées) →
-- contrôles → COMMIT. Trace : admin_operations BADGES_NLS_GP_NEXUS_RETIRES.
-- Ensuite, en mode SUPPRESSION seulement : televerser-icones.mjs --retirer (les 10 fichiers).
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
set local application_name = 'nexus-rollback-badges-nls-gp';
select now() as debut, current_database(), current_user,
       set_config('nexus.attendu', :'nexus_attendu', true) as nexus_attendu;

do $$
begin
  if (select details->>'partner_id' from public.admin_operations where operation = 'BADGES_NLS_GP_NEXUS')
     is distinct from current_setting('nexus.attendu') then
    raise exception 'NEXUS: la trace BADGES_NLS_GP_NEXUS ne vise pas le partenaire % — mauvaise base ?', current_setting('nexus.attendu');
  end if;
end $$;

-- Relevé AVANT : tout sauf les 10.
create temp table _ids on commit drop as
select jsonb_array_elements_text(details->'badge_ids')::uuid as id
  from public.admin_operations where operation = 'BADGES_NLS_GP_NEXUS';
create temp table _avant on commit drop as
select (select md5(coalesce(string_agg(to_jsonb(b)::text, '|' order by b.id), ''))
          from public.partner_badges b where b.id not in (select id from _ids)) as autres_badges,
       (select md5(coalesce(string_agg(to_jsonb(x)::text, '|' order by x.id), '')) from public.partner_athlete_badges x) as poses,
       (select count(*) from public.admin_operations) as nb_ops;

\ir ../retrait.sql

do $$
declare v_mode text := (select details->>'mode' from public.admin_operations where operation = 'BADGES_NLS_GP_NEXUS_RETIRES');
begin
  if (select md5(coalesce(string_agg(to_jsonb(b)::text, '|' order by b.id), ''))
        from public.partner_badges b where b.id not in (select id from _ids)) is distinct from (select autres_badges from _avant)
     or (select md5(coalesce(string_agg(to_jsonb(x)::text, '|' order by x.id), '')) from public.partner_athlete_badges x)
        is distinct from (select poses from _avant) then
    raise exception 'NEXUS: un autre badge ou une pose a bougé';
  end if;
  if v_mode = 'SUPPRESSION' and exists (select 1 from public.partner_badges where id in (select id from _ids)) then
    raise exception 'NEXUS: SUPPRESSION annoncée mais des lignes restent';
  end if;
  if v_mode = 'DESACTIVATION' and (select count(*) from public.partner_badges where id in (select id from _ids) and not actif) <> 10 then
    raise exception 'NEXUS: DÉSACTIVATION annoncée mais les 10 ne sont pas tous inactifs';
  end if;
  if (select count(*) from public.admin_operations) <> (select nb_ops from _avant) + 1 then
    raise exception 'NEXUS: admin_operations : attendu exactement 1 ligne de plus';
  end if;
end $$;

select operation, details->>'mode' as mode, details->>'poses' as poses from public.admin_operations
 where operation = 'BADGES_NLS_GP_NEXUS_RETIRES';
commit;
\echo '== COMMIT fait : badges NLS + GP retirés du catalogue Nexus (voir le mode ci-dessus).'
