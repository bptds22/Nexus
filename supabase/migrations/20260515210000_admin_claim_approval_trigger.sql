-- ────────────────────────────────────────────────────────────────
-- apply_admin_claim_approval trigger — Item 11-Security (commit 2/2)
-- ────────────────────────────────────────────────────────────────
-- Fires when a platform admin updates an admin_claims row from
-- PENDING → APPROVED or PENDING → REJECTED via /admin/approvals.
--
-- APPROVED path :
--   • users.is_school_admin = true
--   • users.profile_data.admin_type = 'owner' for claim_type='DIRECTEUR'
--     or 'interim' for claim_type='INTERIM'  (matches existing JSONB
--     convention written by DirectorChoiceStep — see app/onboarding/
--     page.tsx and CLAUDE.md)
--   • If claim_type='DIRECTEUR' AND another user on the same school
--     currently holds profile_data.admin_type='interim' + is_school_
--     admin=true, that interim is demoted: is_school_admin=false +
--     admin_type=null. Matches the "le rôle sera automatiquement
--     ramené à entraîneur" UX promise from DirectorChoiceStep.
--
-- REJECTED path :
--   • No change to users — the row landed at finish() with
--     is_school_admin=false (deferred by the wizard guard in
--     onboarding/page.tsx). User stays as Coach-only naturally.
--   • profile_data.admin_type is cleared so a stale "owner"/"interim"
--     hint left over from a prior approve→reject toggle can't fool
--     downstream readers.
--
-- SECURITY DEFINER : the trigger writes to users + profile_data which
-- normal users can't otherwise modify. The trigger only fires on
-- transitions FROM 'PENDING', so an admin can't toggle an old
-- APPROVED → REJECTED → APPROVED chain to re-trigger the demotion
-- cascade. Re-approving requires a fresh PENDING row, which the user
-- has to file via the wizard (or a future /coach/parametres ask flow).
-- ────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.apply_admin_claim_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_type TEXT;
BEGIN
  -- Only react to PENDING → terminal transitions.
  IF OLD.status IS DISTINCT FROM 'PENDING' THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'APPROVED' THEN
    v_admin_type := CASE
      WHEN NEW.claim_type = 'DIRECTEUR' THEN 'owner'
      WHEN NEW.claim_type = 'INTERIM' THEN 'interim'
      ELSE NULL
    END;

    -- Demote any sitting interim on this school when a DIRECTEUR
    -- claim is approved. Skip if the claimant somehow is the same
    -- person (shouldn't happen — wizard prevents claiming twice via
    -- the unique partial index on PENDING — but be defensive).
    IF NEW.claim_type = 'DIRECTEUR' THEN
      UPDATE public.users
      SET is_school_admin = false,
          profile_data = COALESCE(profile_data, '{}'::jsonb) || jsonb_build_object('admin_type', NULL)
      WHERE school_id = NEW.school_id
        AND is_school_admin = true
        AND COALESCE(profile_data->>'admin_type', '') = 'interim'
        AND id <> NEW.user_id;
    END IF;

    -- Promote the claimant.
    UPDATE public.users
    SET is_school_admin = true,
        profile_data = COALESCE(profile_data, '{}'::jsonb) || jsonb_build_object('admin_type', v_admin_type)
    WHERE id = NEW.user_id;

  ELSIF NEW.status = 'REJECTED' THEN
    -- Defensive cleanup. is_school_admin was never set on PENDING
    -- (wizard guard), but profile_data.admin_type was written so the
    -- claimant could read it back. Clear it on rejection.
    UPDATE public.users
    SET profile_data = COALESCE(profile_data, '{}'::jsonb) || jsonb_build_object('admin_type', NULL)
    WHERE id = NEW.user_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_apply_admin_claim_approval ON public.admin_claims;

CREATE TRIGGER trg_apply_admin_claim_approval
  AFTER UPDATE OF status ON public.admin_claims
  FOR EACH ROW
  EXECUTE FUNCTION public.apply_admin_claim_approval();

COMMENT ON FUNCTION public.apply_admin_claim_approval() IS
  'Item 11-Security: promote users.is_school_admin on APPROVED admin_claims, demote sitting interim on DIRECTEUR approval. SECURITY DEFINER — fires only on PENDING transitions.';
