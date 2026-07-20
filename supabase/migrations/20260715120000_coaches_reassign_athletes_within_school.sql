-- ═══════════════════════════════════════════════════════════════════════
-- GESTION DES ATHLÈTES — coach-to-coach reassignment within a school.
--
-- WHY: the existing athletes UPDATE policies do NOT allow moving an athlete
-- owned by coach A to coach B:
--   • "coaches can update own athletes"  USING coach_id = auth.uid(), no
--     WITH CHECK → the new row must ALSO satisfy coach_id = auth.uid()
--     (Postgres defaults WITH CHECK to USING), so you can never hand the
--     athlete to another coach.
--   • "coaches can claim unclaimed school athletes"  only NULL → auth.uid().
--   • "Coaches update own team athletes" (coach_can_manage_athlete) only
--     covers athletes on a team the caller coaches, OR a director whose
--     school_coaches.role IN (DIRECTEUR, DIRECTEUR_INTERIM) — a role the
--     admin_claims approval flow never actually writes.
-- None cover the general A → B reassignment, so this policy adds it.
--
-- SCOPE (matches the "assignment / management" product decision — any coach
-- at the school, not director-only):
--   • The caller must be a COACH whose school = the athlete's school.
--   • The destination coach_id must be NULL (send back to the pool) OR a
--     coach who is a member of the SAME school (school_coaches).
--   • The athlete stays at the caller's school (WITH CHECK re-asserts
--     school_id), so cross-school moves are impossible.
--
-- ⚠️ BREADTH: RLS UPDATE policies are column-agnostic. This grants any coach
-- the ability to UPDATE any athlete row at their school (all columns), and to
-- reassign athletes away from another coach. That is intentional for the
-- collaborative school model; tighten to is_school_admin if a director-only
-- gate is later required.
--
-- Helpers is_coach() / current_user_school_id() are SECURITY DEFINER with
-- row_security = off, so they avoid users-table RLS recursion.
-- ═══════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "coaches reassign athletes within school" ON public.athletes;

CREATE POLICY "coaches reassign athletes within school"
ON public.athletes
FOR UPDATE
TO authenticated
USING (
  public.is_coach()
  AND school_id IS NOT NULL
  AND school_id = public.current_user_school_id()
)
WITH CHECK (
  public.is_coach()
  AND school_id = public.current_user_school_id()
  AND (
    coach_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.school_coaches sc
      WHERE sc.coach_id = athletes.coach_id
        AND sc.school_id = public.current_user_school_id()
    )
  )
);
