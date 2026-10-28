-- ════════════════════════════════════════════════════════════════════════════
-- Lot D1 cégep — @@TITRE@@
-- Les 12 universités québécoises du RSEQ (type UNIVERSITE, province QC) et leurs @@N_EQUIPES@@ équipes des
-- sports d'équipe de la saison 2026-2027, lues dans l'API RSEQ (s1.rseq.ca, secteur Universitaire).
-- Fichier GÉNÉRÉ par scripts/cegep-lot-d/generer-d1.mjs <date> <rejeu-blanc|apply|rollback> depuis
-- scripts/cegep-lot-d/d1-universites.json (empreinte @@MD5_DONNEES@@). Lancer SANS -1, en postgres.
--
-- Opération de DONNÉES (aucun objet de schéma). Préalables : D0 (20261028000000) et D1a (20261028010000,
-- universités masquées hors admin) en prod, correctif web /college promu.
-- Aucune fiche athlète, aucun compte, aucun classement touché. Les côtés de match NULL qui portent le
-- rseq_team_id d'une équipe créée sont reliés (la veille n'a pas chargé le secteur Universitaire : 0 attendu).
-- @@SUITE@@
-- ════════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP 1
\pset pager off
\pset null '·'

begin;
set local lock_timeout = '3s';
set local statement_timeout = '120s';
set local search_path = public, extensions;
set local application_name = 'nexus-@@MODE@@-cegep-d1';
select now() as debut, current_user;

create temp table _ecoles (rseq_institution_id uuid primary key, name text not null, team_name text, city text,
                           region text, langue text, website text) on commit drop;
insert into _ecoles values
@@ECOLES@@;
create temp table _equipes (rseq_team_id uuid primary key, rseq_institution_id uuid not null, nom text not null,
                            sport text not null, gender text, division text, ligue text not null) on commit drop;
insert into _equipes values
@@EQUIPES@@;

-- ── GARDES D'AVANT ───────────────────────────────────────────────────────────
do $$
begin
  if current_user <> 'postgres' then
    raise exception 'NEXUS: lancer en postgres, pas en %', current_user;
  end if;
  if (select count(*) from _ecoles) <> 12 or (select count(*) from _equipes) <> @@N_EQUIPES@@ then
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
  if exists (select 1 from public.schools where type = 'UNIVERSITE') then
    raise exception 'NEXUS: des universités existent déjà';
  end if;
  if exists (select 1 from public.schools s join _ecoles e using (rseq_institution_id)) then
    raise exception 'NEXUS: un rseq_institution_id universitaire est déjà porté par une école';
  end if;
  if exists (select 1 from public.teams t join _equipes q using (rseq_team_id)) then
    raise exception 'NEXUS: une des équipes universitaires existe déjà (rseq_team_id)';
  end if;
  if exists (select 1 from _equipes q left join public.sports s on s.nom = q.sport where s.id is null) then
    raise exception 'NEXUS: un sport des équipes est absent du catalogue Nexus';
  end if;
  if exists (select 1 from _equipes q left join _ecoles e using (rseq_institution_id) where e.name is null) then
    raise exception 'NEXUS: une équipe pointe hors des 12 universités';
  end if;
  if exists (select 1 from public.admin_operations where operation in ('CEGEP_LOT_D1_UNIVERSITES', 'CEGEP_LOT_D1_UNIVERSITES_RETIREES')) then
    raise exception 'NEXUS: le lot D1 a déjà laissé une trace dans admin_operations';
  end if;
end $$;

-- ── Empreinte (hors lignes créées) ───────────────────────────────────────────
create function pg_temp.empreinte() returns table (objet text, n bigint, md5 text) language sql as $$
  select 'schools (hors univ.)', count(*), md5(coalesce(string_agg(id::text || type || name, ',' order by id), '')) from public.schools where type <> 'UNIVERSITE'
  union all
  select 'teams (hors univ.)', count(*), md5(coalesce(string_agg(id::text || school_id::text || name, ',' order by id), ''))
    from public.teams t where not exists (select 1 from _equipes q where q.rseq_team_id = t.rseq_team_id)
  union all
  select 'athletes', count(*), md5(coalesce(string_agg(id::text || coalesce(school_id::text, '·'), ',' order by id), '')) from public.athletes
  union all
  select 'users', count(*), md5(coalesce(string_agg(id::text || coalesce(school_id::text, '·') || coalesce(context, '·'), ',' order by id), '')) from public.users
  union all
  select 'team_athletes', count(*), md5(coalesce(string_agg(id::text || team_id::text, ',' order by id), '')) from public.team_athletes
  union all
  select 'games (côtés hors univ.)', count(*), md5(coalesce(string_agg(id::text || coalesce(home_team_id::text, '·') || coalesce(visitor_team_id::text, '·'), ',' order by id), ''))
    from public.games g
   where not exists (select 1 from _equipes q where q.rseq_team_id in (g.home_rseq_team_id, g.visitor_rseq_team_id));
$$;
create temp table _emp_avant on commit drop as select * from pg_temp.empreinte();
select 'AVANT' as moment, * from _emp_avant order by objet;

create temp table _cotes on commit drop as
select (select count(*) from public.games g join _equipes q on q.rseq_team_id = g.home_rseq_team_id where g.home_team_id is null) as domicile,
       (select count(*) from public.games g join _equipes q on q.rseq_team_id = g.visitor_rseq_team_id where g.visitor_team_id is null) as visiteur;
select 'côtés de match à relier' as quoi, * from _cotes;

-- ── Création ─────────────────────────────────────────────────────────────────
insert into public.schools (name, type, province, team_name, city, region, langue, website, rseq_institution_id)
select name, 'UNIVERSITE', 'QC', team_name, city, region, langue, website, rseq_institution_id from _ecoles;

insert into public.teams (school_id, sport_id, name, division, league, season, is_active, age_group, gender, rseq_team_id)
select s.id, sp.id, q.nom, q.division, q.ligue || ' (2026-2027)', '2026-2027', true, 'Universitaire', q.gender, q.rseq_team_id
  from _equipes q
  join public.schools s on s.rseq_institution_id = q.rseq_institution_id and s.type = 'UNIVERSITE'
  join public.sports sp on sp.nom = q.sport;

update public.games g set home_team_id = t.id
  from public.teams t join _equipes q using (rseq_team_id)
 where g.home_team_id is null and g.home_rseq_team_id = t.rseq_team_id;
update public.games g set visitor_team_id = t.id
  from public.teams t join _equipes q using (rseq_team_id)
 where g.visitor_team_id is null and g.visitor_rseq_team_id = t.rseq_team_id;

-- ── Ce qui a été créé (par université) ───────────────────────────────────────
select s.name as universite, s.team_name as programme, s.city as ville, count(t.id) as equipes,
       string_agg(sp.nom || ' ' || left(coalesce(t.gender, '?'), 1) || coalesce(' ' || t.division, ''), ', ' order by sp.nom, t.gender) as detail
  from public.schools s
  left join public.teams t on t.school_id = s.id
  left join public.sports sp on sp.id = t.sport_id
 where s.type = 'UNIVERSITE'
 group by s.name, s.team_name, s.city order by s.name;

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
select 'fiche athlète → Université Laval' as essai,
       pg_temp.essai(format('update public.athletes set school_id = %L where id = %L',
         (select id from public.schools where type = 'UNIVERSITE' and name = 'Université Laval'),
         (select id from public.athletes order by id limit 1))) as resultat
union all
select 'fiche athlète → une équipe universitaire',
       pg_temp.essai(format('insert into public.team_athletes (team_id, athlete_id, sport_id) values (%L, %L, %L)',
         t.id, (select id from public.athletes order by id limit 1), t.sport_id))
  from (select t.id, t.sport_id from public.teams t join _equipes q using (rseq_team_id) order by t.id limit 1) t;
select * from _verrou;

-- Ce que voient les utilisateurs (policies D1a), essai défait aussitôt : écoles univ. / équipes univ.
create function pg_temp.vu(p_role text, p_uid uuid) returns text language plpgsql as $$
declare v text; v_ids uuid[] := (select array_agg(rseq_team_id) from _equipes);  -- lu AVANT de changer de rôle
begin
  begin
    if p_role = 'anon' then
      perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
    else
      perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
    end if;
    perform set_config('role', p_role, true);
    select (select count(*) from public.schools where type = 'UNIVERSITE') || ' / ' ||
           (select count(*) from public.teams t where t.rseq_team_id = any (v_ids))
      into v;
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

do $$
declare n int;
begin
  select count(*) into n from public.schools s join _ecoles e using (rseq_institution_id)
   where s.type = 'UNIVERSITE' and s.province = 'QC' and s.name = e.name;
  if n <> 12 then raise exception 'NEXUS: % université(s) conforme(s), attendu 12', n; end if;
  if (select count(*) from public.schools where type = 'UNIVERSITE') <> 12 then
    raise exception 'NEXUS: le nombre d''universités n''est pas 12';
  end if;
  select count(*) into n from public.teams t join _equipes q using (rseq_team_id)
    join public.schools s on s.id = t.school_id and s.rseq_institution_id = q.rseq_institution_id
   where t.season = '2026-2027' and t.age_group = 'Universitaire' and t.is_active;
  if n <> @@N_EQUIPES@@ then raise exception 'NEXUS: % équipe(s) conforme(s), attendu @@N_EQUIPES@@', n; end if;
  if (select count(*) from public.games g join public.teams t on t.id = g.home_team_id join _equipes q using (rseq_team_id))
       <> (select domicile from _cotes)
     or (select count(*) from public.games g join public.teams t on t.id = g.visitor_team_id join _equipes q using (rseq_team_id))
       <> (select visiteur from _cotes) then
    raise exception 'NEXUS: les côtés de match reliés ne font pas le compte';
  end if;
  if exists (select 1 from _emp_apres a join _emp_avant b using (objet) where a.n <> b.n or a.md5 <> b.md5) then
    raise exception 'NEXUS: une donnée hors du lot a changé';
  end if;
  if exists (select 1 from _vu where role <> 'admin' and vu <> '0 / 0') or (select vu from _vu where role = 'admin') <> '12 / @@N_EQUIPES@@' then
    raise exception 'NEXUS: un utilisateur non admin voit une université ou une équipe universitaire';
  end if;
  if exists (select 1 from _verrou where resultat not like 'REFUSÉ 42501 NEXUS: Une fiche athlète%') then
    raise exception 'NEXUS: le verrou D0 ne refuse pas une fiche athlète vers une université';
  end if;
  raise notice 'NEXUS: VERDICT D1 — 12 universités, @@N_EQUIPES@@ équipes, rien d''autre ne bouge, invisibles hors admin, verrou tenu';
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
  if exists (select 1 from public.schools where type = 'UNIVERSITE')
     or exists (select 1 from public.teams t join _equipes q using (rseq_team_id))
     or exists (select 1 from pg_temp.empreinte() e join _emp_avant b using (objet) where e.n <> b.n or e.md5 <> b.md5) then
    raise exception 'NEXUS: après rollback, l''état n''est pas celui d''avant';
  end if;
  raise notice 'NEXUS: rollback D1 vérifié (0 université, 0 équipe, empreinte identique à AVANT)';
end $$;

rollback;
\echo '== ROLLBACK fait : rien n''est appliqué.'
-- REJEU]]
-- [[APPLY

insert into public.admin_operations (operation, motif, details, par)
select 'CEGEP_LOT_D1_UNIVERSITES',
       'Chantier cégep, lot D1 : les 12 universités québécoises du RSEQ et leurs équipes 2026-2027 des sports d''équipe (API RSEQ ; GO BP 2026-10-28)',
       jsonb_build_object('universites', 12, 'equipes', @@N_EQUIPES@@,
                          'cotes_domicile', (select domicile from _cotes), 'cotes_visiteur', (select visiteur from _cotes),
                          'empreinte_donnees', '@@MD5_DONNEES@@',
                          'rseq_institution_ids', (select jsonb_agg(rseq_institution_id order by rseq_institution_id) from _ecoles),
                          'fichier', 'docs/cegep-lot-d/prod/d1-apply-@@DATE@@.sql', 'voie', 'psql (session pooler)'),
       (select id from public.users where id = 'f51384b5-a2c2-4827-9137-8aa8d29a1fe0');  -- BP ; NULL hors prod
select (select count(*) from public.schools where type = 'UNIVERSITE') as universites,
       (select count(*) from public.teams t join _equipes q using (rseq_team_id)) as equipes,
       clock_timestamp() as avant_commit;
commit;
\echo '== COMMIT fait : lot D1 cégep en prod (12 universités et leurs équipes).'
-- APPLY]]
