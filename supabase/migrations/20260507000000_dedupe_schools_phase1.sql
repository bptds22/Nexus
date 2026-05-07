-- ═══════════════════════════════════════════════════════════════
-- schools dedupe — phase 1 (high-confidence duplicates only).
--
-- Background: a name-normalization audit on the 945 schools rows
-- (lowercase + accent strip + prefix strip + punctuation strip)
-- surfaced 20 confirmed duplicate rows in three patterns:
--
--   Tier 1 (4 rows) — anglophone CEGEPs listed under both their
--     English official name AND a translated French name. Each
--     pair shares type=CEGEP and city, so the second row is
--     unambiguously redundant.
--
--   Tier 2 (8 rows) — francophone CEGEPs listed twice, once with
--     a proper city and once as a stub with NULL city. The stub
--     looks like an incomplete import. Same name (modulo
--     "Cégep de" vs "Collège de" prefix variation) and same type.
--
--   Tier 3 (8 rows) — four Gaspésie secondary schools each listed
--     three times: once at the actual school location, once at
--     the MRC seat (Bonaventure), and once at the regional centre
--     (Gaspé). The MRC and regional rows are administrative
--     phantoms — the same physical school re-entered with a
--     different city tag. All in region='Gaspésie–Îles-de-la-Madeleine'.
--
-- Safety: at audit time (2026-05-07), zero FK references existed
-- on any of these 20 rows in the local DB (confirmed via the 13
-- FK columns that point at schools.id: users.school_id,
-- athletes.school_id + committed_school_id, school_coaches,
-- activity_feed, admin_transfer_requests, cegep_email_domains,
-- commitment_requests, equipes, newsroom_events, parental_consents,
-- teams, plus the deprecated _deprecated_profile_views archive
-- which we intentionally skip). Production is expected to be
-- similarly clean since these rows are recent imports without
-- coach/athlete attachments. The migration still runs the FK
-- migration step defensively — it's a no-op when no refs exist
-- and a protective merge if any do.
--
-- Mapping is expressed as (keep_name, keep_city, drop_name, drop_city)
-- tuples rather than UUIDs because UUIDs differ between local and
-- production. The DO block validates every mapping resolves before
-- any write.
--
-- NOT covered by this migration (deferred):
--   - Common-name clusters (e.g. "École Le Tremplin" exists in 7
--     genuinely different cities) — these are real distinct schools
--     per Quebec's school-naming convention and must NOT be merged.
--   - Same-name pairs in adjacent municipalities (e.g. mackay
--     Montréal/Westmount) — need human verification before action.
--   - The "Cégep + Séminaire" / "Cégep + Académie" pairs in
--     Chicoutimi/Lévis/Sherbrooke/Trois-Rivières — these ARE
--     different institutions (post-secondary vs secondary).
-- ═══════════════════════════════════════════════════════════════

CREATE TEMP TABLE _dedupe_map (
  canonical_id uuid NOT NULL,
  duplicate_id uuid NOT NULL
);

WITH pairs(keep_name, keep_city, drop_name, drop_city) AS (VALUES
  -- Tier 1: bilingual fr/en CEGEPs (keep English official name)
  ('Dawson College',                    'Montréal',                  'Collège Dawson',                    'Montréal'),
  ('John Abbott College',               'Sainte-Anne-de-Bellevue',   'Cégep John Abbott',                 'Sainte-Anne-de-Bellevue'),
  ('Heritage College',                  'Gatineau',                  'Cégep Heritage',                    'Gatineau'),
  ('TAV College',                       'Montréal',                  'Collège TAV',                       'Montréal'),
  -- Tier 2: francophone CEGEPs with a stub-row twin (drop the NULL-city stub)
  ('Collège de Bois-de-Boulogne',       'Montréal',                  'Cégep de Bois-de-Boulogne',          NULL),
  ('Cégep de Limoilou',                 'Québec',                    'Cégep Limoilou',                     NULL),
  ('Collège Lionel-Groulx',             'Sainte-Thérèse',            'Cégep Lionel Groulx',                NULL),
  ('Collège de Maisonneuve',            'Montréal',                  'Cégep de Maisonneuve',               NULL),
  ('Collège Montmorency',               'Laval',                     'Cégep Montmorency',                  NULL),
  ('Collège de Rosemont',               'Montréal',                  'Cégep de Rosemont',                  NULL),
  ('Cégep de Saint-Jean-sur-Richelieu', 'Saint-Jean-sur-Richelieu',  'Cégep Saint-Jean-sur-Richelieu',     NULL),
  ('Collège de Valleyfield',            'Salaberry-de-Valleyfield',  'Cégep de Valleyfield',               NULL),
  -- Tier 3: Gaspésie phantoms (keep the row at actual school location)
  ('École secondaire de New Carlisle',  'New Carlisle',              'École secondaire de New Carlisle',  'Bonaventure'),
  ('École secondaire de New Carlisle',  'New Carlisle',              'École secondaire de New Carlisle',  'Gaspé'),
  ('École secondaire de New Richmond',  'New Richmond',              'École secondaire de New Richmond',  'Bonaventure'),
  ('École secondaire de New Richmond',  'New Richmond',              'École secondaire de New Richmond',  'Gaspé'),
  ('École secondaire Evergreen',        'Chandler',                  'École secondaire Evergreen',        'Bonaventure'),
  ('École secondaire Evergreen',        'Chandler',                  'École secondaire Evergreen',        'Gaspé'),
  ('École Intermédiaire d''Escuminac',  'Escuminac',                 'École Intermédiaire d''Escuminac',  'Bonaventure'),
  ('École Intermédiaire d''Escuminac',  'Escuminac',                 'École Intermédiaire d''Escuminac',  'Gaspé')
)
INSERT INTO _dedupe_map (canonical_id, duplicate_id)
SELECT
  (SELECT id FROM public.schools WHERE name = p.keep_name AND city IS NOT DISTINCT FROM p.keep_city),
  (SELECT id FROM public.schools WHERE name = p.drop_name AND city IS NOT DISTINCT FROM p.drop_city)
FROM pairs p;

-- Validate every mapping resolved to two real rows. RAISE EXCEPTION
-- triggers an automatic rollback of the entire migration.
DO $$
DECLARE
  resolved integer;
  null_count integer;
BEGIN
  SELECT COUNT(*) INTO resolved FROM _dedupe_map;
  IF resolved != 20 THEN
    RAISE EXCEPTION 'Expected 20 dedupe mappings, got %', resolved;
  END IF;
  SELECT COUNT(*) INTO null_count FROM _dedupe_map
    WHERE canonical_id IS NULL OR duplicate_id IS NULL;
  IF null_count > 0 THEN
    RAISE EXCEPTION
      '% mappings could not resolve in target DB — schools rows '
      'may have been renamed or already deduped.', null_count;
  END IF;
END $$;

-- Migrate FK references onto canonical IDs. No-op locally (audit
-- showed zero refs); protective in production. One UPDATE per FK
-- column referencing schools.id.
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
-- _deprecated_profile_views_2026_05.cegep_id intentionally skipped
-- (archive table, no live readers).

-- Drop the duplicate rows.
DELETE FROM public.schools WHERE id IN (SELECT duplicate_id FROM _dedupe_map);

-- Final integrity check: every duplicate must be gone.
DO $$
DECLARE
  remaining integer;
BEGIN
  SELECT COUNT(*) INTO remaining
    FROM public.schools s
    JOIN _dedupe_map d ON s.id = d.duplicate_id;
  IF remaining > 0 THEN
    RAISE EXCEPTION
      '% duplicate schools rows still present after DELETE — '
      'unexpected FK constraint blocked the deletion.', remaining;
  END IF;
END $$;
