-- Fix: check_recruiter_email_domain() wrote to NEW.verified, but users.verified
-- does not exist (that column lives on athletes). Every recruiter INSERT into
-- public.users failed with "record \"new\" has no field \"verified\"".
--
-- Root cause: the function appears to have been ported from athletes-context
-- verification logic. The verified flag concept was meant for athlete profiles,
-- not recruiter accounts. The function's admin-notification behavior already
-- covers the recruiter verification workflow (flag for manual admin review
-- when email domain doesn't match a known CEGEP).
--
-- Fix: strip the two NEW.verified := ... assignments. The function now:
--   - Short-circuits for non-RECRUTEUR roles
--   - Looks up the auth email + checks whether its domain matches a known
--     CEGEP via cegep_email_domains
--   - If no match, inserts an admin_notifications row flagging the account
--     for manual review
--   - Always RETURN NEW — no blocking, no attempt to write a non-existent column
--
-- Also adds SET search_path = public for consistency with the Phase 0.7 /
-- Phase 1 SECURITY DEFINER hardening pattern.

CREATE OR REPLACE FUNCTION public.check_recruiter_email_domain()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  user_email TEXT;
  user_domain TEXT;
  domain_match BOOLEAN;
  school_name TEXT;
BEGIN
  IF NEW.role::text != 'RECRUTEUR' THEN
    RETURN NEW;
  END IF;

  SELECT email INTO user_email FROM auth.users WHERE id = NEW.id;

  IF user_email IS NULL THEN
    RETURN NEW;
  END IF;

  user_domain := split_part(user_email, '@', 2);

  SELECT EXISTS(
    SELECT 1 FROM cegep_email_domains WHERE domain = user_domain
  ) INTO domain_match;

  IF NEW.school_id IS NOT NULL THEN
    SELECT name INTO school_name FROM schools WHERE id = NEW.school_id;
  END IF;

  -- Recognized CEGEP domain -> nothing to do (short-circuit).
  -- Unknown domain -> flag for manual admin review.
  IF NOT domain_match THEN
    INSERT INTO admin_notifications (type, title, message, related_user_id)
    VALUES (
      'RECRUITER_VERIFICATION',
      'Nouveau recruteur a verifier',
      'Le recruteur ' || COALESCE(NEW.first_name, '') || ' ' || COALESCE(NEW.last_name, '') ||
      ' (' || COALESCE(user_email, 'email inconnu') || ')' ||
      ' s est inscrit comme recruteur' ||
      CASE WHEN school_name IS NOT NULL THEN ' pour ' || school_name ELSE '' END ||
      '. Verification manuelle requise.',
      NEW.id
    );
  END IF;

  RETURN NEW;
END;
$function$;
