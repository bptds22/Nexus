#!/bin/sh
# Preuve LOCALE de la méthode « lot en un seul message » (celle du connecteur Supabase), push A5.
#   cd C:\tmp\nexus-a5 ; sh docs/push-a5/prod/preuve-locale.sh
# En local, le MÊME texte est envoyé de la même façon : UN message à plusieurs instructions (psql -c),
# donc une seule transaction implicite. Départ : base locale à l'état A4a (= prod relevée).
# L'étape 3 APPLIQUE le lot à la base Docker locale (elle reste migrée, comme la prod le sera).
export MSYS_NO_PATHCONV=1
db=supabase_db_Nexus
out=docs/push-a5/prod/preuve-locale.txt
ETAT_PROD=a356cc149bde5a47d7ba7b06af675d0e
note() { echo "$1" | tee -a "$out"; }
etat() {
  docker cp docs/push-a5/prod/etat-avant.sql $db:/tmp/etat.sql >/dev/null
  r=$(docker exec -e PGCLIENTENCODING=UTF8 $db psql -U postgres -d postgres -At -f /tmp/etat.sql)
  v=$(docker exec $db psql -U postgres -d postgres -At -c "select count(*) from supabase_migrations.schema_migrations where version = '20261016020000'")
  o=$(docker exec $db psql -U postgres -d postgres -At -c "select count(*) from public.admin_operations where operation = 'MIGRATION_PUSH_A5'")
  note "  état $1 : $r  (prod avant = $ETAT_PROD|21) version=$v operations_A5=$o"
}
un_message() {
  docker cp "$1" $db:/tmp/lot.sql >/dev/null
  docker cp docs/push-a4a/prod/un-message.sh $db:/tmp/un-message.sh >/dev/null
  docker exec -e PGCLIENTENCODING=UTF8 $db sh /tmp/un-message.sh 2>&1 | grep -E "ERROR|\{" | tr '\n' ' '
}
echo "PREUVE LOCALE — lot push A5 — $(date '+%Y-%m-%dT%H:%M:%S')" > "$out"
note ""
note "== 0. Fichier testé et lots =="
note "  md5 fichier migration : $(md5sum supabase/migrations/20261016020000_push_a5_ouverture.sql | cut -c1-32)"
note "  md5 lot-prod.sql      : $(md5sum docs/push-a5/prod/lot-prod.sql | cut -c1-32)"
etat "de départ"
note ""
note "== 1. Une garde qui échoue À LA FIN annule tout (variante : empreinte attendue fausse) =="
note "  réponse : $(un_message docs/push-a5/prod/lot-preuve-garde-fausse.sql)"
etat "après"
note ""
note "== 2. Instructions envoyées SÉPARÉMENT (en morceaux, pas une transaction) : arrêt avant toute écriture =="
docker cp docs/push-a5/prod/lot-prod.sql $db:/tmp/lot.sql >/dev/null
r=$(docker exec -e PGCLIENTENCODING=UTF8 $db psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 -q -f /tmp/lot.sql 2>&1 | grep ERROR)
note "  réponse : $r"
etat "après"
note ""
note "== 3. Le lot réel, en UN message =="
note "  réponse : $(un_message docs/push-a5/prod/lot-prod.sql)"
etat "après"
docker cp docs/push-a5/prod/empreinte-objets.sql $db:/tmp/emp.sql >/dev/null
note "  empreinte des objets en base : $(docker exec -e PGCLIENTENCODING=UTF8 $db psql -U postgres -d postgres -At -f /tmp/emp.sql)  (attendue ec6969a0d28d379b47d15f91eb414ea2|22)"
note ""
note "== 4. Le même lot une 2e fois : refusé, rien ne change =="
note "  réponse : $(un_message docs/push-a5/prod/lot-prod.sql)"
etat "après"
note ""
note "== 5. Banc push A5 (A4a entier + A5) sur la base issue du lot =="
docker cp docs/push-a5/tests-push-a5-base-migree.sql $db:/tmp/tests-a5-migree.sql >/dev/null
docker exec -e PGCLIENTENCODING=UTF8 $db psql -U postgres -d postgres -q -At -f /tmp/tests-a5-migree.sql > docs/push-a5/prod/banc-base-migree-resultats.txt 2>&1
note "  $(grep -E '^[0-9]+\|[0-9]+$' docs/push-a5/prod/banc-base-migree-resultats.txt | tail -1)   (ok | échecs)"
