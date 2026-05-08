-- ═══════════════════════════════════════════════════════════════
-- leagues: UNIQUE INDEX on (LOWER(name), sport_id, level).
--
-- Background: 5.4g-iii ships a find-or-create utility for civil
-- league names entered by coaches via the new TeamCreateForm
-- autocomplete. Without DB-level uniqueness, two coaches typing
-- the same brand-new league name within ~1ms create separate
-- `leagues` rows. The race window is small but not zero, and the
-- corruption is silent.
--
-- Constraint scope follows the 5.4g-iii spec — not partial. RSEQ
-- league names imported via seed should already be unique within
-- their (sport, level) tuple; civil names go through the new
-- find-or-create path; both share the same anti-dup gate.
--
-- LOWER(name) protects against casing variants ("Cobras AAA" vs
-- "cobras aaa" vs "Cobras Aaa"). The autocomplete + find-or-create
-- normalize via case-insensitive ILIKE matching, so the index
-- expression mirrors that lookup shape.
--
-- Defensive pre-check: if any (LOWER(name), sport_id, level) group
-- already has duplicates in the target DB, the migration aborts
-- with a descriptive error before attempting CREATE INDEX. This
-- avoids the cryptic Postgres "could not create unique index"
-- message and points at the right resolution path (manual cleanup
-- of the duplicate group).
-- ═══════════════════════════════════════════════════════════════

DO $$
DECLARE
  dup_groups integer;
  sample_dup record;
BEGIN
  SELECT COUNT(*) INTO dup_groups FROM (
    SELECT 1
    FROM public.leagues
    GROUP BY LOWER(name), sport_id, level
    HAVING COUNT(*) > 1
  ) g;

  IF dup_groups > 0 THEN
    SELECT LOWER(name) AS norm_name, sport_id, level, COUNT(*) AS n
    INTO sample_dup
    FROM public.leagues
    GROUP BY LOWER(name), sport_id, level
    HAVING COUNT(*) > 1
    LIMIT 1;

    RAISE EXCEPTION
      'Cannot add UNIQUE index uq_leagues_identity: % duplicate group(s) exist. '
      'Sample: name=%, sport_id=%, level=%, count=%. '
      'Resolve duplicates (consolidate FK references onto one canonical row, '
      'then DELETE the others) before re-running this migration.',
      dup_groups,
      sample_dup.norm_name,
      sample_dup.sport_id,
      sample_dup.level,
      sample_dup.n;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_leagues_identity
  ON public.leagues (LOWER(name), sport_id, level);
