-- ═══════════════════════════════════════════════════════════════
-- Trigger: reset athletes.league_team_id when the matching
-- league_team_athletes junction row is deleted.
--
-- Background: 5.5b shipped a dual-source architecture for civil
-- rosters — `athletes.league_team_id` carries the primary team
-- (display badge, recruiter card, sidebar lookups) and
-- `league_team_athletes` carries the full membership detail
-- (jersey, captain, joined_at). The two stay in sync as long as
-- the application writes both atomically. 5.5d-iii-b will wire
-- UI mutations (remove athlete, toggle captain, edit jersey)
-- through the coach detail page; this trigger guarantees the
-- anchor is consistent on DELETE without relying on the UI to
-- remember the second write.
--
-- Logic (multi-team safe): the trigger only nullifies the anchor
-- when the deleted junction row's league_team_id matches the
-- athlete's current `athletes.league_team_id`. If the athlete is
-- on multiple teams in the junction (an edge state — current
-- UNIQUE is on (league_team_id, athlete_id) only, not on
-- athlete_id alone) and the deleted row was for a non-anchor
-- team, the anchor is preserved. The athlete's primary team only
-- changes when the matching membership row is removed.
--
-- Privilege model: SECURITY DEFINER + SET search_path = public.
-- Mirrors the pattern from `coach_verification_tier` (commit
-- 94f39f2 → reverted in b807538) and `is_admin()` /
-- `update_updated_at()` helpers in the baseline. The trigger
-- fires from any DELETE call site (UI handlers, manual SQL,
-- cascade from league_teams DELETE) regardless of whether the
-- caller has direct UPDATE on athletes.
--
-- Idempotent: DROP IF EXISTS at the top so the migration can be
-- re-applied (e.g. during local rebuilds, or if a future revision
-- changes the function body and we need to drop+recreate).
-- ═══════════════════════════════════════════════════════════════

DROP TRIGGER IF EXISTS reset_athlete_anchor_on_team_remove
  ON public.league_team_athletes;
DROP FUNCTION IF EXISTS public.reset_athlete_anchor_on_team_remove();

CREATE OR REPLACE FUNCTION public.reset_athlete_anchor_on_team_remove()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Reset anchor only when the deleted membership row matches the
  -- athlete's current primary team. If the athlete is on multiple
  -- teams in the junction and we're removing a non-anchor row,
  -- leave league_team_id alone — anchor is the property of the
  -- "primary" team relationship, not every membership.
  UPDATE public.athletes
     SET league_team_id = NULL
   WHERE id = OLD.athlete_id
     AND league_team_id = OLD.league_team_id;

  RETURN OLD;
END;
$$;

CREATE TRIGGER reset_athlete_anchor_on_team_remove
  AFTER DELETE ON public.league_team_athletes
  FOR EACH ROW
  EXECUTE FUNCTION public.reset_athlete_anchor_on_team_remove();

COMMENT ON FUNCTION public.reset_athlete_anchor_on_team_remove() IS
  'Resets athletes.league_team_id to NULL when the matching junction row '
  'is deleted. Preserves anchor when athlete is removed from a non-anchor '
  'team (multi-team edge case). Paired with 5.5d-iii-b UI removal flow.';
