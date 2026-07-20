-- ═══════════════════════════════════════════════════════════════════════
-- Message → pipeline CONTACTE auto-entry.
--
-- Design intent (lib/config/recruitmentStatuses.ts): "CONTACTÉ — auto on
-- first message". Only the favorite→IDENTIFIE half was ever built
-- (fav_insert_to_pipeline). This adds the message half so that a recruiter
-- who messages a coach about an athlete — WITHOUT favoriting first — lands
-- the athlete in "Mon processus" at CONTACTE.
--
-- Mirrors fav_insert_to_pipeline: AFTER INSERT trigger + SECURITY DEFINER
-- function (function owner bypasses the user_has_pro() RLS gate on
-- recruiter_pipeline, so this works for Free recruiters too, exactly like
-- favoriting does). CONTACTE maps to global recruitment_status OUVERT and
-- sync_global_recruitment_status is itself Pro-gated, so no global side
-- effect for Free recruiters.
--
-- Guards:
--   • Only the RECRUITER's own message triggers it (NEW.sender_id =
--     conversations.recruiter_id) — coach replies never touch the pipeline.
--   • Rank-guarded: create @ CONTACTE if no row; advance to CONTACTE ONLY
--     from IDENTIFIE; never regress EN_DISCUSSION / VISITE_PLANIFIEE /
--     ENGAGE / LETTRE_SIGNEE (or an already-CONTACTE row → no-op).
--   • conversations.athlete_id is NOT NULL, so there is no "general inquiry"
--     case to exclude.
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.message_insert_to_pipeline()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_recruiter_id  uuid;
  v_athlete_id    uuid;
  v_existing_stage text;
BEGIN
  -- Resolve the conversation, but ONLY when the sender is the recruiter.
  -- A coach reply (sender_id = coach_id) yields no row → no-op.
  SELECT c.recruiter_id, c.athlete_id
    INTO v_recruiter_id, v_athlete_id
  FROM public.conversations c
  WHERE c.id = NEW.conversation_id
    AND c.recruiter_id = NEW.sender_id;

  IF v_recruiter_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Current pipeline stage for this (recruiter, athlete), if any.
  SELECT stage INTO v_existing_stage
  FROM public.recruiter_pipeline
  WHERE recruiter_id = v_recruiter_id
    AND athlete_id = v_athlete_id;

  IF v_existing_stage IS NULL THEN
    -- No pipeline row yet (messaged without favoriting) → create at CONTACTE.
    -- ON CONFLICT guards the rare race where a concurrent write created the
    -- row between the SELECT above and this INSERT (an AFTER-INSERT exception
    -- would otherwise roll back the message itself).
    INSERT INTO public.recruiter_pipeline (recruiter_id, athlete_id, stage)
    VALUES (v_recruiter_id, v_athlete_id, 'CONTACTE')
    ON CONFLICT (recruiter_id, athlete_id) DO NOTHING;

  ELSIF v_existing_stage = 'IDENTIFIE' THEN
    -- Favorited-but-not-yet-contacted → advance to CONTACTE. The WHERE
    -- re-asserts stage = 'IDENTIFIE' so a concurrent advance can't regress.
    UPDATE public.recruiter_pipeline
    SET stage = 'CONTACTE', moved_at = now(), updated_at = now()
    WHERE recruiter_id = v_recruiter_id
      AND athlete_id = v_athlete_id
      AND stage = 'IDENTIFIE';
  END IF;
  -- Any other existing stage (CONTACTE / EN_DISCUSSION / VISITE_PLANIFIEE /
  -- ENGAGE / LETTRE_SIGNEE) → left untouched. No regression, no duplicate.

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_message_to_pipeline ON public.messages;
CREATE TRIGGER trg_message_to_pipeline
AFTER INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.message_insert_to_pipeline();

-- ── One-time backfill ────────────────────────────────────────────────────
-- Create CONTACTE rows for existing conversations where the recruiter has
-- already sent >= 1 message and no pipeline row exists yet. Insert-only:
-- does NOT advance existing IDENTIFIE rows, and DO NOTHING on any conflict.
INSERT INTO public.recruiter_pipeline (recruiter_id, athlete_id, stage)
SELECT DISTINCT c.recruiter_id, c.athlete_id, 'CONTACTE'
FROM public.conversations c
WHERE EXISTS (
  SELECT 1 FROM public.messages m
  WHERE m.conversation_id = c.id
    AND m.sender_id = c.recruiter_id
)
AND NOT EXISTS (
  SELECT 1 FROM public.recruiter_pipeline p
  WHERE p.recruiter_id = c.recruiter_id
    AND p.athlete_id = c.athlete_id
)
ON CONFLICT (recruiter_id, athlete_id) DO NOTHING;
