-- Public aggregate counter for recruiter_favorites per athlete.
--
-- Recruiter identities behind favorites are private (RLS gates the
-- rows themselves to owner, the favorited athlete, that athlete's
-- coach, and admins). But the AGGREGATE count is public — anyone
-- authenticated can see "3 recruiters favorited this athlete."
-- Paying users may get to see WHO; the count itself is free tier.
--
-- The athlete profile page's favCount was reading from
-- recruiter_favorites.select(count) directly and getting only the
-- RLS-filtered count (e.g. 1 for the current recruiter's own row
-- instead of the true total of 3). This function bypasses RLS for
-- the specific purpose of returning the aggregate.
--
-- SECURITY DEFINER + search_path pinned to public (standard guard
-- against search_path hijacking in SECURITY DEFINER functions).

CREATE OR REPLACE FUNCTION public.count_athlete_favorites(athlete_uuid UUID)
RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT COUNT(*)::INTEGER
  FROM recruiter_favorites
  WHERE athlete_id = athlete_uuid;
$$;

-- Allow any authenticated user to invoke. The function itself doesn't
-- leak row data, only the integer count.
GRANT EXECUTE ON FUNCTION public.count_athlete_favorites(UUID) TO authenticated;

-- Same pattern for views — coach/athlete dashboards want the total
-- view count per athlete without seeing who viewed. Mirrors the
-- favorites approach; count is public, identities are RLS-gated.
CREATE OR REPLACE FUNCTION public.count_athlete_views(athlete_uuid UUID)
RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT COUNT(*)::INTEGER
  FROM recruiter_athlete_views
  WHERE athlete_id = athlete_uuid;
$$;

GRANT EXECUTE ON FUNCTION public.count_athlete_views(UUID) TO authenticated;
