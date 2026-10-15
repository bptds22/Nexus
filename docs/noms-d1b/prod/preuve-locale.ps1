# Preuve LOCALE de la méthode « lot en un seul message » (celle du connecteur Supabase), D1.
#   cd C:\tmp\nexus-w4bc ; powershell -File docs\noms-d1b\prod\preuve-locale.ps1
# Le connecteur ne joint que le projet cloud : en local, le MÊME texte est envoyé de la même façon,
# en UN message à plusieurs instructions (psql -c), donc une seule transaction implicite.
$ErrorActionPreference = "Continue"
$db = "supabase_db_Nexus"
$out = "docs\noms-d1b\prod\preuve-locale.txt"
"PREUVE LOCALE — lot D1b — $(Get-Date -Format s)" | Out-File -Encoding utf8 $out
function Note($t) { $t | Out-File -Encoding utf8 -Append $out; Write-Host $t }
function Etat($titre) {
  $r = docker exec $db psql -U postgres -d postgres -At -c "select 'colonnes=' || (select count(*) from information_schema.columns where table_schema='public' and column_name='nom_a_confirmer') || ' fonctions=' || (select count(*) from pg_proc where pronamespace='public'::regnamespace and proname in ('couper_nom_complet','users_nom_google','athletes_nom_a_confirmer','mon_nom_a_confirmer','confirmer_mon_nom')) || ' triggers=' || (select count(*) from pg_trigger where tgname in ('trg_users_nom_google','trg_athletes_nom_a_confirmer')) || ' recherche_md5=' || (select left(md5(prosrc),8) from pg_proc where proname='recruiter_search_athletes') || ' version=' || (select count(*) from supabase_migrations.schema_migrations where version='20261015103315') || ' athletes=' || (select count(*) from public.athletes)"
  Note "  état $titre : $r"
}
function UnMessage($fichier) {
  docker cp $fichier "${db}:/tmp/lot.sql" | Out-Null
  docker cp docs\doublons-d1\prod\un-message.sh "${db}:/tmp/un-message.sh" | Out-Null
  $r = docker exec -e PGCLIENTENCODING=UTF8 $db sh /tmp/un-message.sh 2>&1
  ($r | Where-Object { $_ -match "ERROR|\{" }) -join " "
}

Note "`n== 0. Fichier testé et lots =="
Note ("  md5 fichier migration : " + (Get-FileHash supabase\migrations\20261015103315_d1b_nom_a_confirmer.sql -Algorithm MD5).Hash.ToLower())
Note ("  md5 lot-prod.sql      : " + (Get-FileHash docs\noms-d1b\prod\lot-prod.sql -Algorithm MD5).Hash.ToLower())
docker cp docs\noms-d1b\rollback-d1b.sql "${db}:/tmp/rollback-d1b.sql" | Out-Null
docker exec -e PGCLIENTENCODING=UTF8 $db psql -U postgres -d postgres -v ON_ERROR_STOP=1 -1 -q -f /tmp/rollback-d1b.sql 2>&1 | Out-Null
Etat "de départ (D1b retirée)"

Note "`n== 1. Une garde qui échoue À LA FIN annule tout (variante : empreinte attendue fausse) =="
Note ("  réponse : " + (UnMessage "docs\noms-d1b\prod\lot-preuve-garde-fausse.sql"))
Etat "après"

Note "`n== 2. Instructions envoyées SÉPARÉMENT (pas une transaction) : arrêt avant toute écriture =="
docker cp docs\noms-d1b\prod\lot-prod.sql "${db}:/tmp/lot.sql" | Out-Null
$r = docker exec -e PGCLIENTENCODING=UTF8 $db psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 -q -f /tmp/lot.sql 2>&1
Note ("  réponse : " + (($r | Where-Object { $_ -match "ERROR" }) -join " "))
Etat "après"

Note "`n== 3. Le lot réel, en UN message =="
Note ("  réponse : " + (UnMessage "docs\noms-d1b\prod\lot-prod.sql"))
Etat "après"
docker cp docs\noms-d1b\prod\empreinte-objets.sql "${db}:/tmp/empreinte-d1b.sql" | Out-Null
Note ("  empreinte des objets en base : " + (docker exec -e PGCLIENTENCODING=UTF8 $db psql -U postgres -d postgres -At -f /tmp/empreinte-d1b.sql))

Note "`n== 4. Le même lot une 2e fois : refusé, rien ne change =="
Note ("  réponse : " + (UnMessage "docs\noms-d1b\prod\lot-prod.sql"))
Etat "après"

Note "`n== 5. Tests au banc sur la base issue du lot =="
docker cp docs\noms-d1b\tests-d1b.sql "${db}:/tmp/tests-d1b.sql" | Out-Null
$t = docker exec -e PGCLIENTENCODING=UTF8 $db psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q -At -f /tmp/tests-d1b.sql 2>&1
Note ("  " + ($t | Select-Object -Last 1) + "   (ok|échecs)")
