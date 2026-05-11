-- ═══════════════════════════════════════════════════════════════
-- 5.5e-iv-d: Set athletes.coach_id on civil invitation acceptance
--
-- Amends apply_team_invitation_acceptance trigger from 5.5e-iii-a:
-- adds a 4th operation that resolves the team's ADMIN coach and sets
-- athletes.coach_id. Without this, civil athletes who join a team
-- via Flow A had league_team_id set but coach_id stayed NULL, so the
-- "Mon coach" section on /athlete/parametres rendered empty.
--
-- ADMIN resolution uses ORDER BY created_at ASC LIMIT 1 as a
-- defensive tie-breaker — current data has 0 teams with >1 ADMIN
-- but the trigger should not be ambiguous in a future multi-ADMIN
-- scenario.
--
-- Defensive COALESCE: if no ADMIN exists on the team at the moment
-- of acceptance (edge case where an ADMIN was removed between the
-- invitation INSERT and the athlete's ACCEPT), preserve the
-- existing coach_id rather than clobber it to NULL.
--
-- Also backfills existing civil athletes where league_team_id is
-- set but coach_id is NULL (Alex Dubois + Civil ATH per the
-- pre-migration audit — 2 rows total). Same defensive guard via
-- EXISTS so backfill is a no-op for the (hypothetical) team-
-- without-ADMIN case.
--
-- Idempotency: re-running the migration drops and recreates the
-- trigger + function cleanly; the backfill UPDATE only touches
-- rows where coach_id IS NULL, so a second apply is a no-op once
-- those rows are filled.
-- ═══════════════════════════════════════════════════════════════

-- Drop trigger first so the function drop doesn't need CASCADE.
DROP TRIGGER IF EXISTS apply_team_invitation_acceptance
  ON public.team_invitations;

DROP FUNCTION IF EXISTS public.apply_team_invitation_acceptance();

CREATE OR REPLACE FUNCTION public.apply_team_invitation_acceptance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  resolved_admin_id uuid;
BEGIN
  -- (a) INSERT junction row for new team. ON CONFLICT DO NOTHING
  -- so a stale row from a previous attempt doesn't block.
  INSERT INTO public.league_team_athletes (league_team_id, athlete_id)
  VALUES (NEW.league_team_id, NEW.athlete_id)
  ON CONFLICT (league_team_id, athlete_id) DO NOTHING;

  -- (b) UPDATE anchor BEFORE deleting old junctions so the
  -- 5.5d-iii-a reset trigger (fires on the next step's DELETE)
  -- sees a non-matching anchor and no-ops.
  UPDATE public.athletes
     SET league_team_id = NEW.league_team_id
   WHERE id = NEW.athlete_id;

  -- (c) DELETE old junction rows on other teams (single-team
  -- enforcement; future multi-team UX would remove this step).
  DELETE FROM public.league_team_athletes
   WHERE athlete_id = NEW.athlete_id
     AND league_team_id <> NEW.league_team_id;

  -- (d) Resolve the team's ADMIN coach and set athletes.coach_id.
  -- Tie-breaker for the (currently theoretical) multi-ADMIN case:
  -- earliest-created ADMIN wins. Defensive COALESCE preserves the
  -- existing coach_id when no ADMIN is present.
  SELECT lc.coach_id
    INTO resolved_admin_id
    FROM public.league_coaches lc
   WHERE lc.league_team_id = NEW.league_team_id
     AND lc.role = 'ADMIN'
   ORDER BY lc.created_at ASC
   LIMIT 1;

  UPDATE public.athletes
     SET coach_id = COALESCE(resolved_admin_id, coach_id)
   WHERE id = NEW.athlete_id;

  RETURN NEW;
END;
$$;

CREATE TRIGGER apply_team_invitation_acceptance
  AFTER UPDATE ON public.team_invitations
  FOR EACH ROW
  WHEN (NEW.status = 'ACCEPTED' AND OLD.status IS DISTINCT FROM 'ACCEPTED')
  EXECUTE FUNCTION public.apply_team_invitation_acceptance();

COMMENT ON FUNCTION public.apply_team_invitation_acceptance() IS
  'Fires when team_invitations.status flips to ACCEPTED. '
  'Operations in order: (a) INSERT junction, (b) UPDATE anchor, '
  '(c) DELETE old junctions, (d) Set athletes.coach_id = team ADMIN '
  '(defensive COALESCE, ORDER BY created_at ASC LIMIT 1 for the '
  'theoretical multi-ADMIN tie-breaker).';

-- ────────────────────────────────────────────────────────────────
-- One-shot backfill — civil athletes anchored to a team with no
-- coach_id. Pre-migration audit identifies 2 rows. Defensive
-- EXISTS guard prevents the UPDATE from setting coach_id to NULL
-- in the hypothetical no-ADMIN case.
-- ────────────────────────────────────────────────────────────────
UPDATE public.athletes a
   SET coach_id = (
         SELECT lc.coach_id
           FROM public.league_coaches lc
          WHERE lc.league_team_id = a.league_team_id
            AND lc.role = 'ADMIN'
          ORDER BY lc.created_at ASC
          LIMIT 1
       )
 WHERE a.league_team_id IS NOT NULL
   AND a.coach_id IS NULL
   AND EXISTS (
     SELECT 1
       FROM public.league_coaches lc
      WHERE lc.league_team_id = a.league_team_id
        AND lc.role = 'ADMIN'
   );
