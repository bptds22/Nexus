-- ═══════════════════════════════════════════════════════════════
-- Phase 6.2.c-1-pivot — Tighter RLS on athlete autocomplete
--
-- Context: pivoted from email-exact lookup (6.2.c-1) to name
-- autocomplete. Privacy hardening : restrict the SELECT scope to
-- athletes with school_id IS NULL (orphans only).
--
-- This prevents :
-- - Cross-school athlete browsing
-- - Information leak on athletes already affiliated
--
-- Coaches can still INVITE athletes already in another school via
-- the email-exact path at submit (6.2.c-2 modal future), but they
-- CANNOT browse them via autocomplete.
--
-- Reuses is_coach() SECURITY DEFINER helper from 6.2.c-1.
-- ═══════════════════════════════════════════════════════════════

BEGIN;

-- Drop the previous broader policy from 6.2.c-1
DROP POLICY IF EXISTS "Coaches lookup athletes by email" ON public.users;

-- New tighter policy : coaches can SELECT users that are :
--   1. role = ATHLETE
--   2. AND linked to an athletes row with school_id IS NULL (orphan)
--   3. AND the requester is a COACH (via is_coach() helper)
DROP POLICY IF EXISTS "Coaches lookup orphan athletes" ON public.users;

CREATE POLICY "Coaches lookup orphan athletes" ON public.users
FOR SELECT
TO authenticated
USING (
  is_coach()
  AND role = 'ATHLETE'
  AND EXISTS (
    SELECT 1
    FROM athletes
    WHERE athletes.user_id = users.id
      AND athletes.school_id IS NULL
  )
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'users'
      AND policyname = 'Coaches lookup orphan athletes'
  ) THEN
    RAISE EXCEPTION 'New policy not created';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'users'
      AND policyname = 'Coaches lookup athletes by email'
  ) THEN
    RAISE EXCEPTION 'Old policy not removed';
  END IF;
END $$;

COMMIT;
