# Étape 4 — import des 622 matchs NLS en prod par psql

> **Historique.** Depuis le 2026-10-14 (décision BP), c'est Claude Code qui applique les migrations en prod par le connecteur Supabase, après le GO de BP ; BP ne lance plus psql. Règle : `CLAUDE.md`, MIGRATION SAFETY CHECKLIST, point 9.

Pourquoi psql : le fichier fait 123 Ko. Par le connecteur MCP, il faudrait
recopier son texte à la main, sans pouvoir prouver qu'il est identique au
fichier vérifié. Une erreur sur un nom arrêterait l'import ; une erreur sur
une date ou une heure passerait **en silence**. Même voie que W2 et W3 :
`psql -1` sur le session pooler, avec les gardes dans la même transaction.

**Fenêtre :** jamais le mardi, ni le mercredi avant 5 h. Le fichier d'import
le refuse lui-même (garde active, aucun drapeau d'essai).

Depuis la racine du dépôt, en PowerShell :

```powershell
# 1. Les trois fichiers sont-ils bien ceux qui ont été testés ?
Get-FileHash -Algorithm MD5 docs\nls-matchs-prod\import-avant.sql, data\nls\matchs-2026-10-14.sql, docs\nls-matchs-prod\import-apres.sql
#   import-avant.sql       00BA3103733CA9AF31797A301EE568BD
#   matchs-2026-10-14.sql  8B515D495FB262F4E03D65166B6248D1
#   import-apres.sql       11E58EB3E2DA0F2969D898B6542CF37E

# 2. Une seule transaction : un écart annule TOUT (matchs + journal)
$env:PGCLIENTENCODING = "UTF8"
psql "<chaîne de connexion session pooler, comme pour W2/W3>" -v ON_ERROR_STOP=1 -1 `
  -f docs/nls-matchs-prod/import-avant.sql `
  -f data/nls/matchs-2026-10-14.sql `
  -f docs/nls-matchs-prod/import-apres.sql
```

Sortie attendue : trois NOTICE, sans ERROR.

```
NEXUS avant : source NLS admise, 107 équipes, 0 match, 6 gymnases — OK
NEXUS NLS matchs : lot 622, nouveaux 622, modifiés 0 (dont 0 déplacé(s)), inchangés 0, inconnus 0, retirés 0 (dont 0 nouveau(x)), revenus 0 ; base NLS 0 -> 622 ; journal +1
NEXUS après : 622 matchs, répartition exacte, 0 doublon, 622 géocodés, 1 ligne de journal — OK
```

Une ERROR signifie que **rien n'a été écrit**. Me renvoyer le message.

Prouvé le 2026-10-14 en local avec le vrai fichier, garde de fenêtre active,
sur une base remise dans l'état « avant » de la prod : les trois NOTICE
ci-dessus, puis transaction annulée.

Rollback de l'import, si on doit le défaire : `scripts/nls-basketball/matchs/rollback-lot.sql`
(supprime les 622 matchs d'après le journal ; refusé si un recruteur en a déjà
ajouté un à son calendrier).
