-- athlete_targets.status — CIBLE / REVE classification on Mes Cibles.
--
-- Sprint A of the Mon Parcours mobile build. The brief calls for a
-- CIBLE / REVE distinction on each target ("CIBLE" = realistic, focused
-- shortlist; "REVE" = aspirational reach). The existing table from
-- 20260520180000_mon_parcours_foundation.sql has rank + created_at but
-- no status column.
--
-- Additive only :
--   1. ADD COLUMN status text DEFAULT 'CIBLE'
--   2. CHECK constraint : status IN ('CIBLE','REVE')
--   3. Backfill any existing rows to 'CIBLE' (safety belt — the DEFAULT
--      handles new inserts, but existing rows from v1 of the table
--      have NO status and need an explicit value before the CHECK
--      becomes meaningful).
--
-- RLS UNCHANGED. The "Athletes manage own targets" policy from the
-- foundation migration (20260520180000_mon_parcours_foundation.sql L23)
-- is table-scoped (Postgres RLS policies attach to the table, not to
-- individual columns), so adding a column is automatically covered by
-- the same USING + WITH CHECK predicates. No policy edit is needed,
-- and column-level RLS is not a concept here.
--
-- The column is INDEPENDENT of `rank` — rank is positional ordering
-- within the athlete's target list, status is a per-target type tag.

ALTER TABLE public.athlete_targets
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'CIBLE';

-- Backfill belt — IF NOT EXISTS skips when the column already exists,
-- but the column-add above is the canonical line ; this UPDATE catches
-- the edge case where the column was added previously (e.g. partial
-- migration) without a default backfill.
UPDATE public.athlete_targets
   SET status = 'CIBLE'
 WHERE status IS NULL;

ALTER TABLE public.athlete_targets
  DROP CONSTRAINT IF EXISTS athlete_targets_status_check;

ALTER TABLE public.athlete_targets
  ADD CONSTRAINT athlete_targets_status_check
  CHECK (status IN ('CIBLE', 'REVE'));
