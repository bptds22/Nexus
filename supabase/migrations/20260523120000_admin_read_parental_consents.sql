-- Loi 25 admin readout: the /admin/loi25 Consentements tab needs to count
-- parental_consents by status (ATTESTED / PENDING / WITHDRAWN / EXPIRED).
-- RLS is enabled on parental_consents with zero policies → all reads blocked.
-- Add an admin-only SELECT policy, mirroring the is_admin() pattern used on
-- users / athletes / admin_claims. Coach/recruiter/athlete clients remain
-- blocked from reading other people's consent records.

CREATE POLICY "admins read parental_consents" ON public.parental_consents
  FOR SELECT USING (is_admin());
