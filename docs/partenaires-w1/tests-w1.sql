-- Tests W1 (20261013181000), base LOCALE. Une transaction annulée à la fin : rien ne survit.
-- Comptes de preuve locaux, résolus par courriel. Chaque essai tourne sous le VRAI rôle
-- (authenticated / anon) avec un JWT simulé — RLS, garde W0 et ACL s'appliquent.
\set ON_ERROR_STOP 1
\pset footer off
begin;

create temp table _res (n serial, test text, ok boolean, detail text) on commit drop;
grant all on _res to authenticated, anon, service_role;
grant usage on sequence _res_n_seq to authenticated, anon, service_role;

select set_config('w1.p1',    (select id::text from public.users where email = 'p1.partenaire@preuve.local'), true);
select set_config('w1.p2',    (select id::text from public.users where email = 'p2.suspendu@preuve.local'), true);
select set_config('w1.admin', (select id::text from public.users where email = 'admin@demo.local'), true);
select set_config('w1.coach', (select id::text from public.users where email = 'c1.coach@preuve.local'), true);
select set_config('w1.mp1',   (select mp.id::text from public.media_partners mp join public.users u on u.id = mp.user_id where u.email = 'p1.partenaire@preuve.local'), true);
select set_config('w1.mp2',   (select mp.id::text from public.media_partners mp join public.users u on u.id = mp.user_id where u.email = 'p2.suspendu@preuve.local'), true);
select set_config('w1.foot',  (select id::text from public.sports where nom = 'Football'), true);
select set_config('w1.flag',  (select id::text from public.sports where nom = 'Flag football'), true);
select set_config('w1.hockey',(select id::text from public.sports where nom = 'Hockey'), true);

-- Un essai : exécute p_sql (une valeur texte) sous l'identité p_uid (NULL = anon) et
-- compare au résultat attendu ('ERR:<sqlstate>' si une erreur est attendue).
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

-- Raccourcis SQL
select set_config('w1.q_peut', 'select public.partenaire_peut_evaluer(%L, %L)::text', true);

-- ── T0 : aucun partenaire existant ne change de comportement ───────────────
insert into _res (test, ok, detail)
select 'T0 aucun partenaire n''a peut_evaluer = true', not exists (select 1 from public.media_partners where peut_evaluer),
       (select count(*) from public.media_partners)::text || ' partenaire(s), tous false';
insert into _res (test, ok, detail)
select 'T0 aucun sport permis', (select count(*) from public.partenaire_sports_permis) = 0, 'table vide';

set local role authenticated;
select pg_temp.essai('T0 p1 (approuvé, rien posé) : garde → faux', current_setting('w1.p1'),
  format(current_setting('w1.q_peut'), current_setting('w1.mp1'), current_setting('w1.foot')), 'false');
select pg_temp.essai('T0 p1 modifie encore sa description (W0 inchangé)', current_setting('w1.p1'),
  $q$with u as (update public.media_partners set description = coalesce(description,'') || ' ' where user_id = auth.uid() returning 1) select count(*)::text from u$q$, '1');
select pg_temp.essai('T0 p1 lit encore sa ligne', current_setting('w1.p1'),
  $q$select count(*)::text from public.media_partners where user_id = auth.uid()$q$, '1');

-- ── T1 : le partenaire ne peut pas se donner la permission ─────────────────
select pg_temp.essai('T1 p1 pose peut_evaluer = true sur SA ligne → refusé (garde W0)', current_setting('w1.p1'),
  $q$with u as (update public.media_partners set peut_evaluer = true where user_id = auth.uid() returning 1) select count(*)::text from u$q$, 'ERR:42501');
select pg_temp.essai('T1 p1 pose peut_evaluer avec une colonne permise → refusé', current_setting('w1.p1'),
  $q$with u as (update public.media_partners set peut_evaluer = true, description = 'x' where user_id = auth.uid() returning 1) select count(*)::text from u$q$, 'ERR:42501');

-- ── T2 : le partenaire ne peut pas écrire ses sports ───────────────────────
select pg_temp.essai('T2 p1 ajoute Football à ses sports → refusé (RLS)', current_setting('w1.p1'),
  format($q$with i as (insert into public.partenaire_sports_permis (partner_id, sport_id) values (%L, %L) returning 1) select count(*)::text from i$q$,
         current_setting('w1.mp1'), current_setting('w1.foot')), 'ERR:42501');

-- ── T3 : l'admin peut ──────────────────────────────────────────────────────
select pg_temp.essai('T3 admin pose peut_evaluer = true (p1)', current_setting('w1.admin'),
  format($q$with u as (update public.media_partners set peut_evaluer = true where id = %L returning 1) select count(*)::text from u$q$, current_setting('w1.mp1')), '1');
select pg_temp.essai('T3 admin pose peut_evaluer = true (p2, suspendu)', current_setting('w1.admin'),
  format($q$with u as (update public.media_partners set peut_evaluer = true where id = %L returning 1) select count(*)::text from u$q$, current_setting('w1.mp2')), '1');
select pg_temp.essai('T3 admin coche Football + Flag football (p1)', current_setting('w1.admin'),
  format($q$with i as (insert into public.partenaire_sports_permis (partner_id, sport_id) values (%L, %L), (%L, %L) returning 1) select count(*)::text from i$q$,
         current_setting('w1.mp1'), current_setting('w1.foot'), current_setting('w1.mp1'), current_setting('w1.flag')), '2');
select pg_temp.essai('T3 admin coche Football (p2)', current_setting('w1.admin'),
  format($q$with i as (insert into public.partenaire_sports_permis (partner_id, sport_id) values (%L, %L) returning 1) select count(*)::text from i$q$,
         current_setting('w1.mp2'), current_setting('w1.foot')), '1');
select pg_temp.essai('T3 doublon de la paire → refusé (unique)', current_setting('w1.admin'),
  format($q$with i as (insert into public.partenaire_sports_permis (partner_id, sport_id) values (%L, %L) returning 1) select count(*)::text from i$q$,
         current_setting('w1.mp1'), current_setting('w1.foot')), 'ERR:23505');

-- Le partenaire ne retire ni ne déplace ses sports (0 ligne touchée, sans erreur : RLS).
select pg_temp.essai('T2 p1 supprime ses sports → 0 ligne', current_setting('w1.p1'),
  format($q$with d as (delete from public.partenaire_sports_permis where partner_id = %L returning 1) select count(*)::text from d$q$, current_setting('w1.mp1')), '0');
select pg_temp.essai('T2 p1 change un de ses sports → 0 ligne', current_setting('w1.p1'),
  format($q$with u as (update public.partenaire_sports_permis set sport_id = %L where partner_id = %L returning 1) select count(*)::text from u$q$,
         current_setting('w1.hockey'), current_setting('w1.mp1')), '0');
select pg_temp.essai('T1 p1 retire sa propre permission → refusé (garde W0)', current_setting('w1.p1'),
  $q$with u as (update public.media_partners set peut_evaluer = false where user_id = auth.uid() returning 1) select count(*)::text from u$q$, 'ERR:42501');

-- ── T5 : lecture des sports permis ─────────────────────────────────────────
select pg_temp.essai('T5 p1 lit ses sports', current_setting('w1.p1'),
  $q$select count(*)::text from public.partenaire_sports_permis$q$, '2');
select pg_temp.essai('T5 p1 ne lit pas ceux de p2', current_setting('w1.p1'),
  format($q$select count(*)::text from public.partenaire_sports_permis where partner_id = %L$q$, current_setting('w1.mp2')), '0');
select pg_temp.essai('T5 coach ne lit rien', current_setting('w1.coach'),
  $q$select count(*)::text from public.partenaire_sports_permis$q$, '0');
select pg_temp.essai('T5 admin lit tout', current_setting('w1.admin'),
  $q$select count(*)::text from public.partenaire_sports_permis$q$, '3');

-- ── T4 : la garde — vraie seulement si les trois critères sont réunis ──────
select pg_temp.essai('T4 p1 : admis + peut_evaluer + Football permis → vrai', current_setting('w1.p1'),
  format(current_setting('w1.q_peut'), current_setting('w1.mp1'), current_setting('w1.foot')), 'true');
select pg_temp.essai('T4 p1 : Flag football permis → vrai', current_setting('w1.p1'),
  format(current_setting('w1.q_peut'), current_setting('w1.mp1'), current_setting('w1.flag')), 'true');
select pg_temp.essai('T4 p1 : Hockey non permis → faux', current_setting('w1.p1'),
  format(current_setting('w1.q_peut'), current_setting('w1.mp1'), current_setting('w1.hockey')), 'false');
select pg_temp.essai('T4 p1 : sport NULL → faux', current_setting('w1.p1'),
  format('select public.partenaire_peut_evaluer(%L, null)::text', current_setting('w1.mp1')), 'false');
select pg_temp.essai('T4 p2 suspendu (peut_evaluer + Football posés) → faux', current_setting('w1.p2'),
  format(current_setting('w1.q_peut'), current_setting('w1.mp2'), current_setting('w1.foot')), 'false');
select pg_temp.essai('T4 p1 interroge la ligne de p2 → faux', current_setting('w1.p1'),
  format(current_setting('w1.q_peut'), current_setting('w1.mp2'), current_setting('w1.foot')), 'false');
select pg_temp.essai('T4 coach interroge la ligne de p1 → faux', current_setting('w1.coach'),
  format(current_setting('w1.q_peut'), current_setting('w1.mp1'), current_setting('w1.foot')), 'false');
select pg_temp.essai('T4 admin interroge la ligne de p1 → faux', current_setting('w1.admin'),
  format(current_setting('w1.q_peut'), current_setting('w1.mp1'), current_setting('w1.foot')), 'false');

-- Critère « admis » seul retiré : p1 passe SUSPENDED, le reste intact.
reset role;
update public.media_partners set status = 'SUSPENDED' where id = current_setting('w1.mp1')::uuid;
set local role authenticated;
select pg_temp.essai('T4 p1 non admis (SUSPENDED), le reste posé → faux', current_setting('w1.p1'),
  format(current_setting('w1.q_peut'), current_setting('w1.mp1'), current_setting('w1.foot')), 'false');
reset role;
update public.media_partners set status = 'APPROVED' where id = current_setting('w1.mp1')::uuid;
set local role authenticated;

-- Critère « peut_evaluer » seul retiré.
select pg_temp.essai('T3 admin retire peut_evaluer (p1)', current_setting('w1.admin'),
  format($q$with u as (update public.media_partners set peut_evaluer = false where id = %L returning 1) select count(*)::text from u$q$, current_setting('w1.mp1')), '1');
select pg_temp.essai('T4 p1 sans peut_evaluer, Football permis → faux', current_setting('w1.p1'),
  format(current_setting('w1.q_peut'), current_setting('w1.mp1'), current_setting('w1.foot')), 'false');
select pg_temp.essai('T3 admin remet peut_evaluer (p1)', current_setting('w1.admin'),
  format($q$with u as (update public.media_partners set peut_evaluer = true where id = %L returning 1) select count(*)::text from u$q$, current_setting('w1.mp1')), '1');

-- Critère « sport permis » seul retiré.
select pg_temp.essai('T3 admin décoche Football (p1)', current_setting('w1.admin'),
  format($q$with d as (delete from public.partenaire_sports_permis where partner_id = %L and sport_id = %L returning 1) select count(*)::text from d$q$,
         current_setting('w1.mp1'), current_setting('w1.foot')), '1');
select pg_temp.essai('T4 p1 : Football décoché → faux', current_setting('w1.p1'),
  format(current_setting('w1.q_peut'), current_setting('w1.mp1'), current_setting('w1.foot')), 'false');
select pg_temp.essai('T4 p1 : Flag football toujours permis → vrai', current_setting('w1.p1'),
  format(current_setting('w1.q_peut'), current_setting('w1.mp1'), current_setting('w1.flag')), 'true');

-- ── Anonyme : ni la table, ni la fonction ──────────────────────────────────
reset role;
set local role anon;
select pg_temp.essai('T5 anon lit partenaire_sports_permis → refusé', null,
  $q$select count(*)::text from public.partenaire_sports_permis$q$, 'ERR:42501');
select pg_temp.essai('T4 anon exécute partenaire_peut_evaluer → refusé', null,
  format(current_setting('w1.q_peut'), current_setting('w1.mp1'), current_setting('w1.flag')), 'ERR:42501');
select pg_temp.essai('T0 anon ne lit pas peut_evaluer (hors des 18 colonnes)', null,
  $q$select count(peut_evaluer)::text from public.media_partners$q$, 'ERR:42501');
reset role;

-- service_role (sans session) : la garde est liée à auth.uid() → faux.
set local role service_role;
select pg_temp.essai('T4 service_role sans session → faux', null,
  format(current_setting('w1.q_peut'), current_setting('w1.mp1'), current_setting('w1.flag')), 'false');
reset role;

select n, case when ok then 'OK' else 'ÉCHEC' end as res, test, detail from _res order by n;
select count(*) filter (where ok) as ok, count(*) filter (where not ok) as echecs from _res;

rollback;
