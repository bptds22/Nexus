# Registre — `conversations.status` est partagé : un archivage efface le fil de l'autre

> ✅ **MITIGÉ le 2026-09-14** par la migration `20260914020335_resurrection_fil_archive`
> (APPLIQUÉE en prod). Un fil archivé qui reçoit un message redevient `ACTIVE`.
> Le masquage n'est plus permanent — il redevient transitoire.
> **Le partage de la colonne demeure** : archiver masque toujours le fil chez
> l'autre partie. Le correctif de fond (archivage par participant) reste en
> 1.4.2, voir plus bas.

**Découvert le 2026-09-13**, en cherchant tout autre chose.

---

## Comment on est tombé dessus

Symptôme rapporté : *« l'athlète envoie un message, le coach intérim ne le
reçoit jamais »*. L'hypothèse de travail était la non-reconnaissance du rôle
`head_coach_interim` côté serveur. **Elle était fausse.**

Le message était en base, dans un fil dont `coach_id` désignait bien
l'intérim, et le push était parti sans échec (`sent:2, failed:0`). Le fil
portait simplement `status = 'ARCHIVE'`.

**Un seul fil est en `ARCHIVE` dans toute la production** — celui-là. C'est
pourquoi le défaut n'était jamais remonté.

---

## Le défaut

`conversations.status` est **une colonne unique par conversation, pas par
participant**. Il n'existe aucune colonne d'archivage par utilisateur :
`conversation_participants` porte `conversation_id`, `user_id`, `member_role`,
`athlete_id`, `last_read_at`, `joined_at` — jamais de statut.

Or l'athlète dispose d'une action d'archivage sur mobile :

```
components/shared/AthleteMessagesMobile.tsx:150
  const newStatus = t.status === "ARCHIVE" ? "ACTIVE" : "ARCHIVE";
components/shared/AthleteMessagesMobile.tsx:166
  Promise.all(ids.map(id => archiveMut.mutateAsync({ conversationId: id, newStatus: "ARCHIVE" })))
```

La ligne 166 est un archivage **par lot** — le geste le plus facile à
déclencher sans intention.

Et les deux côtés lisent la même colonne. `lib/messaging/threadStatus.ts`
exclut l'archive de toutes les vues sauf « Archivé » :

```
case "tous":  return t.status !== "archive";
default:      return t.status !== "archive";
```

C'est un choix assumé et correct pour un rangement personnel. Il ne l'est pas
quand le rangement est partagé.

**Conséquence : quand l'athlète archive une conversation, elle disparaît aussi
de la boîte du coach, sans que personne en soit averti.** Et réciproquement.
Rien n'est perdu — le fil reste atteignable sous le filtre « Archivé » — mais
personne ne sait où regarder, puisque rien ne signale que l'autre a rangé.

La normalisation de casse est correcte (`threadStatus.ts:25` passe en
minuscules) : `ARCHIVE` en base est bien reconnu. Le filtre fait exactement ce
qu'il annonce. Le défaut est en amont, dans le modèle.

---

## Correctif de fond — 1.4.2, derrière D6

**Archivage PAR PARTICIPANT.** Une colonne sur `conversation_participants`
(`archived_at timestamptz null`) plutôt qu'une seconde table : la ligne existe
déjà pour chaque partie, et `last_read_at` y vit déjà — l'état « ce que CE
participant a fait du fil » y a sa place.

Puis la réécriture des filtres des **quatre boîtes** :

| Surface | Fichier |
|---|---|
| Athlète mobile | `components/shared/AthleteMessagesMobile.tsx` |
| Coach web | `app/coach/demandes/page.tsx` |
| Recruteur web | `app/recruteur/messages/page.tsx` |
| Prédicat partagé | `lib/messaging/threadStatus.ts` |

✅ **CORRECTION (2026-09-14).** Une version antérieure de ce document affirmait
que `conversations.status` portait aussi `nouveau` / `reponse_recue` /
`repondu` / `envoye`. **C'est faux.** La contrainte en base ne laisse passer
que deux valeurs :

```sql
CHECK (status = ANY (ARRAY['ACTIVE'::text, 'ARCHIVE'::text]))
```

Les presets sont dérivés CÔTÉ CLIENT par `mapDbStatus` (lib/messaging/
threadStatus.ts) à partir de qui a répondu ; la colonne ne contribue que la
branche archive. **La colonne est donc purement un drapeau d'archive**, et elle
migre ENTIÈREMENT vers le participant — il n'y a rien à préserver.

Migration → **derrière le déblocage D6**, comme les volets 3, 5, 6 et la
réponse admin.

---

## Garde-fou intermédiaire — 1.4.2, SANS migration

Deux gestes côté client, indépendants de la base :

1. **Avertir à l'archivage** : dire à l'athlète que le fil sortira aussi de la
   boîte de son entraîneur. Un `toast` suffit — l'action d'annulation existe
   déjà (`AthleteMessagesMobile:157`).
2. **Retirer l'archivage par lot** de l'écran athlète (ligne 166). C'est le
   geste le plus facile à déclencher par accident, et le plus coûteux : il
   masque N fils d'un coup, chez N interlocuteurs.

Ni l'un ni l'autre ne répare le modèle. Ils réduisent la probabilité de
déclenchement en attendant qu'il le soit.

---

## Ce que ce bug N'EXPLIQUE PAS

Les deux autres symptômes de la même session ont des causes distinctes, et
aucune n'est l'archivage :

- **Pas de push chez l'athlète** — le push est parti (`sent:3, failed:1,
  removed:1`), FCM l'a accepté. Cause sur l'appareil ou jeton vivant absent de
  la base.
- **« À traiter » vide** — 0 suggestion `EN_ATTENTE` : elles sont rejetées par
  trigger dans la microseconde, note système « Édition directe (transition
  vieux client mobile) ». Conséquence assumée de
  `20260909191744_edition_directe_athlete`.

Voir `docs/registre-volet3-elargi.md` pour le tableau complet.


---

## Annexe — `conversations.unread_count` est une colonne MORTE (2026-09-14)

Découvert en cherchant pourquoi la pastille de non-lus restait éteinte.

```
fonctions qui la touchent : mark_conversation_read — et seulement SET = 0
triggers qui l'incrémentent : AUCUN
valeurs en production : 0 sur les 103 conversations
```

**Rien ne l'a jamais incrémentée.** Ce n'est pas une régression : le compteur
n'a jamais été branché. Le vrai signal de non-lu est `messages.read_at`, posé
par `mark_conversation_read` sur les messages dont on n'est pas l'expéditeur.

### Qui lisait la colonne morte

| Surface | Avant | Après |
|---|---|---|
| Badge onglet Messages, athlète | `read_at` ✅ | inchangé |
| Badge onglet Messages, coach | `read_at` ✅ | inchangé |
| Liste des fils, athlète | `read_at` ✅ | inchangé |
| **Pastille par fil, coach MOBILE** | `unread_count` ❌ | **corrigé en 1.4.1** |
| **Boîte coach WEB** (`app/coach/demandes/page.tsx:684`) | `unread_count` ❌ | **NON corrigé** |
| **Fil coach WEB** (`app/coach/demandes/[id]/PageClient.tsx:251`) | `unread_count` ❌ | **NON corrigé** |

Les deux surfaces web portent le même défaut. Elles ne sont pas dans le
binaire — elles partent au merge, pas au build Android — et n'ont donc pas été
touchées dans la passe 1.4.1. **À faire en 1.4.2**, en reprenant le même
calcul.

### Ménage à prévoir — 1.4.2, avec l'archivage par participant

- `mark_conversation_read` (fonction SQL) fait un `SET unread_count = 0` sur
  une colonne que plus personne ne lira. **Non retiré : y toucher ferait une
  migration**, et la passe 1.4.1 est côté client uniquement.
- Quatre écritures client `update({ unread_count: 0 })` subsistent
  (`CoachCoachThreadView:125`, `coach/demandes/[id]/PageClient:281`,
  `recruteur/messages/[id]/PageClient:357`,
  `lib/queries/recruiter/useMarkConversationRead:21`). Inoffensives, mais
  mortes.
- **La colonne elle-même est candidate à suppression**, dans la même migration
  que l'archivage par participant : les deux nettoient `conversations` des
  états qui n'y ont pas leur place.

### Le badge athlète est probablement SAIN

Le symptôme rapporté — « l'athlète reçoit la push mais aucune pastille » — n'a
PAS été reproduit en base. `countAthleteUnread` est correctement branché sur
`read_at`, avec une allowlist explicite incluant `ATHLETE_COACH`.

Ce que les traces montrent sur le fil de test : chaque message est marqué lu
**~20 secondes après son envoi**, et `mark_conversation_read` n'est appelée que
depuis les vues de fil (11 appelants vérifiés), jamais depuis la liste. Or
taper la push ouvre DIRECTEMENT la conversation (`type: "message"` →
`conversationId`) : la pastille n'a pas le temps d'exister.

**Hypothèse la plus probable : artefact de méthode de test, pas un bug.**
À confirmer par un test propre — faire envoyer un message et NE PAS ouvrir le
fil, ni taper la push. Si l'onglet Messages badge, le compteur athlète est
sain. Sinon, c'est un vrai défaut et il reste à creuser.
