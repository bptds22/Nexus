-- ════════════════════════════════════════════════════════════════════════════
-- Lot 7 civil — ROLLBACK RÉEL EN PROD de la version @@VERSION@@. À lancer SEULEMENT sur GO BP.
-- ⚠ Sans le verrou, une équipe importée redevient joignable : ne pas jouer si les lots 3 à 5 sont en
-- prod et que l'interrupteur doit rester OFF. Fichier GÉNÉRÉ par scripts/civil-2026/lot7_prod.sh <date>
-- rollback : le rollback y est embarqué tel quel (LF), md5 gardé.
--
-- UNE transaction : gardes AVANT (lot 7 inscrit) → rollback → gardes APRÈS → inscription
-- (schema_migrations « rollback_civil_lot7_lancement », version = l'heure UTC du lancement ;
-- admin_operations ROLLBACK_CIVIL_LOT7_LANCEMENT) → COMMIT. Lancer SANS -1, en postgres.
-- ════════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP 1
\pset pager off
\pset null '·'

begin;
set local lock_timeout = '3s';
set local statement_timeout = '120s';
set local search_path = public, extensions;
set local application_name = 'nexus-rollback-civil-lot7';
select now() as debut, current_user, current_setting('server_version') as version;

do $$
begin
  if current_user <> 'postgres' then
    raise exception 'NEXUS: lancer en postgres, pas en %', current_user;
  end if;
  if not exists (select 1 from supabase_migrations.schema_migrations
                  where version = '@@VERSION@@' and name = 'civil_lot7_lancement') then
    raise exception 'NEXUS: lot 7 civil @@VERSION@@ non inscrit — rien à défaire';
  end if;
  if exists (select 1 from public.admin_operations where operation = 'ROLLBACK_CIVIL_LOT7_LANCEMENT') then
    raise exception 'NEXUS: le lot 7 civil a déjà été retiré';
  end if;
end $$;
select (select value from public.app_settings where key = 'lancement_civil') as interrupteur_avant,
       (select count(distinct team_id) from public.equipes_sources) as equipes_importees;

create temp table _rb on commit drop as
select to_char(clock_timestamp() at time zone 'UTC', 'YYYYMMDDHH24MISS') as version,
       $nexus_rb$@@ROLLBACK@@$nexus_rb$::text as contenu;

do $r$
begin
  if (select md5(contenu) from _rb) <> '@@MD5_ROLLBACK@@' then
    raise exception 'NEXUS: texte du rollback altéré (md5 %)', (select md5(contenu) from _rb);
  end if;
  execute (select contenu from _rb);
end $r$;
set local search_path = public, extensions;

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select version, 'rollback_civil_lot7_lancement', array[contenu], 'bptds22@gmail.com' from _rb;

insert into public.admin_operations (operation, motif, details, par)
select 'ROLLBACK_CIVIL_LOT7_LANCEMENT',
       'Import civil 2026-27 : retrait du lot 7 (interrupteur lancement_civil et verrou) (GO BP)',
       jsonb_build_object('version_retiree', '@@VERSION@@', 'version_rollback', version,
                          'fichier', 'supabase/rollback/@@VERSION@@_rollback_civil_lot7_lancement.sql',
                          'md5_rollback', '@@MD5_ROLLBACK@@', 'voie', 'psql (session pooler)'),
       (select id from public.users where id = 'f51384b5-a2c2-4827-9137-8aa8d29a1fe0')  -- BP ; NULL hors prod
  from _rb;

do $$
begin
  if exists (select 1 from pg_trigger where tgname = 'trg_verrou_lancement_civil')
     or to_regprocedure('public.lancement_civil_actif()') is not null
     or exists (select 1 from public.app_settings where key = 'lancement_civil') then
    raise exception 'NEXUS: le rollback laisse un objet du lot 7';
  end if;
  if (select count(*) from public.admin_operations where operation = 'ROLLBACK_CIVIL_LOT7_LANCEMENT') <> 1 then
    raise exception 'NEXUS: ligne admin_operations ROLLBACK_CIVIL_LOT7_LANCEMENT absente ou en double';
  end if;
end $$;
select version as version_rollback, clock_timestamp() as avant_commit from _rb;
commit;
\echo '== COMMIT fait : lot 7 civil retiré.'
