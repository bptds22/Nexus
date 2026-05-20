-- Civil onboarding team search was dead: teams SELECT policies are all
-- school_id = current_user_school_id()-scoped, but a mid-onboarding civil coach
-- has school_id NULL → zero results, even though discovering a team to join is
-- the search step's entire purpose. Add an additive SELECT policy exposing only
-- LIGUE_CIVILE-anchored teams (civil leagues are open-enrolment by design).
-- SECONDAIRE/CEGEP teams stay school-scoped (their school.type != LIGUE_CIVILE).
-- No recursion: schools SELECT is USING(true). TO authenticated — least exposure.

DROP POLICY IF EXISTS "Civil league teams are publicly discoverable" ON public.teams;
CREATE POLICY "Civil league teams are publicly discoverable"
  ON public.teams
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.schools s
      WHERE s.id = teams.school_id
        AND s.type = 'LIGUE_CIVILE'
    )
  );
