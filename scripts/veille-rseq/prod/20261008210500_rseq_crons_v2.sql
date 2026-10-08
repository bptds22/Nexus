-- RANGÉE HORS de supabase/migrations EXPRÈS : un « supabase db reset » local la rejouerait et programmerait des crons
-- appelant la PROD. À appliquer en prod par apply_migration à l étape 4 du plan, sous sa version prod.
-- Veille RSEQ v2 — crons (étape 4 du plan de mise en prod). NE PAS appliquer en local : les commandes visent
-- l'URL de la PROD (comme les crons existants) ; une base locale appellerait la prod avec son propre secret (403).
-- Preuve locale : appliquée dans une transaction ANNULÉE (scripts/veille-rseq/preuve-crons.sh).
--
-- pg_cron tourne en UTC. Montréal : UTC−4 jusqu'au 2026-11-01 (HAE), UTC−5 ensuite (HNE) — l'heure locale
-- recule d'une heure au changement d'heure, l'heure UTC ne bouge pas.
--   découverte  tranche 1 (régions 0–4)   dim 07:55 UTC  (03:55 HAE / 02:55 HNE)   ~251 s
--   découverte  tranche 2 (régions 5–9)   lun 07:55 UTC                            ~251 s
--   découverte  tranche 3 (régions 10–14) mar 07:55 UTC                            ~251 s
--   passe collégiale (rseq-veille-hebdo, INCHANGÉE)  mer 07:55 UTC                  ~78 s
--   passe secondaire quart 1             mer 08:10 UTC  (04:10 HAE / 03:10 HNE)   ~240 s
--   passe secondaire quart 2             jeu 08:10 UTC
--   passe secondaire quart 3             ven 08:10 UTC
--   passe secondaire quart 4             sam 08:10 UTC
-- Aucun chevauchement : un jour porte une découverte OU des passes ; le mercredi, la passe collégiale finit
-- vers 07:57 UTC, la passe secondaire part à 08:10.
-- Retirés (la fonction v2 les refuserait en 400) :
--   rseq-decouverte-secondaire  mar 07:55 UTC  ?mode=decouverte&secteur=Secondaire&provincial=1
--   rseq-veille-secondaire      mer 08:10 UTC  ?secteur=Secondaire

do $crons$
declare
  base constant text := 'https://nrloizyemulbhujrqhgx.supabase.co/functions/v1/rseq-weekly-sync';
  modele constant text := $m$
  select net.http_post(
    url := '%s',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-rseq-secret', (select decrypted_secret from vault.decrypted_secrets
                         where name = 'RSEQ_SYNC_SECRET')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 5000
  );
  $m$;
begin
  perform cron.unschedule(jobname) from cron.job
   where jobname in ('rseq-decouverte-secondaire', 'rseq-veille-secondaire');

  perform cron.schedule('rseq-decouverte-t1', '55 7 * * 0', format(modele, base || '?mode=decouverte&secteur=Tous&tranche=1'));
  perform cron.schedule('rseq-decouverte-t2', '55 7 * * 1', format(modele, base || '?mode=decouverte&secteur=Tous&tranche=2'));
  perform cron.schedule('rseq-decouverte-t3', '55 7 * * 2', format(modele, base || '?mode=decouverte&secteur=Tous&tranche=3'));
  perform cron.schedule('rseq-passe-secondaire-q1', '10 8 * * 3', format(modele, base || '?secteur=Secondaire&tranche=1'));
  perform cron.schedule('rseq-passe-secondaire-q2', '10 8 * * 4', format(modele, base || '?secteur=Secondaire&tranche=2'));
  perform cron.schedule('rseq-passe-secondaire-q3', '10 8 * * 5', format(modele, base || '?secteur=Secondaire&tranche=3'));
  perform cron.schedule('rseq-passe-secondaire-q4', '10 8 * * 6', format(modele, base || '?secteur=Secondaire&tranche=4'));
end $crons$;

-- Gate : la liste COMPLÈTE triée des crons RSEQ, avec leur horaire.
do $gate$
declare vus text[];
begin
  select array_agg(jobname || ' ' || schedule || ' ' || active order by jobname) into vus
    from cron.job where jobname like 'rseq%';
  if vus is distinct from array[
    'rseq-decouverte-t1 55 7 * * 0 true', 'rseq-decouverte-t2 55 7 * * 1 true', 'rseq-decouverte-t3 55 7 * * 2 true',
    'rseq-passe-secondaire-q1 10 8 * * 3 true', 'rseq-passe-secondaire-q2 10 8 * * 4 true',
    'rseq-passe-secondaire-q3 10 8 * * 5 true', 'rseq-passe-secondaire-q4 10 8 * * 6 true',
    'rseq-veille-hebdo 55 7 * * 3 true'] then
    raise exception 'NEXUS: crons RSEQ = %', vus;
  end if;
end $gate$;
