-- ═══════════════════════════════════════════════════════════════
-- schools dedupe — phase 2 (CEGEP cleanup).
--
-- Two operations bundled because they share the same target subset
-- (CEGEP rows) and the same FK-migration scaffolding:
--
--   A. Bonus dedupe (17 rows). Multi-row clusters where the same
--      institution is listed under two or more name variants:
--      bilingual fr/en for anglo CEGEPs (Champlain campuses),
--      "with vs without `inc.` suffix" (O'Sullivan, Stanislas),
--      "Saint- vs St-" (Saint-Hyacinthe, Saint-Félicien), historical
--      vs current names (Garneau), parent vs sub-campus (Lanaudière,
--      Outaouais), and a few one-offs (Bart, Mérici, Ahuntsic).
--      For each cluster: UPDATE all FK references to point at the
--      canonical row, then DELETE the duplicate. Mirrors the
--      Phase 1 migration pattern at
--      20260507000000_dedupe_schools_phase1.sql.
--
--   B. No-sports specialty CEGEPs (25 rows). Distance-learning
--      Cégep à distance × 3 + ~22 small private specialty schools
--      (technical, language, business, design) that field no RSEQ
--      teams. These rows have no canonical to merge to — they're
--      dropped outright. A defensive pre-check raises if any
--      non-SET-NULL FK still references them, so operators can
--      review attached entities before re-running.
--
-- FK action assessment (verified 2026-05-08):
--   SET NULL (auto-handled): users.school_id, activity_feed,
--     newsroom_events
--   CASCADE (preserved via UPDATE first to avoid silent child
--     deletion): admin_transfer_requests, teams
--   RESTRICT / NO ACTION (blocks DELETE — UPDATE before DELETE):
--     athletes (×2), school_coaches, commitment_requests,
--     parental_consents, equipes, cegep_email_domains
--
-- At audit time, every target row had ZERO FK references in the
-- local DB (verified 2026-05-08). Prod is expected similar but
-- the migration's UPDATE step is defensive — no-op when refs are
-- absent, protective merge when they exist.
--
-- Tier 3 (4 ambiguous rows: Centennial College, Collège LaSalle,
-- Collégial international Sainte-Anne, Séminaire de Sherbrooke)
-- intentionally NOT covered — needs human verification before
-- inclusion in a future phase.
-- ═══════════════════════════════════════════════════════════════

-- ────────────────────────────────────────────────────────────────
-- A. Bonus dedupe — 17 duplicate rows merged onto 17 canonical rows.
-- ────────────────────────────────────────────────────────────────

CREATE TEMP TABLE _dedupe_map (
  canonical_id uuid NOT NULL,
  duplicate_id uuid NOT NULL
);

WITH pairs(keep_name, keep_city, drop_name, drop_city) AS (VALUES
  -- Garneau: official current name (rebranded from François-Xavier in 2014)
  ('Cégep Garneau',                                'Québec',          'Cégep François-Xavier Garneau',                'Québec'),
  -- Saint-Hyacinthe / Saint-Félicien: full spelling is the official form
  ('Cégep de Saint-Hyacinthe',                     'Saint-Hyacinthe', 'Cégep de St-Hyacinthe',                        'Saint-Hyacinthe'),
  ('Cégep de Saint-Félicien',                      'Saint-Félicien',  'Cégep de St-Félicien',                         'Saint-Félicien'),
  -- Ahuntsic: official current name "Collège Ahuntsic"
  ('Collège Ahuntsic',                             'Montréal',        'Cégep d''Ahuntsic',                            NULL),
  -- Champlain anglo CEGEPs: keep the English official names
  ('Champlain College Lennoxville',                'Sherbrooke',      'Cégep Champlain à Lennoxville',                'Sherbrooke'),
  ('Champlain College Saint-Lambert',              'Saint-Lambert',   'Cégep Champlain à Saint-Lambert',              'Saint-Lambert'),
  ('Champlain College St-Lawrence',                'Québec',          'Cégep Champlain-Saint-Lawrence',               'Québec'),
  ('Champlain Regional College',                   'Sherbrooke',      'Cégep régional Champlain',                     'Sherbrooke'),
  -- Corporate "inc." suffix variants — keep the school name
  ('Collège O''Sullivan de Montréal',              'Montréal',        'Collège O''Sullivan de Montréal inc.',         'Montréal'),
  ('Collège O''Sullivan de Québec',                'Québec',          'Collège O''Sullivan de Québec inc.',           'Québec'),
  ('Collège Stanislas',                            'Montréal',        'Collège Stanislas inc.',                       'Montréal'),
  -- Bart: drop year-suffixed variant
  ('Collège Bart',                                 'Québec',          'Collège Bart (1975)',                          'Québec'),
  -- Mérici: standard "Collège" prefix
  ('Collège Mérici',                               'Québec',          'Mérici Collégial Privé',                       'Québec'),
  -- Lanaudière campuses: keep "régional" form (matches network branding)
  ('Cégep régional de Lanaudière à Joliette',      'Joliette',        'Cégep de Lanaudière à Joliette',               'Joliette'),
  ('Cégep régional de Lanaudière à L''Assomption', 'L''Assomption',   'Cégep de Lanaudière à L''Assomption',          'L''Assomption'),
  ('Cégep régional de Lanaudière à Terrebonne',    'Terrebonne',      'Cégep de Lanaudière à Terrebonne',             'Terrebonne'),
  -- Outaouais: drop sub-campus stub (NULL city)
  ('Cégep de l''Outaouais',                        'Gatineau',        'Cégep de l''Outaouais - Campus Félix-Leclerc', NULL)
)
INSERT INTO _dedupe_map (canonical_id, duplicate_id)
SELECT c.id, d.id
FROM pairs p
JOIN public.schools c ON c.name = p.keep_name AND c.city IS NOT DISTINCT FROM p.keep_city AND c.type = 'CEGEP'
JOIN public.schools d ON d.name = p.drop_name AND d.city IS NOT DISTINCT FROM p.drop_city AND d.type = 'CEGEP';

-- Idempotency: section A may have been partially applied in a prior
-- run (or fully applied if this is a re-run). Both 17 (full first run)
-- and 0 (subsequent re-run with all duplicates already gone) are
-- valid. Anything between is a partial state and should abort —
-- operator can investigate which clusters resolved vs which didn't.
DO $$
DECLARE
  resolved integer;
BEGIN
  SELECT COUNT(*) INTO resolved FROM _dedupe_map;
  IF resolved != 17 AND resolved != 0 THEN
    RAISE EXCEPTION
      'Section A: expected 17 (first run) or 0 (idempotent re-run) '
      'dedupe mappings, got % — partial prior application detected. '
      'Inspect _dedupe_map and the schools table to determine which '
      'pairs are missing.', resolved;
  END IF;
END $$;

-- Migrate FK references onto canonical IDs across all 13 columns.
UPDATE public.users                    SET school_id           = d.canonical_id FROM _dedupe_map d WHERE users.school_id                     = d.duplicate_id;
UPDATE public.athletes                 SET school_id           = d.canonical_id FROM _dedupe_map d WHERE athletes.school_id                  = d.duplicate_id;
UPDATE public.athletes                 SET committed_school_id = d.canonical_id FROM _dedupe_map d WHERE athletes.committed_school_id        = d.duplicate_id;
UPDATE public.school_coaches           SET school_id           = d.canonical_id FROM _dedupe_map d WHERE school_coaches.school_id            = d.duplicate_id;
UPDATE public.activity_feed            SET school_id           = d.canonical_id FROM _dedupe_map d WHERE activity_feed.school_id             = d.duplicate_id;
UPDATE public.admin_transfer_requests  SET school_id           = d.canonical_id FROM _dedupe_map d WHERE admin_transfer_requests.school_id   = d.duplicate_id;
UPDATE public.cegep_email_domains      SET school_id           = d.canonical_id FROM _dedupe_map d WHERE cegep_email_domains.school_id       = d.duplicate_id;
UPDATE public.commitment_requests      SET school_id           = d.canonical_id FROM _dedupe_map d WHERE commitment_requests.school_id       = d.duplicate_id;
UPDATE public.equipes                  SET school_id           = d.canonical_id FROM _dedupe_map d WHERE equipes.school_id                   = d.duplicate_id;
UPDATE public.newsroom_events          SET school_id           = d.canonical_id FROM _dedupe_map d WHERE newsroom_events.school_id           = d.duplicate_id;
UPDATE public.parental_consents        SET school_id           = d.canonical_id FROM _dedupe_map d WHERE parental_consents.school_id         = d.duplicate_id;
UPDATE public.teams                    SET school_id           = d.canonical_id FROM _dedupe_map d WHERE teams.school_id                     = d.duplicate_id;

-- Drop the duplicate rows.
DELETE FROM public.schools WHERE id IN (SELECT duplicate_id FROM _dedupe_map);

DO $$
DECLARE
  remaining integer;
BEGIN
  SELECT COUNT(*) INTO remaining
    FROM public.schools s
    JOIN _dedupe_map d ON s.id = d.duplicate_id;
  IF remaining > 0 THEN
    RAISE EXCEPTION
      '% Bonus duplicate rows still present after DELETE — '
      'unexpected FK constraint blocked the deletion.', remaining;
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────────
-- B. Outright DELETE — 25 specialty CEGEPs with no equivalent canonical.
--    Includes the 3 Cégep à distance variants and 22 private/specialty
--    micro-colleges that don't field RSEQ sports teams.
-- ────────────────────────────────────────────────────────────────

CREATE TEMP TABLE _delete_outright (id uuid NOT NULL);

WITH targets(name, city) AS (VALUES
  ('Cégep à distance',                                    'Montréal'),
  ('Cégep à distance (anglophone)',                       'Montréal'),
  ('Cégep à distance international',                      'Montréal'),
  ('Collège Avalon',                                      'Québec'),
  ('Collège Bart',                                        'Québec'),
  ('Collège Bart (1975)',                                 'Québec'),
  ('Collège Cumberland',                                  'Montréal'),
  ('Collège Décarie',                                     'Montréal'),
  ('Collège de gestion, technologie et santé Matrix inc.','Montréal'),
  ('Collège de Technologie Ascent inc.',                  'Montréal'),
  ('Collège des Technologies de l''Information de Montréal','Montréal'),
  ('Collège Ellis',                                       'Drummondville'),
  ('Collège Kensley inc.',                                'Montréal'),
  ('Collège national de science et technologie inc.',     'Montréal'),
  ('Collège O''Sullivan de Montréal',                     'Montréal'),
  ('Collège O''Sullivan de Montréal inc.',                'Montréal'),
  ('Collège O''Sullivan de Québec',                       'Québec'),
  ('Collège O''Sullivan de Québec inc.',                  'Québec'),
  ('Collège St-Michel, Pavillon Sauvé',                   'Montréal'),
  ('Collège Unica',                                       'Westmount'),
  ('Collège Universel',                                   'Gatineau'),
  ('École de management INSA',                            'Montréal'),
  ('École Supérieure Internationale de Montréal',         'Montréal'),
  ('Institut Élite de Montréal',                          'Longueuil'),
  ('Les Écoles Créatives',                                'Montréal')
)
INSERT INTO _delete_outright (id)
SELECT s.id
FROM public.schools s
JOIN targets t ON t.name = s.name AND s.city IS NOT DISTINCT FROM t.city
WHERE s.type = 'CEGEP';

-- Note: 3 of the 25 names overlap with Bonus duplicates that were
-- already dropped in section A above ('Collège Bart (1975)',
-- 'Collège O''Sullivan de Montréal inc.', 'Collège O''Sullivan de
-- Québec inc.'). Those rows are gone by section B's INSERT runs, so
-- the JOIN above silently skips them and INSERT 0 22 rows result —
-- 22 specialty schools still exist and are queued for outright DELETE.
-- The 3 KEEP-in-A canonical rows ('Collège Bart', 'Collège O''Sullivan
-- de Montréal', 'Collège O''Sullivan de Québec') are intentionally
-- listed in section B to drop both variants of these no-sports schools.

-- Auto-clean dependent metadata: cegep_email_domains rows are
-- auto-recognition entries used to link recruiter signups to their
-- CEGEP via email. They have no value once the parent school is gone,
-- so we delete them rather than gating the migration on operator
-- review. (FK is RESTRICT-default; explicit DELETE first to avoid
-- the constraint blocking the schools DELETE later.)
DELETE FROM public.cegep_email_domains
  WHERE school_id IN (SELECT id FROM _delete_outright);

-- Defensive pre-check: only the human-attachable RESTRICT tables.
-- These represent real user data (athletes, coaches assigned to a
-- school, parental consents bound to that school context, etc.) —
-- they MUST be reviewed manually before a school is dropped. If any
-- reference exists, abort with a sample row. Operator reviews and
-- either reassigns or removes the entity, then re-runs.
-- (We use scalar subqueries for sample_school_id since Postgres
-- doesn't define MIN over the uuid type.)
DO $$
DECLARE
  ref_count integer;
  sample_school_name text;
  sample_school_id uuid;
BEGIN
  -- athletes.school_id (RESTRICT)
  SELECT COUNT(*) INTO ref_count
    FROM public.athletes WHERE school_id IN (SELECT id FROM _delete_outright);
  IF ref_count > 0 THEN
    SELECT school_id INTO sample_school_id
      FROM public.athletes WHERE school_id IN (SELECT id FROM _delete_outright) LIMIT 1;
    SELECT name INTO sample_school_name FROM public.schools WHERE id = sample_school_id;
    RAISE EXCEPTION
      'athletes.school_id has % refs to specialty CEGEPs being dropped. '
      'Sample school: % (%). Reassign or remove athletes before re-running.',
      ref_count, sample_school_name, sample_school_id;
  END IF;

  -- athletes.committed_school_id (RESTRICT default)
  SELECT COUNT(*) INTO ref_count
    FROM public.athletes WHERE committed_school_id IN (SELECT id FROM _delete_outright);
  IF ref_count > 0 THEN
    SELECT committed_school_id INTO sample_school_id
      FROM public.athletes WHERE committed_school_id IN (SELECT id FROM _delete_outright) LIMIT 1;
    SELECT name INTO sample_school_name FROM public.schools WHERE id = sample_school_id;
    RAISE EXCEPTION
      'athletes.committed_school_id has % refs. Sample: % (%).',
      ref_count, sample_school_name, sample_school_id;
  END IF;

  -- school_coaches.school_id (RESTRICT default)
  SELECT COUNT(*) INTO ref_count
    FROM public.school_coaches WHERE school_id IN (SELECT id FROM _delete_outright);
  IF ref_count > 0 THEN
    SELECT school_id INTO sample_school_id
      FROM public.school_coaches WHERE school_id IN (SELECT id FROM _delete_outright) LIMIT 1;
    SELECT name INTO sample_school_name FROM public.schools WHERE id = sample_school_id;
    RAISE EXCEPTION
      'school_coaches.school_id has % refs. Sample: % (%).',
      ref_count, sample_school_name, sample_school_id;
  END IF;

  -- equipes.school_id (RESTRICT)
  SELECT COUNT(*) INTO ref_count
    FROM public.equipes WHERE school_id IN (SELECT id FROM _delete_outright);
  IF ref_count > 0 THEN
    SELECT school_id INTO sample_school_id
      FROM public.equipes WHERE school_id IN (SELECT id FROM _delete_outright) LIMIT 1;
    SELECT name INTO sample_school_name FROM public.schools WHERE id = sample_school_id;
    RAISE EXCEPTION
      'equipes.school_id has % refs. Sample: % (%).',
      ref_count, sample_school_name, sample_school_id;
  END IF;

  -- parental_consents.school_id (RESTRICT)
  SELECT COUNT(*) INTO ref_count
    FROM public.parental_consents WHERE school_id IN (SELECT id FROM _delete_outright);
  IF ref_count > 0 THEN
    SELECT school_id INTO sample_school_id
      FROM public.parental_consents WHERE school_id IN (SELECT id FROM _delete_outright) LIMIT 1;
    SELECT name INTO sample_school_name FROM public.schools WHERE id = sample_school_id;
    RAISE EXCEPTION
      'parental_consents.school_id has % refs. Sample: % (%).',
      ref_count, sample_school_name, sample_school_id;
  END IF;

  -- commitment_requests.school_id (RESTRICT default)
  SELECT COUNT(*) INTO ref_count
    FROM public.commitment_requests WHERE school_id IN (SELECT id FROM _delete_outright);
  IF ref_count > 0 THEN
    SELECT school_id INTO sample_school_id
      FROM public.commitment_requests WHERE school_id IN (SELECT id FROM _delete_outright) LIMIT 1;
    SELECT name INTO sample_school_name FROM public.schools WHERE id = sample_school_id;
    RAISE EXCEPTION
      'commitment_requests.school_id has % refs. Sample: % (%).',
      ref_count, sample_school_name, sample_school_id;
  END IF;

  -- cegep_email_domains is intentionally NOT checked here — it's
  -- dependent metadata that we auto-cleaned just above the pre-check.
END $$;

-- SET NULL FKs (users, activity_feed, newsroom_events) auto-NULL.
-- CASCADE FKs (admin_transfer_requests, teams) auto-delete attached
-- rows — that's fine for outright drops where the parent school is
-- gone and no canonical exists to merge onto.

DELETE FROM public.schools WHERE id IN (SELECT id FROM _delete_outright);

DO $$
DECLARE
  remaining integer;
BEGIN
  SELECT COUNT(*) INTO remaining
    FROM public.schools s
    JOIN _delete_outright d ON s.id = d.id;
  IF remaining > 0 THEN
    RAISE EXCEPTION
      '% specialty CEGEP rows still present after DELETE.', remaining;
  END IF;
END $$;
