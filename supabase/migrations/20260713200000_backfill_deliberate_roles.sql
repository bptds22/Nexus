-- =====================================================================
-- BACKFILL -- roles deliberement choisis avant l'existence de role_claimed_at
-- =====================================================================
-- ADDENDUM a 20260713190000_claim_signup_role.sql.
--
-- Probleme : le premier backfill n'a stampe que les comptes ETABLIS
-- (onboarding_complete = true, ou role ADMIN/PARTNER). Restent a NULL les
-- comptes encore en cours d'onboarding -- ce qui est VOULU pour les comptes
-- casses par le bug OAuth natif (ils doivent pouvoir reclamer leur role).
--
-- Mais ca ratisse trop large : un compte dont le role N'EST PAS le defaut du
-- trigger ('ATHLETE') n'a pas pu l'obtenir par accident. Il a forcement ete
-- choisi -- par le picker web (/auth/callback), par le signup email, ou par un
-- admin. Le laisser a NULL ferait redemander son role a cet utilisateur au
-- prochain login, via le filet de securite de /auth/callback.
--
-- Cas concret en prod aujourd'hui :
--   bpdesfosses@gmail.com -- COACH, context=scolaire, inscrit via le picker
--   WEB (Google), onboarding non termine, role_claimed_at NULL.
--
-- Regle : role <> 'ATHLETE' => le role a ete reclame deliberement => on stampe.
-- Les comptes ATHLETE avec role_claimed_at NULL restent reclamables : ce sont
-- exactement les victimes potentielles du bug (defaut du trigger), et c'est
-- leur chemin d'auto-reparation.
-- =====================================================================

BEGIN;

UPDATE public.users
SET    role_claimed_at = now()
WHERE  role_claimed_at IS NULL
  AND  role <> 'ATHLETE';

-- Verification : plus aucun compte non-ATHLETE ne doit rester reclamable.
DO $$
DECLARE
  v_restants int;
BEGIN
  SELECT count(*) INTO v_restants
  FROM public.users
  WHERE role_claimed_at IS NULL AND role <> 'ATHLETE';

  IF v_restants <> 0 THEN
    RAISE EXCEPTION 'VERIF: % compte(s) non-ATHLETE encore reclamable(s) -- ROLLBACK', v_restants;
  END IF;

  RAISE NOTICE 'OK : tous les roles non-ATHLETE sont figes. Seuls les ATHLETE en onboarding restent reclamables.';
END $$;

COMMIT;
