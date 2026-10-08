#!/bin/bash
# Migration C corrigée (tranche_passe par hachage, matchs_connus) : rollback C puis C, sur une base donnée.
set -u
DB=$1
P="psql -U postgres -d $DB -X -v ON_ERROR_STOP=1 -q"
$P -f /tmp/veille/rollback/20261008210200_rollback_rseq_ligues_a_appeler_tranches.sql && echo "$DB : rollback C OK (vue = prod d'avant)"
$P -1 -f /tmp/veille/migrations/20261008210200_rseq_ligues_a_appeler_tranches.sql && echo "$DB : migration C OK (gates verts)"
psql -U postgres -d $DB -X -tA -F ' | ' -c "select tranche_passe, sector, count(*), count(*) filter (where matchs_connus) as avec_matchs from public.rseq_ligues_a_appeler group by 1,2 order by 1,2"
psql -U postgres -d $DB -X -tA -c "select reloptions from pg_class where oid='public.rseq_ligues_a_appeler'::regclass"
