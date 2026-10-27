# Lot 7 civil — mise en prod (migration seule), commandes psql

Migration `20261027150000_civil_lot7_lancement` : interrupteur `app_settings.lancement_civil` = `false` et verrou
(trigger `verrou_lancement_civil` sur `team_athletes` et `team_coaches`). Migration md5 `114f1359354a921686dcddb29e194bb1`,
rollback md5 `341ac6212860cc824e374204f4308e51`.

| Fichier | md5 (LF, tel que généré) | Effet |
|---|---|---|
| `rejeu-blanc-20261027.sql` | `5d04fff679cfada9245e72a474108828` | finit par ROLLBACK : rien n'est appliqué |
| `apply-20261027.sql` | `111311e4728326f0dac5f34c5f81eb7c` | COMMIT : lot 7 en prod, interrupteur OFF |
| `rollback-20261027.sql` | `906f8e4cbca4122f7ac1e7c1c96b070e` | COMMIT : lot 7 retiré (sur GO seulement) |

Générés par `scripts/civil-2026/lot7_prod.sh 20261027 <type>`. Preuves locales : `../preuves-locales-20261027.txt`.

Règles : une seule session touche la prod à la fois ; chaîne de connexion dans une variable d'environnement seulement ;
md5 vérifié juste avant l'envoi ; même commande d'abord contre la base locale (faite le 2026-10-27, voir les preuves).
Lancer **sans `-1`** : chaque fichier ouvre et ferme sa propre transaction. Depuis le worktree `C:\tmp\nexus-civil`.

## 0. Session PowerShell (une fois)

```powershell
cd C:\tmp\nexus-civil
$env:PGCLIENTENCODING = "UTF8"
$psql = "$HOME\scoop\apps\postgresql\current\bin\psql.exe"
# Chaîne SANS mot de passe : psql le demande. Ne jamais la coller dans un fichier ni dans le chat.
$env:NEXUS_PROD_DB = "postgresql://postgres.nrloizyemulbhujrqhgx@aws-1-ca-central-1.pooler.supabase.com:5432/postgres"
```

## 1. Rejeu à blanc (transaction annulée)

```powershell
$f = "docs\civil-2026\lot7\prod\rejeu-blanc-20261027.sql"
(Get-FileHash -Algorithm MD5 $f).Hash   # attendu : 5D04FFF679CFADA9245E72A474108828
& $psql $env:NEXUS_PROD_DB -X -v ON_ERROR_STOP=1 -f $f 2>&1 | Tee-Object -FilePath "docs\civil-2026\lot7\prod\rejeu-blanc-20261027.sortie.txt"
```

Attendu : AVANT, APRÈS (OFF) et après rollback = `accepté` pour les trois cas (athlète → équipe existante, transfert,
coach → équipe existante) ; VERROU OFF = trois `REFUSÉ 42501 NEXUS: Cette équipe sera ouverte…` ; VERROU ON = trois
`accepté` ; cible sur un club : `autres` = 0 (aucun recruteur ne la voit) et contrôle sur un cégep
`la_voient` ≥ 1 ; ligne VERDICT ; relecture hors transaction : `net.http_request_queue`, `athlete_notifications`,
`athlete_targets`, `team_athletes`, `team_coaches` identiques avant / après ; `interrupteur_reste` = f, `triggers_restent` = 0,
`equipes_sources` = 0, `derniere_version` = 20261026210100. Toute garde qui échoue arrête tout avant le ROLLBACK.
Les NOTICE « NEXUS: » s'affichent en rouge (NativeCommandError) : c'est PowerShell, pas une erreur.

## 2. Apply (sur ton GO, après lecture du rejeu)

```powershell
$f = "docs\civil-2026\lot7\prod\apply-20261027.sql"
(Get-FileHash -Algorithm MD5 $f).Hash   # attendu : 111311E4728326F0DAC5F34C5F81EB7C
& $psql $env:NEXUS_PROD_DB -X -v ON_ERROR_STOP=1 -f $f 2>&1 | Tee-Object -FilePath "docs\civil-2026\lot7\prod\apply-20261027.sortie.txt"
```

Attendu : AVANT = APRÈS (OFF) = `accepté | accepté` ; `version_inscrite` 20261027150000, `interrupteur` false ;
`== COMMIT fait`. Inscrit `schema_migrations` (`civil_lot7_lancement`) et `admin_operations`
`MIGRATION_CIVIL_LOT7_LANCEMENT`.

## 3. Rollback (sur GO seulement)

```powershell
$f = "docs\civil-2026\lot7\prod\rollback-20261027.sql"
(Get-FileHash -Algorithm MD5 $f).Hash   # attendu : 906F8E4CBCA4122F7AC1E7C1C96B070E
& $psql $env:NEXUS_PROD_DB -X -v ON_ERROR_STOP=1 -f $f 2>&1 | Tee-Object -FilePath "docs\civil-2026\lot7\prod\rollback-20261027.sortie.txt"
```

Une fois le rollback fait, la version 20261027150000 reste inscrite : un nouvel apply demande une nouvelle version
(régénérer).

## 4. Fin de session

```powershell
Remove-Item Env:NEXUS_PROD_DB
```
