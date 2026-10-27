-- Rollback de 20261027230100_cegep_lot_c1b_verification_auto_cegep : retire la vérification
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
