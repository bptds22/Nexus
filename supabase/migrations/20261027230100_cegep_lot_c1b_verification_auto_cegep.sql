-- NON APPLIQUÉE EN PROD. Chantier cégep, LOT C1b (GO BP 2026-10-27, décision 4) : tout cégépien reçoit
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
