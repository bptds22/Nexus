-- Tests 20261016170000 — cartes (cote partenaire), « Mes athlètes », Loi 25 (retrait d'opt-in) et
-- demande de visibilité. Base LOCALE, une transaction annulée à la fin : rien ne survit. Même harnais
-- que tests-w4d.sql ; chaque essai tourne sous le VRAI rôle (authenticated / anon) avec un JWT simulé.
-- Félix et Mathis sont des fixtures LOCALES (17 ans) ; les avis au parent et pushs éventuels
-- (pg_net) partent dans la transaction annulée, donc jamais.
--   docker cp docs/cote-partenaire-carte/tests-cote-partenaire.sql supabase_db_Nexus:/tmp/tests-cote.sql
--   docker exec -e PGCLIENTENCODING=UTF8 supabase_db_Nexus psql -U postgres -d postgres -q -f /tmp/tests-cote.sql
\set ON_ERROR_STOP 1
\pset footer off
begin;

create temp table _res (n serial, test text, ok boolean, detail text) on commit drop;
create temp table _ids (cle text primary key, id uuid) on commit drop;
create temp table _jet (cle text primary key, jeton text) on commit drop;
grant all on _res, _ids, _jet to authenticated, anon, service_role;
grant usage on sequence _res_n_seq to authenticated, anon, service_role;

select set_config('t.p1',     (select id::text from public.users where email = 'p1.partenaire@preuve.local'), true);
select set_config('t.p2',     (select id::text from public.users where email = 'p2.suspendu@preuve.local'), true);
select set_config('t.admin',  (select id::text from public.users where email = 'admin@demo.local'), true);
select set_config('t.rec',    (select id::text from public.users where email = 'julie.lambert@exemple.test'), true);
select set_config('t.coach',  (select id::text from public.users where email = 'marc.desrosiers@exemple.test'), true);
select set_config('t.parent', (select id::text from public.users where email = 'parent.b1@preuve.local'), true);
select set_config('t.felix_u',  (select id::text from public.users where email = 'felix.gauthier@exemple.test'), true);
select set_config('t.mathis_u', (select id::text from public.users where email = 'mathis.demo@exemple.test'), true);
select set_config('t.mp1', (select mp.id::text from public.media_partners mp join public.users u on u.id = mp.user_id where u.email = 'p1.partenaire@preuve.local'), true);
select set_config('t.mp2', (select mp.id::text from public.media_partners mp join public.users u on u.id = mp.user_id where u.email = 'p2.suspendu@preuve.local'), true);
select set_config('t.felix',  (select a.id::text from public.athletes a where a.user_id = current_setting('t.felix_u')::uuid), true);
select set_config('t.mathis', (select a.id::text from public.athletes a where a.user_id = current_setting('t.mathis_u')::uuid), true);
select set_config('t.foot',   (select id::text from public.sports where nom = 'Football'), true);
select set_config('t.b_vitesse', (select id::text from public.badges where code = 'vitesse'), true);
select set_config('t.lot', format('array[%L, %L]::uuid[]', current_setting('t.felix'), current_setting('t.mathis')), true);
select set_config('t.pol', '2026-08-v1', true);

-- Préparation (postgres) : p1 ET p2 approuvés, évaluateurs en football ; Félix et Mathis sans
-- opt-in, jamais activé, sans évaluation ni badge partenaire, ni carte, ni demande ; Félix sans parent.
update public.media_partners set peut_evaluer = true, status = 'APPROVED'
 where id in (current_setting('t.mp1')::uuid, current_setting('t.mp2')::uuid);
insert into public.partenaire_sports_permis (partner_id, sport_id)
values (current_setting('t.mp1')::uuid, current_setting('t.foot')::uuid),
       (current_setting('t.mp2')::uuid, current_setting('t.foot')::uuid) on conflict do nothing;
update public.athletes set partner_visibility_opt_in = false, partner_visibility_parental_consent = false,
       partner_visibility_opted_in_at = null
 where id in (current_setting('t.felix')::uuid, current_setting('t.mathis')::uuid);
delete from public.partner_evaluations where athlete_id in (current_setting('t.felix')::uuid, current_setting('t.mathis')::uuid);
delete from public.partner_athlete_badges where athlete_id in (current_setting('t.felix')::uuid, current_setting('t.mathis')::uuid);
delete from public.partenaire_prospects where reservee_athlete in (current_setting('t.felix')::uuid, current_setting('t.mathis')::uuid);
delete from public.athlete_notifications where type = 'PARTENAIRE_VISIBILITE_DEMANDE';
delete from public.parent_athletes where athlete_id = current_setting('t.felix')::uuid;
with b as (
  insert into public.partner_badges (partner_id, libelle, icone_path, actif, ordre)
  values (current_setting('t.mp1')::uuid, 'Esprit sportif filtre', current_setting('t.mp1') || '/filtre.png', true, 0)
  returning id)
insert into _ids select 'pb', id from b;

create function pg_temp.essai(p_test text, p_uid text, p_sql text, p_attendu text) returns void
language plpgsql as $$
declare r text; v_role text := current_user;
begin
  -- p_uid = 'postgres' : un CONSTAT en base (hors RLS), quel que soit le rôle courant.
  if p_uid = 'postgres' then
    execute 'reset role';
  else
    perform set_config('request.jwt.claims',
      case when p_uid is null then '{"role":"anon"}'
           else json_build_object('sub', p_uid, 'role', 'authenticated')::text end, true);
  end if;
  begin
    execute p_sql into r;
  exception when others then r := 'ERR:' || sqlstate;
  end;
  if p_uid = 'postgres' and v_role <> current_user then
    execute format('set local role %I', v_role);
  end if;
  insert into _res (test, ok, detail)
  values (p_test, r is not distinct from p_attendu, coalesce(r, 'NULL') || ' (attendu ' || p_attendu || ')');
end $$;

-- Le lot rend EXACTEMENT ce que l'appelant obtient de W2, athlète par athlète.
select set_config('t.q_egal', format($q$select (select count(*) from public.cotes_partenaires_athletes(%1$s))::text || '|' ||
   ((select coalesce(string_agg(id::text || organisation || cote_globale::text, ',' order by id), '') from public.cotes_partenaires_athletes(%1$s))
    = (select coalesce(string_agg(e.id::text || e.organisation || e.cote_globale::text, ',' order by e.id), '')
         from unnest(%1$s) x cross join lateral public.evaluations_partenaires_athlete(x) e))::text$q$, current_setting('t.lot')), true);
-- Tout ce qu'un rôle voit du partenaire sur Félix : évaluations W2 | badges partenaire | lot cartes.
select set_config('t.q_felix', format($q$select (select count(*) from public.evaluations_partenaires_athlete(%1$L))::text || '|'
   || (select count(*) from public.badges_partenaires_athlete(%1$L))::text || '|'
   || (select count(*) from public.cotes_partenaires_athletes(array[%1$L]::uuid[]))::text$q$, current_setting('t.felix')), true);
-- Recherche recruteur, sur Félix (aucune cote de coach) : cote partenaire | présent avec « 4+ étoiles » (seuil 3) |
-- rang de Félix parmi les athlètes AYANT une cote affichée, tri par cote.
select set_config('t.q_recherche', format($q$select coalesce((select cote_partenaire::text from public.recruiter_search_athletes(p_inclure_partenaires => true) where id = %1$L), 'absent') || '|'
   || (select count(*) from public.recruiter_search_athletes(p_min_rating => 3, p_inclure_partenaires => true) where id = %1$L)::text || '|'
   || coalesce((select (r.cote_globale is null and r.cote_partenaire is not null)::text
                  from public.recruiter_search_athletes(p_sort_by => 'rating_desc', p_inclure_partenaires => true) r where r.id = %1$L), 'absent')$q$,
   current_setting('t.felix')), true);
-- Cartes prospect (harnais W4d).
select set_config('t.q_creer',
  'with c as (select public.partenaire_prospect_enregistrer(null, %L, %L, %L::uuid, null, null, null, 2027, true, %s, %L::jsonb, %L::uuid[], %L::uuid[]) as id) '
  || 'insert into _ids select %L, id from c returning ''ok''', true);
select set_config('t.q_lien',
  'with j as (select public.partenaire_prospect_lien(%L) as t) insert into _jet select %L, t from j returning length(jeton)::text', true);
-- Les demandes de visibilité d'un jeune : partenaire:état:nb cartes, triées.
select set_config('t.q_dem',
  $q$select coalesce(string_agg(case n.metadata->>'partner_id' when %L then 'p1' when %L then 'p2' else '?' end
            || ':' || (n.metadata->>'etat') || ':' || jsonb_array_length(n.metadata->'cartes'), ',' order by 1), 'aucune')
       from public.athlete_notifications n where n.athlete_id = %L and n.type = 'PARTENAIRE_VISIBILITE_DEMANDE'$q$, true);

set local role authenticated;

-- ── A. Félix active sa visibilité ; p1 et p2 l'évaluent, p1 le badge ─────────
select pg_temp.essai('A1 Félix active la visibilité partenaire', current_setting('t.felix_u'),
  format('select public.set_my_partner_visibility(true, %L)->>''ok''', current_setting('t.pol')), 'true');
select pg_temp.essai('A2 p1 évalue Félix (4)', current_setting('t.p1'),
  format('select (public.partenaire_evaluer_athlete(%L, 4, ''{}''::jsonb) is not null)::text', current_setting('t.felix')), 'true');
select pg_temp.essai('A3 p2 évalue Félix (3)', current_setting('t.p2'),
  format('select (public.partenaire_evaluer_athlete(%L, 3, ''{}''::jsonb) is not null)::text', current_setting('t.felix')), 'true');
-- Une transaction = un seul now() : p2 est rendue STRICTEMENT plus récente, comme dans la vraie vie.
reset role;
update public.partner_evaluations set updated_at = now() + interval '1 minute'
 where partner_id = current_setting('t.mp2')::uuid and athlete_id = current_setting('t.felix')::uuid;
set local role authenticated;
select pg_temp.essai('A4 p1 remet son badge propre à Félix', current_setting('t.p1'),
  format('select (public.partenaire_attribuer_badge(%L, %L) is not null)::text', current_setting('t.felix'), (select id from _ids where cle = 'pb')), 'true');
select pg_temp.essai('A5 p1 remet le badge Nexus Vitesse à Félix', current_setting('t.p1'),
  format('select (public.partenaire_attribuer_badge_nexus(%L, %L) is not null)::text', current_setting('t.felix'), current_setting('t.b_vitesse')), 'true');
select pg_temp.essai('A6 p1 ne peut pas évaluer Mathis (pas d''opt-in)', current_setting('t.p1'),
  format('select (public.partenaire_evaluer_athlete(%L, 4, ''{}''::jsonb) is not null)::text', current_setting('t.mathis')), 'ERR:42501');

-- ── B. Opt-in actif : le lot = W2, rôle par rôle ; ce que chacun voit ────────
select pg_temp.essai('B1 recruteur : lot identique à W2 (2 évaluations)', current_setting('t.rec'), current_setting('t.q_egal'), '2|true');
select pg_temp.essai('B2 Félix lui-même : identique à W2', current_setting('t.felix_u'), current_setting('t.q_egal'), '2|true');
select pg_temp.essai('B3 Mathis (autre athlète) : rien', current_setting('t.mathis_u'), current_setting('t.q_egal'), '0|true');
select pg_temp.essai('B4 p1 : la sienne seulement', current_setting('t.p1'), current_setting('t.q_egal'), '1|true');
select pg_temp.essai('B5 admin : tout', current_setting('t.admin'), current_setting('t.q_egal'), '2|true');
select pg_temp.essai('B6 lot vide ou NULL : aucune ligne', current_setting('t.rec'),
  'select ((select count(*) from public.cotes_partenaires_athletes(''{}''::uuid[])) + (select count(*) from public.cotes_partenaires_athletes(null)))::text', '0');
select pg_temp.essai('B7 doublons dans le lot : pas de lignes doublées', current_setting('t.rec'),
  format('select count(*)::text from public.cotes_partenaires_athletes(array[%L, %L]::uuid[])', current_setting('t.felix'), current_setting('t.felix')), '2');
select pg_temp.essai('B8 VISIBLE recruteur : évals|badges|lot', current_setting('t.rec'), current_setting('t.q_felix'), '2|2|2');
select pg_temp.essai('B9 VISIBLE coach de Félix', current_setting('t.coach'), current_setting('t.q_felix'), '2|2|2');
select pg_temp.essai('B10 VISIBLE Félix lui-même', current_setting('t.felix_u'), current_setting('t.q_felix'), '2|2|2');
select pg_temp.essai('B11 VISIBLE p1 (les siennes)', current_setting('t.p1'), current_setting('t.q_felix'), '1|2|1');
select pg_temp.essai('B12 VISIBLE p2 (la sienne)', current_setting('t.p2'), current_setting('t.q_felix'), '1|0|1');
select pg_temp.essai('B13 VISIBLE admin', current_setting('t.admin'), current_setting('t.q_felix'), '2|2|2');
select pg_temp.essai('B14 recherche : cote partenaire (la plus récente : p2, 3) | dans « 4+ » (seuil 3) | triée sur la cote partenaire', current_setting('t.rec'), current_setting('t.q_recherche'), '3.00|1|true');
select pg_temp.essai('B15 p1 : badges Nexus admissibles lisibles', current_setting('t.p1'),
  format('select (count(*) > 0)::text from public.partenaire_badges_nexus_admissibles(%L)', current_setting('t.felix')), 'true');

-- ── C. Félix RETIRE son opt-in : plus rien, nulle part, sauf pour l'admin ────
select pg_temp.essai('C1 Félix retire sa visibilité', current_setting('t.felix_u'),
  format('select public.set_my_partner_visibility(false, %L)->>''ok''', current_setting('t.pol')), 'true');
select pg_temp.essai('C4a RETIRÉ recruteur : rien', current_setting('t.rec'), current_setting('t.q_felix'), '0|0|0');
select pg_temp.essai('C4b RETIRÉ coach de Félix : rien', current_setting('t.coach'), current_setting('t.q_felix'), '0|0|0');
select pg_temp.essai('C4c RETIRÉ Félix lui-même : rien', current_setting('t.felix_u'), current_setting('t.q_felix'), '0|0|0');
select pg_temp.essai('C4d RETIRÉ p1 (auteur) : rien', current_setting('t.p1'), current_setting('t.q_felix'), '0|0|0');
select pg_temp.essai('C4e RETIRÉ p2 (auteur) : rien', current_setting('t.p2'), current_setting('t.q_felix'), '0|0|0');
select pg_temp.essai('C4f RETIRÉ Mathis : rien', current_setting('t.mathis_u'), current_setting('t.q_felix'), '0|0|0');
select pg_temp.essai('C4g RETIRÉ admin : TOUT (seule exception)', current_setting('t.admin'), current_setting('t.q_felix'), '2|2|2');
select pg_temp.essai('C4h RETIRÉ recherche : pas de cote partenaire | hors « 4+ » | plus triée sur la cote partenaire', current_setting('t.rec'), current_setting('t.q_recherche'), 'absent|0|false');
select pg_temp.essai('C4i RETIRÉ p1 : badges Nexus admissibles refusés', current_setting('t.p1'),
  format('select count(*)::text from public.partenaire_badges_nexus_admissibles(%L)', current_setting('t.felix')), 'ERR:42501');
select pg_temp.essai('C4j RETIRÉ Mes athlètes de p1 : Félix absent', current_setting('t.p1'),
  format('select count(*)::text from public.partenaire_mes_athletes() where athlete_id = %L', current_setting('t.felix')), '0');
select pg_temp.essai('C4k RETIRÉ : pas de relance au retrait (aucune demande)', 'postgres',
  format(current_setting('t.q_dem'), current_setting('t.mp1'), current_setting('t.mp2'), current_setting('t.felix')), 'aucune');
reset role;
select pg_temp.essai('C5 rien n''est effacé : 2 évaluations, 2 badges en base', 'postgres',
  format('select (select count(*) from public.partner_evaluations where athlete_id = %1$L) || ''|'' || (select count(*) from public.partner_athlete_badges where athlete_id = %1$L and retire_le is null)', current_setting('t.felix')), '2|2');
set local role authenticated;
select pg_temp.essai('C6 Félix réactive', current_setting('t.felix_u'),
  format('select public.set_my_partner_visibility(true, %L)->>''ok''', current_setting('t.pol')), 'true');
select pg_temp.essai('C7 RÉACTIVÉ recruteur : tout réapparaît', current_setting('t.rec'), current_setting('t.q_felix'), '2|2|2');
select pg_temp.essai('C8 RÉACTIVÉ recherche : cote, « 4+ » et tri reviennent', current_setting('t.rec'), current_setting('t.q_recherche'), '3.00|1|true');
reset role;
update public.athletes set status = 'DESACTIVE' where id = current_setting('t.felix')::uuid;
set local role authenticated;
select pg_temp.essai('C10 Félix DESACTIVE : lot vide pour le recruteur', current_setting('t.rec'), current_setting('t.q_egal'), '0|true');
reset role;
update public.athletes set status = 'ACTIF' where id = current_setting('t.felix')::uuid;
update public.media_partners set status = 'SUSPENDED' where id = current_setting('t.mp2')::uuid;
set local role authenticated;
select pg_temp.essai('C11 p2 suspendu : son évaluation cesse d''apparaître', current_setting('t.rec'), current_setting('t.q_egal'), '1|true');
reset role;
update public.media_partners set status = 'APPROVED' where id = current_setting('t.mp2')::uuid;
set local role authenticated;

-- ── D. « Mes athlètes » : poste et badge_ref ─────────────────────────────────
select pg_temp.essai('D1 p1 : badge_ref = id du catalogue (Nexus → badges.id, propre → partner_badges.id)', current_setting('t.p1'),
  format($q$select string_agg((b->>'nexus') || ':' || ((b->>'badge_ref')::uuid = case when (b->>'nexus')::boolean then %L::uuid else %L::uuid end)::text, ',' order by b->>'nexus')
            from public.partenaire_mes_athletes() m, jsonb_array_elements(m.badges) b where m.athlete_id = %L$q$,
         current_setting('t.b_vitesse'), (select id from _ids where cle = 'pb'), current_setting('t.felix')), 'false:true,true:true');
reset role;
select set_config('t.poste', coalesce((select po.nom || '|' || coalesce(po.abreviation, '∅') from public.athletes a join public.positions po on po.id = a.position_id where a.id = current_setting('t.felix')::uuid), '∅|∅'), true);
select set_config('t.prenom', (select first_name from public.athletes where id = current_setting('t.felix')::uuid), true);
set local role authenticated;
select pg_temp.essai('D2 p1 : poste et poste_abr = la position de Félix', current_setting('t.p1'),
  format($q$select coalesce(poste, '∅') || '|' || coalesce(poste_abr, '∅') from public.partenaire_mes_athletes() where athlete_id = %L$q$, current_setting('t.felix')),
  current_setting('t.poste'));
select pg_temp.essai('D3 p1 : colonnes W4d inchangées (prénom, cote 4, 2 badges)', current_setting('t.p1'),
  format($q$select prenom || '|' || cote_globale::text || '|' || jsonb_array_length(badges) from public.partenaire_mes_athletes() where athlete_id = %L$q$, current_setting('t.felix')),
  current_setting('t.prenom') || '|4.00|2');
select pg_temp.essai('D4 recruteur : Mes athlètes vide', current_setting('t.rec'), 'select count(*)::text from public.partenaire_mes_athletes()', '0');

-- ── E. Demande de visibilité : Mathis, jamais activé, confirme des cartes ────
select pg_temp.essai('E1 p1 crée c1 « Mathis » (cote 4,5, badge propre + Vitesse)', current_setting('t.p1'),
  format(current_setting('t.q_creer'), 'Mathis', 'Essai', current_setting('t.foot'), '4.5', '{}',
         '{' || (select id from _ids where cle = 'pb') || '}', '{' || current_setting('t.b_vitesse') || '}', 'c1'), 'ok');
select pg_temp.essai('E2 lien c1', current_setting('t.p1'), format(current_setting('t.q_lien'), (select id from _ids where cle = 'c1'), 'c1'), '64');
select pg_temp.essai('E3 Mathis ouvre c1', current_setting('t.mathis_u'),
  format('select public.prospect_partenaire_ouvrir(%L)->>''prenom''', (select jeton from _jet where cle = 'c1')), 'Mathis');
select pg_temp.essai('E4 Mathis : « c''est moi » → attente d''opt-in', current_setting('t.mathis_u'),
  format('select public.prospect_partenaire_confirmer(%L)->>''statut''', (select id from _ids where cle = 'c1')), 'attente_optin');
select pg_temp.essai('E5 une demande p1 EN_ATTENTE', 'postgres',
  format(current_setting('t.q_dem'), current_setting('t.mp1'), current_setting('t.mp2'), current_setting('t.mathis')), 'p1:EN_ATTENTE:1');
reset role;
select pg_temp.essai('E6 texte : « Média Preuve t''a évalué. » + invitation, sans cote ni badge', 'postgres',
  format($q$select title || ' / ' || message || ' / ' || (title || message ~ '[0-9]|Vitesse|Esprit')::text from public.athlete_notifications
            where athlete_id = %L and type = 'PARTENAIRE_VISIBILITE_DEMANDE'$q$, current_setting('t.mathis')),
  'Média Preuve t''a évalué. / Accepte d''être visible des partenaires pour que ton évaluation s''affiche. / false');
select pg_temp.essai('E7 Mathis ne voit toujours RIEN de p1 (évaluation pas transférée, et pas visible)', 'postgres',
  format('select (select count(*) from public.partner_evaluations where athlete_id = %L)::text', current_setting('t.mathis')), '0');
select pg_temp.essai('E8 un push en file (genre VISIBILITE_PARTENAIRE, relié à la demande, sans cloche en double)', 'postgres',
  format($q$select count(*)::text || '|' || bool_and(f.detail->>'notification_id' = (select n.id::text from public.athlete_notifications n where n.athlete_id = %1$L and n.type = 'PARTENAIRE_VISIBILITE_DEMANDE'))::text
            from public.push_file f join public.athletes a on a.user_id = f.user_id where a.id = %1$L and f.genre = 'VISIBILITE_PARTENAIRE'$q$, current_setting('t.mathis')), '1|true');
set local role authenticated;
select pg_temp.essai('E9 p1 crée c2 pour Mathis (cote 3)', current_setting('t.p1'),
  format(current_setting('t.q_creer'), 'Mathis', 'Essai', current_setting('t.foot'), '3', '{}', '{}', '{}', 'c2'), 'ok');
select pg_temp.essai('E10 lien c2', current_setting('t.p1'), format(current_setting('t.q_lien'), (select id from _ids where cle = 'c2'), 'c2'), '64');
select pg_temp.essai('E11 Mathis ouvre c2', current_setting('t.mathis_u'),
  format('select public.prospect_partenaire_ouvrir(%L)->>''prenom''', (select jeton from _jet where cle = 'c2')), 'Mathis');
select pg_temp.essai('E12 Mathis confirme c2', current_setting('t.mathis_u'),
  format('select public.prospect_partenaire_confirmer(%L)->>''statut''', (select id from _ids where cle = 'c2')), 'attente_optin');
select pg_temp.essai('E13 MÊME partenaire : toujours UNE demande, qui porte les 2 cartes', 'postgres',
  format(current_setting('t.q_dem'), current_setting('t.mp1'), current_setting('t.mp2'), current_setting('t.mathis')), 'p1:EN_ATTENTE:2');
select pg_temp.essai('E14 p2 crée c3 VIDE (ni cote ni badge)', current_setting('t.p2'),
  format(current_setting('t.q_creer'), 'Mathis', 'Essai', current_setting('t.foot'), 'null', '{}', '{}', '{}', 'c3'), 'ok');
select pg_temp.essai('E15 lien c3', current_setting('t.p2'), format(current_setting('t.q_lien'), (select id from _ids where cle = 'c3'), 'c3'), '64');
select pg_temp.essai('E16 Mathis ouvre c3', current_setting('t.mathis_u'),
  format('select public.prospect_partenaire_ouvrir(%L)->>''prenom''', (select jeton from _jet where cle = 'c3')), 'Mathis');
select pg_temp.essai('E17 Mathis confirme c3', current_setting('t.mathis_u'),
  format('select public.prospect_partenaire_confirmer(%L)->>''statut''', (select id from _ids where cle = 'c3')), 'attente_optin');
select pg_temp.essai('E18 carte VIDE : rien à rendre visible, aucune demande de p2', 'postgres',
  format(current_setting('t.q_dem'), current_setting('t.mp1'), current_setting('t.mp2'), current_setting('t.mathis')), 'p1:EN_ATTENTE:2');
select pg_temp.essai('E19 p2 crée c4 pour Mathis (cote 2)', current_setting('t.p2'),
  format(current_setting('t.q_creer'), 'Mathis', 'Essai', current_setting('t.foot'), '2', '{}', '{}', '{}', 'c4'), 'ok');
select pg_temp.essai('E20 lien c4', current_setting('t.p2'), format(current_setting('t.q_lien'), (select id from _ids where cle = 'c4'), 'c4'), '64');
select pg_temp.essai('E21 Mathis ouvre c4', current_setting('t.mathis_u'),
  format('select public.prospect_partenaire_ouvrir(%L)->>''prenom''', (select jeton from _jet where cle = 'c4')), 'Mathis');
select pg_temp.essai('E22 Mathis confirme c4', current_setting('t.mathis_u'),
  format('select public.prospect_partenaire_confirmer(%L)->>''statut''', (select id from _ids where cle = 'c4')), 'attente_optin');
select pg_temp.essai('E23 AUTRE partenaire : sa propre demande', 'postgres',
  format(current_setting('t.q_dem'), current_setting('t.mp1'), current_setting('t.mp2'), current_setting('t.mathis')), 'p1:EN_ATTENTE:2,p2:EN_ATTENTE:1');

-- E-push : la demande de p1 part (Mathis n'a pas d'appareil → SANS_JETON, mais PAS annulée) ;
-- celle de p2 est retenue (pas encore 10 min) puis annulée une fois la demande acceptée.
reset role;
update public.push_file f set cree_le = '2026-10-14 15:00:00-04'
  from public.athletes a, public.athlete_notifications n
 where a.user_id = f.user_id and a.id = current_setting('t.mathis')::uuid and f.genre = 'VISIBILITE_PARTENAIRE'
   and n.id::text = f.detail->>'notification_id' and n.metadata->>'partner_id' = current_setting('t.mp1');
update public.push_file f set cree_le = '2026-10-14 15:15:00-04'
  from public.athletes a, public.athlete_notifications n
 where a.user_id = f.user_id and a.id = current_setting('t.mathis')::uuid and f.genre = 'VISIBILITE_PARTENAIRE'
   and n.id::text = f.detail->>'notification_id' and n.metadata->>'partner_id' = current_setting('t.mp2');
select public.push_traiter_file('2026-10-14 15:20:00-04') is not null as file_traitee;
select pg_temp.essai('E24 file : demande p1 traitée normalement (non annulée), p2 encore en attente', 'postgres',
  format($q$select string_agg(case n.metadata->>'partner_id' when %L then 'p1' else 'p2' end || ':' || f.statut, ',' order by 1)
            from public.push_file f join public.athlete_notifications n on n.id::text = f.detail->>'notification_id'
           where f.genre = 'VISIBILITE_PARTENAIRE' and n.athlete_id = %L$q$, current_setting('t.mp1'), current_setting('t.mathis')), 'p1:SANS_JETON,p2:EN_ATTENTE');
set local role authenticated;
select pg_temp.essai('E25 un autre compte ne peut pas accepter la demande de Mathis', current_setting('t.felix_u'),
  format($q$select public.accepter_visibilite_partenaire((select n.id from public.athlete_notifications n where n.athlete_id = %L and n.type = 'PARTENAIRE_VISIBILITE_DEMANDE' limit 1), %L)->>'reason'$q$,
         current_setting('t.mathis'), current_setting('t.pol')), 'introuvable');
select pg_temp.essai('E26 sans session : rien à accepter', null,
  format($q$select public.accepter_visibilite_partenaire(gen_random_uuid(), %L)->>'reason'$q$, current_setting('t.pol')), 'introuvable');
select pg_temp.essai('E27 Mathis (17 ans) ACCEPTE la demande de p1 → opt-in par le chemin existant', current_setting('t.mathis_u'),
  format($q$select public.accepter_visibilite_partenaire((select n.id from public.athlete_notifications n where n.athlete_id = %L and n.type = 'PARTENAIRE_VISIBILITE_DEMANDE' and n.metadata->>'partner_id' = %L), %L)->>'etat'$q$,
         current_setting('t.mathis'), current_setting('t.mp1'), current_setting('t.pol')), 'ACCEPTEE');
select pg_temp.essai('E28 les DEUX demandes réglées (le jeune est visible)', 'postgres',
  format(current_setting('t.q_dem'), current_setting('t.mp1'), current_setting('t.mp2'), current_setting('t.mathis')), 'p1:ACCEPTEE:2,p2:ACCEPTEE:1');
select pg_temp.essai('E29 transfert fait (W4a) : les évaluations de p1 et p2 sont visibles du recruteur', current_setting('t.rec'),
  format('select count(*)::text from public.evaluations_partenaires_athlete(%L)', current_setting('t.mathis')), '2');
select pg_temp.essai('E30 accepter de nouveau : déjà traitée', current_setting('t.mathis_u'),
  format($q$select public.accepter_visibilite_partenaire((select n.id from public.athlete_notifications n where n.athlete_id = %L and n.type = 'PARTENAIRE_VISIBILITE_DEMANDE' and n.metadata->>'partner_id' = %L), %L)->>'reason'$q$,
         current_setting('t.mathis'), current_setting('t.mp1'), current_setting('t.pol')), 'deja_traitee');
reset role;
update public.push_file f set cree_le = '2026-10-14 15:00:00-04'
  from public.athletes a where a.user_id = f.user_id and a.id = current_setting('t.mathis')::uuid
   and f.genre = 'VISIBILITE_PARTENAIRE' and f.statut = 'EN_ATTENTE';
select public.push_traiter_file('2026-10-14 15:30:00-04') is not null as file_traitee;
select pg_temp.essai('E31 file : le push p2 est ANNULÉ (demande acceptée avant son départ)', 'postgres',
  format($q$select string_agg(case n.metadata->>'partner_id' when %L then 'p1' else 'p2' end || ':' || f.statut, ',' order by 1)
            from public.push_file f join public.athlete_notifications n on n.id::text = f.detail->>'notification_id'
           where f.genre = 'VISIBILITE_PARTENAIRE' and n.athlete_id = %L$q$, current_setting('t.mp1'), current_setting('t.mathis')), 'p1:SANS_JETON,p2:ANNULE');

-- ── F. Félix a RETIRÉ (il l'avait activé) et passe sous 14 ans : demande au parent ──
set local role authenticated;
select pg_temp.essai('F1 Félix retire de nouveau sa visibilité', current_setting('t.felix_u'),
  format('select public.set_my_partner_visibility(false, %L)->>''ok''', current_setting('t.pol')), 'true');
reset role;
update public.athletes set date_naissance = current_date - interval '13 years' where id = current_setting('t.felix')::uuid;
set local role authenticated;
select pg_temp.essai('F2 p2 crée c5 « Félix » (cote 5)', current_setting('t.p2'),
  format(current_setting('t.q_creer'), 'Félix', 'Essai', current_setting('t.foot'), '5', '{}', '{}', '{}', 'c5'), 'ok');
select pg_temp.essai('F3 lien c5', current_setting('t.p2'), format(current_setting('t.q_lien'), (select id from _ids where cle = 'c5'), 'c5'), '64');
select pg_temp.essai('F4 Félix ouvre c5', current_setting('t.felix_u'),
  format('select public.prospect_partenaire_ouvrir(%L)->>''prenom''', (select jeton from _jet where cle = 'c5')), 'Félix');
select pg_temp.essai('F5 Félix confirme c5', current_setting('t.felix_u'),
  format('select public.prospect_partenaire_confirmer(%L)->>''statut''', (select id from _ids where cle = 'c5')), 'attente_optin');
select pg_temp.essai('F6 a RETIRÉ + NOUVELLE évaluation : UNE demande', 'postgres',
  format(current_setting('t.q_dem'), current_setting('t.mp1'), current_setting('t.mp2'), current_setting('t.felix')), 'p2:EN_ATTENTE:1');
select pg_temp.essai('F7 p1 crée c6 « Félix »', current_setting('t.p1'),
  format(current_setting('t.q_creer'), 'Félix', 'Essai', current_setting('t.foot'), '4', '{}', '{}', '{}', 'c6'), 'ok');
select pg_temp.essai('F8 lien c6', current_setting('t.p1'), format(current_setting('t.q_lien'), (select id from _ids where cle = 'c6'), 'c6'), '64');
select pg_temp.essai('F9 Félix ouvre c6', current_setting('t.felix_u'),
  format('select public.prospect_partenaire_ouvrir(%L)->>''prenom''', (select jeton from _jet where cle = 'c6')), 'Félix');
select pg_temp.essai('F10 Félix confirme c6', current_setting('t.felix_u'),
  format('select public.prospect_partenaire_confirmer(%L)->>''statut''', (select id from _ids where cle = 'c6')), 'attente_optin');
select pg_temp.essai('F11 a RETIRÉ : pas de 2e relance, même d''un autre partenaire', 'postgres',
  format(current_setting('t.q_dem'), current_setting('t.mp1'), current_setting('t.mp2'), current_setting('t.felix')), 'p2:EN_ATTENTE:1');
select pg_temp.essai('F12 Félix (13 ans) accepte sans parent lié → parent_absent, demande toujours ouverte', current_setting('t.felix_u'),
  format($q$select (public.accepter_visibilite_partenaire((select n.id from public.athlete_notifications n where n.athlete_id = %L and n.type = 'PARTENAIRE_VISIBILITE_DEMANDE'), %L)->>'reason')
            || '|' || (select n.metadata->>'etat' from public.athlete_notifications n where n.athlete_id = %L and n.type = 'PARTENAIRE_VISIBILITE_DEMANDE')$q$,
         current_setting('t.felix'), current_setting('t.pol'), current_setting('t.felix')), 'parent_absent|EN_ATTENTE');
reset role;
insert into public.parent_athletes (parent_user_id, athlete_id) values (current_setting('t.parent')::uuid, current_setting('t.felix')::uuid);
delete from public.parent_notifications where athlete_id = current_setting('t.felix')::uuid;
set local role authenticated;
select pg_temp.essai('F13 parent lié : « Accepter » lance la DEMANDE AU PARENT (pas d''activation)', current_setting('t.felix_u'),
  format($q$select public.accepter_visibilite_partenaire((select n.id from public.athlete_notifications n where n.athlete_id = %L and n.type = 'PARTENAIRE_VISIBILITE_DEMANDE'), %L)->>'etat'$q$,
         current_setting('t.felix'), current_setting('t.pol')), 'DEMANDE_PARENT');
reset role;
select pg_temp.essai('F14 Félix toujours invisible ; un avis au parent, sans cote ni badge, vers Consentements', 'postgres',
  format($q$select coalesce(public.is_partner_eligible_athlete(%1$L), false)::text || '|' || count(*)::text || '|'
            || bool_and(not (pn.title || pn.message ~ '[0-9]|Vitesse|Esprit'))::text || '|' || max(pn.metadata->>'route')
            from public.parent_notifications pn where pn.athlete_id = %1$L and pn.type = 'CHILD_PARTNER_VISIBILITY_REQUEST'$q$, current_setting('t.felix')),
  'false|1|true|/parent/consentements');
set local role authenticated;
select pg_temp.essai('F15 le parent lit la demande (sa cloche)', current_setting('t.parent'),
  format($q$select count(*)::text from public.parent_notifications where athlete_id = %L and type = 'CHILD_PARTNER_VISIBILITY_REQUEST'$q$, current_setting('t.felix')), '1');
select pg_temp.essai('F16 le parent donne son accord (chemin existant set_child_consent)', current_setting('t.parent'),
  format($q$select public.set_child_consent(%L, 'image_partenaire', true, %L)->>'ok'$q$, current_setting('t.felix'), current_setting('t.pol')), 'true');
select pg_temp.essai('F17 la demande se règle seule : ACCEPTEE', 'postgres',
  format(current_setting('t.q_dem'), current_setting('t.mp1'), current_setting('t.mp2'), current_setting('t.felix')), 'p2:ACCEPTEE:1');
select pg_temp.essai('F18 tout réapparaît pour le recruteur (une évaluation par partenaire)', current_setting('t.rec'),
  current_setting('t.q_felix'), '2|2|2');
select pg_temp.essai('F19 W4a « déjà évalué » : les évaluations existantes de p1 (4) et p2 (3) sont gardées', current_setting('t.rec'),
  format('select string_agg(cote_globale::text, '','' order by cote_globale) from public.evaluations_partenaires_athlete(%L)', current_setting('t.felix')), '3.00,4.00');

-- ── G. Une carte qui disparaît sans acceptation rend la demande CADUQUE ───────
reset role;
update public.athletes set partner_visibility_opt_in = false, partner_visibility_parental_consent = false,
       partner_visibility_opted_in_at = null, date_naissance = current_date - interval '17 years'
 where id = current_setting('t.felix')::uuid;
delete from public.athlete_notifications where athlete_id = current_setting('t.felix')::uuid and type = 'PARTENAIRE_VISIBILITE_DEMANDE';
set local role authenticated;
select pg_temp.essai('G1 p1 crée c7 « Félix »', current_setting('t.p1'),
  format(current_setting('t.q_creer'), 'Félix', 'Essai', current_setting('t.foot'), '4', '{}', '{}', '{}', 'c7'), 'ok');
select pg_temp.essai('G2 lien c7', current_setting('t.p1'), format(current_setting('t.q_lien'), (select id from _ids where cle = 'c7'), 'c7'), '64');
select pg_temp.essai('G3 Félix ouvre c7', current_setting('t.felix_u'),
  format('select public.prospect_partenaire_ouvrir(%L)->>''prenom''', (select jeton from _jet where cle = 'c7')), 'Félix');
select pg_temp.essai('G4 Félix confirme c7', current_setting('t.felix_u'),
  format('select public.prospect_partenaire_confirmer(%L)->>''statut''', (select id from _ids where cle = 'c7')), 'attente_optin');
reset role;
delete from public.partenaire_prospects where id = (select id from _ids where cle = 'c7');
select pg_temp.essai('G5 carte disparue (échéance, annulation) : demande CADUQUE', 'postgres',
  format(current_setting('t.q_dem'), current_setting('t.mp1'), current_setting('t.mp2'), current_setting('t.felix')), 'p1:CADUQUE:1');

-- ── H. anon et droits ────────────────────────────────────────────────────────
set local role anon;
select pg_temp.essai('H1 anon : lot refusé', null, format('select count(*)::text from public.cotes_partenaires_athletes(%s)', current_setting('t.lot')), 'ERR:42501');
select pg_temp.essai('H2 anon : Mes athlètes refusée', null, 'select count(*)::text from public.partenaire_mes_athletes()', 'ERR:42501');
select pg_temp.essai('H6 anon : « Accepter » refusé', null,
  format($q$select public.accepter_visibilite_partenaire(gen_random_uuid(), %L)->>'reason'$q$, current_setting('t.pol')), 'ERR:42501');
reset role;
set local role authenticated;
select pg_temp.essai('H3 les fonctions internes de la demande ne sont pas appelables', current_setting('t.felix_u'),
  format('select public.partenaire_demander_visibilite(%L)::text', (select id from _ids where cle = 'c1')), 'ERR:42501');
reset role;
select pg_temp.essai('H4 ACL complètes', null,
  $q$select string_agg(proname || '=' || array_to_string(array(select coalesce(nullif(split_part(x, '=', 1), ''), 'PUBLIC') from unnest(proacl::text[]) x order by 1), ','), ';' order by proname)
       from pg_proc where pronamespace = 'public'::regnamespace and proname in ('cotes_partenaires_athletes', 'partenaire_mes_athletes', 'accepter_visibilite_partenaire', 'partenaire_demander_visibilite', 'evaluations_partenaires_athlete', 'badges_partenaires_athlete')$q$,
  'accepter_visibilite_partenaire=authenticated,postgres,service_role;badges_partenaires_athlete=authenticated,postgres,service_role;cotes_partenaires_athletes=authenticated,postgres,service_role;evaluations_partenaires_athlete=authenticated,postgres,service_role;partenaire_demander_visibilite=postgres,service_role;partenaire_mes_athletes=authenticated,postgres,service_role');
select pg_temp.essai('H5 le lot est INVOKER, Mes athlètes DEFINER', null,
  $q$select string_agg(proname || '=' || prosecdef, ',' order by proname) from pg_proc where pronamespace = 'public'::regnamespace and proname in ('cotes_partenaires_athletes', 'partenaire_mes_athletes')$q$,
  'cotes_partenaires_athletes=false,partenaire_mes_athletes=true');

select n, case when ok then 'OK' else 'ÉCHEC' end as verdict, test, detail from _res order by n;
select count(*) filter (where ok) as ok, count(*) filter (where not ok) as echecs from _res;
rollback;
