-- Banc LOCAL — 20261016040000_coachs_nommables (coachs nommables à l'athlète, règle RSEQ).
-- Une transaction, données fictives, ROLLBACK à la fin : rien ne reste en base.
--   docker cp docs/coachs-nommables/tests-coachs-nommables.sql supabase_db_Nexus:/tmp/t.sql
--   docker exec -e PGCLIENTENCODING=UTF8 supabase_db_Nexus psql -U postgres -d postgres -q -At -f /tmp/t.sql
-- Dernière ligne : « ok | échecs ».
--
-- Données fictives :
--   S1 secondaire, K cégep, L club civil.
--   C1 : coach de S1, n'entraîne que T1 (S1)                → nommable
--   C2 : coach de S1, entraîne T1 ET TC (équipe du cégep K) → JAMAIS nommé (décision BP 2026-10-16)
--   C3 : coach du cégep K, entraîne TC                      → jamais
--   C4 : coach du club L, entraîne TL                       → nommable
--   R5 : recruteur du cégep K, inscrit comme staff de TC    → jamais (pas un coach)
--   A  : athlète qui appelle les fonctions.
begin;

create temp table _r (n serial, nom text, ok boolean, detail text);

create function pg_temp.verifier(p_nom text, p_ok boolean, p_detail text default null) returns void
language sql as $$ insert into _r (nom, ok, detail) values (p_nom, coalesce(p_ok, false), p_detail) $$;

-- Exécute une requête scalaire sous un rôle donné (et un JWT d'athlète si fourni), rend le texte.
create function pg_temp.sous(p_role text, p_uid uuid, p_sql text) returns text
language plpgsql as $$
declare v text;
begin
  perform set_config('request.jwt.claims',
    case when p_uid is null then '' else json_build_object('sub', p_uid, 'role', p_role)::text end, true);
  execute format('set local role %I', p_role);
  execute p_sql into v;
  reset role;
  return v;
exception when others then
  reset role;
  return 'ERREUR: ' || sqlerrm;
end $$;

do $$
declare
  sp uuid := (select id from public.sports where nom = 'Football');
  ids uuid[] := array[
    'b1000000-0000-4000-8000-000000000001', -- C1
    'b1000000-0000-4000-8000-000000000002', -- C2
    'b1000000-0000-4000-8000-000000000003', -- C3
    'b1000000-0000-4000-8000-000000000004', -- C4
    'b1000000-0000-4000-8000-000000000005', -- R5
    'b1000000-0000-4000-8000-000000000006'  -- A
  ]::uuid[];
  roles text[] := array['COACH', 'COACH', 'COACH', 'COACH', 'RECRUTEUR', 'ATHLETE'];
  prenoms text[] := array['Cun', 'Cdeux', 'Ctrois', 'Cquatre', 'Rcinq', 'Ath'];
  ecoles uuid[] := array[
    'c1000000-0000-4000-8000-0000000000a1', 'c1000000-0000-4000-8000-0000000000a1',
    'c1000000-0000-4000-8000-0000000000b2', 'c1000000-0000-4000-8000-0000000000c3',
    'c1000000-0000-4000-8000-0000000000b2', null]::uuid[];
  i int;
begin
  insert into public.schools (id, name, type) values
    ('c1000000-0000-4000-8000-0000000000a1', 'École Banc S1', 'SECONDAIRE'),
    ('c1000000-0000-4000-8000-0000000000b2', 'Cégep Banc K', 'CEGEP'),
    ('c1000000-0000-4000-8000-0000000000c3', 'Club Banc L', 'LIGUE_CIVILE');
  for i in 1..6 loop
    insert into auth.users (id, email, raw_user_meta_data, aud, role)
    values (ids[i], 'banc-cn-' || i || '@exemple.test', jsonb_build_object('role', roles[i]), 'authenticated', 'authenticated');
    insert into public.users (id, email, role, first_name, last_name, school_id)
    values (ids[i], 'banc-cn-' || i || '@exemple.test', roles[i]::public.user_role, prenoms[i], 'Banc', ecoles[i])
    on conflict (id) do update set role = excluded.role, first_name = excluded.first_name,
                                   last_name = excluded.last_name, school_id = excluded.school_id;
  end loop;
  insert into public.teams (id, name, school_id, sport_id) values
    ('d1000000-0000-4000-8000-0000000000a1', 'Banc T1', 'c1000000-0000-4000-8000-0000000000a1', sp),
    ('d1000000-0000-4000-8000-0000000000b2', 'Banc TC', 'c1000000-0000-4000-8000-0000000000b2', sp),
    ('d1000000-0000-4000-8000-0000000000c3', 'Banc TL', 'c1000000-0000-4000-8000-0000000000c3', sp);
  insert into public.team_coaches (team_id, coach_id, role) values
    ('d1000000-0000-4000-8000-0000000000a1', ids[2], 'assistant'),
    ('d1000000-0000-4000-8000-0000000000a1', ids[1], 'head_coach'),
    ('d1000000-0000-4000-8000-0000000000b2', ids[2], 'assistant'),
    ('d1000000-0000-4000-8000-0000000000b2', ids[3], 'head_coach'),
    ('d1000000-0000-4000-8000-0000000000b2', ids[5], 'coordinator'),
    ('d1000000-0000-4000-8000-0000000000c3', ids[4], 'head_coach');
  insert into public.team_join_tokens (team_id, code, created_by, revoked_at) values
    ('d1000000-0000-4000-8000-0000000000a1', 'BNCAAA22', ids[1], null),
    ('d1000000-0000-4000-8000-0000000000b2', 'BNCBBB22', ids[3], null),
    ('d1000000-0000-4000-8000-0000000000c3', 'BNCCCC22', ids[4], null),
    ('d1000000-0000-4000-8000-0000000000a1', 'BNCDDD22', ids[1], now());
end $$;

-- ── Tests (athlète A connecté) ───────────────────────────────────────────────
\set A '''b1000000-0000-4000-8000-000000000006'''

select pg_temp.verifier('école secondaire : seul C1 (C2 coache aussi au cégep)', v = 'Cun', v)
  from (select pg_temp.sous('authenticated', :A::uuid,
        $q$select string_agg(prenom, ',' order by prenom) from public.coachs_nommables_ecole('c1000000-0000-4000-8000-0000000000a1')$q$) v) x;

select pg_temp.verifier('cégep : aucune liste de coachs', v is null, v)
  from (select pg_temp.sous('authenticated', :A::uuid,
        $q$select string_agg(prenom, ',') from public.coachs_nommables_ecole('c1000000-0000-4000-8000-0000000000b2')$q$) v) x;

select pg_temp.verifier('club civil : C4', v = 'Cquatre', v)
  from (select pg_temp.sous('authenticated', :A::uuid,
        $q$select string_agg(prenom, ',') from public.coachs_nommables_ecole('c1000000-0000-4000-8000-0000000000c3')$q$) v) x;

select pg_temp.verifier('équipe secondaire : C1 seul, avec son rôle', v = 'Cun:head_coach', v)
  from (select pg_temp.sous('authenticated', :A::uuid,
        $q$select string_agg(prenom || ':' || role, ',') from public.coachs_nommables_equipe('d1000000-0000-4000-8000-0000000000a1')$q$) v) x;

select pg_temp.verifier('équipe collégiale : aucun coach (ni C2, ni C3, ni le recruteur)', v is null, v)
  from (select pg_temp.sous('authenticated', :A::uuid,
        $q$select string_agg(prenom, ',') from public.coachs_nommables_equipe('d1000000-0000-4000-8000-0000000000b2')$q$) v) x;

select pg_temp.verifier('équipe civile : C4', v = 'Cquatre:head_coach', v)
  from (select pg_temp.sous('authenticated', :A::uuid,
        $q$select string_agg(prenom || ':' || role, ',') from public.coachs_nommables_equipe('d1000000-0000-4000-8000-0000000000c3')$q$) v) x;

select pg_temp.verifier('aperçu code secondaire : valide, équipe et coachs filtrés (C1 seul)',
       v = 'true|Banc T1|SECONDAIRE|[{"nom": "Banc", "role": "head_coach", "prenom": "Cun", "coach_id": "b1000000-0000-4000-8000-000000000001"}]', v)
  from (select pg_temp.sous('authenticated', :A::uuid,
        $q$select is_valid || '|' || team_name || '|' || school_type || '|' || coachs::text from public.apercu_code_equipe('bncaaa22 ')$q$) v) x;

select pg_temp.verifier('aperçu code collégial : valide, aucun coach', v = 'true|CEGEP|[]', v)
  from (select pg_temp.sous('authenticated', :A::uuid,
        $q$select is_valid || '|' || school_type || '|' || coachs::text from public.apercu_code_equipe('BNCBBB22')$q$) v) x;

select pg_temp.verifier('aperçu code révoqué : non valide, rien de nommé', v = 'false|<null>|[]', v)
  from (select pg_temp.sous('authenticated', :A::uuid,
        $q$select is_valid || '|' || coalesce(team_name, '<null>') || '|' || coachs::text from public.apercu_code_equipe('BNCDDD22')$q$) v) x;

select pg_temp.verifier('aperçu code inconnu : aucune ligne', v = '0', v)
  from (select pg_temp.sous('authenticated', :A::uuid,
        $q$select count(*)::text from public.apercu_code_equipe('ZZZZZZ22')$q$) v) x;

select pg_temp.verifier('aperçu = resolve_team_join_token colonne pour colonne (hors coachs)', v = 'true', v)
  from (select pg_temp.sous('authenticated', :A::uuid,
        $q$select ((select row(team_id, team_name, school_id, school_name, school_logo_url, school_type, sport_name,
                           season, age_group, division, gender, league, is_valid)::text from public.apercu_code_equipe('BNCCCC22'))
                 = (select r::text from public.resolve_team_join_token('BNCCCC22') r))::text$q$) v) x;

-- ── Refus ────────────────────────────────────────────────────────────────────
select pg_temp.verifier('anon : coachs_nommables_ecole refusé', v like 'ERREUR: permission denied%', v)
  from (select pg_temp.sous('anon', null, $q$select count(*)::text from public.coachs_nommables_ecole('c1000000-0000-4000-8000-0000000000a1')$q$) v) x;
select pg_temp.verifier('anon : coachs_nommables_equipe refusé', v like 'ERREUR: permission denied%', v)
  from (select pg_temp.sous('anon', null, $q$select count(*)::text from public.coachs_nommables_equipe('d1000000-0000-4000-8000-0000000000a1')$q$) v) x;
select pg_temp.verifier('anon : apercu_code_equipe refusé', v like 'ERREUR: permission denied%', v)
  from (select pg_temp.sous('anon', null, $q$select count(*)::text from public.apercu_code_equipe('BNCAAA22')$q$) v) x;
select pg_temp.verifier('anon : resolve_team_join_token toujours ouvert (/join), sans coach', v = 'true', v)
  from (select pg_temp.sous('anon', null, $q$select is_valid::text from public.resolve_team_join_token('BNCAAA22')$q$) v) x;
select pg_temp.verifier('authenticated sans JWT (auth.uid() nul) : listes vides', v = '0|0|[]', v)
  from (select pg_temp.sous('authenticated', null,
        $q$select (select count(*) from public.coachs_nommables_ecole('c1000000-0000-4000-8000-0000000000a1')) || '|' ||
                  (select count(*) from public.coachs_nommables_equipe('d1000000-0000-4000-8000-0000000000a1')) || '|' ||
                  (select coachs::text from public.apercu_code_equipe('BNCAAA22'))$q$) v) x;

-- ── Droits exacts (liste complète triée) ─────────────────────────────────────
select pg_temp.verifier('ACL ' || p.proname || ' = {authenticated,postgres,service_role}',
       (select array_agg(g order by g) from (select coalesce(nullif(split_part(a, '=', 1), ''), 'PUBLIC') as g from unnest(p.proacl::text[]) a) t)
         = array['authenticated', 'postgres', 'service_role'],
       p.proacl::text)
  from pg_proc p where p.pronamespace = 'public'::regnamespace
   and p.proname in ('coachs_nommables_ecole', 'coachs_nommables_equipe', 'apercu_code_equipe');
select pg_temp.verifier('trois fonctions présentes', count(*) = 3, count(*)::text)
  from pg_proc where pronamespace = 'public'::regnamespace
   and proname in ('coachs_nommables_ecole', 'coachs_nommables_equipe', 'apercu_code_equipe');
select pg_temp.verifier('coach_nommable reste serveur seulement', (select proacl::text from pg_proc where oid = 'public.coach_nommable(uuid)'::regprocedure)
       not like '%authenticated%' and (select proacl::text from pg_proc where oid = 'public.coach_nommable(uuid)'::regprocedure) not like '%anon%', null);

-- ── Résultat ─────────────────────────────────────────────────────────────────
select n || '|' || case when ok then 'OK' else 'ÉCHEC' end || '|' || nom || coalesce(' — ' || detail, '') from _r order by n;
select count(*) filter (where ok) || '|' || count(*) filter (where not ok) from _r;
rollback;
