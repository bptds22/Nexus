-- team_coaches had "Coaches manage team_coaches" ALL USING(true) WITH CHECK(true)
-- — any authenticated user could CRUD any team's coach roster. Replace the two
-- open policies (the ALL and the open SELECT) with scoped SELECT/INSERT/UPDATE/
-- DELETE, mirroring team_athletes's correct model. Scope via teams + users only
-- — NO team_coaches self-reference (avoids "infinite recursion detected"), no
-- SECURITY DEFINER helper needed.
--
-- The coach_id = auth.uid() arms are load-bearing:
--  * SELECT arm — team_athletes's "Coaches manage own team athletes" policy runs
--    EXISTS(SELECT 1 FROM team_coaches WHERE coach_id = auth.uid()...). Dropping
--    this arm would silently cut coaches off from their own athletes.
--  * INSERT arm — onboarding's "join existing team" flow (app/onboarding:2355)
--    inserts the coach onto a team WITHOUT first setting users.school_id, so a
--    school-only scope would block it. A coach can always add themselves.
--
-- The school-scope expression is taken verbatim from the existing scoped
-- "Coaches insert team_coaches" policy, which is folded into the new INSERT.

DROP POLICY IF EXISTS "Coaches manage team_coaches" ON public.team_coaches;
DROP POLICY IF EXISTS "Coaches see team assignments" ON public.team_coaches;
DROP POLICY IF EXISTS "Coaches insert team_coaches" ON public.team_coaches;

-- SELECT: own coach row, OR a team in my school scope, OR admin.
CREATE POLICY "team_coaches scoped select"
  ON public.team_coaches FOR SELECT TO public
  USING (
    coach_id = auth.uid()
    OR team_id IN (
      SELECT t.id FROM public.teams t
      WHERE t.school_id IN (SELECT users.school_id FROM public.users WHERE users.id = auth.uid())
    )
    OR public.is_admin()
  );

-- INSERT: add myself (self-arm — keeps onboarding join-team working),
-- OR add to a team in my school scope.
CREATE POLICY "team_coaches scoped insert"
  ON public.team_coaches FOR INSERT TO public
  WITH CHECK (
    coach_id = auth.uid()
    OR team_id IN (
      SELECT t.id FROM public.teams t
      WHERE t.school_id IN (SELECT users.school_id FROM public.users WHERE users.id = auth.uid())
    )
  );

-- UPDATE: a team in my school scope, OR admin.
CREATE POLICY "team_coaches scoped update"
  ON public.team_coaches FOR UPDATE TO public
  USING (
    team_id IN (
      SELECT t.id FROM public.teams t
      WHERE t.school_id IN (SELECT users.school_id FROM public.users WHERE users.id = auth.uid())
    )
    OR public.is_admin()
  )
  WITH CHECK (
    team_id IN (
      SELECT t.id FROM public.teams t
      WHERE t.school_id IN (SELECT users.school_id FROM public.users WHERE users.id = auth.uid())
    )
    OR public.is_admin()
  );

-- DELETE: a team in my school scope, OR admin.
CREATE POLICY "team_coaches scoped delete"
  ON public.team_coaches FOR DELETE TO public
  USING (
    team_id IN (
      SELECT t.id FROM public.teams t
      WHERE t.school_id IN (SELECT users.school_id FROM public.users WHERE users.id = auth.uid())
    )
    OR public.is_admin()
  );
