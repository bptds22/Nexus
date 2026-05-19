-- Rewrite teams policies to use the current_user_school_id() helper
-- instead of inline (SELECT school_id FROM users WHERE id=auth.uid()).
-- The helper is SECURITY DEFINER + row_security=off and correctly
-- resolves ATHLETE vs other-role school lookup. Closes brittleness
-- debt flagged in 2026-05-17 recap; no functional change today since
-- the helper already exists.

ALTER POLICY "Coaches see their school teams" ON public.teams
USING (school_id = public.current_user_school_id());

ALTER POLICY "Coaches create teams" ON public.teams
WITH CHECK (school_id = public.current_user_school_id());

ALTER POLICY "Coaches update teams" ON public.teams
USING (school_id = public.current_user_school_id());

ALTER POLICY "Coaches delete teams" ON public.teams
USING (school_id = public.current_user_school_id());

ALTER POLICY "Athletes see their teams" ON public.teams
USING (school_id = public.current_user_school_id());