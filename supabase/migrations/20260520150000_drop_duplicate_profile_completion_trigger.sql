-- athletes had two triggers running the identical calculate_profile_completion():
-- trg_profile_completion (enabled, kept) and trigger_profile_completion (disabled,
-- dead duplicate). Drop the disabled duplicate. No behavior change — it wasn't firing.
-- The kept trigger and the shared function are untouched.
DROP TRIGGER IF EXISTS trigger_profile_completion ON public.athletes;
