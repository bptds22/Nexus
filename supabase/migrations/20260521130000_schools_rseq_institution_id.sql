-- RSEQ InstitutionId — RSEQ's own stable school GUID, the durable join key for all
-- future RSEQ standings/roster scrapes. Distinct from school_registry_id (MEQ GUID).
-- Matched by name ONCE (the bridge), then every RSEQ scrape joins on this — no re-matching.
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS rseq_institution_id uuid;
CREATE INDEX IF NOT EXISTS idx_schools_rseq_institution_id ON public.schools(rseq_institution_id) WHERE rseq_institution_id IS NOT NULL;
