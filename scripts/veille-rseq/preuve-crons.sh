#!/bin/bash
# Preuve des crons v2 sur la base locale, dans une transaction ANNULÉE : rien ne reste programmé.
set -u
P="psql -U postgres -d postgres -X -v ON_ERROR_STOP=1"
echo "== crons RSEQ locaux AVANT"; $P -tA -c "select jobname || ' ' || schedule || ' ' || active from cron.job where jobname like 'rseq%' order by 1"
$P -q <<'SQL'
begin;
\i /tmp/veille/20261008210500_rseq_crons_v2.sql
\echo '== DANS la transaction (gate passé) :'
select jobname, schedule, substring(command from 'rseq-weekly-sync\?([^'']*)') as parametres from cron.job where jobname like 'rseq%' order by schedule, jobname;
rollback;
SQL
echo "== crons RSEQ locaux APRÈS rollback"; $P -tA -c "select jobname || ' ' || schedule || ' ' || active from cron.job where jobname like 'rseq%' order by 1"
