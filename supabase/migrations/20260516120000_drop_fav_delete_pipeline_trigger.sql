-- ────────────────────────────────────────────────────────────────
-- Drop fav_delete_to_pipeline trigger + function — P1 hotfix
-- ────────────────────────────────────────────────────────────────
-- Background:
--
-- Migration 20260427120000_favorites_auto_pipeline.sql shipped two
-- triggers on public.recruiter_favorites:
--   * trg_fav_insert_to_pipeline → INSERT pipeline row at IDENTIFIE
--   * trg_fav_delete_to_pipeline → UPDATE pipeline stage to 'RETIRE'
--
-- One week later, migration 20260504010000_civil_leagues_phase1.sql
-- added chk_recruiter_pipeline_stage which restricts stage to:
--   IDENTIFIE, CONTACTE, EN_DISCUSSION, VISITE_PLANIFIEE, ENGAGE,
--   LETTRE_SIGNEE
--
-- It forgot to include 'RETIRE'. Since then, every recruteur DELETE
-- on recruiter_favorites that has a corresponding recruiter_pipeline
-- row aborts with:
--   ERROR: new row for relation "recruiter_pipeline" violates check
--          constraint "chk_recruiter_pipeline_stage"
-- (empirically reproduced 2026-05-16).
--
-- Because trg_fav_insert_to_pipeline (still working) auto-creates a
-- pipeline row for every favorite, virtually every unfavorite hits
-- this — favorites become effectively un-removable.
--
-- Decision (BP-locked): drop the DELETE trigger entirely. Unfavorite
-- now leaves the recruiter_pipeline row untouched at its current
-- stage. The recruteur retains agency via the existing "Retirer du
-- pipeline" UI action which DELETEs the pipeline row independently.
-- Favorite ↔ pipeline are now decoupled-on-delete (Q3 spec).
--
-- Note: the INSERT trigger (trg_fav_insert_to_pipeline) still
-- references RETIRE in dead-code defensive branch ("reset to
-- IDENTIFIE only if currently RETIRE"). With no row ever reaching
-- RETIRE again, that branch becomes unreachable but is harmless —
-- left for a future cleanup PR rather than expanded scope here.
-- ────────────────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS trg_fav_delete_to_pipeline
  ON public.recruiter_favorites;

DROP FUNCTION IF EXISTS public.fav_delete_to_pipeline();

-- Sanity verify the INSERT trigger (Q1+Q2 path) is untouched.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_fav_insert_to_pipeline'
      AND tgrelid = 'public.recruiter_favorites'::regclass
  ) THEN
    RAISE EXCEPTION 'trg_fav_insert_to_pipeline missing — Q1+Q2 path broken';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_fav_delete_to_pipeline'
      AND tgrelid = 'public.recruiter_favorites'::regclass
  ) THEN
    RAISE EXCEPTION 'trg_fav_delete_to_pipeline still present — drop failed';
  END IF;
END $$;
