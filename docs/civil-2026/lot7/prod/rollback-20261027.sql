-- ════════════════════════════════════════════════════════════════════════════
-- Lot 7 civil — ROLLBACK RÉEL EN PROD de la version 20261027150000. À lancer SEULEMENT sur GO BP.
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
                  where version = '20261027150000' and name = 'civil_lot7_lancement') then
    raise exception 'NEXUS: lot 7 civil 20261027150000 non inscrit — rien à défaire';
  end if;
  if exists (select 1 from public.admin_operations where operation = 'ROLLBACK_CIVIL_LOT7_LANCEMENT') then
    raise exception 'NEXUS: le lot 7 civil a déjà été retiré';
  end if;
end $$;
select (select value from public.app_settings where key = 'lancement_civil') as interrupteur_avant,
       (select count(distinct team_id) from public.equipes_sources) as equipes_importees;

create temp table _rb on commit drop as
select to_char(clock_timestamp() at time zone 'UTC', 'YYYYMMDDHH24MISS') as version,
       $nexus_rb$-- Rollback de 20261027150000_civil_lot7_lancement : retire le verrou et l'interrupteur.
-- Sans le verrou, une équipe importée redevient joignable par tous les chemins : à ne jouer
-- que si les lots 3 à 5 ne sont PAS en prod, ou après les avoir annulés.
do $garde$
begin
  if to_regprocedure('public.verrou_lancement_civil()') is null then
    raise exception 'NEXUS: 20261027150000 absente, rien à annuler';
  end if;
end $garde$;

drop trigger trg_verrou_lancement_civil on public.team_athletes;
drop trigger trg_verrou_lancement_civil on public.team_coaches;
drop function public.verrou_lancement_civil();
drop function public.lancement_civil_actif();
delete from public.app_settings where key = 'lancement_civil';

do $garde$
begin
  if exists (select 1 from pg_trigger where tgname = 'trg_verrou_lancement_civil')
     or to_regprocedure('public.lancement_civil_actif()') is not null
     or exists (select 1 from public.app_settings where key = 'lancement_civil') then
    raise exception 'NEXUS: rollback incomplet';
  end if;
  raise notice 'NEXUS: lot 7 civil annulé (verrou et interrupteur retirés)';
end $garde$;
$nexus_rb$::text as contenu;

do $r$
begin
  if (select md5(contenu) from _rb) <> '341ac6212860cc824e374204f4308e51' then
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
       jsonb_build_object('version_retiree', '20261027150000', 'version_rollback', version,
                          'fichier', 'supabase/rollback/20261027150000_rollback_civil_lot7_lancement.sql',
                          'md5_rollback', '341ac6212860cc824e374204f4308e51', 'voie', 'psql (session pooler)'),
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
