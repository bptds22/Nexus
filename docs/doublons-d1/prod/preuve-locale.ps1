# Preuve LOCALE de la méthode « lot en un seul message » (celle du connecteur Supabase), D1.
#   cd C:\tmp\nexus-w4bc ; powershell -File docs\doublons-d1\prod\preuve-locale.ps1
# Le connecteur ne joint que le projet cloud : en local, le MÊME texte est envoyé de la même façon,
# en UN message à plusieurs instructions (psql -c), donc une seule transaction implicite.
$ErrorActionPreference = "Continue"
$db = "supabase_db_Nexus"
$out = "docs\doublons-d1\prod\preuve-locale.txt"
"PREUVE LOCALE — lot D1 — $(Get-Date -Format s)" | Out-File -Encoding utf8 $out
function Note($t) { $t | Out-File -Encoding utf8 -Append $out; Write-Host $t }
function Etat($titre) {
  $r = docker exec $db psql -U postgres -d postgres -At -c "select 'tables=' || (select count(*) from pg_class where oid in (to_regclass('public.doublons_probables'), to_regclass('public.doublons_verifications'))) || ' fonctions=' || (select count(*) from pg_proc where pronamespace='public'::regnamespace and proname in ('doublons_probables_noter','inscription_doublon_possible','coach_athletes_meme_identite')) || ' trigger=' || (select count(*) from pg_trigger where tgname='trg_doublons_probables_noter') || ' purge=' || (select count(*) from cron.job where jobname='doublons-verifications-purge') || ' version=' || (select count(*) from supabase_migrations.schema_migrations where version='20261015094834') || ' athletes=' || (select count(*) from public.athletes)"
  Note "  état $titre : $r"
}
function UnMessage($fichier) {
  docker cp $fichier "${db}:/tmp/lot.sql" | Out-Null
  docker cp docs\doublons-d1\prod\un-message.sh "${db}:/tmp/un-message.sh" | Out-Null
  $r = docker exec -e PGCLIENTENCODING=UTF8 $db sh /tmp/un-message.sh 2>&1
  ($r | Where-Object { $_ -match "ERROR|\{" }) -join " "
}

Note "`n== 0. Fichier testé et lots =="
Note ("  md5 fichier migration : " + (Get-FileHash supabase\migrations\20261015094834_d1_doublons_athletes.sql -Algorithm MD5).Hash.ToLower())
Note ("  md5 lot-prod.sql      : " + (Get-FileHash docs\doublons-d1\prod\lot-prod.sql -Algorithm MD5).Hash.ToLower())
docker cp docs\doublons-d1\rollback-d1.sql "${db}:/tmp/rollback-d1.sql" | Out-Null
docker exec -e PGCLIENTENCODING=UTF8 $db psql -U postgres -d postgres -v ON_ERROR_STOP=1 -1 -q -f /tmp/rollback-d1.sql 2>&1 | Out-Null
Etat "de départ (D1 retirée)"

Note "`n== 1. Une garde qui échoue À LA FIN annule tout (variante : empreinte attendue fausse) =="
Note ("  réponse : " + (UnMessage "docs\doublons-d1\prod\lot-preuve-garde-fausse.sql"))
Etat "après"

Note "`n== 2. Instructions envoyées SÉPARÉMENT (pas une transaction) : arrêt avant toute écriture =="
docker cp docs\doublons-d1\prod\lot-prod.sql "${db}:/tmp/lot.sql" | Out-Null
$r = docker exec -e PGCLIENTENCODING=UTF8 $db psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 -q -f /tmp/lot.sql 2>&1
Note ("  réponse : " + (($r | Where-Object { $_ -match "ERROR" }) -join " "))
Etat "après"

Note "`n== 3. Le lot réel, en UN message =="
Note ("  réponse : " + (UnMessage "docs\doublons-d1\prod\lot-prod.sql"))
Etat "après"
docker cp docs\doublons-d1\prod\empreinte-objets.sql "${db}:/tmp/empreinte.sql" | Out-Null
Note ("  empreinte des objets en base : " + (docker exec -e PGCLIENTENCODING=UTF8 $db psql -U postgres -d postgres -At -f /tmp/empreinte.sql))

Note "`n== 4. Le même lot une 2e fois : refusé, rien ne change =="
Note ("  réponse : " + (UnMessage "docs\doublons-d1\prod\lot-prod.sql"))
Etat "après"

Note "`n== 5. Tests au banc sur la base issue du lot =="
docker cp docs\doublons-d1\tests-d1.sql "${db}:/tmp/tests-d1.sql" | Out-Null
$t = docker exec -e PGCLIENTENCODING=UTF8 $db psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q -At -f /tmp/tests-d1.sql 2>&1
Note ("  " + ($t | Select-Object -Last 1) + "   (ok|échecs)")
