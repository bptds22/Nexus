-- UI textarea allows 1000 chars but DB CHECK capped at 300, causing silent
-- save failures for coach reports 301-1000 chars. Widen DB to match UI.
ALTER TABLE public.evaluations
  DROP CONSTRAINT IF EXISTS evaluations_rapport_entraineur_check;
ALTER TABLE public.evaluations
  ADD CONSTRAINT evaluations_rapport_entraineur_check
  CHECK (char_length(rapport_entraineur) <= 1000);
