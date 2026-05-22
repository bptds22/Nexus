-- Loi 25 — self-service account deactivation RPC.
--
-- public.users.status is locked against self-updates: the "users update own"
-- policy's WITH CHECK calls user_privileged_cols_unchanged(role, status, ...),
-- which forces status to stay identical — a deliberate guard against self
-- role/status escalation. That guard is correct; we do NOT loosen the policy.
--
-- Instead this SECURITY DEFINER RPC grants exactly ONE safe self-action:
-- deactivate THE CALLER'S OWN account. It is keyed strictly on auth.uid() and
-- can target no one else, so it does not reintroduce the escalation risk the
-- policy guards against.
--
-- Role-agnostic: always sets users.status; the athletes UPDATE matches 0 rows
-- for a non-athlete caller (coach / recruteur) — a harmless no-op.
--   p_revoke_consent = true  -> also clears athletes.consentement_parental
--                               (Loi 25 parental-consent revocation)
--   p_revoke_consent = false -> plain account deactivation, consent untouched
--
-- status = 'DESACTIVE' is a SOFT deactivation + data retention (no hard
-- delete). The row then surfaces in /admin/desactivations for admin
-- reactivation, and login is gated by the users.status check in /auth.

CREATE OR REPLACE FUNCTION public.deactivate_my_account(p_revoke_consent boolean DEFAULT false)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET row_security = off
 SET search_path = public
AS $function$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  UPDATE public.users
     SET status = 'DESACTIVE'
   WHERE id = v_uid;

  UPDATE public.athletes
     SET status = 'DESACTIVE',
         consentement_parental = CASE WHEN p_revoke_consent
                                      THEN false
                                      ELSE consentement_parental END
   WHERE user_id = v_uid;
END;
$function$;

-- Only signed-in users may call it (anon would hit the 'Not authenticated'
-- guard anyway, but revoke the default PUBLIC execute grant regardless).
REVOKE ALL ON FUNCTION public.deactivate_my_account(boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.deactivate_my_account(boolean) TO authenticated;
