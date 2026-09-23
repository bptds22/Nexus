-- ═══════════════════════════════════════════════════════════════════════════
-- cibles-lot1-sabotage-gate-acl.sql — prouver que le gate d'ACL MORD
--
-- UN GATE QUI PASSE TOUJOURS NE PROUVE RIEN. Celui de la migration
-- 20260922171500 n'a de valeur que si on l'a vu LEVER. Ce script casse
-- volontairement l'ACL, dans les DEUX sens, et exige une exception à
-- chaque fois — puis restaure l'état sain.
--
-- 🔴 DOCKER LOCAL UNIQUEMENT : il modifie des GRANT.
--
-- À REJOUER AVEC (outil PowerShell) :
--   docker cp scripts/cibles-lot1-sabotage-gate-acl.sql supabase_db_Nexus:/tmp/s.sql
--   docker exec -e PGCLIENTENCODING=UTF8 supabase_db_Nexus \
--     psql -U postgres -d postgres -f /tmp/s.sql
--
-- POURQUOI DEUX SABOTAGES ET PAS UN
--   A. on AJOUTE `anon` — le cas exact du 2026-09-07 sur
--      recruiter_search_athletes, où un DROP/CREATE avait laissé les
--      default privileges de Supabase reposer EXECUTE pour anon, et où le
--      gate d'alors, vérifiant par INCLUSION, n'avait rien vu ;
--   B. on RETIRE `authenticated` — le sens inverse, qu'une vérification
--      « aucun rôle en trop » manquerait tout autant.
-- Un gate qui ne lève pas sur A ET sur B n'est pas une comparaison
-- intégrale, quoi qu'en dise son commentaire.
--
-- Résultat attendu (exécution du 2026-09-22) : PASSE / LÈVE / LÈVE / PASSE.
-- ═══════════════════════════════════════════════════════════════════════════
\pset pager off
-- Le gate de la migration, isolé dans une fonction pour être rejoué tel quel.
-- Corps IDENTIQUE au bloc DO de 20260922171500 — si on le modifie ici, on ne
-- prouve plus rien sur la migration.
create or replace function pg_temp.rejouer_gate() returns text
language plpgsql as $g$
declare
  f    oid;
  vus  text[];
  veut text[] := array['authenticated','postgres','service_role'];
begin
  select p.oid into f
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'athletes_targeting_my_cegep'
     and pg_get_function_identity_arguments(p.oid) = '';
  if f is null then raise exception 'NEXUS: athletes_targeting_my_cegep() introuvable après CREATE'; end if;

  select array_agg(t.g order by t.g) into vus
    from pg_proc pr,
         lateral (select coalesce(nullif(split_part(x,'=',1),''),'PUBLIC') as g
                    from unnest(pr.proacl::text[]) as x) t
   where pr.oid = f;

  if vus is distinct from veut then
    raise exception 'NEXUS: ACL = %, attendu %', vus, veut;
  end if;
  return 'GATE PASSE (ACL = ' || vus::text || ')';
end $g$;

\echo '--- 0. ETAT SAIN : le gate doit PASSER -------------------------------'
select pg_temp.rejouer_gate();

\echo ''
\echo '--- 1. SABOTAGE A : on rajoute anon (le cas du 2026-09-07) -----------'
grant execute on function public.athletes_targeting_my_cegep() to anon;
do $$ begin
  perform pg_temp.rejouer_gate();
  raise exception 'ECHEC DE LA PREUVE: le gate a LAISSE PASSER anon';
exception when raise_exception then
  if sqlerrm like 'ECHEC DE LA PREUVE%' then raise; end if;
  raise notice 'SABOTAGE A — gate a bien LEVE: %', sqlerrm;
end $$;
revoke execute on function public.athletes_targeting_my_cegep() from anon;

\echo ''
\echo '--- 2. SABOTAGE B : on RETIRE authenticated (role manquant) ----------'
revoke execute on function public.athletes_targeting_my_cegep() from authenticated;
do $$ begin
  perform pg_temp.rejouer_gate();
  raise exception 'ECHEC DE LA PREUVE: le gate n a pas vu authenticated manquant';
exception when raise_exception then
  if sqlerrm like 'ECHEC DE LA PREUVE%' then raise; end if;
  raise notice 'SABOTAGE B — gate a bien LEVE: %', sqlerrm;
end $$;
grant execute on function public.athletes_targeting_my_cegep() to authenticated;

\echo ''
\echo '--- 3. RETOUR A L ETAT SAIN : le gate doit RE-PASSER ------------------'
select pg_temp.rejouer_gate();
