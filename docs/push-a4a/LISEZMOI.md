# Push A4a — file des pushs, côté serveur (lot mobile 1.4.5, 2026-10-16)

Branche `feat/push-a4a` (depuis main `8b22a380`). Migration `20261016010000_push_a4a_file.sql`.
Rollback `supabase/rollback/20261016010000_rollback_push_a4a_file.sql`. **Rien en prod sans GO de BP.**

Aucune nouvelle version de l'appli : le push s'affiche dans la 1.4.4 et, au clic, `data.type = 'announcement'`
ouvre l'accueil du rôle. La fonction edge `send-push` n'est pas touchée (elle acceptait déjà `collapse_id`).

## Ce qui part, et quand

| Événement | Push (titre / texte) | Regroupé par |
|---|---|---|
| Badge du coach (`appliquer_badges_saisie`) | « Nouveau badge » / « Ton coach Marc Tremblay t'a donné un badge. » — plusieurs : « 3 nouveaux badges » / « 3 nouveaux badges de ton coach Marc Tremblay. » | jeune + coach |
| Évaluation du coach (INSERT, ou cote globale changée) | « Nouvelle évaluation » / « Ton coach Marc Tremblay t'a évalué. » | jeune + coach |
| Badge d'un partenaire (direct ou carte confirmée) | « Nouveau badge » / « Tu as reçu le badge Top 25 de L'Esprit Sportif. » — plusieurs : « 3 nouveaux badges de L'Esprit Sportif. » | jeune + partenaire |
| Évaluation d'un partenaire (direct ou carte confirmée) | « Nouvelle évaluation » / « L'Esprit Sportif t'a évalué. » | jeune + partenaire |
| Carte proposée (`PARTENAIRE_EVALUATION`) | « L'Esprit Sportif t'a évalué. C'est toi ? » / « Réponds dans l'appli Nexus ou sur nexussports.ca. » | la carte |

- **Coach** : nommé seulement par `coach_nommable` (secondaire ou civil), sinon « Ton entraîneur ». **Partenaire** : nommé.
  **Jamais** de cote, de grade, de nom de recruteur ou de cégep.
- **Heures calmes** 21 h – 8 h (heure du Québec, `America/Toronto`) : rien ne part, la file attend ; le cron de
  8 h l'envoie.
- **Regroupement** : un groupe part 10 min après son premier élément, en UN push. Cron toutes les 10 min
  (`push-file-envoi`), donc 10 à 20 min de délai.
- **Aucun faux badge** : `appliquer_badges_saisie` compare les badges **actifs** avant/après ; un contexte modifié
  ou un ré-enregistrement n'est pas un nouveau badge ; un admin qui corrige ne déclenche rien. Le miroir badges →
  distinctions écrit `evaluations` sans changer la cote : aucun push.
- **N'envoie pas** : type coupé par le jeune (`PREFERENCE`), aucun appareil (`SANS_JETON`), compte inactif ou carte
  qui n'attend plus de réponse (`ANNULE`). Tout reste au journal de la file (90 jours ; `push_envois` 180 jours).
- **Préférences** : nouvelle table `push_preferences` (absence = actif), types `BADGES_EVALUATIONS`, `VISITES`,
  `RAPPELS`, `CARTES_PARTENAIRES` ; `push_preference_definir(type, actif)` et `push_preferences_miennes()` pour
  l'écran à venir (web, puis mobile 1.4.5). **Pourquoi pas `notification_preferences`** : elle est opt-in
  (`push` défaut false), sa liste fermée de 6 événements est celle des courriels du coach et l'écran Paramètres
  coach l'écrit ; la réutiliser couperait les pushs à quiconque a enregistré ses réglages, ou mêlerait deux
  taxinomies. Aucune donnée n'y est (0 ligne en prod).
- **`push_to_user`** : 5e paramètre `p_collapse_id` (défaut null — les appelants à 4 arguments restent valides),
  délai pg_net 15 s. Une carte proposée de nouveau remplace son push (`nx-carte:<id>`).
- **`PARTENAIRE_EVALUATION`** : nouveau texte ; les notifications **sans réponse** (paire `PROPOSE`, non caduque)
  le prennent (0 en prod au relevé du 2026-10-16).
- **Prise en charge par un coach** (`claim_school_athletes`) : « Le coach X t'a pris en charge à École. » seulement
  si `coach_nommable`, sinon « Ton entraîneur t'a pris en charge. » (notification ET push ; clic `announcement`).
  Ce push reste direct (pas de file, donc pas d'heures calmes) : c'est un geste du coach, en journée.
- **Hors lot** : courriel de carte prospect (BP décide d'abord), visites, relances.

## Preuves (local)

- `tests-push-a4a.sql` → `tests-push-a4a-resultats.txt` : **69/69**, transaction annulée. Droits (file, journal,
  traitement, mise en file, `push_to_user` fermés ; préférences par la fonction seulement, chacun les siennes) ;
  badges du coach (2 → 2, ré-enregistrement → 0, contexte changé → 0, retrait → 0, admin → 0) ; évaluations (création
  et cote changée → 1, commentaire → 0, coach collégial → jamais nommé) ; partenaire (3 badges → un groupe, badge
  retiré → 0, évaluation sans changement de cote → 0) ; carte proposée → nouveau texte et push en file, confirmée →
  transfert en file (badge + évaluation) et push de la carte annulé ; réécriture des notifications sans réponse
  seulement ; heures calmes (22 h 30 et 7 h 59 : rien ; 8 h : part) ; regroupement (groupe de 5 min : attend ; à
  10 min : part seul) ; préférence, sans jeton, compte inactif ; ce qui part dans pg_net (délai 15 s, `announcement`,
  `collapse_id`, titre/texte = journal) ; RSEQ (aucun cégep, aucun recruteur, coach collégial absent, ni cote ni grade).
- `non-regression-local.txt` : W2 53/0, W3 70/0, W3b 60/0, W4a 205/0, D1 33/0 (identiques à avant la migration),
  W4d 52/0, invitations coach nommé 32/0, D1b 29/0.
- **Rollback exact** : après le rollback local, l'état des objets touchés (`prod/etat-avant.sql` : fonctions sans
  commentaires + droits, tables, triggers, cron) = celui de la prod relevé en lecture seule :
  `0bf261096a750fd407495fcbacf165ed|13`.
- `prod/preuve-locale.txt` : garde fausse → tout annulé ; envoi séparé → arrêt avant écriture ; lot réel → OK
  (empreinte `5055df76bf335dd6d8e31c67b463ff2f|57`, admin_operations enregistrée) ; 2ᵉ envoi refusé ; banc 69/0
  sur la base issue du lot.

## Relevé prod (lecture seule, 2026-10-16)

Les 4 fonctions remplacées ont, sans commentaires, l'empreinte attendue par la garde de la migration
(`push_to_user` b09389f1…, `appliquer_badges_saisie` 7b25d620…, `prospect_partenaire_proposer` 9d82dd19…,
`claim_school_athletes` 5dab8e20…). En local, `appliquer_badges_saisie` porte un commentaire `/* */` que la prod
n'a pas : même code, la garde ignore les commentaires. Aucune table `push_*`, aucun cron `push*`,
0 `notification_preferences`, 0 notification `PARTENAIRE_EVALUATION`. 205 jetons iOS, 23 Android.

## Ordre en prod (sur GO de BP)

1. Relevé avant (lecture seule) : `prod/etat-avant.sql` doit rendre `0bf261096a750fd407495fcbacf165ed|13`.
2. `prod/lot-prod.sql` **en un seul appel** (connecteur `execute_sql`) — une transaction : relevé, gardes, le
   fichier octet pour octet (md5 `441c3e0e3e29b9efc046bd0a4d1f61ad`), `schema_migrations`, `admin_operations`
   (`MIGRATION_PUSH_A4A`), empreinte des objets `5055df76bf335dd6d8e31c67b463ff2f`. Lot 85 Ko : si le connecteur
   refuse (« requestState »), voie psql de BP : `psql "<url prod>" -X -v ON_ERROR_STOP=1 -At -c "$(cat docs/push-a4a/prod/lot-prod.sql)"`
   (un seul message = une transaction).
3. Lecture seule après : `prod/empreinte-objets.sql` = `5055df76…|57`, cron `push-file-envoi` actif, file vide.
4. Premier événement réel : vérifier une ligne `push_file` puis `push_envois` (≤ 20 min, hors 21 h – 8 h).
5. Rollback si besoin : `supabase/rollback/20261016010000_rollback_push_a4a_file.sql` (une transaction).
