-- ════════════════════════════════════════════════════════════════════════════
-- Lot D0 cégep — REJEU À BLANC (finit par ROLLBACK), version 20261028000000.
-- Fichier GÉNÉRÉ par scripts/cegep-lot-d/generer.sh <date> <rejeu-blanc|apply> (migration et rollback
-- embarqués, LF, md5 gardés). Lancer SANS -1, en postgres.
--
-- UNE transaction : gardes AVANT → empreinte AVANT → essais AVANT → migration → essais APRÈS (OFF, puis ON
-- défait aussitôt) → empreinte APRÈS = AVANT → rollback D0 joué et vérifié → ROLLBACK.
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
set local application_name = 'nexus-rejeu-blanc-cegep-d0';
select now() as debut, current_user, current_setting('server_version') as version;

do $$
declare v text;
begin
  if current_user <> 'postgres' then
    raise exception 'NEXUS: lancer en postgres, pas en %', current_user;
  end if;
  if exists (select 1 from supabase_migrations.schema_migrations where version = '20261028000000') then
    raise exception 'NEXUS: version 20261028000000 déjà inscrite';
  end if;
  select max(version) into v from supabase_migrations.schema_migrations;
  if v >= '20261028000000' then raise exception 'NEXUS: version 20261028000000 pas après la dernière (%) — régénérer', v; end if;
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
select '20261028000000'::text as version,
       $nexus_mig$-- NON APPLIQUÉE EN PROD. Chantier cégep, LOT D0 (GO BP 2026-10-27) : la base des universités, porte fermée.
--
--   1. schools.type accepte 'UNIVERSITE' (CHECK schools_type_check refait) ; aucune école créée ici (lot D1,
--      GO séparé).
--   2. schools.province : code de province canadienne (décision 1 : toutes les universités U SPORTS, avec leur
--      province). NOT NULL DEFAULT 'QC' — toutes les écoles actuelles sont québécoises ; une valeur par défaut
--      constante n'écrit aucune ligne (métadonnée seulement).
--   3. users.context accepte 'universitaire' (recruteur universitaire, lot D2).
--   4. rseq_watch_leagues.secteur accepte 'Universitaire' (suivi du secteur au lot D1).
--   5. Interrupteur app_settings « lancement_universitaire » = 'false' et lancement_universitaire_actif().
--   6. verrou_universites() :
--      · athletes (INSERT, UPDATE OF school_id) et team_athletes (INSERT, UPDATE OF team_id) : aucune fiche
--        athlète ne s'ancre à une université ni à une équipe universitaire — TOUJOURS, admin compris
--        (décision 7 : Nexus s'arrête au cégep).
--      · users (INSERT, UPDATE OF school_id, context, role) : un compte n'entre dans une UNIVERSITE ou dans le
--        contexte 'universitaire' que s'il est RECRUTEUR et que l'interrupteur est ON. Admin
--        (is_admin()) et appels sans session (auth.uid() NULL : service, import, postgres) passent.
--        Les coachs étaient déjà tenus dehors par porte_coach_cegep / ecole_ouverte_aux_coachs.
--      Seule l'écriture qui FAIT ENTRER dans l'état visé est regardée : une ligne qui garde ses valeurs passe.
-- Aucune ligne existante modifiée ; aucune policy ; lot A / C0 inchangés (unite_voit_cegepiens reconnaît déjà
-- UNIVERSITE ; le masquage du secondaire pour le recruteur universitaire est le lot D3).

-- ── GARDES D'AVANT ───────────────────────────────────────────────────────────
do $garde$
begin
  if to_regprocedure('public.lancement_universitaire_actif()') is not null
     or to_regprocedure('public.verrou_universites()') is not null
     or exists (select 1 from public.app_settings where key = 'lancement_universitaire')
     or exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'schools' and column_name = 'province') then
    raise exception 'NEXUS: 20261028000000 déjà appliquée (en tout ou en partie)';
  end if;
  if (select pg_get_constraintdef(oid) from pg_constraint
       where conrelid = 'public.schools'::regclass and conname = 'schools_type_check')
     is distinct from 'CHECK ((type = ANY (ARRAY[''SECONDAIRE''::text, ''CEGEP''::text, ''LIGUE_CIVILE''::text])))' then
    raise exception 'NEXUS: schools_type_check n''est pas celle relevée le 2026-10-27';
  end if;
  if (select pg_get_constraintdef(oid) from pg_constraint
       where conrelid = 'public.users'::regclass and conname = 'users_context_check')
     is distinct from 'CHECK ((context = ANY (ARRAY[''scolaire''::text, ''collegial''::text, ''ligue_civile''::text])))' then
    raise exception 'NEXUS: users_context_check n''est pas celle relevée le 2026-10-27';
  end if;
  if (select pg_get_constraintdef(oid) from pg_constraint
       where conrelid = 'public.rseq_watch_leagues'::regclass and conname = 'rseq_watch_leagues_secteur_chk')
     is distinct from 'CHECK ((secteur = ANY (ARRAY[''Collégial''::text, ''Secondaire''::text])))' then
    raise exception 'NEXUS: rseq_watch_leagues_secteur_chk n''est pas celle relevée le 2026-10-27';
  end if;
  if exists (select 1 from public.schools where type not in ('SECONDAIRE', 'CEGEP', 'LIGUE_CIVILE')) then
    raise exception 'NEXUS: une école d''un type inattendu existe déjà';
  end if;
end $garde$;

-- ── 1 à 4. Les types ─────────────────────────────────────────────────────────
alter table public.schools drop constraint schools_type_check;
alter table public.schools add constraint schools_type_check
  check (type = any (array['SECONDAIRE'::text, 'CEGEP'::text, 'LIGUE_CIVILE'::text, 'UNIVERSITE'::text]));

alter table public.schools add column province text not null default 'QC'
  constraint schools_province_check
  check (province = any (array['AB','BC','MB','NB','NL','NS','NT','NU','ON','PE','QC','SK','YT']));
comment on column public.schools.province is
  'Lot D0 cégep : code de province canadienne (QC par défaut). Sert aux universités U SPORTS hors Québec (lot D1b).';

alter table public.users drop constraint users_context_check;
alter table public.users add constraint users_context_check
  check (context = any (array['scolaire'::text, 'collegial'::text, 'ligue_civile'::text, 'universitaire'::text]));

alter table public.rseq_watch_leagues drop constraint rseq_watch_leagues_secteur_chk;
alter table public.rseq_watch_leagues add constraint rseq_watch_leagues_secteur_chk
  check (secteur = any (array['Collégial'::text, 'Secondaire'::text, 'Universitaire'::text]));

-- ── 5. L'interrupteur ────────────────────────────────────────────────────────
insert into public.app_settings (key, value, type, description) values
  ('lancement_universitaire', 'false', 'BOOLEAN',
   'Lancement universitaire (recruteurs universitaires). false = aucun compte ne se rattache à une université ni ne prend le contexte universitaire, sauf admin (verrou en base). Passer à true seulement après la publication de la 1.4.6.');

create function public.lancement_universitaire_actif()
returns boolean
language sql
stable
security definer
set search_path = public
as $function$
  select coalesce((select lower(btrim(value)) = 'true' from public.app_settings where key = 'lancement_universitaire'), false);
$function$;

comment on function public.lancement_universitaire_actif() is
  'Lot D0 cégep : vrai seulement si app_settings.lancement_universitaire vaut true. Absente ou illisible → faux.';

-- ── 6. Le verrou ─────────────────────────────────────────────────────────────
create function public.verrou_universites()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_univ boolean;
begin
  if tg_table_name = 'athletes' then
    if new.school_id is null
       or (tg_op = 'UPDATE' and old.school_id is not distinct from new.school_id) then
      return new;
    end if;
    if exists (select 1 from public.schools s where s.id = new.school_id and s.type = 'UNIVERSITE') then
      raise exception 'NEXUS: Une fiche athlète ne peut pas être rattachée à une université.'
        using errcode = '42501';
    end if;
  elsif tg_table_name = 'team_athletes' then
    if new.team_id is null
       or (tg_op = 'UPDATE' and old.team_id is not distinct from new.team_id) then
      return new;
    end if;
    if exists (select 1 from public.teams t join public.schools s on s.id = t.school_id
                where t.id = new.team_id and s.type = 'UNIVERSITE') then
      raise exception 'NEXUS: Une fiche athlète ne peut pas être rattachée à une équipe universitaire.'
        using errcode = '42501';
    end if;
  else
    -- users : seule l'entrée dans une université ou dans le contexte universitaire est regardée.
    if tg_op = 'UPDATE' and old.school_id is not distinct from new.school_id
       and old.context is not distinct from new.context and old.role is not distinct from new.role then
      return new;
    end if;
    v_univ := new.school_id is not null
              and exists (select 1 from public.schools s where s.id = new.school_id and s.type = 'UNIVERSITE');
    if not v_univ and new.context is distinct from 'universitaire' then
      return new;
    end if;
    if auth.uid() is null or public.is_admin() then
      return new;
    end if;
    if new.role is distinct from 'RECRUTEUR'::public.user_role then
      raise exception 'NEXUS: Seul un recruteur universitaire peut être rattaché à une université.'
        using errcode = '42501';
    end if;
    if not public.lancement_universitaire_actif() then
      raise exception 'NEXUS: Les universités ne sont pas encore ouvertes sur Nexus. Ça arrive bientôt.'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$function$;

comment on function public.verrou_universites() is
  'Lot D0 cégep : aucune fiche athlète ancrée à une université (athletes, team_athletes) ; un compte n''entre dans une université ou le contexte universitaire que RECRUTEUR et sous lancement_universitaire ON (admin et service exemptés).';

create trigger trg_verrou_universites
  before insert or update of school_id on public.athletes
  for each row execute function public.verrou_universites();
create trigger trg_verrou_universites
  before insert or update of team_id on public.team_athletes
  for each row execute function public.verrou_universites();
create trigger trg_verrou_universites
  before insert or update of school_id, context, role on public.users
  for each row execute function public.verrou_universites();

revoke all on function public.lancement_universitaire_actif() from public, anon;
grant execute on function public.lancement_universitaire_actif() to authenticated, service_role;
revoke all on function public.verrou_universites() from public, anon, authenticated;
grant execute on function public.verrou_universites() to service_role;

-- ── GARDES D'APRÈS ───────────────────────────────────────────────────────────
do $garde$
declare
  r    record;
  vus  text[];
begin
  if (select value || '|' || type from public.app_settings where key = 'lancement_universitaire') is distinct from 'false|BOOLEAN' then
    raise exception 'NEXUS: lancement_universitaire inattendu';
  end if;
  if public.lancement_universitaire_actif() then
    raise exception 'NEXUS: l''interrupteur universitaire lit ON après l''insertion';
  end if;
  if exists (select 1 from public.schools where province is distinct from 'QC') then
    raise exception 'NEXUS: une école n''est pas QC après l''ajout de province';
  end if;
  if exists (select 1 from public.schools where type = 'UNIVERSITE') then
    raise exception 'NEXUS: une université existe après D0 (aucune ne devait être créée)';
  end if;
  for r in select * from (values
      ('public.lancement_universitaire_actif()', array['authenticated', 'postgres', 'service_role']),
      ('public.verrou_universites()',            array['postgres', 'service_role'])) as t(sig, acl) loop
    select array_agg(distinct g order by g) into vus
      from pg_proc pr,
           lateral (select coalesce(nullif(split_part(x, '=', 1), ''), 'PUBLIC') as g
                      from unnest(pr.proacl::text[]) as x) a
     where pr.oid = r.sig::regprocedure;
    if vus is distinct from r.acl then
      raise exception 'NEXUS: ACL de % = %, attendu %', r.sig, vus, r.acl;
    end if;
  end loop;
  if (select count(*) from pg_trigger where tgname = 'trg_verrou_universites' and tgenabled = 'O'
         and tgrelid in ('public.athletes'::regclass, 'public.team_athletes'::regclass, 'public.users'::regclass)) <> 3 then
    raise exception 'NEXUS: les trois triggers du verrou universitaire ne sont pas en place';
  end if;
  raise notice 'NEXUS: lot D0 cégep — type UNIVERSITE, province, contexte universitaire, interrupteur OFF, verrou en place';
end $garde$;
$nexus_mig$::text as contenu,
       $nexus_rb$-- Rollback de 20261028000000_cegep_lot_d0_base : retire le verrou, l'interrupteur, la colonne province et
-- rend aux trois CHECK leurs listes du 2026-10-27. Refuse s'il reste une université, un compte au contexte
-- universitaire ou un suivi RSEQ « Universitaire » : les retirer est une décision à part (sur GO).
do $garde$
begin
  if to_regprocedure('public.verrou_universites()') is null then
    raise exception 'NEXUS: 20261028000000 absente, rien à annuler';
  end if;
  if exists (select 1 from public.schools where type = 'UNIVERSITE') then
    raise exception 'NEXUS: des universités existent — rollback D0 refusé';
  end if;
  if exists (select 1 from public.users where context = 'universitaire') then
    raise exception 'NEXUS: des comptes ont le contexte universitaire — rollback D0 refusé';
  end if;
  if exists (select 1 from public.rseq_watch_leagues where secteur = 'Universitaire') then
    raise exception 'NEXUS: des suivis RSEQ universitaires existent — rollback D0 refusé';
  end if;
  if exists (select 1 from public.schools where province is distinct from 'QC') then
    raise exception 'NEXUS: des écoles hors Québec existent — rollback D0 refusé';
  end if;
end $garde$;

drop trigger trg_verrou_universites on public.athletes;
drop trigger trg_verrou_universites on public.team_athletes;
drop trigger trg_verrou_universites on public.users;
drop function public.verrou_universites();
drop function public.lancement_universitaire_actif();
delete from public.app_settings where key = 'lancement_universitaire';

alter table public.schools drop column province;

alter table public.schools drop constraint schools_type_check;
alter table public.schools add constraint schools_type_check
  check (type = any (array['SECONDAIRE'::text, 'CEGEP'::text, 'LIGUE_CIVILE'::text]));
alter table public.users drop constraint users_context_check;
alter table public.users add constraint users_context_check
  check (context = any (array['scolaire'::text, 'collegial'::text, 'ligue_civile'::text]));
alter table public.rseq_watch_leagues drop constraint rseq_watch_leagues_secteur_chk;
alter table public.rseq_watch_leagues add constraint rseq_watch_leagues_secteur_chk
  check (secteur = any (array['Collégial'::text, 'Secondaire'::text]));

do $garde$
begin
  if exists (select 1 from pg_trigger where tgname = 'trg_verrou_universites')
     or exists (select 1 from public.app_settings where key = 'lancement_universitaire')
     or exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'schools' and column_name = 'province') then
    raise exception 'NEXUS: rollback D0 incomplet';
  end if;
  raise notice 'NEXUS: lot D0 cégep annulé';
end $garde$;
$nexus_rb$::text as rollback;
select clock_timestamp() as debut_migration;
do $apply$
begin
  if (select md5(contenu) from _d0) <> '5c38b400f74edd5c82b66dab8e362850' then
    raise exception 'NEXUS: texte de la migration altéré (md5 %)', (select md5(contenu) from _d0);
  end if;
  if (select md5(rollback) from _d0) <> '2a5a9b987f1707ea561c55e13c128831' then
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
