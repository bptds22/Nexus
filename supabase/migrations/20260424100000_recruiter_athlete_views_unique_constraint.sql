-- Add unique constraint for recruiter/athlete/view_date dedup
--
-- The profile view tracker (app/recruteur/athletes/[id]/page.tsx
-- recordView useEffect) does .upsert(..., { onConflict:
-- "recruiter_id,athlete_id,view_date" }) to dedupe one row per
-- recruiter per athlete per calendar day. But the constraint was
-- never created — only PK on id existed — so the upsert's
-- onConflict clause had no constraint to match and writes were
-- silently dropped (combined with fire-and-forget client code,
-- the failure was invisible).
--
-- The view_date column is already GENERATED from viewed_at::date,
-- so adding the constraint doesn't require a data migration — it
-- just enforces what the client code has assumed all along.

-- Drop any accidental duplicates before adding the constraint
-- (only applies if prior writes somehow landed — expected to be 0 rows)
DELETE FROM public.recruiter_athlete_views a
USING public.recruiter_athlete_views b
WHERE a.id < b.id
  AND a.recruiter_id = b.recruiter_id
  AND a.athlete_id = b.athlete_id
  AND a.view_date = b.view_date;

-- Add the unique constraint the client code expects
ALTER TABLE public.recruiter_athlete_views
  ADD CONSTRAINT recruiter_athlete_views_recruiter_athlete_date_key
  UNIQUE (recruiter_id, athlete_id, view_date);
