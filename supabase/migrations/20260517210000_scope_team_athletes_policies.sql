-- Replace permissive `Authenticated access team_athletes` with scoped policies.
-- The old policy was ALL USING(true) WITH CHECK(true) — any authenticated user
-- could CRUD any team_athletes row. Recap 2026-05-16 flagged this as critical;
-- the original fix was dropped during yesterday's rollback.

-- Drop the open policy
DROP POLICY IF EXISTS "Authenticated access team_athletes" ON public.team_athletes;

-- ───────────────────────────────────────────────────────────
-- COACHES of a team: full ALL on rows for their teams
-- ───────────────────────────────────────────────────────────
CREATE POLICY "Coaches manage own team athletes"
ON public.team_athletes
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.team_coaches tc
    WHERE tc.team_id = team_athletes.team_id
      AND tc.coach_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.team_coaches tc
    WHERE tc.team_id = team_athletes.team_id
      AND tc.coach_id = auth.uid()
  )
);

-- ───────────────────────────────────────────────────────────
-- SCHOOL DIRECTORS: full ALL on rows for teams in their school
-- ───────────────────────────────────────────────────────────
CREATE POLICY "Directors manage school team athletes"
ON public.team_athletes
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM public.teams t
    JOIN public.school_coaches sc ON sc.school_id = t.school_id
    WHERE t.id = team_athletes.team_id
      AND sc.coach_id = auth.uid()
      AND sc.role IN ('DIRECTEUR', 'DIRECTEUR_INTERIM')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.teams t
    JOIN public.school_coaches sc ON sc.school_id = t.school_id
    WHERE t.id = team_athletes.team_id
      AND sc.coach_id = auth.uid()
      AND sc.role IN ('DIRECTEUR', 'DIRECTEUR_INTERIM')
  )
);

-- ───────────────────────────────────────────────────────────
-- ATHLETES: SELECT only, only their own row (no DELETE/INSERT/UPDATE)
-- ───────────────────────────────────────────────────────────
CREATE POLICY "Athletes read own team rows"
ON public.team_athletes
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.athletes a
    WHERE a.id = team_athletes.athlete_id
      AND a.user_id = auth.uid()
  )
);

-- ───────────────────────────────────────────────────────────
-- RECRUITERS: SELECT only, only for verified + active athletes
-- ───────────────────────────────────────────────────────────
CREATE POLICY "Recruiters read verified team athletes"
ON public.team_athletes
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() AND u.role = 'RECRUTEUR'
  )
  AND EXISTS (
    SELECT 1 FROM public.athletes a
    WHERE a.id = team_athletes.athlete_id
      AND a.verified = true
      AND a.status = 'ACTIF'
  )
);