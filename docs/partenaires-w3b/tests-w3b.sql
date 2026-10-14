-- Tests W3b (20261014180000), base LOCALE. Une transaction annulée à la fin : rien ne survit.
-- Badges NEXUS attribués par un partenaire (en plus de ses propres badges W3).
-- Comptes résolus par courriel ; chaque essai tourne sous le VRAI rôle avec un JWT simulé.
-- Athlète cible : Félix Gauthier (football, ACTIF). Il porte déjà 5 badges coach :
-- les 5 universels — le plafond est atteint.
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
select set_config('w3.b_vitesse', (select id::text from public.badges where code = 'vitesse'), true);   -- sport : football
select set_config('w3.b_radar',   (select id::text from public.badges where code = 'radar'), true);     -- sport : football
select set_config('w3.b_3pts',    (select id::text from public.badges where code = '3-points'), true);  -- sport : basketball
select set_config('w3.b_clutch',  (select id::text from public.badges where code = 'clutch'), true);    -- universel (le coach l'a posé)
select set_config('w3.b_mvp',     (select id::text from public.badges where code = 'mvp'), true);       -- honneur

-- Préparation (postgres), annulée à la fin :
--  · Félix éligible (opt-in) ;
--  · p1 (Média Preuve) évaluateur en football ; p2 aussi, et APPROUVÉ ici pour
--    jouer « un autre partenaire » ;
--  · Félix porte déjà 5 badges coach (les 5 universels) : plafond atteint.
update public.athletes set partner_visibility_opt_in = true where id = current_setting('w3.felix')::uuid;
update public.media_partners set peut_evaluer = true where id in (current_setting('w3.mp1')::uuid, current_setting('w3.mp2')::uuid);
update public.media_partners set status = 'APPROVED' where id = current_setting('w3.mp2')::uuid;
insert into public.partenaire_sports_permis (partner_id, sport_id)
select mp, (select id from public.sports where nom = 'Football')
  from unnest(array[current_setting('w3.mp1')::uuid, current_setting('w3.mp2')::uuid]) mp
on conflict do nothing;
insert into public.athlete_badges (athlete_id, badge_id, attribue_par)
select current_setting('w3.felix')::uuid, b.id, current_setting('w3.coach')::uuid
  from public.badges b
 where b.famille = 'universel' and not b.requiert_contexte and b.actif
 order by b.ordre limit 5;

-- essai : rend le résultat, ou « ERR:<sqlstate> ».
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
-- essai_msg : le refus doit porter CE message (décision 6 : « un message clair »).
create function pg_temp.essai_msg(p_test text, p_uid text, p_sql text, p_etat text, p_msg text) returns void
language plpgsql as $$
declare r text;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  begin
    execute p_sql into r;
    r := 'PASSÉ:' || coalesce(r, 'NULL');
  exception when others then r := sqlstate || ' ' || sqlerrm;
  end;
  insert into _res (test, ok, detail) values (p_test, r = p_etat || ' ' || p_msg, r);
end $$;

-- Témoins de ce que W3b ne doit jamais toucher.
create temp table _temoin on commit drop as
select (select md5(string_agg(id::text || coalesce(retire_le::text, '∅'), ',' order by id)) from public.athlete_badges) as badges_coach;
grant select on _temoin to authenticated, anon, service_role;
create temp table _ids (cle text primary key, id uuid) on commit drop;
grant all on _ids to authenticated, anon, service_role;

set local role authenticated;

-- ── Ce qu'un partenaire peut proposer (liste) ──────────────────────────────
select set_config('w3.q_adm', 'select %s from public.partenaire_badges_nexus_admissibles(%L)', true);
select pg_temp.essai('A1 p1 voit 15 badges pour Félix (5 universels + 10 de football)', current_setting('w3.p1'),
  format(current_setting('w3.q_adm'), 'count(*)::text', current_setting('w3.felix')), '15');
select pg_temp.essai('A2 aucun badge honneur proposé', current_setting('w3.p1'),
  format(current_setting('w3.q_adm'), 'count(*) filter (where famille = ''honneur'')::text', current_setting('w3.felix')), '0');
select pg_temp.essai('A3 « 3 points » (basketball) n''est pas proposé à un joueur de football', current_setting('w3.p1'),
  format(current_setting('w3.q_adm'), 'count(*) filter (where code = ''3-points'')::text', current_setting('w3.felix')), '0');
select pg_temp.essai('A4 les 5 universels sont marqués « déjà porté — son coach »', current_setting('w3.p1'),
  format(current_setting('w3.q_adm'), 'count(*) filter (where deja_par = ''son coach'')::text', current_setting('w3.felix')), '5');
select pg_temp.essai('A5 le coach ne lit pas la liste', current_setting('w3.coach'),
  format(current_setting('w3.q_adm'), 'count(*)::text', current_setting('w3.felix')), 'ERR:42501');
select pg_temp.essai('A6 le recruteur ne lit pas la liste', current_setting('w3.rec'),
  format(current_setting('w3.q_adm'), 'count(*)::text', current_setting('w3.felix')), 'ERR:42501');
select pg_temp.essai('A7 l''athlète ne lit pas la liste', current_setting('w3.ath_user'),
  format(current_setting('w3.q_adm'), 'count(*)::text', current_setting('w3.felix')), 'ERR:42501');

-- ── Pose : refus ───────────────────────────────────────────────────────────
select set_config('w3.q_pose', 'select (public.partenaire_attribuer_badge_nexus(%L, %L) is not null)::text', true);
select pg_temp.essai_msg('R1 badge de SPORT pour un autre sport : « 3 points » à un joueur de football → refusé', current_setting('w3.p1'),
  format(current_setting('w3.q_pose'), current_setting('w3.felix'), current_setting('w3.b_3pts')),
  '22023', 'NEXUS: le badge « 3 points » ne s''applique pas au sport de cet athlète (Football)');
select pg_temp.essai_msg('R2 DOUBLON avec le coach : « Clutch » déjà posé par le coach → refusé', current_setting('w3.p1'),
  format(current_setting('w3.q_pose'), current_setting('w3.felix'), current_setting('w3.b_clutch')),
  '23505', 'NEXUS: cet athlète a déjà le badge « Clutch » (attribué par son coach)');
select pg_temp.essai_msg('R3 badge HONNEUR (MVP) → refusé', current_setting('w3.p1'),
  format(current_setting('w3.q_pose'), current_setting('w3.felix'), current_setting('w3.b_mvp')),
  '42501', 'NEXUS: le badge « MVP » ne peut pas être attribué par un partenaire');
select pg_temp.essai('R4 athlète NON éligible → refusé', current_setting('w3.p1'),
  format(current_setting('w3.q_pose'), current_setting('w3.nathan'), current_setting('w3.b_vitesse')), 'ERR:42501');
select pg_temp.essai('R5 le coach pose un badge Nexus « partenaire » → refusé', current_setting('w3.coach'),
  format(current_setting('w3.q_pose'), current_setting('w3.felix'), current_setting('w3.b_vitesse')), 'ERR:42501');
select pg_temp.essai('R6 l''athlète se pose un badge → refusé', current_setting('w3.ath_user'),
  format(current_setting('w3.q_pose'), current_setting('w3.felix'), current_setting('w3.b_vitesse')), 'ERR:42501');
select pg_temp.essai('R7 p1 pose au nom de p2 → refusé', current_setting('w3.p1'),
  format('select (public.partenaire_attribuer_badge_nexus(%L, %L, %L) is not null)::text',
         current_setting('w3.felix'), current_setting('w3.b_vitesse'), current_setting('w3.mp2')), 'ERR:42501');
select pg_temp.essai('R8 l''admin sans nommer de partenaire → refusé', current_setting('w3.admin'),
  format(current_setting('w3.q_pose'), current_setting('w3.felix'), current_setting('w3.b_vitesse')), 'ERR:22023');
select pg_temp.essai('R9 l''admin non plus ne pose « 3 points » à un joueur de football', current_setting('w3.admin'),
  format('select (public.partenaire_attribuer_badge_nexus(%L, %L, %L) is not null)::text',
         current_setting('w3.felix'), current_setting('w3.b_3pts'), current_setting('w3.mp1')), 'ERR:22023');
select pg_temp.essai('R10 écriture directe dans partner_athlete_badges → refusée', current_setting('w3.p1'),
  format($q$with i as (insert into public.partner_athlete_badges (partner_id, badge_id, athlete_id) values (%L, %L, %L) returning 1) select count(*)::text from i$q$,
         current_setting('w3.mp1'), current_setting('w3.b_vitesse'), current_setting('w3.felix')), 'ERR:42501');

-- ── Pose : hors plafond ────────────────────────────────────────────────────
select pg_temp.essai('P1 Félix a 5 badges coach (plafond atteint)', current_setting('w3.admin'),
  format('select count(*)::text from public.athlete_badges where athlete_id = %L and retire_le is null', current_setting('w3.felix')), '5');
select pg_temp.essai('P2 p1 pose « Vitesse » (football) malgré le plafond', current_setting('w3.p1'),
  format($q$with p as (select public.partenaire_attribuer_badge_nexus(%L, %L) id)
            insert into _ids select 'pose_vitesse', id from p returning (id is not null)::text$q$,
         current_setting('w3.felix'), current_setting('w3.b_vitesse')), 'true');
select pg_temp.essai_msg('P3 DOUBLON avec soi-même → refusé', current_setting('w3.p1'),
  format(current_setting('w3.q_pose'), current_setting('w3.felix'), current_setting('w3.b_vitesse')),
  '23505', 'NEXUS: cet athlète a déjà le badge « Vitesse » (attribué par vous)');
select pg_temp.essai_msg('P4 DOUBLON avec un autre partenaire → refusé', current_setting('w3.p2'),
  format(current_setting('w3.q_pose'), current_setting('w3.felix'), current_setting('w3.b_vitesse')),
  '23505', 'NEXUS: cet athlète a déjà le badge « Vitesse » (attribué par Média Preuve)');
select pg_temp.essai('P5 LIMITE DE 5 INTACTE : un 6e badge coach est toujours refusé', current_setting('w3.coach'),
  format($q$with i as (insert into public.athlete_badges (athlete_id, badge_id, attribue_par)
                      values (%L, %L, %L) returning 1)
            select count(*)::text from i$q$,
         current_setting('w3.felix'), current_setting('w3.b_radar'), current_setting('w3.coach')), 'ERR:P0001');
select pg_temp.essai('P6 aucune ligne athlete_badges touchée par W3b', current_setting('w3.admin'),
  $q$select ((select md5(string_agg(id::text || coalesce(retire_le::text, '∅'), ',' order by id)) from public.athlete_badges) = t.badges_coach)::text
       from _temoin t$q$, 'true');
select pg_temp.essai('P7 la liste dit maintenant « Vitesse — Média Preuve »', current_setting('w3.p2'),
  format(current_setting('w3.q_adm') || ' where code = ''vitesse''', 'deja_par', current_setting('w3.felix')), 'Média Preuve');

-- ── Lecture ────────────────────────────────────────────────────────────────
select set_config('w3.q_lire', 'select %s from public.badges_partenaires_athlete(%L)', true);
select pg_temp.essai('L1 le recruteur lit le badge Nexus : code, libellé, organisation', current_setting('w3.rec'),
  format(current_setting('w3.q_lire'), 'string_agg(badge_code || '' / '' || libelle || '' / '' || organisation || '' / '' || est_nexus, '','')', current_setting('w3.felix')),
  'vitesse / Vitesse / Média Preuve / true');
select pg_temp.essai('L2 l''athlète le lit, sans pouvoir le masquer', current_setting('w3.ath_user'),
  format(current_setting('w3.q_lire'), 'string_agg(peut_masquer::text, '','')', current_setting('w3.felix')), 'false');
select pg_temp.essai('L3 un autre coach ne lit rien', current_setting('w3.autre_coach'),
  format(current_setting('w3.q_lire'), 'count(*)::text', current_setting('w3.felix')), '0');
-- un badge PROPRE (W3) cohabite : l'admin le crée, p1 le pose
select pg_temp.essai('L4 W3 inchangé : p1 pose aussi son badge propre', current_setting('w3.admin'),
  format($q$with b as (select public.admin_enregistrer_badge_partenaire(null, %L, 'Esprit sportif', null, true, 0) id)
            insert into _ids select 'b1', id from b returning (id is not null)::text$q$, current_setting('w3.mp1')), 'true');
select pg_temp.essai('L5 pose du badge propre par p1', current_setting('w3.p1'),
  format($q$with p as (select public.partenaire_attribuer_badge(%L, (select id from _ids where cle = 'b1')) id)
            insert into _ids select 'pose_propre', id from p returning (id is not null)::text$q$, current_setting('w3.felix')), 'true');
select pg_temp.essai('L6 le recruteur lit les deux (badge Nexus et badge propre)', current_setting('w3.rec'),
  format(current_setting('w3.q_lire'), 'string_agg(libelle || ''='' || est_nexus, '','' order by libelle)', current_setting('w3.felix')),
  'Esprit sportif=false,Vitesse=true');
reset role;
select pg_temp.essai('L7 la pose W3 porte son partenaire (partner_id posé par la nouvelle version)', null,
  format($q$select (partner_id = %L and badge_id is null)::text from public.partner_athlete_badges where id = (select id from _ids where cle = 'pose_propre')$q$,
         current_setting('w3.mp1')), 'true');
set local role authenticated;

-- ── Masquage par le coach ──────────────────────────────────────────────────
select set_config('w3.q_masque', 'select public.coach_masquer_badge_partenaire((select id from _ids where cle = ''pose_vitesse''), %s)::text', true);
select pg_temp.essai('M1 l''athlète masque → refusé', current_setting('w3.ath_user'), format(current_setting('w3.q_masque'), 'true'), 'ERR:42501');
select pg_temp.essai('M2 p1 masque → refusé (c''est au coach)', current_setting('w3.p1'), format(current_setting('w3.q_masque'), 'true'), 'ERR:42501');
select pg_temp.essai('M3 le coach masque le badge Nexus', current_setting('w3.coach'), format(current_setting('w3.q_masque'), 'true'), '');
select pg_temp.essai('M4 masqué : le recruteur ne voit plus que le badge propre', current_setting('w3.rec'),
  format(current_setting('w3.q_lire'), 'string_agg(libelle, '','')', current_setting('w3.felix')), 'Esprit sportif');
select pg_temp.essai('M5 masqué : le coach le voit, marqué masqué', current_setting('w3.coach'),
  format(current_setting('w3.q_lire'), 'string_agg(libelle || ''='' || est_masque, '','' order by libelle)', current_setting('w3.felix')), 'Esprit sportif=false,Vitesse=true');
select pg_temp.essai('M6 le coach réaffiche', current_setting('w3.coach'), format(current_setting('w3.q_masque'), 'false'), '');

-- ── Retrait ────────────────────────────────────────────────────────────────
select set_config('w3.q_retire', 'select public.retirer_badge_partenaire((select id from _ids where cle = %L))::text', true);
select pg_temp.essai('X1 p2 retire le badge Nexus posé par p1 → refusé', current_setting('w3.p2'), format(current_setting('w3.q_retire'), 'pose_vitesse'), 'ERR:42501');
select pg_temp.essai('X2 le coach retire → refusé (il peut seulement masquer)', current_setting('w3.coach'), format(current_setting('w3.q_retire'), 'pose_vitesse'), 'ERR:42501');
select pg_temp.essai('X3 l''athlète retire → refusé', current_setting('w3.ath_user'), format(current_setting('w3.q_retire'), 'pose_vitesse'), 'ERR:42501');
select pg_temp.essai('X4 p1 retire son badge Nexus', current_setting('w3.p1'), format(current_setting('w3.q_retire'), 'pose_vitesse'), '');
select pg_temp.essai('X5 retiré : il disparaît pour le recruteur', current_setting('w3.rec'),
  format(current_setting('w3.q_lire'), 'string_agg(libelle, '','')', current_setting('w3.felix')), 'Esprit sportif');
reset role;
select pg_temp.essai('X6 trace gardée : qui (p1) et quand', null,
  format($q$select (retire_le is not null and retire_par = %L)::text from public.partner_athlete_badges where id = (select id from _ids where cle = 'pose_vitesse')$q$,
         current_setting('w3.p1')), 'true');
set local role authenticated;
select pg_temp.essai('X7 retiré, il peut être reposé — ici par p2', current_setting('w3.p2'),
  format($q$with p as (select public.partenaire_attribuer_badge_nexus(%L, %L) id)
            insert into _ids select 'pose_p2', id from p returning (id is not null)::text$q$,
         current_setting('w3.felix'), current_setting('w3.b_vitesse')), 'true');
select pg_temp.essai('X8 l''admin retire le badge de p2', current_setting('w3.admin'), format(current_setting('w3.q_retire'), 'pose_p2'), '');

-- ── L'admin pour le compte d'un partenaire ─────────────────────────────────
select pg_temp.essai('Z1 l''admin attribue « Vision du jeu » pour le compte de p1', current_setting('w3.admin'),
  format($q$with p as (select public.partenaire_attribuer_badge_nexus(%L, %L, %L) id)
            insert into _ids select 'pose_admin', id from p returning (id is not null)::text$q$,
         current_setting('w3.felix'), current_setting('w3.b_radar'), current_setting('w3.mp1')), 'true');
select pg_temp.essai('Z2 signé par p1 (Média Preuve), et p1 peut le retirer', current_setting('w3.p1'),
  format(current_setting('w3.q_lire') || ' where badge_code = ''radar''', 'organisation || '' / '' || est_le_mien', current_setting('w3.felix')),
  'Média Preuve / true');
select pg_temp.essai('Z3 l''admin ne pose pas pour un partenaire non approuvé', current_setting('w3.admin'),
  format($q$select (public.partenaire_attribuer_badge_nexus(%L, %L, (select mp.id from public.media_partners mp where mp.status = 'REVOKED' limit 1)) is not null)::text$q$,
         current_setting('w3.felix'), current_setting('w3.b_vitesse')), 'ERR:42501');

-- ── Droits d'exécution : liste complète (jamais par inclusion) ─────────────
select pg_temp.essai('D1 ACL des 6 fonctions = {authenticated, postgres, service_role}', null,
  $q$select string_agg(distinct acl, ' | ')
       from (select array_agg(t.g order by t.g)::text acl
               from pg_proc pr,
                    lateral (select coalesce(nullif(split_part(x,'=',1),''),'PUBLIC') as g from unnest(pr.proacl::text[]) as x) t
              where pr.pronamespace = 'public'::regnamespace
                and pr.proname in ('partenaire_badges_nexus_admissibles', 'partenaire_attribuer_badge_nexus',
                                   'partenaire_attribuer_badge', 'retirer_badge_partenaire',
                                   'coach_masquer_badge_partenaire', 'badges_partenaires_athlete')
              group by pr.oid) s$q$, '{authenticated,postgres,service_role}');
select pg_temp.essai('D2 badge_plafond et M10 inchangés (md5)', null,
  $q$select md5(pg_get_functiondef('public.badge_plafond()'::regprocedure)) || ' ' || md5(pg_get_functiondef('public.ambassadeur_recalculer_paliers()'::regprocedure))$q$,
  '171a82c74237a5a6d9c5f50c74f44d5e 481cf443a2db040fd840a1e229b325f2');
reset role;
set local role anon;
select pg_temp.essai('D3 anon n''exécute rien (rôle anon réel)', null,
  format('select count(*)::text from public.badges_partenaires_athlete(%L)', current_setting('w3.felix')), 'ERR:42501');
reset role;
select n, case when ok then 'OK' else 'ÉCHEC' end as res, test, detail from _res order by n;
select count(*) filter (where ok) as ok, count(*) filter (where not ok) as echecs from _res;

rollback;
