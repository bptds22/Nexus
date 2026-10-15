-- Invitations : coach nommé SEULEMENT s'il est du secondaire ou du civil (20261015125824), base LOCALE.
-- Une transaction ANNULÉE à la fin. Ce que les courriels REÇOIVENT est lu dans la file de pg_net
-- (faux secret posé dans le Vault DANS la transaction, jamais validée → rien ne part).
--   docker cp docs/invitations-coach-nomme/tests-coach-nomme.sql supabase_db_Nexus:/tmp/tests-cn.sql
--   docker exec -e PGCLIENTENCODING=UTF8 supabase_db_Nexus psql -U postgres -d postgres -q -f /tmp/tests-cn.sql
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

-- ── Coachs : secondaire, civil, collégial, indéterminé, mixte ────────────────
select set_config('t.cs', (select id::text from users where email = 'marc.desrosiers@exemple.test'), true);   -- SECONDAIRE
select set_config('t.cv', (select id::text from users where email = 'c1.coach@preuve.local'), true);          -- devient CIVIL
select set_config('t.cc', (select id::text from users where email = 'luc.arsenault@exemple.test'), true);     -- CEGEP
select set_config('t.ci', (select id::text from users where email = 'demo+coach02@nexussports.ca'), true);    -- sans école
select set_config('t.cm', (select id::text from users where email = 'kevin.nadeau@exemple.test'), true);      -- devient MIXTE
update users set school_id = (select id from schools where type = 'LIGUE_CIVILE' order by name limit 1)
 where id = current_setting('t.cv')::uuid;
insert into team_coaches (team_id, coach_id)
select (select t.id from teams t join schools s on s.id = t.school_id where s.type = 'CEGEP' order by t.name limit 1),
       current_setting('t.cm')::uuid;
select set_config('t.cs_nom', (select first_name || ' ' || last_name from users where id = current_setting('t.cs')::uuid), true);
select set_config('t.cs_ecole', (select s.name from users u join schools s on s.id = u.school_id where u.id = current_setting('t.cs')::uuid), true);
select set_config('t.cv_nom', (select first_name || ' ' || last_name from users where id = current_setting('t.cv')::uuid), true);
select set_config('t.cc_nom', (select first_name || ' ' || last_name from users where id = current_setting('t.cc')::uuid), true);
select set_config('t.cc_ecole', (select s.name from users u join schools s on s.id = u.school_id where u.id = current_setting('t.cc')::uuid), true);

-- ── A. La règle elle-même ───────────────────────────────────────────────────
select pg_temp.verif('A1 coach SECONDAIRE : nommé (nom et école)',
  public.coach_nommable(current_setting('t.cs')::uuid)::text,
  jsonb_build_object('nom', current_setting('t.cs_nom'), 'ecole', current_setting('t.cs_ecole'))::text);
select pg_temp.verif('A2 coach CIVIL : nommé',
  public.coach_nommable(current_setting('t.cv')::uuid)->>'nom', current_setting('t.cv_nom'));
select pg_temp.verif('A3 coach COLLÉGIAL : jamais nommé', public.coach_nommable(current_setting('t.cc')::uuid)::text, null);
select pg_temp.verif('A4 coach sans école (indéterminé) : jamais nommé', public.coach_nommable(current_setting('t.ci')::uuid)::text, null);
select pg_temp.verif('A5 coach secondaire qui entraîne AUSSI une équipe collégiale : jamais nommé',
  public.coach_nommable(current_setting('t.cm')::uuid)::text, null);
select pg_temp.verif('A6 un recruteur : jamais nommé',
  public.coach_nommable((select id from users where role = 'RECRUTEUR' limit 1))::text, null);
select pg_temp.verif('A7 compte inconnu : null', public.coach_nommable(gen_random_uuid())::text, null);

-- ── B. Courriel de réclamation : ce qui part, coach par coach ───────────────
select vault.create_secret('secret-de-test-banc', 'INVITE_NOTICE_SECRET');
select vault.create_secret('secret-de-test-banc-equipe', 'TEAM_INVITE_NOTICE_SECRET');
insert into athletes (id, first_name, last_name, date_naissance, coach_id, school_id, email, status, verified, annee_diplomation)
select ('e2000000-0000-4000-8000-00000000000' || k)::uuid, 'Banc', 'Coach' || k, '2007-02-02',
       current_setting('t.cs')::uuid, (select school_id from users where id = current_setting('t.cs')::uuid),
       'banc.coach' || k || '@exemple.test', 'ACTIF', false, 2025
  from generate_series(1, 5) k;
create function pg_temp.corps_reclamation(p_k int, p_coach text) returns jsonb language plpgsql as $$
declare v_avant bigint; v jsonb;
begin
  select coalesce(max(id), 0) into v_avant from net.http_request_queue;
  insert into athlete_invitations (token, athlete_id, created_by, email)
  values ('jeton-cn-' || p_k, ('e2000000-0000-4000-8000-00000000000' || p_k)::uuid, current_setting(p_coach)::uuid,
          'banc.coach' || p_k || '@exemple.test');
  select convert_from(body, 'UTF8')::jsonb into v from net.http_request_queue where id > v_avant order by id desc limit 1;
  return v;
end $$;
select set_config('t.b1', pg_temp.corps_reclamation(1, 't.cs')::text, true);
select set_config('t.b2', pg_temp.corps_reclamation(2, 't.cv')::text, true);
select set_config('t.b3', pg_temp.corps_reclamation(3, 't.cc')::text, true);
select set_config('t.b4', pg_temp.corps_reclamation(4, 't.ci')::text, true);
select set_config('t.b5', pg_temp.corps_reclamation(5, 't.cm')::text, true);
select pg_temp.verif('B1 coach secondaire : coach_name et coach_ecole transmis',
  (current_setting('t.b1')::jsonb->>'coach_name') || ' | ' || (current_setting('t.b1')::jsonb->>'coach_ecole'),
  current_setting('t.cs_nom') || ' | ' || current_setting('t.cs_ecole'));
select pg_temp.verif('B2 coach civil : coach_name transmis', current_setting('t.b2')::jsonb->>'coach_name', current_setting('t.cv_nom'));
select pg_temp.verif('B3 coach collégial : AUCUNE clé de coach',
  (select string_agg(k, ',' order by k) from jsonb_object_keys(current_setting('t.b3')::jsonb) k),
  'claim_token,email,invitation_id,nb_recruteurs');
select pg_temp.verif('B4 coach collégial : ni son nom ni son cégep nulle part dans ce qui part',
  (position(current_setting('t.cc_nom') in current_setting('t.b3')) = 0
   and position(current_setting('t.cc_ecole') in current_setting('t.b3')) = 0)::text, 'true');
select pg_temp.verif('B5 coach indéterminé : AUCUNE clé de coach',
  (select string_agg(k, ',' order by k) from jsonb_object_keys(current_setting('t.b4')::jsonb) k),
  'claim_token,email,invitation_id,nb_recruteurs');
select pg_temp.verif('B6 coach mixte (une équipe collégiale) : AUCUNE clé de coach',
  (current_setting('t.b5')::jsonb ? 'coach_name')::text, 'false');
select pg_temp.verif('B7 le nombre de recruteurs est toujours là (jamais lesquels)',
  (current_setting('t.b1')::jsonb ? 'nb_recruteurs' and current_setting('t.b3')::jsonb ? 'nb_recruteurs')::text, 'true');

-- ── C. /claim : par le jeton, seulement un jeton valide ─────────────────────
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select pg_temp.verif('C1 /claim, coach secondaire → nommé', public.invitation_coach_nomme('jeton-cn-1')->>'nom', current_setting('t.cs_nom'));
select pg_temp.verif('C2 /claim, coach civil → nommé', public.invitation_coach_nomme('jeton-cn-2')->>'nom', current_setting('t.cv_nom'));
select pg_temp.verif('C3 /claim, coach collégial → rien', public.invitation_coach_nomme('jeton-cn-3')::text, null);
select pg_temp.verif('C4 /claim, coach indéterminé → rien', public.invitation_coach_nomme('jeton-cn-4')::text, null);
select pg_temp.verif('C5 /claim, jeton inconnu → rien', public.invitation_coach_nomme('jeton-inconnu')::text, null);
do $$ begin
  perform public.coach_nommable(current_setting('t.cs')::uuid);
  insert into _res (test, ok, detail) values ('C6 anon n''interroge pas coach_nommable directement', false, 'appelé');
exception when insufficient_privilege then
  insert into _res (test, ok, detail) values ('C6 anon n''interroge pas coach_nommable directement', true, 'refusé');
end $$;
reset role;

-- ── D. Invitation d'équipe : courriel, notification, carte ──────────────────
select set_config('t.b', (select a.id::text from athletes a join users u on u.id = a.user_id
  where a.email is not null and not exists (select 1 from team_invitations ti where ti.athlete_id = a.id and ti.status = 'PENDING')
  order by a.created_at limit 1), true);
select set_config('t.b_user', (select user_id::text from athletes where id = current_setting('t.b')::uuid), true);
select set_config('t.eq_s', (select t.id::text from teams t join schools s on s.id = t.school_id where s.type = 'SECONDAIRE' and t.name <> '' order by t.name limit 1), true);
select set_config('t.eq_s2', (select t.id::text from teams t join schools s on s.id = t.school_id where s.type = 'SECONDAIRE' and t.name <> '' order by t.name offset 1 limit 1), true);
select set_config('t.eq_c', (select t.id::text from teams t join schools s on s.id = t.school_id where s.type = 'CEGEP' and t.name <> '' order by t.name limit 1), true);
create function pg_temp.corps_equipe(p_equipe text, p_coach text, p_jeton text) returns jsonb language plpgsql as $$
declare v_avant bigint; v jsonb;
begin
  select coalesce(max(id), 0) into v_avant from net.http_request_queue;
  insert into team_invitations (team_id, athlete_id, invited_by_coach_id, status, transfer_token, expires_at)
  values (current_setting(p_equipe)::uuid, current_setting('t.b')::uuid, current_setting(p_coach)::uuid, 'PENDING', p_jeton, now() + interval '14 days');
  select convert_from(body, 'UTF8')::jsonb into v from net.http_request_queue where id > v_avant order by id desc limit 1;
  return v;
end $$;
select set_config('t.d1', pg_temp.corps_equipe('t.eq_s', 't.cs', 'BANCCN1')::text, true);
select pg_temp.verif('D1 équipe secondaire + coach secondaire : coach_name transmis', current_setting('t.d1')::jsonb->>'coach_name', current_setting('t.cs_nom'));
select pg_temp.verif('D2 notification : « {Coach} t''invite à rejoindre {Équipe} »',
  (select title from athlete_notifications where type = 'TEAM_INVITATION' and metadata->>'invitation_id' = (select id::text from team_invitations where transfer_token = 'BANCCN1')),
  current_setting('t.cs_nom') || ' t''invite à rejoindre ' || (select btrim(name) from teams where id = current_setting('t.eq_s')::uuid));
select set_config('t.d3', pg_temp.corps_equipe('t.eq_s2', 't.cc', 'BANCCN2')::text, true);
select pg_temp.verif('D3 équipe secondaire, coach collégial : aucun coach_name', (current_setting('t.d3')::jsonb ? 'coach_name')::text, 'false');
select pg_temp.verif('D4 … et sa notification reste générique',
  (select title from athlete_notifications where type = 'TEAM_INVITATION' and metadata->>'invitation_id' = (select id::text from team_invitations where transfer_token = 'BANCCN2')),
  'Invitation à rejoindre une équipe');
select set_config('t.d5', pg_temp.corps_equipe('t.eq_c', 't.cs', 'BANCCN3')::text, true);
select pg_temp.verif('D5 équipe COLLÉGIALE (même coach secondaire) : ni coach, ni équipe, ni école',
  (current_setting('t.d5')::jsonb ? 'coach_name')::text || '|' || (current_setting('t.d5')::jsonb->>'team_name') || '|' || (current_setting('t.d5')::jsonb->>'school_name'), 'false||');
select pg_temp.verif('D6 … et sa notification reste générique',
  (select title from athlete_notifications where type = 'TEAM_INVITATION' and metadata->>'invitation_id' = (select id::text from team_invitations where transfer_token = 'BANCCN3')),
  'Invitation à rejoindre une équipe');
-- Carte « Invitations en attente » : le destinataire seulement
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.b_user'), 'role', 'authenticated')::text, true);
select pg_temp.verif('D7 carte (destinataire) : coach secondaire d''une équipe secondaire → nommé',
  public.invitation_equipe_coach((select id from team_invitations where transfer_token = 'BANCCN1'))->>'nom', current_setting('t.cs_nom'));
select pg_temp.verif('D8 carte : coach collégial → rien',
  public.invitation_equipe_coach((select id from team_invitations where transfer_token = 'BANCCN2'))::text, null);
select pg_temp.verif('D9 carte : équipe collégiale → rien',
  public.invitation_equipe_coach((select id from team_invitations where transfer_token = 'BANCCN3'))::text, null);
select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.cc'), 'role', 'authenticated')::text, true);
select pg_temp.verif('D10 carte : un AUTRE compte que le destinataire → rien',
  public.invitation_equipe_coach((select id from team_invitations where transfer_token = 'BANCCN1'))::text, null);
reset role;

-- ── E. Désinscription toujours respectée ────────────────────────────────────
insert into courriel_desabonnements (user_id, source) values (current_setting('t.b_user')::uuid, 'lien') on conflict do nothing;
update team_invitations set status = 'CANCELLED' where transfer_token = 'BANCCN1';
select pg_temp.verif('E1 compte désabonné : aucun courriel d''équipe, même avec un coach nommable',
  (select coalesce(pg_temp.corps_equipe('t.eq_s', 't.cs', 'BANCCN4')::text, 'rien')), 'rien');

-- ── F. Droits complets ──────────────────────────────────────────────────────
select pg_temp.verif('F1 ACL',
  (select string_agg(proname || '=' || array_to_string(array(select coalesce(nullif(split_part(x, '=', 1), ''), 'PUBLIC') from unnest(proacl::text[]) x order by 1), ','), ';' order by proname)
     from pg_proc where pronamespace = 'public'::regnamespace and proname in ('coach_nommable', 'invitation_coach_nomme', 'invitation_equipe_coach')),
  'coach_nommable=postgres,service_role;invitation_coach_nomme=anon,authenticated,postgres,service_role;invitation_equipe_coach=authenticated,postgres,service_role');

select n, case when ok then 'OK' else 'ÉCHEC' end as verdict, test, detail from _res order by n;
select count(*) filter (where ok) as ok, count(*) filter (where not ok) as echecs from _res;
rollback;
