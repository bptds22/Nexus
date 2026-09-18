-- 20260918200033_rseq_cron_secteurs
--
-- APPLIQUÉE en PROD le 2026-09-18 via MCP apply_migration, sur GO de BP.
-- Nom de fichier aligné sur la version RÉELLE assignée par MCP (rédigée sous
-- 20260918172143). Posée APRÈS le déploiement v7 et la recette 4a-4d ; 3 travaux vérifiés, secret lu du Vault dans les trois.
-- ============================================================================
-- VEILLE RSEQ SECONDAIRE — LOT 3 : le cron.
--
-- ⚠️ PROD SEULEMENT, et EN DERNIER dans la fenêtre de mise en prod, APRÈS le
--    redéploiement de `rseq-weekly-sync` (docs/rseq-veille-secondaire-mise-en-prod.md).
--    Les commandes contiennent l'URL de PRODUCTION : appliquée en local, cette
--    migration ferait appeler la fonction de prod par la base locale (sans
--    effet — le secret du Vault local diffère, 403 — mais à ne pas faire).
--    En local, elle se teste dans une transaction ANNULÉE.
--
-- TROIS TRAVAUX, TROIS INVOCATIONS SÉPARÉES (ensemble, ils dépasseraient le
-- plafond de 400 s de l'edge function) :
--
--   rseq-veille-hebdo           55 7 * * 3   ?secteur=Collégial      (MODIFIÉ)
--   rseq-decouverte-secondaire  55 7 * * 2   ?mode=decouverte&secteur=Secondaire
--   rseq-veille-secondaire      10 8 * * 3   ?secteur=Secondaire
--
-- `rseq-veille-hebdo` garde son nom et son horaire : seule son URL change.
-- `?secteur=` n'a PAS de valeur par défaut (décision BP 2026-09-18) : sans
-- cette modification, la fonction redéployée refuserait la passe collégiale
-- du mercredi (400).
--
-- Horaires (UTC — pg_cron suit le fuseau du serveur, UTC sur Supabase) :
--   · découverte le MARDI 07:55 (~2 min 40 s) : le catalogue est à jour la
--     veille de la passe secondaire, et les appels sont étalés sur deux jours ;
--   · passe collégiale le MERCREDI 07:55 (~35 s, finit vers 07:56) ;
--   · passe secondaire le MERCREDI 08:10 (~2 min 20 s), après la collégiale.
-- Soit mardi/mercredi 03:55 et 04:10 à Montréal en heure avancée, une heure
-- plus tôt en hiver.
--
-- `Collégial` est encodé `Coll%C3%A9gial` dans l'URL (UTF-8, percent-encoding) :
-- la fonction le relit via URLSearchParams, prouvé en recette locale.
--
-- L'EN-TÊTE EST LU DU VAULT, comme le job d'origine (20260902210200) : le
-- secret n'apparaît ni ici, ni dans cron.job.command, ni dans les journaux.
--
-- IDEMPOTENTE : `cron.schedule` sur un nom existant remplace le travail.
-- ============================================================================

select cron.schedule(
  'rseq-veille-hebdo',
  '55 7 * * 3',
  $job$
  select net.http_post(
    url := 'https://nrloizyemulbhujrqhgx.supabase.co/functions/v1/rseq-weekly-sync?secteur=Coll%C3%A9gial',
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

select cron.schedule(
  'rseq-decouverte-secondaire',
  '55 7 * * 2',
  $job$
  select net.http_post(
    url := 'https://nrloizyemulbhujrqhgx.supabase.co/functions/v1/rseq-weekly-sync?mode=decouverte&secteur=Secondaire',
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

select cron.schedule(
  'rseq-veille-secondaire',
  '10 8 * * 3',
  $job$
  select net.http_post(
    url := 'https://nrloizyemulbhujrqhgx.supabase.co/functions/v1/rseq-weekly-sync?secteur=Secondaire',
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

-- ── GATE : la liste COMPLÈTE des travaux RSEQ, jamais par inclusion ─────────
do $$
declare
  vus  text[];
  veut text[] := array[
    'rseq-decouverte-secondaire|55 7 * * 2|t|?mode=decouverte&secteur=Secondaire',
    'rseq-veille-hebdo|55 7 * * 3|t|?secteur=Coll%C3%A9gial',
    'rseq-veille-secondaire|10 8 * * 3|t|?secteur=Secondaire'
  ];
begin
  select array_agg(
           j.jobname || '|' || j.schedule || '|' || case when j.active then 't' else 'f' end || '|' ||
           coalesce(substring(j.command from 'rseq-weekly-sync(\?[^'']*)'''), 'SANS-PARAMETRE')
           order by j.jobname)
    into vus
    from cron.job j
   where j.jobname like 'rseq%' or j.command like '%rseq-weekly-sync%';
  if vus is distinct from veut then
    raise exception 'NEXUS lot3 : travaux RSEQ = %, attendu %', vus, veut;
  end if;

  -- Le secret vient du Vault dans les trois : aucune valeur en clair.
  if exists (select 1 from cron.job
              where jobname like 'rseq%'
                and position('vault.decrypted_secrets' in command) = 0) then
    raise exception 'NEXUS lot3 : un travail RSEQ ne lit pas son secret dans le Vault';
  end if;

  raise notice 'NEXUS lot3 : 3 travaux RSEQ conformes — %', vus;
end $$;
