-- ════════════════════════════════════════════════════════════════════════════
-- Lot D1b cégep — @@TITRE@@
-- Les @@N_ECOLES@@ universités U SPORTS hors Québec (OUA, AUS, Canada West ; type UNIVERSITE, avec leur province) et
-- leurs @@N_EQUIPES@@ équipes des sports d'équipe de la saison 2026-2027 (sources : U SPORTS et sites des conférences,
-- citées dans scripts/cegep-lot-d/d1b-universites.json, empreinte @@MD5_DONNEES@@).
-- Fichier GÉNÉRÉ par scripts/cegep-lot-d/generer-d1b.mjs <date> <rejeu-blanc|apply|rollback>. Lancer SANS -1, en postgres.
--
-- Opération de DONNÉES (aucun objet de schéma). Préalables : D0, D1a, D1a2, D1 (12 universités du Québec) en prod.
-- Hors RSEQ : pas d'identifiant RSEQ ; chaque école et chaque équipe reçoit un identifiant STABLE calculé à partir de
-- son nom (clé « cle »), pour que le rejeu, l'apply et le rollback désignent les mêmes lignes. Aucun match relié.
-- Aucune fiche athlète, aucun compte, aucun classement touché.
-- @@SUITE@@
-- ════════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP 1
\pset pager off
\pset null '·'

begin;
set local lock_timeout = '3s';
set local statement_timeout = '120s';
set local search_path = public, extensions;
set local application_name = 'nexus-@@MODE@@-cegep-d1b';
select now() as debut, current_user;

create temp table _ecoles (cle uuid primary key, name text not null, team_name text, city text, province text not null,
                           region text, langue text, website text) on commit drop;
insert into _ecoles values
@@ECOLES@@;
create temp table _equipes (cle uuid primary key, cle_ecole uuid not null, nom text not null,
                            sport text not null, gender text, division text, ligue text not null) on commit drop;
insert into _equipes values
@@EQUIPES@@;

-- ── GARDES D'AVANT ───────────────────────────────────────────────────────────
do $$
begin
  if current_user <> 'postgres' then
    raise exception 'NEXUS: lancer en postgres, pas en %', current_user;
  end if;
  if (select count(*) from _ecoles) <> @@N_ECOLES@@ or (select count(*) from _equipes) <> @@N_EQUIPES@@ then
    raise exception 'NEXUS: données embarquées incomplètes';
  end if;
  if not exists (select 1 from supabase_migrations.schema_migrations where version = '20261028000000')
     or to_regprocedure('public.verrou_universites()') is null then
    raise exception 'NEXUS: préalable D0 (20261028000000) absent';
  end if;
  if (select count(*) from pg_policies where policyname = 'universites_masquees' and permissive = 'RESTRICTIVE'
         and cmd = 'SELECT' and tablename in ('schools', 'teams')) <> 2 then
    raise exception 'NEXUS: préalable D1a (universités masquées) absent — rien ne doit être importé avant';
  end if;
-- [[GARDE_D1A2
  if to_regprocedure('public.ids_universites()') is not null
     or to_regprocedure('nexus_prive.ids_universites()') is null
     or to_regprocedure('public.verrou_reference_universite()') is null then
    raise exception 'NEXUS: préalable D1a2 (fonctions DEFINER fermées) absent — rien ne doit être importé avant';
  end if;
-- GARDE_D1A2]]
  if (select count(*) from public.schools where type = 'UNIVERSITE') <> 12
     or not exists (select 1 from public.admin_operations where operation = 'CEGEP_LOT_D1_UNIVERSITES') then
    raise exception 'NEXUS: préalable D1 (12 universités du Québec) absent ou autre état';
  end if;
  if exists (select 1 from public.schools s join _ecoles e on e.cle = s.id or lower(e.name) = lower(s.name)) then
    raise exception 'NEXUS: une des universités existe déjà (identifiant ou nom)';
  end if;
  if exists (select 1 from public.teams t join _equipes q on q.cle = t.id) then
    raise exception 'NEXUS: une des équipes universitaires existe déjà';
  end if;
  if exists (select 1 from _ecoles where province = 'QC' or province is null) then
    raise exception 'NEXUS: une université du lot est au Québec ou sans province';
  end if;
  if exists (select 1 from _equipes q left join public.sports s on s.nom = q.sport where s.id is null) then
    raise exception 'NEXUS: un sport des équipes est absent du catalogue Nexus';
  end if;
  if exists (select 1 from _equipes q left join _ecoles e on e.cle = q.cle_ecole where e.name is null) then
    raise exception 'NEXUS: une équipe pointe hors des universités du lot';
  end if;
  if exists (select 1 from public.admin_operations where operation in ('CEGEP_LOT_D1B_UNIVERSITES_CANADA', 'CEGEP_LOT_D1B_UNIVERSITES_CANADA_RETIREES')) then
    raise exception 'NEXUS: le lot D1b a déjà laissé une trace dans admin_operations';
  end if;
end $$;

-- ── Empreinte (hors lignes créées) ───────────────────────────────────────────
create function pg_temp.empreinte() returns table (objet text, n bigint, md5 text) language sql as $$
  select 'schools (hors lot)', count(*), md5(coalesce(string_agg(id::text || type || name, ',' order by id), '')) from public.schools s where not exists (select 1 from _ecoles e where e.cle = s.id)
  union all
  select 'teams (hors lot)', count(*), md5(coalesce(string_agg(id::text || school_id::text || name, ',' order by id), ''))
    from public.teams t where not exists (select 1 from _equipes q where q.cle = t.id)
  union all
  select 'athletes', count(*), md5(coalesce(string_agg(id::text || coalesce(school_id::text, '·'), ',' order by id), '')) from public.athletes
  union all
  select 'users', count(*), md5(coalesce(string_agg(id::text || coalesce(school_id::text, '·') || coalesce(context, '·'), ',' order by id), '')) from public.users
  union all
  select 'team_athletes', count(*), md5(coalesce(string_agg(id::text || team_id::text, ',' order by id), '')) from public.team_athletes
  union all
  select 'games (côtés hors univ.)', count(*), md5(coalesce(string_agg(id::text || coalesce(home_team_id::text, '·') || coalesce(visitor_team_id::text, '·'), ',' order by id), ''))
    from public.games g;
$$;
create temp table _emp_avant on commit drop as select * from pg_temp.empreinte();
select 'AVANT' as moment, * from _emp_avant order by objet;

-- Hors RSEQ : aucun match à relier (aucun identifiant RSEQ).
create temp table _cotes on commit drop as select 0::bigint as domicile, 0::bigint as visiteur;

-- ── Banc des fonctions SECURITY DEFINER et des vues propriétaire ─────────────
-- Toute fonction qu'un client peut appeler (/rpc) et qui lit écoles ou équipes est appelée avec les claims
-- d'un vrai compte de chaque rôle non admin (ce que PostgREST pose depuis le jeton : request.jwt.claims +
-- rôle authenticated / anon), AVANT puis APRÈS la création, chaque appel défait aussitôt. Les arguments
-- d'identifiant reçoivent ceux des universités (pire cas : un client qui les connaîtrait). FUITE = un
-- identifiant d'université ou d'équipe universitaire dans la réponse, ou plus de noms universitaires
-- qu'avant la création. Les fonctions booléennes ou réservées à l'admin sont classées dans D1-AUDIT-DEFINER.md.
set local statement_timeout = '600s';
create temp table _banc_roles on commit drop as
select 1 as o, 'athlète' as role, (select u.id from public.users u join public.athletes a on a.user_id = u.id
         where u.role = 'ATHLETE'::public.user_role and exists (select 1 from public.team_athletes ta where ta.athlete_id = a.id)
         order by u.id limit 1) as uid
union all select 2, 'parent', (select u.id from public.users u where u.role = 'PARENT'::public.user_role order by u.id limit 1)
union all select 3, 'coach', (select u.id from public.users u where u.role = 'COACH'::public.user_role
         and exists (select 1 from public.team_coaches tc where tc.coach_id = u.id) order by u.id limit 1)
union all select 4, 'recruteur collégial', coalesce(
         (select c.cree_par from public.cartes_prospect c join public.users u on u.id = c.cree_par
           where u.role = 'RECRUTEUR'::public.user_role and c.fusionnee_le is null order by c.created_at desc, c.id limit 1),
         (select u.id from public.users u where u.role = 'RECRUTEUR'::public.user_role and u.onboarding_complete order by u.id limit 1))
union all select 5, 'partenaire', (select mp.user_id from public.media_partners mp join public.users u on u.id = mp.user_id
         where u.role = 'PARTNER'::public.user_role
         order by exists (select 1 from _equipes q join public.sports s on s.nom = q.sport
                           where public.partenaire_peut_evaluer(mp.id, s.id)) desc,
                  (select count(*) from public.partenaire_prospects pp where pp.partner_id = mp.id) desc, mp.user_id limit 1)
union all select 6, 'anon (site public)', null::uuid;
do $$
begin
  if exists (select 1 from _banc_roles where uid is null and role not like 'anon%') then
    raise exception 'NEXUS: banc — un compte témoin manque';
  end if;
end $$;

-- Arguments, lus en postgres AVANT de changer de rôle. Avant la création, les ids universitaires sont factices.
create function pg_temp.ctx() returns jsonb language sql as $$
  with mp as (select mp.id from public.media_partners mp where mp.user_id = (select uid from _banc_roles where o = 5)),
       ut as (select t.id, t.sport_id from public.teams t join _equipes q on q.cle = t.id)
  select jsonb_build_object(
    'U',   coalesce((select s.id from public.schools s where s.type = 'UNIVERSITE' order by s.name limit 1), '00000000-0000-4000-8000-0000000000d1'),
    'UA',  coalesce((select array_agg(s.id) from public.schools s where s.type = 'UNIVERSITE'), '{}'),
    'T',   coalesce((select id from ut order by id limit 1), '00000000-0000-4000-8000-0000000000d2'),
    'TA',  coalesce((select array_agg(id) from ut), '{}'),
    'TP',  coalesce((select ut.id from ut, mp where public.partenaire_peut_evaluer(mp.id, ut.sport_id) order by ut.id limit 1),
                    (select id from ut order by id limit 1), '00000000-0000-4000-8000-0000000000d2'),
    'TPS', coalesce((select ut.sport_id from ut, mp where public.partenaire_peut_evaluer(mp.id, ut.sport_id) order by ut.id limit 1),
                    (select sport_id from ut order by id limit 1), (select sport_id from public.teams order by id limit 1)),
    'ATH', (select array_agg(id) from (select a.id from public.athletes a order by a.id limit 200) x),
    'A1',  (select a.id from public.athletes a order by a.id limit 1),
    'CP',  coalesce((select array_agg(id) from (select c.id from public.cartes_prospect c order by c.id limit 300) x), '{}'),
    'G',   (select g.id from public.games g where g.game_date >= current_date order by g.game_date, g.id limit 1),
    'CEG', coalesce((select c.unite_cegep_id from public.cartes_prospect c where c.cree_par = (select uid from _banc_roles where o = 4)
                      and c.fusionnee_le is null order by c.created_at desc, c.id limit 1),
                    (select u.school_id from public.users u where u.id = (select uid from _banc_roles where o = 4))),
    'CR',  (select c.id from public.cartes_prospect c where c.cree_par = (select uid from _banc_roles where o = 4)
             and c.fusionnee_le is null order by c.created_at desc, c.id limit 1),
    'TC',  coalesce((select ut.id from ut where ut.sport_id = (select c.unite_sport_id from public.cartes_prospect c
                       where c.cree_par = (select uid from _banc_roles where o = 4) and c.fusionnee_le is null
                       order by c.created_at desc, c.id limit 1) order by ut.id limit 1),
                    (select id from ut order by id limit 1), '00000000-0000-4000-8000-0000000000d2'),
    'INV', (select ti.id from public.team_invitations ti order by ti.created_at desc limit 1));
$$;
create function pg_temp.remplir(p_tpl text, c jsonb) returns text language plpgsql as $$
declare k text; v text;
begin
  foreach k in array array['UA', 'TA', 'TPS', 'TP', 'ATH', 'A1', 'CP', 'CEG', 'CR', 'TC', 'INV', 'U', 'T', 'G'] loop
    v := case when jsonb_typeof(c -> k) = 'array'
              then quote_literal(coalesce((select '{' || string_agg(x, ',') || '}' from jsonb_array_elements_text(c -> k) x), '{}')) || '::uuid[]'
              when c ->> k is null then 'null::uuid'
              else quote_literal(c ->> k) || '::uuid' end;
    p_tpl := replace(p_tpl, '{' || k || '}', v);
  end loop;
  return p_tpl;
end $$;

create temp table _appels (n int primary key, objet text not null, appel text not null) on commit drop;
insert into _appels values
  (1,  'admin_cegeps_sans_programme()',            'select jsonb_agg(x)::text from public.admin_cegeps_sans_programme() x'),
  (2,  'athletes_nom_proche(…, université)',       'select jsonb_agg(x)::text from public.athletes_nom_proche(''Jean'', ''Tremblay'', {U}) x'),
  (3,  'cartes_par_ids(300 cartes)',               'select public.cartes_par_ids({CP})::text'),
  (4,  'coachs_nommables_equipe(équipe univ.)',    'select jsonb_agg(x)::text from public.coachs_nommables_equipe({T}) x'),
  (5,  'depistage_profils_match(prochain match)',  'select jsonb_agg(x)::text from public.depistage_profils_match({G}) x'),
  (6,  'get_my_children()',                        'select jsonb_agg(x)::text from public.get_my_children() x'),
  (7,  'ids_universites() — /rpc public',          'select public.ids_universites()::text'),
  (8,  'invitation_equipe_coach(dernière)',        'select public.invitation_equipe_coach({INV})::text'),
  (9,  'list_interested_recruiters()',             'select jsonb_agg(x)::text from public.list_interested_recruiters() x'),
  (10, 'list_team_commits(équipe univ.)',          'select jsonb_agg(x)::text from public.list_team_commits({T}) x'),
  (11, 'lookup_civil_unclaimed_by_email(''a'')',   'select jsonb_agg(x)::text from public.lookup_civil_unclaimed_by_email(''a'') x'),
  (12, 'matchs_recherche(31 jours)',                'select jsonb_agg(x)::text from public.matchs_recherche(current_date, current_date + 30) x'),
  (13, 'matchs_recherche(équipes univ.)',          'select jsonb_agg(x)::text from public.matchs_recherche(current_date - 200, current_date + 200, null, null, null, {TA}) x'),
  (14, 'matchs_recherche(texte « laval »)',        'select jsonb_agg(x)::text from public.matchs_recherche(current_date, current_date + 30, null, null, ''laval'') x'),
  (15, 'matchs_suggestions(« laval »)',            'select jsonb_agg(x)::text from public.matchs_suggestions(''laval'') x'),
  (16, 'matchs_suggestions(« université »)',       'select jsonb_agg(x)::text from public.matchs_suggestions(''université'') x'),
  (17, 'matchs_suggestions(« rouge et or »)',      'select jsonb_agg(x)::text from public.matchs_suggestions(''rouge et or'') x'),
  (18, 'matchs_suggestions(« carabins »)',         'select jsonb_agg(x)::text from public.matchs_suggestions(''carabins'') x'),
  (19, 'partenaire_depistage_cartes(univ., équipes univ.)', 'select jsonb_agg(x)::text from public.partenaire_depistage_cartes({UA}, {TA}) x'),
  (20, 'partenaire_mes_athletes()',                'select jsonb_agg(x)::text from public.partenaire_mes_athletes() x'),
  (21, 'partenaire_prospects_terminees()',         'select jsonb_agg(x)::text from public.partenaire_prospects_terminees() x'),
  (22, 'partenaire_rapprochements()',              'select jsonb_agg(x)::text from public.partenaire_rapprochements() x'),
  (23, 'partenaire_rapprochements_refuses()',      'select jsonb_agg(x)::text from public.partenaire_rapprochements_refuses() x'),
  (24, 'partner_athlete_profile(une fiche)',       'select jsonb_agg(x)::text from public.partner_athlete_profile({A1}) x'),
  (25, 'partner_newsroom_events()',                'select jsonb_agg(x)::text from public.partner_newsroom_events() x'),
  (26, 'processus_cartes(université)',             'select public.processus_cartes({U}, null, true)::text'),
  (27, 'processus_cartes(son cégep)',              'select public.processus_cartes({CEG}, null, true)::text'),
  (28, 'rapprochements_refuses_unite()',           'select jsonb_agg(x)::text from public.rapprochements_refuses_unite() x'),
  (29, 'rapprochements_unite()',                   'select jsonb_agg(x)::text from public.rapprochements_unite() x'),
  (30, 'recruiter_athlete_cards(200 fiches)',      'select jsonb_agg(x)::text from public.recruiter_athlete_cards({ATH}) x'),
  (31, 'recruiter_athlete_profile(une fiche)',     'select jsonb_agg(x)::text from public.recruiter_athlete_profile({A1}) x'),
  (32, 'recruiter_search_athletes()',              'select jsonb_agg(x)::text from public.recruiter_search_athletes() x'),
  (33, 'recruiter_search_athletes(« laval »)',     'select jsonb_agg(x)::text from public.recruiter_search_athletes(''laval'') x'),
  (34, 'team_record_hint(équipe univ.)',           'select public.team_record_hint({T})'),
  (35, 'vue top_athletes_view',                    'select jsonb_agg(v)::text from (select * from public.top_athletes_view limit 1000) v'),
  (36, 'vue trending_athletes_view',               'select jsonb_agg(v)::text from (select * from public.trending_athletes_view limit 1000) v');

-- Rend « ok <ids univ.> <noms univ.> », « refusé <sqlstate> », « absente » (fonction retirée de l'API) ou « ERREUR ».
create function pg_temp.appel(p_role text, p_uid uuid, p_sql text, p_ids text[], p_noms text[]) returns text
language plpgsql as $$
declare v text; n_id int; n_nom int;
begin
  begin
    if p_uid is null then
      perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
      perform set_config('role', 'anon', true);
    else
      perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
    end if;
    execute p_sql into v;
    v := lower(coalesce(v, ''));
    select count(*) into n_id from unnest(p_ids) m where strpos(v, m) > 0;
    -- Occurrences (pas seulement présence) : un nom déjà présent avant la création ne masque pas un ajout.
    select coalesce(sum((length(v) - length(replace(v, m, ''))) / length(m)), 0) into n_nom from unnest(p_noms) m;
    raise exception using errcode = 'NX000', message = 'ok ' || n_id || ' ' || n_nom;
  exception
    when sqlstate 'NX000' then return sqlerrm;
    when undefined_function then return 'absente';
    when insufficient_privilege then return 'refusé 42501';
    when others then
      if sqlerrm like 'NEXUS%' then return 'refusé ' || sqlstate; end if;
      return 'ERREUR ' || sqlstate || ' ' || left(sqlerrm, 70);
  end;
end $$;
create temp table _banc (moment text, o int, role text, n int, resultat text) on commit drop;
create function pg_temp.banc(p_moment text) returns void language plpgsql as $$
declare c jsonb := pg_temp.ctx(); r record; a record;
        v_ids text[]; v_noms text[];
begin
  select coalesce(array_agg(x), '{}') into v_ids from (
    select s.id::text as x from public.schools s where s.type = 'UNIVERSITE'
    union select t.id::text from public.teams t join _equipes q on q.cle = t.id) z;
  select coalesce(array_agg(distinct x), '{}') into v_noms from (
    select lower(name) as x from _ecoles union select lower(team_name) from _ecoles union select lower(nom) from _equipes) z
   where length(x) >= 5;
  for r in select * from _banc_roles order by o loop
    for a in select * from _appels order by n loop
      insert into _banc values (p_moment, r.o, r.role, a.n, pg_temp.appel(r.role, r.uid, pg_temp.remplir(a.appel, c), v_ids, v_noms));
    end loop;
  end loop;
end $$;
select pg_temp.banc('avant');

-- ── Création ─────────────────────────────────────────────────────────────────
insert into public.schools (id, name, type, province, team_name, city, region, langue, website)
select cle, name, 'UNIVERSITE', province, team_name, city, region, langue, website from _ecoles;

insert into public.teams (id, school_id, sport_id, name, division, league, season, is_active, age_group, gender)
select q.cle, q.cle_ecole, sp.id, q.nom, q.division, q.ligue || ' (2026-2027)', '2026-2027', true, 'Universitaire', q.gender
  from _equipes q
  join public.sports sp on sp.nom = q.sport;

-- ── Ce qui a été créé (par université) ───────────────────────────────────────
select s.province, s.name as universite, s.team_name as programme, s.city as ville, count(t.id) as equipes,
       string_agg(sp.nom || ' ' || left(coalesce(t.gender, '?'), 1) || coalesce(' ' || t.division, ''), ', ' order by sp.nom, t.gender) as detail
  from public.schools s
  left join public.teams t on t.school_id = s.id
  left join public.sports sp on sp.id = t.sport_id
 where s.id in (select cle from _ecoles)
 group by s.province, s.name, s.team_name, s.city order by s.province, s.name;

create temp table _emp_apres on commit drop as select * from pg_temp.empreinte();
select 'APRÈS' as moment, a.objet, a.n, a.md5, case when a.n = b.n and a.md5 = b.md5 then '=' else 'CHANGE' end as vs_avant
  from _emp_apres a join _emp_avant b using (objet) order by objet;

-- Le verrou D0 tient sur les nouvelles lignes (essai défait aussitôt).
create function pg_temp.essai(p_sql text) returns text language plpgsql as $$
begin
  begin
    execute p_sql;
    raise exception using errcode = 'NX000', message = 'accepté';
  exception
    when sqlstate 'NX000' then return 'accepté';
    when others then return 'REFUSÉ ' || sqlstate || case when sqlerrm like 'NEXUS%' then ' ' || left(sqlerrm, 60) else '' end;
  end;
end $$;
create temp table _verrou on commit drop as
select 'fiche athlète → une université du lot' as essai,
       pg_temp.essai(format('update public.athletes set school_id = %L where id = %L',
         (select cle from _ecoles order by name limit 1),
         (select id from public.athletes order by id limit 1))) as resultat
union all
select 'fiche athlète → une équipe universitaire',
       pg_temp.essai(format('insert into public.team_athletes (team_id, athlete_id, sport_id) values (%L, %L, %L)',
         t.id, (select id from public.athletes order by id limit 1), t.sport_id))
  from (select t.id, t.sport_id from public.teams t join _equipes q on q.cle = t.id order by t.id limit 1) t;
select * from _verrou;

-- Ce que voient les utilisateurs (policies D1a), essai défait aussitôt : écoles univ. / équipes univ.
-- En prod, anon ne lit aucune équipe : « refusé ».
create function pg_temp.compte_vu(q text, ids uuid[]) returns text language plpgsql as $$
declare n bigint;
begin
  execute q into n using ids; return n::text;
exception when insufficient_privilege then return 'refusé';
end $$;
create function pg_temp.vu(p_role text, p_uid uuid) returns text language plpgsql as $$
declare v text; v_ids uuid[] := (select array_agg(cle) from _equipes);  -- lu AVANT de changer de rôle
begin
  begin
    if p_role = 'anon' then
      perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
    else
      perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
    end if;
    perform set_config('role', p_role, true);
    v := pg_temp.compte_vu('select count(*) from public.schools where type = ''UNIVERSITE''', v_ids) || ' / ' ||
         pg_temp.compte_vu('select count(*) from public.teams t where t.id = any ($1)', v_ids);
    raise exception using errcode = 'NX000', message = v;
  exception
    when sqlstate 'NX000' then return sqlerrm;
    when others then return 'ERREUR ' || sqlstate;
  end;
end $$;
create temp table _vu on commit drop as
select 'anon (site public)' as role, pg_temp.vu('anon', null) as vu
union all select 'athlète', pg_temp.vu('authenticated', (select u.id from public.users u where u.role = 'ATHLETE'::public.user_role order by u.id limit 1))
union all select 'coach', pg_temp.vu('authenticated', (select u.id from public.users u where u.role = 'COACH'::public.user_role order by u.id limit 1))
union all select 'recruteur collégial', pg_temp.vu('authenticated', (select u.id from public.users u where u.role = 'RECRUTEUR'::public.user_role order by u.id limit 1))
union all select 'partenaire', pg_temp.vu('authenticated', (select u.id from public.users u where u.role = 'PARTNER'::public.user_role order by u.id limit 1))
union all select 'admin', pg_temp.vu('authenticated', (select u.id from public.users u where u.role = 'ADMIN'::public.user_role order by u.id limit 1));
select role, vu as "écoles univ / équipes univ" from _vu;

-- Banc APRÈS la création, puis les chemins d'écriture qui feraient afficher une université par ces
-- fonctions (chaque essai défait aussitôt).
select pg_temp.banc('apres');
create function pg_temp.ecrire(p_uid uuid, p_sql text) returns text language plpgsql as $$
declare n bigint;
begin
  begin
    perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
    perform set_config('role', 'authenticated', true);
    execute p_sql;
    get diagnostics n = row_count;
    raise exception using errcode = 'NX000', message = 'accepté ' || n;
  exception
    when sqlstate 'NX000' then return sqlerrm;
    when others then return 'refusé ' || sqlstate || case when sqlerrm like 'NEXUS%' then ' ' || left(sqlerrm, 70) else '' end;
  end;
end $$;
create temp table _ecritures on commit drop as
with c as (select pg_temp.ctx() as c),
     e (o, role, essai, tpl) as (values
  (1, 'athlète', 'fiche : committed_school_id → université',
      'update public.athletes set committed_school_id = {U} where user_id = auth.uid()'),
  (3, 'coach', 'compte : primary_team_id → équipe univ.',
      'update public.users set primary_team_id = {T} where id = auth.uid()'),
  (3, 'coach', 'team_coaches : se rattacher à une équipe univ.',
      'insert into public.team_coaches (team_id, coach_id) values ({T}, auth.uid())'),
  (3, 'coach', 'create_team_join_token(équipe univ.)',
      'select public.create_team_join_token({T}, null, null)'),
  (4, 'recruteur collégial', 'carte prospect : school_id → université',
      'update public.cartes_prospect set school_id = {U} where id = {CR}'),
  (4, 'recruteur collégial', 'carte prospect : team_id → équipe univ.',
      'update public.cartes_prospect set team_id = {TC} where id = {CR}'),
  (4, 'recruteur collégial', 'changer_rattachement_recruteur(université)',
      'select public.changer_rattachement_recruteur(auth.uid(), {U}, ''Football'')'),
  (5, 'partenaire', 'partenaire_prospect_enregistrer(université, équipe univ.)',
      'select public.partenaire_prospect_enregistrer(null, ''Témoin'', ''Banc D1'', {TPS}, null, {U}, {TP}, null, true)'))
select e.o, e.role, e.essai, pg_temp.ecrire(r.uid, pg_temp.remplir(e.tpl, c.c)) as resultat
  from e cross join c join _banc_roles r on r.o = e.o;

-- Tableau : une ligne par fonction, une colonne par rôle (valeur APRÈS ; « ok ids noms »).
create temp table _banc_vu on commit drop as
select a.n, a.objet, ap.o, ap.role, ap.resultat as apres, av.resultat as avant,
       case when ap.resultat like 'ERREUR%' then 'ERREUR'
            when ap.resultat like 'ok %' and (split_part(ap.resultat, ' ', 2)::int > 0
                 or split_part(ap.resultat, ' ', 3)::int > coalesce(nullif(split_part(av.resultat, ' ', 3), '')::int, 0)
                    and av.resultat like 'ok %') then 'FUITE'
            when ap.resultat like 'ok %' and av.resultat not like 'ok %' and split_part(ap.resultat, ' ', 3)::int > 0 then 'FUITE'
            else '' end as alerte
  from _appels a
  join _banc ap on ap.n = a.n and ap.moment = 'apres'
  join _banc av on av.n = a.n and av.o = ap.o and av.moment = 'avant';
select n, objet,
       max(apres) filter (where o = 1) as athlete, max(apres) filter (where o = 2) as parent,
       max(apres) filter (where o = 3) as coach, max(apres) filter (where o = 4) as recruteur_collegial,
       max(apres) filter (where o = 5) as partenaire, max(apres) filter (where o = 6) as anon,
       coalesce(nullif(string_agg(distinct nullif(alerte, ''), ','), ''), '—') as alerte
  from _banc_vu group by n, objet order by n;
select role, essai, resultat from _ecritures order by o, essai;
select count(*) filter (where alerte = 'FUITE') as appels_qui_fuient,
       count(*) filter (where alerte = 'ERREUR') as appels_en_erreur,
       count(*) as appels,
       (select count(*) from _ecritures where resultat like 'accepté%' and resultat <> 'accepté 0') as ecritures_acceptees
  from _banc_vu;

do $$
declare n int;
begin
  select count(*) into n from public.schools s join _ecoles e on e.cle = s.id
   where s.type = 'UNIVERSITE' and s.province = e.province and s.name = e.name and s.rseq_institution_id is null;
  if n <> @@N_ECOLES@@ then raise exception 'NEXUS: % université(s) conforme(s), attendu @@N_ECOLES@@', n; end if;
  if (select count(*) from public.schools where type = 'UNIVERSITE') <> 12 + @@N_ECOLES@@ then
    raise exception 'NEXUS: le nombre d''universités n''est pas 12 + @@N_ECOLES@@';
  end if;
  select count(*) into n from public.teams t join _equipes q on q.cle = t.id
   where t.school_id = q.cle_ecole and t.season = '2026-2027' and t.age_group = 'Universitaire' and t.is_active
     and t.rseq_team_id is null;
  if n <> @@N_EQUIPES@@ then raise exception 'NEXUS: % équipe(s) conforme(s), attendu @@N_EQUIPES@@', n; end if;
  if exists (select 1 from _emp_apres a join _emp_avant b using (objet) where a.n <> b.n or a.md5 <> b.md5) then
    raise exception 'NEXUS: une donnée hors du lot a changé';
  end if;
  if exists (select 1 from _vu where role <> 'admin' and vu not in ('0 / 0', '0 / refusé')) or (select vu from _vu where role = 'admin') <> (12 + @@N_ECOLES@@) || ' / @@N_EQUIPES@@' then
    raise exception 'NEXUS: un utilisateur non admin voit une université ou une équipe universitaire';
  end if;
  if exists (select 1 from _verrou where resultat not like 'REFUSÉ 42501 NEXUS: Une fiche athlète%') then
    raise exception 'NEXUS: le verrou D0 ne refuse pas une fiche athlète vers une université';
  end if;
-- [[BANC_VERDICT
  if exists (select 1 from _banc_vu where alerte = 'ERREUR') then
    raise exception 'NEXUS: banc — un appel a échoué sans être un refus (voir le tableau)';
  end if;
  if exists (select 1 from _banc_vu where alerte = 'FUITE') then
    raise exception 'NEXUS: banc — une fonction DEFINER rend une université ou une équipe universitaire';
  end if;
  if exists (select 1 from _ecritures where resultat like 'accepté%' and resultat <> 'accepté 0') then
    raise exception 'NEXUS: banc — un client peut faire pointer une ligne vers une université';
  end if;
-- BANC_VERDICT]]
  raise notice 'NEXUS: VERDICT D1b — @@N_ECOLES@@ universités hors Québec, @@N_EQUIPES@@ équipes, rien d''autre ne bouge, invisibles hors admin, verrou tenu';
end $$;
select 'VERDICT' as verdict, 'conforme' as resultat;
-- [[REJEU

-- ── Le rollback, joué dans la même transaction ───────────────────────────────
create temp table _rb on commit drop as select $nexus_rb$@@ROLLBACK_CORPS@@$nexus_rb$::text as corps;
do $$
begin
  if md5((select corps from _rb)) <> '@@MD5_ROLLBACK_CORPS@@' then raise exception 'NEXUS: corps du rollback altéré'; end if;
  execute (select corps from _rb);
end $$;
do $$
begin
  if exists (select 1 from public.schools s join _ecoles e on e.cle = s.id)
     or exists (select 1 from public.teams t join _equipes q on q.cle = t.id)
     or exists (select 1 from pg_temp.empreinte() e join _emp_avant b using (objet) where e.n <> b.n or e.md5 <> b.md5) then
    raise exception 'NEXUS: après rollback, l''état n''est pas celui d''avant';
  end if;
  raise notice 'NEXUS: rollback D1b vérifié (0 université du lot, 0 équipe, empreinte identique à AVANT)';
end $$;

rollback;
\echo '== ROLLBACK fait : rien n''est appliqué.'
-- REJEU]]
-- [[APPLY

insert into public.admin_operations (operation, motif, details, par)
select 'CEGEP_LOT_D1B_UNIVERSITES_CANADA',
       'Chantier cégep, lot D1b : les universités U SPORTS hors Québec (OUA, AUS, Canada West) et leurs équipes 2026-2027 des sports d''équipe (sources U SPORTS et conférences ; GO BP)',
       jsonb_build_object('universites', @@N_ECOLES@@, 'equipes', @@N_EQUIPES@@,
                          'empreinte_donnees', '@@MD5_DONNEES@@',
                          'cles_ecoles', (select jsonb_agg(cle order by cle) from _ecoles),
                          'fichier', 'docs/cegep-lot-d/prod/d1b-apply-@@DATE@@.sql', 'voie', 'psql (session pooler)'),
       (select id from public.users where id = 'f51384b5-a2c2-4827-9137-8aa8d29a1fe0');  -- BP ; NULL hors prod
select (select count(*) from public.schools s join _ecoles e on e.cle = s.id) as universites_du_lot,
       (select count(*) from public.teams t join _equipes q on q.cle = t.id) as equipes,
       clock_timestamp() as avant_commit;
commit;
\echo '== COMMIT fait : lot D1b cégep en prod (universités hors Québec et leurs équipes).'
-- APPLY]]
