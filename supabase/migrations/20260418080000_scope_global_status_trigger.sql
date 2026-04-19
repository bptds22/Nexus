-- Phase 1: Scope trg_sync_global_status to propagate only for Pro+ recruiters
--
-- Context: recruiter_pipeline INSERT/UPDATE fires this trigger, which
-- computes the athlete's highest pipeline stage across ALL recruiters and
-- writes that to athletes.recruitment_status (a globally visible field).
--
-- Pre-fix: a Free recruiter writing any pipeline row would trigger the sync,
-- causing their stage to propagate into the shared athletes.recruitment_status
-- that every other user sees. This was the data-integrity hole flagged in the
-- actions audit.
--
-- Post-fix: the guard returns NEW early if the row's recruiter_id does not
-- have Pro or higher, so Free-tier pipeline writes never propagate to the
-- shared status field. The pipeline row itself still gets written (subject
-- to Phase 2 RLS); only its downstream effect on global status is gated.
--
-- Also adds SET search_path = public for consistency with Phase 0.7 helpers
-- (prevents search-path-based privilege escalation on SECURITY DEFINER).

CREATE OR REPLACE FUNCTION public.sync_global_recruitment_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  max_pipeline_stage TEXT;
  new_global_status recruitment_status;
BEGIN
  -- Tier guard: only Pro+ recruiters can influence shared recruitment_status.
  IF NOT public.user_has_pro(NEW.recruiter_id) THEN
    RETURN NEW;
  END IF;

  SELECT stage INTO max_pipeline_stage
  FROM recruiter_pipeline
  WHERE athlete_id = NEW.athlete_id
  ORDER BY CASE stage
    WHEN 'IDENTIFIE'         THEN 1
    WHEN 'CONTACTE'          THEN 2
    WHEN 'EN_DISCUSSION'     THEN 3
    WHEN 'VISITE_PLANIFIEE'  THEN 4
    WHEN 'ENGAGE'            THEN 5
    WHEN 'LETTRE_SIGNEE'     THEN 6
    ELSE 0
  END DESC
  LIMIT 1;

  IF max_pipeline_stage IN ('ENGAGE', 'LETTRE_SIGNEE') THEN
    new_global_status := 'RECRUTE';
  ELSIF max_pipeline_stage IN ('EN_DISCUSSION', 'VISITE_PLANIFIEE') THEN
    new_global_status := 'EN_PROCESSUS';
  ELSE
    new_global_status := 'OUVERT';
  END IF;

  UPDATE athletes
  SET recruitment_status = new_global_status,
      recruitment_status_changed_at = now(),
      recruitment_status_changed_by = NULL
  WHERE id = NEW.athlete_id
    AND (
      recruitment_status_changed_by IS NULL
      OR
      CASE new_global_status
        WHEN 'OUVERT'       THEN 0
        WHEN 'EN_PROCESSUS' THEN 1
        WHEN 'RECRUTE'      THEN 2
        WHEN 'RETIRE'       THEN 3
      END
      >
      CASE recruitment_status
        WHEN 'OUVERT'       THEN 0
        WHEN 'EN_PROCESSUS' THEN 1
        WHEN 'RECRUTE'      THEN 2
        WHEN 'RETIRE'       THEN 3
      END
    );

  RETURN NEW;
END;
$function$;
