#!/bin/bash
# Cycle rollback E→A puis ré-application, sur la base jetable seulement. Empreintes comparées à l'état AVANT.
# DEBUT / SAUTE3 permettent de reprendre un cycle interrompu (laisser vides pour un cycle complet).
set -u
DB=nexus_copie
P="psql -U postgres -d $DB -X -v ON_ERROR_STOP=1"
for f in ${DEBUT-20261008205208_rollback_rseq_apply_games_rseq_ids 20261008205120_rollback_rseq_equipes_proposees} ${SAUTE3-20261008204958_rollback_rseq_ligues_a_appeler_tranches} 20261008204931_rollback_rseq_sync_runs_tous_tranche 20261008204908_rollback_rseq_codes_sport; do
  if $P -q -f /tmp/veille/rollback/$f.sql > /tmp/veille/rb-$f.log 2>&1; then echo "OK   $f"; else echo "ÉCHEC $f"; cat /tmp/veille/rb-$f.log; exit 1; fi
done
$P -tA -F ' = ' -f /tmp/veille/empreintes-schema.sql > /tmp/veille/$DB-apres-rollback.txt
echo "-- écarts AVANT / APRÈS ROLLBACK (attendu : aucun) :"; diff /tmp/veille/$DB-avant.txt /tmp/veille/$DB-apres-rollback.txt && echo "aucun écart"
$P -tA -c "select 'vue = prod d''avant : ' || (md5(pg_get_viewdef('public.rseq_ligues_a_appeler'::regclass)) = 'f6c8bc2ab2eb491b762a1df1ee95949a')
  union all select 'detect_teams = prod d''avant : ' || (md5(pg_get_functiondef('public.rseq_sync_detect_teams(uuid,uuid,text,text,text,jsonb)'::regprocedure)) = 'cf4b292d46e689daeb31beef3962e181')
  union all select 'apply_games = prod d''avant : ' || (md5(pg_get_functiondef('public.rseq_sync_apply_games(uuid,uuid,jsonb)'::regprocedure)) = '802495b497d4834050b630dacf9f5dee')
  union all select 'rseq_codes_sport absente : ' || (to_regclass('public.rseq_codes_sport') is null)"
echo "== ré-application"
bash /tmp/veille/appliquer-local.sh $DB | grep -E '^(OK|ÉCHEC)'
