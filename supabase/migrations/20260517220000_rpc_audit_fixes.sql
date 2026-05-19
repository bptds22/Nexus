-- Two RPC cleanups identified in 2026-05-17 audit:
--
-- 1. get_my_school_ids: references school_directors table which does not
--    exist in the schema. Dead code. No policies or functions reference it.
--    Drop.
--
-- 2. get_sport_view_stats: not SECURITY DEFINER. Reads athletes and
--    recruiter_athlete_views (both RLS-protected). When called via .rpc()
--    by a recruiter, RLS filters athlete/view rows and the stats computation
--    returns incorrect ranks silently. The function is intended to compute
--    platform-wide statistics — must see all rows regardless of caller.
--    Convert to SECURITY DEFINER + row_security=off + search_path=public.

DROP FUNCTION IF EXISTS public.get_my_school_ids();

CREATE OR REPLACE FUNCTION public.get_sport_view_stats(p_athlete_id uuid)
 RETURNS TABLE(total bigint, rank bigint, percentile numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET row_security = off
 SET search_path = public
AS $function$
BEGIN
  RETURN QUERY
  WITH sport AS (
    SELECT sport_id FROM athletes WHERE id = p_athlete_id
  ),
  athlete_views AS (
    SELECT a.id, COUNT(rav.id) as view_count
    FROM athletes a
    LEFT JOIN recruiter_athlete_views rav ON rav.athlete_id = a.id
    WHERE a.sport_id = (SELECT sport_id FROM sport)
    GROUP BY a.id
  ),
  ranked AS (
    SELECT av.id, av.view_count,
           RANK() OVER (ORDER BY av.view_count DESC) as rnk,
           COUNT(*) OVER () as total
    FROM athlete_views av
  )
  SELECT ranked.total::BIGINT,
         ranked.rnk::BIGINT,
         CASE 
           WHEN ranked.total <= 1 THEN 50
           ELSE ROUND(((ranked.total - ranked.rnk)::NUMERIC / (ranked.total - 1)) * 100, 0)
         END
  FROM ranked
  WHERE ranked.id = p_athlete_id;
END;
$function$;