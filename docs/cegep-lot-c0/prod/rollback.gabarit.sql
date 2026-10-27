-- ════════════════════════════════════════════════════════════════════════════
-- Lot C0 cégep — ROLLBACK RÉEL EN PROD de la version @@VERSION@@. À lancer SEULEMENT sur GO BP.
-- ⚠ Rouvre les écritures recruteur collégial → cégépien et retire le verrou d'ancrage : ne pas jouer
-- si des cégépiens peuvent s'inscrire. Fichier GÉNÉRÉ par scripts/cegep-lot-c0/generer.sh <date>
-- rollback : le rollback y est embarqué tel quel (LF), md5 gardé.
--
-- UNE transaction : gardes AVANT (lot C0 inscrit) → rollback → gardes APRÈS → inscription
-- (schema_migrations « rollback_cegep_lot_c0_base », version = l'heure UTC du lancement ;
-- admin_operations ROLLBACK_CEGEP_LOT_C0_BASE) → COMMIT. Lancer SANS -1, en postgres.
-- ════════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP 1
\pset pager off
\pset null '·'

begin;
set local lock_timeout = '3s';
set local statement_timeout = '120s';
set local search_path = public, extensions;
set local application_name = 'nexus-rollback-cegep-c0';
select now() as debut, current_user, current_setting('server_version') as version;

do $$
begin
  if current_user <> 'postgres' then
    raise exception 'NEXUS: lancer en postgres, pas en %', current_user;
  end if;
  if not exists (select 1 from supabase_migrations.schema_migrations
                  where version = '@@VERSION@@' and name = 'cegep_lot_c0_base') then
    raise exception 'NEXUS: lot C0 cégep @@VERSION@@ non inscrit — rien à défaire';
  end if;
  if exists (select 1 from public.admin_operations where operation = 'ROLLBACK_CEGEP_LOT_C0_BASE') then
    raise exception 'NEXUS: le lot C0 cégep a déjà été retiré';
  end if;
end $$;
select (select value from public.app_settings where key = 'lancement_collegial') as interrupteur_avant,
       (select count(*) from pg_policies where policyname = 'cegepiens_ecriture_recruteurs') as policies;

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
select version, 'rollback_cegep_lot_c0_base', array[contenu], 'bptds22@gmail.com' from _rb;

insert into public.admin_operations (operation, motif, details, par)
select 'ROLLBACK_CEGEP_LOT_C0_BASE',
       'Chantier cégep : retrait du lot C0 (écritures recruteur collégial → cégépien, interrupteur lancement_collegial, verrou) (GO BP)',
       jsonb_build_object('version_retiree', '@@VERSION@@', 'version_rollback', version,
                          'fichier', 'supabase/rollback/@@VERSION@@_rollback_cegep_lot_c0_base.sql',
                          'md5_rollback', '@@MD5_ROLLBACK@@', 'voie', 'psql (session pooler)'),
       (select id from public.users where id = 'f51384b5-a2c2-4827-9137-8aa8d29a1fe0')  -- BP ; NULL hors prod
  from _rb;

do $$
begin
  if exists (select 1 from pg_trigger where tgname = 'trg_verrou_lancement_collegial')
     or exists (select 1 from pg_policies where policyname = 'cegepiens_ecriture_recruteurs')
     or (select md5(prosrc) from pg_proc where oid = 'public.is_athlete_contactable(uuid)'::regprocedure) is distinct from 'fe2ea3e93c6ed4036d249b7d406d3e56'
     or to_regprocedure('public.lancement_collegial_actif()') is not null
     or exists (select 1 from public.app_settings where key = 'lancement_collegial') then
    raise exception 'NEXUS: le rollback laisse un objet du lot C0';
  end if;
  if (select count(*) from public.admin_operations where operation = 'ROLLBACK_CEGEP_LOT_C0_BASE') <> 1 then
    raise exception 'NEXUS: ligne admin_operations ROLLBACK_CEGEP_LOT_C0_BASE absente ou en double';
  end if;
end $$;
select version as version_rollback, clock_timestamp() as avant_commit from _rb;
commit;
\echo '== COMMIT fait : lot C0 cégep retiré.'
