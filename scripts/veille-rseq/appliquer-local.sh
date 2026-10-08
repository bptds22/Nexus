#!/bin/bash
# Applique les 5 migrations (A à E) du correctif de la veille sur une base du conteneur local, avec empreintes.
# Chaque migration en transaction unique (-1), comme apply_migration en prod.
# Usage : bash appliquer-local.sh <base>     (postgres = ta base locale ; nexus_copie = base jetable)
set -u
DB=$1
P="psql -U postgres -d $DB -X -v ON_ERROR_STOP=1"
M=/tmp/veille/migrations
echo "== $DB : empreintes AVANT"; $P -tA -F ' = ' -f /tmp/veille/empreintes-schema.sql | tee /tmp/veille/$DB-avant.txt
for f in 20261008210000_rseq_codes_sport 20261008210100_rseq_sync_runs_tous_tranche 20261008210200_rseq_ligues_a_appeler_tranches 20261008210300_rseq_equipes_proposees 20261008210400_rseq_apply_games_rseq_ids; do
  if $P -1 -q -f $M/$f.sql > /tmp/veille/$DB-$f.log 2>&1; then echo "OK   $f"; else echo "ÉCHEC $f"; cat /tmp/veille/$DB-$f.log; exit 1; fi
done
echo "== $DB : empreintes APRÈS"; $P -tA -F ' = ' -f /tmp/veille/empreintes-schema.sql | tee /tmp/veille/$DB-apres.txt
echo "== écarts (seule la ligne des contraintes de rseq_sync_runs doit changer) :"; diff /tmp/veille/$DB-avant.txt /tmp/veille/$DB-apres.txt
echo "== ACL (liste complète) et options"
$P -tA -F ' | ' -c "
select 'rseq_codes_sport', (select array_agg(distinct coalesce(nullif(split_part(x,'=',1),''),'PUBLIC') order by coalesce(nullif(split_part(x,'=',1),''),'PUBLIC')) from unnest((select relacl from pg_class where oid='public.rseq_codes_sport'::regclass)::text[]) x)::text, (select count(*) from public.rseq_codes_sport)::text || ' codes'
union all select 'rseq_ligues_a_appeler', (select array_agg(distinct coalesce(nullif(split_part(x,'=',1),''),'PUBLIC') order by coalesce(nullif(split_part(x,'=',1),''),'PUBLIC')) from unnest((select relacl from pg_class where oid='public.rseq_ligues_a_appeler'::regclass)::text[]) x)::text, (select reloptions::text from pg_class where oid='public.rseq_ligues_a_appeler'::regclass)
union all select p.proname, (select array_agg(distinct coalesce(nullif(split_part(x,'=',1),''),'PUBLIC') order by coalesce(nullif(split_part(x,'=',1),''),'PUBLIC')) from unnest(p.proacl::text[]) x)::text, case when p.prosecdef then 'DEFINER' else 'INVOKER' end
  from pg_proc p where p.proname in ('rseq_proposition_equipe','rseq_sync_detect_teams','rseq_creer_equipes_proposees','rseq_sync_apply_games')
order by 1"
