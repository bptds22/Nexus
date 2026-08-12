-- ═══════════════════════════════════════════════════════════════════════
-- Messagerie P4 — COACH_COACH (1/2) : valeur d'enum SEULE
--
-- ⚠️ ISOLÉE dans sa propre migration À DESSEIN. `ALTER TYPE … ADD VALUE`
-- ne peut PAS être suivi d'un usage de la nouvelle valeur dans la MÊME
-- transaction (Postgres refuse « unsafe use of new value »). En la
-- committant seule, la migration 2/2 (colonnes + CHECK + policies qui
-- référencent le littéral 'COACH_COACH') s'exécute dans une transaction
-- ultérieure où la valeur est déjà visible. C'est la leçon enum/txn de P3.
--
-- SÛRETÉ : purement additif. Aucune ligne existante affectée ; aucun code
-- ne référence encore la valeur tant que 2/2 n'est pas appliquée.
-- ═══════════════════════════════════════════════════════════════════════

ALTER TYPE public.conversation_type ADD VALUE IF NOT EXISTS 'COACH_COACH';
