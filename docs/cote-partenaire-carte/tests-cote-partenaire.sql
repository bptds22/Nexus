-- Tests 20261016170000 (cote partenaire sur la carte + filtres « Mes athlètes »), base LOCALE.
-- Une transaction annulée à la fin : rien ne survit. Mêmes comptes et même harnais que tests-w4d.sql ;
-- chaque essai tourne sous le VRAI rôle (authenticated / anon) avec un JWT simulé.
--   docker cp docs/cote-partenaire-carte/tests-cote-partenaire.sql supabase_db_Nexus:/tmp/tests-cote.sql
--   docker exec -e PGCLIENTENCODING=UTF8 supabase_db_Nexus psql -U postgres -d postgres -q -f /tmp/tests-cote.sql
\set ON_ERROR_STOP 1
\pset footer off
begin;

create temp table _res (n serial, test text, ok boolean, detail text) on commit drop;
create temp table _ids (cle text primary key, id uuid) on commit drop;
grant all on _res, _ids to authenticated, anon, service_role;
grant usage on sequence _res_n_seq to authenticated, anon, service_role;

select set_config('t.p1',     (select id::text from public.users where email = 'p1.partenaire@preuve.local'), true);
select set_config('t.p2',     (select id::text from public.users where email = 'p2.suspendu@preuve.local'), true);
select set_config('t.admin',  (select id::text from public.users where email = 'admin@demo.local'), true);
select set_config('t.rec',    (select id::text from public.users where email = 'julie.lambert@exemple.test'), true);
select set_config('t.coach',  (select id::text from public.users where email = 'marc.desrosiers@exemple.test'), true);
select set_config('t.felix_u',  (select id::text from public.users where email = 'felix.gauthier@exemple.test'), true);
select set_config('t.mathis_u', (select id::text from public.users where email = 'mathis.demo@exemple.test'), true);
select set_config('t.mp1', (select mp.id::text from public.media_partners mp join public.users u on u.id = mp.user_id where u.email = 'p1.partenaire@preuve.local'), true);
select set_config('t.mp2', (select mp.id::text from public.media_partners mp join public.users u on u.id = mp.user_id where u.email = 'p2.suspendu@preuve.local'), true);
select set_config('t.felix',  (select a.id::text from public.athletes a where a.user_id = current_setting('t.felix_u')::uuid), true);
select set_config('t.mathis', (select a.id::text from public.athletes a where a.user_id = current_setting('t.mathis_u')::uuid), true);
select set_config('t.foot',   (select id::text from public.sports where nom = 'Football'), true);
select set_config('t.b_vitesse', (select id::text from public.badges where code = 'vitesse'), true);
select set_config('t.lot', format('array[%L, %L]::uuid[]', current_setting('t.felix'), current_setting('t.mathis')), true);

-- Préparation (postgres) : p1 ET p2 approuvés, évaluateurs en football (deux partenaires sur Félix) ;
-- Félix et Mathis sans opt-in, sans évaluation ni badge partenaire de départ.
update public.media_partners set peut_evaluer = true, status = 'APPROVED'
 where id in (current_setting('t.mp1')::uuid, current_setting('t.mp2')::uuid);
insert into public.partenaire_sports_permis (partner_id, sport_id)
values (current_setting('t.mp1')::uuid, current_setting('t.foot')::uuid),
       (current_setting('t.mp2')::uuid, current_setting('t.foot')::uuid) on conflict do nothing;
update public.athletes set partner_visibility_opt_in = false
 where id in (current_setting('t.felix')::uuid, current_setting('t.mathis')::uuid);
delete from public.partner_evaluations where athlete_id in (current_setting('t.felix')::uuid, current_setting('t.mathis')::uuid);
delete from public.partner_athlete_badges where athlete_id in (current_setting('t.felix')::uuid, current_setting('t.mathis')::uuid);
with b as (
  insert into public.partner_badges (partner_id, libelle, icone_path, actif, ordre)
  values (current_setting('t.mp1')::uuid, 'Esprit sportif filtre', current_setting('t.mp1') || '/filtre.png', true, 0)
  returning id)
insert into _ids select 'pb', id from b;

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

-- Le lot rend EXACTEMENT ce que l'appelant obtient de W2, athlète par athlète (identifiant, organisation, cote).
select set_config('t.q_egal', format($q$select (select count(*) from public.cotes_partenaires_athletes(%1$s))::text || '|' ||
   ((select coalesce(string_agg(id::text || organisation || cote_globale::text, ',' order by id), '') from public.cotes_partenaires_athletes(%1$s))
    = (select coalesce(string_agg(e.id::text || e.organisation || e.cote_globale::text, ',' order by e.id), '')
         from unnest(%1$s) x cross join lateral public.evaluations_partenaires_athlete(x) e))::text$q$, current_setting('t.lot')), true);

set local role authenticated;

-- ── A. Deux partenaires évaluent Félix ───────────────────────────────────────
select pg_temp.essai('A1 Félix active la visibilité partenaire', current_setting('t.felix_u'),
  'select public.set_my_partner_visibility(true, ''2026-08-v1'')->>''ok''', 'true');
select pg_temp.essai('A2 p1 évalue Félix (4)', current_setting('t.p1'),
  format('select (public.partenaire_evaluer_athlete(%L, 4, ''{}''::jsonb) is not null)::text', current_setting('t.felix')), 'true');
select pg_temp.essai('A3 p2 évalue Félix (3)', current_setting('t.p2'),
  format('select (public.partenaire_evaluer_athlete(%L, 3, ''{}''::jsonb) is not null)::text', current_setting('t.felix')), 'true');
select pg_temp.essai('A4 p1 ne peut pas évaluer Mathis (pas d''opt-in)', current_setting('t.p1'),
  format('select (public.partenaire_evaluer_athlete(%L, 4, ''{}''::jsonb) is not null)::text', current_setting('t.mathis')), 'ERR:42501');

-- ── B. Lecture par lot = lecture W2, rôle par rôle ───────────────────────────
select pg_temp.essai('B1 recruteur : les 2 évaluations, identiques à W2', current_setting('t.rec'), current_setting('t.q_egal'), '2|true');
select pg_temp.essai('B2 recruteur : les deux cotes', current_setting('t.rec'),
  format('select string_agg(cote_globale::text, '','' order by cote_globale) from public.cotes_partenaires_athletes(%s)', current_setting('t.lot')), '3.00,4.00');
select pg_temp.essai('B3 Félix lui-même : identique à W2', current_setting('t.felix_u'), current_setting('t.q_egal'), '2|true');
select pg_temp.essai('B4 Mathis (autre athlète) : rien, identique à W2', current_setting('t.mathis_u'), current_setting('t.q_egal'), '0|true');
select pg_temp.essai('B5 p1 : la sienne seulement', current_setting('t.p1'), current_setting('t.q_egal'), '1|true');
select pg_temp.essai('B6 p2 : la sienne seulement', current_setting('t.p2'), current_setting('t.q_egal'), '1|true');
select pg_temp.essai('B7 admin : tout', current_setting('t.admin'), current_setting('t.q_egal'), '2|true');
select pg_temp.essai('B8 coach : identique à W2 (quel que soit son lien)', current_setting('t.coach'),
  'select split_part((' || current_setting('t.q_egal') || '), ''|'', 2)', 'true');
select pg_temp.essai('B9 lot vide ou NULL : aucune ligne', current_setting('t.rec'),
  'select ((select count(*) from public.cotes_partenaires_athletes(''{}''::uuid[])) + (select count(*) from public.cotes_partenaires_athletes(null)))::text', '0');
select pg_temp.essai('B10 doublons dans le lot : pas de lignes doublées', current_setting('t.rec'),
  format('select count(*)::text from public.cotes_partenaires_athletes(array[%L, %L]::uuid[])', current_setting('t.felix'), current_setting('t.felix')), '2');

-- ── C. Fiche inactive, partenaire suspendu, retrait de visibilité ────────────
reset role;
update public.athletes set status = 'DESACTIVE' where id = current_setting('t.felix')::uuid;
set local role authenticated;
select pg_temp.essai('C1 Félix DESACTIVE : rien pour le recruteur', current_setting('t.rec'), current_setting('t.q_egal'), '0|true');
reset role;
update public.athletes set status = 'ACTIF' where id = current_setting('t.felix')::uuid;
update public.media_partners set status = 'SUSPENDED' where id = current_setting('t.mp2')::uuid;
set local role authenticated;
select pg_temp.essai('C2 p2 suspendu : son évaluation cesse d''apparaître', current_setting('t.rec'), current_setting('t.q_egal'), '1|true');
reset role;
update public.media_partners set status = 'APPROVED' where id = current_setting('t.mp2')::uuid;
set local role authenticated;
select pg_temp.essai('C3 Félix retire sa visibilité', current_setting('t.felix_u'),
  'select public.set_my_partner_visibility(false, ''2026-08-v1'')->>''ok''', 'true');
-- Constat, pas un choix de ce lot : W2 ne revérifie pas l'opt-in à la lecture (recruteur, ACTIF).
select pg_temp.essai('C4 CONSTAT W2 : après retrait, le recruteur lit toujours les 2 (règle W2 inchangée)', current_setting('t.rec'), current_setting('t.q_egal'), '2|true');
select pg_temp.essai('C5 Félix réactive', current_setting('t.felix_u'),
  'select public.set_my_partner_visibility(true, ''2026-08-v1'')->>''ok''', 'true');

-- ── D. « Mes athlètes » : poste et badge_ref ─────────────────────────────────
select pg_temp.essai('D1 p1 remet son badge propre à Félix', current_setting('t.p1'),
  format('select (public.partenaire_attribuer_badge(%L, %L) is not null)::text', current_setting('t.felix'), (select id from _ids where cle = 'pb')), 'true');
select pg_temp.essai('D2 p1 remet le badge Nexus Vitesse à Félix', current_setting('t.p1'),
  format('select (public.partenaire_attribuer_badge_nexus(%L, %L) is not null)::text', current_setting('t.felix'), current_setting('t.b_vitesse')), 'true');
select pg_temp.essai('D3 p1 : badge_ref = id du catalogue (Nexus → badges.id, propre → partner_badges.id)', current_setting('t.p1'),
  format($q$select string_agg((b->>'nexus') || ':' || ((b->>'badge_ref')::uuid = case when (b->>'nexus')::boolean then %L::uuid else %L::uuid end)::text, ',' order by b->>'nexus')
            from public.partenaire_mes_athletes() m, jsonb_array_elements(m.badges) b where m.athlete_id = %L$q$,
         current_setting('t.b_vitesse'), (select id from _ids where cle = 'pb'), current_setting('t.felix')), 'false:true,true:true');
reset role;
select set_config('t.poste', coalesce((select po.nom || '|' || coalesce(po.abreviation, '∅') from public.athletes a join public.positions po on po.id = a.position_id where a.id = current_setting('t.felix')::uuid), '∅|∅'), true);
select set_config('t.prenom', (select first_name from public.athletes where id = current_setting('t.felix')::uuid), true);
set local role authenticated;
select pg_temp.essai('D4 p1 : poste et poste_abr = la position de Félix', current_setting('t.p1'),
  format($q$select coalesce(poste, '∅') || '|' || coalesce(poste_abr, '∅') from public.partenaire_mes_athletes() where athlete_id = %L$q$, current_setting('t.felix')),
  current_setting('t.poste'));
select pg_temp.essai('D5 p1 : colonnes W4d inchangées (prénom, cote 4, 2 badges)', current_setting('t.p1'),
  format($q$select prenom || '|' || cote_globale::text || '|' || jsonb_array_length(badges) from public.partenaire_mes_athletes() where athlete_id = %L$q$, current_setting('t.felix')),
  current_setting('t.prenom') || '|4.00|2');
select pg_temp.essai('D6 p2 : Félix, sa cote 3, aucun badge de p1', current_setting('t.p2'),
  format($q$select cote_globale::text || '|' || jsonb_array_length(badges) from public.partenaire_mes_athletes() where athlete_id = %L$q$, current_setting('t.felix')), '3.00|0');
select pg_temp.essai('D7 recruteur : Mes athlètes vide', current_setting('t.rec'), 'select count(*)::text from public.partenaire_mes_athletes()', '0');
select pg_temp.essai('D8 Félix retire sa visibilité', current_setting('t.felix_u'),
  'select public.set_my_partner_visibility(false, ''2026-08-v1'')->>''ok''', 'true');
select pg_temp.essai('D9 p1 : Félix sort de « Mes athlètes »', current_setting('t.p1'),
  format('select count(*)::text from public.partenaire_mes_athletes() where athlete_id = %L', current_setting('t.felix')), '0');

-- ── E. anon et droits ────────────────────────────────────────────────────────
reset role;
set local role anon;
select pg_temp.essai('E1 anon : lot refusé', null, format('select count(*)::text from public.cotes_partenaires_athletes(%s)', current_setting('t.lot')), 'ERR:42501');
select pg_temp.essai('E2 anon : Mes athlètes refusée', null, 'select count(*)::text from public.partenaire_mes_athletes()', 'ERR:42501');
reset role;
select pg_temp.essai('E3 ACL complètes', null,
  $q$select string_agg(proname || '=' || array_to_string(array(select coalesce(nullif(split_part(x, '=', 1), ''), 'PUBLIC') from unnest(proacl::text[]) x order by 1), ','), ';' order by proname)
       from pg_proc where pronamespace = 'public'::regnamespace and proname in ('cotes_partenaires_athletes', 'partenaire_mes_athletes')$q$,
  'cotes_partenaires_athletes=authenticated,postgres,service_role;partenaire_mes_athletes=authenticated,postgres,service_role');
select pg_temp.essai('E4 le lot est INVOKER, Mes athlètes DEFINER', null,
  $q$select string_agg(proname || '=' || prosecdef, ',' order by proname) from pg_proc where pronamespace = 'public'::regnamespace and proname in ('cotes_partenaires_athletes', 'partenaire_mes_athletes')$q$,
  'cotes_partenaires_athletes=false,partenaire_mes_athletes=true');

select n, case when ok then 'OK' else 'ÉCHEC' end as verdict, test, detail from _res order by n;
select count(*) filter (where ok) as ok, count(*) filter (where not ok) as echecs from _res;
rollback;
