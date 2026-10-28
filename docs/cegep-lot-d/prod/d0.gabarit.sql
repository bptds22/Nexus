-- ════════════════════════════════════════════════════════════════════════════
-- Lot D0 cégep — @@TITRE@@, version @@VERSION@@.
-- Fichier GÉNÉRÉ par scripts/cegep-lot-d/generer.sh <date> <rejeu-blanc|apply> (migration et rollback
-- embarqués, LF, md5 gardés). Lancer SANS -1, en postgres.
--
-- UNE transaction : gardes AVANT → empreinte AVANT → essais AVANT → migration → essais APRÈS (OFF, puis ON
-- défait aussitôt) → empreinte APRÈS = AVANT → @@SUITE@@.
-- Les essais sont défaits un par un (exception NX000) : aucune école, équipe ou valeur d'interrupteur
-- de test ne survit. Aucun nom affiché.
-- ════════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP 1
\pset pager off
\pset null '·'

begin;
set local lock_timeout = '3s';
set local statement_timeout = '120s';
set local search_path = public, extensions;
set local application_name = 'nexus-@@MODE@@-cegep-d0';
select now() as debut, current_user, current_setting('server_version') as version;

do $$
declare v text;
begin
  if current_user <> 'postgres' then
    raise exception 'NEXUS: lancer en postgres, pas en %', current_user;
  end if;
  if exists (select 1 from supabase_migrations.schema_migrations where version = '@@VERSION@@') then
    raise exception 'NEXUS: version @@VERSION@@ déjà inscrite';
  end if;
  select max(version) into v from supabase_migrations.schema_migrations;
  if v >= '@@VERSION@@' then raise exception 'NEXUS: version @@VERSION@@ pas après la dernière (%) — régénérer', v; end if;
  if exists (select 1 from public.admin_operations where operation in ('MIGRATION_CEGEP_LOT_D0_BASE', 'ROLLBACK_CEGEP_LOT_D0_BASE')) then
    raise exception 'NEXUS: le lot D0 a déjà laissé une trace dans admin_operations';
  end if;
  if exists (select 1 from public.app_settings where key = 'lancement_universitaire') then
    raise exception 'NEXUS: l''interrupteur lancement_universitaire existe déjà';
  end if;
end $$;
select max(version) as derniere_version from supabase_migrations.schema_migrations;

-- ── Témoins (identifiants seulement, jamais affichés) ────────────────────────
create temp table _t on commit drop as
with ath as (
  select a.id as x_ath, a.user_id as u_ath, a.school_id as sec1
    from public.athletes a
    join public.schools s on s.id = a.school_id and s.type = 'SECONDAIRE'
    join public.users u on u.id = a.user_id and u.role = 'ATHLETE'::public.user_role
   where a.status = 'ACTIF'
   order by a.id limit 1)
select ath.*,
       (select s.id from public.schools s where s.type = 'SECONDAIRE' and s.id <> ath.sec1 order by s.id limit 1) as sec2,
       (select u.id from public.users u join public.schools s on s.id = u.school_id and s.type = 'CEGEP'
         where u.role = 'RECRUTEUR'::public.user_role and u.onboarding_complete order by u.id limit 1) as u_rec,
       (select u.id from public.users u where u.role = 'COACH'::public.user_role and u.school_id is not null
         order by u.id limit 1) as u_coach,
       (select u.id from public.users u where u.role = 'ADMIN'::public.user_role order by u.id limit 1) as u_adm,
       (select t.sport_id from public.teams t order by t.id limit 1) as sport,
       '00000000-0000-4000-8000-00000000d0e1'::uuid as univ,
       '00000000-0000-4000-8000-00000000d0e2'::uuid as univ_team
  from ath;
select (x_ath is not null) as athlete, (sec2 is not null) as autre_ecole, (u_rec is not null) as recruteur_collegial,
       (u_coach is not null) as coach, (u_adm is not null) as admin, (sport is not null) as sport
  from _t;
do $$
begin
  if exists (select 1 from _t where x_ath is null or sec2 is null or u_rec is null or u_coach is null or u_adm is null or sport is null) then
    raise exception 'NEXUS: un témoin manque';
  end if;
end $$;

-- ── Empreinte (comptes + md5 des colonnes visées) ────────────────────────────
create function pg_temp.empreinte() returns table (objet text, n bigint, md5 text) language sql as $$
  select 'schools', count(*), md5(coalesce(string_agg(id::text || type || name, ',' order by id), '')) from public.schools
  union all
  select 'users', count(*), md5(coalesce(string_agg(id::text || role::text || coalesce(context, '·') || coalesce(school_id::text, '·'), ',' order by id), '')) from public.users
  union all
  select 'athletes', count(*), md5(coalesce(string_agg(id::text || coalesce(school_id::text, '·') || verified::text, ',' order by id), '')) from public.athletes
  union all
  select 'team_athletes', count(*), md5(coalesce(string_agg(id::text || team_id::text || athlete_id::text, ',' order by id), '')) from public.team_athletes
  union all
  select 'teams', count(*), md5(coalesce(string_agg(id::text || school_id::text, ',' order by id), '')) from public.teams
  union all
  select 'app_settings', count(*), md5(coalesce(string_agg(key || coalesce(value, '·'), ',' order by key), '')) from public.app_settings where key <> 'lancement_universitaire';
$$;
create temp table _emp_avant on commit drop as select * from pg_temp.empreinte();
select 'AVANT' as moment, * from _emp_avant order by objet;

-- ── Essais ───────────────────────────────────────────────────────────────────
-- p_mode : 'postgres' = sans session (service, import) ; 'rpc' = session de p_uid mais RLS contournée
-- (comme une fonction SECURITY DEFINER appelée par ce compte) ; 'jwt' = session de p_uid, rôle authenticated.
-- p_on : prépare une université et son équipe de test, et met l'interrupteur à ON si vrai.
create function pg_temp.prep(p_on boolean) returns void language plpgsql as $$
begin
  insert into public.schools (id, name, type, city) select univ, 'Université témoin D0', 'UNIVERSITE', 'Québec' from _t;
  insert into public.teams (id, school_id, sport_id, name) select univ_team, univ, sport, 'Équipe témoin D0' from _t;
  if p_on then
    update public.app_settings set value = 'true' where key = 'lancement_universitaire';
  end if;
end $$;
create function pg_temp.essai(p_mode text, p_uid uuid, p_prep text, p_sql text) returns text language plpgsql as $$
begin
  begin
    if p_prep is not null then execute p_prep; end if;
    if p_mode in ('rpc', 'jwt') then
      perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
    end if;
    if p_mode = 'jwt' then
      perform set_config('role', 'authenticated', true);
    end if;
    execute p_sql;
    raise exception using errcode = 'NX000', message = 'accepté';
  exception
    when sqlstate 'NX000' then return 'accepté';
    when others then
      return 'REFUSÉ ' || sqlstate || case when sqlerrm like 'NEXUS%' then ' ' || left(sqlerrm, 70) else '' end;
  end;
end $$;

-- Avant : seules les écritures qui n'ont pas besoin d'une université.
create function pg_temp.temoins() returns table (essai text, resultat text) language sql as $$
  select 'N1 athlète → autre école secondaire (service)', pg_temp.essai('postgres', null, null,
           format('update public.athletes set school_id = %L where id = %L', sec2, x_ath)) from _t
  union all
  select 'N2 recruteur collégial, téléphone inchangé (rpc)', pg_temp.essai('rpc', u_rec, null,
           format('update public.users set phone = phone where id = %L', u_rec)) from _t
  union all
  select 'N3 créer une école UNIVERSITE (service)', pg_temp.essai('postgres', null, null,
           'insert into public.schools (name, type) values (''Université témoin D0'', ''UNIVERSITE'')')
  union all
  select 'N4 compte au contexte universitaire (service)', pg_temp.essai('postgres', null, null,
           format('update public.users set context = ''universitaire'' where id = %L', u_rec)) from _t;
$$;
create temp table _avant on commit drop as select * from pg_temp.temoins();
select 'AVANT' as phase, * from _avant;

-- ── La migration, texte gardé par son md5 ────────────────────────────────────
create temp table _d0 on commit drop as
select '@@VERSION@@'::text as version,
       $nexus_mig$@@MIGRATION@@$nexus_mig$::text as contenu,
       $nexus_rb$@@ROLLBACK@@$nexus_rb$::text as rollback;
select clock_timestamp() as debut_migration;
do $apply$
begin
  if (select md5(contenu) from _d0) <> '@@MD5_MIGRATION@@' then
    raise exception 'NEXUS: texte de la migration altéré (md5 %)', (select md5(contenu) from _d0);
  end if;
  if (select md5(rollback) from _d0) <> '@@MD5_ROLLBACK@@' then
    raise exception 'NEXUS: texte du rollback altéré (md5 %)', (select md5(rollback) from _d0);
  end if;
  execute (select contenu from _d0);
end $apply$;
select clock_timestamp() as fin_migration;
set local search_path = public, extensions;

create temp table _apres on commit drop as select * from pg_temp.temoins();
select 'APRÈS' as phase, * from _apres;

create function pg_temp.verrou(p_on boolean) returns table (essai text, resultat text) language sql as $$
  select 'V1 fiche athlète → université (service)', pg_temp.essai('postgres', null, format('select pg_temp.prep(%L)', p_on),
           format('update public.athletes set school_id = univ from _t where athletes.id = %L', x_ath)) from _t
  union all
  select 'V2 fiche athlète → université (l''athlète)', pg_temp.essai('jwt', u_ath, format('select pg_temp.prep(%L)', p_on),
           format('update public.athletes set school_id = %L where id = %L', univ, x_ath)) from _t
  union all
  select 'V3 fiche athlète → équipe universitaire (service)', pg_temp.essai('postgres', null, format('select pg_temp.prep(%L)', p_on),
           format('insert into public.team_athletes (team_id, athlete_id, sport_id) values (%L, %L, %L)', univ_team, x_ath, sport)) from _t
  union all
  select 'V4 recruteur → université (rpc)', pg_temp.essai('rpc', u_rec, format('select pg_temp.prep(%L)', p_on),
           format('update public.users set school_id = %L where id = %L', univ, u_rec)) from _t
  union all
  select 'V5 recruteur → contexte universitaire (rpc)', pg_temp.essai('rpc', u_rec, format('select pg_temp.prep(%L)', p_on),
           format('update public.users set context = ''universitaire'' where id = %L', u_rec)) from _t
  union all
  select 'V6 coach → université (rpc)', pg_temp.essai('rpc', u_coach, format('select pg_temp.prep(%L)', p_on),
           format('update public.users set school_id = %L where id = %L', univ, u_coach)) from _t
  union all
  select 'V7 athlète (compte) → université (rpc)', pg_temp.essai('rpc', u_ath, format('select pg_temp.prep(%L)', p_on),
           format('update public.users set school_id = %L where id = %L', univ, u_ath)) from _t
  union all
  select 'V8 admin rattache le recruteur (rpc admin)', pg_temp.essai('rpc', u_adm, format('select pg_temp.prep(%L)', p_on),
           format('update public.users set school_id = %L, context = ''universitaire'' where id = %L', univ, u_rec)) from _t
  union all
  select 'V9 service rattache le recruteur', pg_temp.essai('postgres', null, format('select pg_temp.prep(%L)', p_on),
           format('update public.users set school_id = %L, context = ''universitaire'' where id = %L', univ, u_rec)) from _t
  union all
  select 'V10 école hors liste de provinces (service)', pg_temp.essai('postgres', null, null,
           'insert into public.schools (name, type, province) values (''Témoin D0'', ''UNIVERSITE'', ''XX'')')
  union all
  select 'V11 université en Ontario (service)', pg_temp.essai('postgres', null, null,
           'insert into public.schools (name, type, province) values (''Témoin D0'', ''UNIVERSITE'', ''ON'')');
$$;
create temp table _off on commit drop as select * from pg_temp.verrou(false);
select 'OFF' as interrupteur, * from _off;
create temp table _on on commit drop as select * from pg_temp.verrou(true);
select 'ON' as interrupteur, * from _on;

create temp table _emp_apres on commit drop as select * from pg_temp.empreinte();
select 'APRÈS' as moment, a.objet, a.n, a.md5,
       case when a.n = b.n and a.md5 = b.md5 then '=' else 'CHANGE' end as vs_avant
  from _emp_apres a join _emp_avant b using (objet) order by objet;

-- ── Verdict ──────────────────────────────────────────────────────────────────
do $$
declare
  attendu_off text[] := array['REFUSÉ','REFUSÉ','REFUSÉ','REFUSÉ','REFUSÉ','REFUSÉ','REFUSÉ','accepté','accepté','REFUSÉ','accepté'];
  attendu_on  text[] := array['REFUSÉ','REFUSÉ','REFUSÉ','accepté','accepté','REFUSÉ','REFUSÉ','accepté','accepté','REFUSÉ','accepté'];
  r record; i int;
begin
  if public.lancement_universitaire_actif() then
    raise exception 'NEXUS: l''interrupteur universitaire lit ON hors essai';
  end if;
  if (select resultat from _avant where essai like 'N1%') <> 'accepté' or (select resultat from _apres where essai like 'N1%') <> 'accepté'
     or (select resultat from _avant where essai like 'N2%') <> 'accepté' or (select resultat from _apres where essai like 'N2%') <> 'accepté' then
    raise exception 'NEXUS: une écriture ordinaire (N1/N2) change de résultat';
  end if;
  if (select resultat from _avant where essai like 'N3%') not like 'REFUSÉ 23514%' or (select resultat from _apres where essai like 'N3%') <> 'accepté'
     or (select resultat from _avant where essai like 'N4%') not like 'REFUSÉ 23514%' or (select resultat from _apres where essai like 'N4%') <> 'accepté' then
    raise exception 'NEXUS: les CHECK UNIVERSITE / universitaire ne s''ouvrent pas comme prévu';
  end if;
  for i in 1..11 loop
    select * into r from _off where essai like 'V' || i || ' %';
    if split_part(r.resultat, ' ', 1) <> attendu_off[i] then
      raise exception 'NEXUS: OFF % = %, attendu %', r.essai, r.resultat, attendu_off[i];
    end if;
    select * into r from _on where essai like 'V' || i || ' %';
    if split_part(r.resultat, ' ', 1) <> attendu_on[i] then
      raise exception 'NEXUS: ON % = %, attendu %', r.essai, r.resultat, attendu_on[i];
    end if;
  end loop;
  if (select resultat from _off where essai like 'V1 %') not like '%NEXUS: Une fiche athlète%'
     or (select resultat from _on where essai like 'V1 %') not like '%NEXUS: Une fiche athlète%'
     or (select resultat from _off where essai like 'V3 %') not like '%NEXUS: Une fiche athlète%'
     or (select resultat from _off where essai like 'V4 %') not like '%NEXUS: Les universités ne sont pas encore ouvertes%'
     or (select resultat from _off where essai like 'V7 %') not like '%NEXUS: Seul un recruteur universitaire%' then
    raise exception 'NEXUS: un refus ne vient pas du verrou universitaire attendu';
  end if;
  if exists (select 1 from _emp_apres a join _emp_avant b using (objet) where a.n <> b.n or a.md5 <> b.md5) then
    raise exception 'NEXUS: l''empreinte des données change';
  end if;
  raise notice 'NEXUS: VERDICT D0 — CHECK ouverts, verrou conforme OFF et ON, données identiques';
end $$;
select 'VERDICT' as verdict, 'conforme' as resultat;
-- [[REJEU

-- ── Le rollback, joué dans la même transaction ───────────────────────────────
do $rb$ begin execute (select rollback from _d0); end $rb$;
set local search_path = public, extensions;
select (select pg_get_constraintdef(oid) from pg_constraint where conname = 'schools_type_check') as type_ecole_apres_rollback,
       to_regprocedure('public.verrou_universites()') is null as verrou_retire,
       not exists (select 1 from public.app_settings where key = 'lancement_universitaire') as interrupteur_retire;
create temp table _apres_rb on commit drop as select * from pg_temp.temoins();
do $$
begin
  if exists (select 1 from _apres_rb r join _avant a using (essai) where r.resultat <> a.resultat) then
    raise exception 'NEXUS: après rollback, les essais témoins ne retrouvent pas leur résultat d''avant';
  end if;
  if exists (select 1 from pg_temp.empreinte() e join _emp_avant b using (objet) where e.n <> b.n or e.md5 <> b.md5) then
    raise exception 'NEXUS: après rollback, l''empreinte diffère';
  end if;
  raise notice 'NEXUS: rollback D0 vérifié (témoins et empreinte identiques à AVANT)';
end $$;

rollback;
\echo '== ROLLBACK fait : rien n''est appliqué.'
-- REJEU]]
-- [[APPLY

-- ── Inscription ──────────────────────────────────────────────────────────────
insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select version, 'cegep_lot_d0_base', array[contenu], 'bptds22@gmail.com' from _d0;

insert into public.admin_operations (operation, motif, details, par)
select 'MIGRATION_CEGEP_LOT_D0_BASE',
       'Chantier cégep, lot D0 : type UNIVERSITE, schools.province, contexte universitaire, interrupteur lancement_universitaire (false) et verrou (GO BP 2026-10-27)',
       jsonb_build_object(
         'nom', 'cegep_lot_d0_base',
         'version', version,
         'fichier', 'supabase/migrations/' || version || '_cegep_lot_d0_base.sql',
         'rollback', 'supabase/rollback/' || version || '_rollback_cegep_lot_d0_base.sql',
         'md5_fichier', '@@MD5_MIGRATION@@',
         'md5_rollback', '@@MD5_ROLLBACK@@',
         'voie', 'psql (session pooler)'),
       (select id from public.users where id = 'f51384b5-a2c2-4827-9137-8aa8d29a1fe0')  -- BP ; NULL hors prod
  from _d0;

do $$
begin
  if not exists (select 1 from supabase_migrations.schema_migrations
                  where version = '@@VERSION@@' and name = 'cegep_lot_d0_base') then
    raise exception 'NEXUS: inscription schema_migrations absente';
  end if;
  if (select count(*) from public.admin_operations where operation = 'MIGRATION_CEGEP_LOT_D0_BASE') <> 1 then
    raise exception 'NEXUS: ligne admin_operations MIGRATION_CEGEP_LOT_D0_BASE absente ou en double';
  end if;
end $$;

select version as version_inscrite,
       (select value from public.app_settings where key = 'lancement_universitaire') as interrupteur,
       clock_timestamp() as avant_commit
  from _d0;
commit;
\echo '== COMMIT fait : lot D0 cégep en prod (interrupteur universitaire OFF).'
-- APPLY]]
