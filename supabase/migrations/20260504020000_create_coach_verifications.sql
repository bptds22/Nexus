-- ════════════════════════════════════════════════════════════════════════════
-- Phase 2: coach_verifications table + RLS.
--
-- 2-tier verification model (BLUE / GREY) keyed on user_id. Only a BLUE
-- coach may issue an athlete verification (the blue check on athlete
-- profiles). All coaches — BLUE or GREY — may rate, comment, and badge
-- athletes; tier only gates the verification capability.
--
-- Phase 0 design notes:
--   - PRIMARY KEY user_id (1:1 with users) — keeps the verification
--     state outside `users` to limit blast radius on a high-traffic
--     base table, and outside `school_coaches` so civil-league coaches
--     (who have no school_coaches row) can carry a verification state
--   - DEFAULT 'GREY' so newly created coach rows automatically start
--     unverified; an admin must explicitly elevate to BLUE
--   - verified_by uuid REFERENCES users with ON DELETE SET NULL: the
--     audit trail survives admin user deletion (the elevation event
--     stays recorded as "by null/system" rather than disappearing)
--   - Backfill ships in 20260504020001_*.sql (separate migration for
--     atomicity — schema and data writes stay independently revertible)
--
-- RLS shape:
--   - Coaches see their own row only (so /coach/reputation can render
--     the right badge state)
--   - Recruteurs see all rows (so the athlete profile coach-report
--     section can show the badge state of whoever wrote the report)
--   - PARTNER role excluded intentionally — partner athlete profile
--     hides the entire coach-reputation section. If that view evolves
--     to expose coach attribution, broaden the recruteur policy to
--     `recruiter_or_partner_read_all`.
--   - Admins (canonical is_admin() helper) get FOR ALL with
--     WITH CHECK so INSERT/UPDATE/DELETE are gated symmetrically.
--     Using the inline `role = 'ADMIN'` predicate would also work but
--     is_admin() is the codebase standard already used by
--     recruiter_pipeline, subscriptions, and other admin-gated tables.
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE public.coach_verifications (
  user_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'GREY'
    CHECK (status IN ('BLUE', 'GREY')),
  requested_at timestamptz NOT NULL DEFAULT now(),
  verified_at timestamptz,
  verified_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  rejection_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.coach_verifications IS
  'Tier de vérification coach (BLUE = vérifié admin Nexus, GREY = non vérifié). '
  'Seul un coach BLUE peut émettre une vérification athlète (blue check). '
  'Tous les coaches peuvent rating/commenter/badger indépendamment du tier.';

-- Partial index optimizes the admin queue lookup
-- (SELECT ... WHERE status = 'GREY' ORDER BY requested_at) — only
-- indexes pending rows, keeps the index small as BLUE rows accumulate.
CREATE INDEX idx_coach_verifications_status_grey
  ON public.coach_verifications(status, requested_at)
  WHERE status = 'GREY';

-- public.update_updated_at() is the canonical helper in this codebase
-- (also used by leagues, league_teams). The similarly-named
-- update_updated_at_column lives in the `storage` schema and is not
-- callable from public-schema triggers without a search-path hack —
-- pre-check missed this on first pass.
CREATE TRIGGER trg_coach_verifications_updated_at
  BEFORE UPDATE ON public.coach_verifications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.coach_verifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY coach_read_own ON public.coach_verifications
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- PARTNER role excluded intentionally — see header comment.
CREATE POLICY recruiter_read_all ON public.coach_verifications
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'RECRUTEUR'
    )
  );

-- is_admin() is canonical (STABLE SECURITY DEFINER), used by every
-- admin-gated policy in the codebase. WITH CHECK mirrors USING so
-- INSERT/UPDATE writes are gated symmetrically.
CREATE POLICY admin_write ON public.coach_verifications
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
