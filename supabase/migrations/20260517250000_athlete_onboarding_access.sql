-- Athlete onboarding access pattern fixes.
--
-- 1. team_athletes: athletes need to self-assign to a team during onboarding
--    to bootstrap visibility (coaches verify later). Adds INSERT policy
--    scoped to the athlete's own row + same school as the team.
--
-- 2. users read coaches at their school: the original policy used
--    current_user_school_id() which returns NULL mid-onboarding (no
--    athletes row yet), so the coach picker showed empty. A first attempt
--    to gate via EXISTS(SELECT FROM users) caused 42P17 infinite recursion
--    on users. Resolution: drop the school scope entirely — any
--    authenticated user can read any COACH row. Coach profiles are
--    professional/listable contacts; this matches the platform-pattern.

CREATE POLICY "Athletes self-assign to school team"
ON public.team_athletes
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.athletes a
    WHERE a.id = team_athletes.athlete_id
      AND a.user_id = auth.uid()
  )
  AND EXISTS (
    SELECT 1
    FROM public.teams t
    JOIN public.athletes a ON a.id = team_athletes.athlete_id
    WHERE t.id = team_athletes.team_id
      AND t.school_id = a.school_id
  )
);

ALTER POLICY "users read coaches at their school" ON public.users
USING (role = 'COACH'::user_role);