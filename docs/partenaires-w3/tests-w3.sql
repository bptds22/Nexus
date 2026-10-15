-- Tests W3 (20261014142700), base LOCALE. Une transaction annulée à la fin : rien ne survit.
-- Badges partenaire + retrait (évaluation et badge) par le partenaire / l'admin.
-- Comptes résolus par courriel ; chaque essai tourne sous le VRAI rôle avec un JWT simulé.
-- Athlète cible : Félix Gauthier (football, ACTIF, sans cote du coach).
\set ON_ERROR_STOP 1
\pset footer off
begin;

create temp table _res (n serial, test text, ok boolean, detail text) on commit drop;
grant all on _res to authenticated, anon, service_role;
grant usage on sequence _res_n_seq to authenticated, anon, service_role;

select set_config('w3.p1',    (select id::text from public.users where email = 'p1.partenaire@preuve.local'), true);
select set_config('w3.p2',    (select id::text from public.users where email = 'p2.suspendu@preuve.local'), true);
select set_config('w3.admin', (select id::text from public.users where email = 'admin@demo.local'), true);
select set_config('w3.rec',   (select id::text from public.users where email = 'julie.lambert@exemple.test'), true);
select set_config('w3.coach', (select id::text from public.users where email = 'marc.desrosiers@exemple.test'), true);
select set_config('w3.autre_coach', (select id::text from public.users where email = 'c1.coach@preuve.local'), true);
select set_config('w3.ath_user', (select id::text from public.users where email = 'felix.gauthier@exemple.test'), true);
select set_config('w3.mp1',   (select mp.id::text from public.media_partners mp join public.users u on u.id = mp.user_id where u.email = 'p1.partenaire@preuve.local'), true);
select set_config('w3.mp2',   (select mp.id::text from public.media_partners mp join public.users u on u.id = mp.user_id where u.email = 'p2.suspendu@preuve.local'), true);
select set_config('w3.felix', (select a.id::text from public.athletes a join public.users u on u.id = a.user_id where u.email = 'felix.gauthier@exemple.test'), true);
select set_config('w3.nathan','d3a00000-0000-4000-8000-0000000c2003', true);  -- football, NON éligible (opt-in faux)

-- Préparation (postgres), annulée à la fin :
--  · Félix éligible (opt-in) ;
--  · p1 (Média Preuve) évaluateur en football (W1), p2 (suspendu) aussi — son statut le bloque ;
--  · Félix porte déjà 5 badges coach (le plafond est atteint).
update public.athletes set partner_visibility_opt_in = true where id = current_setting('w3.felix')::uuid;
update public.media_partners set peut_evaluer = true where id in (current_setting('w3.mp1')::uuid, current_setting('w3.mp2')::uuid);
insert into public.partenaire_sports_permis (partner_id, sport_id)
select mp, (select id from public.sports where nom = 'Football')
  from unnest(array[current_setting('w3.mp1')::uuid, current_setting('w3.mp2')::uuid]) mp;
insert into public.athlete_badges (athlete_id, badge_id, attribue_par)
select current_setting('w3.felix')::uuid, b.id, current_setting('w3.coach')::uuid
  from public.badges b
 where b.famille = 'universel' and not b.requiert_contexte and b.actif
 order by b.ordre limit 5;

create function pg_temp.essai(p_test text, p_uid text, p_sql text, p_attendu text) returns void
language plpgsql as $$
declare r text;
begin
  perform set_config('request.jwt.claims',
    case when p_uid is null then '{"role":"anon"}'
         else json_build_object('sub', p_uid, 'role', 'authenticated')::text end, true);
  begin
    execute p_sql into r;
  exception when others then r := 'ERR:' || sqlstate;
  end;
  insert into _res (test, ok, detail)
  values (p_test, r is not distinct from p_attendu, coalesce(r, 'NULL') || ' (attendu ' || p_attendu || ')');
end $$;

-- Témoins de ce que W3 ne doit jamais toucher.
create temp table _temoin on commit drop as
select (select count(*) from public.evaluations) as nb_eval,
       (select md5(string_agg(id::text || coalesce(cote_globale_entraineur::text, '∅'), ',' order by id)) from public.athletes) as cotes,
       (select md5(string_agg(id::text || coalesce(retire_le::text, '∅'), ',' order by id)) from public.athlete_badges) as badges_coach;
grant select on _temoin to authenticated, anon, service_role;
create temp table _ids (cle text primary key, id uuid) on commit drop;
grant all on _ids to authenticated, anon, service_role;

set local role authenticated;

-- ── Catalogue (admin seulement) ────────────────────────────────────────────
select pg_temp.essai('K1 admin crée un badge pour p1', current_setting('w3.admin'),
  format($q$with b as (select public.admin_enregistrer_badge_partenaire(null, %L, 'Esprit sportif', %L, true, 0) id)
            insert into _ids select 'b1', id from b returning (id is not null)::text$q$,
         current_setting('w3.mp1'), current_setting('w3.mp1') || '/esprit.png'), 'true');
select pg_temp.essai('K2 admin crée un badge pour p2 (suspendu)', current_setting('w3.admin'),
  format($q$with b as (select public.admin_enregistrer_badge_partenaire(null, %L, 'Badge p2', null, true, 0) id)
            insert into _ids select 'b2', id from b returning (id is not null)::text$q$, current_setting('w3.mp2')), 'true');
select pg_temp.essai('K3 p1 ne crée PAS de badge lui-même', current_setting('w3.p1'),
  format($q$select public.admin_enregistrer_badge_partenaire(null, %L, 'Autoproclamé', null, true, 0)::text$q$, current_setting('w3.mp1')), 'ERR:42501');
select pg_temp.essai('K4 icône hors du dossier du partenaire → refusée', current_setting('w3.admin'),
  format($q$select public.admin_enregistrer_badge_partenaire(null, %L, 'Mauvais dossier', %L, true, 0)::text$q$,
         current_setting('w3.mp1'), current_setting('w3.mp2') || '/x.png'), 'ERR:22023');
select pg_temp.essai('K5 p1 voit SON catalogue (1 badge)', current_setting('w3.p1'),
  'select count(*)::text from public.partenaire_mes_badges()', '1');
select pg_temp.essai('K6 un coach n''a aucun catalogue partenaire', current_setting('w3.coach'),
  'select count(*)::text from public.partenaire_mes_badges()', '0');
select pg_temp.essai('K7 p1 lit le catalogue admin → refusé', current_setting('w3.p1'),
  format('select count(*)::text from public.admin_badges_partenaire(%L)', current_setting('w3.mp1')), 'ERR:42501');

-- ── Pose : refus ───────────────────────────────────────────────────────────
select set_config('w3.q_pose', 'select public.partenaire_attribuer_badge(%L, (select id from _ids where cle = %L)) is not null', true);
select pg_temp.essai('R1 p1 pose sur un athlète NON éligible → refusé', current_setting('w3.p1'),
  format(current_setting('w3.q_pose'), current_setting('w3.nathan'), 'b1'), 'ERR:42501');
select pg_temp.essai('R2 p1 pose le badge de p2 → refusé', current_setting('w3.p1'),
  format(current_setting('w3.q_pose'), current_setting('w3.felix'), 'b2'), 'ERR:42501');
select pg_temp.essai('R3 p2 (suspendu) pose son propre badge → refusé', current_setting('w3.p2'),
  format(current_setting('w3.q_pose'), current_setting('w3.felix'), 'b2'), 'ERR:42501');
select pg_temp.essai('R4 le coach pose un badge partenaire → refusé', current_setting('w3.coach'),
  format(current_setting('w3.q_pose'), current_setting('w3.felix'), 'b1'), 'ERR:42501');
select pg_temp.essai('R5 l''athlète pose un badge partenaire → refusé', current_setting('w3.ath_user'),
  format(current_setting('w3.q_pose'), current_setting('w3.felix'), 'b1'), 'ERR:42501');
select pg_temp.essai('R6 p1 écrit partner_athlete_badges en direct → refusé', current_setting('w3.p1'),
  format($q$with i as (insert into public.partner_athlete_badges (partner_badge_id, athlete_id) values ((select id from _ids where cle = 'b1'), %L) returning 1) select count(*)::text from i$q$,
         current_setting('w3.felix')), 'ERR:42501');
select pg_temp.essai('R7 p1 lit partner_athlete_badges en direct → refusé', current_setting('w3.p1'),
  'select count(*)::text from public.partner_athlete_badges', 'ERR:42501');

-- ── Pose : hors plafond ────────────────────────────────────────────────────
select pg_temp.essai('P1 Félix a déjà 5 badges coach (plafond atteint)', current_setting('w3.admin'),
  format('select count(*)::text from public.athlete_badges where athlete_id = %L and retire_le is null', current_setting('w3.felix')), '5');
select pg_temp.essai('P2 p1 pose son badge sur Félix malgré le plafond', current_setting('w3.p1'),
  format($q$with p as (select public.partenaire_attribuer_badge(%L, (select id from _ids where cle = 'b1')) id)
            insert into _ids select 'pose1', id from p returning (id is not null)::text$q$, current_setting('w3.felix')), 'true');
select pg_temp.essai('P3 le même badge une 2e fois → refusé (doublon)', current_setting('w3.p1'),
  format(current_setting('w3.q_pose'), current_setting('w3.felix'), 'b1'), 'ERR:23505');
select pg_temp.essai('P4 le plafond tient toujours pour le coach (6e badge coach → refusé)', current_setting('w3.coach'),
  format($q$with i as (insert into public.athlete_badges (athlete_id, badge_id, attribue_par)
                      select %L, b.id, %L from public.badges b
                       where not b.requiert_contexte and b.actif
                         and b.id not in (select badge_id from public.athlete_badges where athlete_id = %L and retire_le is null)
                       order by b.ordre limit 1 returning 1)
            select count(*)::text from i$q$,
         current_setting('w3.felix'), current_setting('w3.coach'), current_setting('w3.felix')), 'ERR:P0001');
select pg_temp.essai('P5 aucune ligne athlete_badges touchée par W3', current_setting('w3.admin'),
  $q$select ((select md5(string_agg(id::text || coalesce(retire_le::text, '∅'), ',' order by id)) from public.athlete_badges) = t.badges_coach)::text
       from _temoin t$q$, 'true');

-- ── Lecture ────────────────────────────────────────────────────────────────
select set_config('w3.q_lire', 'select count(*)::text from public.badges_partenaires_athlete(%L)', true);
select pg_temp.essai('L1 recruteur lit le badge, signé par l''organisation', current_setting('w3.rec'),
  format('select organisation || '' / '' || libelle from public.badges_partenaires_athlete(%L)', current_setting('w3.felix')), 'Média Preuve / Esprit sportif');
select pg_temp.essai('L2 l''athlète lit son badge', current_setting('w3.ath_user'), format(current_setting('w3.q_lire'), current_setting('w3.felix')), '1');
select pg_temp.essai('L3 le coach lit, et peut masquer', current_setting('w3.coach'),
  format('select peut_masquer::text from public.badges_partenaires_athlete(%L)', current_setting('w3.felix')), 'true');
select pg_temp.essai('L4 l''athlète ne peut PAS masquer', current_setting('w3.ath_user'),
  format('select peut_masquer::text from public.badges_partenaires_athlete(%L)', current_setting('w3.felix')), 'false');
select pg_temp.essai('L5 un autre coach ne lit rien', current_setting('w3.autre_coach'), format(current_setting('w3.q_lire'), current_setting('w3.felix')), '0');
select pg_temp.essai('L6 p2 (autre partenaire) ne lit rien', current_setting('w3.p2'), format(current_setting('w3.q_lire'), current_setting('w3.felix')), '0');
select pg_temp.essai('L7 p1 lit le sien (est_le_mien)', current_setting('w3.p1'),
  format('select est_le_mien::text from public.badges_partenaires_athlete(%L)', current_setting('w3.felix')), 'true');
select pg_temp.essai('L8 la projection ne porte AUCUNE colonne de personne', current_setting('w3.rec'),
  $q$select (not exists (select 1 from pg_proc p, unnest(p.proargnames) a
                         where p.oid = 'public.badges_partenaires_athlete(uuid)'::regprocedure
                           and a in ('attribue_par', 'retire_par', 'masque_par', 'user_id', 'partner_id')))::text$q$, 'true');

-- ── Masquage par le coach ──────────────────────────────────────────────────
select set_config('w3.q_masque', 'select public.coach_masquer_badge_partenaire((select id from _ids where cle = ''pose1''), %s)::text', true);
select pg_temp.essai('M1 l''athlète masque → refusé', current_setting('w3.ath_user'), format(current_setting('w3.q_masque'), 'true'), 'ERR:42501');
select pg_temp.essai('M2 le recruteur masque → refusé', current_setting('w3.rec'), format(current_setting('w3.q_masque'), 'true'), 'ERR:42501');
select pg_temp.essai('M3 p1 masque → refusé (c''est au coach)', current_setting('w3.p1'), format(current_setting('w3.q_masque'), 'true'), 'ERR:42501');
select pg_temp.essai('M4 un autre coach masque → refusé', current_setting('w3.autre_coach'), format(current_setting('w3.q_masque'), 'true'), 'ERR:42501');
select pg_temp.essai('M5 le coach masque', current_setting('w3.coach'), format(current_setting('w3.q_masque'), 'true'), '');
select pg_temp.essai('M6 masqué : le recruteur ne le voit plus', current_setting('w3.rec'), format(current_setting('w3.q_lire'), current_setting('w3.felix')), '0');
select pg_temp.essai('M7 masqué : l''athlète ne le voit plus', current_setting('w3.ath_user'), format(current_setting('w3.q_lire'), current_setting('w3.felix')), '0');
select pg_temp.essai('M8 masqué : le coach le voit, marqué masqué', current_setting('w3.coach'),
  format('select est_masque::text from public.badges_partenaires_athlete(%L)', current_setting('w3.felix')), 'true');
select pg_temp.essai('M9 masqué : p1 le voit, marqué masqué', current_setting('w3.p1'),
  format('select est_masque::text from public.badges_partenaires_athlete(%L)', current_setting('w3.felix')), 'true');
select pg_temp.essai('M10 masqué, pas supprimé : la pose est toujours vivante', current_setting('w3.admin'),
  format('select est_masque::text from public.badges_partenaires_athlete(%L)', current_setting('w3.felix')), 'true');
select pg_temp.essai('M11 le coach réaffiche', current_setting('w3.coach'), format(current_setting('w3.q_masque'), 'false'), '');
select pg_temp.essai('M12 réaffiché : le recruteur le revoit', current_setting('w3.rec'), format(current_setting('w3.q_lire'), current_setting('w3.felix')), '1');

-- ── Retrait d'un badge ─────────────────────────────────────────────────────
select set_config('w3.q_retire_b', 'select public.retirer_badge_partenaire((select id from _ids where cle = %L))::text', true);
select pg_temp.essai('X1 p2 retire le badge de p1 → refusé', current_setting('w3.p2'), format(current_setting('w3.q_retire_b'), 'pose1'), 'ERR:42501');
select pg_temp.essai('X2 le coach retire le badge → refusé (il peut seulement masquer)', current_setting('w3.coach'), format(current_setting('w3.q_retire_b'), 'pose1'), 'ERR:42501');
select pg_temp.essai('X3 l''athlète retire le badge → refusé', current_setting('w3.ath_user'), format(current_setting('w3.q_retire_b'), 'pose1'), 'ERR:42501');
select pg_temp.essai('X4 p1 retire son badge', current_setting('w3.p1'), format(current_setting('w3.q_retire_b'), 'pose1'), '');
select pg_temp.essai('X5 retiré : disparaît pour le recruteur', current_setting('w3.rec'), format(current_setting('w3.q_lire'), current_setting('w3.felix')), '0');
select pg_temp.essai('X6 retiré : disparaît aussi pour le coach et p1', current_setting('w3.coach'), format(current_setting('w3.q_lire'), current_setting('w3.felix')), '0');
select pg_temp.essai('X7 un 2e retrait → refusé', current_setting('w3.p1'), format(current_setting('w3.q_retire_b'), 'pose1'), 'ERR:22023');
reset role;
select pg_temp.essai('X8 trace gardée : qui (p1) et quand', null,
  format($q$select (retire_le is not null and retire_par = %L)::text from public.partner_athlete_badges where id = (select id from _ids where cle = 'pose1')$q$,
         current_setting('w3.p1')), 'true');
set local role authenticated;
select pg_temp.essai('X9 l''admin repose le badge au nom de p1', current_setting('w3.admin'),
  format($q$with p as (select public.partenaire_attribuer_badge(%L, (select id from _ids where cle = 'b1')) id)
            insert into _ids select 'pose2', id from p returning (id is not null)::text$q$, current_setting('w3.felix')), 'true');
select pg_temp.essai('X10 l''admin le retire', current_setting('w3.admin'), format(current_setting('w3.q_retire_b'), 'pose2'), '');
select pg_temp.essai('X11 aucun badge vivant', current_setting('w3.rec'), format(current_setting('w3.q_lire'), current_setting('w3.felix')), '0');

-- ── Retrait d'une évaluation ───────────────────────────────────────────────
select pg_temp.essai('E1 p1 évalue Félix (4.5, aucune cote coach)', current_setting('w3.p1'),
  format('select (public.partenaire_evaluer_athlete(%L, 4.5, ''{}''::jsonb) is not null)::text', current_setting('w3.felix')), 'true');
select pg_temp.essai('E2 « 4+ étoiles » (web) : Félix y sort grâce à la note partenaire', current_setting('w3.rec'),
  format('select count(*)::text from public.recruiter_search_athletes(p_min_rating => 4, p_inclure_partenaires => true) where id = %L', current_setting('w3.felix')), '1');
select set_config('w3.q_retire_e', $q$select public.retirer_evaluation_partenaire((select id from public.evaluations_partenaires_athlete(%L) limit 1))::text$q$, true);
reset role;
insert into _ids select 'eval', id from public.partner_evaluations where athlete_id = current_setting('w3.felix')::uuid;
set local role authenticated;
select set_config('w3.q_retire_e2', $q$select public.retirer_evaluation_partenaire((select id from _ids where cle = 'eval'))::text$q$, true);
select pg_temp.essai('E3b p2 retire l''évaluation de p1 → refusé', current_setting('w3.p2'), current_setting('w3.q_retire_e2'), 'ERR:42501');
select pg_temp.essai('E4 le coach retire l''évaluation partenaire → refusé', current_setting('w3.coach'), current_setting('w3.q_retire_e2'), 'ERR:42501');
select pg_temp.essai('E5 le recruteur retire → refusé', current_setting('w3.rec'), current_setting('w3.q_retire_e2'), 'ERR:42501');
select pg_temp.essai('E6 p1 retire son évaluation', current_setting('w3.p1'), current_setting('w3.q_retire_e2'), '');
select pg_temp.essai('E7 retirée : la section disparaît (recruteur)', current_setting('w3.rec'),
  format('select count(*)::text from public.evaluations_partenaires_athlete(%L)', current_setting('w3.felix')), '0');
select pg_temp.essai('E8 retirée : Félix ne sort PLUS dans « 4+ étoiles » (web)', current_setting('w3.rec'),
  format('select count(*)::text from public.recruiter_search_athletes(p_min_rating => 4, p_inclure_partenaires => true) where id = %L', current_setting('w3.felix')), '0');
select pg_temp.essai('E9 retirée : plus de cote partenaire dans la recherche', current_setting('w3.rec'),
  format('select coalesce(cote_partenaire::text, ''NULL'') from public.recruiter_search_athletes() where id = %L', current_setting('w3.felix')), 'NULL');
select pg_temp.essai('E10 p1 lit la trace des retraits en direct → refusé', current_setting('w3.p1'),
  'select count(*)::text from public.partner_evaluation_retraits', 'ERR:42501');
reset role;
select pg_temp.essai('E11 trace gardée : qui (p1), quand, cote 4.5', null,
  format($q$select (retire_par = %L and retire_le is not null)::text || ' ' || cote_globale::text
              from public.partner_evaluation_retraits where evaluation_id = (select id from _ids where cle = 'eval')$q$,
         current_setting('w3.p1')), 'true 4.50');
set local role authenticated;
select pg_temp.essai('E12 p1 réévalue, l''admin retire', current_setting('w3.p1'),
  format('select (public.partenaire_evaluer_athlete(%L, 4, ''{}''::jsonb) is not null)::text', current_setting('w3.felix')), 'true');
select pg_temp.essai('E13 l''admin retire l''évaluation de p1', current_setting('w3.admin'),
  format(current_setting('w3.q_retire_e'), current_setting('w3.felix')), '');
reset role;
select pg_temp.essai('E14 deux retraits tracés (p1 puis admin)', null,
  format($q$select string_agg(case retire_par when %L then 'p1' when %L then 'admin' end, ',' order by retire_le)
              from public.partner_evaluation_retraits where athlete_id = %L$q$,
         current_setting('w3.p1'), current_setting('w3.admin'), current_setting('w3.felix')), 'p1,admin');
select pg_temp.essai('E15 aucune écriture côté coach (evaluations, cotes)', null,
  $q$select ((select count(*) from public.evaluations) = t.nb_eval
           and (select md5(string_agg(id::text || coalesce(cote_globale_entraineur::text, '∅'), ',' order by id)) from public.athletes) = t.cotes)::text
       from _temoin t$q$, 'true');

-- ── Anonyme ────────────────────────────────────────────────────────────────
set local role anon;
select pg_temp.essai('A1 anon : lecture des badges → refusé', null, format(current_setting('w3.q_lire'), current_setting('w3.felix')), 'ERR:42501');
select pg_temp.essai('A2 anon : pose → refusé', null, format(current_setting('w3.q_pose'), current_setting('w3.felix'), 'b1'), 'ERR:42501');
select pg_temp.essai('A3 anon : retrait d''évaluation → refusé', null, current_setting('w3.q_retire_e2'), 'ERR:42501');
reset role;

-- ── Droits d'exécution : liste complète (jamais par inclusion) ─────────────
select pg_temp.essai('D1 ACL des 8 fonctions W3 = {authenticated, postgres, service_role}', null,
  $q$select string_agg(distinct acl, ' | ')
       from (select array_agg(t.g order by t.g)::text acl
               from pg_proc pr,
                    lateral (select coalesce(nullif(split_part(x,'=',1),''),'PUBLIC') as g from unnest(pr.proacl::text[]) as x) t
              where pr.pronamespace = 'public'::regnamespace
                and pr.proname in ('admin_badges_partenaire', 'admin_enregistrer_badge_partenaire', 'partenaire_mes_badges',
                                   'partenaire_attribuer_badge', 'retirer_badge_partenaire', 'coach_masquer_badge_partenaire',
                                   'badges_partenaires_athlete', 'retirer_evaluation_partenaire')
              group by pr.oid) s$q$, '{authenticated,postgres,service_role}');
-- Attendu mis à jour le 2026-10-15 : D1b (20261015103315) a ajouté à la recherche le filtre
-- « sans nom ou nom à confirmer ». W3 ne la touche toujours pas (version W2 : c15481a0…).
select pg_temp.essai('D2 recruiter_search_athletes inchangée par W3 (md5 W2 + filtre D1b)', null,
  $q$select md5(pg_get_functiondef(p.oid)) from pg_proc p where p.proname = 'recruiter_search_athletes' and p.pronamespace = 'public'::regnamespace$q$,
  '27650ed7a2109f83d870d85d724c660a');

select n, case when ok then 'OK' else 'ÉCHEC' end as res, test, detail from _res order by n;
select count(*) filter (where ok) as ok, count(*) filter (where not ok) as echecs from _res;

rollback;
