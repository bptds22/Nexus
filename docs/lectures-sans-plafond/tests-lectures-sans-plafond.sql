-- BANC — migration 20261016080000_lectures_sans_plafond (fonctions « par identifiants » et cartes_par_ids).
-- Transaction ANNULÉE à la fin : données fictives seulement. Base locale migrée.
--   docker cp docs/lectures-sans-plafond/tests-lectures-sans-plafond.sql supabase_db_Nexus:/tmp/t.sql
--   docker exec -e PGCLIENTENCODING=UTF8 supabase_db_Nexus psql -U postgres -X -q -At -f /tmp/t.sql
-- Principe : pour CHAQUE compte local, chaque fonction rend EXACTEMENT ce que la RLS rend par une lecture directe
-- (les fonctions INVOKER ne font que déplacer les identifiants de l'adresse au corps ; cartes_par_ids, DEFINER,
-- reproduit la règle des cartes = processus_cartes). Plus : volume au-delà de 1000, carte fusionnée exclue,
-- clés de pagination uniques des fonctions d'unité (lireTout trie dessus), droits (anon refusé), tableau vide/NULL.
-- Dernière ligne : « ok|échecs ».
begin;

create temp table _t (n serial, nom text, ok boolean, detail text);
grant all on _t to authenticated;
grant usage, select on sequence _t_n_seq to authenticated;

-- ── Données fictives : 1500 cartes dans l'unité Lot1 × football, plus une fusionnée ─
set local session_replication_role = replica;
insert into public.cartes_prospect (unite_cegep_id, unite_sport_id, prenom, nom, etape, sport_athlete_id, cree_par, etape_le, derniere_activite)
select '11111111-0000-0000-0000-000000000001', '4b859bf1-5832-4258-897c-e094062926af', 'Banc' || g, 'ZZBANCLSP', 'IDENTIFIE',
       '4b859bf1-5832-4258-897c-e094062926af', '22222222-0000-0000-0000-00000000003a', now() - (g || ' minutes')::interval, now()
  from generate_series(1, 1500) g;
insert into public.cartes_prospect (unite_cegep_id, unite_sport_id, prenom, nom, etape, sport_athlete_id, fusionnee_le)
values ('11111111-0000-0000-0000-000000000001', '4b859bf1-5832-4258-897c-e094062926af', 'Fusionnee', 'ZZBANCLSPFUS', 'IDENTIFIE',
        '4b859bf1-5832-4258-897c-e094062926af', now());
set local session_replication_role = origin;

-- Tous les identifiants, relevés hors RLS : chaque compte les DEMANDE tous, la RLS décide de ce qu'il reçoit.
create temp table _ids as
select 'athletes' t, array_agg(id) ids from public.athletes
union all select 'athletes_de:team_athletes', array_agg(distinct athlete_id) from public.team_athletes
union all select 'athletes_de:recruiter_favorites', array_agg(distinct athlete_id) from public.recruiter_favorites
union all select 'athletes_de:recruiter_athlete_views', array_agg(distinct athlete_id) from public.recruiter_athlete_views
union all select 'athletes_de:conversations', array_agg(distinct athlete_id) from public.conversations
union all select 'athletes_de:athlete_suggestions', array_agg(distinct athlete_id) from public.athlete_suggestions
union all select 'athletes_de:recruiter_activity_log', array_agg(distinct athlete_id) from public.recruiter_activity_log
union all select 'teams', array_agg(id) from public.teams
union all select 'games', array_agg(id) from public.games
union all select 'cartes', array_agg(id) from public.cartes_prospect
union all select 'users', array_agg(id) from public.users
union all select 'schools', array_agg(id) from public.schools
union all select 'conversations', array_agg(id) from public.conversations;
grant select on _ids to authenticated;

-- ── 1. Équivalence fonction ⇔ RLS, pour chaque compte ────────────────────────
do $$
declare
  u record;
  f text; r text; fn int; rn int;
  ecarts int := 0; cas int := 0; non_vides int := 0; exemple text;
  ids_ath uuid[]; ids_teams uuid[]; ids_games uuid[]; ids_cartes uuid[]; ids_users uuid[]; ids_schools uuid[]; ids_conv uuid[];
  a_ta uuid[]; a_fav uuid[]; a_vue uuid[]; a_conv uuid[]; a_sug uuid[]; a_log uuid[];
  procedure_ok boolean;
begin
  select ids into ids_ath from _ids where t = 'athletes';
  select ids into ids_teams from _ids where t = 'teams';
  select ids into ids_games from _ids where t = 'games';
  select ids into ids_cartes from _ids where t = 'cartes';
  select ids into ids_users from _ids where t = 'users';
  select ids into ids_schools from _ids where t = 'schools';
  select ids into ids_conv from _ids where t = 'conversations';
  select ids into a_ta from _ids where t = 'athletes_de:team_athletes';
  select ids into a_fav from _ids where t = 'athletes_de:recruiter_favorites';
  select ids into a_vue from _ids where t = 'athletes_de:recruiter_athlete_views';
  select ids into a_conv from _ids where t = 'athletes_de:conversations';
  select ids into a_sug from _ids where t = 'athletes_de:athlete_suggestions';
  select ids into a_log from _ids where t = 'athletes_de:recruiter_activity_log';
  for u in select id, role::text as role from public.users order by id loop
    perform set_config('request.jwt.claims', json_build_object('sub', u.id, 'role', 'authenticated')::text, true);
    perform set_config('role', 'authenticated', true);
    for f, r, fn, rn in
      select 'athletes_par_ids', null, (select count(*) from public.athletes_par_ids(ids_ath)), (select count(*) from public.athletes)
      union all select 'team_athletes_par_athletes', null, (select count(*) from public.team_athletes_par_athletes(a_ta)), (select count(*) from public.team_athletes)
      union all select 'recruiter_favorites_par_athletes', null, (select count(*) from public.recruiter_favorites_par_athletes(a_fav)), (select count(*) from public.recruiter_favorites)
      union all select 'recruiter_athlete_views_par_athletes', null, (select count(*) from public.recruiter_athlete_views_par_athletes(a_vue)), (select count(*) from public.recruiter_athlete_views)
      union all select 'conversations_par_athletes', null, (select count(*) from public.conversations_par_athletes(a_conv)), (select count(*) from public.conversations where athlete_id is not null)
      union all select 'athlete_suggestions_par_athletes', null, (select count(*) from public.athlete_suggestions_par_athletes(a_sug)), (select count(*) from public.athlete_suggestions where athlete_id is not null)
      union all select 'recruiter_activity_log_par_athletes', null, (select count(*) from public.recruiter_activity_log_par_athletes(a_log)), (select count(*) from public.recruiter_activity_log where athlete_id is not null)
      union all select 'teams_par_ids', null, (select count(*) from public.teams_par_ids(ids_teams)), (select count(*) from public.teams)
      union all select 'games_par_ids', null, (select count(*) from public.games_par_ids(ids_games)), (select count(*) from public.games)
      union all select 'games_des_equipes', null,
             (select count(*) from public.games_des_equipes(ids_teams, current_date)),
             (select count(*) from public.games g where g.game_date >= current_date
                 and (g.home_team_id = any(ids_teams) or g.visitor_team_id = any(ids_teams)))
      union all select 'users_par_ids', null, (select count(*) from public.users_par_ids(ids_users)), (select count(*) from public.users)
      union all select 'schools_par_ids', null, (select count(*) from public.schools_par_ids(ids_schools)), (select count(*) from public.schools)
      union all select 'messages_par_conversations', null, (select count(*) from public.messages_par_conversations(ids_conv)), (select count(*) from public.messages where conversation_id is not null)
      union all select 'team_athletes_par_equipes', null, (select count(*) from public.team_athletes_par_equipes(ids_teams)), (select count(*) from public.team_athletes)
      union all select 'team_coaches_par_equipes', null, (select count(*) from public.team_coaches_par_equipes(ids_teams)), (select count(*) from public.team_coaches)
    loop
      cas := cas + 1;
      if fn > 0 then non_vides := non_vides + 1; end if;
      if fn <> rn then
        ecarts := ecarts + 1;
        exemple := coalesce(exemple, u.role || ' ' || u.id || ' ' || f || ' ' || fn || '/' || rn);
      end if;
    end loop;
    -- Le CONTENU, pas seulement le nombre : athlètes et matchs (les deux plus utilisés), md5 des lignes entières.
    select md5(coalesce(string_agg(x::text, ',' order by x.id), '')) into f from public.athletes_par_ids(ids_ath) x;
    select md5(coalesce(string_agg(x::text, ',' order by x.id), '')) into r from public.athletes x;
    cas := cas + 1; if f <> r then ecarts := ecarts + 1; exemple := coalesce(exemple, u.id || ' contenu athletes'); end if;
    select md5(coalesce(string_agg(x::text, ',' order by x.id), '')) into f from public.games_des_equipes(ids_teams, current_date) x;
    select md5(coalesce(string_agg(x::text, ',' order by x.id), '')) into r from public.games x
     where x.game_date >= current_date and (x.home_team_id = any(ids_teams) or x.visitor_team_id = any(ids_teams));
    cas := cas + 1; if f <> r then ecarts := ecarts + 1; exemple := coalesce(exemple, u.id || ' contenu games'); end if;
    -- cartes_par_ids : mêmes cartes que la RLS (lecture directe), même format que processus_cartes.
    select md5(coalesce(string_agg(e->>'id', ',' order by e->>'id'), '')), count(*) into f, fn
      from jsonb_array_elements(public.cartes_par_ids(ids_cartes)) e;
    select md5(coalesce(string_agg(c.id::text, ',' order by c.id::text), '')), count(*) into r, rn from public.cartes_prospect c;
    cas := cas + 1;
    if fn > 0 then non_vides := non_vides + 1; end if;
    if f <> r or fn <> rn then ecarts := ecarts + 1; exemple := coalesce(exemple, u.role || ' ' || u.id || ' cartes ' || fn || '/' || rn); end if;
    select md5(coalesce(string_agg(e::text, ',' order by e->>'id'), '')) into f from jsonb_array_elements(public.cartes_par_ids(ids_cartes)) e;
    select md5(coalesce(string_agg(e::text, ',' order by e->>'id'), '')) into r from jsonb_array_elements(public.processus_cartes(null, null, false)) e;
    cas := cas + 1; if f <> r then ecarts := ecarts + 1; exemple := coalesce(exemple, u.id || ' format cartes ≠ processus_cartes'); end if;
    -- Clés de pagination (lireTout) : une ligne par athlète × unité dans les fonctions d'unité.
    select count(*) = count(distinct (athlete_id, unite_cegep_id, unite_sport_id)) into procedure_ok from public.unite_pipeline(null, true);
    cas := cas + 1; if not procedure_ok then ecarts := ecarts + 1; exemple := coalesce(exemple, u.id || ' clé unite_pipeline'); end if;
    select count(*) = count(distinct (athlete_id, unite_cegep_id, unite_sport_id)) into procedure_ok from public.unite_favoris(null, true);
    cas := cas + 1; if not procedure_ok then ecarts := ecarts + 1; exemple := coalesce(exemple, u.id || ' clé unite_favoris'); end if;
    select count(*) = count(distinct (athlete_id, unite_cegep_id, unite_sport_id)) into procedure_ok from public.unite_grades(null, true);
    cas := cas + 1; if not procedure_ok then ecarts := ecarts + 1; exemple := coalesce(exemple, u.id || ' clé unite_grades'); end if;
    perform set_config('role', 'none', true);
  end loop;
  insert into _t (nom, ok, detail) values
    ('équivalence fonction = RLS, chaque compte local (' || (select count(*) from public.users) || ' comptes)', ecarts = 0,
     cas || ' cas, ' || ecarts || ' écart(s), ' || non_vides || ' non vides' || coalesce(' — ex. ' || exemple, '')),
    ('le banc voit des données (au moins un compte lit des cartes et des lignes)', non_vides > 0, non_vides || ' cas non vides');
end $$;
reset role;

-- ── 2. Volume au-delà de 1000, fusionnée exclue (recruteur admin du cégep Lot1) ─
do $$
declare v_n int; v_fus int; v_ids uuid[];
begin
  select array_agg(id) into v_ids from public.cartes_prospect where nom in ('ZZBANCLSP', 'ZZBANCLSPFUS');
  perform set_config('request.jwt.claims', json_build_object('sub', '22222222-0000-0000-0000-00000000000a', 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  select count(*) filter (where e->>'nom' = 'ZZBANCLSP'), count(*) filter (where e->>'nom' = 'ZZBANCLSPFUS')
    into v_n, v_fus from jsonb_array_elements(public.cartes_par_ids(v_ids)) e;
  perform set_config('role', 'none', true);
  insert into _t (nom, ok, detail) values
    ('cartes_par_ids : 1500 cartes en une valeur (ni plafond ni troncature)', v_n = 1500, v_n || ' / 1500'),
    ('cartes_par_ids : la carte fusionnée ne sort jamais', v_fus = 0, v_fus || ' fusionnée(s)');
end $$;
reset role;

-- ── 3. Tableau vide ou NULL : rien, sans erreur ─────────────────────────────
insert into _t (nom, ok, detail)
select 'tableau vide / NULL : aucune ligne, aucune erreur',
       (select count(*) from public.athletes_par_ids(null)) = 0 and (select count(*) from public.teams_par_ids('{}')) = 0
       and (select count(*) from public.games_des_equipes(null, current_date)) = 0
       and public.cartes_par_ids(null) = '[]'::jsonb and public.cartes_par_ids('{}') = '[]'::jsonb, '';

-- ── 4. Droits : authenticated seulement ─────────────────────────────────────
insert into _t (nom, ok, detail)
select 'droits : anon refusé, authenticated permis, sur les 16 fonctions',
       bool_and(not has_function_privilege('anon', p.oid, 'execute') and has_function_privilege('authenticated', p.oid, 'execute')),
       count(*) || ' fonctions'
  from pg_proc p
 where p.pronamespace = 'public'::regnamespace and p.proname in (
       'athletes_par_ids', 'team_athletes_par_athletes', 'recruiter_favorites_par_athletes',
       'recruiter_athlete_views_par_athletes', 'conversations_par_athletes', 'athlete_suggestions_par_athletes',
       'recruiter_activity_log_par_athletes', 'teams_par_ids', 'games_par_ids', 'games_des_equipes', 'cartes_par_ids',
       'users_par_ids', 'schools_par_ids', 'messages_par_conversations', 'team_athletes_par_equipes', 'team_coaches_par_equipes');
insert into _t (nom, ok, detail)
select 'sécurité : seule cartes_par_ids est DEFINER (row_security off) ; les 15 autres INVOKER',
       count(*) filter (where p.prosecdef) = 1 and bool_or(p.prosecdef and p.proname = 'cartes_par_ids'), count(*) || ' fonctions'
  from pg_proc p
 where p.pronamespace = 'public'::regnamespace and p.proname in (
       'athletes_par_ids', 'team_athletes_par_athletes', 'recruiter_favorites_par_athletes',
       'recruiter_athlete_views_par_athletes', 'conversations_par_athletes', 'athlete_suggestions_par_athletes',
       'recruiter_activity_log_par_athletes', 'teams_par_ids', 'games_par_ids', 'games_des_equipes', 'cartes_par_ids',
       'users_par_ids', 'schools_par_ids', 'messages_par_conversations', 'team_athletes_par_equipes', 'team_coaches_par_equipes');

select n || '|' || case when ok then 'OK' else 'ÉCHEC' end || '|' || nom || coalesce(' — ' || nullif(detail, ''), '') from _t order by n;
select count(*) filter (where ok) || '|' || count(*) filter (where not ok) from _t;

rollback;
