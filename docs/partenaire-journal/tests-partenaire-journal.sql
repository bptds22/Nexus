-- Journal partenaire par fonction en base (20261016150000), base LOCALE. Une transaction ANNULÉE à la fin.
--   docker cp docs/partenaire-journal/tests-partenaire-journal.sql supabase_db_Nexus:/tmp/tests-pj.sql
--   docker exec -e PGCLIENTENCODING=UTF8 supabase_db_Nexus psql -U postgres -d postgres -q -At -f /tmp/tests-pj.sql
-- Fixtures locales : p1 APPROVED, p2 SUSPENDED, p3 REVOKED (docs/partenaires-w1), un coach, les athlètes
-- admissibles (is_partner_eligible_athlete) et un athlète qui ne l'est pas.
\set ON_ERROR_STOP 1
\pset footer off
\o /dev/null
begin;

create temp table _res (n serial, test text, ok boolean, detail text) on commit drop;
grant all on _res to authenticated, anon;
grant usage on sequence _res_n_seq to authenticated, anon;
create function pg_temp.verif(p_test text, p_obtenu text, p_attendu text) returns void language sql as $$
  insert into _res (test, ok, detail) values (p_test, p_obtenu is not distinct from p_attendu,
    coalesce(p_obtenu, 'NULL') || ' (attendu ' || coalesce(p_attendu, 'NULL') || ')')
$$;
-- Exécute une requête et rend 'OK:<valeur>' ou '<sqlstate>:<message>'.
create function pg_temp.essai(p_sql text) returns text language plpgsql as $$
declare v text;
begin
  execute p_sql into v;
  return 'OK:' || coalesce(v, 'NULL');
exception when others then
  return sqlstate || ':' || sqlerrm;
end $$;
grant execute on function pg_temp.essai(text) to authenticated, anon;
grant execute on function pg_temp.verif(text, text, text) to authenticated, anon;

select set_config('t.p1', (select user_id::text from media_partners mp join users u on u.id = mp.user_id where u.email = 'p1.partenaire@preuve.local'), true);
select set_config('t.p1_id', (select mp.id::text from media_partners mp join users u on u.id = mp.user_id where u.email = 'p1.partenaire@preuve.local'), true);
select set_config('t.p2', (select user_id::text from media_partners mp join users u on u.id = mp.user_id where u.email = 'p2.suspendu@preuve.local'), true);
select set_config('t.p3', (select user_id::text from media_partners mp join users u on u.id = mp.user_id where u.email = 'p3.revoque@preuve.local'), true);
select set_config('t.coach', (select id::text from users where role = 'COACH' order by email limit 1), true);
select set_config('t.ok', (select id::text from athletes a where public.is_partner_eligible_athlete(a.id) order by id limit 1), true);
select set_config('t.non', (select id::text from athletes a where not public.is_partner_eligible_athlete(a.id) order by id limit 1), true);
select set_config('t.vues0', (select count(*)::text from partner_profile_views), true);
select set_config('t.tele0', (select count(*)::text from partner_card_downloads), true);

select pg_temp.verif('F0 fixtures présentes (p1, p2, p3, coach, admissible, non admissible)',
  (current_setting('t.p1') <> '' and current_setting('t.p2') <> '' and current_setting('t.p3') <> ''
   and current_setting('t.coach') <> '' and current_setting('t.ok') <> '' and current_setting('t.non') <> '')::text, 'true');

-- ── A. Droits ────────────────────────────────────────────────────────────────
select pg_temp.verif('A1 ACL complète = {authenticated,postgres,service_role}',
  (select array_agg(t.g order by t.g)::text from pg_proc pr,
     lateral (select coalesce(nullif(split_part(x, '=', 1), ''), 'PUBLIC') as g from unnest(pr.proacl::text[]) x) t
    where pr.oid = 'public.partenaire_journaliser(uuid,text,text)'::regprocedure),
  '{authenticated,postgres,service_role}');
select pg_temp.verif('A2 SECURITY DEFINER, search_path et row_security posés',
  (select prosecdef::text || '|' || array_to_string(proconfig, ',') from pg_proc
    where oid = 'public.partenaire_journaliser(uuid,text,text)'::regprocedure),
  'true|search_path=public,row_security=off');

set local role anon;
select pg_temp.verif('A3 anon : exécution refusée',
  split_part(pg_temp.essai(format('select public.partenaire_journaliser(%L, %L)::text', current_setting('t.ok'), 'VUE')), ':', 1), '42501');
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{}', true);
select pg_temp.verif('A4 authenticated sans session (auth.uid() nul) : « non authentifié »',
  pg_temp.essai(format('select public.partenaire_journaliser(%L, %L)::text', current_setting('t.ok'), 'VUE')),
  '42501:NEXUS: non authentifié');

-- ── B. Partenaire APPROUVÉ : les deux journaux ───────────────────────────────
select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.p1'), 'role', 'authenticated')::text, true);
select pg_temp.verif('B1 VUE sur un athlète admissible : vrai',
  pg_temp.essai(format('select public.partenaire_journaliser(%L, %L)::text', current_setting('t.ok'), 'VUE')), 'OK:true');
select pg_temp.verif('B2 TELECHARGEMENT publication : vrai',
  pg_temp.essai(format('select public.partenaire_journaliser(%L, %L, %L)::text', current_setting('t.ok'), 'TELECHARGEMENT', 'publication')), 'OK:true');
select pg_temp.verif('B3 TELECHARGEMENT story : vrai',
  pg_temp.essai(format('select public.partenaire_journaliser(%L, %L, %L)::text', current_setting('t.ok'), 'TELECHARGEMENT', 'story')), 'OK:true');
-- Le partenaire relit son propre journal par la RLS existante (rien de neuf ouvert).
select pg_temp.verif('B4 RLS : le partenaire lit ses 2 téléchargements de cet athlète',
  (select count(*)::text from partner_card_downloads where athlete_id = current_setting('t.ok')::uuid
     and downloaded_at >= now() - interval '1 minute'), '2');
reset role;
select pg_temp.verif('B5 +1 vue, rattachée au partenaire de la SESSION',
  ((select count(*) from partner_profile_views) - current_setting('t.vues0')::int)::text || '|'
  || (select bool_and(partner_id = current_setting('t.p1_id')::uuid)::text from partner_profile_views
       where athlete_id = current_setting('t.ok')::uuid and viewed_at >= now() - interval '1 minute'), '1|true');
select pg_temp.verif('B6 +2 téléchargements, formats publication et story',
  (select string_agg(format, ',' order by format) from partner_card_downloads
    where partner_id = current_setting('t.p1_id')::uuid and downloaded_at >= now() - interval '1 minute'), 'publication,story');

-- ── C. Refus : rien n'est écrit ──────────────────────────────────────────────
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.p1'), 'role', 'authenticated')::text, true);
select pg_temp.verif('C1 athlète NON admissible : refusé',
  pg_temp.essai(format('select public.partenaire_journaliser(%L, %L)::text', current_setting('t.non'), 'VUE')),
  '42501:NEXUS: athlète non disponible');
select pg_temp.verif('C2 TELECHARGEMENT sans format : paramètres invalides',
  pg_temp.essai(format('select public.partenaire_journaliser(%L, %L)::text', current_setting('t.ok'), 'TELECHARGEMENT')),
  '22023:NEXUS: paramètres invalides');
select pg_temp.verif('C3 format inconnu : paramètres invalides',
  pg_temp.essai(format('select public.partenaire_journaliser(%L, %L, %L)::text', current_setting('t.ok'), 'TELECHARGEMENT', 'banniere')),
  '22023:NEXUS: paramètres invalides');
select pg_temp.verif('C4 VUE avec un format : paramètres invalides',
  pg_temp.essai(format('select public.partenaire_journaliser(%L, %L, %L)::text', current_setting('t.ok'), 'VUE', 'story')),
  '22023:NEXUS: paramètres invalides');
select pg_temp.verif('C5 action inconnue : paramètres invalides',
  pg_temp.essai(format('select public.partenaire_journaliser(%L, %L)::text', current_setting('t.ok'), 'vue')),
  '22023:NEXUS: paramètres invalides');
select pg_temp.verif('C6 athlète nul : paramètres invalides',
  pg_temp.essai('select public.partenaire_journaliser(null, ''VUE'')::text'),
  '22023:NEXUS: paramètres invalides');
select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.p2'), 'role', 'authenticated')::text, true);
select pg_temp.verif('C7 partenaire SUSPENDU : refusé',
  pg_temp.essai(format('select public.partenaire_journaliser(%L, %L)::text', current_setting('t.ok'), 'VUE')),
  '42501:NEXUS: accès refusé — partenaire non approuvé');
select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.p3'), 'role', 'authenticated')::text, true);
select pg_temp.verif('C8 partenaire RÉVOQUÉ : refusé',
  pg_temp.essai(format('select public.partenaire_journaliser(%L, %L, %L)::text', current_setting('t.ok'), 'TELECHARGEMENT', 'story')),
  '42501:NEXUS: accès refusé — partenaire non approuvé');
select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.coach'), 'role', 'authenticated')::text, true);
select pg_temp.verif('C9 un COACH : refusé (pas de fiche partenaire)',
  pg_temp.essai(format('select public.partenaire_journaliser(%L, %L)::text', current_setting('t.ok'), 'VUE')),
  '42501:NEXUS: accès refusé — partenaire non approuvé');
reset role;
select pg_temp.verif('C10 aucun refus n''a écrit (vues +1, téléchargements +2 depuis le début)',
  ((select count(*) from partner_profile_views) - current_setting('t.vues0')::int)::text || '|'
  || ((select count(*) from partner_card_downloads) - current_setting('t.tele0')::int)::text, '1|2');

-- ── D. Ce que la fonction ne touche pas ──────────────────────────────────────
select pg_temp.verif('D1 aucune policy ajoutée sur les deux journaux (7 au total, comme avant)',
  (select count(*)::text from pg_policy where polrelid in ('public.partner_profile_views'::regclass, 'public.partner_card_downloads'::regclass)), '7');

\o
select n, case when ok then 'ok' else 'ÉCHEC' end, test, detail from _res order by n;
select count(*) filter (where ok) || ' | ' || count(*) filter (where not ok) from _res;
rollback;
