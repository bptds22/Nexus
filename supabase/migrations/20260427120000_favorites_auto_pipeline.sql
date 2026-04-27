-- ═══════════════════════════════════════════════════════════════
-- Favorites → Pipeline auto-creation
-- ═══════════════════════════════════════════════════════════════
--
-- Architecture:
-- - Favoriting an athlete creates a pipeline row at IDENTIFIE
-- - Unfavoriting marks the row as RETIRE (preserves history)
-- - Re-favoriting from RETIRE resets the row back to IDENTIFIE
-- - The pipeline IS the favorited list (in/out tracked by stage)
--
-- Two triggers, two functions, both SECURITY DEFINER so RLS on
-- recruiter_pipeline doesn't block the trigger.

-- ── 1. Function: handle favorite INSERT ──────────────────────────

CREATE OR REPLACE FUNCTION public.fav_insert_to_pipeline()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_existing_id UUID;
BEGIN
  -- Check if a pipeline row already exists for this (recruiter, athlete)
  SELECT id INTO v_existing_id
  FROM public.recruiter_pipeline
  WHERE recruiter_id = NEW.recruiter_id
    AND athlete_id = NEW.athlete_id;

  IF v_existing_id IS NULL THEN
    -- No existing row: create at IDENTIFIE
    INSERT INTO public.recruiter_pipeline (recruiter_id, athlete_id, stage)
    VALUES (NEW.recruiter_id, NEW.athlete_id, 'IDENTIFIE');
  ELSE
    -- Existing row (re-favorite case): reset to IDENTIFIE only if currently RETIRE
    -- This protects active recruitment work — if the row is at any other stage
    -- (CONTACTE, EN_DISCUSSION, etc.) leave it alone. The favorite-pipeline
    -- coupling reasserts at IDENTIFIE only.
    UPDATE public.recruiter_pipeline
    SET stage = 'IDENTIFIE'
    WHERE id = v_existing_id
      AND stage = 'RETIRE';
  END IF;

  RETURN NEW;
END;
$$;

-- ── 2. Function: handle favorite DELETE ──────────────────────────

CREATE OR REPLACE FUNCTION public.fav_delete_to_pipeline()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Mark the pipeline row as RETIRE (don't delete)
  -- Preserves stage history and lets re-favorite restart cleanly
  UPDATE public.recruiter_pipeline
  SET stage = 'RETIRE'
  WHERE recruiter_id = OLD.recruiter_id
    AND athlete_id = OLD.athlete_id;

  RETURN OLD;
END;
$$;

-- ── 3. Attach triggers ───────────────────────────────────────────

DROP TRIGGER IF EXISTS trg_fav_insert_to_pipeline
  ON public.recruiter_favorites;

CREATE TRIGGER trg_fav_insert_to_pipeline
  AFTER INSERT ON public.recruiter_favorites
  FOR EACH ROW
  EXECUTE FUNCTION public.fav_insert_to_pipeline();

DROP TRIGGER IF EXISTS trg_fav_delete_to_pipeline
  ON public.recruiter_favorites;

CREATE TRIGGER trg_fav_delete_to_pipeline
  AFTER DELETE ON public.recruiter_favorites
  FOR EACH ROW
  EXECUTE FUNCTION public.fav_delete_to_pipeline();

-- ── 4. Backfill: existing favorites without pipeline rows ────────

-- Insert pipeline rows at IDENTIFIE for every favorite that has
-- no corresponding pipeline entry.
INSERT INTO public.recruiter_pipeline (recruiter_id, athlete_id, stage)
SELECT rf.recruiter_id, rf.athlete_id, 'IDENTIFIE'
FROM public.recruiter_favorites rf
LEFT JOIN public.recruiter_pipeline rp
  ON rp.recruiter_id = rf.recruiter_id
  AND rp.athlete_id = rf.athlete_id
WHERE rp.id IS NULL;

-- ── 5. Verify ────────────────────────────────────────────────────

DO $$
DECLARE
  v_orphan_count INTEGER;
BEGIN
  SELECT count(*) INTO v_orphan_count
  FROM public.recruiter_favorites rf
  LEFT JOIN public.recruiter_pipeline rp
    ON rp.recruiter_id = rf.recruiter_id
    AND rp.athlete_id = rf.athlete_id
  WHERE rp.id IS NULL;

  IF v_orphan_count > 0 THEN
    RAISE EXCEPTION 'Backfill incomplete: % orphan favorites remain', v_orphan_count;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_fav_insert_to_pipeline') THEN
    RAISE EXCEPTION 'INSERT trigger not created';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_fav_delete_to_pipeline') THEN
    RAISE EXCEPTION 'DELETE trigger not created';
  END IF;
END $$;
