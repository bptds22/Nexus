-- ────────────────────────────────────────────────────────────────
-- Athlete claim flow — Phase 2
-- ────────────────────────────────────────────────────────────────
-- Coaches create athlete profiles ahead of signup via
-- /coach/athletes/create. Those rows land with `user_id IS NULL`
-- and an email the coach provided ("orphan" profiles).
--
-- When that athlete later signs up with the same email, they need
-- to be able to (a) discover the orphan row by email match and
-- (b) claim it by writing their auth.uid() into user_id (plus any
-- additional profile data they fill in via the wizard).
--
-- None of the existing athlete self-policies cover this:
--   * `athletes can read own profile` / `update own profile` both
--     key on `user_id = auth.uid()` — orphan has user_id NULL.
--   * `athletes can read verified` requires verified=true — orphans
--     aren't verified yet.
-- Coaches have a parallel `"Coaches lookup orphan athletes"` policy
-- (migration 20260512160000) that powers the email autocomplete in
-- /coach/athletes/create. This migration adds the symmetric
-- athlete-side pair.
--
-- Email match runs against the auth user's verified email
-- (auth.users.email) — not a user-controlled input — so a malicious
-- signup cannot claim someone else's coach-created profile by
-- spoofing a form field.
-- ────────────────────────────────────────────────────────────────

-- Lookup: an authenticated user can SELECT exactly the orphan rows
-- whose email matches their own auth.users.email.
DROP POLICY IF EXISTS "athletes can read own orphan match" ON public.athletes;

CREATE POLICY "athletes can read own orphan match" ON public.athletes
  FOR SELECT
  TO authenticated
  USING (
    user_id IS NULL
    AND email IS NOT NULL
    AND lower(email) = lower((SELECT u.email FROM auth.users u WHERE u.id = auth.uid()))
  );

-- Claim: an authenticated user can UPDATE an orphan row matching
-- their email, but the WITH CHECK clause forces them to set
-- user_id = auth.uid() on the same UPDATE — they can't blank it,
-- can't set it to someone else's id, and can't claim a row already
-- linked to anyone.
DROP POLICY IF EXISTS "athletes can claim own orphan match" ON public.athletes;

CREATE POLICY "athletes can claim own orphan match" ON public.athletes
  FOR UPDATE
  TO authenticated
  USING (
    user_id IS NULL
    AND email IS NOT NULL
    AND lower(email) = lower((SELECT u.email FROM auth.users u WHERE u.id = auth.uid()))
  )
  WITH CHECK (
    user_id = auth.uid()
  );

COMMENT ON POLICY "athletes can read own orphan match" ON public.athletes IS
  'Phase 2 athlete claim: lets a just-signed-up athlete discover a coach-created orphan profile matching their email.';

COMMENT ON POLICY "athletes can claim own orphan match" ON public.athletes IS
  'Phase 2 athlete claim: lets the same athlete UPDATE that orphan row to set user_id = auth.uid(). WITH CHECK forces the claim to be atomic.';
