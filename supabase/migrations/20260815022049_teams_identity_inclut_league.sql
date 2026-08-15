-- ============================================================================
-- teams_identity_unique — ajouter `league` à la clé d'identité d'une équipe
--
-- POURQUOI. La clé était :
--     UNIQUE (school_id, sport_id, name, age_group, division, gender, season)
-- Elle ignorait la ligue. Tant que tout venait du RSEQ scolaire, ça tenait :
-- une école n'aligne qu'une équipe par sport/catégorie/division/genre/saison.
--
-- Les ligues civiles cassent cette hypothèse. Un même club aligne la même
-- catégorie dans DEUX ligues distinctes — les Wildcats Laurentides-Lanaudière
-- jouent en LFMM ET en QMJFL, les Cougars de Lakeshore en LFMM, QBFL et QMFL.
-- Ce sont des équipes différentes, avec des calendriers différents. Sans
-- `league` dans la clé, elles sont indistinguables pour la contrainte : un
-- ré-import les fusionne ou les rejette selon l'ordre d'arrivée.
--
-- CONTRÔLE JOUÉ AVANT APPLICATION (doit rendre 0 ligne) :
--   select school_id, sport_id, name, age_group, division, gender, season,
--          league, count(*)
--   from public.teams group by 1,2,3,4,5,6,7,8 having count(*) > 1;
--   -> [] le 2026-08-14. Note : GROUP BY regroupe les NULL, là où UNIQUE les
--      traite comme distincts — le contrôle est donc PLUS strict que la
--      contrainte qu'il valide.
--
-- PIÈGE CONNU, non traité ici. `gender` est nullable et Postgres considère
-- deux NULL comme distincts dans un UNIQUE (pas de NULLS NOT DISTINCT).
-- Une équipe insérée sans `gender` échappe donc à toute la contrainte.
-- Les imports de ligues civiles doivent poser `gender` explicitement —
-- « Masculin » pour le tackle, « Mixte » pour le flag.
--
-- Additif et réversible : aucune donnée touchée, aucun élargissement de
-- permission. Le DROP puis ADD est instantané à cette volumétrie (~7.9k lignes).
-- ============================================================================

BEGIN;

ALTER TABLE public.teams
  DROP CONSTRAINT teams_identity_unique;

ALTER TABLE public.teams
  ADD CONSTRAINT teams_identity_unique
  UNIQUE (school_id, sport_id, name, age_group, division, gender, season, league);

COMMIT;
