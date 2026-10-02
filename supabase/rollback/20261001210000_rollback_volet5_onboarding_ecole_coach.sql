-- ROLLBACK du volet 5 (20261001210000) : repose le corps EN PROD au 2026-10-01
-- avant le volet 5 (md5 pg_get_functiondef = e92ffb4a1d47226c22bc704e5bcb31d8),
-- c.-à-d. school_id / coach_id refusés à l'athlète même pendant l'onboarding.
-- CREATE OR REPLACE : ACL inchangée ; vérifiée en entier ci-dessous.
CREATE OR REPLACE FUNCTION public.enforce_athlete_self_edit_perimeter()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_bloquees text[] := ARRAY[]::text[];
BEGIN
  -- Pas l'athlète lui-même en écriture DIRECTE ? On ne s'en mêle pas.
  -- En INVOKER, current_user = 'authenticated' pour un UPDATE venu du client,
  -- et le propriétaire de la fonction appelante pour un chemin DEFINER.
  -- ⚠ EXCLUSION VOLONTAIRE : statut_recrutement_override n'est PAS bloquée —
  -- règle produit CLAUDE.md, l'écriture athlète y est légitime.
  IF current_user <> 'authenticated'
     OR auth.uid() IS NULL
     OR OLD.user_id IS NULL
     OR auth.uid() <> OLD.user_id THEN
    RETURN NEW;
  END IF;

  IF NEW.user_id   IS DISTINCT FROM OLD.user_id   THEN v_bloquees := array_append(v_bloquees, 'user_id');   END IF;
  IF NEW.coach_id  IS DISTINCT FROM OLD.coach_id  THEN v_bloquees := array_append(v_bloquees, 'coach_id');  END IF;
  IF NEW.school_id IS DISTINCT FROM OLD.school_id THEN v_bloquees := array_append(v_bloquees, 'school_id'); END IF;
  IF NEW.status    IS DISTINCT FROM OLD.status    THEN v_bloquees := array_append(v_bloquees, 'status');    END IF;

  IF NEW.verified            IS DISTINCT FROM OLD.verified            THEN v_bloquees := array_append(v_bloquees, 'verified');            END IF;
  IF NEW.verified_at         IS DISTINCT FROM OLD.verified_at         THEN v_bloquees := array_append(v_bloquees, 'verified_at');         END IF;
  IF NEW.verified_by         IS DISTINCT FROM OLD.verified_by         THEN v_bloquees := array_append(v_bloquees, 'verified_by');         END IF;
  IF NEW.verification_method IS DISTINCT FROM OLD.verification_method THEN v_bloquees := array_append(v_bloquees, 'verification_method'); END IF;

  IF NEW.cote_globale_entraineur IS DISTINCT FROM OLD.cote_globale_entraineur THEN v_bloquees := array_append(v_bloquees, 'cote_globale_entraineur'); END IF;

  IF NEW.profile_completion IS DISTINCT FROM OLD.profile_completion THEN v_bloquees := array_append(v_bloquees, 'profile_completion'); END IF;
  IF NEW.is_showcase        IS DISTINCT FROM OLD.is_showcase        THEN v_bloquees := array_append(v_bloquees, 'is_showcase');        END IF;

  IF NEW.consentement_parental      IS DISTINCT FROM OLD.consentement_parental      THEN v_bloquees := array_append(v_bloquees, 'consentement_parental');      END IF;
  IF NEW.consentement_parental_date IS DISTINCT FROM OLD.consentement_parental_date THEN v_bloquees := array_append(v_bloquees, 'consentement_parental_date'); END IF;
  IF NEW.partner_visibility_opt_in            IS DISTINCT FROM OLD.partner_visibility_opt_in            THEN v_bloquees := array_append(v_bloquees, 'partner_visibility_opt_in');            END IF;
  IF NEW.partner_visibility_opted_in_at       IS DISTINCT FROM OLD.partner_visibility_opted_in_at       THEN v_bloquees := array_append(v_bloquees, 'partner_visibility_opted_in_at');       END IF;
  IF NEW.partner_visibility_parental_consent  IS DISTINCT FROM OLD.partner_visibility_parental_consent  THEN v_bloquees := array_append(v_bloquees, 'partner_visibility_parental_consent');  END IF;

  IF NEW.recruitment_status            IS DISTINCT FROM OLD.recruitment_status            THEN v_bloquees := array_append(v_bloquees, 'recruitment_status');            END IF;
  IF NEW.recruitment_status_changed_by IS DISTINCT FROM OLD.recruitment_status_changed_by THEN v_bloquees := array_append(v_bloquees, 'recruitment_status_changed_by'); END IF;
  IF NEW.recruitment_status_changed_at IS DISTINCT FROM OLD.recruitment_status_changed_at THEN v_bloquees := array_append(v_bloquees, 'recruitment_status_changed_at'); END IF;
  IF NEW.committed_school_id           IS DISTINCT FROM OLD.committed_school_id           THEN v_bloquees := array_append(v_bloquees, 'committed_school_id');           END IF;

  -- date_naissance : libre PENDANT l'onboarding, protégée APRÈS (2026-09-21).
  -- Ferme les deux sens du trou de consentement (voir l'en-tête). La lecture
  -- de users passe : l'auteur est ici l'athlète lui-même, et « users read
  -- own » lui rend sa propre ligne. `IS TRUE` : un onboarding_complete NULL
  -- vaut « pas fini », comme partout ailleurs (=== true côté client).
  IF NEW.date_naissance IS DISTINCT FROM OLD.date_naissance
     AND EXISTS (SELECT 1 FROM public.users u
                  WHERE u.id = OLD.user_id AND u.onboarding_complete IS TRUE) THEN
    v_bloquees := array_append(v_bloquees, 'date_naissance');
  END IF;

  IF array_length(v_bloquees, 1) IS NOT NULL THEN
    RAISE EXCEPTION 'NEXUS: ces informations ne se modifient pas depuis ton profil (%). Elles sont tenues par ton entraîneur ou par Nexus.',
      array_to_string(v_bloquees, ', ');
  END IF;

  RETURN NEW;
END;
$function$

;

DO $$
DECLARE vus text[]; veut text[] := ARRAY['authenticated','postgres'];
BEGIN
  SELECT array_agg(t.g ORDER BY t.g) INTO vus
    FROM pg_proc pr,
         LATERAL (SELECT coalesce(nullif(split_part(x,'=',1),''),'PUBLIC') AS g FROM unnest(pr.proacl::text[]) AS x) t
   WHERE pr.oid = 'public.enforce_athlete_self_edit_perimeter'::regproc;
  IF vus IS DISTINCT FROM veut THEN RAISE EXCEPTION 'NEXUS: ACL = %, attendu %', vus, veut; END IF;
  IF md5(pg_get_functiondef('public.enforce_athlete_self_edit_perimeter'::regproc)) <> 'e92ffb4a1d47226c22bc704e5bcb31d8' THEN
    RAISE EXCEPTION 'NEXUS: rollback — corps différent de l''état d''avant volet 5';
  END IF;
END $$;
