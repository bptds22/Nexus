-- D1b — tests au banc, base LOCALE, UNE transaction ANNULÉE à la fin (rien ne reste).
--   docker cp docs/noms-d1b/tests-d1b.sql supabase_db_Nexus:/tmp/tests-d1b.sql
--   docker exec -e PGCLIENTENCODING=UTF8 supabase_db_Nexus psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q -f /tmp/tests-d1b.sql
-- Les comptes sont créés par un INSERT dans auth.users : c'est le VRAI chemin (handle_new_auth_user
-- → public.users → trg_users_nom_google), le même qu'une connexion Google.
-- Recruteur : r1.avec.cegep@preuve.local (All Star, fixture locale).

begin;

create temp table t_res (n int, test text, attendu text, obtenu text);
grant all on t_res to authenticated, anon;
create temp table t_ids (k text primary key, v uuid);
grant all on t_ids to authenticated, anon;

-- ── Comptes (auth.users → handle_new_auth_user → users) ──────────────────────
insert into t_ids values
 ('g1', 'd1b00000-0000-4000-8000-000000000001'), ('g2', 'd1b00000-0000-4000-8000-000000000002'),
 ('g3', 'd1b00000-0000-4000-8000-000000000003'), ('g4', 'd1b00000-0000-4000-8000-000000000004'),
 ('e1', 'd1b00000-0000-4000-8000-000000000005'), ('a1', 'd1b00000-0000-4000-8000-000000000006'),
 ('g9', 'd1b00000-0000-4000-8000-000000000009'),
 ('rec', (select id from users where email = 'r1.avec.cegep@preuve.local'));

insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                        confirmation_token, recovery_token, email_change, email_change_token_new)
select v, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', k || '.d1b@exemple.test',
       jsonb_build_object('provider', p, 'providers', jsonb_build_array(p)), m, now(), now(), '', '', '', ''
  from (values
    ('g1', 'google', '{"full_name": "Jean Tremblay", "name": "Jean Tremblay", "role": "ATHLETE"}'::jsonb),
    ('g2', 'google', '{"full_name": "Marie  Ève Gagnon", "role": "ATHLETE"}'::jsonb),
    ('g3', 'google', '{"full_name": "Madonna", "role": "ATHLETE"}'::jsonb),
    ('g4', 'google', '{"full_name": "X Y", "first_name": "Paul", "last_name": "Roy", "role": "ATHLETE"}'::jsonb),
    ('e1', 'email',  '{"first_name": "Éloi", "last_name": "Courriel", "role": "ATHLETE"}'::jsonb),
    ('a1', 'apple',  '{"full_name": "Luc Pomme", "role": "ATHLETE"}'::jsonb),
    ('g9', 'google', '{"full_name": "Neuf Sansnom", "role": "ATHLETE"}'::jsonb)
  ) x(k, p, m) join t_ids using (k);

insert into t_res values
 (1, 'Google « Jean Tremblay » → prénom/nom coupés, à confirmer', 'Jean|Tremblay|true',
     (select first_name || '|' || last_name || '|' || nom_a_confirmer from users where id = (select v from t_ids where k = 'g1'))),
 (2, 'Google à 3 mots (espaces doubles) → premier mot / le reste', 'Marie|Ève Gagnon|true',
     (select first_name || '|' || last_name || '|' || nom_a_confirmer from users where id = (select v from t_ids where k = 'g2'))),
 (3, 'Google à 1 mot → prénom seul, nom vide', 'Madonna|(vide)|true',
     (select first_name || '|' || coalesce(last_name, '(vide)') || '|' || nom_a_confirmer from users where id = (select v from t_ids where k = 'g3'))),
 (4, 'Google avec un nom déjà présent → JAMAIS écrasé', 'Paul|Roy|false',
     (select first_name || '|' || last_name || '|' || nom_a_confirmer from users where id = (select v from t_ids where k = 'g4'))),
 (5, 'inscription par courriel → inchangée', 'Éloi|Courriel|false',
     (select first_name || '|' || last_name || '|' || nom_a_confirmer from users where id = (select v from t_ids where k = 'e1'))),
 (6, 'Apple (nom complet seul) → inchangé (l''appli persiste le nom Apple)', '(vide)|(vide)|false',
     (select coalesce(first_name, '(vide)') || '|' || coalesce(last_name, '(vide)') || '|' || nom_a_confirmer from users where id = (select v from t_ids where k = 'a1')));

-- Cas « les 9 » : compte Google créé AVANT D1b (nom du compte vide), fiche sans nom.
update users set first_name = null, last_name = null, nom_a_confirmer = false where id = (select v from t_ids where k = 'g9');

-- ── Fiches, créées comme l'appli publiée : nom recopié du compte ─────────────
create or replace function pg_temp.creer_fiche(p_k text) returns uuid language plpgsql as $f$
declare v uuid := (select t.v from t_ids t where t.k = p_k); r uuid;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', v, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  insert into athletes (user_id, first_name, last_name, date_naissance, status, verified, annee_diplomation)
  select v, coalesce(u.first_name, ''), coalesce(u.last_name, ''), '2008-06-06', 'ACTIF', false, 2026
    from users u where u.id = v
  returning id into r;
  execute 'reset role';
  return r;
end $f$;
insert into t_ids select 'f_' || k, pg_temp.creer_fiche(k) from (values ('g1'), ('g2'), ('g3'), ('g4'), ('e1'), ('g9')) x(k);

insert into t_res values
 (7, 'fiche créée avec le nom Google du compte → à confirmer', 'true',
     (select nom_a_confirmer::text from athletes where id = (select v from t_ids where k = 'f_g1'))),
 (8, 'fiche d''un compte au nom saisi → pas à confirmer', 'false',
     (select nom_a_confirmer::text from athletes where id = (select v from t_ids where k = 'f_e1')));

-- ── Recherche recruteur ──────────────────────────────────────────────────────
create or replace function pg_temp.visible(p_k text) returns text language plpgsql as $f$
declare r text;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', (select v from t_ids where k = 'rec'), 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select case when exists (select 1 from recruiter_search_athletes() s where s.id = (select v from t_ids where k = p_k))
              then 'visible' else 'cachée' end into r;
  execute 'reset role';
  return r;
end $f$;

insert into t_res values
 (9,  'recherche : nom à confirmer → cachée', 'cachée', pg_temp.visible('f_g1')),
 (10, 'recherche : nom saisi → visible', 'visible', pg_temp.visible('f_e1')),
 (11, 'recherche : prénom seul (nom vide) → cachée', 'cachée', pg_temp.visible('f_g3')),
 (12, 'recherche : sans prénom ni nom (cas des 9) → cachée', 'cachée', pg_temp.visible('f_g9')),
 (13, 'recherche : Google au nom déjà présent → visible', 'visible', pg_temp.visible('f_g4'));

-- ── Confirmation par l'APPLI publiée : l'athlète modifie son nom ─────────────
select set_config('request.jwt.claims', json_build_object('sub', (select v from t_ids where k = 'g1'), 'role', 'authenticated')::text, true);
set local role authenticated;
update athletes set last_name = 'Tremblay-Roy' where id = (select v from t_ids where k = 'f_g1');
-- Réenregistrer le MÊME nom ne confirme pas (l'appli réécrit le nom à chaque étape)
select set_config('request.jwt.claims', json_build_object('sub', (select v from t_ids where k = 'g2'), 'role', 'authenticated')::text, true);
update athletes set first_name = 'Marie', last_name = 'Ève Gagnon' where id = (select v from t_ids where k = 'f_g2');
-- Lever le drapeau à la main : refusé en silence
update athletes set nom_a_confirmer = false where id = (select v from t_ids where k = 'f_g2');
reset role;

insert into t_res values
 (14, 'appli : l''athlète modifie son nom → confirmé (fiche + compte)', 'false|false',
     (select a.nom_a_confirmer || '|' || u.nom_a_confirmer from athletes a join users u on u.id = a.user_id
       where a.id = (select v from t_ids where k = 'f_g1'))),
 (15, 'appli : après confirmation → visible dans la recherche', 'visible', pg_temp.visible('f_g1')),
 (16, 'appli : réenregistrer le même nom → toujours à confirmer', 'true',
     (select nom_a_confirmer::text from athletes where id = (select v from t_ids where k = 'f_g2'))),
 (17, 'athlète qui lève le drapeau à la main → sans effet', 'true',
     (select nom_a_confirmer::text from athletes where id = (select v from t_ids where k = 'f_g2')));

-- Un coach ou un admin qui change le nom ne confirme pas à la place du jeune ; ni le drapeau à la main
update athletes set last_name = 'Gagnon' where id = (select v from t_ids where k = 'f_g2');
update athletes set nom_a_confirmer = false where id = (select v from t_ids where k = 'f_g2');
insert into t_res values (18, 'autre que l''athlète (coach/admin) : nom changé ou drapeau levé → toujours à confirmer', 'true',
  (select nom_a_confirmer::text from athletes where id = (select v from t_ids where k = 'f_g2')));
update athletes set last_name = 'Ève Gagnon' where id = (select v from t_ids where k = 'f_g2');

-- ── Bandeau web : mon_nom_a_confirmer / confirmer_mon_nom ────────────────────
create or replace function pg_temp.etat(p_k text) returns text language plpgsql as $f$
declare r text;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', (select v from t_ids where k = p_k), 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select coalesce(string_agg(etat || '|' || coalesce(prenom, '(vide)') || '|' || coalesce(nom, '(vide)'), ';'), 'rien')
    into r from mon_nom_a_confirmer();
  execute 'reset role';
  return r;
end $f$;

insert into t_res values
 (19, 'bandeau : nom à confirmer → « Est-ce bien toi : Marie Ève Gagnon ? »', 'A_CONFIRMER|Marie|Ève Gagnon', pg_temp.etat('g2')),
 (20, 'bandeau : cas des 9 (compte et fiche vides) → proposition tirée du nom Google DU compte', 'MANQUANT|Neuf|Sansnom', pg_temp.etat('g9')),
 (21, 'bandeau : nom à 1 mot → nom manquant, prénom proposé', 'MANQUANT|Madonna|(vide)', pg_temp.etat('g3')),
 (22, 'bandeau : nom confirmé → rien', 'rien', pg_temp.etat('g1')),
 (23, 'bandeau : nom saisi → rien', 'rien', pg_temp.etat('e1'));

select set_config('request.jwt.claims', json_build_object('sub', (select v from t_ids where k = 'g2'), 'role', 'authenticated')::text, true);
set local role authenticated;
select confirmer_mon_nom('Marie', 'Ève Gagnon');            -- « Oui »
select set_config('request.jwt.claims', json_build_object('sub', (select v from t_ids where k = 'g9'), 'role', 'authenticated')::text, true);
select confirmer_mon_nom(' Neuf ', 'Sansnom-Corrigé');      -- « Corriger »
do $$ begin
  perform confirmer_mon_nom('', 'X');
  insert into t_res values (24, 'confirmer avec un prénom vide → refusé', 'refusé', 'accepté');
exception when others then
  insert into t_res values (24, 'confirmer avec un prénom vide → refusé', 'refusé', 'refusé');
end $$;
reset role;

insert into t_res values
 (25, '« Oui » → confirmé, même nom', 'Marie|Ève Gagnon|false',
     (select first_name || '|' || last_name || '|' || nom_a_confirmer from athletes where id = (select v from t_ids where k = 'f_g2'))),
 (26, '« Corriger » sur une fiche sans nom → nom écrit (espaces retirés), visible', 'Neuf|Sansnom-Corrigé|visible',
     (select first_name || '|' || last_name || '|' || pg_temp.visible('f_g9') from athletes where id = (select v from t_ids where k = 'f_g9'))),
 (27, 'confirmer ne touche QUE la fiche de l''appelant', 'Jean|Tremblay-Roy',
     (select first_name || '|' || last_name from athletes where id = (select v from t_ids where k = 'f_g1')));

-- ── anon : rien ──────────────────────────────────────────────────────────────
set local role anon;
do $$ begin
  perform mon_nom_a_confirmer();
  insert into t_res values (28, 'anon : mon_nom_a_confirmer', 'refusé', 'appelé');
exception when insufficient_privilege then
  insert into t_res values (28, 'anon : mon_nom_a_confirmer', 'refusé', 'refusé');
end $$;
do $$ begin
  perform confirmer_mon_nom('a', 'b');
  insert into t_res values (29, 'anon : confirmer_mon_nom', 'refusé', 'appelé');
exception when insufficient_privilege then
  insert into t_res values (29, 'anon : confirmer_mon_nom', 'refusé', 'refusé');
end $$;
reset role;

select n, case when attendu = obtenu then 'OK   ' else 'ÉCHEC' end as verdict, test, attendu, obtenu from t_res order by n;
select count(*) filter (where attendu = obtenu) as ok, count(*) filter (where attendu is distinct from obtenu) as echecs from t_res;

rollback;
