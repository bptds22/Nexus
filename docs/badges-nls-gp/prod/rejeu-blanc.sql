-- ════════════════════════════════════════════════════════════════════════════
-- Badges NLS + GP au catalogue « Nexus » — REJEU À BLANC (local ou prod). NE LAISSE RIEN :
-- UNE transaction qui finit par ROLLBACK ; toute erreur arrête psql avant (ON_ERROR_STOP).
--
-- Lancer depuis la racine du dépôt (les \ir sont relatifs à ce fichier) :
--   psql "<connexion>" -X -v nexus_attendu=<uuid du partenaire Nexus> -f docs/badges-nls-gp/prod/rejeu-blanc.sql
-- Prod : nexus_attendu = f3751302-cdce-44a6-ac0d-bf4802968637.
-- Prérequis : les 10 icônes déposées (televerser-icones.mjs --envoyer) — sinon l'ajout s'arrête.
--
-- Déroulé : relevé AVANT → AJOUT (operation.sql) → contrôles → sondes de compte → RETRAIT
-- (retrait.sql) → contrôles → ROLLBACK.
-- psql ne remplace pas ses variables dans un bloc $$…$$ : la cible passe par nexus.attendu.
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
set local statement_timeout = '120s';
set local search_path = public, extensions;
set local application_name = 'nexus-rejeu-blanc-badges-nls-gp';
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

-- ── 3. Contrôles après AJOUT ────────────────────────────────────────────────
\ir controles-apres-ajout.sql

select libelle, ordre, icone_path, actif from public.partner_badges
 where partner_id = :'nexus_attendu'::uuid order by ordre, libelle;

-- ── 4. Sondes sous le rôle des comptes (authenticated + claims), annulées avec le reste ───
-- bpdesfosses : son choix « Attribuer un badge » contient les 10.
select set_config('request.jwt.claims', json_build_object('sub', u.id, 'role', 'authenticated')::text, true) as _claims
  from public.users u where u.email = 'bpdesfosses@gmail.com' \gset
set local role authenticated;
select set_config('nexus.bp_nls', (count(*) filter (where libelle like U&'NLS \00B7 %'))::text, true),
       set_config('nexus.bp_gp',  (count(*) filter (where libelle like U&'GP \00B7 %'))::text, true),
       set_config('nexus.bp_total', count(*)::text, true)
  from public.partenaire_mes_badges() \gset
reset role;

-- Un AUTRE partenaire (le plus ancien approuvé qui n'est pas Nexus) : aucun des 10 dans son choix.
select set_config('request.jwt.claims', json_build_object('sub', mp.user_id, 'role', 'authenticated')::text, true) as _claims
  from public.media_partners mp
 where mp.status = 'APPROVED' and mp.id <> :'nexus_attendu'::uuid
 order by mp.created_at limit 1 \gset
set local role authenticated;
select set_config('nexus.autre_nls_gp',
         (count(*) filter (where libelle like U&'NLS \00B7 %' or libelle like U&'GP \00B7 %'))::text, true)
  from public.partenaire_mes_badges() \gset
reset role;

select current_setting('nexus.bp_nls') as bp_voit_nls, current_setting('nexus.bp_gp') as bp_voit_gp,
       current_setting('nexus.bp_total') as bp_total, current_setting('nexus.autre_nls_gp') as autre_partenaire_voit;
do $$
begin
  if current_setting('nexus.bp_nls') <> '5' or current_setting('nexus.bp_gp') <> '5' then
    raise exception 'NEXUS: bpdesfosses voit % NLS / % GP, attendu 5 / 5', current_setting('nexus.bp_nls'), current_setting('nexus.bp_gp');
  end if;
  if current_setting('nexus.autre_nls_gp') <> '0' then
    raise exception 'NEXUS: un autre partenaire voit % badge(s) NLS/GP', current_setting('nexus.autre_nls_gp');
  end if;
end $$;

-- ── 5. RETRAIT (rollback.sql le refera tel quel) ────────────────────────────
\ir ../retrait.sql

-- ── 6. Contrôles après RETRAIT : tout comme AVANT, sauf les 2 traces ───────
do $$
begin
  if (select md5(coalesce(string_agg(to_jsonb(b)::text, '|' order by b.id), '')) from public.partner_badges b) is distinct from (select catalogue from _avant)
     or (select md5(coalesce(string_agg(to_jsonb(x)::text, '|' order by x.id), '')) from public.partner_athlete_badges x) is distinct from (select poses from _avant)
     or (select md5(coalesce(string_agg(to_jsonb(m)::text, '|' order by m.id), '')) from public.media_partners m) is distinct from (select partenaires from _avant) then
    raise exception 'NEXUS: après retrait, le catalogue, les poses ou les partenaires diffèrent d''AVANT';
  end if;
  if (select details->>'mode' from public.admin_operations where operation = 'BADGES_NLS_GP_NEXUS_RETIRES') <> 'SUPPRESSION' then
    raise exception 'NEXUS: mode de retrait inattendu (aucune pose : SUPPRESSION attendu)';
  end if;
  if (select count(*) from public.admin_operations) <> (select nb_ops from _avant) + 2 then
    raise exception 'NEXUS: admin_operations : attendu 2 traces (ajout + retrait)';
  end if;
end $$;

select 'REJEU OK : ajout, sondes et retrait conformes' as verdict, clock_timestamp() as fin;
rollback;
\echo '== ROLLBACK fait : rien n''est resté.'
