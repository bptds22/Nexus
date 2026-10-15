-- Tests W4a (20261014200739), base LOCALE. Une transaction annulée à la fin : rien ne survit.
-- Cartes prospects partenaire, lien à jeton, attente d'opt-in, rapprochements, trigger d'opt-in.
-- Comptes résolus par courriel ; chaque essai tourne sous le VRAI rôle (authenticated / anon)
-- avec un JWT simulé. Félix Gauthier et Mathis Lavoie : football, 17 ans, même équipe locale,
-- opt-in partenaire INACTIF au départ.
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
select set_config('w4.b_clutch',  (select id::text from public.badges where code = 'clutch'), true);
select set_config('w4.b_3pts',    (select id::text from public.badges where code = '3-points'), true);
select set_config('w4.b_mvp',     (select id::text from public.badges where code = 'mvp'), true);
-- Valeurs relevées EN PROD le 2026-10-14 (avant W4a) : fonctions W2/W3/W3b et triggers de athletes.
select set_config('w4.md5_w3b', '4fc94502a18e9a1d5fc0fd89829879ec', true);
select set_config('w4.nb_trig_athletes', '18', true);   -- 17 en prod + trg_prospect_partenaire_sur_optin

-- Préparation (postgres), annulée à la fin :
--  · p1 (Média Preuve) évaluateur en football, avec un badge propre ;
--  · p2 APPROUVÉ et évaluateur, mais SANS sport permis.
update public.media_partners set peut_evaluer = true where id in (current_setting('w4.mp1')::uuid, current_setting('w4.mp2')::uuid);
update public.media_partners set status = 'APPROVED' where id = current_setting('w4.mp2')::uuid;
insert into public.partenaire_sports_permis (partner_id, sport_id)
values (current_setting('w4.mp1')::uuid, current_setting('w4.foot')::uuid) on conflict do nothing;
update public.athletes set partner_visibility_opt_in = false
 where id in (current_setting('w4.felix')::uuid, current_setting('w4.mathis')::uuid);
with b as (
  insert into public.partner_badges (partner_id, libelle, icone_path, actif, ordre)
  values (current_setting('w4.mp1')::uuid, 'Esprit sportif W4', current_setting('w4.mp1') || '/w4.png', true, 0)
  returning id)
insert into _ids select 'pb', id from b;
-- Le trigger d'opt-in est compté : prouver qu'une écriture ordinaire ne l'appelle même pas.
set local track_functions = 'all';

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
-- essai_msg : le refus doit porter CE message.
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
-- Appels du trigger d'opt-in dans CETTE transaction.
create function pg_temp.appels_optin() returns int
language sql as $$
  select coalesce((select calls::int from pg_stat_xact_user_functions where funcname = 'prospect_partenaire_sur_optin'), 0)
$$;
grant execute on function pg_temp.appels_optin() to authenticated;

-- Gabarit de création : (prénom, nom, équipe, cote, traits, badges partenaire, badges Nexus).
select set_config('w4.q_creer',
  'with c as (select public.partenaire_prospect_enregistrer(null, %L, %L, %L::uuid, null, null, %L::uuid, 2027, true, %s, %L::jsonb, %L::uuid[], %L::uuid[]) as id) '
  || 'insert into _ids select %L, id from c returning ''ok''', true);
select set_config('w4.q_lien',
  'with j as (select public.partenaire_prospect_lien(%L) as t) insert into _jet select %L, t from j returning length(jeton)::text', true);
-- Statut d'une carte vu par le PARTENAIRE.
select set_config('w4.q_vu', 'select statut from public.partenaire_prospects_mes_cartes() where id = %L', true);

set local role authenticated;

-- ── A. Création et droits ──────────────────────────────────────────────────
select pg_temp.essai_msg('A1 le recruteur ne crée pas de carte', current_setting('w4.rec'),
  format(current_setting('w4.q_creer'), 'Zoé', 'Tremblay', current_setting('w4.foot'), null, 'null', '{}', '{}', '{}', 'x'),
  '42501', 'NEXUS: réservé aux partenaires');
select pg_temp.essai_msg('A2 le coach ne crée pas de carte', current_setting('w4.coach'),
  format(current_setting('w4.q_creer'), 'Zoé', 'Tremblay', current_setting('w4.foot'), null, 'null', '{}', '{}', '{}', 'x'),
  '42501', 'NEXUS: réservé aux partenaires');
select pg_temp.essai_msg('A3 p2 (sans sport permis) refusé', current_setting('w4.p2'),
  format(current_setting('w4.q_creer'), 'Zoé', 'Tremblay', current_setting('w4.foot'), null, 'null', '{}', '{}', '{}', 'x'),
  '42501', 'NEXUS: cartes prospects non permises (permission, sport ou statut du partenaire)');
select pg_temp.essai_msg('A4 attestation « 14 ans ou plus » obligatoire', current_setting('w4.p1'),
  format('select public.partenaire_prospect_enregistrer(null, ''Zoé'', ''Tremblay'', %L::uuid, null, null, null, 2027, false)::text', current_setting('w4.foot')),
  '22023', 'NEXUS: confirme que ce jeune a 14 ans ou plus');
select pg_temp.essai_msg('A5 critère inconnu refusé (règles W2)', current_setting('w4.p1'),
  format(current_setting('w4.q_creer'), 'Zoé', 'Tremblay', current_setting('w4.foot'), null, 'null', '{"charisme":4}', '{}', '{}', 'x'),
  '22023', 'NEXUS: critère inconnu : charisme');
select pg_temp.essai_msg('A6 badge de sport d''un autre sport refusé (W3b)', current_setting('w4.p1'),
  format(current_setting('w4.q_creer'), 'Zoé', 'Tremblay', current_setting('w4.foot'), null, 'null', '{}', '{}', '{' || current_setting('w4.b_3pts') || '}', 'x'),
  '22023', 'NEXUS: le badge « 3 points » ne s''applique pas au sport de cette carte');
select pg_temp.essai_msg('A7 badge honneur refusé (W3b)', current_setting('w4.p1'),
  format(current_setting('w4.q_creer'), 'Zoé', 'Tremblay', current_setting('w4.foot'), null, 'null', '{}', '{}', '{' || current_setting('w4.b_mvp') || '}', 'x'),
  '42501', 'NEXUS: le badge « MVP » ne peut pas être attribué par un partenaire');
select pg_temp.essai('A8 p1 crée la carte c1 (évaluation détaillée + 2 badges)', current_setting('w4.p1'),
  format(current_setting('w4.q_creer'), 'Zoé', 'Tremblay', current_setting('w4.foot'), null, 'null',
         '{"leadership":4,"discipline":5}', '{' || (select id from _ids where cle = 'pb') || '}', '{' || current_setting('w4.b_vitesse') || '}', 'c1'),
  'ok');
select pg_temp.essai('A9 cote calculée comme en W2 (moyenne des critères)', current_setting('w4.p1'),
  format('select cote_globale::text from public.partenaire_prospects_mes_cartes() where id = %L', (select id from _ids where cle = 'c1')), '4.50');
select pg_temp.essai('A10 table illisible en direct, même pour le partenaire', current_setting('w4.p1'),
  'select count(*)::text from public.partenaire_prospects', 'ERR:42501');
select pg_temp.essai('A11 table illisible en direct, même pour l''admin', current_setting('w4.admin'),
  'select count(*)::text from public.partenaire_prospects', 'ERR:42501');
select pg_temp.essai('A12 p1 voit sa carte', current_setting('w4.p1'), 'select count(*)::text from public.partenaire_prospects_mes_cartes()', '1');
select pg_temp.essai('A13 p2 ne voit aucune carte de p1', current_setting('w4.p2'), 'select count(*)::text from public.partenaire_prospects_mes_cartes()', '0');
select pg_temp.essai('A14 le recruteur ne voit aucune carte', current_setting('w4.rec'), 'select count(*)::text from public.partenaire_prospects_mes_cartes()', '0');
select pg_temp.essai('A15 p2 ne supprime pas la carte de p1', current_setting('w4.p2'),
  format('select public.partenaire_prospect_supprimer(%L)::text', (select id from _ids where cle = 'c1')), 'ERR:P0002');

-- ── B. Lien à jeton ────────────────────────────────────────────────────────
select pg_temp.essai('B1 lien : jeton de 64 caractères hexadécimaux', current_setting('w4.p1'),
  format(current_setting('w4.q_lien'), (select id from _ids where cle = 'c1'), 'c1a'), '64');
select pg_temp.essai('B2 p1 voit « ENVOYEE »', current_setting('w4.p1'), format(current_setting('w4.q_vu'), (select id from _ids where cle = 'c1')), 'ENVOYEE');
reset role;
select pg_temp.essai('B3 seule l''empreinte sha256 est stockée, jamais le jeton', null,
  format('select (count(*) filter (where c.jeton_empreinte = encode(extensions.digest(%L, ''sha256''), ''hex''))
                  || ''/'' || count(*) filter (where to_jsonb(c)::text like ''%%'' || %L || ''%%''))
            from public.partenaire_prospects c', (select jeton from _jet where cle = 'c1a'), (select jeton from _jet where cle = 'c1a')),
  '1/0');
set local role anon;
select pg_temp.essai('B4 sans connexion (rôle anon) : nom du partenaire SEULEMENT', null,
  format('select valide::text || ''|'' || coalesce(partenaire, '''') from public.prospect_partenaire_resoudre(%L)', (select jeton from _jet where cle = 'c1a')),
  'true|Média Preuve');
select pg_temp.essai('B5 jeton inconnu : même réponse qu''invalide', null,
  'select valide::text || ''|'' || coalesce(partenaire, '''') from public.prospect_partenaire_resoudre(''abc'')', 'false|');
select pg_temp.essai('B6 anon ne peut pas ouvrir la carte', null,
  format('select public.prospect_partenaire_ouvrir(%L)::text', (select jeton from _jet where cle = 'c1a')), 'ERR:42501');
reset role;
set local role authenticated;
select pg_temp.essai('B7 nouveau lien : l''ancien ne vaut plus rien', current_setting('w4.p1'),
  format(current_setting('w4.q_lien'), (select id from _ids where cle = 'c1'), 'c1b'), '64');
select pg_temp.essai('B8 ancien jeton refusé', null,
  format('select valide::text from public.prospect_partenaire_resoudre(%L)', (select jeton from _jet where cle = 'c1a')), 'false');
select pg_temp.essai('B9 révocation', current_setting('w4.p1'),
  format('select public.partenaire_prospect_revoquer_lien(%L)::text', (select id from _ids where cle = 'c1')), '');
select pg_temp.essai('B10 jeton révoqué refusé, carte « A_ENVOYER »', current_setting('w4.p1'),
  format('select (select valide::text from public.prospect_partenaire_resoudre(%L)) || ''|'' || (%s)',
         (select jeton from _jet where cle = 'c1b'), format(current_setting('w4.q_vu'), (select id from _ids where cle = 'c1'))),
  'false|A_ENVOYER');
select pg_temp.essai('B11 lien régénéré', current_setting('w4.p1'),
  format(current_setting('w4.q_lien'), (select id from _ids where cle = 'c1'), 'c1c'), '64');
select pg_temp.essai_msg('B12 un compte coach ne peut pas ouvrir le lien', current_setting('w4.coach'),
  format('select public.prospect_partenaire_ouvrir(%L)::text', (select jeton from _jet where cle = 'c1c')),
  '42501', 'NEXUS: ce lien s''adresse à un athlète inscrit');
select pg_temp.essai('B13 Félix ouvre le lien : il voit la carte', current_setting('w4.felix_u'),
  format('select public.prospect_partenaire_ouvrir(%L)->>''prenom''', (select jeton from _jet where cle = 'c1c')), 'Zoé');
select pg_temp.essai('B14 Félix peut rouvrir', current_setting('w4.felix_u'),
  format('select public.prospect_partenaire_ouvrir(%L)->>''statut''', (select jeton from _jet where cle = 'c1c')), 'RESERVEE');
select pg_temp.essai_msg('B15 réservé : Mathis ne peut plus l''ouvrir', current_setting('w4.mathis_u'),
  format('select public.prospect_partenaire_ouvrir(%L)::text', (select jeton from _jet where cle = 'c1c')),
  'P0002', 'NEXUS: ce lien n''est plus valide');
select pg_temp.essai('B16 réservé : la page sans connexion ne dit plus rien', null,
  format('select valide::text from public.prospect_partenaire_resoudre(%L)', (select jeton from _jet where cle = 'c1c')), 'false');
select pg_temp.essai('B17 p1 voit toujours « ENVOYEE » (statut masqué)', current_setting('w4.p1'),
  format(current_setting('w4.q_vu'), (select id from _ids where cle = 'c1')), 'ENVOYEE');
select pg_temp.essai_msg('B18 carte réservée : modification refusée, message neutre', current_setting('w4.p1'),
  format('select public.partenaire_prospect_enregistrer(%L, ''Zoé'', ''Tremblay'', %L::uuid, null, null, null, 2027, true)::text',
         (select id from _ids where cle = 'c1'), current_setting('w4.foot')),
  '42501', 'NEXUS: cette carte ne peut pas être modifiée pour l''instant');

-- ── C. « C'est moi » sans opt-in : attente, puis transfert automatique ─────
select pg_temp.essai('C1 Félix confirme sans opt-in → attente', current_setting('w4.felix_u'),
  format('select public.prospect_partenaire_confirmer(%L)->>''statut''', (select id from _ids where cle = 'c1')), 'attente_optin');
select pg_temp.essai('C2 rappel : la carte en attente figure dans ses cartes', current_setting('w4.felix_u'),
  'select (public.prospect_partenaire_mes_cartes()->0->>''statut'') || ''|'' || (public.prospect_partenaire_mes_cartes()->0->>''visibilite_partenaire_active'')',
  'CONFIRMEE_ATTENTE_OPTIN|false');
select pg_temp.essai('C3 p1 voit toujours « ENVOYEE »', current_setting('w4.p1'),
  format(current_setting('w4.q_vu'), (select id from _ids where cle = 'c1')), 'ENVOYEE');
reset role;
select pg_temp.essai('C4 rien n''est transféré tant que l''opt-in est inactif', null,
  format('select (select count(*) from public.partner_evaluations where athlete_id = %L) + (select count(*) from public.partner_athlete_badges where athlete_id = %L)', current_setting('w4.felix'), current_setting('w4.felix'))::text,
  '0');
select set_config('w4.appels_c', pg_temp.appels_optin()::text, true);
set local role authenticated;
select pg_temp.essai('C5 Félix active l''opt-in (RPC réelle, aussi celle du mobile)', current_setting('w4.felix_u'),
  'select public.set_my_partner_visibility(true, ''2026-08-v1'')->>''ok''', 'true');
reset role;
select pg_temp.essai('C6 transfert automatique : carte supprimée, évaluation 4,50, 2 badges', null,
  format($q$select (select count(*) from public.partenaire_prospects where id = %L) || '|'
                || (select cote_globale::text from public.partner_evaluations where partner_id = %L and athlete_id = %L) || '|'
                || (select count(*) from public.partner_athlete_badges where athlete_id = %L and retire_le is null)$q$,
         (select id from _ids where cle = 'c1'), current_setting('w4.mp1'), current_setting('w4.felix'), current_setting('w4.felix')),
  '0|4.50|2');
select pg_temp.essai('C7 issue RÉCLAMÉE avec l''athlète, annulable 7 jours', null,
  format('select issue || ''|'' || (athlete_id = %L)::text || ''|'' || (annulable_jusqu_au > now() + interval ''6 days'')::text from public.partenaire_prospects_issues where carte_id = %L',
         current_setting('w4.felix'), (select id from _ids where cle = 'c1')), 'RECLAMEE|true|true');
select pg_temp.essai('C8 le trigger a été appelé une fois', null,
  format('select (pg_temp.appels_optin() - %s)::text', current_setting('w4.appels_c')), '1');
set local role authenticated;
select pg_temp.essai('C9 p1 voit l''issue « RECLAMEE » et l''athlète', current_setting('w4.p1'),
  format('select issue || ''|'' || (athlete_id = %L)::text from public.partenaire_prospects_mes_issues() where carte_id = %L',
         current_setting('w4.felix'), (select id from _ids where cle = 'c1')), 'RECLAMEE|true');
select pg_temp.essai('C10 plus rien en attente pour Félix', current_setting('w4.felix_u'),
  'select jsonb_array_length(public.prospect_partenaire_mes_cartes())::text', '0');

-- ── D. Transfert immédiat (opt-in déjà actif) : règles W2/W3/W3b ───────────
reset role;
insert into public.athlete_badges (athlete_id, badge_id, attribue_par)
values (current_setting('w4.felix')::uuid, current_setting('w4.b_clutch')::uuid, current_setting('w4.coach')::uuid);
set local role authenticated;
select pg_temp.essai('D1 p1 crée c2 (cote 2, clutch + vitesse)', current_setting('w4.p1'),
  format(current_setting('w4.q_creer'), 'Léa', 'Roy', current_setting('w4.foot'), null, '2', '{}', '{}',
         '{' || current_setting('w4.b_clutch') || ',' || current_setting('w4.b_vitesse') || '}', 'c2'), 'ok');
select pg_temp.essai('D2 lien c2', current_setting('w4.p1'), format(current_setting('w4.q_lien'), (select id from _ids where cle = 'c2'), 'c2'), '64');
select pg_temp.essai('D3 Félix ouvre c2', current_setting('w4.felix_u'),
  format('select public.prospect_partenaire_ouvrir(%L)->>''prenom''', (select jeton from _jet where cle = 'c2')), 'Léa');
select pg_temp.essai('D4 confirmation : évaluation existante gardée, badges sautés avec leur raison', current_setting('w4.felix_u'),
  format($q$select r->>'statut' || '|' || (r->>'evaluation') || '|' ||
                   (select string_agg(e->>'raison', ',' order by e->>'raison') from jsonb_array_elements(r->'badges') e)
              from (select public.prospect_partenaire_confirmer(%L) r) s$q$, (select id from _ids where cle = 'c2')),
  'transferee|deja_evalue|deja_porte_coach,deja_porte_partenaire');
reset role;
select pg_temp.essai('D5 l''évaluation de p1 reste 4,50', null,
  format('select cote_globale::text from public.partner_evaluations where partner_id = %L and athlete_id = %L', current_setting('w4.mp1'), current_setting('w4.felix')), '4.50');

-- ── E. « Ce n'est pas moi » par le lien : suppression immédiate ────────────
set local role authenticated;
select pg_temp.essai('E1 p1 crée c3', current_setting('w4.p1'),
  format(current_setting('w4.q_creer'), 'Jade', 'Côté', current_setting('w4.foot'), null, 'null', '{}', '{}', '{}', 'c3'), 'ok');
select pg_temp.essai('E2 lien c3', current_setting('w4.p1'), format(current_setting('w4.q_lien'), (select id from _ids where cle = 'c3'), 'c3'), '64');
select pg_temp.essai('E3 Mathis ouvre c3', current_setting('w4.mathis_u'),
  format('select public.prospect_partenaire_ouvrir(%L)->>''prenom''', (select jeton from _jet where cle = 'c3')), 'Jade');
select pg_temp.essai('E4 Mathis : « ce n''est pas moi »', current_setting('w4.mathis_u'),
  format('select public.prospect_partenaire_infirmer(%L)::text', (select id from _ids where cle = 'c3')), '');
reset role;
select pg_temp.essai('E5 carte supprimée ; issue REFUSEE sans athlète ni nom ; journal sans athlète', null,
  format($q$select (select count(*) from public.partenaire_prospects where id = %1$L) || '|'
                || (select issue || ':' || coalesce(athlete_id::text, '∅') || ':' || coalesce(instantane::text, '∅') from public.partenaire_prospects_issues where carte_id = %1$L) || '|'
                || (select coalesce(athlete_id::text, '∅') from public.partenaire_prospects_journal where carte_id = %1$L and action = 'REFUSEE')$q$,
         (select id from _ids where cle = 'c3')),
  '0|REFUSEE:∅:∅|∅');
set local role authenticated;
select pg_temp.essai('E6 une seconde réponse est refusée', current_setting('w4.mathis_u'),
  format('select public.prospect_partenaire_infirmer(%L)::text', (select id from _ids where cle = 'c3')), 'ERR:P0002');

-- ── F. Rapprochements ──────────────────────────────────────────────────────
-- Félix a l'opt-in actif : un seul candidat MOYENNE (même équipe, nom exact) → proposition AUTO.
select pg_temp.essai('F1 p1 crée c4 « Félix Gauthier » dans l''équipe de Félix', current_setting('w4.p1'),
  format(current_setting('w4.q_creer'), 'Félix', 'Gauthier', current_setting('w4.foot'), current_setting('w4.equipe'), '3', '{}', '{}', '{}', 'c4'), 'ok');
select pg_temp.essai('F2 p1 voit « CORRESPONDANCE_POSSIBLE » (jeune déjà visible de lui)', current_setting('w4.p1'),
  format(current_setting('w4.q_vu'), (select id from _ids where cle = 'c4')), 'CORRESPONDANCE_POSSIBLE');
select pg_temp.essai('F3 p1 ne lit pas les rapprochements (table)', current_setting('w4.p1'),
  'select count(*)::text from public.partenaire_prospects_rapprochements', 'ERR:42501');
select pg_temp.essai('F4 p1 ne lit pas les rapprochements (fonction admin)', current_setting('w4.p1'),
  'select count(*)::text from public.admin_prospects_rapprochements()', 'ERR:42501');
select pg_temp.essai('F5 Félix voit la proposition', current_setting('w4.felix_u'),
  format($q$select e->>'proposition' from jsonb_array_elements(public.prospect_partenaire_mes_cartes()) e where e->>'carte_id' = %L$q$,
         (select id from _ids where cle = 'c4')), 'true');
reset role;
select pg_temp.essai('F6 notification au jeune + paire AUTO PROPOSE, décidée par le système', null,
  format($q$select (select count(*) from public.athlete_notifications where athlete_id = %1$L and type = 'PARTENAIRE_EVALUATION'
                     and metadata->>'carte_id' = %2$L and title = 'Média Preuve t''a évalué. C''est toi ?') || '|'
                || (select origine || ':' || statut || ':' || coalesce(decide_par::text, 'système') || ':' || critere
                      from public.partenaire_prospects_rapprochements where carte_id = %2$L)$q$,
         current_setting('w4.felix'), (select id from _ids where cle = 'c4')),
  '1|AUTO:PROPOSE:système:EQUIPE');
set local role authenticated;
select pg_temp.essai('F7 Félix infirme la proposition', current_setting('w4.felix_u'),
  format('select public.prospect_partenaire_infirmer(%L)::text', (select id from _ids where cle = 'c4')), '');
select pg_temp.essai('F8 la carte revient à son état d''avant (décision A)', current_setting('w4.p1'),
  format(current_setting('w4.q_vu'), (select id from _ids where cle = 'c4')), 'A_ENVOYER');
select pg_temp.essai('F9 réenregistrée, la carte n''est pas reproposée (paire INFIRME)', current_setting('w4.p1'),
  format('select public.partenaire_prospect_enregistrer(%L, ''Félix'', ''Gauthier'', %L::uuid, null, null, %L::uuid, 2027, true, 3)::text || (%s)',
         (select id from _ids where cle = 'c4'), current_setting('w4.foot'), current_setting('w4.equipe'),
         format(current_setting('w4.q_vu'), (select id from _ids where cle = 'c4'))),
  (select id::text from _ids where cle = 'c4') || 'A_ENVOYER');
-- Jeune visible qui retire son opt-in : « CORRESPONDANCE_POSSIBLE » disparaît.
select pg_temp.essai('F10 c5 « Félix Gauthier » (sans évaluation) → proposée automatiquement', current_setting('w4.p1'),
  format(current_setting('w4.q_creer'), 'Félix', 'Gauthier', current_setting('w4.foot'), current_setting('w4.equipe'), 'null', '{}', '{}', '{}', 'c5'), 'ok');
select pg_temp.essai('F11 p1 : « CORRESPONDANCE_POSSIBLE »', current_setting('w4.p1'),
  format(current_setting('w4.q_vu'), (select id from _ids where cle = 'c5')), 'CORRESPONDANCE_POSSIBLE');
select pg_temp.essai('F12 Félix retire son opt-in', current_setting('w4.felix_u'),
  'select public.set_my_partner_visibility(false, ''2026-08-v1'')->>''ok''', 'true');
select pg_temp.essai('F13 p1 ne voit plus de correspondance (jeune plus visible)', current_setting('w4.p1'),
  format(current_setting('w4.q_vu'), (select id from _ids where cle = 'c5')), 'A_ENVOYER');
select pg_temp.essai('F14 Félix confirme c5 sans opt-in → attente', current_setting('w4.felix_u'),
  format('select public.prospect_partenaire_confirmer(%L)->>''statut''', (select id from _ids where cle = 'c5')), 'attente_optin');
select pg_temp.essai('F15 Félix réactive l''opt-in → c5 transférée (rien à transférer)', current_setting('w4.felix_u'),
  'select public.set_my_partner_visibility(true, ''2026-08-v1'')->>''ok''', 'true');
reset role;
select pg_temp.essai('F16 c5 réclamée, évaluation « aucune »', null,
  format('select issue || ''|'' || (transfert->>''evaluation'') from public.partenaire_prospects_issues where carte_id = %L', (select id from _ids where cle = 'c5')),
  'RECLAMEE|aucune');
-- Mathis n'a PAS l'opt-in : admin seulement.
set local role authenticated;
select pg_temp.essai('F17 c6 « Mathis Lavoie » : pas de proposition automatique', current_setting('w4.p1'),
  format(current_setting('w4.q_creer'), 'Mathis', 'Lavoie', current_setting('w4.foot'), current_setting('w4.equipe'), '3', '{}', '{}', '{}', 'c6'), 'ok');
select pg_temp.essai('F18 p1 voit « A_ENVOYER »', current_setting('w4.p1'), format(current_setting('w4.q_vu'), (select id from _ids where cle = 'c6')), 'A_ENVOYER');
select pg_temp.essai('F19 l''admin voit le candidat MOYENNE, non visible du partenaire', current_setting('w4.admin'),
  format($q$select critere || '|' || force || '|' || visible_partenaire::text || '|' || statut
              from public.admin_prospects_rapprochements() where carte_id = %L and athlete_id = %L$q$,
         (select id from _ids where cle = 'c6'), current_setting('w4.mathis')),
  'EQUIPE|MOYENNE|false|CANDIDAT');
select pg_temp.essai('F20 p1 ne peut pas proposer', current_setting('w4.p1'),
  format('select public.admin_prospect_proposer(%L, %L)::text', (select id from _ids where cle = 'c6'), current_setting('w4.mathis')), 'ERR:42501');
select pg_temp.essai('F21 l''admin propose c6 à Mathis', current_setting('w4.admin'),
  format('select public.admin_prospect_proposer(%L, %L)::text', (select id from _ids where cle = 'c6'), current_setting('w4.mathis')), '');
select pg_temp.essai('F22 p1 voit toujours « A_ENVOYER » (proposition de l''admin masquée)', current_setting('w4.p1'),
  format(current_setting('w4.q_vu'), (select id from _ids where cle = 'c6')), 'A_ENVOYER');
select pg_temp.essai('F23 Mathis confirme sans opt-in → attente ; p1 voit « A_ENVOYER »', current_setting('w4.mathis_u'),
  format('select (public.prospect_partenaire_confirmer(%L)->>''statut'')', (select id from _ids where cle = 'c6')), 'attente_optin');
select pg_temp.essai('F24 p1 voit toujours « A_ENVOYER »', current_setting('w4.p1'),
  format(current_setting('w4.q_vu'), (select id from _ids where cle = 'c6')), 'A_ENVOYER');
select pg_temp.essai('F25 Mathis active l''opt-in → transfert', current_setting('w4.mathis_u'),
  'select public.set_my_partner_visibility(true, ''2026-08-v1'')->>''ok''', 'true');
reset role;
select pg_temp.essai('F26 c6 transférée : évaluation 3 pour Mathis ; paire CONFIRME supprimée avec la carte', null,
  format($q$select (select cote_globale::text from public.partner_evaluations where partner_id = %L and athlete_id = %L) || '|'
                || (select issue from public.partenaire_prospects_issues where carte_id = %L)$q$,
         current_setting('w4.mp1'), current_setting('w4.mathis'), (select id from _ids where cle = 'c6')),
  '3.00|RECLAMEE');
-- Ambiguïté : deux candidats MOYENNE → jamais d'automatique.
insert into public.athletes (id, first_name, last_name, sport_id, school_id, status, partner_visibility_opt_in, date_naissance)
values ('d4a00000-0000-4000-8000-0000000c9999', 'Félix', 'Gauthier', current_setting('w4.foot')::uuid,
        (select school_id from public.athletes where id = current_setting('w4.felix')::uuid), 'ACTIF', true, '2009-01-01');
insert into public.team_athletes (team_id, athlete_id) values (current_setting('w4.equipe')::uuid, 'd4a00000-0000-4000-8000-0000000c9999');
set local role authenticated;
select pg_temp.essai('F27 deux homonymes MOYENNE : pas d''automatique', current_setting('w4.p1'),
  format(current_setting('w4.q_creer'), 'Félix', 'Gauthier', current_setting('w4.foot'), current_setting('w4.equipe'), 'null', '{}', '{}', '{}', 'c7'), 'ok');
select pg_temp.essai('F28 c7 reste « A_ENVOYER » ; l''admin voit 2 candidats', current_setting('w4.admin'),
  format($q$select (select statut from public.admin_prospects_partenaires() where id = %1$L) || '|'
                || (select count(*) from public.admin_prospects_rapprochements() where carte_id = %1$L and statut = 'CANDIDAT')$q$,
         (select id from _ids where cle = 'c7')), 'A_ENVOYER|2');
select pg_temp.essai('F29 nom proche (FAIBLE) : pas d''automatique', current_setting('w4.p1'),
  format(current_setting('w4.q_creer'), 'Félix', 'Gautier', current_setting('w4.foot'), current_setting('w4.equipe'), 'null', '{}', '{}', '{}', 'c8'), 'ok');
select pg_temp.essai('F30 c8 : candidat FAIBLE, carte libre', current_setting('w4.admin'),
  format($q$select (select statut from public.admin_prospects_partenaires() where id = %1$L) || '|'
                || (select string_agg(distinct force || ':' || critere, ',') from public.admin_prospects_rapprochements() where carte_id = %1$L and athlete_id = %2$L)$q$,
         (select id from _ids where cle = 'c8'), current_setting('w4.felix')), 'A_ENVOYER|FAIBLE:EQUIPE_PROCHE');
select pg_temp.essai('F31 l''admin écarte c8 × Félix', current_setting('w4.admin'),
  format('select public.admin_prospect_ecarter(%L, %L)::text', (select id from _ids where cle = 'c8'), current_setting('w4.felix')), '');
select pg_temp.essai('F32 écartée : plus de candidat pour cette paire', current_setting('w4.admin'),
  format('select count(*)::text from public.admin_prospects_rapprochements() where carte_id = %L and athlete_id = %L and statut = ''CANDIDAT''',
         (select id from _ids where cle = 'c8'), current_setting('w4.felix')), '0');
select pg_temp.essai('F33 l''admin change d''avis et propose c8 à Félix', current_setting('w4.admin'),
  format('select public.admin_prospect_proposer(%L, %L)::text', (select id from _ids where cle = 'c8'), current_setting('w4.felix')), '');
select pg_temp.essai('F34 l''admin annule la réservation', current_setting('w4.admin'),
  format('select public.admin_prospect_annuler(%L)', (select id from _ids where cle = 'c8')), 'RESERVATION_ANNULEE');
select pg_temp.essai('F34b carte libre, paire ÉCARTÉE par l''admin (jamais reproposée automatiquement)', current_setting('w4.admin'),
  format($q$select (select statut from public.admin_prospects_partenaires() where id = %1$L) || '|' ||
                   (select statut from public.admin_prospects_rapprochements() where carte_id = %1$L and athlete_id = %2$L)$q$,
         (select id from _ids where cle = 'c8'), current_setting('w4.felix')), 'A_ENVOYER|ECARTE');
select pg_temp.essai('F35 aucune fonction ne fait réclamer à la place du jeune (l''admin ne peut pas confirmer)', current_setting('w4.admin'),
  format('select public.prospect_partenaire_confirmer(%L)::text', (select id from _ids where cle = 'c8')), 'ERR:P0002');

-- ── G. Le trigger sur athletes ne bloque rien et sort tout de suite ─────────
reset role;
select set_config('w4.appels_g', pg_temp.appels_optin()::text, true);
select set_config('w4.journal_g', (select count(*)::text from public.partenaire_prospects_journal), true);
set local role authenticated;
select pg_temp.essai('G1 le coach modifie la fiche de Félix (poids) : écriture OK', current_setting('w4.coach'),
  format('update public.athletes set poids_lbs = coalesce(poids_lbs, 150) + 1 where id = %L returning ''ok''', current_setting('w4.felix')), 'ok');
select pg_temp.essai('G2 Félix modifie sa bio (comme le web ou le mobile) : écriture OK', current_setting('w4.felix_u'),
  format('update public.athletes set bio = ''Test W4a'' where id = %L returning ''ok''', current_setting('w4.felix')), 'ok');
select pg_temp.essai('G3 Félix retire son opt-in : écriture OK', current_setting('w4.felix_u'),
  'select public.set_my_partner_visibility(false, ''2026-08-v1'')->>''ok''', 'true');
select pg_temp.essai('G4 aucune de ces trois écritures n''a appelé le trigger (WHEN)', null,
  format('select (pg_temp.appels_optin() - %s)::text', current_setting('w4.appels_g')), '0');
select pg_temp.essai('G5 opt-in SANS carte en attente : écriture OK', current_setting('w4.felix_u'),
  'select public.set_my_partner_visibility(true, ''2026-08-v1'')->>''ok''', 'true');
reset role;
select pg_temp.essai('G6 appelé une fois, sorti sans rien écrire', null,
  format('select (pg_temp.appels_optin() - %s)::text || ''|'' || ((select count(*) from public.partenaire_prospects_journal) - %s)::text',
         current_setting('w4.appels_g'), current_setting('w4.journal_g')), '1|0');

-- ── H. Admin ───────────────────────────────────────────────────────────────
set local role authenticated;
select pg_temp.essai('H1 p1 ne peut pas annuler', current_setting('w4.p1'),
  format('select public.admin_prospect_annuler(%L)', (select id from _ids where cle = 'c1')), 'ERR:42501');
reset role;
select set_config('w4.issue_c1', (select id::text from public.partenaire_prospects_issues
                                   where carte_id = (select id from _ids where cle = 'c1') and issue = 'RECLAMEE'), true);
set local role authenticated;
select pg_temp.essai('H2 l''admin annule la réclamation de c1 (moins de 7 jours)', current_setting('w4.admin'),
  format('select public.admin_prospect_annuler(%L)', current_setting('w4.issue_c1')), 'RECLAMATION_ANNULEE');
reset role;
select pg_temp.essai('H3 transfert défait : évaluation retirée (tracée), 2 badges retirés, carte restaurée sans lien', null,
  format($q$select (select count(*) from public.partner_evaluations where partner_id = %1$L and athlete_id = %2$L) || '|'
                || (select count(*) from public.partner_evaluation_retraits where partner_id = %1$L and athlete_id = %2$L) || '|'
                || (select count(*) from public.partner_athlete_badges where athlete_id = %2$L and partner_id = %1$L and retire_le is not null) || '|'
                || (select statut || ':' || coalesce(jeton_empreinte, '∅') || ':' || coalesce(reservee_par::text, '∅') from public.partenaire_prospects where id = %3$L)$q$,
         current_setting('w4.mp1'), current_setting('w4.felix'), (select id from _ids where cle = 'c1')),
  '0|1|2|A_ENVOYER:∅:∅');
set local role authenticated;
select pg_temp.essai('H4 une seconde annulation est refusée', current_setting('w4.admin'),
  format('select public.admin_prospect_annuler(%L)', current_setting('w4.issue_c1')), 'ERR:22023');
reset role;
update public.partenaire_prospects_issues set annulable_jusqu_au = now() - interval '1 second'
 where carte_id = (select id from _ids where cle = 'c6');
set local role authenticated;
select pg_temp.essai('H5 après 7 jours : annulation refusée', current_setting('w4.admin'),
  format('select public.admin_prospect_annuler((select id from public.admin_prospects_partenaires() where carte_id = %L limit 1))', (select id from _ids where cle = 'c6')),
  'ERR:22023');
select pg_temp.essai('H6 l''admin supprime c1', current_setting('w4.admin'),
  format('select public.admin_prospect_supprimer(%L)::text', (select id from _ids where cle = 'c1')), '');
select pg_temp.essai('H7 issue SUPPRIMEE_ADMIN', current_setting('w4.admin'),
  format('select string_agg(statut, '','' order by statut) from public.admin_prospects_partenaires() where carte_id = %L', (select id from _ids where cle = 'c1')),
  'RECLAMATION_ANNULEE,SUPPRIMEE_ADMIN');

-- ── I. Plafond de 50 cartes actives ────────────────────────────────────────
select pg_temp.essai('I1 p1 complète jusqu''à 50 cartes', current_setting('w4.p1'),
  format($q$select case when count(public.partenaire_prospect_enregistrer(null, 'Plafond', 'N' || g, %L::uuid, null, null, null, 2027, true)) >= 0 then 'ok' end
              from generate_series(1, 50 - (select count(*) from public.partenaire_prospects_mes_cartes())::int) g$q$, current_setting('w4.foot')),
  'ok');
select pg_temp.essai('I1b p1 a 50 cartes actives', current_setting('w4.p1'),
  'select count(*)::text from public.partenaire_prospects_mes_cartes()', '50');
select pg_temp.essai_msg('I2 la 51e est refusée', current_setting('w4.p1'),
  format('select public.partenaire_prospect_enregistrer(null, ''Plafond'', ''X'', %L::uuid, null, null, null, 2027, true)::text', current_setting('w4.foot')),
  '54000', 'NEXUS: limite de 50 cartes prospects actives atteinte');

-- ── J. Expiration et purge ─────────────────────────────────────────────────
select pg_temp.essai('J1 lien c4', current_setting('w4.p1'), format(current_setting('w4.q_lien'), (select id from _ids where cle = 'c4'), 'c4'), '64');
reset role;
update public.partenaire_prospects set expire_le = now() - interval '1 second' where id = (select id from _ids where cle = 'c4');
set local role authenticated;
select pg_temp.essai('J2 carte expirée : lien refusé', current_setting('w4.felix_u'),
  format('select public.prospect_partenaire_ouvrir(%L)::text', (select jeton from _jet where cle = 'c4')), 'ERR:P0002');
reset role;
select pg_temp.essai('J3 purge : une carte expirée', null, 'select public.purger_prospects_partenaire()::text', '1');
select pg_temp.essai('J4 issue EXPIREE ; instantané de plus de 7 jours effacé', null,
  format($q$select (select count(*) from public.partenaire_prospects where id = %1$L) || '|'
                || (select issue from public.partenaire_prospects_issues where carte_id = %1$L) || '|'
                || (select coalesce(instantane::text, '∅') from public.partenaire_prospects_issues where carte_id = %2$L)$q$,
         (select id from _ids where cle = 'c4'), (select id from _ids where cle = 'c6')),
  '0|EXPIREE|∅');

-- ── K. Export Loi 25 ───────────────────────────────────────────────────────
set local role authenticated;
select pg_temp.essai('K1 export du partenaire : aucun rapprochement, aucun athlète, aucun détail', current_setting('w4.admin'),
  format($q$select count(*) filter (where action like 'PROPOSITION%%' or action in ('RESERVATION_ANNULEE', 'CONFIRMEE_ATTENTE_OPTIN', 'RESERVEE'))
                || '|' || count(*) filter (where athlete_id is not null)
                || '|' || count(*) filter (where source = 'partenaire_prospects_journal' and details <> '{}'::jsonb)
                || '|' || (count(*) filter (where action = 'CREEE') > 0)::text
              from public.admin_loi25_prospects_partenaires(%L)$q$, current_setting('w4.p1')),
  '0|0|0|true');
select pg_temp.essai('K2 export du partenaire : cartes actives sans jeton ni réservation', current_setting('w4.admin'),
  format($q$select count(*) filter (where details ? 'jeton_empreinte' or details ? 'reservee_par' or details ? 'statut_avant')::text
              from public.admin_loi25_prospects_partenaires(%L) where action = 'CARTE_ACTIVE'$q$, current_setting('w4.p1')),
  '0');
select pg_temp.essai('K3 export de Félix : sa réclamation et les propositions qui le visent', current_setting('w4.admin'),
  format($q$select (count(*) filter (where action = 'RECLAMEE') > 0)::text || '|' || (count(*) filter (where action = 'PROPOSITION_AUTO') > 0)::text
              from public.admin_loi25_prospects_partenaires(%L)$q$, current_setting('w4.felix_u')),
  'true|true');
select pg_temp.essai('K4 export réservé à l''admin', current_setting('w4.p1'),
  'select count(*)::text from public.admin_loi25_prospects_partenaires(null)', 'ERR:42501');

-- ── N. Relecture BP, point 1 : une proposition ne change RIEN pour le partenaire ──
-- Règle : aucune action du partenaire ne réussit, n'échoue ni ne se comporte autrement selon
-- qu'une proposition est en cours. Modifier lève la proposition sans bruit (paire CADUC,
-- notification caduque) ; lien et révocation s'appliquent à l'état qu'il voit.
reset role;
delete from public.partenaire_prospects where prenom = 'Plafond';   -- place sous le plafond
select set_config('w4.q_modif',
  'select public.partenaire_prospect_enregistrer(%L, ''Mathis'', ''Lavoie'', %L::uuid, null, null, %L::uuid, 2027, true, 3)::text || ''|'' || (%s)', true);
-- Notifications d'une carte : total:caduques.
select set_config('w4.q_notif',
  $q$select count(*) || ':' || count(*) filter (where (metadata->>'caduque')::boolean and read)
       from public.athlete_notifications where type = 'PARTENAIRE_EVALUATION' and metadata->>'carte_id' = %L$q$, true);
set local role authenticated;
select pg_temp.essai('N1 Mathis retire son opt-in (pas d''automatique)', current_setting('w4.mathis_u'),
  'select public.set_my_partner_visibility(false, ''2026-08-v1'')->>''ok''', 'true');
select pg_temp.essai('N2 p1 crée c10 « Mathis Lavoie »', current_setting('w4.p1'),
  format(current_setting('w4.q_creer'), 'Mathis', 'Lavoie', current_setting('w4.foot'), current_setting('w4.equipe'), '3', '{}', '{}', '{}', 'c10'), 'ok');
select pg_temp.essai('N3 l''admin propose c10 à Mathis', current_setting('w4.admin'),
  format('select public.admin_prospect_proposer(%L, %L)::text', (select id from _ids where cle = 'c10'), current_setting('w4.mathis')), '');
select pg_temp.essai('N4 p1 voit « A_ENVOYER »', current_setting('w4.p1'), format(current_setting('w4.q_vu'), (select id from _ids where cle = 'c10')), 'A_ENVOYER');
select pg_temp.essai('N5 proposition en cours : p1 crée un lien comme sur une carte libre', current_setting('w4.p1'),
  format(current_setting('w4.q_lien'), (select id from _ids where cle = 'c10'), 'c10a'), '64');
select pg_temp.essai('N6 p1 voit « ENVOYEE »', current_setting('w4.p1'), format(current_setting('w4.q_vu'), (select id from _ids where cle = 'c10')), 'ENVOYEE');
reset role;
select pg_temp.essai('N7 la proposition, elle, est toujours en cours', null,
  format('select statut || ''|'' || reservation_source || ''|'' || statut_avant from public.partenaire_prospects where id = %L', (select id from _ids where cle = 'c10')),
  'RESERVEE|ADMIN|ENVOYEE');
set local role authenticated;
select pg_temp.essai('N8 p1 révoque comme sur une carte libre', current_setting('w4.p1'),
  format('select public.partenaire_prospect_revoquer_lien(%L)::text', (select id from _ids where cle = 'c10')), '');
select pg_temp.essai('N8b p1 voit « A_ENVOYER »', current_setting('w4.p1'), format(current_setting('w4.q_vu'), (select id from _ids where cle = 'c10')), 'A_ENVOYER');
select pg_temp.essai('N9 nouveau lien', current_setting('w4.p1'), format(current_setting('w4.q_lien'), (select id from _ids where cle = 'c10'), 'c10b'), '64');
select pg_temp.essai('N10 p1 modifie c10 : réussit, comme sur une carte libre', current_setting('w4.p1'),
  format(current_setting('w4.q_modif'), (select id from _ids where cle = 'c10'), current_setting('w4.foot'), current_setting('w4.equipe'),
         format(current_setting('w4.q_vu'), (select id from _ids where cle = 'c10'))),
  (select id::text from _ids where cle = 'c10') || '|ENVOYEE');
reset role;
select pg_temp.essai('N11 proposition levée sans bruit : carte libre avec son lien, paire CADUC, notification caduque', null,
  format($q$select (select statut || ':' || coalesce(reservee_par::text, '∅') || ':' || (jeton_empreinte is not null)::text from public.partenaire_prospects where id = %1$L) || '|'
                || (select statut from public.partenaire_prospects_rapprochements where carte_id = %1$L) || '|' || (%2$s)$q$,
         (select id from _ids where cle = 'c10'), format(current_setting('w4.q_notif'), (select id from _ids where cle = 'c10'))),
  'ENVOYEE:∅:true|CADUC|1:1');
set local role authenticated;
select pg_temp.essai('N12 Mathis ne voit plus la carte', current_setting('w4.mathis_u'),
  format($q$select count(*)::text from jsonb_array_elements(public.prospect_partenaire_mes_cartes()) e where e->>'carte_id' = %L$q$,
         (select id from _ids where cle = 'c10')), '0');
select pg_temp.essai('N13 l''admin revoit la paire comme candidate (CADUC se recalcule)', current_setting('w4.admin'),
  format('select string_agg(statut, '','' order by statut) from public.admin_prospects_rapprochements() where carte_id = %L and athlete_id = %L',
         (select id from _ids where cle = 'c10'), current_setting('w4.mathis')), 'CADUC,CANDIDAT');
-- Proposition CONFIRMÉE (attente d'opt-in) : même règle.
select pg_temp.essai('N14 p1 crée c13 « Mathis Lavoie »', current_setting('w4.p1'),
  format(current_setting('w4.q_creer'), 'Mathis', 'Lavoie', current_setting('w4.foot'), current_setting('w4.equipe'), '3', '{}', '{}', '{}', 'c13'), 'ok');
select pg_temp.essai('N15 l''admin propose c13, Mathis confirme sans opt-in → attente', current_setting('w4.admin'),
  format('select public.admin_prospect_proposer(%L, %L)::text', (select id from _ids where cle = 'c13'), current_setting('w4.mathis')), '');
select pg_temp.essai('N16 Mathis confirme → attente', current_setting('w4.mathis_u'),
  format('select public.prospect_partenaire_confirmer(%L)->>''statut''', (select id from _ids where cle = 'c13')), 'attente_optin');
select pg_temp.essai('N17 proposition confirmée : p1 crée un lien comme sur une carte libre', current_setting('w4.p1'),
  format(current_setting('w4.q_lien'), (select id from _ids where cle = 'c13'), 'c13'), '64');
select pg_temp.essai('N18 p1 voit « ENVOYEE »', current_setting('w4.p1'), format(current_setting('w4.q_vu'), (select id from _ids where cle = 'c13')), 'ENVOYEE');
-- Point 2, cas bloqué : une proposition CONFIRMÉE garde la carte, le lien est refusé.
select pg_temp.essai_msg('O1 proposition confirmée : Félix ne peut pas ouvrir le lien', current_setting('w4.felix_u'),
  format('select public.prospect_partenaire_ouvrir(%L)::text', (select jeton from _jet where cle = 'c13')),
  'P0002', 'NEXUS: ce lien n''est plus valide');
reset role;
set local role anon;
select pg_temp.essai('O2 proposition confirmée : page sans connexion « invalide »', null,
  format('select valide::text from public.prospect_partenaire_resoudre(%L)', (select jeton from _jet where cle = 'c13')), 'false');
reset role;
set local role authenticated;
select pg_temp.essai('N19 p1 modifie c13 : réussit', current_setting('w4.p1'),
  format(current_setting('w4.q_modif'), (select id from _ids where cle = 'c13'), current_setting('w4.foot'), current_setting('w4.equipe'),
         format(current_setting('w4.q_vu'), (select id from _ids where cle = 'c13'))),
  (select id::text from _ids where cle = 'c13') || '|ENVOYEE');
reset role;
select pg_temp.essai('N20 confirmation levée : carte libre, paire CADUC, notification caduque', null,
  format($q$select (select statut || ':' || coalesce(reservee_par::text, '∅') from public.partenaire_prospects where id = %1$L) || '|'
                || (select statut from public.partenaire_prospects_rapprochements where carte_id = %1$L) || '|' || (%2$s)$q$,
         (select id from _ids where cle = 'c13'), format(current_setting('w4.q_notif'), (select id from _ids where cle = 'c13'))),
  'ENVOYEE:∅|CADUC|1:1');
set local role authenticated;
select pg_temp.essai('N21 Mathis n''a plus rien en attente', current_setting('w4.mathis_u'),
  'select jsonb_array_length(public.prospect_partenaire_mes_cartes())::text', '0');
-- Retrait pendant une proposition.
select pg_temp.essai('N22 p1 crée c14 « Mathis Lavoie »', current_setting('w4.p1'),
  format(current_setting('w4.q_creer'), 'Mathis', 'Lavoie', current_setting('w4.foot'), current_setting('w4.equipe'), 'null', '{}', '{}', '{}', 'c14'), 'ok');
select pg_temp.essai('N23 l''admin propose c14', current_setting('w4.admin'),
  format('select public.admin_prospect_proposer(%L, %L)::text', (select id from _ids where cle = 'c14'), current_setting('w4.mathis')), '');
select pg_temp.essai('N24 p1 retire c14 : réussit', current_setting('w4.p1'),
  format('select public.partenaire_prospect_supprimer(%L)::text', (select id from _ids where cle = 'c14')), '');
reset role;
select pg_temp.essai('N25 issue RETIREE, notification caduque', null,
  format('select (select issue from public.partenaire_prospects_issues where carte_id = %1$L) || ''|'' || (%2$s)',
         (select id from _ids where cle = 'c14'), format(current_setting('w4.q_notif'), (select id from _ids where cle = 'c14'))),
  'RETIREE|1:1');
set local role authenticated;
select pg_temp.essai('N26 export Loi 25 du partenaire : rien de ces propositions', current_setting('w4.admin'),
  format($q$select count(*) filter (where action like 'PROPOSITION%%' or action like 'RESERVATION%%' or athlete_id is not null)::text
              from public.admin_loi25_prospects_partenaires(%L)$q$, current_setting('w4.p1')), '0');

-- ── O. Relecture BP, point 2 : le lien reste utilisable pendant une proposition ──
select pg_temp.essai('O3 Mathis réactive l''opt-in → c10 et c13 (paires CADUC) lui sont reproposées', current_setting('w4.mathis_u'),
  'select public.set_my_partner_visibility(true, ''2026-08-v1'')->>''ok''', 'true');
reset role;
select pg_temp.essai('O4 c10 proposée AUTO à Mathis ; 2 notifications dont 1 caduque', null,
  format('select (select statut || '':'' || reservation_source from public.partenaire_prospects where id = %1$L) || ''|'' || (%2$s)',
         (select id from _ids where cle = 'c10'), format(current_setting('w4.q_notif'), (select id from _ids where cle = 'c10'))),
  'RESERVEE:AUTO|2:1');
set local role anon;
select pg_temp.essai('O5 proposition non confirmée : le lien reste valide sans connexion', null,
  format('select valide::text || ''|'' || coalesce(partenaire, '''') from public.prospect_partenaire_resoudre(%L)', (select jeton from _jet where cle = 'c10b')),
  'true|Média Preuve');
reset role;
set local role authenticated;
select pg_temp.essai('O6 Félix ouvre le lien : il voit la carte', current_setting('w4.felix_u'),
  format('select public.prospect_partenaire_ouvrir(%L)->>''prenom''', (select jeton from _jet where cle = 'c10b')), 'Mathis');
reset role;
select pg_temp.essai('O7 la réservation par le lien prend le dessus : paire CADUC, notifications caduques', null,
  format($q$select (select statut || ':' || reservation_source || ':' || (reservee_par = %3$L)::text || ':' || coalesce(statut_avant, '∅')
                      from public.partenaire_prospects where id = %1$L) || '|'
                || (select statut from public.partenaire_prospects_rapprochements where carte_id = %1$L) || '|' || (%2$s)$q$,
         (select id from _ids where cle = 'c10'), format(current_setting('w4.q_notif'), (select id from _ids where cle = 'c10')), current_setting('w4.felix_u')),
  'RESERVEE:LIEN:true:∅|CADUC|2:2');
set local role authenticated;
select pg_temp.essai('O8 Mathis ne voit plus c10', current_setting('w4.mathis_u'),
  format($q$select count(*)::text from jsonb_array_elements(public.prospect_partenaire_mes_cartes()) e where e->>'carte_id' = %L$q$,
         (select id from _ids where cle = 'c10')), '0');
select pg_temp.essai('O9 Félix la voit, comme réservée par le lien', current_setting('w4.felix_u'),
  format($q$select e->>'proposition' from jsonb_array_elements(public.prospect_partenaire_mes_cartes()) e where e->>'carte_id' = %L$q$,
         (select id from _ids where cle = 'c10')), 'false');
select pg_temp.essai('O10 p1 voit « ENVOYEE »', current_setting('w4.p1'), format(current_setting('w4.q_vu'), (select id from _ids where cle = 'c10')), 'ENVOYEE');

-- ── P. Relecture BP, point 3 : le sport de la CARTE doit être celui de l'athlète ──
reset role;
select set_config('w4.basket', (select id::text from public.sports where nom = 'Basketball'), true);
insert into public.partenaire_sports_permis (partner_id, sport_id)
values (current_setting('w4.mp1')::uuid, current_setting('w4.basket')::uuid) on conflict do nothing;
select pg_temp.essai('P1 sport_concorde : basketball/Félix, basketball/Mathis (avant équipe), football/Mathis', null,
  format('select public.prospect_partenaire_sport_concorde(%1$L, %2$L)::text || ''|'' || public.prospect_partenaire_sport_concorde(%1$L, %3$L)::text || ''|'' || public.prospect_partenaire_sport_concorde(%4$L, %3$L)::text',
         current_setting('w4.basket'), current_setting('w4.felix'), current_setting('w4.mathis'), current_setting('w4.foot')),
  'false|false|true');
set local role authenticated;
select pg_temp.essai('P2 p1 crée c15 en basketball (badge propre + « 3 points »)', current_setting('w4.p1'),
  format(current_setting('w4.q_creer'), 'Zack', 'Panier', current_setting('w4.basket'), null, '4', '{}',
         '{' || (select id from _ids where cle = 'pb') || '}', '{' || current_setting('w4.b_3pts') || '}', 'c15'), 'ok');
select pg_temp.essai('P3 lien c15', current_setting('w4.p1'), format(current_setting('w4.q_lien'), (select id from _ids where cle = 'c15'), 'c15'), '64');
select pg_temp.essai('P4 Mathis (football, aucune équipe de basketball) ouvre c15', current_setting('w4.mathis_u'),
  format('select public.prospect_partenaire_ouvrir(%L)->>''prenom''', (select jeton from _jet where cle = 'c15')), 'Zack');
select pg_temp.essai('P5 confirmation : rien ne passe, raison « autre_sport »', current_setting('w4.mathis_u'),
  format($q$select r->>'statut' || '|' || (r->>'evaluation') || '|' ||
                   (select string_agg(e->>'raison', ',' order by e->>'raison') from jsonb_array_elements(r->'badges') e)
              from (select public.prospect_partenaire_confirmer(%L) r) s$q$, (select id from _ids where cle = 'c15')),
  'transferee|autre_sport|autre_sport,autre_sport');
reset role;
select pg_temp.essai('P6 aucune écriture : évaluation de Mathis inchangée (3,00), aucun badge', null,
  format('select (select cote_globale::text from public.partner_evaluations where partner_id = %1$L and athlete_id = %2$L) || ''|'' || (select count(*) from public.partner_athlete_badges where athlete_id = %2$L)',
         current_setting('w4.mp1'), current_setting('w4.mathis')), '3.00|0');
set local role authenticated;
select set_config('w4.q_ecole',
  $q$with c as (select public.partenaire_prospect_enregistrer(null, 'Mathis', 'Lavoie', %L::uuid, null, %L::uuid, null, 2027, true) as id)
     insert into _ids select %L, id from c returning 'ok'$q$, true);
select pg_temp.essai('P7 c18 « Mathis Lavoie » basketball à son école', current_setting('w4.p1'),
  format(current_setting('w4.q_ecole'), current_setting('w4.basket'),
         (select school_id::text from public.athletes where id = current_setting('w4.mathis')::uuid), 'c18'), 'ok');
select pg_temp.essai('P7b c18 : pas de candidat (aucune équipe de basketball), pas d''automatique', current_setting('w4.p1'),
  format(current_setting('w4.q_vu'), (select id from _ids where cle = 'c18')), 'A_ENVOYER');
reset role;
-- Mathis passe dans une équipe de basketball de son école (une seule équipe par athlète) ;
-- son sport principal reste le football.
with t as (
  insert into public.teams (school_id, sport_id, name)
  values ((select school_id from public.athletes where id = current_setting('w4.mathis')::uuid), current_setting('w4.basket')::uuid, 'Basket W4')
  returning id)
update public.team_athletes ta set team_id = t.id, sport_id = current_setting('w4.basket')::uuid
  from t where ta.athlete_id = current_setting('w4.mathis')::uuid;
select pg_temp.essai('P8 sport_concorde basketball/Mathis vrai par son équipe ; football vrai par son sport principal', null,
  format('select public.prospect_partenaire_sport_concorde(%L, %3$L)::text || ''|'' || public.prospect_partenaire_sport_concorde(%2$L, %3$L)::text', current_setting('w4.basket'), current_setting('w4.foot'), current_setting('w4.mathis')), 'true|true');
set local role authenticated;
select pg_temp.essai('P9 c16 basketball : lien, Mathis ouvre', current_setting('w4.p1'),
  format(current_setting('w4.q_creer'), 'Yan', 'Panier', current_setting('w4.basket'), null, '5', '{}',
         '{' || (select id from _ids where cle = 'pb') || '}', '{}', 'c16'), 'ok');
select pg_temp.essai('P10 lien c16', current_setting('w4.p1'), format(current_setting('w4.q_lien'), (select id from _ids where cle = 'c16'), 'c16'), '64');
select pg_temp.essai('P11 Mathis ouvre c16', current_setting('w4.mathis_u'),
  format('select public.prospect_partenaire_ouvrir(%L)->>''prenom''', (select jeton from _jet where cle = 'c16')), 'Yan');
select pg_temp.essai('P11b sport d''une de ses équipes : ça passe (évaluation existante gardée, badge transféré)', current_setting('w4.mathis_u'),
  format($q$select r->>'evaluation' || '|' ||
                   (select string_agg(coalesce(e->>'raison', 'transfere'), ',') from jsonb_array_elements(r->'badges') e)
              from (select public.prospect_partenaire_confirmer(%L) r) s$q$, (select id from _ids where cle = 'c16')),
  'deja_evalue|transfere');
select pg_temp.essai('P12 c17 « Mathis Lavoie » basketball à son école', current_setting('w4.p1'),
  format(current_setting('w4.q_ecole'), current_setting('w4.basket'),
         (select school_id::text from public.athletes where id = current_setting('w4.mathis')::uuid), 'c17'), 'ok');
select pg_temp.essai('P12b sport de son équipe : c17 proposée automatiquement', current_setting('w4.p1'),
  format(current_setting('w4.q_vu'), (select id from _ids where cle = 'c17')), 'CORRESPONDANCE_POSSIBLE');

-- ── L. Non-régression et droits ────────────────────────────────────────────
select pg_temp.essai('L1 badge_plafond et M10 inchangés (md5)', null,
  $q$select md5(pg_get_functiondef('public.badge_plafond()'::regprocedure)) || ' ' || md5(pg_get_functiondef('public.ambassadeur_recalculer_paliers()'::regprocedure))$q$,
  '171a82c74237a5a6d9c5f50c74f44d5e 481cf443a2db040fd840a1e229b325f2');
select pg_temp.essai('L2 fonctions W2/W3/W3b intactes (md5 sans CR)', null,
  $q$select md5(string_agg(md5(replace(pg_get_functiondef(p.oid), E'\r', '')), ',' order by p.proname))
       from pg_proc p where p.pronamespace = 'public'::regnamespace
        and p.proname in ('partenaire_evaluer_athlete', 'partenaire_attribuer_badge', 'partenaire_attribuer_badge_nexus',
                          'partenaire_peut_evaluer', 'is_partner_eligible_athlete', 'set_my_partner_visibility',
                          'badge_refuser_doublon_partenaire')$q$,
  current_setting('w4.md5_w3b'));
select pg_temp.essai('L3 triggers de athletes : ceux d''avant + le seul trigger d''opt-in', null,
  $q$select count(*)::text || '|' || string_agg(tgname, ',') filter (where tgname like '%prospect%')
       from pg_trigger where tgrelid = 'public.athletes'::regclass and not tgisinternal$q$,
  current_setting('w4.nb_trig_athletes') || '|trg_prospect_partenaire_sur_optin');
select pg_temp.essai('L4 ACL complètes : page du lien (anon autorisé)', null,
  $q$select array_agg(t.g order by t.g)::text from pg_proc pr,
       lateral (select coalesce(nullif(split_part(x,'=',1),''),'PUBLIC') as g from unnest(pr.proacl::text[]) as x) t
     where pr.oid = 'public.prospect_partenaire_resoudre(text)'::regprocedure$q$, '{anon,authenticated,postgres,service_role}');
select pg_temp.essai('L5 ACL complètes : transfert, trigger et aides serveur seulement', null,
  $q$select string_agg(distinct acl, ' | ') from (select array_agg(t.g order by t.g)::text acl from pg_proc pr,
       lateral (select coalesce(nullif(split_part(x,'=',1),''),'PUBLIC') as g from unnest(pr.proacl::text[]) as x) t
     where pr.proname in ('prospect_partenaire_transferer', 'prospect_partenaire_sur_optin', 'prospect_partenaire_proposer',
                          'prospect_partenaire_candidats', 'prospect_partenaire_peut_transferer',
                          'prospect_partenaire_sport_concorde', 'prospect_partenaire_lever_proposition') group by pr.oid) s$q$,
  '{postgres,service_role}');
reset role;
set local role anon;
select pg_temp.essai('L6 anon (rôle réel) n''appelle aucune fonction partenaire ni admin', null,
  'select count(*)::text from public.partenaire_prospects_mes_cartes()', 'ERR:42501');
reset role;

-- ── M. Le trigger ne bloque JAMAIS l'opt-in, même si le transfert échoue ───
-- (en dernier : on remplace le transfert par une version qui échoue, dans CETTE transaction annulée)
set local role authenticated;
select pg_temp.essai('M1 Félix retire son opt-in', current_setting('w4.felix_u'),
  'select public.set_my_partner_visibility(false, ''2026-08-v1'')->>''ok''', 'true');
select pg_temp.essai('M2 c9 : lien, ouverture, confirmation → attente', current_setting('w4.p1'),
  format(current_setting('w4.q_creer'), 'Noé', 'Martin', current_setting('w4.foot'), null, '4', '{}', '{}', '{}', 'c9'), 'ok');
select pg_temp.essai('M3 lien c9', current_setting('w4.p1'), format(current_setting('w4.q_lien'), (select id from _ids where cle = 'c9'), 'c9'), '64');
select pg_temp.essai('M4 Félix ouvre et confirme c9', current_setting('w4.felix_u'),
  format('select (public.prospect_partenaire_ouvrir(%L)->>''prenom'') || ''|'' || (public.prospect_partenaire_confirmer(%L)->>''statut'')',
         (select jeton from _jet where cle = 'c9'), (select id from _ids where cle = 'c9')), 'Noé|attente_optin');
reset role;
create or replace function public.prospect_partenaire_transferer(p_carte uuid, p_athlete uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
begin raise exception 'panne simulée'; end $$;
set local role authenticated;
select pg_temp.essai('M5 transfert en panne : l''opt-in est QUAND MÊME enregistré', current_setting('w4.felix_u'),
  'select public.set_my_partner_visibility(true, ''2026-08-v1'')->>''ok''', 'true');
reset role;
select pg_temp.essai('M6 opt-in actif, carte toujours en attente, échec journalisé', null,
  format($q$select (select partner_visibility_opt_in::text from public.athletes where id = %L) || '|'
                || (select statut from public.partenaire_prospects where id = %L) || '|'
                || (select count(*) from public.partenaire_prospects_journal where carte_id = %L and action = 'TRANSFERT_ECHEC')$q$,
         current_setting('w4.felix'), (select id from _ids where cle = 'c9'), (select id from _ids where cle = 'c9')),
  'true|CONFIRMEE_ATTENTE_OPTIN|1');

select n, case when ok then 'OK' else 'ÉCHEC' end as res, test, detail from _res order by n;
select count(*) filter (where ok) as ok, count(*) filter (where not ok) as echecs from _res;

rollback;
