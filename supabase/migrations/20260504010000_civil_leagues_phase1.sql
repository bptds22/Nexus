-- ═══════════════════════════════════════════════════════════════
-- Civil Leagues — Phase 1: schema prep + opportunistic hardening.
--
-- Three independent concerns, bundled because they're co-shipping
-- and share the same Phase 0 audit context:
--
--   1. league_teams: add `age_group text` (nullable) — enables
--      civil-league teams to differentiate cohorts
--      (U17, U15, U13, etc.) within the same name/season/division.
--
--   2. league_teams: anti-dup UNIQUE on (league_id, name,
--      age_group, division, season). NULL is treated as DISTINCT
--      by Postgres (default NULLS DISTINCT semantics), so two
--      rows with age_group=NULL and identical other keys would
--      not be blocked. Pre-check confirmed zero existing
--      duplicates on (league_id, name, division, season) — the
--      NULL case is acceptable as long as data stays clean.
--
--   3. league_teams: replace the "Owners manage their teams"
--      policy. Existing definition has only USING (no
--      WITH CHECK), which permits an authenticated user to
--      INSERT a row claiming owner_id = someone_else_uuid (the
--      USING clause doesn't run on INSERT — only WITH CHECK
--      does). Adding WITH CHECK closes that quiet privilege
--      escalation surfaced during Phase 0 audit.
--
--   4. recruiter_pipeline: add CHECK on `stage` so the load-
--      bearing column can no longer accept arbitrary text.
--      Today there's neither an enum nor a CHECK; only the
--      application's StatusChangeDropdown component constrains
--      values. Pre-check confirmed all live data is within the
--      canonical six-stage set.
--
-- Pre-checks executed 2026-05-04 (both passed):
--   - league_teams: 0 rows with duplicate (league_id, name,
--     division, season) tuples
--   - recruiter_pipeline: distinct stage values are subset of
--     the canonical six (live: IDENTIFIE, CONTACTE,
--     EN_DISCUSSION, VISITE_PLANIFIEE, ENGAGE, LETTRE_SIGNEE)
-- ═══════════════════════════════════════════════════════════════

-- 1. league_teams: add age_group column (nullable, no default).
ALTER TABLE public.league_teams
  ADD COLUMN IF NOT EXISTS age_group text;

-- 2. league_teams: anti-dup UNIQUE constraint on the team identity
--    tuple. NULL age_group permits multiple rows with same other
--    keys (Postgres default UNIQUE treats NULL as distinct);
--    that's acceptable per Phase 0 design — stricter dedup would
--    require NULLS NOT DISTINCT (Postgres 15+) which we may
--    revisit if the NULL-clash case appears in the wild.
ALTER TABLE public.league_teams
  ADD CONSTRAINT uq_league_teams_identity
  UNIQUE (league_id, name, age_group, division, season);

-- 3. league_teams: tighten "Owners manage their teams" policy.
--    Previously USING-only, which doesn't gate INSERT
--    (USING applies to existing rows; WITH CHECK applies to
--    rows being written). Drop and recreate with both clauses.
DROP POLICY IF EXISTS "Owners manage their teams" ON public.league_teams;
CREATE POLICY "Owners manage their teams" ON public.league_teams
  FOR ALL
  TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- 4. recruiter_pipeline: CHECK constraint on stage. Canonical
--    six-stage set per the StatusChangeDropdown spec
--    (IDENTIFIE → CONTACTE → EN_DISCUSSION → VISITE_PLANIFIEE
--    → ENGAGE → LETTRE_SIGNEE). Future stage additions require
--    a migration that drops + recreates this constraint.
ALTER TABLE public.recruiter_pipeline
  ADD CONSTRAINT chk_recruiter_pipeline_stage
  CHECK (stage IN (
    'IDENTIFIE',
    'CONTACTE',
    'EN_DISCUSSION',
    'VISITE_PLANIFIEE',
    'ENGAGE',
    'LETTRE_SIGNEE'
  ));
