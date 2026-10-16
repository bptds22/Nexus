#!/bin/sh
# Preuve LOCALE de la méthode « lot en un seul message » (celle du connecteur Supabase), lectures sans plafond.
#   cd C:\tmp\nexus-lectures ; sh docs/lectures-sans-plafond/prod/preuve-locale.sh
# En local, le MÊME texte est envoyé de la même façon : UN message à plusieurs instructions (psql -c),
# donc une seule transaction implicite. Départ : base locale à l'état prod (etat-avant.sql = relevé prod).
# L'étape 3 APPLIQUE le lot à la base Docker locale (elle reste migrée, comme la prod le sera) ; l'étape 6
# prouve le rollback (retour à l'état de départ) puis ré-applique le lot.
export MSYS_NO_PATHCONV=1
db=supabase_db_Nexus
d=docs/lectures-sans-plafond/prod
out=$d/preuve-locale.txt
ETAT_PROD=21280015fba68a00183647d59c52eb48
EMPREINTE=e54c87845beefe00ea3d5345210a5bcc
note() { echo "$1" | tee -a "$out"; }
etat() {
  docker cp $d/etat-avant.sql $db:/tmp/etat.sql >/dev/null
  r=$(docker exec -e PGCLIENTENCODING=UTF8 $db psql -U postgres -d postgres -At -f /tmp/etat.sql)
  v=$(docker exec $db psql -U postgres -d postgres -At -c "select count(*) from supabase_migrations.schema_migrations where version = '20261016080000'")
  o=$(docker exec $db psql -U postgres -d postgres -At -c "select count(*) from public.admin_operations where operation = 'MIGRATION_LECTURES_SANS_PLAFOND'")
  note "  état $1 : $r  (prod avant = $ETAT_PROD|12) version=$v operations=$o"
}
un_message() {
  docker cp "$1" $db:/tmp/lot.sql >/dev/null
  docker cp docs/push-a4a/prod/un-message.sh $db:/tmp/un-message.sh >/dev/null
  docker exec -e PGCLIENTENCODING=UTF8 $db sh /tmp/un-message.sh 2>&1 | grep -E "ERROR|\{" | tr '\n' ' '
}
echo "PREUVE LOCALE — lot lectures sans plafond — $(date '+%Y-%m-%dT%H:%M:%S')" > "$out"
note ""
note "== 0. Fichier testé et lots =="
note "  md5 fichier migration : $(md5sum supabase/migrations/20261016080000_lectures_sans_plafond.sql | cut -c1-32)"
note "  md5 lot-prod.sql      : $(md5sum $d/lot-prod.sql | cut -c1-32)"
note "  md5 rollback          : $(md5sum supabase/rollback/20261016080000_rollback_lectures_sans_plafond.sql | cut -c1-32)"
etat "de départ"
note ""
note "== 1. Une garde qui échoue À LA FIN annule tout (variante : empreinte attendue fausse) =="
note "  réponse : $(un_message $d/lot-preuve-garde-fausse.sql)"
etat "après"
note ""
note "== 2. Instructions envoyées SÉPARÉMENT (en morceaux, pas une transaction) : arrêt avant toute écriture =="
docker cp $d/lot-prod.sql $db:/tmp/lot.sql >/dev/null
r=$(docker exec -e PGCLIENTENCODING=UTF8 $db psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 -q -f /tmp/lot.sql 2>&1 | grep ERROR)
note "  réponse : $r"
etat "après"
note ""
note "== 3. Le lot réel, en UN message =="
note "  réponse : $(un_message $d/lot-prod.sql)"
etat "après"
docker cp $d/empreinte-objets.sql $db:/tmp/emp.sql >/dev/null
note "  empreinte des objets en base : $(docker exec -e PGCLIENTENCODING=UTF8 $db psql -U postgres -d postgres -At -f /tmp/emp.sql)  (attendue $EMPREINTE|28)"
note ""
note "== 4. Le même lot une 2e fois : refusé, rien ne change =="
note "  réponse : $(un_message $d/lot-prod.sql)"
etat "après"
note ""
note "== 5. Banc sur la base issue du lot =="
docker cp docs/lectures-sans-plafond/tests-lectures-sans-plafond.sql $db:/tmp/t.sql >/dev/null
docker exec -e PGCLIENTENCODING=UTF8 $db psql -U postgres -d postgres -X -q -At -f /tmp/t.sql 2>&1 | grep -v '^$' > $d/banc-base-migree-resultats.txt
note "  $(grep -E '^[0-9]+\|[0-9]+$' $d/banc-base-migree-resultats.txt | tail -1)   (ok | échecs)"
note ""
note "== 6. Rollback (une transaction) : retour exact à l'état de départ, puis le lot ré-appliqué =="
docker cp supabase/rollback/20261016080000_rollback_lectures_sans_plafond.sql $db:/tmp/rb.sql >/dev/null
r=$(docker exec -e PGCLIENTENCODING=UTF8 $db psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 -q -f /tmp/rb.sql 2>&1 | grep -E "ERROR" )
note "  rollback : ${r:-sans erreur}"
etat "après rollback"
# admin_operations est un journal en ajout seulement : le rollback n'efface que la version et les fonctions ; le lot
# ré-appliqué ajoute une opération de plus (sa garde vérifie « +1 », pas l'absence).
note "  ré-application : $(un_message $d/lot-prod.sql)"
etat "final"
