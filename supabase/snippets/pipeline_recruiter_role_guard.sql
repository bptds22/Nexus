-- Guard: only users with role = 'RECRUTEUR' can appear as recruiter_id
-- on recruiter_pipeline. Prevents the class of bug where coach/admin/athlete
-- user ids were being inserted as fake recruiters.

CREATE OR REPLACE FUNCTION public.require_recruiter_role()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = NEW.recruiter_id AND role = 'RECRUTEUR'
  ) THEN
    RAISE EXCEPTION 'recruiter_id % is not a RECRUTEUR user', NEW.recruiter_id
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pipeline_recruiter_role ON public.recruiter_pipeline;

CREATE TRIGGER trg_pipeline_recruiter_role
BEFORE INSERT OR UPDATE OF recruiter_id ON public.recruiter_pipeline
FOR EACH ROW EXECUTE FUNCTION public.require_recruiter_role();
