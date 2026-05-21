-- RSEQ enrichment columns (nullable, additive — safe pre-launch schema change).
-- These hold data scraped from the public RSEQ bottin during the school-data
-- reconciliation. Schema goes in a migration (durable across db reset); the
-- DATA enrichment itself lands in reference_data.sql, not here.
--   postal_code: precise location + future address-matching key
--   slug:        stable RSEQ identifier — the re-scrape match key
--   iso_active:  RSEQ ISO-Active certification flag (active vs defunct program)
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS postal_code text;
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS slug text;
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS iso_active boolean;
