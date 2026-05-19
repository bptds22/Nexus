-- Two athletes UPDATE policies were rewriting users sub-queries inline,
-- causing 42501 recursion when called from PostgREST. Same family as
-- earlier 2026-05-17 fixes. Rewrite to use the existing SECURITY DEFINER
-- helpers (current_user_school_id, current_user_email) that bypass RLS
-- on the inner reads.

-- Coach claiming an unclaimed athlete at their own school
ALTER POLICY "coaches can claim unclaimed school athletes" ON public.athletes
USING (
  coach_id IS NULL
  AND school_id = public.current_user_school_id()
);

-- Athlete claiming an orphan profile by matching email
-- (UPDATE qual — the SELECT qual was already fixed in migration 20260517200000)
ALTER POLICY "athletes can claim own orphan match" ON public.athletes
USING (
  user_id IS NULL
  AND email IS NOT NULL
  AND lower(email) = lower(public.current_user_email())
);