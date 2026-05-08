-- ═══════════════════════════════════════════════════════════════
-- league_team_athletes — junction table for civil team rosters.
--
-- Civil teams (league_teams) need a roster surface that mirrors
-- what team_athletes provides for école teams: per-athlete jersey
-- numbers, captain flags, and join-date tracking. Pre-5.5b, civil
-- athletes were tied to a team via athletes.league_team_id (1:N
-- single-team), but there was no place to store membership-level
-- properties like jersey or captain.
--
-- Design (matches team_athletes shape exactly):
--   id, league_team_id, athlete_id, jersey_number (text),
--   is_captain (boolean), joined_at (timestamptz).
--   UNIQUE(league_team_id, athlete_id) blocks duplicate joins.
--
-- Position is intentionally NOT a column here — same as team_athletes
-- — because positions are an attribute of the athlete (singular
-- primary position via athletes.position_id), not the membership.
-- If a multi-position-per-team UX ever ships, both junction tables
-- get the column added together.
--
-- Dual-source architecture (locked in 5.5b discovery Q4):
--   - athletes.league_team_id = primary team (display badge, recruiter
--     card, quick lookups)
--   - league_team_athletes = membership detail (jersey, captain)
--   - For the current 1-team-per-coach model both stay in sync;
--     written together by the 5.5c-d UI handlers
--   - Future multi-team: league_team_athletes = all teams,
--     athletes.league_team_id = primary
--
-- RLS scoping — diverges from team_athletes intentionally.
-- team_athletes today has a USING (true) policy that grants any
-- authenticated user full CRUD on the entire roster surface — a
-- real security gap on the école side. Rather than mirror that, we
-- ship league_team_athletes with proper scoped RLS from day one:
--   - Coaches of the team (via league_coaches.coach_id = auth.uid())
--     have full CRUD on rows where league_team_id matches
--   - Athletes read their own membership rows
--   - Recruiters read all rosters (needed for prospect evaluation)
--   - Admins all access
-- The team_athletes hardening to match this posture is logged P3.
--
-- Cycle check (audited 2026-05-08): no policy on athletes or
-- league_coaches references league_team_athletes — RLS evaluates
-- without recursion.
--
-- Backfill: any pre-existing rows in athletes with league_team_id
-- set get a corresponding membership row inserted (jersey/captain
-- left NULL/false). ON CONFLICT DO NOTHING protects re-runs. At
-- audit time locally, 0 such rows exist (civil flow just shipped
-- 5.4g, no civil athletes yet); backfill is a no-op locally but
-- ships with the migration for production safety.
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE public.league_team_athletes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_team_id  uuid NOT NULL REFERENCES public.league_teams(id) ON DELETE CASCADE,
  athlete_id      uuid NOT NULL REFERENCES public.athletes(id)     ON DELETE CASCADE,
  jersey_number   text,
  is_captain      boolean NOT NULL DEFAULT false,
  joined_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_league_team_athletes_membership UNIQUE (league_team_id, athlete_id)
);

CREATE INDEX idx_league_team_athletes_team    ON public.league_team_athletes(league_team_id);
CREATE INDEX idx_league_team_athletes_athlete ON public.league_team_athletes(athlete_id);

ALTER TABLE public.league_team_athletes OWNER TO postgres;

GRANT ALL ON TABLE public.league_team_athletes TO anon;
GRANT ALL ON TABLE public.league_team_athletes TO authenticated;
GRANT ALL ON TABLE public.league_team_athletes TO service_role;

ALTER TABLE public.league_team_athletes ENABLE ROW LEVEL SECURITY;

-- Coaches of the team have full CRUD on rows for that team.
CREATE POLICY "Coaches of team manage roster"
  ON public.league_team_athletes
  FOR ALL
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
  );

-- Athletes can read their own membership rows.
CREATE POLICY "Athletes read own membership"
  ON public.league_team_athletes
  FOR SELECT
  TO authenticated
  USING (
    athlete_id IN (
      SELECT id FROM public.athletes WHERE user_id = auth.uid()
    )
  );

-- Recruiters read all rosters across civil teams.
CREATE POLICY "Recruiters read all rosters"
  ON public.league_team_athletes
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'RECRUTEUR'::public.user_role
    )
  );

-- Admins have full CRUD across all rows.
CREATE POLICY "Admins manage all rosters"
  ON public.league_team_athletes
  FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- Backfill memberships from athletes.league_team_id where set.
-- Idempotent via ON CONFLICT.
INSERT INTO public.league_team_athletes (league_team_id, athlete_id)
SELECT league_team_id, id
FROM public.athletes
WHERE league_team_id IS NOT NULL
ON CONFLICT (league_team_id, athlete_id) DO NOTHING;
