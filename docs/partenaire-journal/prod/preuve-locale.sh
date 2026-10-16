#!/bin/bash
# Preuve LOCALE de la méthode « lot en un seul message » (celle du connecteur Supabase), journal partenaire.
#   cd C:\tmp\nexus-145 ; MSYS_NO_PATHCONV=1 bash docs/partenaire-journal/prod/preuve-locale.sh
# Le connecteur ne joint que le projet cloud : en local, le MÊME texte est envoyé de la même façon,
# en UN message à plusieurs instructions (psql -c), donc une seule transaction implicite.
export MSYS_NO_PATHCONV=1
DB=supabase_db_Nexus
OUT=docs/partenaire-journal/prod/preuve-locale.txt
echo "PREUVE LOCALE — lot journal partenaire — $(date -Iseconds)" > "$OUT"
note() { echo "$1" | tee -a "$OUT"; }
etat() {
  local r
  r=$(docker exec $DB psql -U postgres -d postgres -At -c "select 'fonction=' || coalesce(to_regprocedure('public.partenaire_journaliser(uuid,text,text)')::text, 'absente') || ' version=' || (select count(*) from supabase_migrations.schema_migrations where version = '20261016150000') || ' vues=' || (select count(*) from public.partner_profile_views) || ' telechargements=' || (select count(*) from public.partner_card_downloads)")
  note "  état $1 : $r"
}
un_message() {
  docker cp "$1" $DB:/tmp/lot.sql >/dev/null
  docker cp docs/doublons-d1/prod/un-message.sh $DB:/tmp/un-message.sh >/dev/null
  docker exec -e PGCLIENTENCODING=UTF8 $DB sh /tmp/un-message.sh 2>&1 | grep -E "ERROR|\{" | tr '\n' ' '
}

note ""
note "== 0. Fichier testé et lots =="
note "  md5 fichier migration : $(md5sum supabase/migrations/20261016150000_partenaire_journal.sql | cut -d' ' -f1)"
note "  md5 lot-prod.sql      : $(md5sum docs/partenaire-journal/prod/lot-prod.sql | cut -d' ' -f1)"
docker cp docs/partenaire-journal/rollback-partenaire-journal.sql $DB:/tmp/rb-pj.sql >/dev/null
docker exec -e PGCLIENTENCODING=UTF8 $DB psql -U postgres -d postgres -q -f /tmp/rb-pj.sql >/dev/null 2>&1
etat "de départ (migration retirée par le rollback)"

note ""
note "== 1. Une garde qui échoue À LA FIN annule tout (variante : empreinte attendue fausse) =="
note "  réponse : $(un_message docs/partenaire-journal/prod/lot-preuve-garde-fausse.sql)"
etat "après"

note ""
note "== 2. Instructions envoyées SÉPARÉMENT (pas une transaction) : arrêt avant toute écriture =="
docker cp docs/partenaire-journal/prod/lot-prod.sql $DB:/tmp/lot.sql >/dev/null
note "  réponse : $(docker exec -e PGCLIENTENCODING=UTF8 $DB psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 -q -f /tmp/lot.sql 2>&1 | grep ERROR | tr '\n' ' ')"
etat "après"

note ""
note "== 3. Le lot réel, en UN message =="
note "  réponse : $(un_message docs/partenaire-journal/prod/lot-prod.sql)"
etat "après"
docker cp docs/partenaire-journal/prod/empreinte-objets.sql $DB:/tmp/emp-pj.sql >/dev/null
note "  empreinte des objets en base : $(docker exec -e PGCLIENTENCODING=UTF8 $DB psql -U postgres -d postgres -At -f /tmp/emp-pj.sql)"

note ""
note "== 4. Le même lot une 2e fois : refusé, rien ne change =="
note "  réponse : $(un_message docs/partenaire-journal/prod/lot-prod.sql)"
etat "après"

note ""
note "== 5. Tests au banc sur la base issue du lot =="
docker cp docs/partenaire-journal/tests-partenaire-journal.sql $DB:/tmp/tests-pj.sql >/dev/null
note "  $(docker exec -e PGCLIENTENCODING=UTF8 $DB psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q -At -f /tmp/tests-pj.sql 2>&1 | grep -E '^[0-9]+ \| [0-9]+$' | tail -1)   (ok | échecs)"

note ""
note "== 6. Rollback puis ré-application (état final = migration appliquée, comme avant la preuve) =="
docker exec -e PGCLIENTENCODING=UTF8 $DB psql -U postgres -d postgres -q -f /tmp/rb-pj.sql 2>&1 | grep -E "NOTICE|ERROR" | tee -a "$OUT"
etat "après rollback"
note "  réponse : $(un_message docs/partenaire-journal/prod/lot-prod.sql)"
etat "final"
