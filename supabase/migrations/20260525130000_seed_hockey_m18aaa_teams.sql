-- ────────────────────────────────────────────────────────────────
-- Civil hockey teams — M18 AAA Masculin re-import (Phase 6.2)
-- ────────────────────────────────────────────────────────────────
-- Source : data/import/elite_civil_leagues.json (LHM18AAAQ block).
--
-- Context : the 15 M18 AAA franchises landed in `schools` as
-- LIGUE_CIVILE rows during the original elite_hockey.sql load, but
-- the league/sex/category/level metadata was stripped — `teams`
-- table has ZERO rows under these clubs. This migration re-shapes
-- by inserting the team layer from the source JSON, anchored on
-- the existing schools rows (15/15 exact-name matches, no new
-- club rows needed).
--
-- Scope decision : M18 AAA Masculin only (15 teams). LHEQ Féminin
-- M18 is intentionally DROPPED here — only 2 of 8 franchises were
-- publicly named in the JSON; women's hockey teams come later via
-- coach self-declaration through the create flow (same pattern
-- as soccer / football / basketball, where civil teams aren't
-- centrally published).
--
-- school_id resolution : NAME-JOIN, not hardcoded UUIDs. The
-- CTE-of-VALUES below pairs each team name with the matching
-- LIGUE_CIVILE schools row via s.name = t.name. If a club row is
-- missing or renamed, that team row is silently NOT inserted and
-- the sanity SELECT at the bottom (expects 15) flags it. Avoids
-- any chance of a stale/truncated UUID landing a team under the
-- wrong club.
--
-- Per-team mapping (constant across all 15 — single league):
--   sport_id  = Hockey   (119362e8-7b98-47fb-84da-c9ce10fbda2a)
--   gender    = 'Masculin'
--   age_group = 'M18'                -- stripped from "M18 (16-17 ans)"
--                                    -- to match civil-sport pill
--                                    -- convention (U13/U15/U18/etc.)
--                                    -- and the future shape coach-
--                                    -- created hockey teams will use
--   division  = 'AAA Civil — Élite'  -- VERBATIM from league.level
--   league    = 'M18 AAA'            -- league.short_name
--   season    = '2025-2026'
--
-- Idempotency : ON CONFLICT ON CONSTRAINT teams_identity_unique
-- DO NOTHING. The teams unique index covers
-- (school_id, sport_id, name, age_group, division, gender, season)
-- so re-running this migration is a no-op once the rows exist.
--
-- Byte-safety : apply via `docker cp` + `psql -f` with
-- PGCLIENTENCODING=UTF8 (never the PowerShell pipe — CLAUDE.md).
-- Accents in payload : Élite, Châteauguay, Phénix, Élites, Lévis,
-- Séminaire, em-dash (—) in "AAA Civil — Élite". Verify after with
-- octet_length(division) > char_length(division) on a sample row.
-- ────────────────────────────────────────────────────────────────

BEGIN;

WITH team_names(name) AS (
  VALUES
    ('Forestiers d''Amos'),
    ('Grenadiers de Châteauguay'),
    ('Riverains du Collège Charles-Lemoyne'),
    ('Phénix du Collège Esther-Blondin'),
    ('Albatros du Collège Notre-Dame'),
    ('L''Intrépide de Gatineau'),
    ('Élites de Jonquière'),
    ('Lions du Lac St-Louis'),
    ('Rousseau Royal de Laval-Montréal'),
    ('Chevaliers de Lévis'),
    ('Cantonniers de Magog'),
    ('Vikings de Saint-Eustache'),
    ('Gaulois de Saint-Hyacinthe'),
    ('Blizzard du Séminaire Saint-François'),
    ('Estacades de Trois-Rivières')
)
INSERT INTO public.teams (
  school_id, sport_id, name,
  age_group, division, gender,
  league, season, is_active
)
SELECT
  s.id,
  '119362e8-7b98-47fb-84da-c9ce10fbda2a'::uuid,
  t.name,
  'M18',
  'AAA Civil — Élite',
  'Masculin',
  'M18 AAA',
  '2025-2026',
  true
FROM team_names t
JOIN public.schools s
  ON s.name = t.name
 AND s.type = 'LIGUE_CIVILE'
ON CONFLICT ON CONSTRAINT teams_identity_unique DO NOTHING;

-- ── Sanity selects ──────────────────────────────────────────────
-- (a) Row count must be 15. Anything less = an unresolved club
-- name above (typo / renamed / missing schools row).
SELECT count(*) AS m18_aaa_teams
FROM public.teams t
JOIN public.schools s ON s.id = t.school_id
WHERE s.type = 'LIGUE_CIVILE'
  AND t.league = 'M18 AAA'
  AND t.gender = 'Masculin';

-- (b) Accent integrity. "AAA Civil — Élite" carries an em-dash
-- (3 bytes UTF-8) + é (2 bytes). Expect bytes > chars; bytes ==
-- chars means a UTF-8 corruption (likely '?' replacement chars).
SELECT division,
       octet_length(division) AS bytes,
       char_length(division) AS chars
FROM public.teams
WHERE league = 'M18 AAA'
LIMIT 1;

-- (c) Spot-check three rows. Confirms gender/age/division/league
-- landed correctly and school_id resolved to the right club.
SELECT t.name, s.name AS club, t.age_group, t.division, t.gender, t.league
FROM public.teams t
JOIN public.schools s ON s.id = t.school_id
WHERE t.league = 'M18 AAA'
  AND t.name IN (
    'Forestiers d''Amos',
    'L''Intrépide de Gatineau',
    'Blizzard du Séminaire Saint-François'
  )
ORDER BY t.name;

COMMIT;
