# Lot C0 cégep — mise en prod (base seulement), commandes psql

> **EN PROD le 27 oct. 2026, COMMIT à 16 h 14 UTC** (lancé par BP ; rejeu à blanc à 16 h 14 UTC). Version 20261027210000 inscrite, admin_operations MIGRATION_CEGEP_LOT_C0_BASE, interrupteur `false`. Sorties : `*.sortie.txt` (UTF-16 de Tee-Object) et `*.sortie-utf8.txt`. L'en-tête « NON APPLIQUÉE » de la migration est laissé tel quel : le md5 inscrit en prod en dépend.

Migration `20261027210000_cegep_lot_c0_base` : écritures recruteur collégial → cégépien fermées (favori,
pipeline, fils, `is_athlete_contactable`), interrupteur `app_settings.lancement_collegial` = `false`,
verrou d'ancrage (trigger `verrou_lancement_collegial` sur `athletes` et `team_athletes`).

| Fichier | md5 (LF, tel que généré) | Effet |
|---|---|---|
| `rejeu-blanc-20261027.sql` | `986f42bfa6f32f1993ff568e94e5bb49` | finit par ROLLBACK : rien n'est appliqué |
| `apply-20261027.sql` | `3b6f992a79168500e597e44fd0735ad7` | COMMIT : C0 en prod, interrupteur OFF |
| `rollback-20261027.sql` | `abd93b68489dce1246fc3976588dcce2` | COMMIT : C0 retiré (sur GO seulement) |

Migration md5 `3e194b6e72fd6e6e2a6bce813d4cdb0b`, rollback md5 `fc39558337509aa9add6b0ca7f27e837`.
Générés par `scripts/cegep-lot-c0/generer.sh 20261027 <type>`. Preuves locales : `../preuves-locales-20261027.txt`.

Une seule session en prod à la fois. Chaîne de connexion dans une variable d'environnement seulement ;
md5 vérifié juste avant l'envoi ; même commande d'abord en local (faite le 2026-10-27). Lancer **sans `-1`**,
depuis le worktree `C:\tmp\nexus-cegep-c0`, fichiers en LF.

```powershell
cd C:\tmp\nexus-cegep-c0
$env:PGCLIENTENCODING = "UTF8"
$psql = "$HOME\scoop\apps\postgresql\current\bin\psql.exe"
# Sans mot de passe : psql le demande. Jamais dans un fichier ni dans le chat.
$env:NEXUS_PROD_DB = "postgresql://postgres.nrloizyemulbhujrqhgx@aws-1-ca-central-1.pooler.supabase.com:5432/postgres"

# 1. Rejeu à blanc (finit par ROLLBACK)
$f = "docs\cegep-lot-c0\prod\rejeu-blanc-20261027.sql"
(Get-FileHash -Algorithm MD5 $f).Hash   # attendu : 986F42BFA6F32F1993FF568E94E5BB49
& $psql $env:NEXUS_PROD_DB -X -v ON_ERROR_STOP=1 -f $f 2>&1 | Tee-Object -FilePath "docs\cegep-lot-c0\prod\rejeu-blanc-20261027.sortie.txt"

# 2. Apply (sur GO, après lecture du rejeu)
$f = "docs\cegep-lot-c0\prod\apply-20261027.sql"
(Get-FileHash -Algorithm MD5 $f).Hash   # attendu : 3B6F992A79168500E597E44FD0735AD7
& $psql $env:NEXUS_PROD_DB -X -v ON_ERROR_STOP=1 -f $f 2>&1 | Tee-Object -FilePath "docs\cegep-lot-c0\prod\apply-20261027.sortie.txt"

# 3. Rollback (sur GO seulement)
$f = "docs\cegep-lot-c0\prod\rollback-20261027.sql"
(Get-FileHash -Algorithm MD5 $f).Hash   # attendu : ABD93B68489DCE1246FC3976588DCCE2
& $psql $env:NEXUS_PROD_DB -X -v ON_ERROR_STOP=1 -f $f 2>&1 | Tee-Object -FilePath "docs\cegep-lot-c0\prod\rollback-20261027.sortie.txt"

Remove-Item Env:NEXUS_PROD_DB
```

Attendu au rejeu : matrice APRÈS = AVANT partout (`=`) sauf « recruteur collégial × cégépien » (`CHANGE` :
favori, pipeline, fil recruteur ↔ coach, fil direct refusés, `is_athlete_contactable` faux) ; équivalence
`ecarts` = 0 ; VERROU OFF : 3 refus « NEXUS: Les cégeps ne sont pas encore ouverts… », cégépien déjà ancré
`accepté` ; VERROU ON : 4 `accepté` ; empreinte 0 / 0 / 0 ; VERDICT ; compteurs hors transaction identiques ;
`policies_restent` = 0, `contactable_md5` = fe2ea3e9…, `derniere_version` = 20261027150000.
Les NOTICE en rouge sont un effet de PowerShell, pas une erreur.
