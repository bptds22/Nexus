-- Hotfix compat shim — 2026-07-21
--
-- Migration 20260717240000_remove_sport_secondaire dropped
-- athletes.sport_secondaire_id / position_secondaire_id from prod, but
-- shipped mobile binaries (pre-build-3) and web loaders still name those
-- columns in their SELECT strings (loadAthleteRaw, the recruiter profile
-- bodies, the Mon Parcours player card). Result: PostgREST 42703
-- "column does not exist" -> HTTP 400, breaking athlete profile/card and
-- recruiter athlete views.
--
-- This re-adds the two columns as NULLABLE stubs: no FK, no default, no
-- data. Old SELECTs resolve to NULL instead of erroring; old writes that
-- set them succeed harmlessly. Nothing reads their value anymore.
--
-- REMOVABLE once build 3 (which no longer selects these) is fully rolled
-- out: DROP COLUMN sport_secondaire_id, position_secondaire_id;

ALTER TABLE public.athletes
  ADD COLUMN IF NOT EXISTS sport_secondaire_id    uuid,
  ADD COLUMN IF NOT EXISTS position_secondaire_id uuid;
