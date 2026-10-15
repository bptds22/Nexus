-- Tests W4d (20261015110727), base LOCALE. Une transaction annulée à la fin : rien ne survit.
-- « Terminées » nommées seulement si le jeune est encore visible du partenaire, « Mes athlètes »,
-- compteur admin. Même harnais et mêmes comptes que tests-w4a.sql ; chaque essai tourne sous le
-- VRAI rôle (authenticated / anon) avec un JWT simulé.
--   docker cp docs/partenaires-w4d/tests-w4d.sql supabase_db_Nexus:/tmp/tests-w4d.sql
--   docker exec -e PGCLIENTENCODING=UTF8 supabase_db_Nexus psql -U postgres -d postgres -q -f /tmp/tests-w4d.sql
\set ON_ERROR_STOP 1
\pset footer off
begin;

create temp table _res (n serial, test text, ok boolean, detail text) on commit drop;
create temp table _ids (cle text primary key, id uuid) on commit drop;
create temp table _jet (cle text primary key, jeton text) on commit drop;
grant all on _res, _ids, _jet to authenticated, anon, service_role;
grant usage on sequence _res_n_seq to authenticated, anon, service_role;

select set_config('w4.p1',     (select id::text from public.users where email = 'p1.partenaire@preuve.local'), true);
select set_config('w4.p2',     (select id::text from public.users where email = 'p2.suspendu@preuve.local'), true);
select set_config('w4.admin',  (select id::text from public.users where email = 'admin@demo.local'), true);
select set_config('w4.rec',    (select id::text from public.users where email = 'julie.lambert@exemple.test'), true);
select set_config('w4.coach',  (select id::text from public.users where email = 'marc.desrosiers@exemple.test'), true);
select set_config('w4.felix_u',  (select id::text from public.users where email = 'felix.gauthier@exemple.test'), true);
select set_config('w4.mathis_u', (select id::text from public.users where email = 'mathis.demo@exemple.test'), true);
select set_config('w4.mp1', (select mp.id::text from public.media_partners mp join public.users u on u.id = mp.user_id where u.email = 'p1.partenaire@preuve.local'), true);
select set_config('w4.mp2', (select mp.id::text from public.media_partners mp join public.users u on u.id = mp.user_id where u.email = 'p2.suspendu@preuve.local'), true);
select set_config('w4.felix',  (select a.id::text from public.athletes a where a.user_id = current_setting('w4.felix_u')::uuid), true);
select set_config('w4.mathis', (select a.id::text from public.athletes a where a.user_id = current_setting('w4.mathis_u')::uuid), true);
select set_config('w4.foot',   (select id::text from public.sports where nom = 'Football'), true);
select set_config('w4.equipe', (select ta.team_id::text from public.team_athletes ta where ta.athlete_id = current_setting('w4.felix')::uuid limit 1), true);
select set_config('w4.b_vitesse', (select id::text from public.badges where code = 'vitesse'), true);

-- Préparation (postgres) : p1 évaluateur en football avec un badge propre ; p2 approuvé, sans sport ;
-- Félix et Mathis sans opt-in ; aucune évaluation ni badge partenaire de départ sur eux.
update public.media_partners set peut_evaluer = true where id in (current_setting('w4.mp1')::uuid, current_setting('w4.mp2')::uuid);
update public.media_partners set status = 'APPROVED' where id = current_setting('w4.mp2')::uuid;
insert into public.partenaire_sports_permis (partner_id, sport_id)
values (current_setting('w4.mp1')::uuid, current_setting('w4.foot')::uuid) on conflict do nothing;
update public.athletes set partner_visibility_opt_in = false
 where id in (current_setting('w4.felix')::uuid, current_setting('w4.mathis')::uuid);
delete from public.partner_evaluations where athlete_id in (current_setting('w4.felix')::uuid, current_setting('w4.mathis')::uuid);
delete from public.partner_athlete_badges where athlete_id in (current_setting('w4.felix')::uuid, current_setting('w4.mathis')::uuid);
with b as (
  insert into public.partner_badges (partner_id, libelle, icone_path, actif, ordre)
  values (current_setting('w4.mp1')::uuid, 'Esprit sportif W4d', current_setting('w4.mp1') || '/w4d.png', true, 0)
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

select set_config('w4.q_creer',
  'with c as (select public.partenaire_prospect_enregistrer(null, %L, %L, %L::uuid, null, null, %L::uuid, 2027, true, %s, %L::jsonb, %L::uuid[], %L::uuid[]) as id) '
  || 'insert into _ids select %L, id from c returning ''ok''', true);
select set_config('w4.q_lien',
  'with j as (select public.partenaire_prospect_lien(%L) as t) insert into _jet select %L, t from j returning length(jeton)::text', true);
-- La ligne « Terminées » de p1 pour une carte, résumée.
select set_config('w4.q_term',
  $q$select coalesce(string_agg(issue || '|' || profil_visible || '|' || coalesce(prenom, '∅') || '|' || coalesce(nom, '∅') || '|'
            || coalesce(sport, '∅') || '|' || coalesce(evaluation, '∅') || '|' || coalesce(jsonb_array_length(badges)::text, '∅') || '|'
            || coalesce(athlete_id::text = %L, false), ';'), 'aucune')
       from public.partenaire_prospects_terminees() where carte_id = %L$q$, true);
-- La présence d'un athlète dans « Mes athlètes » de l'appelant.
select set_config('w4.q_mes',
  $q$select coalesce((select coalesce(prenom, '∅') || '|' || coalesce(cote_globale::text, '∅') || '|' || jsonb_array_length(badges)
                       from public.partenaire_mes_athletes() where athlete_id = %L), 'absent')$q$, true);

set local role authenticated;

-- ── A. Une carte réclamée (Félix, opt-in actif), une carte refusée (Mathis) ──
select pg_temp.essai('A1 Félix active la visibilité partenaire', current_setting('w4.felix_u'),
  'select public.set_my_partner_visibility(true, ''2026-08-v1'')->>''ok''', 'true');
select pg_temp.essai('A2 p1 crée c1 (cote 4,5, badge propre + Vitesse)', current_setting('w4.p1'),
  format(current_setting('w4.q_creer'), 'Noé', 'Essai', current_setting('w4.foot'), null, '4.5', '{}',
         '{' || (select id from _ids where cle = 'pb') || '}', '{' || current_setting('w4.b_vitesse') || '}', 'c1'), 'ok');
select pg_temp.essai('A3 lien c1', current_setting('w4.p1'), format(current_setting('w4.q_lien'), (select id from _ids where cle = 'c1'), 'c1'), '64');
select pg_temp.essai('A4 Félix ouvre c1', current_setting('w4.felix_u'),
  format('select public.prospect_partenaire_ouvrir(%L)->>''prenom''', (select jeton from _jet where cle = 'c1')), 'Noé');
select pg_temp.essai('A5 Félix : « c''est moi » → transfert immédiat', current_setting('w4.felix_u'),
  format('select public.prospect_partenaire_confirmer(%L)->>''statut''', (select id from _ids where cle = 'c1')), 'transferee');
select pg_temp.essai('A6 p1 crée c2', current_setting('w4.p1'),
  format(current_setting('w4.q_creer'), 'Jade', 'Essai', current_setting('w4.foot'), null, 'null', '{}', '{}', '{}', 'c2'), 'ok');
select pg_temp.essai('A7 lien c2', current_setting('w4.p1'), format(current_setting('w4.q_lien'), (select id from _ids where cle = 'c2'), 'c2'), '64');
select pg_temp.essai('A8 Mathis ouvre c2', current_setting('w4.mathis_u'),
  format('select public.prospect_partenaire_ouvrir(%L)->>''prenom''', (select jeton from _jet where cle = 'c2')), 'Jade');
select pg_temp.essai('A9 Mathis : « ce n''est pas moi »', current_setting('w4.mathis_u'),
  format('select public.prospect_partenaire_infirmer(%L)::text', (select id from _ids where cle = 'c2')), '');

-- ── B. « Terminées » ─────────────────────────────────────────────────────────
select pg_temp.essai('B1 p1 : réclamée, NOMMÉE (prénom, nom, sport, évaluation transférée, 2 badges, bon athlète)', current_setting('w4.p1'),
  format(current_setting('w4.q_term'), current_setting('w4.felix'), (select id from _ids where cle = 'c1')),
  'RECLAMEE|true|Félix|Gauthier|Football|transferee|2|true');
select pg_temp.essai('B2 p1 : le résumé des badges (transférés, avec libellé)', current_setting('w4.p1'),
  format($q$select string_agg((b->>'libelle') || ':' || (b->>'transfere') || ':' || coalesce(b->>'raison', '-'), ',' order by b->>'libelle')
              from public.partenaire_prospects_terminees() t, jsonb_array_elements(t.badges) b where t.carte_id = %L$q$,
         (select id from _ids where cle = 'c1')),
  'Esprit sportif W4d:true:-,Vitesse:true:-');
select pg_temp.essai('B3 p1 : refusée, SANS nom ni athlète (Mathis n''est pas visible)', current_setting('w4.p1'),
  format(current_setting('w4.q_term'), current_setting('w4.mathis'), (select id from _ids where cle = 'c2')),
  'REFUSEE|false|∅|∅|∅|∅|∅|false');
select pg_temp.essai('B4 W4a (mes_issues) : l''athlète de la réclamation visible est rendu', current_setting('w4.p1'),
  format('select (athlete_id = %L)::text from public.partenaire_prospects_mes_issues() where carte_id = %L',
         current_setting('w4.felix'), (select id from _ids where cle = 'c1')), 'true');
select pg_temp.essai('B5 autre partenaire (p2) : aucune issue de p1', current_setting('w4.p2'),
  'select count(*)::text from public.partenaire_prospects_terminees()', '0');
select pg_temp.essai('B6 coach : aucune ligne', current_setting('w4.coach'),
  'select count(*)::text from public.partenaire_prospects_terminees()', '0');
select pg_temp.essai('B7 recruteur : aucune ligne', current_setting('w4.rec'),
  'select count(*)::text from public.partenaire_prospects_terminees()', '0');
select pg_temp.essai('B8 Félix lui-même (athlète) : aucune ligne', current_setting('w4.felix_u'),
  'select count(*)::text from public.partenaire_prospects_terminees()', '0');

-- ── C. « Mes athlètes » ──────────────────────────────────────────────────────
select pg_temp.essai('C1 p1 : Félix (sa cote 4,50, ses 2 badges)', current_setting('w4.p1'),
  format(current_setting('w4.q_mes'), current_setting('w4.felix')), 'Félix|4.50|2');
select pg_temp.essai('C2 p1 : Mathis absent (jamais évalué ni badgé)', current_setting('w4.p1'),
  format(current_setting('w4.q_mes'), current_setting('w4.mathis')), 'absent');
select pg_temp.essai('C3 p2 : liste vide', current_setting('w4.p2'), 'select count(*)::text from public.partenaire_mes_athletes()', '0');
select pg_temp.essai('C4 coach : liste vide', current_setting('w4.coach'), 'select count(*)::text from public.partenaire_mes_athletes()', '0');
select pg_temp.essai('C5 recruteur : liste vide', current_setting('w4.rec'), 'select count(*)::text from public.partenaire_mes_athletes()', '0');
select pg_temp.essai('C6 admin : liste vide (pas partenaire)', current_setting('w4.admin'), 'select count(*)::text from public.partenaire_mes_athletes()', '0');

-- ── D. Le jeune retire sa visibilité : plus de nom, plus de liste, rien d'effacé ─
select pg_temp.essai('D1 Félix retire sa visibilité partenaire', current_setting('w4.felix_u'),
  'select public.set_my_partner_visibility(false, ''2026-08-v1'')->>''ok''', 'true');
select pg_temp.essai('D2 Terminées : « réclamée — profil non visible », ni nom ni athlète', current_setting('w4.p1'),
  format(current_setting('w4.q_term'), current_setting('w4.felix'), (select id from _ids where cle = 'c1')),
  'RECLAMEE|false|∅|∅|∅|∅|∅|false');
select pg_temp.essai('D3 W4a (mes_issues) : l''identifiant n''est plus rendu', current_setting('w4.p1'),
  format('select coalesce(athlete_id::text, ''∅'') from public.partenaire_prospects_mes_issues() where carte_id = %L',
         (select id from _ids where cle = 'c1')), '∅');
select pg_temp.essai('D4 Mes athlètes : Félix disparaît', current_setting('w4.p1'),
  format(current_setting('w4.q_mes'), current_setting('w4.felix')), 'absent');
reset role;
select pg_temp.essai('D5 rien n''est effacé : évaluation et 2 badges toujours en base', null,
  format('select (select count(*) from public.partner_evaluations where athlete_id = %1$L) || ''|'' || (select count(*) from public.partner_athlete_badges where athlete_id = %1$L and retire_le is null)',
         current_setting('w4.felix')), '1|2');
set local role authenticated;
select pg_temp.essai('D6 Félix réactive : de retour, nommé', current_setting('w4.felix_u'),
  'select public.set_my_partner_visibility(true, ''2026-08-v1'')->>''ok''', 'true');
select pg_temp.essai('D7 Terminées et Mes athlètes : Félix revient', current_setting('w4.p1'),
  format('select (%s) || '' / '' || (%s)',
         format(current_setting('w4.q_term'), current_setting('w4.felix'), (select id from _ids where cle = 'c1')),
         format(current_setting('w4.q_mes'), current_setting('w4.felix'))),
  'RECLAMEE|true|Félix|Gauthier|Football|transferee|2|true / Félix|4.50|2');

-- ── E. Partenaire suspendu : plus de nom même pour un jeune visible ─────────
reset role;
update public.media_partners set status = 'SUSPENDED' where id = current_setting('w4.mp1')::uuid;
set local role authenticated;
select pg_temp.essai('E1 p1 suspendu : Terminées sans nom, Mes athlètes vide', current_setting('w4.p1'),
  format('select (%s) || '' / '' || (select count(*) from public.partenaire_mes_athletes())',
         format(current_setting('w4.q_term'), current_setting('w4.felix'), (select id from _ids where cle = 'c1'))),
  'RECLAMEE|false|∅|∅|∅|∅|∅|false / 0');
reset role;
update public.media_partners set status = 'APPROVED' where id = current_setting('w4.mp1')::uuid;
set local role authenticated;

-- ── F. Annulation par l'admin (7 jours) ──────────────────────────────────────
-- (l'identifiant de l'issue est relevé par postgres : la table n'est lisible par personne d'autre)
reset role;
insert into _ids select 'i1', id from public.partenaire_prospects_issues where carte_id = (select id from _ids where cle = 'c1');
set local role authenticated;
select pg_temp.essai('F1 admin annule la réclamation c1', current_setting('w4.admin'),
  format('select public.admin_prospect_annuler(%L)', (select id from _ids where cle = 'i1')), 'RECLAMATION_ANNULEE');
select pg_temp.essai('F2 Terminées : réclamation annulée → sans nom', current_setting('w4.p1'),
  format(current_setting('w4.q_term'), current_setting('w4.felix'), (select id from _ids where cle = 'c1')),
  'RECLAMEE|false|∅|∅|∅|∅|∅|false');
select pg_temp.essai('F3 Mes athlètes : transfert défait → Félix sort de la liste', current_setting('w4.p1'),
  format(current_setting('w4.q_mes'), current_setting('w4.felix')), 'absent');
select pg_temp.essai('F4 p1 badge Félix directement (W3) → « Mes athlètes » sans cote, 1 badge', current_setting('w4.p1'),
  format('select (public.partenaire_attribuer_badge(%L, %L) is not null)::text', current_setting('w4.felix'), (select id from _ids where cle = 'pb')), 'true');
select pg_temp.essai('F5 Mes athlètes : badgé seulement', current_setting('w4.p1'),
  format(current_setting('w4.q_mes'), current_setting('w4.felix')), 'Félix|∅|1');
select pg_temp.essai('F6 retirer ce badge (W3), depuis l''identifiant que rend « Mes athlètes »', current_setting('w4.p1'),
  format($q$select public.retirer_badge_partenaire((b->>'attribution_id')::uuid)::text from public.partenaire_mes_athletes() m, jsonb_array_elements(m.badges) b where m.athlete_id = %L limit 1$q$,
         current_setting('w4.felix')), '');
select pg_temp.essai('F7 plus rien de p1 sur Félix → il sort de la liste', current_setting('w4.p1'),
  format(current_setting('w4.q_mes'), current_setting('w4.felix')), 'absent');

-- ── G. Compteur admin et rapprochements : jamais vus du partenaire ──────────
reset role;
select set_config('w4.cand_avant', (select count(*)::text from public.prospect_partenaire_candidats(null, null)), true);
set local role authenticated;
select pg_temp.essai('G1 p1 crée c3 « Mathis Lavoie » dans l''équipe de Mathis (Mathis non visible)', current_setting('w4.p1'),
  format(current_setting('w4.q_creer'), 'Mathis', 'Lavoie', current_setting('w4.foot'), current_setting('w4.equipe'), 'null', '{}', '{}', '{}', 'c3'), 'ok');
select pg_temp.essai('G2 admin : un candidat de plus en attente', current_setting('w4.admin'),
  format('select (public.admin_prospects_candidats_en_attente() - %s)::text', current_setting('w4.cand_avant')), '1');
select pg_temp.essai('G3 p1 : la carte reste « À envoyer » (rapprochement invisible)', current_setting('w4.p1'),
  format('select statut from public.partenaire_prospects_mes_cartes() where id = %L', (select id from _ids where cle = 'c3')), 'A_ENVOYER');
select pg_temp.essai('G4 p1 : Mathis absent de « Mes athlètes » et de « Terminées »', current_setting('w4.p1'),
  format('select (%s) || ''|'' || (select count(*) from public.partenaire_prospects_terminees() where athlete_id = %L)',
         format(current_setting('w4.q_mes'), current_setting('w4.mathis')), current_setting('w4.mathis')), 'absent|0');
select pg_temp.essai('G5 p1 : compteur admin refusé', current_setting('w4.p1'), 'select public.admin_prospects_candidats_en_attente()::text', 'ERR:42501');
select pg_temp.essai('G6 coach : compteur admin refusé', current_setting('w4.coach'), 'select public.admin_prospects_candidats_en_attente()::text', 'ERR:42501');
select pg_temp.essai('G7 recruteur : compteur admin refusé', current_setting('w4.rec'), 'select public.admin_prospects_candidats_en_attente()::text', 'ERR:42501');
select pg_temp.essai('G8 admin : la liste des rapprochements contient la paire (c3, Mathis), non visible du partenaire', current_setting('w4.admin'),
  format('select statut || ''|'' || visible_partenaire from public.admin_prospects_rapprochements() where carte_id = %L and athlete_id = %L',
         (select id from _ids where cle = 'c3'), current_setting('w4.mathis')), 'CANDIDAT|false');
select pg_temp.essai('G9 admin : toutes les cartes et issues (c1 annulée, c2 refusée, c3 à envoyer)', current_setting('w4.admin'),
  format($q$select string_agg(statut, ',' order by statut) from public.admin_prospects_partenaires() where carte_id in (%L, %L, %L)$q$,
         (select id from _ids where cle = 'c1'), (select id from _ids where cle = 'c2'), (select id from _ids where cle = 'c3')),
  'A_ENVOYER,A_ENVOYER,RECLAMATION_ANNULEE,REFUSEE');

-- ── H. anon et droits ────────────────────────────────────────────────────────
reset role;
set local role anon;
select pg_temp.essai('H1 anon : Terminées refusée', null, 'select count(*)::text from public.partenaire_prospects_terminees()', 'ERR:42501');
select pg_temp.essai('H2 anon : Mes athlètes refusée', null, 'select count(*)::text from public.partenaire_mes_athletes()', 'ERR:42501');
select pg_temp.essai('H3 anon : compteur admin refusé', null, 'select public.admin_prospects_candidats_en_attente()::text', 'ERR:42501');
reset role;
set local role authenticated;
select pg_temp.essai('H4 la règle interne de visibilité n''est pas appelable', current_setting('w4.p1'),
  format('select public.partenaire_voit_athlete(%L)::text', current_setting('w4.felix')), 'ERR:42501');
reset role;
select pg_temp.essai('H5 ACL complètes des fonctions W4d', null,
  $q$select string_agg(proname || '=' || array_to_string(array(select coalesce(nullif(split_part(x, '=', 1), ''), 'PUBLIC') from unnest(proacl::text[]) x order by 1), ','), ';' order by proname)
       from pg_proc where pronamespace = 'public'::regnamespace
        and proname in ('partenaire_voit_athlete', 'partenaire_prospects_terminees', 'partenaire_mes_athletes', 'admin_prospects_candidats_en_attente', 'partenaire_prospects_mes_issues')$q$,
  'admin_prospects_candidats_en_attente=authenticated,postgres,service_role;partenaire_mes_athletes=authenticated,postgres,service_role;partenaire_prospects_mes_issues=authenticated,postgres,service_role;partenaire_prospects_terminees=authenticated,postgres,service_role;partenaire_voit_athlete=postgres,service_role');

select n, case when ok then 'OK' else 'ÉCHEC' end as verdict, test, detail from _res order by n;
select count(*) filter (where ok) as ok, count(*) filter (where not ok) as echecs from _res;
rollback;
