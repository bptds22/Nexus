-- ═══════════════════════════════════════════════════════════════
-- league_coaches: SELECT policies for athletes-of-team and
-- recruiters. Closes a latent RLS gap shipped with civil-league
-- support.
--
-- Background: the only existing SELECT policy on league_coaches is
-- "Coaches read own league assignments" USING (coach_id = auth.uid()).
-- That works for coaches reading their own row, but blocks two
-- legitimate read paths that the application already issues:
--
--   1. Athlete-side: the inline civil coach picker
--      (app/athlete/parametres/page.tsx) needs to list the
--      coaches assigned to the athlete's own league_team so the
--      athlete can pick one and write athletes.coach_id.
--
--   2. Recruiter-side: AthleteRecruiterProfileBody.tsx:615 already
--      issues `SELECT users!coach_id FROM league_coaches WHERE
--      league_team_id = $teamId` to render the "coaches" sub-section
--      under a civil athlete's affiliation block. Under the
--      coach-only policy, this query was returning [] silently for
--      every civil athlete since 5.3d shipped — no error, just an
--      empty section. Fixed here by RLS path, not code change.
--
-- Scoping (Option B from 5.3f discovery): two scoped policies
-- rather than a single permissive `USING (true)`. Matches the
-- least-privilege pattern used on recruiter_favorites /
-- recruiter_pipeline / etc.
--
--   - Athletes read coaches of own team: bounded by the athlete's
--     own league_team_id. Subquery hits the athletes table where
--     the existing SELECT policy permits an athlete to read their
--     own row (verified by the working 5.3b resume-prefill flow).
--     No RLS cycle: the athletes policy does not reference
--     league_coaches.
--
--   - Recruiters read all league_coaches: any user with
--     role = 'RECRUTEUR' can SELECT every row. Coach-team
--     assignments are not PII beyond what's already discoverable
--     from the coach's own user record, and recruiters need broad
--     visibility across athletes' teams to evaluate prospects.
--
-- Note: PENDING-role rows are NOT filtered at the policy level.
-- The application layer (CivilCoachPicker query) filters
-- role IN ('ADMIN', 'COACH') so PENDING coaches don't appear as
-- selectable. Other consumers (e.g. AthleteRecruiterProfileBody)
-- can choose their own filter; keeping RLS scope-only.
-- ═══════════════════════════════════════════════════════════════

CREATE POLICY "Athletes read coaches of own team"
  ON public.league_coaches
  FOR SELECT
  TO authenticated
  USING (
    league_team_id IN (
      SELECT league_team_id
      FROM public.athletes
      WHERE user_id = auth.uid()
        AND league_team_id IS NOT NULL
    )
  );

CREATE POLICY "Recruiters read all league_coaches"
  ON public.league_coaches
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.users
      WHERE id = auth.uid()
        AND role = 'RECRUTEUR'::public.user_role
    )
  );
