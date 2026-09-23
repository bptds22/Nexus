-- ═══════════════════════════════════════════════════════════════════════════
-- cibles-lot1-preuve-par-role.sql — athletes_targeting_my_cegep(), par rôle
--
-- TOUT DOIT PASSER. Le script est bruyant par conception : il imprime le
-- « sol » (l'état réel de la table, lu sous postgres) avant de montrer ce
-- que chaque rôle en voit. Comparer les deux est le seul moyen de
-- distinguer « la garde a fermé » de « il n'y avait rien à voir ».
--
-- PRÉALABLE : la migration 20260922171500 appliquée, puis
--             scripts/cibles-lot1-fixtures-locales.sql exécuté.
--
-- À REJOUER AVEC (outil PowerShell) :
--   docker cp scripts/cibles-lot1-preuve-par-role.sql supabase_db_Nexus:/tmp/p.sql
--   docker exec -e PGCLIENTENCODING=UTF8 supabase_db_Nexus \
--     psql -U postgres -d postgres -f /tmp/p.sql
--
-- CE QUI EST ATTENDU, BLOC PAR BLOC
--   A. recruteur AVEC cégep ....... n ≥ 1, et 0 athlète non-ACTIF
--   B. recruteur SANS cégep ....... 0 ligne, et AUCUNE exception levée
--   C. coach ...................... 0, alors que son école porte 1 cible
--   D. athlète .................... 0
--   E. anon ....................... refus À L'EXÉCUTION (ACL, pas RLS)
--   F. lecture DIRECTE de la table par le recruteur ... 0
--
-- PORTÉE — à savoir avant de s'en servir comme d'une garantie :
-- `SET ROLE` + `request.jwt.claims` fait résoudre `auth.uid()` exactement
-- comme en requête réelle, donc la fonction, ses gardes et son ACL sont
-- bien exercées. Ce qui n'est PAS couvert ici : la chaîne HTTP PostgREST
-- (en-têtes, exposition du schéma, jeton expiré). Résultat attendu de
-- l'exécution du 2026-09-22 : A=1/0, B=0, C=0, D=0, E=refus, F=0.
-- ═══════════════════════════════════════════════════════════════════════════
\pset pager off
\echo '=================================================================='
\echo 'ETAT DE DEPART (sous postgres, RLS contournee) — la verite du sol'
\echo '=================================================================='
select s.name as ecole, s.type, a.status as statut_athlete, count(*) as cibles
  from public.athlete_targets t
  join public.schools  s on s.id = t.school_id
  join public.athletes a on a.id = t.athlete_id
 where s.id::text like '11111111%'
 group by 1,2,3 order by 1,3;

\echo ''
\echo '=================================================================='
\echo 'A. RECRUTEUR AVEC CEGEP — attendu: n>=1, AUCUN athlete non-ACTIF'
\echo '=================================================================='
begin;
  set local role authenticated;
  select set_config('request.jwt.claims',
    '{"sub":"22222222-0000-0000-0000-00000000000a","role":"authenticated"}', true);
  select 'auth.uid() vu par la base = ' || coalesce(auth.uid()::text,'NULL') as controle;
  select r.athlete_id, a.first_name, a.status, r.targeted_at
    from public.athletes_targeting_my_cegep() r
    join public.athletes a on a.id = r.athlete_id;
  select 'A1 lignes rendues = ' || count(*)::text as resultat
    from public.athletes_targeting_my_cegep();
  select 'A2 lignes NON-ACTIF rendues (doit etre 0) = ' || count(*)::text as resultat
    from public.athletes_targeting_my_cegep() r
    join public.athletes a on a.id = r.athlete_id
   where a.status <> 'ACTIF';
commit;

\echo ''
\echo '=================================================================='
\echo 'B. RECRUTEUR SANS CEGEP — attendu: 0 ligne, AUCUNE exception'
\echo '=================================================================='
begin;
  set local role authenticated;
  select set_config('request.jwt.claims',
    '{"sub":"22222222-0000-0000-0000-00000000000b","role":"authenticated"}', true);
  select 'B lignes rendues = ' || count(*)::text
      || '  (appel revenu sans erreur : la preuve que ca ne leve pas)' as resultat
    from public.athletes_targeting_my_cegep();
commit;

\echo ''
\echo '=================================================================='
\echo 'C. COACH — attendu: 0. Son ecole SECONDAIRE porte 1 cible :'
\echo '   sans la garde role=RECRUTEUR il en recupererait 1.'
\echo '=================================================================='
begin;
  set local role authenticated;
  select set_config('request.jwt.claims',
    '{"sub":"22222222-0000-0000-0000-00000000000c","role":"authenticated"}', true);
  select 'C lignes rendues = ' || count(*)::text as resultat
    from public.athletes_targeting_my_cegep();
commit;

\echo ''
\echo '=================================================================='
\echo 'D. ATHLETE — attendu: 0'
\echo '=================================================================='
begin;
  set local role authenticated;
  select set_config('request.jwt.claims',
    '{"sub":"22222222-0000-0000-0000-00000000000d","role":"authenticated"}', true);
  select 'D lignes rendues = ' || count(*)::text as resultat
    from public.athletes_targeting_my_cegep();
commit;

\echo ''
\echo '=================================================================='
\echo 'E. ANON — attendu: REFUS A L EXECUTION (permission denied)'
\echo '=================================================================='
begin;
  set local role anon;
  do $$
  begin
    perform * from public.athletes_targeting_my_cegep();
    raise exception 'ECHEC DE LA PREUVE: anon a pu EXECUTER la fonction';
  exception
    when insufficient_privilege then
      raise notice 'E OK — anon refuse: %', sqlerrm;
    when others then
      raise exception 'E INATTENDU (% ) : %', sqlstate, sqlerrm;
  end
  $$;
commit;

\echo ''
\echo '=================================================================='
\echo 'F. LECTURE DIRECTE DE LA TABLE PAR LE RECRUTEUR — attendu: 0'
\echo '   (la RPC est le SEUL chemin ; la policy athlete reste la seule)'
\echo '=================================================================='
begin;
  set local role authenticated;
  select set_config('request.jwt.claims',
    '{"sub":"22222222-0000-0000-0000-00000000000a","role":"authenticated"}', true);
  select 'F lignes lues en direct = ' || count(*)::text as resultat
    from public.athlete_targets;
commit;
