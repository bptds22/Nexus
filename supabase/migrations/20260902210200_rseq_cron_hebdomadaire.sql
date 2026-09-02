-- 20260902210200_rseq_cron_hebdomadaire.sql
-- ============================================================================
-- VEILLE RSEQ — le travail hebdomadaire.
--
-- CHAÎNE COMPLÈTE :  pg_cron → net.http_post → Vault → fonction edge → RPC
--
-- L'EN-TÊTE EST LU DU VAULT, PAS ÉCRIT ICI. La commande du job contient une
-- sous-requête sur `vault.decrypted_secrets` : le secret n'apparaît donc ni
-- dans cette migration, ni dans `cron.job.command`, ni dans les journaux
-- d'exécution. Il n'existe qu'à un seul endroit, et personne ne l'a jamais vu.
--
-- L'HORAIRE EST EN UTC, et pg_cron n'a pas de fuseau par travail — il suit
-- celui du serveur, qui est UTC sur Supabase. `55 7 * * 3` vaut donc
-- mercredi 03:55 à Montréal pendant l'heure avancée, et 02:55 en hiver. Une
-- heure de dérive saisonnière sur un travail de nuit hebdomadaire : on
-- l'assume plutôt que de bricoler un réveil à double horaire.
--
-- LE TIMEOUT DE 5 s N'EST PAS UN RISQUE, c'est le contrat. La fonction répond
-- 202 immédiatement et travaille dans EdgeRuntime.waitUntil (~37 s mesurées) ;
-- pg_net obtient sa réponse en quelques dizaines de millisecondes. C'est
-- exactement le montage retenu après le faux négatif documenté dans
-- docs/push-pgnet-timeout-20260823.md.
--
-- La passe s'inscrira dans `rseq_sync_runs` avec `declencheur = 'cron'` — le
-- mode `?wait=1` est réservé à la recette manuelle.
--
-- IDEMPOTENTE : `cron.schedule` sur un nom existant remplace le travail au
-- lieu d'en créer un second.
-- ============================================================================

select cron.schedule(
  'rseq-veille-hebdo',
  '55 7 * * 3',
  $job$
  select net.http_post(
    url := 'https://nrloizyemulbhujrqhgx.supabase.co/functions/v1/rseq-weekly-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-rseq-secret', (select decrypted_secret from vault.decrypted_secrets
                         where name = 'RSEQ_SYNC_SECRET')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 5000
  );
  $job$
);
