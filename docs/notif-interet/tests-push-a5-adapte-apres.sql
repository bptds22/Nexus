-- Push A5 (20261016020000), base LOCALE — le banc A4a ENTIER rejoué sur une base OÙ A5 EST DÉJÀ APPLIQUÉE,
-- plus la section A5 (C, N, G, D). Une transaction ANNULÉE à la fin : rien ne survit.
--   (généré par docs/push-a5/assembler-banc.py — ne pas éditer à la main)
--   docker cp supabase/migrations/20261016020000_push_a5_ouverture.sql supabase_db_Nexus:/tmp/a5.sql
--   docker cp docs/push-a5/tests-push-a5.sql supabase_db_Nexus:/tmp/tests-a5.sql
--   docker exec -e PGCLIENTENCODING=UTF8 supabase_db_Nexus psql -U postgres -d postgres -q -At -f /tmp/tests-a5.sql
-- Push A4a (20261016010000), base LOCALE. Une transaction ANNULÉE à la fin : rien ne survit.
-- Ce qui part réellement est lu dans la file de pg_net (faux secret posé dans le Vault DANS la
-- transaction, jamais validée → rien ne part). Chaque essai « utilisateur » tourne sous le VRAI rôle
-- avec un JWT simulé.
--   docker cp docs/push-a4a/tests-push-a4a.sql supabase_db_Nexus:/tmp/tests-push.sql
--   docker exec -e PGCLIENTENCODING=UTF8 supabase_db_Nexus psql -U postgres -d postgres -q -At -f /tmp/tests-push.sql
\set ON_ERROR_STOP 1
\pset footer off
begin;

create temp table _res (n serial, test text, ok boolean, detail text) on commit drop;
grant all on _res to authenticated, anon, service_role;
grant usage on sequence _res_n_seq to authenticated, anon, service_role;
create temp table _ids (cle text primary key, id uuid) on commit drop;
grant all on _ids to authenticated, anon;

create function pg_temp.verif(p_test text, p_obtenu text, p_attendu text) returns void language sql as $$
  insert into _res (test, ok, detail) values (p_test, p_obtenu is not distinct from p_attendu,
    coalesce(p_obtenu, 'NULL') || ' (attendu ' || coalesce(p_attendu, 'NULL') || ')')
$$;
-- essai : sous le rôle courant avec un JWT simulé ; rend le résultat ou « ERR:<sqlstate> ».
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
  values (p_test, r is not distinct from p_attendu, coalesce(r, 'NULL') || ' (attendu ' || coalesce(p_attendu, 'NULL') || ')');
end $$;
grant execute on function pg_temp.verif(text, text, text) to authenticated, anon;
grant execute on function pg_temp.essai(text, text, text, text) to authenticated, anon;

-- ── Comptes ─────────────────────────────────────────────────────────────────
select set_config('t.marc',   (select id::text from users where email = 'marc.desrosiers@exemple.test'), true);  -- coach SECONDAIRE
select set_config('t.luc',    (select id::text from users where email = 'luc.arsenault@exemple.test'), true);    -- coach CEGEP
select set_config('t.admin',  (select id::text from users where email = 'admin@demo.local'), true);
select set_config('t.p1',     (select id::text from users where email = 'p1.partenaire@preuve.local'), true);
select set_config('t.mp1',    (select mp.id::text from media_partners mp join users u on u.id = mp.user_id where u.email = 'p1.partenaire@preuve.local'), true);
select set_config('t.mp1_nom',(select organization_name from media_partners where id = current_setting('t.mp1')::uuid), true);
select set_config('t.felix_u',  (select id::text from users where email = 'felix.gauthier@exemple.test'), true);
select set_config('t.felix',    (select a.id::text from athletes a where a.user_id = current_setting('t.felix_u')::uuid), true);
select set_config('t.mathis_u', (select id::text from users where email = 'mathis.demo@exemple.test'), true);
select set_config('t.mathis',   (select a.id::text from athletes a where a.user_id = current_setting('t.mathis_u')::uuid), true);
select set_config('t.a1_u',  (select id::text from users where email = 'a1.athlete@preuve.local'), true);   -- évalué par le coach collégial
select set_config('t.tom_u', (select id::text from users where email = 'tom@demo.local'), true);            -- sans jeton
select set_config('t.lea_u', (select id::text from users where email = 'lea@demo.local'), true);            -- préférence coupée
select set_config('t.noah_u',(select id::text from users where email = 'noah@demo.local'), true);           -- compte inactif
select set_config('t.a1',   (select id::text from athletes where user_id = current_setting('t.a1_u')::uuid), true);
select set_config('t.tom',  (select id::text from athletes where user_id = current_setting('t.tom_u')::uuid), true);
select set_config('t.lea',  (select id::text from athletes where user_id = current_setting('t.lea_u')::uuid), true);
select set_config('t.noah', (select id::text from athletes where user_id = current_setting('t.noah_u')::uuid), true);
select set_config('t.marc_nom', (select btrim(first_name || ' ' || last_name) from users where id = current_setting('t.marc')::uuid), true);
select set_config('t.luc_nom',  (select btrim(first_name || ' ' || last_name) from users where id = current_setting('t.luc')::uuid), true);
select set_config('t.felix_prenom', (select first_name from athletes where id = current_setting('t.felix')::uuid), true);
select set_config('t.felix_nom', (select last_name from athletes where id = current_setting('t.felix')::uuid), true);
select set_config('t.mathis_prenom', (select first_name from athletes where id = current_setting('t.mathis')::uuid), true);
select set_config('t.mathis_nom', (select last_name from athletes where id = current_setting('t.mathis')::uuid), true);
select set_config('t.mathis_equipe', (select ta.team_id::text from team_athletes ta where ta.athlete_id = current_setting('t.mathis')::uuid limit 1), true);
select set_config('t.foot', (select id::text from sports where nom = 'Football'), true);
select set_config('t.equipe', (select ta.team_id::text from team_athletes ta where ta.athlete_id = current_setting('t.felix')::uuid limit 1), true);

-- Moments (heure du Québec) : demain 22 h 30, après-demain 7 h 59, 8 h 00, 8 h 06, 14 h.
select set_config('t.j_soir', ((date_trunc('day', now() at time zone 'America/Toronto') + interval '1 day 22 hours 30 minutes') at time zone 'America/Toronto')::text, true);
select set_config('t.j_759',  ((date_trunc('day', now() at time zone 'America/Toronto') + interval '2 days 7 hours 59 minutes') at time zone 'America/Toronto')::text, true);
select set_config('t.j_800',  ((date_trunc('day', now() at time zone 'America/Toronto') + interval '2 days 8 hours') at time zone 'America/Toronto')::text, true);
select set_config('t.j_806',  ((date_trunc('day', now() at time zone 'America/Toronto') + interval '2 days 8 hours 6 minutes') at time zone 'America/Toronto')::text, true);
select set_config('t.j_1400', ((date_trunc('day', now() at time zone 'America/Toronto') + interval '2 days 14 hours') at time zone 'America/Toronto')::text, true);

-- ── Préparation (postgres), annulée à la fin ────────────────────────────────
select vault.create_secret('secret-de-test-banc-push', 'PUSH_DISPATCH_SECRET');
update athletes set status = 'ACTIF' where id in (current_setting('t.a1')::uuid, current_setting('t.tom')::uuid, current_setting('t.lea')::uuid);
update users set status = 'ACTIF' where id in (current_setting('t.a1_u')::uuid, current_setting('t.tom_u')::uuid, current_setting('t.lea_u')::uuid);
update users set status = 'DESACTIVE' where id = current_setting('t.noah_u')::uuid;
insert into device_tokens (user_id, token, platform)
select u, 'jeton-banc-push-' || u, 'ios'
  from unnest(array[current_setting('t.felix_u'), current_setting('t.mathis_u'), current_setting('t.a1_u'),
                    current_setting('t.lea_u'), current_setting('t.noah_u')]::uuid[]) u
on conflict do nothing;
delete from device_tokens where user_id = current_setting('t.tom_u')::uuid;
-- Le partenaire p1 (Média Preuve) : évaluateur en football, un badge propre.
update media_partners set peut_evaluer = true where id = current_setting('t.mp1')::uuid;
insert into partenaire_sports_permis (partner_id, sport_id)
values (current_setting('t.mp1')::uuid, current_setting('t.foot')::uuid) on conflict do nothing;
update athletes set partner_visibility_opt_in = true
 where id in (current_setting('t.felix')::uuid, current_setting('t.mathis')::uuid);
with b as (insert into partner_badges (partner_id, libelle, icone_path, actif, ordre)
           values (current_setting('t.mp1')::uuid, 'Top 25', current_setting('t.mp1') || '/banc-push.png', true, 0) returning id)
insert into _ids select 'pb', id from b;
with b as (insert into partner_badges (partner_id, libelle, icone_path, actif, ordre)
           values (current_setting('t.mp1')::uuid, 'Esprit sportif', current_setting('t.mp1') || '/banc-push-2.png', true, 1) returning id)
insert into _ids select 'pb2', id from b;
delete from push_file;
delete from push_envois;
select set_config('t.q_net', coalesce((select max(id) from net.http_request_queue), 0)::text, true);

-- ── S. Droits ───────────────────────────────────────────────────────────────
set local role authenticated;
select pg_temp.essai('S1 un utilisateur ne lit pas la file', current_setting('t.felix_u'), 'select count(*)::text from public.push_file', 'ERR:42501');
select pg_temp.essai('S2 ni le journal', current_setting('t.felix_u'), 'select count(*)::text from public.push_envois', 'ERR:42501');
select pg_temp.essai('S3 ne traite pas la file', current_setting('t.felix_u'), 'select public.push_traiter_file()::text', 'ERR:42501');
select pg_temp.essai('S4 ne met rien en file', current_setting('t.felix_u'),
  format('select public.push_mettre_en_file(%L, ''RAPPELS'', ''BADGE_COACH'', ''x'', null, null)::text', current_setting('t.felix')), 'ERR:42501');
select pg_temp.essai('S5 n''envoie pas de push', current_setting('t.felix_u'),
  format('select public.push_to_user(%L, ''t'', ''b'', ''{}''::jsonb)::text', current_setting('t.felix_u')), 'ERR:42501');
select pg_temp.essai('S6 n''écrit pas ses préférences directement', current_setting('t.felix_u'),
  format('insert into public.push_preferences (user_id, categorie, actif) values (%L, ''VISITES'', false) returning ''ok''', current_setting('t.felix_u')), 'ERR:42501');
select pg_temp.essai('S7 coupe un type par la fonction', current_setting('t.felix_u'),
  'select public.push_preference_definir(''VISITES'', false)::text || ''ok''', 'ok');
select pg_temp.essai('S8 ses préférences : VISITES coupé, le reste actif', current_setting('t.felix_u'),
  'select string_agg(categorie || ''='' || actif, '','') from public.push_preferences_miennes()',
  'BADGES_EVALUATIONS=true,VISITES=false,RAPPELS=true,CARTES_PARTENAIRES=true');
select pg_temp.essai('S9 type inconnu refusé', current_setting('t.felix_u'),
  'select public.push_preference_definir(''GRADES'', false)::text', 'ERR:22023');
reset role;
insert into push_preferences (user_id, categorie, actif) values (current_setting('t.mathis_u')::uuid, 'RAPPELS', false);
set local role authenticated;
select pg_temp.essai('S10 il ne voit que SES préférences', current_setting('t.felix_u'),
  'select count(*)::text from public.push_preferences', '1');
reset role;
set local role anon;
select pg_temp.essai('S11 anonyme : aucune préférence', null, 'select public.push_preference_definir(''VISITES'', true)::text', 'ERR:42501');
reset role;
select pg_temp.verif('S12 push_to_user : une seule signature, les appels à 4 arguments restent valides',
  (select count(*)::text from pg_proc where proname = 'push_to_user')
  || '|' || (select pg_get_function_arguments('public.push_to_user(uuid,text,text,jsonb,text)'::regprocedure)),
  '1|p_user_id uuid, p_title text, p_body text, p_data jsonb, p_collapse_id text DEFAULT NULL::text');

-- ── B. Badges du coach : avant / après, aucun faux nouveau badge ────────────
set local role authenticated;
select pg_temp.essai('B1 Marc pose 2 badges', current_setting('t.marc'),
  format($q$select public.appliquer_badges_saisie(%L, '[{"code":"clutch"},{"code":"qi"}]'::jsonb)::text || 'ok'$q$, current_setting('t.felix')), 'ok');
reset role;
select pg_temp.verif('B2 → 2 éléments BADGE_COACH, Marc nommé (coach du secondaire)',
  (select count(*) || '|' || max(source_nom) from push_file where genre = 'BADGE_COACH' and user_id = current_setting('t.felix_u')::uuid),
  '2|' || current_setting('t.marc_nom'));
set local role authenticated;
select pg_temp.essai('B3 le même enregistrement une 2e fois', current_setting('t.marc'),
  format($q$select public.appliquer_badges_saisie(%L, '[{"code":"clutch"},{"code":"qi"}]'::jsonb)::text || 'ok'$q$, current_setting('t.felix')), 'ok');
reset role;
select pg_temp.verif('B4 → aucun nouvel élément', (select count(*)::text from push_file where genre = 'BADGE_COACH'), '2');
set local role authenticated;
select pg_temp.essai('B5 Marc ajoute un badge à contexte', current_setting('t.marc'),
  format($q$select public.appliquer_badges_saisie(%L, '[{"code":"clutch"},{"code":"qi"},{"code":"mvp","contexte":"Saison 2025"}]'::jsonb)::text || 'ok'$q$, current_setting('t.felix')), 'ok');
reset role;
select pg_temp.verif('B6 → un seul nouvel élément', (select count(*)::text from push_file where genre = 'BADGE_COACH'), '3');
set local role authenticated;
select pg_temp.essai('B7 Marc change seulement le contexte (retrait + pose en base)', current_setting('t.marc'),
  format($q$select public.appliquer_badges_saisie(%L, '[{"code":"clutch"},{"code":"qi"},{"code":"mvp","contexte":"Saison 2026"}]'::jsonb)::text || 'ok'$q$, current_setting('t.felix')), 'ok');
reset role;
select pg_temp.verif('B8 → ce n''est pas un nouveau badge : rien en file',
  (select count(*)::text from push_file where genre = 'BADGE_COACH') || '|'
  || (select count(*)::text from athlete_badges ab join badges b on b.id = ab.badge_id
       where ab.athlete_id = current_setting('t.felix')::uuid and b.code = 'mvp' and ab.retire_le is not null), '3|1');
set local role authenticated;
select pg_temp.essai('B9 Marc retire un badge', current_setting('t.marc'),
  format($q$select public.appliquer_badges_saisie(%L, '[{"code":"clutch"},{"code":"mvp","contexte":"Saison 2026"}]'::jsonb)::text || 'ok'$q$, current_setting('t.felix')), 'ok');
select pg_temp.essai('B10 l''admin corrige (ajoute un badge)', current_setting('t.admin'),
  format($q$select public.appliquer_badges_saisie(%L, '[{"code":"clutch"},{"code":"mvp","contexte":"Saison 2026"},{"code":"costaud"}]'::jsonb)::text || 'ok'$q$, current_setting('t.felix')), 'ok');
reset role;
select pg_temp.verif('B11 retrait et correction d''admin : rien en file', (select count(*)::text from push_file where genre = 'BADGE_COACH'), '3');

-- ── E. Évaluations du coach ─────────────────────────────────────────────────
insert into evaluations (coach_id, athlete_id, leadership, discipline, coachabilite)
values (current_setting('t.marc')::uuid, current_setting('t.felix')::uuid, 4, 4, 4)
on conflict (coach_id, athlete_id) do update set leadership = 4, discipline = 4, coachabilite = 4;
select pg_temp.verif('E1 évaluation (création ou cote changée) → 1 élément, Marc nommé',
  (select count(*) || '|' || max(source_nom) from push_file where genre = 'EVALUATION_COACH' and user_id = current_setting('t.felix_u')::uuid),
  '1|' || current_setting('t.marc_nom'));
update evaluations set commentaires = 'Bon match', distinctions = coalesce(distinctions, '[]'::jsonb)
 where coach_id = current_setting('t.marc')::uuid and athlete_id = current_setting('t.felix')::uuid;
select pg_temp.verif('E2 écriture sans changement de cote (commentaire, distinctions) → rien',
  (select count(*)::text from push_file where genre = 'EVALUATION_COACH' and user_id = current_setting('t.felix_u')::uuid), '1');
update evaluations set leadership = 2
 where coach_id = current_setting('t.marc')::uuid and athlete_id = current_setting('t.felix')::uuid;
select pg_temp.verif('E3 la cote change → 1 élément de plus (même groupe)',
  (select count(*)::text from push_file where genre = 'EVALUATION_COACH' and user_id = current_setting('t.felix_u')::uuid), '2');
insert into evaluations (coach_id, athlete_id, leadership, discipline, coachabilite)
values (current_setting('t.luc')::uuid, current_setting('t.a1')::uuid, 3, 3, 3);
select pg_temp.verif('E4 coach COLLÉGIAL : jamais nommé (source vide)',
  (select count(*) || '|' || coalesce(max(source_nom), 'aucun') from push_file where genre = 'EVALUATION_COACH' and user_id = current_setting('t.a1_u')::uuid),
  '1|aucun');

-- ── P. Badges et évaluations partenaire (triggers des tables) ───────────────
insert into partner_athlete_badges (partner_badge_id, athlete_id, attribue_par, partner_id)
values ((select id from _ids where cle = 'pb'), current_setting('t.mathis')::uuid, current_setting('t.p1')::uuid, current_setting('t.mp1')::uuid);
insert into partner_athlete_badges (partner_badge_id, athlete_id, attribue_par, partner_id)
values ((select id from _ids where cle = 'pb2'), current_setting('t.mathis')::uuid, current_setting('t.p1')::uuid, current_setting('t.mp1')::uuid);
insert into partner_athlete_badges (badge_id, athlete_id, attribue_par, partner_id)
values ((select id from badges where code = 'vitesse'), current_setting('t.mathis')::uuid, current_setting('t.p1')::uuid, current_setting('t.mp1')::uuid);
select pg_temp.verif('P1 3 badges partenaire → 3 éléments, même groupe, partenaire nommé',
  (select count(*) || '|' || count(distinct cle) || '|' || max(source_nom) from push_file
    where genre = 'BADGE_PARTENAIRE' and user_id = current_setting('t.mathis_u')::uuid),
  '3|1|' || current_setting('t.mp1_nom'));
insert into partner_athlete_badges (partner_badge_id, athlete_id, attribue_par, partner_id, retire_le)
values ((select id from _ids where cle = 'pb'), current_setting('t.lea')::uuid, current_setting('t.p1')::uuid, current_setting('t.mp1')::uuid, now());
select pg_temp.verif('P2 badge posé déjà retiré → rien', (select count(*)::text from push_file where user_id = current_setting('t.lea_u')::uuid), '0');
insert into partner_evaluations (partner_id, athlete_id, evalue_par, cote_globale, leadership)
values (current_setting('t.mp1')::uuid, current_setting('t.mathis')::uuid, current_setting('t.p1')::uuid, 4, 4);
update partner_evaluations set updated_at = now()
 where partner_id = current_setting('t.mp1')::uuid and athlete_id = current_setting('t.mathis')::uuid;
select pg_temp.verif('P3 évaluation partenaire → 1 ; mise à jour sans changement de cote → rien',
  (select count(*)::text from push_file where genre = 'EVALUATION_PARTENAIRE' and user_id = current_setting('t.mathis_u')::uuid), '1');
insert into partner_evaluations (partner_id, athlete_id, evalue_par, cote_globale, leadership)
values (current_setting('t.mp1')::uuid, current_setting('t.tom')::uuid, current_setting('t.p1')::uuid, 3, 3);
insert into partner_evaluations (partner_id, athlete_id, evalue_par, cote_globale, leadership)
values (current_setting('t.mp1')::uuid, current_setting('t.lea')::uuid, current_setting('t.p1')::uuid, 3, 3);
insert into partner_athlete_badges (partner_badge_id, athlete_id, attribue_par, partner_id)
values ((select id from _ids where cle = 'pb'), current_setting('t.noah')::uuid, current_setting('t.p1')::uuid, current_setting('t.mp1')::uuid);
set local role authenticated;
select pg_temp.essai('P4 Léa coupe les pushs badges et évaluations', current_setting('t.lea_u'),
  'select public.push_preference_definir(''BADGES_EVALUATIONS'', false)::text || ''ok''', 'ok');
reset role;

-- ── C. Carte partenaire : proposition, confirmation, transfert ──────────────
set local role authenticated;
select pg_temp.essai('C1 p1 crée une carte au nom de Félix (cote 4, badge Top 25)', current_setting('t.p1'),
  format('with c as (select public.partenaire_prospect_enregistrer(null, %L, %L, %L::uuid, null, null, %L::uuid, 2027, true, 4, ''{}''::jsonb, %L::uuid[], ''{}''::uuid[]) as id) insert into _ids select ''c1'', id from c returning ''ok''',
         current_setting('t.felix_prenom'), current_setting('t.felix_nom'),
         current_setting('t.foot'), current_setting('t.equipe'), '{' || (select id from _ids where cle = 'pb') || '}'), 'ok');
reset role;
-- Proposée d'office (opt-in actif) ; sinon l'admin la propose — comme en W4a.
do $p$ begin
  if (select statut from partenaire_prospects where id = (select id from _ids where cle = 'c1')) <> 'RESERVEE' then
    perform set_config('request.jwt.claims', json_build_object('sub', current_setting('t.admin'), 'role', 'authenticated')::text, true);
    perform public.admin_prospect_proposer((select id from _ids where cle = 'c1'), current_setting('t.felix')::uuid);
  end if;
end $p$;
select pg_temp.verif('C2 la carte est proposée à Félix',
  (select statut || '|' || reservee_athlete from partenaire_prospects where id = (select id from _ids where cle = 'c1')),
  'RESERVEE|' || current_setting('t.felix'));
select pg_temp.verif('C3 notification : nouveau texte',
  (select title || ' / ' || message from athlete_notifications
    where type = 'PARTENAIRE_EVALUATION' and metadata->>'carte_id' = (select id::text from _ids where cle = 'c1')),
  current_setting('t.mp1_nom') || ' t''a évalué. C''est toi ? / Réponds dans l''appli Nexus ou sur nexussports.ca.');
select pg_temp.verif('C4 push en file (cartes partenaires), partenaire nommé',
  (select count(*) || '|' || max(categorie) || '|' || max(source_nom) from push_file
    where genre = 'CARTE_PARTENAIRE' and detail->>'carte_id' = (select id::text from _ids where cle = 'c1')),
  '1|CARTES_PARTENAIRES|' || current_setting('t.mp1_nom'));
set local role authenticated;
select pg_temp.essai('C5 Félix confirme : transfert', current_setting('t.felix_u'),
  format('select public.prospect_partenaire_confirmer(%L)->>''statut''', (select id from _ids where cle = 'c1')), 'transferee');
reset role;
select pg_temp.verif('C6 le transfert met en file le badge ET l''évaluation du partenaire',
  (select string_agg(genre, ',' order by genre) from push_file
    where user_id = current_setting('t.felix_u')::uuid and genre in ('BADGE_PARTENAIRE', 'EVALUATION_PARTENAIRE')),
  'BADGE_PARTENAIRE,EVALUATION_PARTENAIRE');

-- ── D. Le texte des notifications encore sans réponse (copie conforme de la migration) ──
set local role authenticated;
select pg_temp.essai('D1 p1 crée une 2e carte, au nom de Mathis', current_setting('t.p1'),
  format('with c as (select public.partenaire_prospect_enregistrer(null, %L, %L, %L::uuid, null, null, %L::uuid, 2027, true, null, ''{}''::jsonb, ''{}''::uuid[], ''{}''::uuid[]) as id) insert into _ids select ''c2'', id from c returning ''ok''',
         current_setting('t.mathis_prenom'), current_setting('t.mathis_nom'),
         current_setting('t.foot'), current_setting('t.mathis_equipe')), 'ok');
reset role;
do $p$ begin
  if (select statut from partenaire_prospects where id = (select id from _ids where cle = 'c2')) <> 'RESERVEE' then
    perform set_config('request.jwt.claims', json_build_object('sub', current_setting('t.admin'), 'role', 'authenticated')::text, true);
    perform public.admin_prospect_proposer((select id from _ids where cle = 'c2'), current_setting('t.mathis')::uuid);
  end if;
end $p$;
select pg_temp.verif('D2 proposée à Mathis',
  (select statut || '|' || reservee_athlete from partenaire_prospects where id = (select id from _ids where cle = 'c2')),
  'RESERVEE|' || current_setting('t.mathis'));
-- Ancien texte remis sur : la proposition en cours (Mathis), la confirmée (Félix), et une copie caduque.
update athlete_notifications
   set message = 'Réponds depuis nexussports.ca : confirme si c''est bien toi, ou indique que ce n''est pas toi.'
 where type = 'PARTENAIRE_EVALUATION';
insert into athlete_notifications (athlete_id, type, title, message, metadata)
select athlete_id, type, title, message, metadata || '{"caduque": true}'::jsonb
  from athlete_notifications where type = 'PARTENAIRE_EVALUATION' and athlete_id = current_setting('t.mathis')::uuid;
update public.athlete_notifications n
   set message = 'Réponds dans l''appli Nexus ou sur nexussports.ca.'
 where n.type = 'PARTENAIRE_EVALUATION'
   and n.message = 'Réponds depuis nexussports.ca : confirme si c''est bien toi, ou indique que ce n''est pas toi.'
   and not coalesce((n.metadata->>'caduque')::boolean, false)
   and exists (select 1 from public.partenaire_prospects_rapprochements r
                where r.carte_id::text = n.metadata->>'carte_id' and r.athlete_id = n.athlete_id
                  and r.statut = 'PROPOSE');
select pg_temp.verif('D3 seule la proposition SANS réponse prend le nouveau texte (confirmée et caduque : inchangées)',
  (select string_agg(case when a.id = current_setting('t.felix')::uuid then 'felix' else 'mathis' end
                     || case when coalesce((n.metadata->>'caduque')::boolean, false) then '-caduque' else '' end
                     || '=' || case when n.message like 'Réponds dans%' then 'nouveau' else 'ancien' end, ','
                     -- [adaptation 3] tri explicite (« order by 1 » triait par une constante).
                     order by case when a.id = current_setting('t.felix')::uuid then 0 else 1 end,
                              coalesce((n.metadata->>'caduque')::boolean, false) desc)
     from athlete_notifications n join athletes a on a.id = n.athlete_id where n.type = 'PARTENAIRE_EVALUATION'),
  'felix=ancien,mathis-caduque=ancien,mathis=nouveau');

-- ── H. Heures calmes ────────────────────────────────────────────────────────
select pg_temp.verif('H1 demain 22 h 30 (Québec) : heures calmes, rien ne part',
  (select (r->>'heures_calmes') || '|' || (select count(*) from push_envois) from (select public.push_traiter_file(current_setting('t.j_soir')::timestamptz) r) s), 'true|0');
select pg_temp.verif('H2 7 h 59 : toujours rien',
  (select (r->>'heures_calmes') || '|' || (select count(*) from push_envois) from (select public.push_traiter_file(current_setting('t.j_759')::timestamptz) r) s), 'true|0');
-- [adaptation 2] fenêtre calme 22 h 00 – 7 h 59 (20261029170000).
select pg_temp.verif('H3 les heures calmes : 7 h 59 oui ; 21 h, 8 h et 20 h 59 non',
  public.push_heure_calme(((date_trunc('day', now() at time zone 'America/Toronto') + interval '21 hours') at time zone 'America/Toronto'))::text
  || public.push_heure_calme(((date_trunc('day', now() at time zone 'America/Toronto') + interval '7 hours 59 minutes') at time zone 'America/Toronto'))::text
  || public.push_heure_calme(((date_trunc('day', now() at time zone 'America/Toronto') + interval '8 hours') at time zone 'America/Toronto'))::text
  || public.push_heure_calme(((date_trunc('day', now() at time zone 'America/Toronto') + interval '20 hours 59 minutes') at time zone 'America/Toronto'))::text,
  'falsetruefalsefalse');

-- ── G. Regroupement sur 10 minutes ──────────────────────────────────────────
-- L'évaluation partenaire de Mathis arrive à 7 h 55 : à 8 h, son groupe n'a pas 10 minutes.
update push_file set cree_le = current_setting('t.j_800')::timestamptz - interval '5 minutes'
 where genre = 'EVALUATION_PARTENAIRE' and user_id = current_setting('t.mathis_u')::uuid;
select set_config('t.r800', public.push_traiter_file(current_setting('t.j_800')::timestamptz)::text, true);
select pg_temp.verif('G1 8 h 00 : la file part (heures calmes finies)', (current_setting('t.r800')::jsonb->>'heures_calmes'), 'false');
select pg_temp.verif('G2 le groupe de moins de 10 min attend',
  (select statut from push_file where genre = 'EVALUATION_PARTENAIRE' and user_id = current_setting('t.mathis_u')::uuid), 'EN_ATTENTE');
select pg_temp.verif('G3 3 badges partenaire → UN push « 3 nouveaux badges de Média Preuve »',
  (select count(*) || '|' || max(titre) || '|' || max(texte) || '|' || max(nb_elements) from push_envois
    where user_id = current_setting('t.mathis_u')::uuid and cle like 'badges:partenaire:%'),
  '1|3 nouveaux badges|3 nouveaux badges de ' || current_setting('t.mp1_nom') || '.|3');
select pg_temp.verif('G4 badges du coach (3) → UN push, coach nommé',
  (select count(*) || '|' || max(titre) || '|' || max(texte) from push_envois
    where user_id = current_setting('t.felix_u')::uuid and cle like 'badges:coach:%'),
  '1|3 nouveaux badges|3 nouveaux badges de ton coach ' || current_setting('t.marc_nom') || '.');
select pg_temp.verif('G5 deux évaluations de Marc → UN push « Ton coach … t''a évalué. »',
  (select count(*) || '|' || max(titre) || '|' || max(texte) || '|' || max(nb_elements) from push_envois
    where user_id = current_setting('t.felix_u')::uuid and cle like 'eval:coach:%'),
  '1|Nouvelle évaluation|Ton coach ' || current_setting('t.marc_nom') || ' t''a évalué.|2');
select pg_temp.verif('G6 badge partenaire seul (transfert) : « Tu as reçu le badge Top 25 de … »',
  (select max(texte) from push_envois where user_id = current_setting('t.felix_u')::uuid and cle like 'badges:partenaire:%'),
  'Tu as reçu le badge Top 25 de ' || current_setting('t.mp1_nom') || '.');
select pg_temp.verif('G7 coach collégial : « Ton entraîneur t''a évalué. »',
  (select max(texte) from push_envois where user_id = current_setting('t.a1_u')::uuid), 'Ton entraîneur t''a évalué.');
select set_config('t.r806', public.push_traiter_file(current_setting('t.j_806')::timestamptz)::text, true);
select pg_temp.verif('G8 8 h 06 : le groupe a 10 min, il part seul',
  (select statut from push_file where genre = 'EVALUATION_PARTENAIRE' and user_id = current_setting('t.mathis_u')::uuid)
  || '|' || (current_setting('t.r806')::jsonb->>'pushs'), 'ENVOYE|1');

-- ── F. Préférences, jeton, compte inactif, carte qui n'attend plus ──────────
select pg_temp.verif('F1 Léa a coupé « badges et évaluations » : marqué PREFERENCE, aucun push',
  (select string_agg(distinct statut, ',') from push_file where user_id = current_setting('t.lea_u')::uuid)
  || '|' || (select count(*) from push_envois where user_id = current_setting('t.lea_u')::uuid), 'PREFERENCE|0');
select pg_temp.verif('F2 Tom n''a aucun appareil : SANS_JETON, aucun push',
  (select string_agg(distinct statut, ',') from push_file where user_id = current_setting('t.tom_u')::uuid)
  || '|' || (select count(*) from push_envois where user_id = current_setting('t.tom_u')::uuid), 'SANS_JETON|0');
select pg_temp.verif('F3 Noah (compte désactivé) : ANNULE, aucun push',
  (select string_agg(distinct statut, ',') from push_file where user_id = current_setting('t.noah_u')::uuid)
  || '|' || (select count(*) from push_envois where user_id = current_setting('t.noah_u')::uuid), 'ANNULE|0');
select pg_temp.verif('F4 carte confirmée avant l''envoi : son push est ANNULÉ',
  (select statut from push_file where genre = 'CARTE_PARTENAIRE' and detail->>'carte_id' = (select id::text from _ids where cle = 'c1')), 'ANNULE');
select pg_temp.verif('F5 carte encore proposée (Mathis) : son push part, titre et texte',
  (select max(titre) || ' / ' || max(texte) || ' / ' || max(collapse_id) from push_envois
    where user_id = current_setting('t.mathis_u')::uuid and cle = 'carte:' || (select id::text from _ids where cle = 'c2')),
  current_setting('t.mp1_nom') || ' t''a évalué. C''est toi ? / Réponds dans l''appli Nexus ou sur nexussports.ca. / nx-carte:'
  || (select id::text from _ids where cle = 'c2'));
select pg_temp.verif('F6 un 2e passage n''envoie rien de plus',
  (select (r->>'pushs') || '|' || (r->>'en_attente') from (select public.push_traiter_file(current_setting('t.j_1400')::timestamptz) r) s), '0|0');

-- ── N. Ce qui part réellement (file pg_net) ─────────────────────────────────
select pg_temp.verif('N1 un appel pg_net par push du journal, délai 15 s',
  (select count(*) || '|' || min(timeout_milliseconds) || '|' || max(timeout_milliseconds) from net.http_request_queue
    where id > current_setting('t.q_net')::bigint and url like '%/functions/v1/send-push'),
  (select count(*) from push_envois) || '|15000|15000');
select pg_temp.verif('N2 corps : type announcement (la 1.4.4 ouvre l''accueil), collapse_id posé, titre et texte du journal',
  (select count(*)::text from net.http_request_queue q join push_envois e
     on e.id = (convert_from(q.body, 'UTF8')::jsonb->'data'->>'envoi_id')::bigint
    where q.id > current_setting('t.q_net')::bigint
      and convert_from(q.body, 'UTF8')::jsonb->'data'->>'type' = 'announcement'
      and convert_from(q.body, 'UTF8')::jsonb->>'collapse_id' = e.collapse_id
      and convert_from(q.body, 'UTF8')::jsonb->>'title' = e.titre
      and convert_from(q.body, 'UTF8')::jsonb->>'body' = e.texte),
  (select count(*)::text from push_envois));

-- ── R. RSEQ et Loi 25 : rien d'interdit dans un push ────────────────────────
select pg_temp.verif('R1 aucun push ne contient le nom d''un cégep',
  (select count(*)::text from push_envois e join schools s on s.type = 'CEGEP' and length(btrim(s.name)) > 3
    where position(lower(btrim(s.name)) in lower(e.titre || ' ' || e.texte)) > 0), '0');
select pg_temp.verif('R2 aucun push ne contient le nom d''un recruteur',
  (select count(*)::text from push_envois e join users u on u.role = 'RECRUTEUR'
    where length(btrim(coalesce(u.first_name, '') || ' ' || coalesce(u.last_name, ''))) > 3
      and position(lower(btrim(u.first_name || ' ' || u.last_name)) in lower(e.titre || ' ' || e.texte)) > 0), '0');
select pg_temp.verif('R3 le coach collégial n''apparaît dans aucun push',
  (select count(*)::text from push_envois where position(lower(current_setting('t.luc_nom')) in lower(titre || ' ' || texte)) > 0), '0');
select pg_temp.verif('R4 ni cote ni grade : ni « cote », ni « grade », ni « /5 », ni nombre décimal ; seul chiffre permis : le nombre de badges ou un nom de badge (Top 25)',
  (select string_agg(texte, ' | ') from push_envois
    where (titre || ' ' || texte) ~* '(cote|grade|/ ?5|[0-9][.,][0-9])'
       or regexp_replace(regexp_replace(titre || ' ' || texte, '[0-9]+ nouveaux badges', '', 'g'), 'badge Top 25', '', 'g') ~ '[0-9]'), null);
select pg_temp.verif('R5 les grades D+ / E / A+ n''apparaissent jamais',
  (select count(*)::text from push_envois where (titre || ' ' || texte) ~ '(^| )(A\+|B\+|C\+|D\+)( |$|\.)'), '0');

-- ── K. Prise en charge par un coach ─────────────────────────────────────────
-- [adaptation 1] verrou de lancement collégial (C0) : ON dans la transaction du banc.
update app_settings set value = 'true' where key = 'lancement_collegial';
select pg_temp.verif('K1 prise en charge : coach_nommable décide du nom (secondaire nommé, sinon « Ton entraîneur »)',
  (select (position('coach_nommable(' in prosrc) > 0)::text
          || '|' || (position('Ton entraîneur t''''a pris en charge.' in prosrc) > 0)::text
          || '|' || (position('''announcement''' in prosrc) > 0)::text
     from pg_proc where oid = 'public.claim_school_athletes(uuid[])'::regprocedure), 'true|true|true');
update athletes set coach_id = null where id = current_setting('t.a1')::uuid;
update athletes set school_id = (select school_id from users where id = current_setting('t.luc')::uuid) where id = current_setting('t.a1')::uuid;
set local role authenticated;
-- [adaptation 4] porte B1 : un coach rattaché à un cégep ne prend plus personne en charge.
select pg_temp.essai('K2 le coach collégial ne peut plus prendre A1 en charge (porte B1)', current_setting('t.luc'),
  format('select public.claim_school_athletes(array[%L]::uuid[])::text', current_setting('t.a1')), 'ERR:P0001');
reset role;
select pg_temp.verif('K3 refus B1 : ni notification ni push de prise en charge',
  (select message from athlete_notifications where athlete_id = current_setting('t.a1')::uuid and type = 'COACH_CLAIMED' order by created_at desc limit 1)
  || ' || ' || (select convert_from(q.body, 'UTF8')::jsonb->>'body' from net.http_request_queue q
                 where q.id > current_setting('t.q_net')::bigint
                   and convert_from(q.body, 'UTF8')::jsonb->>'user_id' = current_setting('t.a1_u') and convert_from(q.body, 'UTF8')::jsonb->>'title' = 'Nexus'
                 order by q.id desc limit 1),
  null);
update athletes set coach_id = null, school_id = (select school_id from users where id = current_setting('t.marc')::uuid)
 where id = current_setting('t.tom')::uuid;
set local role authenticated;
select pg_temp.essai('K4 le coach du secondaire prend en charge Tom', current_setting('t.marc'),
  format('select public.claim_school_athletes(array[%L]::uuid[])::text', current_setting('t.tom')), '1');
reset role;
select pg_temp.verif('K5 secondaire : nommé avec son école',
  (select message from athlete_notifications where athlete_id = current_setting('t.tom')::uuid and type = 'COACH_CLAIMED' order by created_at desc limit 1),
  format('Le coach %s t''a pris en charge à %s. Ouvre l''app pour voir ton profil. Il peut maintenant gérer ton profil et répondre aux recruteurs pour toi.',
         current_setting('t.marc_nom'), (select s.name from users u join schools s on s.id = u.school_id where u.id = current_setting('t.marc')::uuid)));

-- ══ A5 — ouverture au clic et cloche (après tout le banc A4a, même transaction) ══════════

-- ── C. Ce que le push porte ─────────────────────────────────────────────────
select pg_temp.verif('C1 chaque push de la file porte type=announcement + nx_type + route (= push_destination)',
  (select count(*) filter (where d->>'type' = 'announcement' and d ? 'nx_type'
                             and d->>'route' = public.push_destination(d->>'nx_type')->>'route')
          || '/' || count(*)
     from (select convert_from(q.body, 'UTF8')::jsonb->'data' as d from net.http_request_queue q
            where q.id > current_setting('t.q_net')::bigint
              and convert_from(q.body, 'UTF8')::jsonb->'data' ? 'envoi_id') x),
  (select count(*) || '/' || count(*) from push_envois));
select pg_temp.verif('C2 nx_type = le genre de la file, route attendue par genre',
  (select string_agg(distinct d->>'nx_type' || '→' || (d->>'route'), ', ' order by d->>'nx_type' || '→' || (d->>'route'))
     from (select convert_from(q.body, 'UTF8')::jsonb->'data' as d from net.http_request_queue q
            where q.id > current_setting('t.q_net')::bigint
              and convert_from(q.body, 'UTF8')::jsonb->'data' ? 'envoi_id') x),
  (select string_agg(distinct f.genre || '→' || (public.push_destination(f.genre)->>'route'), ', '
                     order by f.genre || '→' || (public.push_destination(f.genre)->>'route'))
     from push_file f where f.statut = 'ENVOYE'));
select pg_temp.verif('C3 routes de la liste blanche du client',
  public.push_destination('BADGE_COACH')->>'route' || ' | ' || (public.push_destination('BADGE_PARTENAIRE')->>'route')
  || ' | ' || (public.push_destination('EVALUATION_COACH')->>'route') || ' | ' || (public.push_destination('EVALUATION_PARTENAIRE')->>'route')
  || ' | ' || (public.push_destination('CARTE_PARTENAIRE')->>'route') || ' | ' || (public.push_destination('AUTRE')->>'route'),
  '/athlete/profil/apercu?section=badges | /athlete/profil/apercu?section=badges | /athlete/profil/apercu?section=evaluation | /athlete/profil/apercu?section=evaluation | /athlete/cartes-partenaires | /athlete/notifications');
select pg_temp.verif('C4 les autres clés du push sont inchangées (categorie, envoi_id, collapse_id)',
  (select count(*)::text from net.http_request_queue q
    where q.id > current_setting('t.q_net')::bigint
      and convert_from(q.body, 'UTF8')::jsonb->'data' ? 'envoi_id'
      and not (convert_from(q.body, 'UTF8')::jsonb->'data' ? 'categorie'
               and convert_from(q.body, 'UTF8')::jsonb ? 'collapse_id')), '0');

-- ── N. Chaque élément de la file a sa ligne dans la cloche ───────────────────
select pg_temp.verif('N1 tout élément badge/évaluation/carte a sa notification (sauf la mise à jour d''évaluation du coach, qui a la sienne)',
  (select count(*)::text from push_file f
    where not (
        exists (select 1 from athlete_notifications n where n.id::text = f.detail->>'notification_id'
                   and n.type = case f.genre when 'BADGE_COACH' then 'COACH_DISTINCTION_ADDED'
                                             when 'EVALUATION_COACH' then 'COACH_EVALUATION_UPDATED'
                                             when 'BADGE_PARTENAIRE' then 'PARTENAIRE_BADGE'
                                             when 'EVALUATION_PARTENAIRE' then 'PARTENAIRE_EVALUATION_RECUE'
                                             when 'CARTE_PARTENAIRE' then 'PARTENAIRE_EVALUATION' end)
        or (f.genre = 'EVALUATION_COACH' and not (f.detail ? 'notification_id')
            and exists (select 1 from athlete_notifications n join athletes a on a.id = n.athlete_id
                         where a.user_id = f.user_id and n.type = 'COACH_EVALUATION_UPDATED'
                           and n.created_at = now() and not (n.metadata ? 'push_cle'))))), '0');
select pg_temp.verif('N2 aussi pour ce qui ne part pas (préférence coupée, sans appareil, compte inactif)',
  (select count(*) filter (where f.detail ? 'notification_id') || '/' || count(*) from push_file f
    where f.statut in ('PREFERENCE', 'SANS_JETON', 'ANNULE') and f.genre <> 'CARTE_PARTENAIRE'
      and not (f.genre = 'EVALUATION_COACH' and not (f.detail ? 'notification_id'))),
  (select count(*) || '/' || count(*) from push_file f
    where f.statut in ('PREFERENCE', 'SANS_JETON', 'ANNULE') and f.genre <> 'CARTE_PARTENAIRE'
      and not (f.genre = 'EVALUATION_COACH' and not (f.detail ? 'notification_id'))));
select pg_temp.verif('N3 un push groupé = UNE notification, au texte du push',
  (select count(*)::text from push_envois e
    where e.categorie = 'BADGES_EVALUATIONS'
      and exists (select 1 from push_file f where f.envoi_id = e.id and f.detail ? 'notification_id')
      and ((select count(distinct f.detail->>'notification_id') from push_file f where f.envoi_id = e.id and f.detail ? 'notification_id') <> 1
           or not exists (select 1 from athlete_notifications n
                           where n.id::text = (select max(f.detail->>'notification_id') from push_file f where f.envoi_id = e.id)
                             and n.title = e.titre and n.message = e.texte))), '0');
select pg_temp.verif('N4 au moins un groupe de plusieurs badges a été vérifié',
  (select (count(*) > 0)::text from push_envois e where e.nb_elements > 1 and e.categorie = 'BADGES_EVALUATIONS'), 'true');
select pg_temp.verif('N5 la cloche ne porte ni cote, ni grade, ni chiffre (hors « N nouveaux badges »)',
  (select count(*)::text from athlete_notifications n
    where n.metadata ? 'push_cle'
      and ((n.title || ' ' || coalesce(n.message, '')) ~* '(cote|grade|/ ?5|[0-9][.,][0-9])'
           or regexp_replace(regexp_replace(n.title || ' ' || coalesce(n.message, ''), '[0-9]+ nouveaux badges', '', 'g'),
                             'badge Top 25', '', 'g') ~ '[0-9]')), '0');
select pg_temp.verif('N6 la notification porte la route de son push',
  (select count(*)::text from athlete_notifications n
    where n.metadata ? 'push_cle' and n.metadata->>'route' is distinct from
          public.push_destination(n.metadata->>'nx_type')->>'route'), '0');

-- ── G. Regroupement dans la cloche, cas directs ─────────────────────────────
delete from push_file where statut = 'EN_ATTENTE';
select public.push_mettre_en_file(current_setting('t.felix')::uuid, 'BADGES_EVALUATIONS', 'BADGE_PARTENAIRE', 'badges:partenaire:banc-a5',
         'Média A5', '{"libelle": "Top 25"}'::jsonb);
select pg_temp.verif('G1 un badge partenaire : « Nouveau badge » / « Tu as reçu le badge Top 25 de Média A5. »',
  (select count(*) || '|' || max(title) || '|' || max(message) || '|' || bool_and(not read)
     from athlete_notifications where metadata->>'push_cle' = 'badges:partenaire:banc-a5'),
  '1|Nouveau badge|Tu as reçu le badge Top 25 de Média A5.|true');
update athlete_notifications set read = true where metadata->>'push_cle' = 'badges:partenaire:banc-a5';
select public.push_mettre_en_file(current_setting('t.felix')::uuid, 'BADGES_EVALUATIONS', 'BADGE_PARTENAIRE', 'badges:partenaire:banc-a5',
         'Média A5', '{"libelle": "Esprit sportif"}'::jsonb);
select pg_temp.verif('G2 un 2e du même groupe : la MÊME notification, réécrite et remise à non lue',
  (select count(*) || '|' || max(title) || '|' || max(message) || '|' || bool_and(not read)
     from athlete_notifications where metadata->>'push_cle' = 'badges:partenaire:banc-a5'),
  '1|2 nouveaux badges|2 nouveaux badges de Média A5.|true');
select pg_temp.verif('G3 les 2 éléments de la file pointent cette notification',
  (select count(distinct detail->>'notification_id') || '|' || count(*) from push_file where cle = 'badges:partenaire:banc-a5'), '1|2');
update push_file set statut = 'ENVOYE', traite_le = now() where cle = 'badges:partenaire:banc-a5';
select public.push_mettre_en_file(current_setting('t.felix')::uuid, 'BADGES_EVALUATIONS', 'BADGE_PARTENAIRE', 'badges:partenaire:banc-a5',
         'Média A5', '{"libelle": "Top 25"}'::jsonb);
select pg_temp.verif('G4 le groupe parti, un nouveau badge = une nouvelle notification',
  (select count(*)::text from athlete_notifications where metadata->>'push_cle' = 'badges:partenaire:banc-a5'), '2');
select public.push_mettre_en_file(current_setting('t.felix')::uuid, 'BADGES_EVALUATIONS', 'EVALUATION_COACH', 'eval:coach:banc-a5',
         null, '{"cloche": false}'::jsonb);
select pg_temp.verif('G5 « cloche: false » : aucune notification, et la clé ne reste pas dans la file',
  (select count(*) from athlete_notifications where metadata->>'push_cle' = 'eval:coach:banc-a5')
  || '|' || (select count(*) || '|' || bool_and(not (detail ? 'cloche')) from push_file where cle = 'eval:coach:banc-a5'),
  '0|1|true');
select public.push_mettre_en_file(current_setting('t.felix')::uuid, 'BADGES_EVALUATIONS', 'EVALUATION_COACH', 'eval:coach:banc-a5b',
         null, '{}'::jsonb);
select pg_temp.verif('G6 évaluation du coach (création), coach non nommable : « Ton entraîneur t''a évalué. »',
  (select type || '|' || title || '|' || message from athlete_notifications where metadata->>'push_cle' = 'eval:coach:banc-a5b'),
  'COACH_EVALUATION_UPDATED|Nouvelle évaluation|Ton entraîneur t''a évalué.');
select public.push_mettre_en_file((select id from athletes where user_id is null limit 1), 'BADGES_EVALUATIONS', 'BADGE_COACH',
         'badges:coach:banc-a5-sans-compte', 'X', '{}'::jsonb);
select pg_temp.verif('G7 fiche sans compte : ni file ni cloche',
  (select count(*) from push_file where cle = 'badges:coach:banc-a5-sans-compte')
  || '|' || (select count(*) from athlete_notifications where metadata->>'push_cle' = 'badges:coach:banc-a5-sans-compte'), '0|0');
select public.push_mettre_en_file(current_setting('t.mathis')::uuid, 'CARTES_PARTENAIRES', 'CARTE_PARTENAIRE', 'carte:banc-a5',
         'Média A5', '{"carte_id": "x", "notification_id": "00000000-0000-0000-0000-000000000000"}'::jsonb);
select pg_temp.verif('G8 carte partenaire : pas de 2e notification, detail inchangé',
  (select count(*) from athlete_notifications where metadata->>'push_cle' = 'carte:banc-a5')
  || '|' || (select detail::text from push_file where cle = 'carte:banc-a5'),
  '0|{"carte_id": "x", "notification_id": "00000000-0000-0000-0000-000000000000"}');

-- ── D. Droits de la nouvelle fonction ───────────────────────────────────────
set local role authenticated;
select pg_temp.essai('D1 push_destination fermée aux utilisateurs', current_setting('t.felix_u'),
  'select public.push_destination(''BADGE_COACH'')::text', 'ERR:42501');
select pg_temp.essai('D2 un jeune lit ses nouvelles notifications (RLS existante)', current_setting('t.felix_u'),
  'select (count(*) > 0)::text from public.athlete_notifications where type in (''PARTENAIRE_BADGE'', ''COACH_DISTINCTION_ADDED'')', 'true');
reset role;

select n, case when ok then 'OK' else 'ÉCHEC' end as res, test, detail from _res order by n;
select count(*) filter (where ok) as ok, count(*) filter (where not ok) as echecs from _res;

rollback;
