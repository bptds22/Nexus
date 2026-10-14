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

## Mise en prod

Pas encore préparée : après la relecture de BP (migration et rapport). Comme W3b : relevé avant,
migration et gardes dans une seule transaction `psql -1`, md5 sans retours chariot, ligne
`admin_operations`, version `20261014200739`. Puis seulement le code (base avant app) — y
compris l'export `/admin/loi25`, qui appelle une fonction absente de la prod tant que la
migration n'y est pas.
