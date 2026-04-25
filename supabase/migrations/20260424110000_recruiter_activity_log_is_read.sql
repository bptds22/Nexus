-- Add is_read tracking to recruiter_activity_log for unread badge support.
--
-- The recruiter sidebar (RecruiterSidebar.tsx) was querying
-- recruiter_activity_log with .eq("is_read", false) to compute the
-- activities badge count. The column did not exist, causing every
-- page load to throw a 400. P2 bug fix.
--
-- Pattern chosen (Pattern 1): activities are auto-marked as read
-- when the user visits /recruteur/activites. Individual click-to-read
-- can be layered on later if granularity becomes a real product need.
--
-- All pre-existing rows are test/mock data. Marking them as read so
-- the badge starts at 0 for clean testing of the new flow.

ALTER TABLE public.recruiter_activity_log
  ADD COLUMN IF NOT EXISTS is_read BOOLEAN NOT NULL DEFAULT false;

UPDATE public.recruiter_activity_log SET is_read = true WHERE is_read = false;

CREATE INDEX IF NOT EXISTS recruiter_activity_log_unread_idx
  ON public.recruiter_activity_log (recruiter_id)
  WHERE is_read = false;
