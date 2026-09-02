-- =============================================================================
-- seed-optimizer-demo-cleanup.sql  —  ROLLBACK de seed-optimizer-demo.sql
-- =============================================================================
-- Retire TOUT ce que le seed a créé et restaure les cibles préexistantes du
-- recruteur, mises de côté dans demo_opt_pipeline_backup / _favorites_backup.
--
-- Rejouable : si le seed n'a jamais tourné, ce script ne fait rien et ne lève
-- aucune erreur (les tables de sauvegarde peuvent être absentes).
--
-- DOCKER LOCAL SEULEMENT — jamais sur nrloizyemulbhujrqhgx.
-- SAFETY : une seule transaction.
-- =============================================================================

\set ON_ERROR_STOP on

BEGIN;

-- ── 1. Retrait des cibles de démo (FK NO ACTION => avant les athlètes) ──────
CREATE TEMP TABLE _demo_athletes ON COMMIT DROP AS
SELECT id FROM athletes WHERE email LIKE '%@demo.nexus';

DELETE FROM recruiter_pipeline      WHERE athlete_id IN (SELECT id FROM _demo_athletes);
DELETE FROM recruiter_favorites     WHERE athlete_id IN (SELECT id FROM _demo_athletes);
DELETE FROM recruiter_notes         WHERE athlete_id IN (SELECT id FROM _demo_athletes);
DELETE FROM recruiter_athlete_views WHERE athlete_id IN (SELECT id FROM _demo_athletes);

-- ── 2. Liste de démo (cascade sur recruiter_list_members) ──────────────────
DELETE FROM recruiter_lists WHERE id = 'dec0de06-0000-4000-8000-000000000001';

-- ── 3. Athlètes de démo — team_athletes, evaluations, logs cascadent ───────
DELETE FROM athletes WHERE email LIKE '%@demo.nexus';

-- ── 4. Matchs et équipes de démo ───────────────────────────────────────────
DELETE FROM games WHERE game_no LIKE 'DEMO-OPT-%';

DELETE FROM teams WHERE id IN (
  'dec0de01-0000-4000-8000-000000000001',
  'dec0de01-0000-4000-8000-000000000002',
  'dec0de01-0000-4000-8000-000000000003'
);

-- ── 5. Restauration des cibles préexistantes ───────────────────────────────
--    Les tables de sauvegarde n'ont pas de FK (LIKE ne les copie pas) : leurs
--    lignes ont survécu à tout ce qui précède. On réinsère puis on droppe.
--    trg_sync_global_status refire à l'INSERT et remet
--    athletes.recruitment_status dans l'état qu'il avait avant le seed.
DO $$
BEGIN
  IF to_regclass('public.demo_opt_pipeline_backup') IS NOT NULL THEN
    INSERT INTO public.recruiter_pipeline
    SELECT * FROM public.demo_opt_pipeline_backup
    ON CONFLICT DO NOTHING;
    DROP TABLE public.demo_opt_pipeline_backup;
    RAISE NOTICE 'Pipeline préexistant restauré.';
  END IF;

  IF to_regclass('public.demo_opt_favorites_backup') IS NOT NULL THEN
    INSERT INTO public.recruiter_favorites
    SELECT * FROM public.demo_opt_favorites_backup
    ON CONFLICT DO NOTHING;
    DROP TABLE public.demo_opt_favorites_backup;
    RAISE NOTICE 'Favoris préexistants restaurés.';
  END IF;
END $$;

-- ── 6. Contrôle : plus aucune trace ────────────────────────────────────────
DO $$
DECLARE n_ath int; n_game int; n_team int; n_pipe int;
BEGIN
  SELECT count(*) INTO n_ath  FROM athletes WHERE email LIKE '%@demo.nexus';
  SELECT count(*) INTO n_game FROM games    WHERE game_no LIKE 'DEMO-OPT-%';
  SELECT count(*) INTO n_team FROM teams    WHERE id::text LIKE 'dec0de01-%';
  IF n_ath + n_game + n_team > 0 THEN
    RAISE EXCEPTION 'Résidus : % athlètes, % matchs, % équipes.', n_ath, n_game, n_team;
  END IF;

  SELECT count(*) INTO n_pipe FROM recruiter_pipeline p
    JOIN users u ON u.id = p.recruiter_id AND u.email = 'recruteur@local.test';
  RAISE NOTICE 'Nettoyage OK — recruteur@local.test a % ligne(s) de pipeline restaurée(s).', n_pipe;
END $$;

COMMIT;
