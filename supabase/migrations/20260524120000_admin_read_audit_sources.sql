-- Loi 25 admin audit-export needs to read these audit / event tables. Each
-- currently has role-scoped SELECT policies (coach / recruiter / athlete /
-- partner) with no admin path, so admin SELECT is blocked. Add an admin-only
-- SELECT policy on each, mirroring the is_admin() pattern used on
-- parental_consents / users / athletes. Existing role-scoped policies stay
-- as-is — this only widens admin access.

DROP POLICY IF EXISTS "admins read consent_audit_trail" ON public.consent_audit_trail;
CREATE POLICY "admins read consent_audit_trail" ON public.consent_audit_trail
  FOR SELECT USING (is_admin());

DROP POLICY IF EXISTS "admins read recruiter_athlete_views" ON public.recruiter_athlete_views;
CREATE POLICY "admins read recruiter_athlete_views" ON public.recruiter_athlete_views
  FOR SELECT USING (is_admin());

DROP POLICY IF EXISTS "admins read recruiter_activity_log" ON public.recruiter_activity_log;
CREATE POLICY "admins read recruiter_activity_log" ON public.recruiter_activity_log
  FOR SELECT USING (is_admin());

DROP POLICY IF EXISTS "admins read partner_profile_views" ON public.partner_profile_views;
CREATE POLICY "admins read partner_profile_views" ON public.partner_profile_views
  FOR SELECT USING (is_admin());

DROP POLICY IF EXISTS "admins read athlete_suggestions" ON public.athlete_suggestions;
CREATE POLICY "admins read athlete_suggestions" ON public.athlete_suggestions
  FOR SELECT USING (is_admin());

DROP POLICY IF EXISTS "admins read messages" ON public.messages;
CREATE POLICY "admins read messages" ON public.messages
  FOR SELECT USING (is_admin());

DROP POLICY IF EXISTS "admins read conversations" ON public.conversations;
CREATE POLICY "admins read conversations" ON public.conversations
  FOR SELECT USING (is_admin());
