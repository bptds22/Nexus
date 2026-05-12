-- ═══════════════════════════════════════════════════════════════
-- Phase 6.2.c-1 — Allow coaches to look up athletes by email
--
-- Context: feature "invitation par email" sur /coach/athletes/create
-- nécessite que les coaches puissent vérifier si un email correspond
-- à un athlete existant pour décider invitation vs création de profil.
--
-- Pre-existing state: users SELECT policies allow own row + coaches +
-- messaging participants + admins. AUCUNE policy ne permet aux coaches
-- de voir des athletes.
--
-- Implementation: ajoute (1) une helper SECURITY DEFINER `is_coach()`
-- — mirror du `is_admin()` existant — pour éviter la récursion RLS
-- qu'aurait un `SELECT FROM users` direct dans la policy, et (2) une
-- nouvelle policy qui autorise les coaches à lire les rows ATHLETE.
--
-- Privacy constraint: la policy retourne SEULEMENT les rows ATHLETE.
-- Recruteurs et admins ne sont jamais exposés via cette policy.
--
-- Mitigation oracle: combiné avec rate limit côté code (10/60s) +
-- email regex gate dans lib/coach/athleteEmailLookup.ts. À renforcer
-- en post-launch (server-side rate limit) si besoin.
-- ═══════════════════════════════════════════════════════════════

BEGIN;

-- (1) Helper SECURITY DEFINER pour éviter récursion RLS dans la policy
CREATE OR REPLACE FUNCTION public.is_coach()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
      AND role = 'COACH'
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_coach() TO authenticated;

-- (2) Drop la policy si elle existe (idempotent re-run safe — la
-- version récursive a été remplacée)
DROP POLICY IF EXISTS "Coaches lookup athletes by email" ON public.users;

CREATE POLICY "Coaches lookup athletes by email" ON public.users
FOR SELECT
TO authenticated
USING (
  -- Requester doit être coach (via SECURITY DEFINER → pas de récursion)
  is_coach()
  AND
  -- Row lue doit être un athlete (pas recruteur, admin, autre coach)
  role = 'ATHLETE'
);

-- Sanity check
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'is_coach' AND pronamespace = 'public'::regnamespace
  ) THEN
    RAISE EXCEPTION 'Function is_coach() not created';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'users'
      AND policyname = 'Coaches lookup athletes by email'
  ) THEN
    RAISE EXCEPTION 'Policy not created';
  END IF;
END $$;

COMMIT;
