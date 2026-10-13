-- Tests W2 (20261013200000), base LOCALE. Une transaction annulée à la fin : rien ne survit.
-- Comptes résolus par courriel ; chaque essai tourne sous le VRAI rôle avec un JWT simulé.
-- Athlète cible : Félix Gauthier (football, 17 ans, compte athlète, coach, JAMAIS évalué).
\set ON_ERROR_STOP 1
\pset footer off
begin;

create temp table _res (n serial, test text, ok boolean, detail text) on commit drop;
grant all on _res to authenticated, anon, service_role;
grant usage on sequence _res_n_seq to authenticated, anon, service_role;

select set_config('w2.p1',    (select id::text from public.users where email = 'p1.partenaire@preuve.local'), true);
select set_config('w2.p2',    (select id::text from public.users where email = 'p2.suspendu@preuve.local'), true);
select set_config('w2.admin', (select id::text from public.users where email = 'admin@demo.local'), true);
select set_config('w2.rec',   (select id::text from public.users where email = 'julie.lambert@exemple.test'), true);
select set_config('w2.coach', (select id::text from public.users where email = 'marc.desrosiers@exemple.test'), true);
select set_config('w2.autre_coach', (select id::text from public.users where email = 'c1.coach@preuve.local'), true);
select set_config('w2.ath_user', (select id::text from public.users where email = 'felix.gauthier@exemple.test'), true);
select set_config('w2.mp1',   (select mp.id::text from public.media_partners mp join public.users u on u.id = mp.user_id where u.email = 'p1.partenaire@preuve.local'), true);
select set_config('w2.mp2',   (select mp.id::text from public.media_partners mp join public.users u on u.id = mp.user_id where u.email = 'p2.suspendu@preuve.local'), true);
select set_config('w2.foot',  (select id::text from public.sports where nom = 'Football'), true);
select set_config('w2.flag',  (select id::text from public.sports where nom = 'Flag football'), true);
select set_config('w2.felix', (select a.id::text from public.athletes a join public.users u on u.id = a.user_id where u.email = 'felix.gauthier@exemple.test'), true);
select set_config('w2.nathan','d3a00000-0000-4000-8000-0000000c2003', true);  -- football, NON éligible (opt-in faux)

-- Préparation (postgres) : Félix devient éligible (17 ans + opt-in). Annulé à la fin.
update public.athletes set partner_visibility_opt_in = true where id = current_setting('w2.felix')::uuid;

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

-- Témoins de ce que W2 ne doit jamais toucher.
create temp table _temoin on commit drop as
select (select count(*) from public.evaluations) as nb_eval,
       (select md5(string_agg(id::text || coalesce(cote_globale_entraineur::text, '∅'), ',' order by id)) from public.athletes) as cotes;
grant select on _temoin to authenticated, anon, service_role;

select set_config('w2.q_eval', 'select public.partenaire_evaluer_athlete(%L, %s, %L::jsonb) is not null', true);

set local role authenticated;

-- ── Refus ──────────────────────────────────────────────────────────────────
select pg_temp.essai('R1 p1 SANS permission (peut_evaluer faux) → refusé', current_setting('w2.p1'),
  format(current_setting('w2.q_eval'), current_setting('w2.felix'), '4', '{}'), 'ERR:42501');

select pg_temp.essai('prep admin : peut_evaluer = true (p1)', current_setting('w2.admin'),
  format($q$with u as (update public.media_partners set peut_evaluer = true where id = %L returning 1) select count(*)::text from u$q$, current_setting('w2.mp1')), '1');
select pg_temp.essai('prep admin : p1 permis en Flag football SEULEMENT', current_setting('w2.admin'),
  format($q$with i as (insert into public.partenaire_sports_permis (partner_id, sport_id) values (%L, %L) returning 1) select count(*)::text from i$q$,
         current_setting('w2.mp1'), current_setting('w2.flag')), '1');
select pg_temp.essai('R2 p1 permis, mais PAS le football → refusé', current_setting('w2.p1'),
  format(current_setting('w2.q_eval'), current_setting('w2.felix'), '4', '{}'), 'ERR:42501');

select pg_temp.essai('prep admin : p1 permis en Football', current_setting('w2.admin'),
  format($q$with i as (insert into public.partenaire_sports_permis (partner_id, sport_id) values (%L, %L) returning 1) select count(*)::text from i$q$,
         current_setting('w2.mp1'), current_setting('w2.foot')), '1');
select pg_temp.essai('R3 athlète NON éligible (opt-in faux) → refusé', current_setting('w2.p1'),
  format(current_setting('w2.q_eval'), current_setting('w2.nathan'), '4', '{}'), 'ERR:42501');
select pg_temp.essai('R4 partenaire suspendu (p2) → refusé', current_setting('w2.p2'),
  format(current_setting('w2.q_eval'), current_setting('w2.felix'), '4', '{}'), 'ERR:42501');
select pg_temp.essai('R5 un coach appelle la RPC → refusé', current_setting('w2.coach'),
  format(current_setting('w2.q_eval'), current_setting('w2.felix'), '4', '{}'), 'ERR:42501');
select pg_temp.essai('R6 p1 écrit partner_evaluations en direct → refusé', current_setting('w2.p1'),
  format($q$with i as (insert into public.partner_evaluations (partner_id, athlete_id, cote_globale) values (%L, %L, 5) returning 1) select count(*)::text from i$q$,
         current_setting('w2.mp1'), current_setting('w2.felix')), 'ERR:42501');
select pg_temp.essai('R7 p1 lit partner_evaluations en direct → refusé', current_setting('w2.p1'),
  $q$select count(*)::text from public.partner_evaluations$q$, 'ERR:42501');
select pg_temp.essai('R8 cote absente, aucun critère → refusé', current_setting('w2.p1'),
  format(current_setting('w2.q_eval'), current_setting('w2.felix'), 'null', '{}'), 'ERR:22023');
select pg_temp.essai('R9 cote hors échelle (6) → refusé', current_setting('w2.p1'),
  format(current_setting('w2.q_eval'), current_setting('w2.felix'), '6', '{}'), 'ERR:22023');
select pg_temp.essai('R10 critère inconnu → refusé', current_setting('w2.p1'),
  format(current_setting('w2.q_eval'), current_setting('w2.felix'), '4', '{"vitesse":4}'), 'ERR:22023');
select pg_temp.essai('R11 critère entier en demi (leadership 3.5) → refusé', current_setting('w2.p1'),
  format(current_setting('w2.q_eval'), current_setting('w2.felix'), '4', '{"leadership":3.5}'), 'ERR:22023');

-- ── Contexte du bouton « Évaluer » ─────────────────────────────────────────
select pg_temp.essai('C1 contexte p1 / Félix → peut évaluer', current_setting('w2.p1'),
  format('select peut_evaluer::text from public.partenaire_evaluation_contexte(%L)', current_setting('w2.felix')), 'true');
select pg_temp.essai('C2 contexte p1 / Nathan (non éligible) → non', current_setting('w2.p1'),
  format('select peut_evaluer::text from public.partenaire_evaluation_contexte(%L)', current_setting('w2.nathan')), 'false');
select pg_temp.essai('C3 contexte coach / Félix → non', current_setting('w2.coach'),
  format('select peut_evaluer::text from public.partenaire_evaluation_contexte(%L)', current_setting('w2.felix')), 'false');
select pg_temp.essai('C4 contexte : grille résolue (non nulle)', current_setting('w2.p1'),
  format('select (grille_id is not null)::text from public.partenaire_evaluation_contexte(%L)', current_setting('w2.felix')), 'true');

-- ── Écriture ───────────────────────────────────────────────────────────────
select pg_temp.essai('E1 p1 évalue Félix en simple (4.5)', current_setting('w2.p1'),
  format(current_setting('w2.q_eval'), current_setting('w2.felix'), '4.5', '{}'), 'true');
select pg_temp.essai('E2 cote_globale_entraineur de Félix toujours NULL', current_setting('w2.admin'),
  format('select coalesce(cote_globale_entraineur::text, ''NULL'') from public.athletes where id = %L', current_setting('w2.felix')), 'NULL');
select pg_temp.essai('E3 aucune ligne evaluations ajoutée, aucune cote coach modifiée', current_setting('w2.admin'),
  $q$select ((select count(*) from public.evaluations) = t.nb_eval
           and (select md5(string_agg(id::text || coalesce(cote_globale_entraineur::text, '∅'), ',' order by id)) from public.athletes) = t.cotes)::text
       from _temoin t$q$, 'true');

reset role;
-- Le partenaire modifie : critères notés → la cote devient leur moyenne (le détaillé gagne).
set local role authenticated;
select pg_temp.essai('E4 p1 modifie en détaillé (leadership 5, vitesse 4) — cote 2 ignorée', current_setting('w2.p1'),
  format(current_setting('w2.q_eval'), current_setting('w2.felix'), '2', '{"leadership":5,"vitesse_explosivite":4,"discipline":null,"resilience":0}'), 'true');
select pg_temp.essai('E5 une seule ligne (partenaire, athlète), cote = 4.5', current_setting('w2.p1'),
  format('select count(*)::text || '' '' || max(cote_globale)::text from public.evaluations_partenaires_athlete(%L)', current_setting('w2.felix')), '1 4.50');
select pg_temp.essai('E6 critères stockés, non notés à NULL', current_setting('w2.p1'),
  format('select concat_ws(''/'', leadership, vitesse_explosivite, coalesce(discipline::text, ''∅''), coalesce(resilience::text, ''∅'')) from public.evaluations_partenaires_athlete(%L)', current_setting('w2.felix')), '5/4.0/∅/∅');
select pg_temp.essai('E7 toujours aucune écriture côté coach', current_setting('w2.admin'),
  $q$select ((select count(*) from public.evaluations) = t.nb_eval
           and (select md5(string_agg(id::text || coalesce(cote_globale_entraineur::text, '∅'), ',' order by id)) from public.athletes) = t.cotes)::text
       from _temoin t$q$, 'true');

-- ── Lecture ────────────────────────────────────────────────────────────────
select pg_temp.essai('L1 recruteur lit l''évaluation, signée par l''organisation', current_setting('w2.rec'),
  format('select organisation || '' '' || cote_globale::text from public.evaluations_partenaires_athlete(%L)', current_setting('w2.felix')), 'Média Preuve 4.50');
select pg_temp.essai('L2 la projection ne porte AUCUNE colonne de personne', current_setting('w2.rec'),
  $q$select (not exists (select 1 from pg_proc p, unnest(p.proargnames) a
                         where p.oid = 'public.evaluations_partenaires_athlete(uuid)'::regprocedure
                           and a in ('evalue_par', 'user_id', 'contact_name', 'contact_email', 'partner_id')))::text$q$, 'true');
select pg_temp.essai('L3 coach de l''athlète lit', current_setting('w2.coach'),
  format('select count(*)::text from public.evaluations_partenaires_athlete(%L)', current_setting('w2.felix')), '1');
select pg_temp.essai('L4 l''athlète lui-même lit', current_setting('w2.ath_user'),
  format('select count(*)::text from public.evaluations_partenaires_athlete(%L)', current_setting('w2.felix')), '1');
select pg_temp.essai('L5 un autre coach ne lit rien', current_setting('w2.autre_coach'),
  format('select count(*)::text from public.evaluations_partenaires_athlete(%L)', current_setting('w2.felix')), '0');
select pg_temp.essai('L6 p1 lit la sienne (est_la_mienne)', current_setting('w2.p1'),
  format('select est_la_mienne::text from public.evaluations_partenaires_athlete(%L)', current_setting('w2.felix')), 'true');
select pg_temp.essai('L7 p2 (autre partenaire) ne lit rien', current_setting('w2.p2'),
  format('select count(*)::text from public.evaluations_partenaires_athlete(%L)', current_setting('w2.felix')), '0');

-- Opt-in partenaire RETIRÉ : le recruteur la voit toujours (décision BP).
reset role;
update public.athletes set partner_visibility_opt_in = false where id = current_setting('w2.felix')::uuid;
set local role authenticated;
select pg_temp.essai('L8 opt-in retiré : le recruteur la lit toujours', current_setting('w2.rec'),
  format('select count(*)::text from public.evaluations_partenaires_athlete(%L)', current_setting('w2.felix')), '1');
select pg_temp.essai('L9 opt-in retiré : le partenaire ne peut plus la modifier', current_setting('w2.p1'),
  format(current_setting('w2.q_eval'), current_setting('w2.felix'), '3', '{}'), 'ERR:42501');

-- ── Recherche recruteur (filtre « 4+ » et tri) ─────────────────────────────
select pg_temp.essai('S1 « 4+ étoiles » : Félix (partenaire seul) présent', current_setting('w2.rec'),
  format('select count(*)::text from public.recruiter_search_athletes(p_min_rating => 4) where id = %L', current_setting('w2.felix')), '1');
select pg_temp.essai('S2 … avec cote_globale (coach) NULL et le libellé du partenaire', current_setting('w2.rec'),
  format('select coalesce(cote_globale::text, ''NULL'') || '' / '' || cote_partenaire::text || '' / '' || cote_partenaire_organisation from public.recruiter_search_athletes(p_min_rating => 4) where id = %L', current_setting('w2.felix')), 'NULL / 4.50 / Média Preuve');
select pg_temp.essai('S3 tri par cote : 4.5 (partenaire) entre les 5.0 et les 4.0 des coachs', current_setting('w2.rec'),
  format($q$with r as (select id, coalesce(cote_globale, cote_partenaire) c, row_number() over () rn
                         from public.recruiter_search_athletes(p_sort_by => 'rating_desc'))
            select ((select max(rn) from r where c = 5) < (select rn from r where id = %L)
                and (select rn from r where id = %L) < (select min(rn) from r where c = 4))::text$q$,
         current_setting('w2.felix'), current_setting('w2.felix')), 'true');

-- ── Le coach évalue : sa note passe devant ─────────────────────────────────
select pg_temp.essai('K1 le coach évalue Félix (2.0, simple)', current_setting('w2.coach'),
  format($q$with i as (insert into public.evaluations (coach_id, athlete_id, cote_globale) values (%L, %L, 2) returning 1) select count(*)::text from i$q$,
         current_setting('w2.coach'), current_setting('w2.felix')), '1');
select pg_temp.essai('K2 cote_globale_entraineur = 2 (écrite par le coach, pas par W2)', current_setting('w2.admin'),
  format('select cote_globale_entraineur::text from public.athletes where id = %L', current_setting('w2.felix')), '2.00');
select pg_temp.essai('K3 « 4+ étoiles » : Félix sort (la cote du coach prime)', current_setting('w2.rec'),
  format('select count(*)::text from public.recruiter_search_athletes(p_min_rating => 4) where id = %L', current_setting('w2.felix')), '0');
select pg_temp.essai('K4 recherche : cote coach 2 affichée, partenaire 4.5 toujours à part', current_setting('w2.rec'),
  format('select cote_globale::text || '' / '' || cote_partenaire::text from public.recruiter_search_athletes() where id = %L', current_setting('w2.felix')), '2.00 / 4.50');
select pg_temp.essai('K5 tri : Félix rangé sur 2.0 (après tous les 3.0)', current_setting('w2.rec'),
  format($q$with r as (select id, coalesce(cote_globale, cote_partenaire) c, row_number() over () rn
                         from public.recruiter_search_athletes(p_sort_by => 'rating_desc'))
            select ((select max(rn) from r where c = 3) < (select rn from r where id = %L))::text$q$, current_setting('w2.felix')), 'true');
select pg_temp.essai('K6 la section partenaire reste (recruteur)', current_setting('w2.rec'),
  format('select count(*)::text from public.evaluations_partenaires_athlete(%L)', current_setting('w2.felix')), '1');
select pg_temp.essai('K7 l''évaluation partenaire est intacte (4.5)', current_setting('w2.coach'),
  format('select cote_globale::text from public.evaluations_partenaires_athlete(%L)', current_setting('w2.felix')), '4.50');

-- ── Anonyme et service_role ────────────────────────────────────────────────
reset role;
set local role anon;
select pg_temp.essai('A1 anon : lecture → refusé', null,
  format('select count(*)::text from public.evaluations_partenaires_athlete(%L)', current_setting('w2.felix')), 'ERR:42501');
select pg_temp.essai('A2 anon : écriture → refusé', null,
  format(current_setting('w2.q_eval'), current_setting('w2.felix'), '4', '{}'), 'ERR:42501');
select pg_temp.essai('A3 anon : recherche → refusé', null,
  'select count(*)::text from public.recruiter_search_athletes()', 'ERR:42501');
reset role;

select n, case when ok then 'OK' else 'ÉCHEC' end as res, test, detail from _res order by n;
select count(*) filter (where ok) as ok, count(*) filter (where not ok) as echecs from _res;

rollback;
