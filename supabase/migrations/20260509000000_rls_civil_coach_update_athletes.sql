-- ═══════════════════════════════════════════════════════════════
-- RLS gap fix: permit civil coaches to UPDATE athletes attached to
-- their team via league_coaches.
--
-- Background: discovery 2026-05-09 on the team detail page revealed
-- that civil coaches saving athlete-profile mutations were producing
-- silent no-ops (UPDATE 0 rows, client returned success because
-- Supabase JS doesn't error on 0-row updates). The 4 existing UPDATE
-- policies on athletes had no path for civil context:
--   1. admins update all          → only nexus admins
--   2. athletes update own profile→ only when athletes.user_id =
--                                   auth.uid() (civil coach-created
--                                   athletes have user_id = NULL)
--   3. coaches update own athletes→ only when athletes.coach_id =
--                                   auth.uid() (civil flow doesn't
--                                   set coach_id; 5.5b uses
--                                   league_coaches + league_team_id
--                                   instead)
--   4. coaches claim unclaimed    → only when school_id matches the
--                                   coach's users.school_id; civil
--                                   athletes have school_id = NULL,
--                                   civil coaches have
--                                   users.school_id = NULL → empty
--                                   subquery → policy never matches
--
-- This affects EVERY UPDATE surface for civil coaches editing their
-- team's athletes: modifier page, photo upload, evaluations, status
-- changes. Symptom is consistent — UPDATE 0 with no error.
--
-- Fix: 5th UPDATE policy that grants write access via the
-- league_coaches join. Mirrors 5.5b's "Coaches of team manage roster"
-- policy on league_team_athletes. Permits both ADMIN and COACH role
-- per 5.5b precedent — the RLS layer enforces team membership; UI
-- can layer additional ADMIN-only gates on top (already done for
-- destructive actions like remove ✕ in 5.5d-iii-redux).
--
-- WITH CHECK is identical to USING to block team-eviction attacks:
-- without it, a coach could UPDATE league_team_id to a team they
-- don't coach, effectively kidnapping the athlete out of their
-- current team into a foreign roster.
--
-- Orphan athletes (league_team_id IS NULL — civil athletes between
-- teams) intentionally not covered. They remain editable only by:
--   - The athlete themselves via the own_profile policy (if user_id
--     is set)
--   - Admin
-- This is by design — coaches should not have write access to
-- athletes who aren't on their team.
--
-- Cycle check: this policy reads league_coaches. The league_coaches
-- policies set in 5.3f read athletes once (the
-- "Athletes read coaches of own team" subquery reads
-- athletes.league_team_id). RLS evaluation does not loop because
-- the dependency is one-directional and read-only across tables.
-- ═══════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Civil coaches update own team athletes"
  ON public.athletes;

CREATE POLICY "Civil coaches update own team athletes"
  ON public.athletes
  FOR UPDATE
  TO authenticated
  USING (
    league_team_id IN (
      SELECT league_team_id
      FROM public.league_coaches
      WHERE coach_id = auth.uid()
        AND league_team_id IS NOT NULL
    )
  )
  WITH CHECK (
    league_team_id IN (
      SELECT league_team_id
      FROM public.league_coaches
      WHERE coach_id = auth.uid()
        AND league_team_id IS NOT NULL
    )
  );

COMMENT ON POLICY "Civil coaches update own team athletes" ON public.athletes IS
  'Permits authenticated coaches (ADMIN or COACH role) to UPDATE '
  'athletes attached to a team they are members of via league_coaches. '
  'WITH CHECK identical to USING to prevent team-eviction attacks. '
  'Orphan athletes (league_team_id IS NULL) are not covered — they '
  'are editable only via athletes_own_profile policy (if user_id '
  'exists) or admin.';
