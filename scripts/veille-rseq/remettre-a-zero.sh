#!/bin/bash
# Retire les migrations du lot présentes sur une base (D → A ; E aussi si présente), pour réappliquer la version courante.
set -u
DB=$1
P="psql -U postgres -d $DB -X -v ON_ERROR_STOP=1 -q"
if [ "$(psql -U postgres -d $DB -X -tAc "select md5(pg_get_functiondef('public.rseq_sync_apply_games(uuid,uuid,jsonb)'::regprocedure)) <> '802495b497d4834050b630dacf9f5dee'")" = "t" ]; then
  $P -f /tmp/veille/rollback/20261008210400_rollback_rseq_apply_games_rseq_ids.sql && echo "$DB : rollback E"
fi
for f in 20261008210300_rollback_rseq_equipes_proposees 20261008210200_rollback_rseq_ligues_a_appeler_tranches 20261008210100_rollback_rseq_sync_runs_tous_tranche 20261008210000_rollback_rseq_codes_sport; do
  $P -f /tmp/veille/rollback/$f.sql && echo "$DB : $f"
done
