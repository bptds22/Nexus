-- ════════════════════════════════════════════════════════════════
-- coach_reviews : RETOUR au modèle A — UNIQUE (recruiter, coach)
-- ════════════════════════════════════════════════════════════════
--
-- Décision produit BP (iter 7.8e — REVIREMENT) : on annule la migration
-- 20260603140000 (modèle B = UNIQUE par recruteur×coach×athlete) et on
-- revient au modèle A = UNE review par (recruteur, coach), peu importe
-- l'athlète. athlete_id reste une colonne de contexte (la dernière review
-- faite à propos de tel athlète) mais n'entre PLUS dans la clé d'unicité.
--
-- ÉTAT À L'ÉCRITURE DE CETTE MIGRATION (audit local 2026-06-03) :
--   - DB locale : contrainte courante = coach_reviews_recruiter_id_coach_id_key
--     UNIQUE (recruiter_id, coach_id). Migration B JAMAIS appliquée
--     (aucune entrée 2026-06 dans supabase_migrations.schema_migrations).
--   - coach_reviews : 0 rows, donc 0 doublons à résoudre.
--   - Autres envs (prod / staging) : état inconnu côté Claude. Cette
--     migration est défensive et idempotente : elle marche aussi bien sur
--     un env où B est appliquée que sur un env qui n'a jamais vu B.
--
-- STRATÉGIE :
--   1. Audit READ-ONLY (RAISE NOTICE) — visible dans la sortie psql au push.
--   2. FAIL-LOUD si doublons (recruteur, coach) — BP décide à la main quoi
--      garder (review la plus récente ? merger commentaires ?) avant de
--      re-rouler. ON NE SUPPRIME JAMAIS EN AVEUGLE.
--   3. DROP IF EXISTS la contrainte B (annulation idempotente).
--   4. DROP IF EXISTS puis ADD CONSTRAINT la contrainte A (re-pose
--      idempotente — sur DB locale c'est un no-op sémantique, sur un env
--      où B était appliquée ça restaure A).
--   5. Sanity check final fail-loud.
-- ════════════════════════════════════════════════════════════════

BEGIN;

-- ── Étape 1 : Audit data (READ-ONLY, fail-loud sur doublons).

DO $$
DECLARE
  v_total           INTEGER;
  v_null_athlete    INTEGER;
  v_dup_pairs       INTEGER;
  v_dup_total_rows  INTEGER;
BEGIN
  SELECT count(*) INTO v_total FROM public.coach_reviews;
  RAISE NOTICE '[audit-7.8e] Total coach_reviews rows: %', v_total;

  SELECT count(*) INTO v_null_athlete
  FROM public.coach_reviews
  WHERE athlete_id IS NULL;
  RAISE NOTICE '[audit-7.8e] Rows avec athlete_id NULL (contexte vide): %', v_null_athlete;

  -- Compte de couples (recruteur, coach) ayant plus d'une review
  -- (= bloquerait UNIQUE(recruiter_id, coach_id) en ADD).
  SELECT count(*) INTO v_dup_pairs
  FROM (
    SELECT recruiter_id, coach_id
    FROM public.coach_reviews
    GROUP BY recruiter_id, coach_id
    HAVING count(*) > 1
  ) AS d;

  SELECT COALESCE(sum(c), 0) INTO v_dup_total_rows
  FROM (
    SELECT count(*) AS c
    FROM public.coach_reviews
    GROUP BY recruiter_id, coach_id
    HAVING count(*) > 1
  ) AS d;

  RAISE NOTICE '[audit-7.8e] Couples (recruteur, coach) en doublon: % couples / % rows impactées',
    v_dup_pairs, v_dup_total_rows;

  IF v_dup_pairs > 0 THEN
    RAISE EXCEPTION
      'Migration 7.8e abortée : % couple(s) (recruteur, coach) ont plusieurs reviews (modèle B → A impossible sans résolution). Lister puis garder la review max(updated_at) OU merger manuellement, ensuite re-rouler. AUCUNE suppression automatique faite.',
      v_dup_pairs;
  END IF;

  RAISE NOTICE '[audit-7.8e] OK — 0 doublon (recruteur, coach), migration peut continuer.';
END $$;

-- ── Étape 2 : DROP la contrainte B (modèle 7.8c) si elle est en place.
--    IF EXISTS rend cette étape inoffensive sur DB qui n'a jamais vu B.

ALTER TABLE public.coach_reviews
  DROP CONSTRAINT IF EXISTS coach_reviews_recruiter_coach_athlete_key;

-- ── Étape 3 : Re-pose idempotente de la contrainte A (modèle baseline).
--    DROP puis ADD pour garantir l'idempotence (Postgres ne supporte pas
--    ADD CONSTRAINT IF NOT EXISTS).

ALTER TABLE public.coach_reviews
  DROP CONSTRAINT IF EXISTS coach_reviews_recruiter_id_coach_id_key;

ALTER TABLE public.coach_reviews
  ADD CONSTRAINT coach_reviews_recruiter_id_coach_id_key
  UNIQUE (recruiter_id, coach_id);

-- ── Étape 4 : Sanity check final.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'coach_reviews_recruiter_id_coach_id_key'
      AND conrelid = 'public.coach_reviews'::regclass
  ) THEN
    RAISE EXCEPTION 'Sanity check KO : contrainte coach_reviews_recruiter_id_coach_id_key (modèle A) absente après ADD.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'coach_reviews_recruiter_coach_athlete_key'
      AND conrelid = 'public.coach_reviews'::regclass
  ) THEN
    RAISE EXCEPTION 'Sanity check KO : ancienne contrainte coach_reviews_recruiter_coach_athlete_key (modèle B) encore présente après DROP.';
  END IF;

  RAISE NOTICE '[sanity-7.8e] OK — retour modèle A confirmé : UNIQUE (recruiter_id, coach_id) en place, contrainte B absente.';
END $$;

COMMIT;
