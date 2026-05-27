-- Recruiter's primary CÉGEP program affiliation, captured at onboarding.
-- Single-select pointer (mirrors users.school_id). Decorative for now;
-- consumed later by athlete-scoping features.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS primary_team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL;
