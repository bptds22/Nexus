-- ═══════════════════════════════════════════════════════════════
-- Phase 6.2.a-hotfix — Add INSERT policy on school_coaches
--
-- Context: pre-existing gap discovered during 6.2.a manual tests.
-- Without this policy, no coach (école or civil) can complete the
-- onboarding wizard — the school_coaches row is silently not created
-- because school_coaches had only SELECT + UPDATE policies (héritage
-- baseline + 5.x). RLS default-deny blocks every INSERT silently.
--
-- Policy (γ) authorizes BOTH :
--   (α) Coach inserts their own row  (coach_id = auth.uid())
--   (β) DIRECTEUR / DIRECTEUR_INTERIM inserts for another coach on
--       their school (approval flow "Inviter quelqu'un")
--
-- DELETE policy also missing but not blocking — parked P3 cleanup.
-- ═══════════════════════════════════════════════════════════════

BEGIN;

DROP POLICY IF EXISTS "Coaches insert school_coaches" ON public.school_coaches;

CREATE POLICY "Coaches insert school_coaches" ON public.school_coaches
FOR INSERT
TO authenticated
WITH CHECK (
  -- (α) Self-insert : coach créé sa propre row à l'onboarding
  coach_id = auth.uid()
  OR
  -- (β) Director-insert : un DIRECTEUR de la même school invite un coach
  EXISTS (
    SELECT 1
    FROM school_coaches sc_dir
    WHERE sc_dir.coach_id = auth.uid()
      AND sc_dir.school_id = school_coaches.school_id
      AND sc_dir.role IN ('DIRECTEUR', 'DIRECTEUR_INTERIM')
  )
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'school_coaches'
      AND policyname = 'Coaches insert school_coaches'
  ) THEN
    RAISE EXCEPTION 'Policy not created';
  END IF;
END $$;

COMMIT;
