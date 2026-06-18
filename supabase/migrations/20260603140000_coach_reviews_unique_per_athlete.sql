-- ════════════════════════════════════════════════════════════════
-- coach_reviews : UNIQUE par (recruiter, coach, athlete)
-- ════════════════════════════════════════════════════════════════
--
-- Décision produit BP (iter 7.8c) : modèle review = par couple
-- (recruteur, coach, ATHLÈTE). Un recruteur peut évaluer un coach
-- différemment selon l'athlète dont il est responsable. La réputation
-- globale du coach reste l'agrégat de toutes ses reviews (aucun
-- changement côté lecture / useCoachReputation).
--
-- AVANT (baseline 20260417120000) :
--   coach_reviews_recruiter_id_coach_id_key UNIQUE (recruiter_id, coach_id)
--   → 1 review max par (recruteur, coach) → empêchait d'évaluer le
--     même coach pour 2 athlètes différents, mais le modal scopait son
--     check existant sur athlete_id → INSERT 2e violait silencieusement
--     la contrainte (erreur Postgres avalée dans le client).
--
-- APRÈS :
--   coach_reviews_recruiter_coach_athlete_key UNIQUE (recruiter_id, coach_id, athlete_id)
--   → 1 review max par (recruteur, coach, athlete) → cohérent avec le
--     check du modal, plus aucun plantage silencieux.
--
-- Cas athlete_id NULL : Postgres traite NULL ≠ NULL dans les
-- contraintes UNIQUE par défaut (multi-row NULL autorisés). On garde
-- ce comportement — historique de reviews sans athlete_id pourra
-- exister (ex: review générale d'un coach sans contexte athlète),
-- chaque NULL est considéré distinct. Si on veut traiter NULL comme
-- unique-par-recruteur×coach plus tard, il faudra ajouter NULLS NOT
-- DISTINCT (Postgres 15+) ou un index partiel séparé.
-- ════════════════════════════════════════════════════════════════

BEGIN;

-- ── Étape 1 : Audit data avant migration (visible dans la sortie psql).
--    Fail loud si on trouve des cas qui violeraient la nouvelle contrainte.

DO $$
DECLARE
  v_dup_count INTEGER;
  v_null_athlete_count INTEGER;
  v_dup_null_count INTEGER;
  v_total INTEGER;
BEGIN
  SELECT count(*) INTO v_total FROM public.coach_reviews;
  RAISE NOTICE '[audit] Total coach_reviews rows: %', v_total;

  -- 1.a — Doublons stricts sur (recruiter_id, coach_id, athlete_id) avec
  --       athlete_id NOT NULL. Ces cas violeraient la nouvelle contrainte.
  SELECT count(*) INTO v_dup_count
  FROM (
    SELECT recruiter_id, coach_id, athlete_id
    FROM public.coach_reviews
    WHERE athlete_id IS NOT NULL
    GROUP BY 1, 2, 3
    HAVING count(*) > 1
  ) AS d;
  RAISE NOTICE '[audit] Groupes (recruteur, coach, athlete) en double (athlete_id NOT NULL): %', v_dup_count;

  IF v_dup_count > 0 THEN
    RAISE EXCEPTION
      'Migration abortée : % groupe(s) (recruteur, coach, athlete) en double détecté(s) — la nouvelle contrainte UNIQUE(recruiter_id, coach_id, athlete_id) ne peut pas être créée. Inspecter ces rows et merger/supprimer avant de re-rouler.',
      v_dup_count;
  END IF;

  -- 1.b — Comptage rows avec athlete_id NULL (informatif, n'empêche pas
  --       la migration vu que NULL ≠ NULL par défaut dans UNIQUE).
  SELECT count(*) INTO v_null_athlete_count
  FROM public.coach_reviews
  WHERE athlete_id IS NULL;
  RAISE NOTICE '[audit] Rows avec athlete_id NULL: %', v_null_athlete_count;

  -- 1.c — Combien de rows (recruteur, coach) ont à la fois 1 row NULL et 1+
  --       row(s) avec athlete_id ? Informatif — pas un blocage.
  SELECT count(*) INTO v_dup_null_count
  FROM (
    SELECT recruiter_id, coach_id
    FROM public.coach_reviews
    GROUP BY 1, 2
    HAVING count(*) FILTER (WHERE athlete_id IS NULL) > 0
       AND count(*) FILTER (WHERE athlete_id IS NOT NULL) > 0
  ) AS d;
  RAISE NOTICE '[audit] Couples (recruteur, coach) avec à la fois NULL et NOT NULL athlete_id: %', v_dup_null_count;

  RAISE NOTICE '[audit] OK — migration peut continuer.';
END $$;

-- ── Étape 2 : Drop old UNIQUE (recruiter, coach).

ALTER TABLE public.coach_reviews
  DROP CONSTRAINT IF EXISTS coach_reviews_recruiter_id_coach_id_key;

-- ── Étape 3 : Add new UNIQUE (recruiter, coach, athlete).
--    NULL ≠ NULL par défaut — rows NULL multi-autorisées.

ALTER TABLE public.coach_reviews
  ADD CONSTRAINT coach_reviews_recruiter_coach_athlete_key
  UNIQUE (recruiter_id, coach_id, athlete_id);

-- ── Étape 4 : Sanity check post-migration.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'coach_reviews_recruiter_coach_athlete_key'
      AND conrelid = 'public.coach_reviews'::regclass
  ) THEN
    RAISE EXCEPTION 'Sanity check KO : contrainte coach_reviews_recruiter_coach_athlete_key absente après création.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'coach_reviews_recruiter_id_coach_id_key'
      AND conrelid = 'public.coach_reviews'::regclass
  ) THEN
    RAISE EXCEPTION 'Sanity check KO : ancienne contrainte coach_reviews_recruiter_id_coach_id_key encore présente après DROP.';
  END IF;
  RAISE NOTICE '[sanity] OK — contrainte (recruteur, coach, athlete) en place, ancienne contrainte retirée.';
END $$;

COMMIT;
