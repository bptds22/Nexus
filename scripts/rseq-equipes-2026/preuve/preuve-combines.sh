#!/bin/bash
# Preuve locale des fichiers combinés (lot tel quel + contrôle de signature) sur nexus_copie.
set -u
P="psql -U supabase_admin -d nexus_copie -X -q"
for l in 02-flag-football 03-soccer 04-volleyball 05-basketball 06-futsal 07-baseball 08-rugby 09-ultimate-frisbee; do
  $P -f /tmp/rseq/lots/$l.rollback.sql 2>&1 | grep -E 'ERROR'
  e0=$($P -tAc "select count(*) from public.teams"); c0=$($P -tAc "select count(*) from public.games where home_team_id is null")
  r=$($P -f /tmp/rseq/run-faux/$l.run.sql 2>&1 | grep -oE 'ERROR:  NEXUS: signature[^—]*' | head -1)
  e1=$($P -tAc "select count(*) from public.teams"); c1=$($P -tAc "select count(*) from public.games where home_team_id is null")
  ok=$($P -f /tmp/rseq/run/$l.run.sql 2>&1 | grep -E 'NOTICE|ERROR' | sed 's/.*NOTICE:  //')
  e2=$($P -tAc "select count(*) from public.teams")
  echo "$l | faussé : ${r:-AUCUNE ERREUR (!)} | équipes $e0 → $e1, côtés dom NULL $c0 → $c1 (doit être inchangé) | vrai : $ok | équipes $e2"
done
