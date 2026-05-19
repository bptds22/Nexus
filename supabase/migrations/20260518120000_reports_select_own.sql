-- Add SELECT policy on public.reports so users can read back reports
-- they filed. Needed so the recruiter UI can chain .select("id") after
-- a successful INSERT and show a reference ID in the confirmation toast.
-- Also primes a future "Mes signalements" view in the recruteur portal.
--
-- Admin SELECT is already covered by "admins read all".

CREATE POLICY "Users can read their own filed reports"
ON public.reports
FOR SELECT
TO authenticated
USING (reported_by_id = auth.uid());