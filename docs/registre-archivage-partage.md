# Registre — `conversations.status` est partagé : un archivage efface le fil de l'autre

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

⚠️ **`conversations.status` ne doit PAS être supprimée dans la même passe.**
Elle porte aussi `nouveau` / `reponse_recue` / `repondu` / `envoye`, qui sont
des états de FIL et restent légitimement partagés. Seul `ARCHIVE` doit migrer
vers le participant. Confondre les deux ferait perdre les presets de statut.

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
