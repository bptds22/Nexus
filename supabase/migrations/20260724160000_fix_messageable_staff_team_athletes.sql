-- Fix: _messageable_staff_ids keyed its team-coaches fallback on athletes.league_team_id,
-- a column NEVER populated (onboarding + saveAthlete write team membership to team_athletes,
-- and always set league_team_id = NULL). Result: the fallback was dead, so an athlete could
-- not message a coach who heads their team unless that coach was ALSO a club school_coach.
-- Rewrite to derive teams from team_athletes (the real roster join) and the effective school
-- from own school_id UNION the team's club school_id. A truly-orphan athlete (no school_id,
-- no team_athletes row) still resolves to empty -- that gap is parked, not fixed here.
CREATE OR REPLACE FUNCTION public._messageable_staff_ids(p_uid uuid)
RETURNS TABLE(coach_id uuid, role text)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  WITH ath AS (
    SELECT a.id AS athlete_id, a.school_id
    FROM public.athletes a
    WHERE a.user_id = p_uid
  ),
  my_teams AS (
    -- real team membership lives in team_athletes, NOT athletes.league_team_id
    SELECT ta.team_id
    FROM public.team_athletes ta
    JOIN ath ON ta.athlete_id = ath.athlete_id
  ),
  eff_schools AS (
    SELECT school_id FROM ath WHERE school_id IS NOT NULL
    UNION
    SELECT t.school_id
    FROM public.teams t
    JOIN my_teams mt ON mt.team_id = t.id
    WHERE t.school_id IS NOT NULL
  )
  -- club/school staff (school_coaches on the effective school)
  SELECT sc.coach_id, sc.role::text
  FROM public.school_coaches sc
  JOIN eff_schools es ON sc.school_id = es.school_id
  WHERE sc.role IN ('COACH','DIRECTEUR','DIRECTEUR_INTERIM')   -- exclut PENDING
  UNION
  -- team staff (coaches of the athlete's actual team, even if not a club school_coach)
  SELECT tc.coach_id, 'COACH'::text
  FROM public.team_coaches tc
  JOIN my_teams mt ON mt.team_id = tc.team_id;
$function$;
