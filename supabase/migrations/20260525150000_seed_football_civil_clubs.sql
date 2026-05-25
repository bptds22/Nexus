-- ────────────────────────────────────────────────────────────────
-- Football civil clubs — coach-creation sport, clubs only.
-- ────────────────────────────────────────────────────────────────
-- Source : https://www.footballquebec.com/fr/football/reseauxdecompetition
-- 40 unique club names deduped across LFMM / MRFL / QBFL / QMFL /
-- LFJMQ-QMJFL / LFQ9 / LFFMQ. Football is COACH-CREATION (Football
-- Québec publishes club/team names but NO structured division /
-- age / gender per team) — we seed the parent CLUB rows only and
-- coaches create their teams under them via the merged-search +
-- locked-create flow.
--
-- Idempotency : NO unique constraint on schools.name alone — only
-- a unique INDEX on (lower(name), COALESCE(lower(city), ''), type).
-- ON CONFLICT against an expression-index inference is fragile,
-- so each row is guarded with a NOT EXISTS check on
-- (lower(name), type) instead. Re-running this migration after
-- success is a no-op : `INSERT 0 0` and the count below stays at 40.
--
-- Excluded for safety (Phase 1) :
--   - Vipers / Raptors / Barbarians (LIGUE FS8 — no qualifier)
--   - Tornades (LFRGIRLZ — collides with existing soccer
--     "Tornades de Longueuil")
--   - Blizzard (LFRGIRLZ — collides with hockey "Blizzard du
--     Séminaire Saint-François")
--   - RSEQ Ligues provinciales scolaires / Football Collégial /
--     Football Universitaire (organizational tiers, not clubs;
--     already covered by the school/CEGEP seed)
--
-- Byte-safety : apply via docker cp + psql -f with
-- PGCLIENTENCODING=UTF8 (CLAUDE.md). Payload accents : Phénix,
-- Mauricie, Saguenay, Châteauguay, Cœur, Léonard, Beauce — and the
-- apostrophe in "Patriotes de l'Ouest" is doubled (SQL-escaped) to
-- 'Patriotes de l''Ouest'. The sanity SELECTs at the bottom verify
-- byte integrity (bytes > chars on accented rows).
--
-- Schema notes :
--   - sport_id is NOT set — civil clubs are sport-agnostic; sport
--     lives on the `teams` rows that hang under each club.
--   - city is left NULL — the directory page implies city through
--     the name but doesn't publish a separate field.
--   - has_secondaire / has_collegial are OMITTED from the INSERT.
--     They're school-level attributes (does this school offer the
--     secondaire / collégial tier?) and don't meaningfully apply
--     to a civil CLUB. Both columns default to false in the
--     schema, so the resulting rows are bit-identical to the
--     existing 224 civil clubs (all of which carry false / false)
--     without us asserting anything about a flag that doesn't
--     belong to clubs.
--   - langue / reseau / website / etc. left NULL.
-- ────────────────────────────────────────────────────────────────

BEGIN;

WITH new_clubs(name, region) AS (
  VALUES
    -- LFMM (14 clubs)
    ('Aces Pointe Saint-Charles',                      'Montréal'),
    ('Football civil de Saint-Jean-sur-Richelieu (AFSCJ)', 'Rive-Sud'),
    ('Diablos de LaPrairie',                           'Rive-Sud'),
    ('Barons de Saint-Bruno',                          'Rive-Sud'),
    ('Vandoos de Drummondville',                       'Centre-du-Québec'),
    ('Rhinos de Lanaudière',                           'Lanaudière'),
    ('Packers de Greenfield',                          'Rive-Sud'),
    ('Grizzlis de Boucherville',                       'Rive-Sud'),
    ('Wildcats Laurentides-Lanaudière',                'Laurentides'),
    ('Pirates du Richelieu',                           'Rive-Sud'),
    ('Vicas de Victoriaville',                         'Centre-du-Québec'),
    ('Vikings de Laval-Nord',                          'Laval'),
    ('Patriotes de l''Ouest',                          'Lac St-Louis'),
    ('Stallions de Saint-Lazare',                      'Lac St-Louis'),
    -- MRFL / QBFL / QMFL (11 clubs after cross-league dedup)
    ('Warriors de LaSalle',                            'Lac St-Louis'),
    ('Blues de Chomedey',                              'Laval'),
    ('Dragons de Laval',                               'Laval'),
    ('Bulldogs de Laval',                              'Laval'),
    ('Cougars de Lakeshore',                           'Lac St-Louis'),
    ('Cougars de Saint-Léonard',                       'Bourassa'),
    ('Vikings de Gatineau',                            'Outaouais'),
    ('Hornets de Sun Youth',                           'Montréal'),
    ('North Shore',                                    'Montréal — Lac-Saint-Louis'),
    ('Raiders de Chateauguay',                         'Sud-Ouest'),
    ('Spartans de Saint-Laurent',                     'Lac St-Louis'),
    -- LFJMQ-QMJFL (4 clubs; Wildcats variant merged into LFMM row)
    ('North Shore Broncos',                            'Montréal — Lac-Saint-Louis'),
    ('Nos Jeunes à Cœur / Loups du Nord',              'Laurentides'),
    ('Ottawa Junior Riders Football',                  'Outaouais'),
    ('South Shore Jr Packers',                         'Rive-Sud'),
    -- LFQ9 senior 9-player (6 clubs)
    ('Hornets de la Rive-Sud',                         'Rive-Sud'),
    ('Rebelles de Québec',                             'Capitale-Nationale'),
    ('Nomades de la Beauce',                           'Chaudière-Appalaches'),
    ('Mercenaires du Saguenay',                        'Saguenay-Lac-Saint-Jean'),
    ('Assurancia Groupe Tardif',                       'Mauricie'),
    ('Phénix de la Mauricie',                          'Mauricie'),
    -- LFFMQ women's (5 clubs)
    ('Blitz de Montréal',                              'Montréal'),
    ('Jaguars de la Rive-Sud',                         'Rive-Sud'),
    ('Cobras de Laval',                                'Laval'),
    ('Valkyries de Gatineau',                          'Outaouais'),
    ('Renegade de North Shore',                        'Montréal — Lac-Saint-Louis')
)
INSERT INTO public.schools (name, type, city, region)
SELECT n.name, 'LIGUE_CIVILE', NULL, n.region
FROM new_clubs n
WHERE NOT EXISTS (
  SELECT 1 FROM public.schools s
  WHERE lower(s.name) = lower(n.name)
    AND s.type = 'LIGUE_CIVILE'
);

-- ── Sanity selects ──────────────────────────────────────────────
-- (a) Count of football-bucket clubs (best-effort name pattern
-- since clubs are sport-agnostic — covers all 40 names with one
-- query). Expect 40 after first apply, still 40 after re-run.
SELECT count(*) AS football_civil_clubs
FROM public.schools
WHERE type = 'LIGUE_CIVILE'
  AND name IN (
    'Aces Pointe Saint-Charles',
    'Football civil de Saint-Jean-sur-Richelieu (AFSCJ)',
    'Diablos de LaPrairie',
    'Barons de Saint-Bruno',
    'Vandoos de Drummondville',
    'Rhinos de Lanaudière',
    'Packers de Greenfield',
    'Grizzlis de Boucherville',
    'Wildcats Laurentides-Lanaudière',
    'Pirates du Richelieu',
    'Vicas de Victoriaville',
    'Vikings de Laval-Nord',
    'Patriotes de l''Ouest',
    'Stallions de Saint-Lazare',
    'Warriors de LaSalle',
    'Blues de Chomedey',
    'Dragons de Laval',
    'Bulldogs de Laval',
    'Cougars de Lakeshore',
    'Cougars de Saint-Léonard',
    'Vikings de Gatineau',
    'Hornets de Sun Youth',
    'North Shore',
    'Raiders de Chateauguay',
    'Spartans de Saint-Laurent',
    'North Shore Broncos',
    'Nos Jeunes à Cœur / Loups du Nord',
    'Ottawa Junior Riders Football',
    'South Shore Jr Packers',
    'Hornets de la Rive-Sud',
    'Rebelles de Québec',
    'Nomades de la Beauce',
    'Mercenaires du Saguenay',
    'Assurancia Groupe Tardif',
    'Phénix de la Mauricie',
    'Blitz de Montréal',
    'Jaguars de la Rive-Sud',
    'Cobras de Laval',
    'Valkyries de Gatineau',
    'Renegade de North Shore'
  );

-- (b) Accent integrity on one accented row + one apostrophe row.
-- Phénix de la Mauricie : é = 2 bytes UTF-8 → bytes > chars.
-- Patriotes de l'Ouest : ASCII only → bytes == chars (the
-- apostrophe is a single byte; the SQL doubling is escape-only,
-- the stored value contains ONE apostrophe).
SELECT name,
       octet_length(name) AS bytes,
       char_length(name)  AS chars
FROM public.schools
WHERE type = 'LIGUE_CIVILE'
  AND name IN ('Phénix de la Mauricie', 'Patriotes de l''Ouest', 'Nos Jeunes à Cœur / Loups du Nord')
ORDER BY name;

COMMIT;
