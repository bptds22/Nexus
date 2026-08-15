-- ============================================================================
-- games — ouvrir l'identité d'un match au civil
--
-- POURQUOI. `rseq_game_id uuid NOT NULL UNIQUE` fait de l'UUID RSEQ la SEULE
-- identité possible d'un match, et la seule contrainte d'unicité de la table.
-- Les ligues civiles (LFMM, QBFL, QMFL, QMJFL) n'émettent aucun UUID : LFMM
-- publie même un `gameID` DIFFÉRENT par équipe pour un seul match (1405392 /
-- 1405393 pour Stallions–Wildcats Ouest du 22 août), donc rien d'exploitable
-- côté source. Générer un uuid aléatoire ferait mentir la colonne ET
-- supprimerait toute idempotence — un ré-import recréerait les 446 matchs en
-- double, puisque l'unicité ne porte que sur cette colonne.
--
-- CE QUI NE BOUGE PAS. `games_rseq_game_id_key` reste en place et continue de
-- garantir l'unicité des UUID RSEQ : un UNIQUE Postgres traite les NULL comme
-- distincts, donc rendre la colonne nullable n'ouvre AUCUNE brèche côté RSEQ.
-- Les 48 293 lignes existantes ne sont pas réécrites : DROP NOT NULL est une
-- opération de catalogue, et la contrainte CHECK est ajoutée NOT VALID puis
-- validée par un simple parcours.
--
-- CONTRÔLE JOUÉ AVANT APPLICATION (doit rendre 0 ligne) :
--   select league_name, season, category, division, game_date,
--          least(home_name_raw, visitor_name_raw),
--          greatest(home_name_raw, visitor_name_raw), count(*)
--   from public.games where rseq_game_id is null
--   group by 1,2,3,4,5,6,7 having count(*) > 1;
--   -> [] le 2026-08-14 (aucun match civil en base à cette date).
-- ============================================================================

BEGIN;

-- 1. l'UUID RSEQ devient optionnel (catalogue seul, aucune réécriture de table)
ALTER TABLE public.games
  ALTER COLUMN rseq_game_id DROP NOT NULL;

-- 2. tout match doit porter UNE identité : soit l'UUID RSEQ, soit la clé
--    naturelle civile complète.
ALTER TABLE public.games
  ADD CONSTRAINT games_identite_presente CHECK (
    rseq_game_id IS NOT NULL
    OR (
      league_name      IS NOT NULL AND
      season           IS NOT NULL AND
      game_date        IS NOT NULL AND
      home_name_raw    IS NOT NULL AND
      visitor_name_raw IS NOT NULL
    )
  ) NOT VALID;

ALTER TABLE public.games
  VALIDATE CONSTRAINT games_identite_presente;

-- 3. la clé naturelle civile. Index UNIQUE PARTIEL sur `rseq_game_id IS NULL` :
--    il ne couvre que les lignes civiles, reste vide à la création, et
--    n'impose rien aux 48 293 lignes RSEQ.
--
--    `league_name` et `season` sont dans la clé, et ce n'est pas décoratif :
--    les Cougars de Saint-Léonard alignent une équipe en QBFL ET une en QMFL
--    la même saison, et LFMM fait tourner Fall et Spring dans la même année
--    civile (le lot flag est en Spring 2026, le tackle en Fall 2026).
--
--    La paire est triée par LEAST/GREATEST parce que le mode d'échec
--    réellement observé est le doublon d'ORIENTATION : LFMM publie chaque
--    match deux fois, une par équipe, ce qui donnait 716 lignes au lieu de
--    358. Une clé (home, visitor) laisserait passer la ligne miroir.
--
--    `game_time` est VOLONTAIREMENT hors clé : un match déplacé de 19h à 20h
--    reste le même match, et l'exclure rend le ré-import idempotent.
--    `home_team_id` / `visitor_team_id` sont hors clé aussi : ils sont NULL au
--    moment de l'insertion, donc une clé posée dessus serait inerte.
CREATE UNIQUE INDEX games_identite_civile
  ON public.games (
    league_name,
    season,
    category,
    division,
    game_date,
    LEAST(home_name_raw, visitor_name_raw),
    GREATEST(home_name_raw, visitor_name_raw)
  )
  WHERE rseq_game_id IS NULL;

COMMIT;
