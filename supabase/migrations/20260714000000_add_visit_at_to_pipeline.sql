-- Visite planifiée : date + heure de la visite, portée par la row pipeline
-- du recruteur (recruiter_pipeline est déjà unique sur (recruiter_id,
-- athlete_id), donc une visite par couple recruteur/athlète).
--
-- timestamptz et NON date : une visite a une heure ("visite le 12 mars à
-- 14h"), et le Québec est America/Toronto. `next_action_at` (type `date`)
-- reste ce qu'il est — un rappel de suivi générique, découplé du stage.
--
-- Nullable, sans default : le stage VISITE_PLANIFIEE peut être posé sans
-- date (le picker est explicitement optionnel côté UI). La colonne est
-- remise à NULL quand le stage quitte VISITE_PLANIFIEE.

ALTER TABLE public.recruiter_pipeline
ADD COLUMN IF NOT EXISTS visit_at timestamptz;

COMMENT ON COLUMN public.recruiter_pipeline.visit_at IS
  'Date+heure de la visite planifiée. Non-NULL seulement quand stage = VISITE_PLANIFIEE.';
