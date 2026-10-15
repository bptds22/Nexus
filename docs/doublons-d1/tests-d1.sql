-- D1 — tests au banc, base LOCALE seulement, dans UNE transaction ANNULÉE à la fin (rien ne reste).
--   docker cp docs/doublons-d1/tests-d1.sql supabase_db_Nexus:/tmp/tests-d1.sql
--   docker exec -e PGCLIENTENCODING=UTF8 supabase_db_Nexus psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f /tmp/tests-d1.sql
-- Comptes de la base locale (aucun n'existe en prod) :
--   coach A  marc.desrosiers@exemple.test (école c0001)   coach B  kevin.nadeau@exemple.test (école c0003)
--   athlète en cours d'inscription  a1.athlete@preuve.local (onboarding non terminé)
--   athlète inscrit                 lea@demo.local (onboarding terminé)

begin;

create temp table t_ids (k text primary key, v uuid);
grant all on t_ids to authenticated;
insert into t_ids
select 'coachA', id from users where email = 'marc.desrosiers@exemple.test' union all
select 'coachB', id from users where email = 'kevin.nadeau@exemple.test' union all
select 'inscr',  id from users where email = 'a1.athlete@preuve.local' union all
select 'lea',    id from users where email = 'lea@demo.local';
do $$ begin
  if (select count(*) from t_ids) <> 4 then raise exception 'BANC: comptes locaux introuvables'; end if;
  if (select onboarding_complete from users where id = (select v from t_ids where k = 'inscr')) then
    raise exception 'BANC: a1.athlete doit être en cours d''inscription';
  end if;
end $$;

create temp table t_res (n int, test text, attendu text, obtenu text);
grant all on t_res to authenticated, anon;

-- Fiches existantes (postgres), toutes mineures (16 ans), sans consentement parental.
insert into athletes (id, first_name, last_name, date_naissance, school_id, coach_id, user_id, email, status, verified, annee_diplomation)
values
  -- E1 : fiche de coach (sans compte), école du coach A
  ('d1000000-0000-4000-8000-000000000001', 'Émile', 'Côté-Roy', '2010-05-10',
   (select school_id from users where id = (select v from t_ids where k = 'coachA')),
   (select v from t_ids where k = 'coachA'), null, 'emile.banc@exemple.test', 'ACTIF', false, 2028),
  -- E2 : mineur d'une AUTRE école, coach B — invisible pour le coach A
  ('d1000000-0000-4000-8000-000000000002', 'Zoé', 'Cachée', '2010-06-01',
   (select school_id from users where id = (select v from t_ids where k = 'coachB')),
   (select v from t_ids where k = 'coachB'), null, null, 'ACTIF', false, 2028),
  -- E3 : fiche AVEC compte (rattachée à lea), autre école
  ('d1000000-0000-4000-8000-000000000003', 'Léo', 'Compte', '2009-01-01',
   (select school_id from users where id = (select v from t_ids where k = 'coachB')),
   null, (select v from t_ids where k = 'lea'), null, 'ACTIF', false, 2027),
  -- E4 : fiche de coach portant le courriel de a1 (elle lui revient déjà : pas un doublon)
  ('d1000000-0000-4000-8000-000000000004', 'Moi', 'Même', '2010-02-02',
   (select school_id from users where id = (select v from t_ids where k = 'coachA')),
   (select v from t_ids where k = 'coachA'), null, 'a1.athlete@preuve.local', 'ACTIF', false, 2028),
  -- E5 : désactivée — ne compte pas
  ('d1000000-0000-4000-8000-000000000005', 'Ancien', 'Desactive', '2010-03-03',
   (select school_id from users where id = (select v from t_ids where k = 'coachA')),
   (select v from t_ids where k = 'coachA'), null, null, 'DESACTIVE', false, 2028);

do $$ begin
  if (select count(*) from doublons_probables) <> 0 then raise exception 'BANC: la file doit être vide après les fiches de départ'; end if;
end $$;

-- ═══ 1. Inscription athlète : inscription_doublon_possible ═══════════════════
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', (select v from t_ids where k = 'inscr'), 'role', 'authenticated')::text, true);

insert into t_res values
 (1,  'même nom (accents, trait d''union, casse) + même date, fiche de coach', 'FICHE_COACH',
      coalesce(inscription_doublon_possible('emile', 'COTE ROY', '2010-05-10'), 'null')),
 (2,  'même nom + même date, fiche avec compte', 'COMPTE',
      coalesce(inscription_doublon_possible('Léo', 'Compte', '2009-01-01'), 'null')),
 (3,  'FAUX POSITIF : même date, noms différents', 'null',
      coalesce(inscription_doublon_possible('Félix', 'Gauthier', '2010-05-10'), 'null')),
 (4,  'même nom, autre date', 'null',
      coalesce(inscription_doublon_possible('Émile', 'Côté-Roy', '2010-05-11'), 'null')),
 (5,  'fiche de coach à SON courriel (déjà à lui)', 'null',
      coalesce(inscription_doublon_possible('Moi', 'Même', '2010-02-02'), 'null')),
 (6,  'fiche DÉSACTIVÉE', 'null',
      coalesce(inscription_doublon_possible('Ancien', 'Desactive', '2010-03-03'), 'null')),
 (7,  'prénom seul (nom vide)', 'null',
      coalesce(inscription_doublon_possible('Émile', '', '2010-05-10'), 'null'));

-- Un athlète déjà inscrit (onboarding terminé) n'obtient jamais de réponse
select set_config('request.jwt.claims', json_build_object('sub', (select v from t_ids where k = 'lea'), 'role', 'authenticated')::text, true);
insert into t_res values (8, 'appel par un athlète déjà inscrit', 'null',
  coalesce(inscription_doublon_possible('Émile', 'Côté-Roy', '2010-05-10'), 'null'));
-- Un coach non plus
select set_config('request.jwt.claims', json_build_object('sub', (select v from t_ids where k = 'coachA'), 'role', 'authenticated')::text, true);
insert into t_res values (9, 'appel par un coach', 'null',
  coalesce(inscription_doublon_possible('Émile', 'Côté-Roy', '2010-05-10'), 'null'));

-- ═══ 2. Assistant coach : coach_athletes_meme_identite (SECURITY INVOKER) ═════
insert into t_res values
 (10, 'coach A : son propre athlète (même nom, même date)', '1 / à lui',
      (select count(*)::text || ' / ' || case when bool_and(est_le_mien) then 'à lui' else 'pas à lui' end
         from coach_athletes_meme_identite('Emile', 'Cote-Roy', '2010-05-10'))),
 (11, 'LOI 25 : coach A, mineur d''une autre école (invisible pour lui)', '0',
      (select count(*)::text from coach_athletes_meme_identite('Zoé', 'Cachée', '2010-06-01'))),
 (12, 'FAUX POSITIF : coach A, même date, nom différent', '0',
      (select count(*)::text from coach_athletes_meme_identite('Félix', 'Gauthier', '2010-05-10')));

select set_config('request.jwt.claims', json_build_object('sub', (select v from t_ids where k = 'coachB'), 'role', 'authenticated')::text, true);
insert into t_res values (13, 'coach B : le même mineur, qu''il voit déjà', '1',
  (select count(*)::text from coach_athletes_meme_identite('Zoe', 'cachee', '2010-06-01')));

-- ═══ 3. Le coach A crée la fiche du mineur caché : rien ne lui est dit ════════
select set_config('request.jwt.claims', json_build_object('sub', (select v from t_ids where k = 'coachA'), 'role', 'authenticated')::text, true);
insert into athletes (id, first_name, last_name, date_naissance, school_id, coach_id, status, verified, annee_diplomation)
values ('d1000000-0000-4000-8000-0000000000a1', 'Zoé', 'Cachée', '2010-06-01',
        (select school_id from users where id = auth.uid()), auth.uid(), 'ACTIF', false, 2028);
insert into t_res values (14, 'LOI 25 : la création réussit, sans erreur ni message', 'créée',
  (select case when count(*) = 1 then 'créée' else 'absente' end from athletes where id = 'd1000000-0000-4000-8000-0000000000a1'));

-- Le coach ne peut pas lire la file
do $$ begin
  perform 1 from doublons_probables;
  insert into t_res values (15, 'LOI 25 : coach qui lit doublons_probables', 'refusé', 'LU — FUITE');
exception when insufficient_privilege then
  insert into t_res values (15, 'LOI 25 : coach qui lit doublons_probables', 'refusé', 'refusé');
end $$;
-- Ni appeler le trigger comme une fonction
do $$ begin
  perform doublons_probables_noter();
  insert into t_res values (16, 'coach qui appelle doublons_probables_noter()', 'refusé', 'appelé');
exception when insufficient_privilege or feature_not_supported then
  insert into t_res values (16, 'coach qui appelle doublons_probables_noter()', 'refusé', 'refusé');
end $$;

-- Faux positif à la création : même date, nom différent
insert into athletes (id, first_name, last_name, date_naissance, school_id, coach_id, status, verified, annee_diplomation)
values ('d1000000-0000-4000-8000-0000000000a2', 'Félix', 'Gauthier', '2010-05-10',
        (select school_id from users where id = auth.uid()), auth.uid(), 'ACTIF', false, 2028);

-- ═══ 4. L'athlète en inscription enregistre sa fiche (étape 1) ════════════════
select set_config('request.jwt.claims', json_build_object('sub', (select v from t_ids where k = 'inscr'), 'role', 'authenticated')::text, true);
insert into athletes (id, user_id, first_name, last_name, date_naissance, status, verified, annee_diplomation)
values ('d1000000-0000-4000-8000-0000000000b1', auth.uid(), 'Leo', 'COMPTE', '2009-01-01', 'ACTIF', false, 2027);
-- Il corrige son nom : même paire, pas de seconde ligne
update athletes set first_name = 'Léo' where id = 'd1000000-0000-4000-8000-0000000000b1';
-- Il enregistre une étape sans toucher au nom (étape 2) : rien de nouveau
update athletes set moyenne_generale = 80 where id = 'd1000000-0000-4000-8000-0000000000b1';

reset role;

-- ═══ 5. Ce que l'admin voit (postgres) ═══════════════════════════════════════
insert into t_res values
 (17, 'file : paire « mineur caché » notée, source COACH', '1 COACH INSERT école différente',
      (select count(*)::text || ' ' || min(source) || ' ' || min(operation) || ' ' ||
              case when bool_or(meme_ecole) then 'même école' else 'école différente' end
         from doublons_probables where athlete_id = 'd1000000-0000-4000-8000-0000000000a1'
          and athlete_existant_id = 'd1000000-0000-4000-8000-000000000002')),
 (18, 'file : paire « inscription » notée une seule fois, source ATHLETE', '1 ATHLETE',
      (select count(*)::text || ' ' || min(source) from doublons_probables
        where least(athlete_id, athlete_existant_id) = least('d1000000-0000-4000-8000-0000000000b1'::uuid, 'd1000000-0000-4000-8000-000000000003'::uuid)
          and greatest(athlete_id, athlete_existant_id) = greatest('d1000000-0000-4000-8000-0000000000b1'::uuid, 'd1000000-0000-4000-8000-000000000003'::uuid))),
 (19, 'FAUX POSITIF : aucune ligne pour la création « même date, nom différent »', '0',
      (select count(*)::text from doublons_probables
        where 'd1000000-0000-4000-8000-0000000000a2' in (athlete_id, athlete_existant_id))),
 (20, 'file : total des lignes', '2', (select count(*)::text from doublons_probables));

-- La fiche existante est modifiée à son tour (paire inversée) : toujours une seule ligne
update athletes set last_name = 'Cachee' where id = 'd1000000-0000-4000-8000-000000000002';
insert into t_res values (21, 'paire inversée (l''ancienne fiche change de nom) : pas de doublon de ligne', '2',
  (select count(*)::text from doublons_probables));

-- ═══ 6. anon n'a rien ═════════════════════════════════════════════════════════
set local role anon;
do $$ begin
  perform inscription_doublon_possible('a', 'b', '2010-01-01');
  insert into t_res values (22, 'anon : inscription_doublon_possible', 'refusé', 'appelé');
exception when insufficient_privilege then
  insert into t_res values (22, 'anon : inscription_doublon_possible', 'refusé', 'refusé');
end $$;
do $$ begin
  perform coach_athletes_meme_identite('a', 'b', '2010-01-01');
  insert into t_res values (23, 'anon : coach_athletes_meme_identite', 'refusé', 'appelé');
exception when insufficient_privilege then
  insert into t_res values (23, 'anon : coach_athletes_meme_identite', 'refusé', 'refusé');
end $$;
reset role;

select n, case when attendu = obtenu then 'OK   ' else 'ÉCHEC' end as verdict, test, attendu, obtenu
  from t_res order by n;
select count(*) filter (where attendu = obtenu) as ok, count(*) filter (where attendu <> obtenu) as echecs from t_res;

rollback;
