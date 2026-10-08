-- Rollback des crons v2 : retire les 7 nouveaux, remet les 2 anciens À L'IDENTIQUE (commandes relevées en prod le
-- 2026-10-08). À faire AVANT de redéployer la fonction v1 (les anciens paramètres sont refusés par la v2).
begin;
select cron.unschedule(jobname) from cron.job
 where jobname in ('rseq-decouverte-t1', 'rseq-decouverte-t2', 'rseq-decouverte-t3', 'rseq-passe-secondaire-q1',
                   'rseq-passe-secondaire-q2', 'rseq-passe-secondaire-q3', 'rseq-passe-secondaire-q4');
select cron.schedule('rseq-decouverte-secondaire', '55 7 * * 2', $c$
  select net.http_post(
    url := 'https://nrloizyemulbhujrqhgx.supabase.co/functions/v1/rseq-weekly-sync?mode=decouverte&secteur=Secondaire&provincial=1',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-rseq-secret', (select decrypted_secret from vault.decrypted_secrets
                         where name = 'RSEQ_SYNC_SECRET')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 5000
  );
  $c$);
select cron.schedule('rseq-veille-secondaire', '10 8 * * 3', $c$
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
  $c$);
do $gate$
declare vus text[];
begin
  select array_agg(jobname || ' ' || schedule order by jobname) into vus from cron.job where jobname like 'rseq%';
  if vus is distinct from array['rseq-decouverte-secondaire 55 7 * * 2', 'rseq-veille-hebdo 55 7 * * 3', 'rseq-veille-secondaire 10 8 * * 3'] then
    raise exception 'NEXUS: crons RSEQ après rollback = %', vus;
  end if;
end $gate$;
commit;
