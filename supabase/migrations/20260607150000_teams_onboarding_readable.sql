-- ═══════════════════════════════════════════════════════════════
-- iter 7.50-a-bis (team-2) — Unlock team + coach discovery for the
-- mobile athlete onboarding flow.
--
-- The current SELECT policy on teams ("Athletes see their teams",
-- baseline:3868) is circular: it shows teams whose school_id is
-- found in the calling athlete's own athletes.school_id. A brand-new
-- athlete mid-onboarding has no athletes row yet -> 0 visible teams.
-- This blocks the "school -> team -> coach" picker chain entirely
-- for SECONDAIRE schools (CIVIL was already fixed by
-- 20260520140000_civil_teams_discoverable.sql).
--
-- Parity with that prior fix: two additive SELECT policies, scoped
-- to authenticated, idempotent (DROP IF EXISTS). No recursion:
-- schools.SELECT is USING(true) at baseline.
--
-- Policy 1 — teams: lets any authenticated user read SECONDAIRE
--   team rows (same shape as civil_teams_discoverable). Required so
--   onboarding athletes can search teams at their picked school.
--
-- Policy 2 — team_coaches: lets any authenticated user read the
--   coach assignments for a team they can already read. The chain
--   teams -> schools restricts to SECONDAIRE + LIGUE_CIVILE (i.e.,
--   the team types relevant to athlete onboarding; coach-internal
--   recruitment rosters at CEGEPs stay scoped). Coach<->team
--   association is roster-public data, not PII.
--
-- No recursion: this policy walks teams + schools downstream only.
-- It does NOT reference team_coaches itself.
-- ═══════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Secondary teams readable for onboarding" ON public.teams;
CREATE POLICY "Secondary teams readable for onboarding"
  ON public.teams
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.schools s
      WHERE s.id = teams.school_id
        AND s.type = 'SECONDAIRE'
    )
  );

DROP POLICY IF EXISTS "team_coaches readable when team is readable" ON public.team_coaches;
CREATE POLICY "team_coaches readable when team is readable"
  ON public.team_coaches
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.teams t
      JOIN public.schools s ON s.id = t.school_id
      WHERE t.id = team_coaches.team_id
        AND s.type IN ('SECONDAIRE', 'LIGUE_CIVILE')
    )
  );
