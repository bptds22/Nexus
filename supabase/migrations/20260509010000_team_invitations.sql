-- ═══════════════════════════════════════════════════════════════
-- team_invitations — Flow A: civil coach invites existing athlete
-- (already in DB) to join their team.
--
-- Lifecycle:
--   1. Coach INSERTs PENDING row (5.5e-iv UI)
--   2. Athlete UPDATEs status to ACCEPTED or REJECTED
--   3. On ACCEPTED, trigger cascades the side effects:
--      a. INSERT into league_team_athletes (new junction row)
--      b. UPDATE athletes.league_team_id = invitation.league_team_id
--      c. DELETE old junction rows on other teams (single-team
--         enforcement; multi-team is a future P3)
--   4. Coach can CANCEL while PENDING
--   5. EXPIRED reserved for post-launch cron (expires_at exists
--      but no trigger populates it yet)
--
-- Idempotency: partial unique index `WHERE status = 'PENDING'`
-- prevents two simultaneous PENDING invitations for the same
-- (team, athlete) pair while permitting historical
-- REJECTED/ACCEPTED/CANCELLED rows. A coach can re-invite after
-- a rejection — just not while one is still pending.
--
-- Trigger cascade order is load-bearing: step (b) updates the
-- anchor to the NEW team before step (c) DELETEs old junctions.
-- That order ensures 5.5d-iii-a's
-- `reset_athlete_anchor_on_team_remove` trigger (fired by the
-- DELETE in step c) sees a non-matching anchor and no-ops.
-- Without this ordering, the anchor would get nulled out by the
-- old-junction DELETE before being re-set to the new team — a
-- race window that would leak un-anchored athletes.
--
-- Status transition enforcement (only PENDING → ACCEPTED/REJECTED/
-- CANCELLED, never reverse) is NOT enforced at the DB layer
-- because RLS WITH CHECK cannot reference OLD row state. The
-- 5.5e-iv handler validates current_status before issuing UPDATE.
-- A future BEFORE UPDATE trigger could add defense-in-depth (P3).
-- ═══════════════════════════════════════════════════════════════

-- Idempotent reset (allows re-applying the migration during local
-- rebuilds). DROP TABLE … CASCADE removes the trigger automatically;
-- the function survives DROP TABLE because it's not table-owned, so
-- we drop it explicitly afterward.
DROP TABLE IF EXISTS public.team_invitations CASCADE;
DROP FUNCTION IF EXISTS public.apply_team_invitation_acceptance();

CREATE TABLE public.team_invitations (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_team_id      uuid NOT NULL REFERENCES public.league_teams(id) ON DELETE CASCADE,
  athlete_id          uuid NOT NULL REFERENCES public.athletes(id)     ON DELETE CASCADE,
  invited_by_coach_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  status              text NOT NULL DEFAULT 'PENDING'
                      CHECK (status IN ('PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'CANCELLED')),
  expires_at          timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  responded_at        timestamptz
);

-- Partial unique: only one PENDING per (team, athlete). Historical
-- non-PENDING rows are allowed to accumulate (audit trail).
CREATE UNIQUE INDEX uq_team_invitations_pending
  ON public.team_invitations (league_team_id, athlete_id)
  WHERE status = 'PENDING';

-- Supporting indexes for the common read paths.
CREATE INDEX idx_team_invitations_team    ON public.team_invitations(league_team_id);
CREATE INDEX idx_team_invitations_athlete ON public.team_invitations(athlete_id);

ALTER TABLE public.team_invitations OWNER TO postgres;

GRANT ALL ON TABLE public.team_invitations TO anon;
GRANT ALL ON TABLE public.team_invitations TO authenticated;
GRANT ALL ON TABLE public.team_invitations TO service_role;

ALTER TABLE public.team_invitations ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.team_invitations IS
  'Flow A invitations from civil coaches to athletes already in DB. '
  'On ACCEPTED, trigger writes junction + updates anchor + cleans up '
  'old team membership. Flow B (email-based external invite) lives '
  'in a separate table planned for 5.5e-iii-b.';

-- ────────────────────────────────────────────────────────────────
-- Trigger function: cascade side effects when status → ACCEPTED.
-- SECURITY DEFINER so an athlete updating their own invitation
-- (no direct INSERT/UPDATE permission on athletes or
-- league_team_athletes) can complete the membership flow.
-- ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.apply_team_invitation_acceptance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- (a) INSERT junction row for new team. ON CONFLICT DO NOTHING
  -- so a stale row (from a previous attempt) doesn't block.
  INSERT INTO public.league_team_athletes (league_team_id, athlete_id)
  VALUES (NEW.league_team_id, NEW.athlete_id)
  ON CONFLICT (league_team_id, athlete_id) DO NOTHING;

  -- (b) UPDATE anchor on athletes BEFORE deleting old junctions
  -- so the 5.5d-iii-a reset trigger (fired by the next step's
  -- DELETE) sees a non-matching anchor and no-ops.
  UPDATE public.athletes
     SET league_team_id = NEW.league_team_id
   WHERE id = NEW.athlete_id;

  -- (c) DELETE old junction rows on other teams. Single-team
  -- enforcement; future multi-team UX (P3) would remove this step.
  DELETE FROM public.league_team_athletes
   WHERE athlete_id = NEW.athlete_id
     AND league_team_id <> NEW.league_team_id;

  RETURN NEW;
END;
$$;

CREATE TRIGGER apply_team_invitation_acceptance
  AFTER UPDATE ON public.team_invitations
  FOR EACH ROW
  WHEN (NEW.status = 'ACCEPTED' AND OLD.status IS DISTINCT FROM 'ACCEPTED')
  EXECUTE FUNCTION public.apply_team_invitation_acceptance();

COMMENT ON FUNCTION public.apply_team_invitation_acceptance() IS
  'Fires when team_invitations.status flips to ACCEPTED. Cascades: '
  '(a) INSERT junction new team, (b) UPDATE anchor, (c) DELETE old '
  'junctions. Order matters — step (b) before (c) ensures 5.5d-iii-a '
  'anchor-reset trigger no-ops during the cleanup DELETE.';

-- ────────────────────────────────────────────────────────────────
-- RLS Policies (6 total)
-- ────────────────────────────────────────────────────────────────

-- 1. INSERT coach — coach creates invitation on a team they coach.
CREATE POLICY "Coaches insert invitations on own teams"
  ON public.team_invitations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    league_team_id IN (
      SELECT league_team_id FROM public.league_coaches
      WHERE coach_id = auth.uid() AND league_team_id IS NOT NULL
    )
  );

-- 2. SELECT coach — coach reads invitations on their teams.
CREATE POLICY "Coaches select invitations on own teams"
  ON public.team_invitations
  FOR SELECT
  TO authenticated
  USING (
    league_team_id IN (
      SELECT league_team_id FROM public.league_coaches
      WHERE coach_id = auth.uid() AND league_team_id IS NOT NULL
    )
  );

-- 3. SELECT athlete — athlete reads invitations targeting them
-- (via athletes.user_id = auth.uid()).
CREATE POLICY "Athletes select own invitations"
  ON public.team_invitations
  FOR SELECT
  TO authenticated
  USING (
    athlete_id IN (
      SELECT id FROM public.athletes WHERE user_id = auth.uid()
    )
  );

-- 4. UPDATE athlete — athlete can ACCEPT or REJECT their own
-- invitation. WITH CHECK clamps the new status; transition
-- validity (must come from PENDING) is enforced at the app layer.
CREATE POLICY "Athletes update own invitations"
  ON public.team_invitations
  FOR UPDATE
  TO authenticated
  USING (
    athlete_id IN (
      SELECT id FROM public.athletes WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    athlete_id IN (
      SELECT id FROM public.athletes WHERE user_id = auth.uid()
    )
    AND status IN ('ACCEPTED', 'REJECTED')
  );

-- 5. UPDATE coach — coach can CANCEL invitations on their own
-- teams. Same WITH CHECK clamping.
CREATE POLICY "Coaches cancel own invitations"
  ON public.team_invitations
  FOR UPDATE
  TO authenticated
  USING (
    league_team_id IN (
      SELECT league_team_id FROM public.league_coaches
      WHERE coach_id = auth.uid() AND league_team_id IS NOT NULL
    )
  )
  WITH CHECK (
    league_team_id IN (
      SELECT league_team_id FROM public.league_coaches
      WHERE coach_id = auth.uid() AND league_team_id IS NOT NULL
    )
    AND status = 'CANCELLED'
  );

-- 6. Admin override.
CREATE POLICY "Admins manage all invitations"
  ON public.team_invitations
  FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());
