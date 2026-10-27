-- ════════════════════════════════════════════════════════════════════════════
-- Lot C1b cégep — ROLLBACK RÉEL EN PROD de la version 20261027230100. À lancer SEULEMENT sur GO BP.
-- Retire la vérification automatique des cégépiens ; les fiches déjà vérifiées 'auto_cegep' RESTENT
-- vérifiées (les remettre en gris = décision à part). La valeur auto_cegep (C1a) reste dans l'enum.
-- Fichier GÉNÉRÉ par scripts/cegep-lot-c1/generer.sh c1b <date> rollback : le rollback y est embarqué
-- tel quel (LF), md5 gardé.
--
-- UNE transaction : gardes AVANT (lot C1b inscrit) → rollback → gardes APRÈS → inscription
-- (schema_migrations « rollback_cegep_lot_c1b_verification_auto_cegep », version = l'heure UTC du
-- lancement ; admin_operations ROLLBACK_CEGEP_LOT_C1B_VERIFICATION) → COMMIT. Lancer SANS -1, en postgres.
-- ════════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP 1
\pset pager off
\pset null '·'

begin;
set local lock_timeout = '3s';
set local statement_timeout = '120s';
set local search_path = public, extensions;
set local application_name = 'nexus-rollback-cegep-c1b';
select now() as debut, current_user, current_setting('server_version') as version;

do $$
begin
  if current_user <> 'postgres' then
    raise exception 'NEXUS: lancer en postgres, pas en %', current_user;
  end if;
  if not exists (select 1 from supabase_migrations.schema_migrations
                  where version = '20261027230100' and name = 'cegep_lot_c1b_verification_auto_cegep') then
    raise exception 'NEXUS: lot C1b cégep 20261027230100 non inscrit — rien à défaire';
  end if;
  if exists (select 1 from public.admin_operations where operation = 'ROLLBACK_CEGEP_LOT_C1B_VERIFICATION') then
    raise exception 'NEXUS: le lot C1b cégep a déjà été retiré';
  end if;
end $$;
select (select count(*) from public.athletes where verification_method = 'auto_cegep') as fiches_auto_cegep_qui_restent;

create temp table _rb on commit drop as
select to_char(clock_timestamp() at time zone 'UTC', 'YYYYMMDDHH24MISS') as version,
       $nexus_rb$-- Rollback de 20261027230100_cegep_lot_c1b_verification_auto_cegep : retire la vérification
-- automatique des cégépiens et rend à notify_athlete_verified / log_coach_activity_verified leurs
-- corps prod du 2026-10-27 (md5 vérifiés). Les fiches déjà vérifiées 'auto_cegep' RESTENT vérifiées :
-- les remettre en gris est une décision à part (UPDATE ciblé, sur GO).
do $garde$
begin
  if to_regprocedure('public.verification_auto_cegep()') is null then
    raise exception 'NEXUS: 20261027230100 absente, rien à annuler';
  end if;
end $garde$;

drop trigger trg_verification_auto_cegep on public.athletes;
drop function public.verification_auto_cegep();

create or replace function public.notify_athlete_verified()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$ BEGIN IF NEW.verified = true AND OLD.verified = false THEN INSERT INTO athlete_notifications (athlete_id, type, title, metadata) VALUES (NEW.id, 'COACH_REPORT_UPDATED', 'Ton coach a vérifié ton profil', jsonb_build_object('action', 'verified')); END IF; RETURN NEW; END; $function$;

create or replace function public.log_coach_activity_verified()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
BEGIN
  IF OLD.verified = false AND NEW.verified = true AND NEW.coach_id IS NOT NULL THEN
    INSERT INTO activities (type, actor_id, actor_role, athlete_id, coach_id, metadata)
    VALUES (
      'PROFILE_VERIFIED',
      NEW.coach_id,
      'coach',
      NEW.id,
      NEW.coach_id,
      jsonb_build_object(
        'first_name', NEW.first_name,
        'last_name', NEW.last_name
      )
    );
  END IF;
  RETURN NEW;
END;
$function$;

do $garde$
begin
  if (select md5(prosrc) from pg_proc where oid = 'public.notify_athlete_verified()'::regprocedure)
     is distinct from '2b618fdc40a307515b142d0809387556'
     or (select md5(prosrc) from pg_proc where oid = 'public.log_coach_activity_verified()'::regprocedure)
     is distinct from 'a85bb5d78e313807871adc8cd0710ce1' then
    raise exception 'NEXUS: les fonctions d''avis n''ont pas retrouvé leur corps prod';
  end if;
  if exists (select 1 from pg_trigger where tgname = 'trg_verification_auto_cegep') then
    raise exception 'NEXUS: rollback incomplet';
  end if;
  raise notice 'NEXUS: lot C1b cégep annulé';
end $garde$;
$nexus_rb$::text as contenu;

do $r$
begin
  if (select md5(contenu) from _rb) <> 'a71dd22deeb965a80cdd8a8d3fb6c428' then
    raise exception 'NEXUS: texte du rollback altéré (md5 %)', (select md5(contenu) from _rb);
  end if;
  execute (select contenu from _rb);
end $r$;
set local search_path = public, extensions;

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select version, 'rollback_cegep_lot_c1b_verification_auto_cegep', array[contenu], 'bptds22@gmail.com' from _rb;

insert into public.admin_operations (operation, motif, details, par)
select 'ROLLBACK_CEGEP_LOT_C1B_VERIFICATION',
       'Chantier cégep : retrait du lot C1b (vérification automatique des cégépiens) (GO BP)',
       jsonb_build_object('version_retiree', '20261027230100', 'version_rollback', version,
                          'fichier', 'supabase/rollback/20261027230100_rollback_cegep_lot_c1b_verification_auto_cegep.sql',
                          'md5_rollback', 'a71dd22deeb965a80cdd8a8d3fb6c428', 'voie', 'psql (session pooler)'),
       (select id from public.users where id = 'f51384b5-a2c2-4827-9137-8aa8d29a1fe0')  -- BP ; NULL hors prod
  from _rb;

do $$
begin
  if exists (select 1 from pg_trigger where tgname = 'trg_verification_auto_cegep')
     or to_regprocedure('public.verification_auto_cegep()') is not null
     or (select md5(prosrc) from pg_proc where oid = 'public.notify_athlete_verified()'::regprocedure) is distinct from '2b618fdc40a307515b142d0809387556'
     or (select md5(prosrc) from pg_proc where oid = 'public.log_coach_activity_verified()'::regprocedure) is distinct from 'a85bb5d78e313807871adc8cd0710ce1' then
    raise exception 'NEXUS: le rollback laisse un objet du lot C1b';
  end if;
  if (select count(*) from public.admin_operations where operation = 'ROLLBACK_CEGEP_LOT_C1B_VERIFICATION') <> 1 then
    raise exception 'NEXUS: ligne admin_operations ROLLBACK_CEGEP_LOT_C1B_VERIFICATION absente ou en double';
  end if;
end $$;
select version as version_rollback, clock_timestamp() as avant_commit from _rb;
commit;
\echo '== COMMIT fait : lot C1b cégep retiré.'
