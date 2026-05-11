-- ═══════════════════════════════════════════════════════════════
-- Phase 6.1.0 — ALTER schools.type CHECK to accept LIGUE_CIVILE
--
-- Pre-flight for the Phase 6.1 data migration that will move
-- league_teams rows into schools with type='LIGUE_CIVILE'. Without
-- this CHECK update, every INSERT in the data migration would crash
-- (the prior CHECK only allowed 'SECONDAIRE' or 'CEGEP').
--
-- Scope:
--   - DROP existing schools_type_check
--   - ADD schools_type_check with LIGUE_CIVILE appended
--
-- NOT in scope:
--   - No data INSERT (0 rows of any type added by this migration)
--   - No RLS policy changes
--   - No trigger changes
--   - No app code changes
--
-- Pre-migration state (audited 2026-05-11):
--   schools: 818 SECONDAIRE + 68 CEGEP + 0 LIGUE_CIVILE = 886 total
--   Constraint: schools_type_check CHECK ((type = ANY (ARRAY['SECONDAIRE','CEGEP'])))
--
-- 0 users in production → no risk of regression on live data.
-- ═══════════════════════════════════════════════════════════════

BEGIN;

ALTER TABLE public.schools
  DROP CONSTRAINT IF EXISTS schools_type_check;

ALTER TABLE public.schools
  ADD CONSTRAINT schools_type_check
  CHECK (type = ANY (ARRAY['SECONDAIRE'::text, 'CEGEP'::text, 'LIGUE_CIVILE'::text]));

COMMIT;
