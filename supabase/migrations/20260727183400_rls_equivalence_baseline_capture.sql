-- ═══════════════════════════════════════════════════════════════
-- MIROIR DE RATTRAPAGE — version 20260727183400
-- PIERRE TOMBALE VOLONTAIREMENT NO-OP
--
-- Cette migration a été APPLIQUÉE EN PROD le 2026-07-27 via execute_sql, sans
-- fichier dans le dépôt. Elle est enregistrée dans schema_migrations sous
-- `20260727183400 | rls_equivalence_baseline_capture`.
--
-- OBJET PERSISTANT LAISSÉ EN PROD : NON.
-- Preuve (catalogue prod, lecture du 2026-07-30) :
--   to_regclass('public._rls_equiv_20260727')                        -> NULL
--   pg_proc WHERE proname IN ('_snap','_rls_equiv_snap')             -> aucune ligne
-- Ce que le ledger (docs/flip-day-ledger.md, section « APPLIQUÉ À PROD ») décrit
-- comme l'empreinte de cette migration — la table public._rls_equiv_20260727
-- (matrice avant/après), la sonde public._snap(text,text,uuid) et la première
-- version buggée public._rls_equiv_snap(text) — a été intégralement supprimé
-- depuis. C'était un échafaudage de mesure, pas un objet de schéma.
--
-- POURQUOI UN FICHIER VIDE PLUTÔT QUE PAS DE FICHIER :
-- la version est inscrite au catalogue prod. Sans fichier portant ce préfixe,
-- toute reconstruction depuis le dépôt (db reset, base neuve, environnement de
-- test) produit un historique de migrations qui diverge de prod. Ce fichier
-- ferme le trou sans rien recréer — recréer la table de mesure serait une
-- fabrication : son contenu était un instantané comparatif désormais périmé.
--
-- Aucune instruction exécutable. C'est intentionnel.
-- ═══════════════════════════════════════════════════════════════

DO $$
BEGIN
  RAISE NOTICE 'rls_equivalence_baseline_capture (20260727183400) : no-op de rattrapage — echafaudage de mesure supprime en prod, rien a recreer.';
END $$;
