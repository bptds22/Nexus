-- Add INSERT policy on public.reports so authenticated users can submit
-- a report (flag) on an athlete. Existing policies cover admin SELECT/
-- UPDATE/DELETE; this closes the gap that made the "Signaler" button on
-- the recruiter athlete profile a no-op (it set local state but never
-- persisted, deceiving users into thinking their report had been sent).
--
-- WITH CHECK aligns with reports table CHECK constraints:
--   - type IN ('PROFIL', 'MESSAGE', 'ABUS_CONTACT')
--   - status starts at 'OUVERT' (admins transition via separate UPDATE
--     policy through EN_EXAMEN / RESOLU / REJETE)
--   - reported_by_id must equal the calling user's auth.uid()
--   - target_type currently scoped to 'athlete' only (other targets
--     can be added in a later policy when their flows exist)

DROP POLICY IF EXISTS "Authenticated users can submit athlete reports" ON public.reports;

CREATE POLICY "Authenticated users can submit athlete reports"
ON public.reports
FOR INSERT
TO authenticated
WITH CHECK (
  reported_by_id = auth.uid()
  AND status = 'OUVERT'
  AND target_type = 'athlete'
  AND type = 'PROFIL'
);