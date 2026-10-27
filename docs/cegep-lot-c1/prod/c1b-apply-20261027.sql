-- ════════════════════════════════════════════════════════════════════════════
-- Lot C1b cégep — APPLY RÉEL EN PROD, version 20261027230100 (vérification automatique des cégépiens).
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
  if exists (select 1 from supabase_migrations.schema_migrations where version = '20261027230100') then
    raise exception 'NEXUS: version 20261027230100 déjà inscrite';
  end if;
  select max(version) into v from supabase_migrations.schema_migrations;
  if v >= '20261027230100' then raise exception 'NEXUS: version 20261027230100 pas après la dernière (%) — régénérer', v; end if;
  if not exists (select 1 from supabase_migrations.schema_migrations where version = '20261027230000') then
    raise exception 'NEXUS: C1a (20261027230000) n''est pas inscrite — l''appliquer d''abord';
  end if;
  if v is distinct from '20261027230000' then
    raise exception 'NEXUS: dernière version % au lieu de 20261027230000 (C1a)', v;
  end if;
  if to_regprocedure('public.verification_auto_cegep()') is not null
     or exists (select 1 from pg_trigger where tgname = 'trg_verification_auto_cegep') then
    raise exception 'NEXUS: C1b est déjà présente (fonction ou trigger)';
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
select '20261027230100'::text as version, $nexus_mig$-- NON APPLIQUÉE EN PROD. Chantier cégep, LOT C1b (GO BP 2026-10-27, décision 4) : tout cégépien reçoit
-- AUTOMATIQUEMENT le crochet bleu, 17 ans compris, avec verification_method = 'auto_cegep'.
-- Préalable : 20261027230000 (C1a, valeur auto_cegep) EN PROD.
--
--   1. verification_auto_cegep() : trigger BEFORE INSERT OR UPDATE OF school_id sur athletes.
--      · Un NOUVEL ancrage à une école CEGEP (INSERT, ou school_id qui change) d'une fiche non
--        vérifiée → verified = true, verification_method = 'auto_cegep', verified_at = now(),
--        verified_by = NULL (personne n'a vérifié).
--      · Une fiche déjà vérifiée par un humain (manuel_coach, manuel_directeur, auto) n'est pas
--        touchée.
--      · Une fiche 'auto_cegep' qui quitte le cégep (nouvelle école non CEGEP, ou plus d'école)
--        repasse en gris : verified = false, méthode / date / auteur effacés.
--      · Une ligne qui garde son école passe telle quelle : le cégépien déjà ancré avant C1b n'est
--        PAS vérifié rétroactivement (décision 5 : rien de modifié en base pour lui).
--      Ordre des triggers BEFORE (alphabétique) : trg_athlete_self_edit_perimeter compare d'abord ce
--      que le CLIENT envoie (verified inchangé) ; trg_verification_auto_cegep pose ensuite la
--      vérification ; trg_verrou_lancement_collegial (C0) refuse l'ancrage tant que l'interrupteur
--      est OFF — sous OFF, rien n'est donc vérifié.
--   2. notify_athlete_verified() et log_coach_activity_verified() : n'écrivent plus rien pour une
--      vérification 'auto_cegep' (« Ton coach a vérifié ton profil » et une activité PROFILE_VERIFIED
--      au nom d'un coach seraient faux : aucun coach n'a vérifié). Corps prod relevés le 2026-10-27
--      (md5 gardés), seule la condition change.
-- Aucune table, aucune colonne, aucune policy ; aucune ligne existante modifiée.

-- ── GARDES D'AVANT ───────────────────────────────────────────────────────────
do $garde$
begin
  if to_regprocedure('public.verification_auto_cegep()') is not null
     or exists (select 1 from pg_trigger where tgname = 'trg_verification_auto_cegep') then
    raise exception 'NEXUS: 20261027230100 déjà appliquée';
  end if;
  if not exists (select 1 from pg_enum where enumtypid = 'public.verification_method'::regtype
                                         and enumlabel = 'auto_cegep') then
    raise exception 'NEXUS: préalable C1a (valeur auto_cegep) absent';
  end if;
  if to_regprocedure('public.lancement_collegial_actif()') is null
     or not exists (select 1 from pg_trigger where tgname = 'trg_verrou_lancement_collegial'
                                               and tgrelid = 'public.athletes'::regclass) then
    raise exception 'NEXUS: préalable C0 (interrupteur et verrou) absent';
  end if;
  if (select md5(prosrc) from pg_proc where oid = 'public.notify_athlete_verified()'::regprocedure)
     is distinct from '2b618fdc40a307515b142d0809387556' then
    raise exception 'NEXUS: notify_athlete_verified n''est pas le corps prod relevé le 2026-10-27';
  end if;
  if (select md5(prosrc) from pg_proc where oid = 'public.log_coach_activity_verified()'::regprocedure)
     is distinct from 'a85bb5d78e313807871adc8cd0710ce1' then
    raise exception 'NEXUS: log_coach_activity_verified n''est pas le corps prod relevé le 2026-10-27';
  end if;
end $garde$;

-- ── 1. La vérification automatique ───────────────────────────────────────────
create function public.verification_auto_cegep()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  -- Seul un NOUVEL ancrage est regardé, comme le verrou du lot C0 : une ligne qui garde son école
  -- passe telle quelle.
  if tg_op = 'UPDATE' and old.school_id is not distinct from new.school_id then
    return new;
  end if;
  if new.school_id is not null
     and exists (select 1 from public.schools s where s.id = new.school_id and s.type::text = 'CEGEP') then
    if not coalesce(new.verified, false) then
      new.verified := true;
      new.verification_method := 'auto_cegep';
      new.verified_at := now();
      new.verified_by := null;
    end if;
  elsif tg_op = 'UPDATE' and old.verification_method = 'auto_cegep' then
    -- Le crochet ne valait que pour le cégep : il ne suit pas l'athlète ailleurs.
    new.verified := false;
    new.verification_method := null;
    new.verified_at := null;
    new.verified_by := null;
  end if;
  return new;
end;
$function$;

create trigger trg_verification_auto_cegep
  before insert or update of school_id on public.athletes
  for each row execute function public.verification_auto_cegep();

-- ── 2. Pas d'avis « ton coach a vérifié » pour une vérification automatique ─
create or replace function public.notify_athlete_verified()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$ BEGIN IF NEW.verified = true AND OLD.verified = false AND NEW.verification_method IS DISTINCT FROM 'auto_cegep' THEN INSERT INTO athlete_notifications (athlete_id, type, title, metadata) VALUES (NEW.id, 'COACH_REPORT_UPDATED', 'Ton coach a vérifié ton profil', jsonb_build_object('action', 'verified')); END IF; RETURN NEW; END; $function$;

create or replace function public.log_coach_activity_verified()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
BEGIN
  IF OLD.verified = false AND NEW.verified = true AND NEW.coach_id IS NOT NULL
     AND NEW.verification_method IS DISTINCT FROM 'auto_cegep' THEN
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

-- ── ACL : une fonction de trigger ne s'appelle pas directement ───────────────
revoke all on function public.verification_auto_cegep() from public, anon, authenticated;
grant execute on function public.verification_auto_cegep() to postgres, service_role;

-- ── GARDES D'APRÈS ───────────────────────────────────────────────────────────
do $garde$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_verification_auto_cegep'
                                            and tgrelid = 'public.athletes'::regclass and tgenabled = 'O') then
    raise exception 'NEXUS: trigger trg_verification_auto_cegep absent ou inactif';
  end if;
  -- L'ordre compte (les triggers BEFORE partent dans l'ordre de leur nom) : la garde de périmètre
  -- AVANT la vérification, le verrou C0 APRÈS.
  if (select string_agg(tgname, ',' order by tgname collate "C") from pg_trigger
       where tgrelid = 'public.athletes'::regclass
         and tgname in ('trg_athlete_self_edit_perimeter', 'trg_verification_auto_cegep', 'trg_verrou_lancement_collegial'))
     is distinct from 'trg_athlete_self_edit_perimeter,trg_verification_auto_cegep,trg_verrou_lancement_collegial' then
    raise exception 'NEXUS: ordre des triggers BEFORE inattendu';
  end if;
  if (select proacl::text from pg_proc where oid = 'public.verification_auto_cegep()'::regprocedure)
     is distinct from '{postgres=X/postgres,service_role=X/postgres}' then
    raise exception 'NEXUS: ACL de verification_auto_cegep inattendue';
  end if;
  raise notice 'NEXUS: lot C1b cégep — vérification automatique des cégépiens en place';
end $garde$;
$nexus_mig$::text as contenu;
select clock_timestamp() as debut_migration;
do $apply$
begin
  if (select md5(contenu) from _c1b) <> '34cc976b66aac462f185777419a205f6' then
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
         'md5_fichier', '34cc976b66aac462f185777419a205f6',
         'md5_rollback', 'a71dd22deeb965a80cdd8a8d3fb6c428',
         'fiches_modifiees', 0,
         'voie', 'psql (session pooler)'),
       (select id from public.users where id = 'f51384b5-a2c2-4827-9137-8aa8d29a1fe0')  -- BP ; NULL hors prod
  from _c1b;

do $$
begin
  if not exists (select 1 from supabase_migrations.schema_migrations
                  where version = '20261027230100' and name = 'cegep_lot_c1b_verification_auto_cegep') then
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
