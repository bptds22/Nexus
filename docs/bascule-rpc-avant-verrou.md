# Bascule RPC — lot d'avant-verrou

Ce qui doit être réglé **avant** de fermer le verrou RLS sur `athletes`
(retrait de la policy « recruiters can read active athletes »).

Mis à jour le 2026-08-15, après la passe preview de BP sur `6b676cf` et les
commits `50c9a59` / `131de28`.

---

## Fait — ne pas refaire

Les 14 surfaces du brief initial, plus, dans `50c9a59` :

- **`cegep/stats`** — embed amputé de `first_name`/`last_name` ; garde
  `sport_id`, qui sert au filtre client et que la RPC ne projette pas.
- **`cegep/recrues`** — embed `athletes` supprimé en entier : la RPC projette
  la totalité de ce que la page affiche.
- **`cegep/reassignation`** — embed supprimé aussi. Piège consigné :
  `coach_rating` lisait `evaluations.cote_globale` et NON
  `cote_globale_entraineur`. Deux colonnes distinctes — la bascule garde la
  même source via l'agrégat projeté, sinon la cote change de sens en silence.

---

## 1. Propager le tri-état carte absente / identité verrouillée

`recruiter_athlete_cards` filtre `AND a.status = 'ACTIF'`. Un athlète
`EN_ATTENTE`, `DESACTIVE` ou `DIPLOME` ne rend **aucune ligne**, sans erreur.
Le `card?.identity_visible ?? false` des appelants traduit cette absence en
« masqué » et affiche un cadenas Loi 25 sur un athlète public.

**Ce n'est pas un trou de sécurité.** Le défaut **sur-masque, il ne
sous-masque jamais** : échouer vers le masquage est le bon comportement quand
la question est « a-t-on le droit d'afficher ». Le `?? false` reste. Ce qui
s'ajoute, c'est la distinction de CAUSE à côté.

Patron de référence : `useConversations.ts` + `app/recruteur/messages/page.tsx`
(`6b676cf`) — champ `athleteCardMissing`, trois branches à l'affichage
(initiales / cadenas / tiret neutre).

Huit sites restants, sept fichiers :

| Fichier | Ligne |
|---|---|
| `lib/queries/recruiter/useTrendingAthletes.ts` | 57 |
| `lib/queries/recruiter/usePipelineCards.ts` | 85 |
| `lib/queries/recruiter/useThreadContext.ts` | 81 |
| `app/recruteur/messages/[id]/PageClient.tsx` | 211 |
| `app/recruteur/messages/nouveau/page.tsx` | 303, 390 |
| `components/shared/AthleteRecruiterProfileBody.tsx` | 523 |
| `components/shared/AthleteRecruiterProfileBodyMobile.tsx` | 952 |

Depuis `6b676cf`, `LockedIdentityPlaceholder` a `variant="circle"` par défaut :
un appelant distrait obtient une pastille bornée, plus un placeholder plein
écran.

---

## 2. `cegep/page.tsx` — le journal d'activité

### CORRECTION D'UNE ERREUR DE CE REGISTRE

La version précédente affirmait que cette surface était **imbasculable**,
faute de clé vers l'athlète. **C'est faux, et la mesure qui l'appuyait était
mal ciblée** : elle testait `details ? 'athlete_id'`, c'est-à-dire la présence
d'une CLÉ dans le payload JSONB, alors que `recruiter_activity_log` porte une
**colonne** `athlete_id uuid`. La colonne existait depuis le début — la policy
`Coaches read activity for their claimed athletes`, qui fait
`is_coach_of_athlete(athlete_id)`, ne pourrait pas exister sans elle.

Mesure refaite sur la colonne :

| | lignes |
|---|---|
| Total | 217 |
| `athlete_id` (colonne) renseigné | 216 |
| nom en clair dans `details` | 215 |
| **nom en clair SANS `athlete_id`** | **0** |

Zéro, sur les douze types d'action. La seule ligne sans `athlete_id`
(`LIST_CREATED`) ne porte aucun nom. **Toute ligne nommée est résoluble.**

(Comptes du 2026-08-15 sur la base cloud, qui vit : une mesure prise plus tôt
le même jour totalisait 214 lignes. C'est le ratio qui compte, pas le total —
et il est de 0 sur toutes les mesures.)

### VERDICT : fuite ACTIVE, pas dette de données

La question posée était : fuite active, ou dette derrière un redirect
all_star ? C'est la première, et la seconde branche repose sur une prémisse
qui n'existe pas.

**Il n'y a pas de redirect all_star au layout.** `app/recruteur/layout.tsx`
ne lit que `role` et `onboarding_complete` — jamais `subscriptions.tier`, ni
`is_school_admin` — et **échoue ouvert** (`if (error || !data) { setAccess("ok") }`).
Il n'existe aucun `layout.tsx` sous `cegep/`, et le middleware ne couvre que
`/partenaire/:path*`. Le seul gate est client : `FeatureGate` + `CegepGate`,
qui remplacent les enfants sans jamais monter la page. Réel, mais React.

**Et RLS ne porte aucune condition de tier.** Policies de
`recruiter_activity_log` :

| Policy | Portée |
|---|---|
| `Recruiters see their own activity` (ALL) | `recruiter_id = auth.uid()` |
| `cegep admin read activity_log` (SELECT) | `is_cegep_admin_over_recruiter(recruiter_id)` |
| `Coaches read activity for their claimed athletes` | `is_coach_of_athlete(athlete_id)` |
| `admins read/insert` | `is_admin()` |

Aucune ne mentionne le tier. Mesure sous `SET ROLE authenticated` + claims
réels :

- `nexus.recruteur@nexussports.ca` — tier **free**, `is_school_admin = true` :
  **182 lignes lisibles, 180 avec nom en clair**, couvrant 2 recruteurs.
- `nexussass.recruteur@nexussports.ca` — tier **free**, `is_school_admin = false` :
  **3 lignes lisibles, 3 avec nom en clair** (ses propres lignes).

Or pour un recruteur **free**, `recruiter_athlete_cards` met
`identity_visible` à faux sur **100 %** des athlètes (`v_tier_ok :=
get_user_tier() IN ('pro','all_star')`, ligne 15 de la RPC). Le journal
affiche donc en clair précisément les noms que la projection masque
intégralement à ce même utilisateur, sur la même session.

C'est une fuite active, lisible aujourd'hui, par deux chemins distincts —
le tableau de bord CÉGEP pour un admin d'établissement, et `/recruteur/activites`
(gaté `requiredTier="pro"`, donc fermé au free) pour ses propres lignes.

### Traitement — deux temps, dans cet ordre

1. **Bascule** (`lib/queries/recruiter/useCegepStats.ts` §7 +
   `app/recruteur/cegep/page.tsx:46-78`) : sélectionner la colonne
   `athlete_id`, résoudre par `fetchRecruiterAthleteCards`, et remplacer les
   cinq `{(d.first_name as string) || ""} {(d.last_name as string) || ""}`
   par `displayFullName(card)`. Patron 2-temps ordinaire — c'est une surface
   comme les autres, contrairement à ce que ce registre a prétendu.
   La seule ligne sans `athlete_id` n'affiche aucun nom : rien à traiter.

2. **Dette de données, ensuite** : même après la bascule, `details` garde
   `first_name`/`last_name` **au repos** sur 215 lignes, et l'écriture
   continue de les y copier. Tant que ça dure, la projection ne protège que
   le rendu, pas le stockage. Purger les deux clés du payload existant, puis
   retirer la copie à l'écriture — `athlete_id` suffit à tout reconstruire.

   L'écriture se fait par **treize fonctions** côté base, pas une, et c'est
   le vrai coût de cet item : `log_athlete_update`, `log_coach_reply`,
   `log_favorite_added`, `log_list_created`, `log_list_member_added`,
   `log_list_member_removed`, `log_list_note_added`, `log_new_athlete`,
   `log_note_added`, `log_pipeline_change`, `log_profile_view`,
   `log_review_submitted`, `log_unfavorited`. Toutes celles qui posent un
   nom sont à reprendre, sinon la purge se refait remplir derrière.

---

## 3. `app/recruteur/activites/page.tsx` — quatre lectures

| Ligne | Forme |
|---|---|
| 108 | `.from("athletes").select("id, first_name, last_name, positions!position_id(abreviation)")` |
| 196 | `athlete:athletes!athlete_id(id, first_name, last_name, …)` |
| 225 | `athletes!athlete_id(id, first_name, last_name, …)` |
| 241 | `athletes!athlete_id(id, first_name, last_name, …)` |

La 108 est déjà une résolution par lot d'IDs — la forme exacte du temps 2,
elle se remplace presque littéralement. Les trois autres sont des embeds
greffés sur une relation possédée : patron 2-temps standard.

La ligne 140 lit `details.first_name` du journal : même trou que l'item 2,
par la même porte, et il tombera avec lui.

Les lectures de `users` (l. 130) **restent** : un coach n'est pas un athlète.

Gaté `requiredTier="pro"` sans `adminBypass`, donc fermé au free.

---

## 4. `app/recruteur/listes/page.tsx`

La page est basculée (temps 2 + `displayFullName` aux l. 293 et 988). Deux
défauts résiduels, tous deux vérifiés :

- **l. 319 — le filtre client porte sur `full_name`.**
  ```ts
  available.filter(a => a.full_name.toLowerCase().includes(q) || …)
  ```
  Sous masquage `full_name` vaut « Identité réservée » : taper « identité »
  fait remonter tous les athlètes verrouillés. C'est exactement ce que le
  sélecteur de `messages/nouveau` évite **délibérément** en filtrant sur
  `firstName`/`lastName` (vides sous masquage, donc muets). Aligner sur cette
  doctrine.

- **l. 984 — `for (const card of cardMap.values())`.**
  L'itération porte sur la Map, pas sur les IDs demandés. Un membre de liste
  dont la carte manque (`status <> ACTIF`) **disparaît de sa propre liste**
  sans trace ni compte. Itérer sur `athleteIds` et décider explicitement quoi
  rendre pour une carte absente — voir l'item 1.

---

## 5. Purge des objets orphelins des buckets d'images

Ajouté le 2026-08-16, décision explicite de BP : **statu quo accepté**, pas de
refonte du staging d'upload aujourd'hui. À traiter au prochain lot de ménage.

Les uploads écrivent dans le storage **immédiatement**, alors que le chemin
n'est persisté qu'au « Enregistrer » de l'éditeur. Qui téléverse puis quitte
sans enregistrer laisse un objet que plus rien ne référence. Cas réel constaté :
l'école `eade6d14-a725-409f-a6d9-47f4770eda4a` a deux objets
(`logo.jfif`, `logo.webp`) et un `logo_path` à `NULL`.

Depuis `884294b` les chemins sont versionnés et l'objet remplacé est supprimé
après un upload réussi, donc **le flux normal ne crée plus d'orphelins**. Restent
deux sources résiduelles : les téléversements jamais enregistrés, et la
suppression volontairement non bloquante (si elle échoue, on `console.warn` et
on continue).

**Script à écrire** — lister puis supprimer les objets non référencés :

| Bucket | Références à croiser |
|---|---|
| `school-logos` | `school_page_content.logo_path` |
| `campus-photos` | `school_page_cards.image_path`, `team_page_content.hero_image_path`, `headcoach_photo_path` |

Vérifier les noms de colonnes au moment d'écrire le script plutôt que de faire
confiance à ce tableau. Prévoir un mode « liste seulement » avant toute
suppression, et une fenêtre de grâce (ne pas supprimer un objet créé dans les
dernières 24 h — il peut appartenir à une édition en cours).

---

## 6. Lectures d'`athletes` sans identité — casseront au verrou, ne fuient rien

À traiter au moment du verrou, pas avant ; aucune urgence Loi 25.

| Fichier | Ligne | Lecture |
|---|---|---|
| `lib/queries/recruiter/useCegepStats.ts` | 89 | `athletes!athlete_id(sports!sport_id(nom))` |
| `lib/queries/recruiter/useCegepStats.ts` | 127 | `athletes!athlete_id(schools!school_id(region))` |
| `app/recruteur/cegep/stats/page.tsx` | 216 | `recruiter_athlete_views` → `athletes!athlete_id(sports!sport_id(nom))` |

---

## Note transverse — le gate CÉGEP n'est pas décoratif, mais il est client

Constaté à la passe du 2026-08-15, pour éviter de le rechercher :

- Les six pages `cegep/*` sont doublement gardées (`FeatureGate … adminBypass`
  puis `CegepGate`). Les deux **remplacent** les enfants par
  `UpgradePlaceholder` — le sous-arbre ne monte pas, ses requêtes ne partent
  pas.
- Les liens de nav ne sont pas cachés : ils s'affichent cadenassés et ouvrent
  l'`UpgradeModal`.
- L'accès en free vient de `CegepGate:23` — `isSchoolAdmin || tier === "all_star"`,
  bypass inconditionnel. C'est le comportement documenté dans CLAUDE.md (accès
  Pro gratuit via le flag), pas une panne.
- Ce qui manque : toute application côté serveur. Voir l'item 2 pour le détail
  et `tier-gating-actions-audit-2026-04-18.md:89`, qui disait déjà que RLS
  n'est pas tier-aware.
