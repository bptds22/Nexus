-- Invitations coach → joueur (20261015114923), base LOCALE. Une transaction ANNULÉE à la fin.
-- Ce que les courriels REÇOIVENT est lu dans la file de pg_net (net.http_request_queue) : un faux
-- secret est posé dans le Vault DANS la transaction, la file n'est jamais validée → rien ne part.
--   docker cp docs/invitations-sans-coach/tests-invitations.sql supabase_db_Nexus:/tmp/tests-inv.sql
--   docker exec -e PGCLIENTENCODING=UTF8 supabase_db_Nexus psql -U postgres -d postgres -q -f /tmp/tests-inv.sql
\set ON_ERROR_STOP 1
\pset footer off
begin;

create temp table _res (n serial, test text, ok boolean, detail text) on commit drop;
grant all on _res to authenticated, anon;
grant usage on sequence _res_n_seq to authenticated, anon;
create function pg_temp.verif(p_test text, p_obtenu text, p_attendu text) returns void language sql as $$
  insert into _res (test, ok, detail) values (p_test, p_obtenu is not distinct from p_attendu,
    coalesce(p_obtenu, 'NULL') || ' (attendu ' || coalesce(p_attendu, 'NULL') || ')')
$$;

-- Comptes locaux
select set_config('t.coach', (select id::text from users where email = 'marc.desrosiers@exemple.test'), true);
select set_config('t.r1', (select id::text from users where email = 'test1@preuve.local'), true);
select set_config('t.r2', (select id::text from users where email = 'r6.gratuit@preuve.local'), true);
select set_config('t.r3', (select id::text from users where email = 'recruteur.littoral@exemple.test'), true);
select set_config('t.r4', (select id::text from users where role = 'RECRUTEUR' and status = 'ACTIF' and school_id is not null and sport_id is not null
  and email not in ('test1@preuve.local', 'r6.gratuit@preuve.local') order by email limit 1), true);
select set_config('t.foot', (select id::text from sports where nom = 'Football'), true);
-- Noms qui ne doivent JAMAIS fuir dans un message
select set_config('t.coach_nom', (select first_name || ' ' || last_name from users where id = current_setting('t.coach')::uuid), true);
select set_config('t.ecole_coach', (select s.name from users u join schools s on s.id = u.school_id where u.id = current_setting('t.coach')::uuid), true);

-- Fiche orpheline préparée par le coach (adulte : le courriel d'invitation n'est pas bloqué)
insert into athletes (id, first_name, last_name, date_naissance, coach_id, school_id, email, status, verified, annee_diplomation, sport_id)
values ('e1000000-0000-4000-8000-000000000001', 'Inès', 'Banc-Invitation', '2007-02-02',
        current_setting('t.coach')::uuid, (select school_id from users where id = current_setting('t.coach')::uuid),
        'ines.banc.inv@exemple.test', 'ACTIF', false, 2025, current_setting('t.foot')::uuid);
select set_config('t.a', 'e1000000-0000-4000-8000-000000000001', true);
create function pg_temp.nb() returns text language sql as $$ select public.recruteurs_suivant_athlete(current_setting('t.a')::uuid)::text $$;

-- ── A. Le compte des recruteurs : distincts, réels, sans PROPOSEE ni annulée ──
select pg_temp.verif('A1 aucun suivi → 0', pg_temp.nb(), '0');
insert into recruiter_favorites (recruiter_id, athlete_id) values (current_setting('t.r1')::uuid, current_setting('t.a')::uuid);
select pg_temp.verif('A2 un favori → 1', pg_temp.nb(), '1');
-- (un favori crée déjà sa ligne de pipeline par trigger : la même personne, deux traces)
insert into recruiter_pipeline (recruiter_id, athlete_id) values (current_setting('t.r1')::uuid, current_setting('t.a')::uuid) on conflict do nothing;
select pg_temp.verif('A3 le MÊME recruteur dans son pipeline → toujours 1 (distincts)', pg_temp.nb(), '1');
insert into recruiter_pipeline (recruiter_id, athlete_id) values (current_setting('t.r2')::uuid, current_setting('t.a')::uuid);
select pg_temp.verif('A4 un 2e recruteur (pipeline) → 2', pg_temp.nb(), '2');
-- Carte prospect du recruteur r4, rapprochement seulement PROPOSÉ : ne compte pas
-- La carte se crée sous l'identité du recruteur (son unité cégep × sport est posée par le trigger).
select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.r4'), 'role', 'authenticated')::text, true);
insert into cartes_prospect (id, unite_cegep_id, unite_sport_id, prenom, nom, sport_athlete_id, team_id)
values ('e1000000-0000-4000-8000-0000000000c1', current_setting('t.foot')::uuid, current_setting('t.foot')::uuid,
        'Inès', 'Banc-Invitation', current_setting('t.foot')::uuid,
        (select t.id from teams t where t.sport_id = current_setting('t.foot')::uuid
            and t.school_id = (select school_id from athletes where id = 'e1000000-0000-4000-8000-000000000001') limit 1));
select set_config('request.jwt.claims', '', true);
insert into rapprochements (carte_id, athlete_id, unite_cegep_id, unite_sport_id, critere, force, statut)
values ('e1000000-0000-4000-8000-0000000000c1', current_setting('t.a')::uuid,
        (select unite_cegep_id from cartes_prospect where id = 'e1000000-0000-4000-8000-0000000000c1'),
        (select unite_sport_id from cartes_prospect where id = 'e1000000-0000-4000-8000-0000000000c1'), 'ECOLE', 'FAIBLE', 'PROPOSEE');
select pg_temp.verif('A5 carte seulement PROPOSÉE (pas encore lui) → toujours 2', pg_temp.nb(), '2');
-- Fusion ANNULÉE : ne compte pas
insert into fusions_cartes (id, carte_id, carte_libelle, athlete_id, unite_cegep_id, unite_sport_id, etat, snapshot, acteur)
values ('e1000000-0000-4000-8000-0000000000f1', 'e1000000-0000-4000-8000-0000000000c1', 'Inès Banc-Invitation',
        current_setting('t.a')::uuid, (select unite_cegep_id from cartes_prospect where id = 'e1000000-0000-4000-8000-0000000000c1'),
        (select unite_sport_id from cartes_prospect where id = 'e1000000-0000-4000-8000-0000000000c1'), 'ANNULEE', '{}'::jsonb, current_setting('t.r4')::uuid);
select pg_temp.verif('A6 fusion ANNULÉE → toujours 2', pg_temp.nb(), '2');
update fusions_cartes set etat = 'ACTIVE' where id = 'e1000000-0000-4000-8000-0000000000f1';
select pg_temp.verif('A7 carte FUSIONNÉE avec la fiche (active) → 3', pg_temp.nb(), '3');
-- Un recruteur désactivé ne compte plus
update users set status = 'DESACTIVE' where id = current_setting('t.r2')::uuid;
select pg_temp.verif('A8 recruteur désactivé → 2', pg_temp.nb(), '2');
update users set status = 'ACTIF' where id = current_setting('t.r2')::uuid;
-- Un non-recruteur ne peut même pas être en favoris (la base le refuse) ; le compte reste 3.
do $$ begin
  insert into recruiter_favorites (recruiter_id, athlete_id) values (current_setting('t.coach')::uuid, current_setting('t.a')::uuid);
  insert into _res (test, ok, detail) values ('A9 un coach en favoris : refusé par la base', false, 'accepté');
exception when others then
  insert into _res (test, ok, detail) values ('A9 un coach en favoris : refusé par la base', true, 'refusé');
end $$;
select pg_temp.verif('A10 toujours 3', pg_temp.nb(), '3');

-- ── B. Le courriel de réclamation : le nombre, aucun coach, aucun recruteur ──
select vault.create_secret('secret-de-test-banc', 'INVITE_NOTICE_SECRET');
select vault.create_secret('secret-de-test-banc-equipe', 'TEAM_INVITE_NOTICE_SECRET');
select set_config('t.q_avant', (select coalesce(max(id), 0)::text from net.http_request_queue), true);
insert into athlete_invitations (token, athlete_id, created_by, email)
values ('jeton-banc-inv-1', current_setting('t.a')::uuid, current_setting('t.coach')::uuid, 'ines.banc.inv@exemple.test');
select pg_temp.verif('B1 un envoi en file, vers send-invitation',
  (select count(*)::text || '|' || bool_and(url like '%/send-invitation') from net.http_request_queue where id > current_setting('t.q_avant')::bigint), '1|true');
select set_config('t.corps', (select convert_from(body, 'UTF8') from net.http_request_queue where id > current_setting('t.q_avant')::bigint order by id desc limit 1), true);
select pg_temp.verif('B2 le courriel reçoit le nombre réel (3)', (current_setting('t.corps')::jsonb->>'nb_recruteurs'), '3');
select pg_temp.verif('B3 clés transmises : email, nb_recruteurs, claim_token — rien d''autre',
  (select string_agg(k, ',' order by k) from jsonb_object_keys(current_setting('t.corps')::jsonb) k), 'claim_token,email,nb_recruteurs');
select pg_temp.verif('B4 ni le nom du coach ni son école dans ce qui part',
  (position(current_setting('t.coach_nom') in current_setting('t.corps')) = 0
   and position(current_setting('t.ecole_coach') in current_setting('t.corps')) = 0)::text, 'true');
select pg_temp.verif('B5 aucun recruteur (identifiant ni nom) dans ce qui part',
  (select bool_and(position(u.id::text in current_setting('t.corps')) = 0 and position(u.last_name in current_setting('t.corps')) = 0)
     from users u where u.id in (current_setting('t.r1')::uuid, current_setting('t.r2')::uuid, current_setting('t.r4')::uuid))::text, 'true');

-- ── C. /claim : le nombre par le jeton, et seulement par un jeton valide ─────
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select pg_temp.verif('C1 anon, jeton valide → 3', public.invitation_recruteurs_suivent('jeton-banc-inv-1')::text, '3');
select pg_temp.verif('C2 anon, jeton inconnu → rien', public.invitation_recruteurs_suivent('jeton-qui-n-existe-pas')::text, null);
do $$ begin
  perform public.recruteurs_suivant_athlete('e1000000-0000-4000-8000-000000000001');
  insert into _res (test, ok, detail) values ('C3 anon ne compte pas une fiche au hasard', false, 'appelé');
exception when insufficient_privilege then
  insert into _res (test, ok, detail) values ('C3 anon ne compte pas une fiche au hasard', true, 'refusé');
end $$;
reset role;
update athlete_invitations set expires_at = now() - interval '1 day' where token = 'jeton-banc-inv-1';
set local role anon;
select pg_temp.verif('C4 jeton expiré → rien', public.invitation_recruteurs_suivent('jeton-banc-inv-1')::text, null);
reset role;
update athlete_invitations set expires_at = now() + interval '30 days' where token = 'jeton-banc-inv-1';
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.coach'), 'role', 'authenticated')::text, true);
do $$ begin
  perform public.recruteurs_suivant_athlete('e1000000-0000-4000-8000-000000000001');
  insert into _res (test, ok, detail) values ('C5 un coach connecté ne compte pas une fiche directement', false, 'appelé');
exception when insufficient_privilege then
  insert into _res (test, ok, detail) values ('C5 un coach connecté ne compte pas une fiche directement', true, 'refusé');
end $$;
reset role;
-- 0 recruteur : une autre fiche, jamais suivie
insert into athletes (id, first_name, last_name, date_naissance, coach_id, school_id, email, status, verified, annee_diplomation)
values ('e1000000-0000-4000-8000-000000000002', 'Zéro', 'Suivi', '2007-03-03', current_setting('t.coach')::uuid,
        (select school_id from users where id = current_setting('t.coach')::uuid), 'zero.suivi.inv@exemple.test', 'ACTIF', false, 2025);
insert into athlete_invitations (token, athlete_id, created_by, email)
values ('jeton-banc-inv-0', 'e1000000-0000-4000-8000-000000000002', current_setting('t.coach')::uuid, 'zero.suivi.inv@exemple.test');
select pg_temp.verif('C6 fiche jamais suivie : le courriel reçoit 0',
  (select convert_from(body, 'UTF8')::jsonb->>'nb_recruteurs' from net.http_request_queue order by id desc limit 1), '0');
set local role anon;
select pg_temp.verif('C7 /claim, fiche jamais suivie → 0', public.invitation_recruteurs_suivent('jeton-banc-inv-0')::text, '0');
reset role;

-- ── D. Invitation d'équipe : courriel et notification sans coach ─────────────
-- (Inès reçoit un compte jetable pour être « rattachée » : le courriel d'équipe vise un athlète avec compte)
select set_config('t.equipe', (select t.id::text from teams t join team_coaches tc on tc.team_id = t.id where tc.coach_id = current_setting('t.coach')::uuid limit 1), true);
select set_config('t.q_avant2', (select coalesce(max(id), 0)::text from net.http_request_queue), true);
insert into team_invitations (team_id, athlete_id, invited_by_coach_id, status, transfer_token, expires_at)
values (current_setting('t.equipe')::uuid, current_setting('t.a')::uuid, current_setting('t.coach')::uuid, 'PENDING', 'BANCINV1', now() + interval '14 days');
select set_config('t.corps2', (select convert_from(body, 'UTF8') from net.http_request_queue where id > current_setting('t.q_avant2')::bigint order by id desc limit 1), true);
select pg_temp.verif('D1 courriel d''équipe : plus de clé coach_name',
  (current_setting('t.corps2')::jsonb ? 'coach_name')::text, 'false');
select pg_temp.verif('D2 courriel d''équipe : le nom du coach n''est nulle part',
  (position(current_setting('t.coach_nom') in current_setting('t.corps2')) = 0)::text, 'true');
select pg_temp.verif('D3 notification in-app : « Invitation à rejoindre une équipe »',
  (select title from athlete_notifications where athlete_id = current_setting('t.a')::uuid and type = 'TEAM_INVITATION' order by created_at desc limit 1),
  'Invitation à rejoindre une équipe');

-- ── E. Droits complets ───────────────────────────────────────────────────────
select pg_temp.verif('E1 ACL',
  (select string_agg(proname || '=' || array_to_string(array(select coalesce(nullif(split_part(x, '=', 1), ''), 'PUBLIC') from unnest(proacl::text[]) x order by 1), ','), ';' order by proname)
     from pg_proc where pronamespace = 'public'::regnamespace and proname in ('recruteurs_suivant_athlete', 'invitation_recruteurs_suivent')),
  'invitation_recruteurs_suivent=anon,authenticated,postgres,service_role;recruteurs_suivant_athlete=postgres,service_role');

select n, case when ok then 'OK' else 'ÉCHEC' end as verdict, test, detail from _res order by n;
select count(*) filter (where ok) as ok, count(*) filter (where not ok) as echecs from _res;
rollback;
