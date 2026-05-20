-- Piece 2 of the users-self-grant hardening. is_school_admin is load-bearing
-- (/coach/* reads it for civil-league coaches), so the civil-coach onboarding
-- grant moves to a SECURITY DEFINER RPC validating an unforgeable signal.
-- context='ligue_civile' is the anchor: set once by the signup trigger, no
-- legit post-signup writer. Pinning context makes it unforgeable; pinning
-- is_school_admin is then safe because the RPC (row_security=off) is the only
-- writer. Onboarding swaps its client write for an rpc() call (same commit).
--
-- Ordering is load-bearing: the 5-arg helper is a NEW signature (the Piece 1
-- helper has 3 args), and CREATE OR REPLACE cannot change arg count — it would
-- leave the 3-arg version orphaned. So: drop the policy (sole dependent of the
-- 3-arg helper), drop the 3-arg helper, create the 5-arg helper, then re-create
-- the policy.

-- 1. Drop the policy first — it is the only object depending on the 3-arg helper.
DROP POLICY IF EXISTS "users update own" ON public.users;

-- 2. Drop the Piece 1 3-arg helper by its exact signature.
DROP FUNCTION IF EXISTS public.user_privileged_cols_unchanged(public.user_role, public.account_status, boolean);

-- 3. Re-create the helper, extended to also pin context + is_school_admin.
--    STABLE — parity with the Piece 1 version.
CREATE FUNCTION public.user_privileged_cols_unchanged(
  p_role public.user_role,
  p_status public.account_status,
  p_is_platform_admin boolean,
  p_context text,
  p_is_school_admin boolean
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET row_security = off
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
      AND role IS NOT DISTINCT FROM p_role
      AND status IS NOT DISTINCT FROM p_status
      AND is_platform_admin IS NOT DISTINCT FROM p_is_platform_admin
      AND context IS NOT DISTINCT FROM p_context
      AND is_school_admin IS NOT DISTINCT FROM p_is_school_admin
  );
$$;

-- 4. RPC: grant is_school_admin to a verified civil-league coach. context is
--    now pinned (helper above), so context='ligue_civile' is unforgeable proof
--    the account was created via the /auth/pro "Ligue ou club sportif" card.
--    row_security=off so the internal UPDATE bypasses the is_school_admin pin.
CREATE OR REPLACE FUNCTION public.claim_civil_league_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET row_security = off
SET search_path = public
AS $$
DECLARE
  v_role public.user_role;
  v_context text;
  v_is_admin boolean;
BEGIN
  SELECT role, context, is_school_admin
    INTO v_role, v_context, v_is_admin
  FROM public.users
  WHERE id = auth.uid();

  IF v_role = 'COACH' AND v_context = 'ligue_civile' THEN
    IF v_is_admin IS DISTINCT FROM true THEN
      UPDATE public.users SET is_school_admin = true WHERE id = auth.uid();
    END IF;
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_civil_league_admin() FROM public;
GRANT EXECUTE ON FUNCTION public.claim_civil_league_admin() TO authenticated;

-- 5. Re-create users update own — pin all five privileged columns.
--    TO public — matches the original policy + Piece 1.
CREATE POLICY "users update own"
  ON public.users
  FOR UPDATE
  TO public
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    AND public.user_privileged_cols_unchanged(role, status, is_platform_admin, context, is_school_admin)
  );
