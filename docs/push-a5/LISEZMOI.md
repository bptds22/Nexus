# Push A5 — ouverture au clic (lot mobile 1.4.5, 2026-10-16)

Branche `feat/push-a5-ouverture` (depuis main `9d9f7830`). Migration `20261016020000_push_a5_ouverture.sql`
(md5 `0e53c5595a1d069e64ced2b6af4efbf8`). Rollback `supabase/rollback/20261016020000_rollback_push_a5_ouverture.sql`.
**Rien en prod sans GO de BP.**

## Ce que le push porte (serveur)

Chaque push de la file A4a garde `type: "announcement"` (la 1.4.4 ouvre l'accueil, comme avant) et ajoute :

| `nx_type` | `route` |
|---|---|
| `BADGE_COACH`, `BADGE_PARTENAIRE` | `/athlete/profil/apercu?section=badges` |
| `EVALUATION_COACH`, `EVALUATION_PARTENAIRE` | `/athlete/profil/apercu?section=evaluation` |
| `CARTE_PARTENAIRE` | `/athlete/cartes-partenaires` (« C'est moi / Ce n'est pas moi ») |
| autre | `/athlete/notifications` |

Les messages (`type: "message"`) ouvrent déjà la conversation ; la prise en charge par un coach et les annonces
admin (`announcement` sans `nx_type`) ouvrent l'accueil, inchangé.

## La cloche

Chaque élément mis en file crée sa notification **au moment de la mise en file** (donc aussi pendant les heures
calmes, avec une préférence coupée ou sans appareil). Un groupe garde UNE notification, réécrite au texte du push
groupé et remise à non lue. Textes = ceux du push (aucune cote, grade, recruteur ni cégep).

| Genre | Notification |
|---|---|
| BADGE_COACH | `COACH_DISTINCTION_ADDED` (type existant, jamais écrit jusqu'ici) |
| EVALUATION_COACH | création : `COACH_EVALUATION_UPDATED` ; mise à jour : la ligne existante de `notify_athlete_evaluation_updated` (pas de doublon) |
| BADGE_PARTENAIRE | `PARTENAIRE_BADGE` (nouveau) |
| EVALUATION_PARTENAIRE | `PARTENAIRE_EVALUATION_RECUE` (nouveau) |
| CARTE_PARTENAIRE | `PARTENAIRE_EVALUATION` (déjà là) |

Avant A5, seule la carte partenaire avait sa ligne : badges (coach et partenaire), évaluation partenaire et
évaluation coach à la **création** n'apparaissaient pas dans la cloche.

## Client (1.4.5)

- `lib/push/pushIntent.ts` : liste blanche ; une route reçue hors liste n'est jamais suivie (déduite de `nx_type`) ;
  `nx_type` inconnu ou `type` inconnu → notifications ; écrans du jeune seulement (autre rôle → son accueil).
  Démarrage à froid : même intention (Preferences), même chemin (`postLoginDispatch`).
- `registerPush.ts` : push reçu ou touché → `notifications-updated` (compteur de la barre d'onglets, tableau de bord,
  liste des notifications qui se relit).
- `/athlete/profil/apercu?section=…` amène badges ou cote à l'écran ; `/athlete/cartes-partenaires` ouvert dans
  l'appli (avant : web seulement, registre §85) ; `/athlete/notifications?section=invitations` amène les invitations.
- Notifications dans l'appli : badge / évaluation / carte mènent au même écran que le push.

## Preuves (local, transaction annulée)

- `tests-push-a5.sql` → `tests-push-a5-resultats.txt` : **89/89** — le banc A4a entier (69) rejoué APRÈS la
  migration, plus 20 cas A5 (contenu du push, cloche pour chaque élément y compris ceux qui ne partent pas,
  regroupement, pas de doublon, fiche sans compte, carte inchangée, droits). Généré par `assembler-banc.py`.
- `essai-rollback-a5.sql` → `essai-rollback-resultats.txt` : les 10 fonctions `push*` reviennent identiques à A4a
  (corps + droits) ; la contrainte revient en `NOT VALID` (les notifications déjà créées restent).
- Client : `node --experimental-strip-types --import ./lib/evaluations/__tests__/register-alias.mjs --test
  "lib/push/__tests__/*.test.ts"` → 15/15.

## Lot de prod (serveur seulement)

`prod/` — même méthode qu'A4a. `construire-lot.mjs` → `lot-prod.sql` (md5 `8725314ff5f8e0b032e13dab90568a0a`) ;
départ attendu `a356cc149bde5a47d7ba7b06af675d0e|21` (prod relevée le 2026-10-16 = local), empreinte après
`ec6969a0d28d379b47d15f91eb414ea2|22`. `preuve-locale.sh` → `preuve-locale.txt` : garde fausse → tout annulé ; envoi
en morceaux → arrêt avant écriture ; lot réel → OK ; 2ᵉ envoi refusé ; banc 89/0 sur la base issue du lot.
`verif-1.4.4/` : le client 1.4.4 ouvre l'accueil pour chacun des 5 genres (10/10). Marche à suivre :
`prod/application-prod.txt`.

## Limites connues

- Aucune invitation d'équipe n'envoie de push aujourd'hui : la route existe côté client, pas d'envoi serveur.
- L'aperçu mobile n'affiche pas encore badges et évaluations des partenaires (registre §97) : le clic mène à la
  bonne section, qui montre ce que l'aperçu affiche.
- 1.4.4 : les nouveaux types de la cloche s'affichent sans pastille ni icône, dans « Toutes » seulement.
