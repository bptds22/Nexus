-- ════════════════════════════════════════════════════════════════════════════
-- Lot C0 cégep — APPLY RÉEL EN PROD, version @@VERSION@@. À lancer SEULEMENT sur GO BP, après le
-- rejeu à blanc. Fichier GÉNÉRÉ par scripts/cegep-lot-c0/generer.sh <date> apply (migration embarquée,
-- LF, md5 gardé).
--
-- UNE transaction : gardes AVANT → essais témoins AVANT (défaits aussitôt) → migration → essais APRÈS :
-- recruteur collégial → cégépien refusé, → athlète du secondaire inchangé → inscription
-- (schema_migrations + admin_operations MIGRATION_CEGEP_LOT_C0_BASE) → COMMIT.
-- Lancer SANS -1, en postgres. Rollback : docs/cegep-lot-c0/prod/rollback-<date>.sql (sur GO).
-- ════════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP 1
\pset pager off
\pset null '·'

begin;
set local lock_timeout = '3s';
set local statement_timeout = '120s';
set local search_path = public, extensions;
set local application_name = 'nexus-apply-cegep-c0';
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
  if exists (select 1 from public.admin_operations where operation in ('MIGRATION_CEGEP_LOT_C0_BASE', 'ROLLBACK_CEGEP_LOT_C0_BASE')) then
    raise exception 'NEXUS: le lot C0 a déjà laissé une trace dans admin_operations';
  end if;
end $$;

-- Témoins (aucun nom affiché) : mêmes règles que le rejeu à blanc.
create temp table _t on commit drop as
select (select u.id from public.users u
         where u.role = 'RECRUTEUR'::public.user_role and not public.unite_voit_cegepiens(u.school_id)
         order by u.id limit 1) as r_col,
       (select a.id from public.athletes a where a.status = 'ACTIF' and public.athlete_est_cegepien(a.id)
         order by a.id limit 1) as x_cg,
       (select a.id from public.athletes a join public.schools s on s.id = a.school_id and s.type::text = 'SECONDAIRE'
         where a.status = 'ACTIF'
           and not exists (select 1 from public.recruiter_favorites f where f.athlete_id = a.id)
         order by a.id limit 1) as x_sec;

create function pg_temp.essai(p_uid uuid, p_sql text) returns text language plpgsql as $$
begin
  begin
    perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
    perform set_config('role', 'authenticated', true);
    execute p_sql;
    raise exception using errcode = 'NX000', message = 'accepté';
  exception
    when sqlstate 'NX000' then return 'accepté';
    when others then return 'REFUSÉ ' || sqlstate;
  end;
end $$;
create function pg_temp.deux() returns table (cible text, favori text) language sql as $$
  select 'cégépien', pg_temp.essai(r_col, format('insert into public.recruiter_favorites (recruiter_id, athlete_id) values (%L, %L)', r_col, x_cg)) from _t
  union all
  select 'secondaire', pg_temp.essai(r_col, format('insert into public.recruiter_favorites (recruiter_id, athlete_id) values (%L, %L)', r_col, x_sec)) from _t;
$$;
create temp table _avant on commit drop as select * from pg_temp.deux();
select 'AVANT' as phase, * from _avant;

-- ── La migration, texte gardé par son md5 ────────────────────────────────────
create temp table _c0 on commit drop as
select '@@VERSION@@'::text as version, $nexus_mig$@@MIGRATION@@$nexus_mig$::text as contenu;
select clock_timestamp() as debut_migration;
do $apply$
begin
  if (select md5(contenu) from _c0) <> '@@MD5_MIGRATION@@' then
    raise exception 'NEXUS: texte de la migration altéré (md5 %)', (select md5(contenu) from _c0);
  end if;
  execute (select contenu from _c0);
end $apply$;
select clock_timestamp() as fin_migration;
set local search_path = public, extensions;

create temp table _apres on commit drop as select * from pg_temp.deux();
select 'APRÈS' as phase, * from _apres;
do $$
begin
  if public.lancement_collegial_actif() then
    raise exception 'NEXUS: l''interrupteur lit ON';
  end if;
  if (select favori from _apres where cible = 'cégépien') not like 'REFUSÉ%' then
    raise exception 'NEXUS: le recruteur collégial met encore un cégépien en favori';
  end if;
  if (select favori from _apres where cible = 'secondaire') is distinct from (select favori from _avant where cible = 'secondaire') then
    raise exception 'NEXUS: le favori vers un athlète du secondaire change de résultat';
  end if;
end $$;

-- ── Inscription ──────────────────────────────────────────────────────────────
insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select version, 'cegep_lot_c0_base', array[contenu], 'bptds22@gmail.com' from _c0;

insert into public.admin_operations (operation, motif, details, par)
select 'MIGRATION_CEGEP_LOT_C0_BASE',
       'Chantier cégep, lot C0 : écritures recruteur collégial → cégépien fermées (favori, pipeline, fils, contact), interrupteur lancement_collegial (false) et verrou d''ancrage (GO BP 2026-10-27)',
       jsonb_build_object(
         'nom', 'cegep_lot_c0_base',
         'version', version,
         'fichier', 'supabase/migrations/' || version || '_cegep_lot_c0_base.sql',
         'rollback', 'supabase/rollback/' || version || '_rollback_cegep_lot_c0_base.sql',
         'md5_fichier', '@@MD5_MIGRATION@@',
         'md5_rollback', '@@MD5_ROLLBACK@@',
         'releve_avant', 'favoris 0, pipeline 0, fils 0, messages 0 entre un recruteur collégial et un cégépien (2026-10-27)',
         'voie', 'psql (session pooler)'),
       (select id from public.users where id = 'f51384b5-a2c2-4827-9137-8aa8d29a1fe0')  -- BP ; NULL hors prod
  from _c0;

do $$
begin
  if not exists (select 1 from supabase_migrations.schema_migrations
                  where version = '@@VERSION@@' and name = 'cegep_lot_c0_base') then
    raise exception 'NEXUS: inscription schema_migrations absente';
  end if;
  if (select count(*) from public.admin_operations where operation = 'MIGRATION_CEGEP_LOT_C0_BASE') <> 1 then
    raise exception 'NEXUS: ligne admin_operations MIGRATION_CEGEP_LOT_C0_BASE absente ou en double';
  end if;
end $$;

select version as version_inscrite,
       (select value from public.app_settings where key = 'lancement_collegial') as interrupteur,
       clock_timestamp() as avant_commit
  from _c0;
commit;
\echo '== COMMIT fait : lot C0 cégep en prod (interrupteur OFF).'
