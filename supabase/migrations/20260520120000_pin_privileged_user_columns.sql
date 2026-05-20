-- CRITICAL: users update own had an empty WITH CHECK, letting any authenticated
-- user self-grant role='ADMIN' (platform admin via is_admin() + 43 policies),
-- is_platform_admin=true, or self-restore status (ban evasion) with one UPDATE.
-- Pin these three columns to their stored values on self-update. Confirmed zero
-- legitimate client self-writes of role/status/is_platform_admin — zero-break
-- (role/status set only by the service-role partner API + handle_new_auth_user
-- SECURITY DEFINER trigger + admin pages via the admins update all policy).
-- is_school_admin NOT pinned here (load-bearing, moves to RPC in Piece 2).
-- school_id NOT pinned here (4 legit onboarding writes, deferred).
--
-- The column-pin comparison MUST go through a SECURITY DEFINER helper with
-- row_security = off. A plain `SELECT ... FROM public.users` inside a
-- public.users policy recurses ("infinite recursion detected in policy for
-- relation users") — same trap is_admin() / current_user_school_id() avoid.
--
-- Original policy captured 2026-05-20: cmd=UPDATE, roles={public},
-- USING (id = auth.uid()), WITH CHECK empty. Re-created TO public with the
-- USING clause preserved verbatim.

-- ── Helper: are the three privileged columns unchanged vs the stored row? ──
-- SECURITY DEFINER + row_security=off so the internal read of public.users
-- does NOT re-enter the users RLS policies (no recursion).
CREATE OR REPLACE FUNCTION public.user_privileged_cols_unchanged(
  p_role public.user_role,
  p_status public.account_status,
  p_is_platform_admin boolean
) RETURNS boolean
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
  );
$$;

DROP POLICY IF EXISTS "users update own" ON public.users;
CREATE POLICY "users update own"
  ON public.users
  FOR UPDATE
  TO public
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    AND public.user_privileged_cols_unchanged(role, status, is_platform_admin)
  );
