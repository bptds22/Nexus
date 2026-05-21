-- Mon Parcours foundation:
-- (1) athlete_targets — the "Mes Cibles" CÉGEP shortlist (name-only v1)
-- (2) athletes.parcours_readiness jsonb — stores the 2 manual readiness
--     checkboxes (instagram_ready, knows_how_to_respond); the other 6
--     readiness items are auto-derived from existing columns.

-- 1. Mes Cibles shortlist
CREATE TABLE IF NOT EXISTS public.athlete_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id uuid NOT NULL REFERENCES public.athletes(id) ON DELETE CASCADE,
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  rank integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (athlete_id, school_id)
);

ALTER TABLE public.athlete_targets ENABLE ROW LEVEL SECURITY;

-- Athlete manages their own targets. Scoped via the athletes→user_id link.
-- No recursion: the athletes SELECT policy is user_id = auth.uid() (a plain
-- column predicate, no athlete_targets reference), so the EXISTS subquery
-- resolves cleanly with no cycle.
CREATE POLICY "Athletes manage own targets"
  ON public.athlete_targets
  FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.athletes a WHERE a.id = athlete_targets.athlete_id AND a.user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.athletes a WHERE a.id = athlete_targets.athlete_id AND a.user_id = auth.uid())
  );

-- 2. Manual-readiness store
ALTER TABLE public.athletes
  ADD COLUMN IF NOT EXISTS parcours_readiness jsonb NOT NULL DEFAULT '{}'::jsonb;
