#!/bin/sh
# Preuve LOCALE de la méthode « lot en un seul message » (celle du connecteur Supabase), push A4a.
#   cd C:\tmp\nexus-push ; sh docs/push-a4a/prod/preuve-locale.sh
# En local, le MÊME texte est envoyé de la même façon : UN message à plusieurs instructions (psql -c),
# donc une seule transaction implicite. Départ : base locale SANS la migration (rollback appliqué).
export MSYS_NO_PATHCONV=1
db=supabase_db_Nexus
out=docs/push-a4a/prod/preuve-locale.txt
note() { echo "$1" | tee -a "$out"; }
etat() {
  docker cp docs/push-a4a/prod/etat-avant.sql $db:/tmp/etat.sql >/dev/null
  r=$(docker exec -e PGCLIENTENCODING=UTF8 $db psql -U postgres -d postgres -At -f /tmp/etat.sql)
  v=$(docker exec $db psql -U postgres -d postgres -At -c "select count(*) from supabase_migrations.schema_migrations where version = '20261016010000'")
  note "  état $1 : $r  (prod avant = 0bf261096a750fd407495fcbacf165ed|13) version=$v"
}
un_message() {
  docker cp "$1" $db:/tmp/lot.sql >/dev/null
  docker cp docs/push-a4a/prod/un-message.sh $db:/tmp/un-message.sh >/dev/null
  docker exec -e PGCLIENTENCODING=UTF8 $db sh /tmp/un-message.sh 2>&1 | grep -E "ERROR|\{" | tr '\n' ' '
}
echo "PREUVE LOCALE — lot push A4a — $(date '+%Y-%m-%dT%H:%M:%S')" > "$out"
note ""
note "== 0. Fichier testé et lots =="
note "  md5 fichier migration : $(md5sum supabase/migrations/20261016010000_push_a4a_file.sql | cut -c1-32)"
note "  md5 lot-prod.sql      : $(md5sum docs/push-a4a/prod/lot-prod.sql | cut -c1-32)"
etat "de départ (migration retirée)"
note ""
note "== 1. Une garde qui échoue À LA FIN annule tout (variante : empreinte attendue fausse) =="
note "  réponse : $(un_message docs/push-a4a/prod/lot-preuve-garde-fausse.sql)"
etat "après"
note ""
note "== 2. Instructions envoyées SÉPARÉMENT (pas une transaction) : arrêt avant toute écriture =="
docker cp docs/push-a4a/prod/lot-prod.sql $db:/tmp/lot.sql >/dev/null
r=$(docker exec -e PGCLIENTENCODING=UTF8 $db psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 -q -f /tmp/lot.sql 2>&1 | grep ERROR)
note "  réponse : $r"
etat "après"
note ""
note "== 3. Le lot réel, en UN message =="
note "  réponse : $(un_message docs/push-a4a/prod/lot-prod.sql)"
etat "après"
docker cp docs/push-a4a/prod/empreinte-objets.sql $db:/tmp/emp.sql >/dev/null
note "  empreinte des objets en base : $(docker exec -e PGCLIENTENCODING=UTF8 $db psql -U postgres -d postgres -At -f /tmp/emp.sql)"
note ""
note "== 4. Le même lot une 2e fois : refusé, rien ne change =="
note "  réponse : $(un_message docs/push-a4a/prod/lot-prod.sql)"
etat "après"
note ""
note "== 5. Banc push A4a sur la base issue du lot =="
docker cp docs/push-a4a/tests-push-a4a.sql $db:/tmp/tests-push.sql >/dev/null
note "  $(docker exec -e PGCLIENTENCODING=UTF8 $db psql -U postgres -d postgres -q -At -f /tmp/tests-push.sql 2>&1 | grep -E '^[0-9]+\|[0-9]+$' | tail -1)   (ok | échecs)"
