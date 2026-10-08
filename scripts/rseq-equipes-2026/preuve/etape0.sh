#!/bin/bash
# Étape 0 sur nexus_copie : event triggers présents, compteurs avant / après le lot 01.
set -u
P="psql -U supabase_admin -d nexus_copie -X -q"
echo "== event triggers de nexus_copie"
$P -tA -F ' | ' -c "select evtname, evtevent, evtfoid::regproc from pg_event_trigger order by 1"
echo "== retrait du lot 01 (la copie le portait déjà)"
$P -f /tmp/rseq/lots/01-football.rollback.sql 2>&1 | grep -E 'NOTICE|ERROR'
echo "== compteurs AVANT le lot 01"
$P -tA -F ' = ' -f /tmp/rseq/preuve/etape0-compteurs.sql | tee /tmp/rseq/e0-avant.txt
echo "== lot 01"
$P -f /tmp/rseq/lots/01-football.sql 2>&1 | grep -E 'NOTICE|ERROR'
echo "== compteurs APRÈS le lot 01"
$P -tA -F ' = ' -f /tmp/rseq/preuve/etape0-compteurs.sql | tee /tmp/rseq/e0-apres.txt
echo "== écarts"
diff /tmp/rseq/e0-avant.txt /tmp/rseq/e0-apres.txt && echo "aucun écart"
