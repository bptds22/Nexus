# Lot W4a — cartes prospects partenaire (base seulement)

Migration `supabase/migrations/20261014200739_w4a_prospects_partenaire.sql`,
rollback `supabase/rollback/20261014200739_rollback_w4a_prospects_partenaire.sql`.
**Local seulement au 2026-10-14. Rien en prod sans le GO de BP.** Aucun écran (W4b, W4c, W4d).

## Décisions BP (2026-10-14)

Plan W4 validé avec ses 10 recommandations, puis deux changements et un ajout :

| # | Décision | Où |
|---|---|---|
| 1 | Carte créée par un partenaire **évaluateur**, sport permis ; minimum de champs ; attestation « 14 ans ou plus » | `partenaire_prospect_enregistrer` |
| 2 | 60 jours, sans prolongation ; purge quotidienne | `expire_le`, `purger_prospects_partenaire` (cron 08:50) |
| 3 | Lien : 32 octets, empreinte sha256 seule, rendu une fois, révocable ; sans connexion : nom du partenaire seulement | `partenaire_prospect_lien`, `prospect_partenaire_resoudre` |
| 4 | Réservation au premier compte athlète qui ouvre le lien | `prospect_partenaire_ouvrir` |
| 5 | Contenu transférable : W2 (cote + critères facultatifs) et W3/W3b (badges), pas de texte libre | `prospect_partenaire_transferer` |
| 6 | **Changement 1** : « c'est moi » sans opt-in → `CONFIRMEE_ATTENTE_OPTIN` jusqu'à l'échéance ; transfert automatique dès l'opt-in | trigger `trg_prospect_partenaire_sur_optin` |
| 7 | « Pas moi » par le lien → suppression immédiate | `prospect_partenaire_infirmer` |
| 8 | **Changement 2** : rapprochements nom + école/équipe + sport, admin seulement ; « Proposer au jeune » / « Écarter » ; le jeune décide | `admin_prospects_rapprochements`, `admin_prospect_proposer`, `admin_prospect_ecarter` |
| 9 | **A** : « pas moi » sur une proposition → la carte revient à son état d'avant | idem `prospect_partenaire_infirmer` |
| 10 | **B** : rapprochement sur tous les athlètes ACTIFS | `prospect_partenaire_candidats` |
| 11 | **C** : deux cartes pour un même jeune suivent chacune leur parcours | — |
| 12 | **Point 3** : un seul candidat MOYENNE, déjà visible du partenaire, sport transférable → proposition automatique ; le partenaire voit « possible correspondance » | `prospect_partenaire_proposer_auto` |
| 13 | Annulation par l'admin : réservation à tout moment ; réclamation pendant 7 jours | `admin_prospect_annuler` |
| 14 | Plafond : 50 cartes actives par partenaire | `partenaire_prospect_enregistrer` |
| 15 | Export Loi 25 et ÉFVP | `admin_loi25_prospects_partenaires`, `app/admin/loi25/page.tsx`, `efvp-ajout-cartes-prospect-partenaire.md` |

**Moment du calcul automatique (point 3)** : à l'enregistrement d'une carte par le partenaire,
et à l'activation de l'opt-in d'un athlète (même trigger que le transfert). Aucun cron. Un
athlète qui rejoint une équipe ou change d'école n'est pas recalculé sur-le-champ : l'admin le
voit dans ses candidats (calculés à l'ouverture de la page).

## Ce que voit qui

| | Partenaire | Jeune | Admin |
|---|---|---|---|
| Carte | la sienne, statut **masqué** : « À envoyer », « Lien envoyé », ou « Correspondance possible » (proposition AUTO à un jeune encore visible de lui) | celles qui lui sont réservées, avec un rappel si l'opt-in manque | tout |
| Rapprochements | **jamais** | la proposition qui le vise (notification) | tout |
| Issues | réclamée (avec l'athlète), refusée par le lien, expirée, retirée | — | tout, avec l'instantané 7 j |

## Le trigger sur `athletes`

`AFTER UPDATE OF partner_visibility_opt_in, partner_visibility_parental_consent`, avec un
`WHEN` qui exige que l'opt-in DEVIENNE actif : toute autre écriture n'appelle même pas la
fonction. Celle-ci attrape toutes ses erreurs : l'opt-in est toujours enregistré. Prouvé au
banc (G1–G6, M1–M6), compteur d'appels à l'appui (`pg_stat_xact_user_functions`).

## Table existante modifiée

Une seule : `athlete_notifications_type_check` reçoit `PARTENAIRE_EVALUATION`. La migration
vérifie d'abord que la liste en place est exactement celle relevée en prod ; le rollback la
restaure et se compare au texte d'origine. Le rollback refuse de tourner s'il existe déjà des
notifications de ce type.

**Mobile publié** : la notification apparaît (titre, compteur), sans icône dans la liste ; aucun
écran mobile pour répondre. Le message dit « Réponds depuis nexussports.ca ». À reprendre au lot
mobile (registre).

## Preuves (local)

- `tests-w4a.sql` → **126/126** (`tests-w4a-resultats-local.txt`) : droits par rôle réel (anon,
  recruteur, coach, autre partenaire, admin), jeton (empreinte seule, remplacement, révocation,
  réservation), attente puis transfert à l'opt-in, transfert immédiat avec les règles W2/W3/W3b
  (évaluation existante gardée, badges déjà portés sautés avec leur raison), refus par le lien,
  rapprochements (AUTO unique, ambiguïté à deux candidats, FAIBLE, non visible, écarter,
  reproposer, annuler), trigger qui ne bloque rien, annulation admin 7 jours, plafond 50, purge,
  export Loi 25 sans fuite, ACL complètes, fonctions W2/W3/W3b et triggers de `athletes`
  comparés aux valeurs **de la prod**.
- Non-régression avec W4a en place : W2 **53/53**, W3 **70/70**, W3b **60/60**.
- Rollback : retour EXACT à l'état sans W4a (`releve-etat.sql`, 8 aspects : fonctions + ACL,
  triggers, contraintes, tables + ACL + RLS, politiques, cron, notifications, évaluations).

## Mise en prod (sur GO de BP seulement)

Même voie que W3b : une seule transaction `psql -1`, relevé avant + migration + gardes et
enregistrement (version FIXE `20261014200739` dans `schema_migrations`, une ligne
`admin_operations` `MIGRATION_W4A_PROSPECTS_PARTENAIRE`). Fichiers dans `prod/`.

- `w4a-releve-avant.sql` : refuse si W4a est déjà là (tables, fonctions, trigger, tâche cron,
  version) ; vérifie les 14 fonctions dont W4a dépend (W2/W3/W3b, rapprochement du lot D), les
  17 triggers d'`athletes`, la contrainte des notifications et `pgcrypto` dans `extensions`,
  aux valeurs relevées **en prod** le 2026-10-14 (identiques en local) ; pose les témoins.
- `w4a-gardes-et-enregistrement.sql` (GÉNÉRÉ par `generer-gardes.mjs`, ne pas éditer) :
  rien d'autre n'a bougé (fonctions, triggers, tâches cron, notifications, évaluations et
  badges partenaire, athlètes, `admin_operations`) ; nouvel état exact (29 fonctions et leurs
  ACL complètes, SECURITY DEFINER, 4 tables RLS sans politique ni droit et vides, texte exact
  du trigger et de la contrainte, purge 08:50) ; puis l'enregistrement, migration embarquée
  octet pour octet (md5 `4463e764392febebcffe4c53c1ee23fd`, LF).
- `w4a-verif-apres.sql` : lecture seule, après le commit.

Prouvé en local le 2026-10-14, à partir de copies en fins de ligne CRLF, dans des
transactions annulées : rollback W4a → chaîne complète → vérif toute conforme ; refus si W4a
est déjà là ; refus et annulation totale si une donnée bouge entre la migration et les gardes.

Depuis la racine du dépôt (`C:\Users\bptds\Documents\Nexus`), branche `feat/partenaires-w4a`,
en PowerShell :

```powershell
# 1. Les fichiers sont-ils ceux qui ont été testés ?
Get-FileHash -Algorithm MD5 docs\partenaires-w4a\prod\w4a-releve-avant.sql, supabase\migrations\20261014200739_w4a_prospects_partenaire.sql, docs\partenaires-w4a\prod\w4a-gardes-et-enregistrement.sql, docs\partenaires-w4a\prod\w4a-verif-apres.sql
#   w4a-releve-avant.sql                          F372B7126EF5D94FFACFD73D38E3B823
#   20261014200739_w4a_prospects_partenaire.sql   4463E764392FEBEBCFFE4C53C1EE23FD
#   w4a-gardes-et-enregistrement.sql              033EC7CD2D2F54FBF1342325BC19A5D6
#   w4a-verif-apres.sql                           61692259BA2ABF1FED0D3B45248BBA43
# (fichiers en LF, tels qu'écrits. Après un nouveau checkout Windows, ils seraient en CRLF et
#  ces empreintes changeraient ; les gardes, elles, acceptent les deux.)

# 2. Une seule transaction (-1) : une garde qui échoue annule TOUT.
#    Pas de mot de passe dans la commande : psql le demande.
$env:PGCLIENTENCODING = "UTF8"
& "C:\Users\bptds\scoop\apps\postgresql\18.6-5\bin\psql.exe" "host=aws-1-ca-central-1.pooler.supabase.com port=5432 dbname=postgres user=postgres.nrloizyemulbhujrqhgx sslmode=require" -v ON_ERROR_STOP=1 -1 `
  -f docs/partenaires-w4a/prod/w4a-releve-avant.sql `
  -f supabase/migrations/20261014200739_w4a_prospects_partenaire.sql `
  -f docs/partenaires-w4a/prod/w4a-gardes-et-enregistrement.sql

# 3. Lecture seule, après le commit :
& "C:\Users\bptds\scoop\apps\postgresql\18.6-5\bin\psql.exe" "host=aws-1-ca-central-1.pooler.supabase.com port=5432 dbname=postgres user=postgres.nrloizyemulbhujrqhgx sslmode=require" `
  -f docs/partenaires-w4a/prod/w4a-verif-apres.sql
```

Prod au 2026-10-14 : dernière version `20261014180000` (W3b). Si la migration change :
`node docs/partenaires-w4a/prod/generer-gardes.mjs`, puis recalculer les empreintes.

**Ensuite seulement** : merge de `feat/partenaires-w4a` dans `main` et push. `/admin/loi25`
appelle `admin_loi25_prospects_partenaires`, absente de la prod tant que la migration n'y est pas.
