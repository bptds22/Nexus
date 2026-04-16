-- ═══════════════════════════════════════════════════════════════
-- Coach analytics RLS — allow coaches to read profile_views,
-- recruiter_favorites, and conversations for athletes at their own
-- school (so /coach/ecole/analytics can aggregate true counts).
--
-- Without these policies the base schema blocks all non-admin SELECTs
-- on profile_views and recruiter_favorites, which is why the
-- analytics page was showing 1 view / 1 favori / 1 contact instead
-- of the real totals.
--
-- Run in Supabase Studio → SQL Editor.
-- ═══════════════════════════════════════════════════════════════

-- ── profile_views ─────────────────────────────────────────────
-- A coach can read any view on an athlete whose athletes.school_id
-- matches the coach's own users.school_id OR a school_coaches.school_id
-- they belong to.
DROP POLICY IF EXISTS "coaches read views for own school athletes" ON public.profile_views;
CREATE POLICY "coaches read views for own school athletes"
  ON public.profile_views
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.athletes a
      JOIN public.users u ON u.id = auth.uid()
      WHERE a.id = profile_views.athlete_id
        AND (
          a.school_id = u.school_id
          OR a.school_id IN (
            SELECT school_id FROM public.school_coaches WHERE coach_id = auth.uid()
          )
        )
    )
  );

-- ── recruiter_favorites ──────────────────────────────────────
DROP POLICY IF EXISTS "coaches read favorites for own school athletes" ON public.recruiter_favorites;
CREATE POLICY "coaches read favorites for own school athletes"
  ON public.recruiter_favorites
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.athletes a
      JOIN public.users u ON u.id = auth.uid()
      WHERE a.id = recruiter_favorites.athlete_id
        AND (
          a.school_id = u.school_id
          OR a.school_id IN (
            SELECT school_id FROM public.school_coaches WHERE coach_id = auth.uid()
          )
        )
    )
  );

-- ── conversations (aggregate count only — no message content) ─
-- The base policy already lets a coach read conversations where
-- coach_id = auth.uid(). This adds read access for conversations
-- about athletes at the coach's school even when a different coach
-- is the assigned counterpart (needed for the "Contacts" KPI).
DROP POLICY IF EXISTS "coaches read convs for own school athletes" ON public.conversations;
CREATE POLICY "coaches read convs for own school athletes"
  ON public.conversations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.athletes a
      JOIN public.users u ON u.id = auth.uid()
      WHERE a.id = conversations.athlete_id
        AND (
          a.school_id = u.school_id
          OR a.school_id IN (
            SELECT school_id FROM public.school_coaches WHERE coach_id = auth.uid()
          )
        )
    )
  );

-- ── Diagnostic: run this after applying to confirm ────────────
--
-- Expected: total_views per athlete matches the profile-page count
-- shown to recruiters.
--
-- SELECT pv.athlete_id, a.first_name, a.last_name, COUNT(*) AS total_views
-- FROM public.profile_views pv
-- JOIN public.athletes a ON a.id = pv.athlete_id
-- GROUP BY pv.athlete_id, a.first_name, a.last_name
-- ORDER BY total_views DESC;
