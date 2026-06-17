-- F6-A: Pin search_path on all SECURITY DEFINER functions missing it
--
-- 28 functions have no search_path set (config=NULL or only row_security=off).
-- All are trigger functions (not RPC-callable) except is_admin + is_platform_admin
-- (already fixed in C2 for is_platform_admin). search_path injection risk is
-- low (requires CREATE on a schema earlier in path) but this is standard hardening.
--
-- is_admin is the only non-trigger in this batch — it's a policy gatekeeper.
-- is_partner_eligible_athlete is also non-trigger but low risk (athlete lookup).

-- Policy gatekeeper
ALTER FUNCTION public.is_admin()
  SET search_path = 'public';

-- Partner helper (non-trigger)
ALTER FUNCTION public.is_partner_eligible_athlete(uuid)
  SET search_path = 'public';

-- Trigger functions (not RPC-callable, but still should be pinned)
ALTER FUNCTION public.auto_set_recrute_on_confirmation()
  SET search_path = 'public';

ALTER FUNCTION public.auto_upgrade_favorite_to_en_processus()
  SET search_path = 'public';

ALTER FUNCTION public.demote_interim_on_director_appointment()
  SET search_path = 'public';

ALTER FUNCTION public.emit_five_star_newsroom_event()
  SET search_path = 'public';

ALTER FUNCTION public.emit_five_star_on_eligibility_flip()
  SET search_path = 'public';

ALTER FUNCTION public.fav_insert_to_pipeline()
  SET search_path = 'public';

ALTER FUNCTION public.link_athlete_on_signup()
  SET search_path = 'public';

ALTER FUNCTION public.log_athlete_update()
  SET search_path = 'public';

ALTER FUNCTION public.log_coach_activity_favorited()
  SET search_path = 'public';

ALTER FUNCTION public.log_coach_activity_message()
  SET search_path = 'public';

ALTER FUNCTION public.log_coach_activity_verified()
  SET search_path = 'public';

ALTER FUNCTION public.log_favorite_added()
  SET search_path = 'public';

ALTER FUNCTION public.log_new_athlete()
  SET search_path = 'public';

ALTER FUNCTION public.log_note_added()
  SET search_path = 'public';

ALTER FUNCTION public.log_profile_view()
  SET search_path = 'public';

ALTER FUNCTION public.log_review_submitted()
  SET search_path = 'public';

ALTER FUNCTION public.notify_athlete_favorited()
  SET search_path = 'public';

ALTER FUNCTION public.notify_athlete_profile_viewed()
  SET search_path = 'public';

ALTER FUNCTION public.notify_athlete_suggestion_result()
  SET search_path = 'public';

ALTER FUNCTION public.notify_athlete_verified()
  SET search_path = 'public';

ALTER FUNCTION public.sync_school_admin_flag()
  SET search_path = 'public';

ALTER FUNCTION public.sync_user_admin_flag()
  SET search_path = 'public';

ALTER FUNCTION public.sync_user_school_from_coaches()
  SET search_path = 'public';

ALTER FUNCTION public.sync_user_school_on_coach_remove()
  SET search_path = 'public';
