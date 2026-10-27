-- ════════════════════════════════════════════════════════════════════════════
-- Lot C1b cégep — APPLY RÉEL EN PROD, version @@VERSION@@ (vérification automatique des cégépiens).
-- À lancer SEULEMENT sur GO BP, après C1a en prod et le rejeu à blanc C1b. Fichier GÉNÉRÉ par
-- scripts/cegep-lot-c1/generer.sh c1b <date> apply (migration embarquée, LF, md5 gardé).
--
-- UNE transaction : gardes → essai témoin AVANT (défait) → migration → essai APRÈS : un nouvel athlète
-- ancré à un cégep (INSERT en postgres, interrupteur passé ON le temps de l'essai, défait) est vérifié
-- auto_cegep ; interrupteur relu OFF → inscription (schema_migrations + admin_operations
-- MIGRATION_CEGEP_LOT_C1B_VERIFICATION) → COMMIT. Aucune fiche existante n'est modifiée.
-- Lancer SANS -1, en postgres. Rollback : docs/cegep-lot-c1/prod/c1b-rollback-<date>.sql (sur GO).
-- ════════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP 1
\pset pager off
\pset null '·'

begin;
set local lock_timeout = '3s';
set local statement_timeout = '120s';
set local search_path = public, extensions;
set local application_name = 'nexus-apply-cegep-c1b';
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
  if not exists (select 1 from supabase_migrations.schema_migrations where version = '@@VERSION_C1A@@') then
    raise exception 'NEXUS: C1a (@@VERSION_C1A@@) n''est pas inscrite — l''appliquer d''abord';
  end if;
  if exists (select 1 from public.admin_operations where operation in ('MIGRATION_CEGEP_LOT_C1B_VERIFICATION', 'ROLLBACK_CEGEP_LOT_C1B_VERIFICATION')) then
    raise exception 'NEXUS: le lot C1b a déjà laissé une trace dans admin_operations';
  end if;
  if public.lancement_collegial_actif() then
    raise exception 'NEXUS: l''interrupteur lancement_collegial est ON — C1b s''applique interrupteur OFF';
  end if;
end $$;

create temp table _verif_avant on commit drop as
select count(*) filter (where verified) as verifiees, count(*) filter (where verification_method = 'auto_cegep') as auto_cegep
  from public.athletes;

create function pg_temp.essai() returns text language plpgsql as $$
declare v_ecole uuid; v_id uuid; res text;
begin
  select s.id into v_ecole from public.schools s where s.type::text = 'CEGEP' order by s.id limit 1;
  begin
    update public.app_settings set value = 'true' where key = 'lancement_collegial';
    insert into public.athletes (first_name, last_name, school_id, status)
    values ('Apply', 'C1b', v_ecole, 'ACTIF') returning id into v_id;
    select case when a.verified then 'vérifié' else 'non vérifié' end || ' / ' || coalesce(a.verification_method::text, '·')
      into res from public.athletes a where a.id = v_id;
    raise exception using errcode = 'NX000', message = res;
  exception
    when sqlstate 'NX000' then return sqlerrm;
    when others then return 'REFUSÉ ' || sqlstate || ' ' || left(sqlerrm, 110);
  end;
end $$;
create temp table _avant on commit drop as select pg_temp.essai() as nouvel_athlete_cegep;
select 'AVANT' as phase, * from _avant;

-- ── La migration, texte gardé par son md5 ────────────────────────────────────
create temp table _c1b on commit drop as
select '@@VERSION@@'::text as version, $nexus_mig$@@MIGRATION@@$nexus_mig$::text as contenu;
select clock_timestamp() as debut_migration;
do $apply$
begin
  if (select md5(contenu) from _c1b) <> '@@MD5_MIGRATION@@' then
    raise exception 'NEXUS: texte de la migration altéré (md5 %)', (select md5(contenu) from _c1b);
  end if;
  execute (select contenu from _c1b);
end $apply$;
select clock_timestamp() as fin_migration;
set local search_path = public, extensions;

create temp table _apres on commit drop as select pg_temp.essai() as nouvel_athlete_cegep;
select 'APRÈS' as phase, * from _apres;
do $$
begin
  if public.lancement_collegial_actif() then
    raise exception 'NEXUS: l''interrupteur lit ON après l''essai';
  end if;
  if (select nouvel_athlete_cegep from _avant) <> 'non vérifié / ·' then
    raise exception 'NEXUS: essai AVANT inattendu';
  end if;
  if (select nouvel_athlete_cegep from _apres) <> 'vérifié / auto_cegep' then
    raise exception 'NEXUS: un nouvel athlète ancré au cégep n''est pas vérifié auto_cegep';
  end if;
  if (select (count(*) filter (where verified), count(*) filter (where verification_method = 'auto_cegep')) from public.athletes)
     is distinct from (select (verifiees, auto_cegep) from _verif_avant) then
    raise exception 'NEXUS: une fiche existante a changé de vérification';
  end if;
end $$;

-- ── Inscription ──────────────────────────────────────────────────────────────
insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select version, 'cegep_lot_c1b_verification_auto_cegep', array[contenu], 'bptds22@gmail.com' from _c1b;

insert into public.admin_operations (operation, motif, details, par)
select 'MIGRATION_CEGEP_LOT_C1B_VERIFICATION',
       'Chantier cégep, lot C1b : vérification automatique (auto_cegep) de tout nouvel ancrage à un cégep ; pas d''avis « ton coach a vérifié » pour elle (GO BP 2026-10-27)',
       jsonb_build_object(
         'nom', 'cegep_lot_c1b_verification_auto_cegep',
         'version', version,
         'fichier', 'supabase/migrations/' || version || '_cegep_lot_c1b_verification_auto_cegep.sql',
         'rollback', 'supabase/rollback/' || version || '_rollback_cegep_lot_c1b_verification_auto_cegep.sql',
         'md5_fichier', '@@MD5_MIGRATION@@',
         'md5_rollback', '@@MD5_ROLLBACK@@',
         'fiches_modifiees', 0,
         'voie', 'psql (session pooler)'),
       (select id from public.users where id = 'f51384b5-a2c2-4827-9137-8aa8d29a1fe0')  -- BP ; NULL hors prod
  from _c1b;

do $$
begin
  if not exists (select 1 from supabase_migrations.schema_migrations
                  where version = '@@VERSION@@' and name = 'cegep_lot_c1b_verification_auto_cegep') then
    raise exception 'NEXUS: inscription schema_migrations absente';
  end if;
  if (select count(*) from public.admin_operations where operation = 'MIGRATION_CEGEP_LOT_C1B_VERIFICATION') <> 1 then
    raise exception 'NEXUS: ligne admin_operations MIGRATION_CEGEP_LOT_C1B_VERIFICATION absente ou en double';
  end if;
end $$;

select version as version_inscrite,
       (select value from public.app_settings where key = 'lancement_collegial') as interrupteur,
       clock_timestamp() as avant_commit
  from _c1b;
commit;
\echo '== COMMIT fait : lot C1b cégep en prod (vérification automatique, interrupteur OFF).'
