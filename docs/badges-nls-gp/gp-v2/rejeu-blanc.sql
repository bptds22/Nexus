-- ════════════════════════════════════════════════════════════════════════════
-- Badges GP v2 — REJEU À BLANC (local ou prod). NE LAISSE RIEN : UNE transaction, ROLLBACK.
--   psql "<connexion>" -X -v nexus_attendu=<uuid Nexus> -f docs/badges-nls-gp/gp-v2/rejeu-blanc.sql
-- Prod : nexus_attendu = f3751302-cdce-44a6-ac0d-bf4802968637.
-- Prérequis : les 5 « gp-*-v2.png » déposés (televerser-icones.mjs --fichiers … --envoyer).
-- Déroulé : cible + AVANT → mise à jour → contrôles → sonde bpdesfosses → RETOUR → contrôles → ROLLBACK.
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
set local application_name = 'nexus-rejeu-blanc-badges-gp-v2';
select now() as debut, current_database(), current_user,
       set_config('nexus.attendu', :'nexus_attendu', true) as nexus_attendu;

\ir releve-avant.sql
\ir operation.sql
\ir controles-apres.sql

-- Sonde : le choix « Mes badges » de bpdesfosses, sous son rôle.
select set_config('request.jwt.claims', json_build_object('sub', u.id, 'role', 'authenticated')::text, true) as _claims
  from public.users u where u.email = 'bpdesfosses@gmail.com' \gset
set local role authenticated;
select set_config('nexus.gp_v2', (count(*) filter (where icone_path like '%/gp-%-v2.png'))::text, true),
       set_config('nexus.nls_v1', (count(*) filter (where icone_path ~ '/nls-[a-z0-9]+\.png$'))::text, true),
       set_config('nexus.total', count(*)::text, true)
  from public.partenaire_mes_badges() \gset
reset role;
select current_setting('nexus.gp_v2') as bp_gp_en_v2, current_setting('nexus.nls_v1') as bp_nls_inchanges, current_setting('nexus.total') as bp_total;
do $$
begin
  if current_setting('nexus.gp_v2') <> '5' or current_setting('nexus.nls_v1') <> '5' then
    raise exception 'NEXUS: sonde bpdesfosses : % GP en v2 / % NLS inchangés, attendu 5 / 5',
      current_setting('nexus.gp_v2'), current_setting('nexus.nls_v1');
  end if;
end $$;

-- RETOUR (gp-v2/rollback.sql le refera tel quel) : tout redevient comme AVANT, sauf updated_at.
\ir retour.sql
do $$
begin
  if (select md5(coalesce(string_agg(to_jsonb(b)::text, '|' order by b.id), ''))
        from public.partner_badges b where b.id not in (select id from _gp)) is distinct from (select autres_badges from _avant)
     or (select md5(string_agg((to_jsonb(b) - 'updated_at')::text, '|' order by b.id))
           from public.partner_badges b where b.id in (select id from _gp)) is distinct from (select gp_hors_maj from _avant)
     or (select md5(coalesce(string_agg(to_jsonb(x)::text, '|' order by x.id), '')) from public.partner_athlete_badges x) is distinct from (select poses from _avant) then
    raise exception 'NEXUS: après retour, le catalogue ou les poses diffèrent d''AVANT';
  end if;
  if (select count(*) from public.admin_operations) <> (select nb_ops from _avant) + 2 then
    raise exception 'NEXUS: admin_operations : attendu 2 traces (mise à jour + retour)';
  end if;
end $$;

select 'REJEU GP v2 OK : mise à jour, sonde et retour conformes' as verdict, clock_timestamp() as fin;
rollback;
\echo '== ROLLBACK fait : rien n''est resté.'
