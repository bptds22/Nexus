-- Phase 6.3-followup-4 — Denormalize athletes.context
--
-- Context: users.context is not readable by recruiters. The users
-- table RLS has no SELECT policy allowing a recruiter to read an
-- athlete's user row (only own row, coaches, conversation participants,
-- admins, or coach-orphan-lookup). The recruiter search embed
-- `users!user_id(context)` therefore silently returned NULL for every
-- athlete — PostgREST drops the RLS-filtered embed row without error —
-- breaking the orgType filter's orphan-classification branch.
--
-- Fix: denormalize context onto athletes (recruiters already have RLS
-- SELECT on athletes), kept in sync via an AFTER UPDATE trigger on
-- users.context.

BEGIN;

-- ────────────────────────────────────────────────────────────────
-- Step 1 : add column (nullable, no default — mirrors users.context
-- which is 'scolaire' | 'ligue_civile' | NULL)
-- ────────────────────────────────────────────────────────────────
ALTER TABLE public.athletes
  ADD COLUMN IF NOT EXISTS context text;

COMMENT ON COLUMN public.athletes.context IS
  'Denormalized from users.context (Phase 6.3-followup-4). Kept in '
  'sync by trg_sync_athlete_context on public.users. Readable by '
  'recruiters via the existing athletes RLS — users.context is not '
  '(RLS-blocked for recruiter -> athlete user rows).';

-- ────────────────────────────────────────────────────────────────
-- Step 2 : backfill from users for athletes that have a user account
-- ────────────────────────────────────────────────────────────────
UPDATE public.athletes a
SET context = u.context
FROM public.users u
WHERE a.user_id = u.id
  AND a.user_id IS NOT NULL;

-- ────────────────────────────────────────────────────────────────
-- Step 3 : sync trigger — propagate users.context changes to athletes
-- SECURITY DEFINER so the cascading UPDATE on athletes bypasses RLS
-- (the user updating their own context has no UPDATE grant on the
-- athletes row otherwise).
-- ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.sync_athlete_context()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.athletes
  SET context = NEW.context
  WHERE user_id = NEW.id;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_sync_athlete_context ON public.users;
CREATE TRIGGER trg_sync_athlete_context
  AFTER UPDATE OF context ON public.users
  FOR EACH ROW
  WHEN (NEW.context IS DISTINCT FROM OLD.context)
  EXECUTE FUNCTION public.sync_athlete_context();

-- ────────────────────────────────────────────────────────────────
-- Sanity checks (RAISE EXCEPTION rollback la TX si partial)
-- ────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_col_exists boolean;
  v_trigger_exists boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'athletes'
      AND column_name = 'context'
  ) INTO v_col_exists;
  IF NOT v_col_exists THEN
    RAISE EXCEPTION 'athletes.context column not created';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_sync_athlete_context'
  ) INTO v_trigger_exists;
  IF NOT v_trigger_exists THEN
    RAISE EXCEPTION 'trg_sync_athlete_context trigger not created';
  END IF;

  RAISE NOTICE 'Phase 6.3-followup-4 : athletes.context column + backfill + sync trigger created.';
END $$;

COMMIT;
