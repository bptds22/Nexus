-- Banc « intérêt recruteur » (20261029170000 + texte d'ajout 20261029210000), pile dédiée NexusNotif (:56322), base où la
-- migration EST appliquée. Une transaction ANNULÉE à la fin : rien ne survit.
-- Ce qui partirait est lu dans la file de pg_net (faux secrets posés dans le Vault DANS la
-- transaction, jamais validée → rien ne part). Gestes des recruteurs sous le VRAI rôle avec un
-- JWT simulé quand la RLS le permet (favori) ; sinon en postgres (les déclencheurs sont les mêmes).
--   psql "host=127.0.0.1 port=56322 dbname=postgres user=postgres password=postgres" \
--        -X -q -At -f docs/notif-interet/tests-notif-interet.sql
-- Fixtures : docs/notif-interet/fixtures-pile-dediee.sql.
\set ON_ERROR_STOP 1
\pset footer off
begin;

create temp table _res (n serial, test text, ok boolean, detail text) on commit drop;
grant all on _res to authenticated, anon, service_role;
grant usage on sequence _res_n_seq to authenticated, anon, service_role;

create function pg_temp.verif(p_test text, p_obtenu text, p_attendu text) returns void language sql as $$
  insert into _res (test, ok, detail) values (p_test, p_obtenu is not distinct from p_attendu,
    coalesce(p_obtenu, 'NULL') || ' (attendu ' || coalesce(p_attendu, 'NULL') || ')')
$$;
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

-- ── Comptes (fixtures synthétiques) ─────────────────────────────────────────
select set_config('t.zoe',    'b0000000-0000-4000-8000-000000000407', true);
select set_config('t.zoe_u',  'b0000000-0000-4000-8000-000000000207', true);
select set_config('t.felix',  'b0000000-0000-4000-8000-000000000401', true);
select set_config('t.felix_u','b0000000-0000-4000-8000-000000000201', true);
select set_config('t.mathis', 'b0000000-0000-4000-8000-000000000402', true);
select set_config('t.mathis_u','b0000000-0000-4000-8000-000000000202', true);
select set_config('t.lea',    'b0000000-0000-4000-8000-000000000405', true);
select set_config('t.lea_u',  'b0000000-0000-4000-8000-000000000205', true);
select set_config('t.tom',    'b0000000-0000-4000-8000-000000000404', true);
select set_config('t.tom_u',  'b0000000-0000-4000-8000-000000000204', true);
select set_config('t.sans',   'b0000000-0000-4000-8000-000000000499', true);
select set_config('t.marc',   'b0000000-0000-4000-8000-000000000101', true);
select set_config('t.r1', 'b0000000-0000-4000-8000-000000000301', true);   -- Cégep du Banc, actif
select set_config('t.r2', 'b0000000-0000-4000-8000-000000000302', true);   -- Cégep du Banc 2, actif
select set_config('t.r3', 'b0000000-0000-4000-8000-000000000303', true);   -- DÉSACTIVÉ
select set_config('t.r4', 'b0000000-0000-4000-8000-000000000304', true);   -- collègue de r1 (même unité)
select set_config('t.r5', 'b0000000-0000-4000-8000-000000000305', true);   -- « équipe », sans établissement
select set_config('t.foot', (select id::text from sports where nom = 'Football'), true);

-- Moments (heure du Québec) : jour J = demain.
select set_config('t.j_1000', ((date_trunc('day', now() at time zone 'America/Toronto') + interval '1 day 10 hours') at time zone 'America/Toronto')::text, true);
select set_config('t.j_1005', ((date_trunc('day', now() at time zone 'America/Toronto') + interval '1 day 10 hours 5 minutes') at time zone 'America/Toronto')::text, true);
select set_config('t.j_1020', ((date_trunc('day', now() at time zone 'America/Toronto') + interval '1 day 10 hours 20 minutes') at time zone 'America/Toronto')::text, true);
select set_config('t.j_1100', ((date_trunc('day', now() at time zone 'America/Toronto') + interval '1 day 11 hours') at time zone 'America/Toronto')::text, true);
select set_config('t.j_1130', ((date_trunc('day', now() at time zone 'America/Toronto') + interval '1 day 11 hours 30 minutes') at time zone 'America/Toronto')::text, true);
select set_config('t.j_2300', ((date_trunc('day', now() at time zone 'America/Toronto') + interval '1 day 23 hours') at time zone 'America/Toronto')::text, true);
select set_config('t.j_2330', ((date_trunc('day', now() at time zone 'America/Toronto') + interval '1 day 23 hours 30 minutes') at time zone 'America/Toronto')::text, true);
select set_config('t.k_0030', ((date_trunc('day', now() at time zone 'America/Toronto') + interval '2 days 30 minutes') at time zone 'America/Toronto')::text, true);
select set_config('t.k_0759', ((date_trunc('day', now() at time zone 'America/Toronto') + interval '2 days 7 hours 59 minutes') at time zone 'America/Toronto')::text, true);
select set_config('t.k_0800', ((date_trunc('day', now() at time zone 'America/Toronto') + interval '2 days 8 hours') at time zone 'America/Toronto')::text, true);
select set_config('t.k_1000', ((date_trunc('day', now() at time zone 'America/Toronto') + interval '2 days 10 hours') at time zone 'America/Toronto')::text, true);
select set_config('t.k_1030', ((date_trunc('day', now() at time zone 'America/Toronto') + interval '2 days 10 hours 30 minutes') at time zone 'America/Toronto')::text, true);

select set_config('t.j_2145', ((date_trunc('day', now() at time zone 'America/Toronto') + interval '1 day 21 hours 45 minutes') at time zone 'America/Toronto')::text, true);
select set_config('t.j_2148', ((date_trunc('day', now() at time zone 'America/Toronto') + interval '1 day 21 hours 48 minutes') at time zone 'America/Toronto')::text, true);
select set_config('t.j_2159', ((date_trunc('day', now() at time zone 'America/Toronto') + interval '1 day 21 hours 59 minutes') at time zone 'America/Toronto')::text, true);
select set_config('t.j_2200', ((date_trunc('day', now() at time zone 'America/Toronto') + interval '1 day 22 hours') at time zone 'America/Toronto')::text, true);
select set_config('t.j_2230', ((date_trunc('day', now() at time zone 'America/Toronto') + interval '1 day 22 hours 30 minutes') at time zone 'America/Toronto')::text, true);
select set_config('t.j_2245', ((date_trunc('day', now() at time zone 'America/Toronto') + interval '1 day 22 hours 45 minutes') at time zone 'America/Toronto')::text, true);
select set_config('t.j_2315', ((date_trunc('day', now() at time zone 'America/Toronto') + interval '1 day 23 hours 15 minutes') at time zone 'America/Toronto')::text, true);
select set_config('t.k_0200', ((date_trunc('day', now() at time zone 'America/Toronto') + interval '2 days 2 hours') at time zone 'America/Toronto')::text, true);
select set_config('t.k_0900', ((date_trunc('day', now() at time zone 'America/Toronto') + interval '2 days 9 hours') at time zone 'America/Toronto')::text, true);

-- ── Préparation (postgres), annulée à la fin ────────────────────────────────
select vault.create_secret('secret-de-test-banc-interet', 'PUSH_DISPATCH_SECRET');
select vault.create_secret('http://127.0.0.1:9/functions/v1', 'EDGE_FUNCTIONS_URL');
select vault.create_secret('secret-de-test-banc-parent', 'PARENT_CONTACT_SECRET');
insert into device_tokens (user_id, token, platform)
select u, 'jeton-banc-interet-' || u, 'ios'
  from unnest(array[current_setting('t.felix_u'), current_setting('t.mathis_u'), current_setting('t.lea_u')]::uuid[]) u
on conflict do nothing;
delete from push_file;
delete from push_envois;
select set_config('t.q_net', coalesce((select max(id) from net.http_request_queue), 0)::text, true);
-- r4 est Pro (subscriptions) : unite_ecrire_dossier exige user_has_pro() (RLS du processus).
update subscriptions set tier = 'pro', status = 'active' where user_id = current_setting('t.r4')::uuid;

-- ── S. Structure et droits ──────────────────────────────────────────────────
select pg_temp.verif('S1 déclencheurs branchés, ancienne cloche favori débranchée',
  (select string_agg(c.relname || '.' || t.tgname, ',' order by c.relname)
     from pg_trigger t join pg_class c on c.oid = t.tgrelid
    where t.tgname in ('trg_push_interet', 'trg_push_vue_profil', 'trg_notify_favorited')),
  'recruiter_athlete_views.trg_push_vue_profil,recruiter_favorites.trg_push_interet,recruiter_list_members.trg_push_interet,recruiter_pipeline.trg_push_interet');
set local role authenticated;
select pg_temp.essai('S2 un utilisateur ne met pas d''intérêt en file', current_setting('t.r1'),
  format('select public.push_sur_interet(%L, %L)::text', current_setting('t.zoe'), current_setting('t.r1')), 'ERR:42501');
select pg_temp.essai('S3 ni ne lit l''horloge des heures calmes', current_setting('t.r1'),
  'select public.push_heure_calme(now())::text', 'ERR:42501');
reset role;

-- ── A. Lot A : ajouté à une liste ───────────────────────────────────────────
set local role authenticated;
select pg_temp.essai('A1 r1 met Zoé en favori (vrai rôle)', current_setting('t.r1'),
  format('insert into public.recruiter_favorites (recruiter_id, athlete_id) values (%L, %L) returning ''ok''',
         current_setting('t.r1'), current_setting('t.zoe')), 'ok');
reset role;
select pg_temp.verif('A2 favori + processus du même geste → 1 seul élément AJOUT_LISTE ; le processus existe',
  (select count(*)::text from push_file where user_id = current_setting('t.zoe_u')::uuid and genre = 'AJOUT_LISTE')
  || '|' || (select count(*)::text from recruiter_pipeline where recruiter_id = current_setting('t.r1')::uuid and athlete_id = current_setting('t.zoe')::uuid),
  '1|1');
select pg_temp.verif('A3 cloche : une notification ADDED_TO_FAVORITES au texte neutre, catégorie INTERET_RECRUTEURS',
  (select count(*) || '|' || max(title) || '|' || max(message) from athlete_notifications
    where athlete_id = current_setting('t.zoe')::uuid and type = 'ADDED_TO_FAVORITES')
  || '|' || (select max(categorie) from push_file where user_id = current_setting('t.zoe_u')::uuid and genre = 'AJOUT_LISTE'),
  '1|Ton profil a été ajouté à une liste de suivi|Ton profil a été ajouté à une liste de suivi|INTERET_RECRUTEURS');
set local role authenticated;
select pg_temp.essai('A4 r1 retire le favori', current_setting('t.r1'),
  format('delete from public.recruiter_favorites where recruiter_id = %L and athlete_id = %L returning ''ok''',
         current_setting('t.r1'), current_setting('t.zoe')), 'ok');
select pg_temp.essai('A5 r1 le remet', current_setting('t.r1'),
  format('insert into public.recruiter_favorites (recruiter_id, athlete_id) values (%L, %L) returning ''ok''',
         current_setting('t.r1'), current_setting('t.zoe')), 'ok');
reset role;
select pg_temp.verif('A6 retirer puis remettre → 1 nouvel élément (2 en tout), 2 notifications',
  (select count(*)::text from push_file where user_id = current_setting('t.zoe_u')::uuid and genre = 'AJOUT_LISTE')
  || '|' || (select count(*)::text from athlete_notifications where athlete_id = current_setting('t.zoe')::uuid and type = 'ADDED_TO_FAVORITES'),
  '2|2');
with l as (insert into recruiter_lists (recruiter_id, name) values (current_setting('t.r2')::uuid, 'Banc — liste') returning id)
insert into recruiter_list_members (list_id, athlete_id) select id, current_setting('t.zoe')::uuid from l;
select pg_temp.verif('A7 ajout à une liste (r2) → 1 élément de plus',
  (select count(*)::text from push_file where user_id = current_setting('t.zoe_u')::uuid and genre = 'AJOUT_LISTE'), '3');
set local role authenticated;
select pg_temp.essai('A8 r4, collègue de r1, rejoint le dossier de l''unité (unite_ecrire_dossier)', current_setting('t.r4'),
  format('select (public.unite_ecrire_dossier(%L, ''{"flagged": true}''::jsonb)).athlete_id::text', current_setting('t.zoe')),
  current_setting('t.zoe'));
reset role;
select pg_temp.verif('A9 rejoindre le dossier de l''unité n''est pas un geste → rien de plus ; la ligne de r4 existe',
  (select count(*)::text from push_file where user_id = current_setting('t.zoe_u')::uuid and genre = 'AJOUT_LISTE')
  || '|' || (select count(*)::text from recruiter_pipeline where recruiter_id = current_setting('t.r4')::uuid and athlete_id = current_setting('t.zoe')::uuid),
  '3|1');
set local role authenticated;
select pg_temp.essai('A10 r4 ouvre un dossier NEUF pour Félix', current_setting('t.r4'),
  format('select (public.unite_ecrire_dossier(%L, ''{"stage": "IDENTIFIE"}''::jsonb)).athlete_id::text', current_setting('t.felix')),
  current_setting('t.felix'));
reset role;
select pg_temp.verif('A11 dossier neuf → 1 élément pour Félix',
  (select count(*)::text from push_file where user_id = current_setting('t.felix_u')::uuid and genre = 'AJOUT_LISTE'), '1');

-- Message au COACH (RECRUTEUR_COACH) : le processus créé par le message compte.
with c as (insert into conversations (conversation_type, recruiter_id, coach_id, athlete_id)
           values ('RECRUTEUR_COACH', current_setting('t.r2')::uuid, current_setting('t.marc')::uuid, current_setting('t.mathis')::uuid)
           returning id)
insert into messages (conversation_id, sender_id, content) select id, current_setting('t.r2')::uuid, 'Banc : message au coach' from c;
select pg_temp.verif('A12 message au coach → processus CONTACTE et 1 élément AJOUT_LISTE pour Mathis',
  (select max(stage) from recruiter_pipeline where recruiter_id = current_setting('t.r2')::uuid and athlete_id = current_setting('t.mathis')::uuid)
  || '|' || (select count(*)::text from push_file where user_id = current_setting('t.mathis_u')::uuid and genre = 'AJOUT_LISTE'),
  'CONTACTE|1');
-- Message à l'ATHLÈTE (RECRUTEUR_ATHLETE) : le push du message suffit.
with c as (insert into conversations (conversation_type, recruiter_id, athlete_id)
           values ('RECRUTEUR_ATHLETE', current_setting('t.r2')::uuid, current_setting('t.lea')::uuid)
           returning id)
insert into messages (conversation_id, sender_id, content) select id, current_setting('t.r2')::uuid, 'Banc : message à l''athlète' from c;
select pg_temp.verif('A13 message à l''athlète → processus CONTACTE, 0 élément AJOUT_LISTE, le push du message part',
  (select max(stage) from recruiter_pipeline where recruiter_id = current_setting('t.r2')::uuid and athlete_id = current_setting('t.lea')::uuid)
  || '|' || (select count(*)::text from push_file where user_id = current_setting('t.lea_u')::uuid and genre = 'AJOUT_LISTE')
  || '|' || (select count(*)::text from net.http_request_queue q
              where q.id > current_setting('t.q_net')::bigint
                and convert_from(q.body, 'UTF8')::jsonb->>'user_id' = current_setting('t.lea_u')
                and convert_from(q.body, 'UTF8')::jsonb->'data'->>'type' = 'message'),
  'CONTACTE|0|1');
-- Un geste qui écrit processus ET liste dans la même instruction (forme de fusionner_carte).
do $g$
declare v_liste uuid;
begin
  insert into recruiter_pipeline (recruiter_id, athlete_id, stage) values (current_setting('t.r2')::uuid, current_setting('t.tom')::uuid, 'IDENTIFIE');
  insert into recruiter_lists (recruiter_id, name) values (current_setting('t.r2')::uuid, 'Banc — fusion') returning id into v_liste;
  insert into recruiter_list_members (list_id, athlete_id) values (v_liste, current_setting('t.tom')::uuid);
end $g$;
select pg_temp.verif('A14 processus + liste dans une seule instruction (comme une fusion de carte) → 1 élément',
  (select count(*)::text from push_file where user_id = current_setting('t.tom_u')::uuid and genre = 'AJOUT_LISTE'), '1');
insert into recruiter_favorites (recruiter_id, athlete_id) values (current_setting('t.r3')::uuid, current_setting('t.mathis')::uuid);
select pg_temp.verif('A15 recruteur DÉSACTIVÉ → rien (Mathis reste à 1)',
  (select count(*)::text from push_file where user_id = current_setting('t.mathis_u')::uuid and genre = 'AJOUT_LISTE'), '1');
insert into recruiter_favorites (recruiter_id, athlete_id) values (current_setting('t.r1')::uuid, current_setting('t.sans')::uuid);
select pg_temp.verif('A16 fiche sans compte → ni file ni notification',
  (select count(*)::text from athlete_notifications where athlete_id = current_setting('t.sans')::uuid)
  || '|' || (select count(*)::text from push_file f where f.cle like 'ajout:' || current_setting('t.sans') || ':%'), '0|0');
insert into recruiter_favorites (recruiter_id, athlete_id) values (current_setting('t.r5')::uuid, current_setting('t.mathis')::uuid);
select pg_temp.verif('A17 compte sans établissement (toutes les sources comptent) → 1 élément, même texte',
  (select count(*)::text from push_file where user_id = current_setting('t.mathis_u')::uuid and genre = 'AJOUT_LISTE')
  || '|' || (select count(distinct title)::text from athlete_notifications where athlete_id = current_setting('t.mathis')::uuid and type = 'ADDED_TO_FAVORITES'),
  '2|1');

-- ── B. Lot B : profil consulté, un push par jour ────────────────────────────
-- Les ajouts de Zoé sont envoyés d'abord (traitement à J 10 h 00), pour lire les vues seules.
select public.push_traiter_file(current_setting('t.j_1000')::timestamptz);
insert into recruiter_athlete_views (recruiter_id, athlete_id, viewed_at)
values (current_setting('t.r1')::uuid, current_setting('t.zoe')::uuid, current_setting('t.j_1000')::timestamptz);
select pg_temp.verif('B1 1re vue du jour (r1) → 1 élément VUE_PROFIL, notification « Ton profil a été consulté »',
  (select count(*)::text from push_file where user_id = current_setting('t.zoe_u')::uuid and genre = 'VUE_PROFIL')
  || '|' || (select max(title) || '/' || max(message) from athlete_notifications where athlete_id = current_setting('t.zoe')::uuid and type = 'PROFILE_VIEWED'),
  '1|Ton profil a été consulté/Ton profil a été consulté');
insert into recruiter_athlete_views (recruiter_id, athlete_id, viewed_at)
values (current_setting('t.r2')::uuid, current_setting('t.zoe')::uuid, current_setting('t.j_1005')::timestamptz);
select pg_temp.verif('B2 2e vue le même jour (r2), avant l''envoi → même groupe, notification « 2 fois »',
  (select count(*) || '|' || count(distinct cle) from push_file where user_id = current_setting('t.zoe_u')::uuid and genre = 'VUE_PROFIL')
  || '|' || (select count(*) || '|' || max(message) from athlete_notifications where athlete_id = current_setting('t.zoe')::uuid and type = 'PROFILE_VIEWED'),
  '2|1|1|Ton profil a été consulté 2 fois');
update push_file set cree_le = current_setting('t.j_1005')::timestamptz
 where user_id = current_setting('t.zoe_u')::uuid and genre = 'VUE_PROFIL';
select public.push_traiter_file(current_setting('t.j_1020')::timestamptz);
select pg_temp.verif('B3 l''envoi : UN push « Nexus » / « … consulté 2 fois », nb_elements 2',
  (select count(*) || '|' || max(titre) || '|' || max(texte) || '|' || max(nb_elements) from push_envois
    where user_id = current_setting('t.zoe_u')::uuid and cle like 'vue:%'),
  '1|Nexus|Ton profil a été consulté 2 fois|2');
update athlete_notifications set read = true where athlete_id = current_setting('t.zoe')::uuid and type = 'PROFILE_VIEWED';
insert into recruiter_athlete_views (recruiter_id, athlete_id, viewed_at)
values (current_setting('t.r4')::uuid, current_setting('t.zoe')::uuid, current_setting('t.j_1100')::timestamptz);
select public.push_traiter_file(current_setting('t.j_1130')::timestamptz);
select pg_temp.verif('B4 3e vue APRÈS l''envoi → aucun 2e push ; la notification passe à 3 et redevient non lue',
  (select count(*)::text from push_file where user_id = current_setting('t.zoe_u')::uuid and genre = 'VUE_PROFIL')
  || '|' || (select count(*)::text from push_envois where user_id = current_setting('t.zoe_u')::uuid and cle like 'vue:%')
  || '|' || (select count(*) || '|' || max(message) || '|' || bool_or(read) from athlete_notifications
              where athlete_id = current_setting('t.zoe')::uuid and type = 'PROFILE_VIEWED'),
  '2|1|1|Ton profil a été consulté 3 fois|false');
insert into recruiter_athlete_views (recruiter_id, athlete_id, viewed_at)
values (current_setting('t.r3')::uuid, current_setting('t.zoe')::uuid, current_setting('t.j_1130')::timestamptz);
select pg_temp.verif('B5 vue d''un recruteur DÉSACTIVÉ → rien, le compte du jour reste à 3',
  (select count(*)::text from push_file where user_id = current_setting('t.zoe_u')::uuid and genre = 'VUE_PROFIL')
  || '|' || (select max(message) from athlete_notifications where athlete_id = current_setting('t.zoe')::uuid and type = 'PROFILE_VIEWED'),
  '2|Ton profil a été consulté 3 fois');
insert into recruiter_athlete_views (recruiter_id, athlete_id, viewed_at)
values (current_setting('t.r1')::uuid, current_setting('t.zoe')::uuid, current_setting('t.k_1000')::timestamptz);
select public.push_traiter_file(current_setting('t.k_1030')::timestamptz);
select pg_temp.verif('B6 lendemain → nouveau groupe, nouveau push (2 en tout), 2e notification',
  (select count(*)::text from push_envois where user_id = current_setting('t.zoe_u')::uuid and cle like 'vue:%')
  || '|' || (select count(*)::text from athlete_notifications where athlete_id = current_setting('t.zoe')::uuid and type = 'PROFILE_VIEWED'),
  '2|2');
insert into recruiter_athlete_views (recruiter_id, athlete_id, viewed_at)
values (current_setting('t.r1')::uuid, current_setting('t.felix')::uuid, current_setting('t.j_2330')::timestamptz),
       (current_setting('t.r2')::uuid, current_setting('t.felix')::uuid, current_setting('t.k_0030')::timestamptz);
select pg_temp.verif('B7 23 h 30 et 0 h 30 (Montréal) : la même nuit, donc le même jour d''envoi → 1 groupe',
  (select count(distinct cle)::text from push_file where user_id = current_setting('t.felix_u')::uuid and genre = 'VUE_PROFIL'), '1');
insert into recruiter_athlete_views (recruiter_id, athlete_id, viewed_at)
values (current_setting('t.r1')::uuid, current_setting('t.sans')::uuid, current_setting('t.j_1000')::timestamptz);
select pg_temp.verif('B8 fiche sans compte → rien',
  (select count(*)::text from push_file f where f.cle like 'vue:' || current_setting('t.sans') || ':%')
  || '|' || (select count(*)::text from athlete_notifications where athlete_id = current_setting('t.sans')::uuid), '0|0');
select pg_temp.verif('B9 au plus UN push « vue » par athlète et par jour (tout le banc)',
  (select coalesce(max(n), 0)::text from (select count(*) n from push_envois where cle like 'vue:%' group by user_id, cle) x), '1');

-- ── H. Heures calmes : 22 h 00 – 7 h 59 pour tous ; le push attend, la cloche non ─────
select pg_temp.verif('H1 push_heure_calme : 21 h 59 non, 22 h 00 oui, 7 h 59 oui, 8 h 00 non',
  public.push_heure_calme(current_setting('t.j_2159')::timestamptz)::text
  || public.push_heure_calme(current_setting('t.j_2200')::timestamptz)::text
  || public.push_heure_calme(current_setting('t.k_0759')::timestamptz)::text
  || public.push_heure_calme(current_setting('t.k_0800')::timestamptz)::text, 'falsetruetruefalse');
-- Ajouts de Léa : un geste à 21 h 45, traité à 21 h 59 → il part.
insert into recruiter_favorites (recruiter_id, athlete_id) values (current_setting('t.r1')::uuid, current_setting('t.lea')::uuid);
update push_file set cree_le = current_setting('t.j_2145')::timestamptz
 where user_id = current_setting('t.lea_u')::uuid and statut = 'EN_ATTENTE';
select set_config('t.r2159', public.push_traiter_file(current_setting('t.j_2159')::timestamptz)::text, true);
select pg_temp.verif('H2 21 h 59 : la file part (ajout de 21 h 45 envoyé)',
  (current_setting('t.r2159')::jsonb->>'heures_calmes')
  || '|' || (select count(*)::text from push_envois where user_id = current_setting('t.lea_u')::uuid and cle like 'ajout:%'), 'false|1');
-- Un 2e geste à 21 h 48 (liste de r2), traité à 22 h 00 → il attend.
with l as (insert into recruiter_lists (recruiter_id, name) values (current_setting('t.r2')::uuid, 'Banc — soir') returning id)
insert into recruiter_list_members (list_id, athlete_id) select id, current_setting('t.lea')::uuid from l;
update push_file set cree_le = current_setting('t.j_2148')::timestamptz
 where user_id = current_setting('t.lea_u')::uuid and statut = 'EN_ATTENTE';
select set_config('t.r2200', public.push_traiter_file(current_setting('t.j_2200')::timestamptz)::text, true);
select pg_temp.verif('H3 22 h 00 : heures calmes, l''ajout de 21 h 48 attend',
  (current_setting('t.r2200')::jsonb->>'heures_calmes')
  || '|' || (select count(*)::text from push_file where user_id = current_setting('t.lea_u')::uuid and statut = 'EN_ATTENTE'), 'true|1');
-- Un 3e geste en pleine nuit (23 h 00) : la cloche s'écrit tout de suite, le push attend.
insert into recruiter_favorites (recruiter_id, athlete_id) values (current_setting('t.r5')::uuid, current_setting('t.lea')::uuid);
update push_file set cree_le = current_setting('t.j_2300')::timestamptz
 where user_id = current_setting('t.lea_u')::uuid and statut = 'EN_ATTENTE' and cree_le > current_setting('t.j_2148')::timestamptz;
select pg_temp.verif('H4 ajout la nuit : 3 notifications dans la cloche tout de suite, 2 pushs en attente',
  (select count(*)::text from athlete_notifications where athlete_id = current_setting('t.lea')::uuid and type = 'ADDED_TO_FAVORITES')
  || '|' || (select count(*)::text from push_file where user_id = current_setting('t.lea_u')::uuid and statut = 'EN_ATTENTE'), '3|2');
-- Vues de Mathis pendant la nuit : 22 h 30 (r1), 23 h 15 (r2), 2 h 00 (r4).
insert into recruiter_athlete_views (recruiter_id, athlete_id, viewed_at) values
  (current_setting('t.r1')::uuid, current_setting('t.mathis')::uuid, current_setting('t.j_2230')::timestamptz),
  (current_setting('t.r2')::uuid, current_setting('t.mathis')::uuid, current_setting('t.j_2315')::timestamptz),
  (current_setting('t.r4')::uuid, current_setting('t.mathis')::uuid, current_setting('t.k_0200')::timestamptz);
update push_file set cree_le = current_setting('t.j_2230')::timestamptz
 where user_id = current_setting('t.mathis_u')::uuid and genre = 'VUE_PROFIL';
select pg_temp.verif('H5 3 vues la nuit (22 h 30, 23 h 15, 2 h) → UN groupe, celui du lendemain ; cloche à 3 tout de suite',
  (select count(*) || '|' || count(distinct cle) || '|' || bool_and(cle like '%:' || (current_setting('t.k_0800')::timestamptz at time zone 'America/Toronto')::date)
     from push_file where user_id = current_setting('t.mathis_u')::uuid and genre = 'VUE_PROFIL')
  || '|' || (select max(message) from athlete_notifications where athlete_id = current_setting('t.mathis')::uuid and type = 'PROFILE_VIEWED'),
  '3|1|true|Ton profil a été consulté 3 fois');
-- Un vrai badge du coach posé à 22 h 45.
set local role authenticated;
select pg_temp.essai('H6 Marc pose un badge à Félix', current_setting('t.marc'),
  format($q$select public.appliquer_badges_saisie(%L, '[{"code":"clutch"}]'::jsonb)::text || 'ok'$q$, current_setting('t.felix')), 'ok');
reset role;
update push_file set cree_le = current_setting('t.j_2245')::timestamptz
 where user_id = current_setting('t.felix_u')::uuid and statut = 'EN_ATTENTE' and genre = 'BADGE_COACH';
select set_config('t.r0759', public.push_traiter_file(current_setting('t.k_0759')::timestamptz)::text, true);
select pg_temp.verif('H7 7 h 59 : heures calmes, rien ne part (ajouts de Léa, vues de Mathis, badge de Félix)',
  (current_setting('t.r0759')::jsonb->>'heures_calmes')
  || '|' || (select count(*)::text from push_envois where envoye_le > current_setting('t.j_2159')::timestamptz
                                                              and envoye_le < current_setting('t.k_0800')::timestamptz),
  'true|0');
select set_config('t.r0800', public.push_traiter_file(current_setting('t.k_0800')::timestamptz)::text, true);
select pg_temp.verif('H8 8 h 00 : tout part — 2 ajouts de Léa, le badge de Félix',
  (current_setting('t.r0800')::jsonb->>'heures_calmes')
  || '|' || (select count(*)::text from push_envois where user_id = current_setting('t.lea_u')::uuid and cle like 'ajout:%' and envoye_le = current_setting('t.k_0800')::timestamptz)
  || '|' || (select count(*)::text from push_envois where user_id = current_setting('t.felix_u')::uuid and cle like 'badges:%' and envoye_le = current_setting('t.k_0800')::timestamptz),
  'false|2|1');
select pg_temp.verif('H9 vues de la nuit : UN push à 8 h, « Nexus » / « … consulté 3 fois », 3 éléments',
  (select count(*) || '|' || max(titre) || '|' || max(texte) || '|' || max(nb_elements) || '|' || bool_and(envoye_le = current_setting('t.k_0800')::timestamptz)
     from push_envois where user_id = current_setting('t.mathis_u')::uuid and cle like 'vue:%'),
  '1|Nexus|Ton profil a été consulté 3 fois|3|true');
insert into recruiter_athlete_views (recruiter_id, athlete_id, viewed_at)
values (current_setting('t.r5')::uuid, current_setting('t.mathis')::uuid, current_setting('t.k_0900')::timestamptz);
select public.push_traiter_file(current_setting('t.k_1030')::timestamptz);
select pg_temp.verif('H10 une vue à 9 h le même jour → pas de 2e push ; la cloche passe à 4',
  (select count(*)::text from push_envois where user_id = current_setting('t.mathis_u')::uuid and cle like 'vue:%')
  || '|' || (select max(message) from athlete_notifications where athlete_id = current_setting('t.mathis')::uuid and type = 'PROFILE_VIEWED'
              and metadata->>'push_cle' like '%:' || (current_setting('t.k_0800')::timestamptz at time zone 'America/Toronto')::date),
  '1|Ton profil a été consulté 4 fois');
-- Le parent : la même fenêtre (22 h 00 – 7 h 59).
insert into auth.users (id, email, aud, role, created_at, updated_at)
values ('b0000000-0000-4000-8000-000000000801', 'parent.banc@exemple.test', 'authenticated', 'authenticated', now(), now());
insert into users (id, email, role, status) values ('b0000000-0000-4000-8000-000000000801', 'parent.banc@exemple.test', 'PARENT', 'ACTIF');
insert into parent_contact_avis (athlete_id, cle_unite, statut, parent_user_id, push_statut)
values (current_setting('t.zoe')::uuid, 'banc-1', 'AVISE', 'b0000000-0000-4000-8000-000000000801', 'EN_ATTENTE');
select set_config('t.p2159', public.parent_contact_envoyer_push(current_setting('t.j_2159')::timestamptz)::text, true);
select pg_temp.verif('H11 push PARENT à 21 h 59 : il part',
  current_setting('t.p2159') || '|' || (select push_statut from parent_contact_avis where cle_unite = 'banc-1'), '1|ENVOYE');
insert into parent_contact_avis (athlete_id, cle_unite, statut, parent_user_id, push_statut)
values (current_setting('t.zoe')::uuid, 'banc-2', 'AVISE', 'b0000000-0000-4000-8000-000000000801', 'EN_ATTENTE');
select pg_temp.verif('H12 push PARENT à 22 h 00 et à 7 h 59 : rien ne part',
  public.parent_contact_envoyer_push(current_setting('t.j_2200')::timestamptz)::text
  || public.parent_contact_envoyer_push(current_setting('t.k_0759')::timestamptz)::text, '00');
select set_config('t.p0800', public.parent_contact_envoyer_push(current_setting('t.k_0800')::timestamptz)::text, true);
select pg_temp.verif('H13 push PARENT à 8 h 00 : il part',
  current_setting('t.p0800') || '|' || (select push_statut from parent_contact_avis where cle_unite = 'banc-2'), '1|ENVOYE');
select pg_temp.verif('H14 consentement partenaire : même horloge (push_heure_calme appelée)',
  (select string_agg(p.proname, ',' order by p.proname) from pg_proc p
    where p.proname in ('consentement_partenaire_v2_pousser', 'consentement_partenaire_v2_relancer', 'parent_contact_envoyer_push', 'push_traiter_file')
      and position('push_heure_calme(' in p.prosrc) > 0),
  'consentement_partenaire_v2_pousser,consentement_partenaire_v2_relancer,parent_contact_envoyer_push,push_traiter_file');

-- ── T. Textes : jamais de nom, de cégep ni de région ────────────────────────
select pg_temp.verif('T1 aucun texte (file, envois, cloche, pg_net) ne nomme un recruteur, un cégep ou une région',
  (select count(*)::text from (
     select title || ' ' || coalesce(message, '') t from athlete_notifications where type in ('PROFILE_VIEWED', 'ADDED_TO_FAVORITES')
     union all select titre || ' ' || texte from push_envois where cle like 'vue:%' or cle like 'ajout:%'
     union all select coalesce(source_nom, '') from push_file where genre in ('VUE_PROFIL', 'AJOUT_LISTE')
     union all select convert_from(q.body, 'UTF8')::jsonb->>'title' || ' ' || (convert_from(q.body, 'UTF8')::jsonb->>'body')
       from net.http_request_queue q
      where q.id > current_setting('t.q_net')::bigint
        and convert_from(q.body, 'UTF8')::jsonb->'data'->>'nx_type' in ('VUE_PROFIL', 'AJOUT_LISTE')) x
    where t ~* '(rémi|rose|rita|rené|équipe nexus|cégep|banc|montréal|laval|région|recruteur)'), '0');
select pg_temp.verif('T2 ce qui part dans pg_net : announcement + nx_type + route des notifications',
  (select string_agg(x, ',' order by x) from (
     select distinct (d->>'type') || '/' || (d->>'nx_type') || '/' || (d->>'route') x
       from (select convert_from(q.body, 'UTF8')::jsonb->'data' d from net.http_request_queue q
              where q.id > current_setting('t.q_net')::bigint) s
      where d->>'nx_type' in ('VUE_PROFIL', 'AJOUT_LISTE')) y),
  'announcement/AJOUT_LISTE//athlete/notifications,announcement/VUE_PROFIL//athlete/notifications');
select pg_temp.verif('T3 notifications : la destination au clic est celle des notifications',
  (select string_agg(distinct metadata->>'route', ',') from athlete_notifications where type in ('PROFILE_VIEWED', 'ADDED_TO_FAVORITES')),
  '/athlete/notifications');

select pg_temp.verif('T4 titre du push = « Nexus » ; la cloche garde la phrase',
  (select string_agg(distinct titre, ',') from push_envois where cle like 'vue:%' or cle like 'ajout:%')
  || '|' || (select count(*)::text from athlete_notifications where type in ('PROFILE_VIEWED', 'ADDED_TO_FAVORITES') and title = 'Nexus'),
  'Nexus|0');

-- ── D. Doublons ─────────────────────────────────────────────────────────────
select pg_temp.verif('D1 0 doublon : un envoi par groupe, une notification par groupe',
  (select count(*)::text from (select user_id, cle from push_envois group by user_id, cle having count(*) > 1) x)
  || '|' || (select count(*)::text from (select metadata->>'push_cle' from athlete_notifications
                                          where metadata ? 'push_cle' group by athlete_id, metadata->>'push_cle' having count(*) > 1) y),
  '0|0');

select n, case when ok then 'OK' else 'ÉCHEC' end as res, test, detail from _res order by n;
select count(*) filter (where ok) as ok, count(*) filter (where not ok) as echecs from _res;

rollback;
