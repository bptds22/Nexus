#!/bin/bash
# Migration E corrigée (NULL ≡ UUID nul) : rollback E puis E, sur une base donnée.
set -u
DB=$1
P="psql -U postgres -d $DB -X -v ON_ERROR_STOP=1 -q"
$P -f /tmp/veille/rollback/20261008205208_rollback_rseq_apply_games_rseq_ids.sql && echo "$DB : rollback E OK (md5 prod d'avant)"
$P -1 -f /tmp/veille/migrations/20261008205208_rseq_apply_games_rseq_ids.sql && echo "$DB : migration E OK (gate ACL vert)"
