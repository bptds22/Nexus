#!/bin/sh
# Preuve LOCALE de la méthode « lot en un seul message » (celle du connecteur Supabase), processus.
#   cd C:\tmp\nexus-processus ; sh docs/processus-rpc/prod/preuve-locale.sh
# En local, le MÊME texte est envoyé de la même façon : UN message à plusieurs instructions (psql -c),
# donc une seule transaction implicite. Départ : base locale à l'état prod (etat-avant.sql = relevé prod).
# L'étape 3 APPLIQUE le lot à la base Docker locale (elle reste migrée, comme la prod le sera).
export MSYS_NO_PATHCONV=1
db=supabase_db_Nexus
out=docs/processus-rpc/prod/preuve-locale.txt
ETAT_PROD=7cf4b4282075e604ca6b7d74b2c12d24
EMPREINTE=e1146ae5cf5be08cb8f6c77d7bc3052a
note() { echo "$1" | tee -a "$out"; }
etat() {
  docker cp docs/processus-rpc/prod/etat-avant.sql $db:/tmp/etat.sql >/dev/null
  r=$(docker exec -e PGCLIENTENCODING=UTF8 $db psql -U postgres -d postgres -At -f /tmp/etat.sql)
  v=$(docker exec $db psql -U postgres -d postgres -At -c "select count(*) from supabase_migrations.schema_migrations where version = '20261016060000'")
  o=$(docker exec $db psql -U postgres -d postgres -At -c "select count(*) from public.admin_operations where operation = 'MIGRATION_PROCESSUS_CARTES_RPC'")
  note "  état $1 : $r  (prod avant = $ETAT_PROD|12) version=$v operations=$o"
}
un_message() {
  docker cp "$1" $db:/tmp/lot.sql >/dev/null
  docker cp docs/push-a4a/prod/un-message.sh $db:/tmp/un-message.sh >/dev/null
  docker exec -e PGCLIENTENCODING=UTF8 $db sh /tmp/un-message.sh 2>&1 | grep -E "ERROR|\{" | tr '\n' ' '
}
echo "PREUVE LOCALE — lot processus (cartes et notes par fonctions) — $(date '+%Y-%m-%dT%H:%M:%S')" > "$out"
note ""
note "== 0. Fichier testé et lots =="
note "  md5 fichier migration : $(md5sum supabase/migrations/20261016060000_processus_cartes_rpc.sql | cut -c1-32)"
note "  md5 lot-prod.sql      : $(md5sum docs/processus-rpc/prod/lot-prod.sql | cut -c1-32)"
etat "de départ"
note ""
note "== 1. Une garde qui échoue À LA FIN annule tout (variante : empreinte attendue fausse) =="
note "  réponse : $(un_message docs/processus-rpc/prod/lot-preuve-garde-fausse.sql)"
etat "après"
note ""
note "== 2. Instructions envoyées SÉPARÉMENT (en morceaux, pas une transaction) : arrêt avant toute écriture =="
docker cp docs/processus-rpc/prod/lot-prod.sql $db:/tmp/lot.sql >/dev/null
r=$(docker exec -e PGCLIENTENCODING=UTF8 $db psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 -q -f /tmp/lot.sql 2>&1 | grep ERROR)
note "  réponse : $r"
etat "après"
note ""
note "== 3. Le lot réel, en UN message =="
note "  réponse : $(un_message docs/processus-rpc/prod/lot-prod.sql)"
etat "après"
docker cp docs/processus-rpc/prod/empreinte-objets.sql $db:/tmp/emp.sql >/dev/null
note "  empreinte des objets en base : $(docker exec -e PGCLIENTENCODING=UTF8 $db psql -U postgres -d postgres -At -f /tmp/emp.sql)  (attendue $EMPREINTE|16)"
note ""
note "== 4. Le même lot une 2e fois : refusé, rien ne change =="
note "  réponse : $(un_message docs/processus-rpc/prod/lot-prod.sql)"
etat "après"
note ""
note "== 5. Banc sur la base issue du lot =="
docker cp docs/processus-rpc/tests-processus-rpc.sql $db:/tmp/t.sql >/dev/null
docker exec -e PGCLIENTENCODING=UTF8 $db psql -U postgres -d postgres -X -q -At -f /tmp/t.sql 2>&1 | grep -v '^$' > docs/processus-rpc/prod/banc-base-migree-resultats.txt
note "  $(grep -E '^[0-9]+\|[0-9]+$' docs/processus-rpc/prod/banc-base-migree-resultats.txt | tail -1)   (ok | échecs)"
