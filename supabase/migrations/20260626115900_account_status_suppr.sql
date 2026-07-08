-- ════════════════════════════════════════════════════════════════════════
--  account_status — ajoute la valeur terminale 'SUPPRIME'.
--
--  SCINDÉ dans sa propre migration ANTÉRIEURE (et donc commitée séparément)
--  pour deux raisons :
--    1. Sur les runners qui exécutent chaque migration dans une transaction,
--       certains rejettent ALTER TYPE ... ADD VALUE dans un bloc transactionnel.
--    2. Une nouvelle valeur d'enum n'est pas garantie utilisable dans la même
--       transaction que son ADD VALUE. delete_my_account() (migration suivante,
--       20260626120000) référence 'SUPPRIME' → cette valeur doit être commitée
--       et visible AVANT que la fonction soit créée. L'ordre lexicographique
--       des fichiers (…115900 < …120000) garantit cet enchaînement.
--
--  NE PAS exécuter sur la prod. À valider puis tester sur branche preview.
-- ════════════════════════════════════════════════════════════════════════

-- IF NOT EXISTS → idempotent (re-run sans erreur).
ALTER TYPE account_status ADD VALUE IF NOT EXISTS 'SUPPRIME';
