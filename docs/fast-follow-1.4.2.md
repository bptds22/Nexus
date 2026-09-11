# Fast-follow 1.4.2 — reporté depuis la recette 1.4.1

**Ouvert :** 2026-09-10, pendant la recette mobile Bloc 1 de `release/1.4.1`.
**Règle :** rien de ce qui suit n'entre dans 1.4.1. Le bundle est gelé ; ces
points ont été **délibérément** écartés, pas oubliés.

---

## 1. La chorégraphie du hero est morte — réparer ou retirer, à trancher

**Fichier :** `components/shared/AthleteRecruiterProfileBodyMobile.tsx`

Le gestionnaire de scroll écoute `window` (`useEffect`, ~`:1475-1499`) et lit
`window.scrollY`. Or **le conteneur de défilement est `<main>`**
(`overflow: hidden auto`), et les événements `scroll` d'un élément **ne
remontent pas** jusqu'à `window`.

Mesuré au CDP sur l'émulateur (fiche coach ouverte, 2026-09-10) :

```
evenements : { surWindow: 0, surMain: 10, surDocument: 0 }
window.scrollY observé : [ 0 ]              ← une seule valeur
hero transform         : matrix(1,0,0,1,0,0)  ← identité, à tout scroll
hero margin-bottom     : 0px
```

**Conséquences :**

- `setScrollY` n'est **jamais** appelé → aucun re-render lié au scroll.
- `transitionProgress` reste à 0 → le hero ne se replie **jamais**,
  `HeroCollapsed` ne s'active **jamais**, le sticky des onglets ne passe
  jamais à `top: 124`.
- Le balayage complet de la course montre que **badges et barre sticky ne se
  chevauchent à aucun moment** (à `scroll=700` : badge `[64,160]`, sticky
  `[359,407]`). La sonde verticale dans la bande du sticky ne rend que les
  boutons d'onglets.

**⚠️ Piège à ne pas retomber dedans :** « sortir `scrollY` de l'état React vers
des CSS custom properties » a été proposé puis **annulé** — ce serait un no-op,
l'état ne change jamais. Le défaut est **la cible du listener**, pas la façon
dont la valeur est stockée.

**Décision à prendre :** réparer (écouter `main`) — ce qui **réveille** une
animation de repli dormante, donc à recetter entièrement — ou retirer la
machinerie morte. **Réparer a été explicitement interdit dans 1.4.1** (BP,
2026-09-10) : on ne réveille pas une animation morte sur un train gelé.

## 2. ~~Le saut des badges en remontant~~ — **CLOS**

Corrigé en 1.4.1 par le passage du `will-change` du hero de PERMANENT à
CONDITIONNEL. **Vérifié par BP à la recette du build `fb63f1b`** : le saut au
scroll remontant ne se reproduit plus. Rien à reprendre.

La **chorégraphie morte** du point 1 reste ouverte — c'est un autre défaut,
qui n'a jamais produit ce symptôme.

## 3. `return null` devant 97 hooks

**Fichier :** `components/shared/AthleteRecruiterProfileBodyMobile.tsx:~720`

```js
export default function AthleteRecruiterProfileBodyMobile({ ... }) {
  if (viewerMode !== "recruiter") return null;   // ← AVANT tous les hooks
```

L'inverse du canon du dépôt. Les **97 hooks** qui suivent sont tous
« conditionnels » aux yeux d'eslint — c'est l'essentiel des 100 erreurs de lint
de ce fichier. Un vrai défaut latent, pas seulement du bruit.

Contourné en 1.4.1 (Lot D3) en extrayant `CoachFicheActionsMobile` plutôt que
d'ajouter un 98ᵉ hook. **Le retour anticipé lui-même n'a pas été touché** :
remanier un composant de 3 700 lignes en pleine recette n'était pas l'endroit.

## 4. Élagage des `{true && …}`

Branches conditionnelles devenues constantes après la mort du mode
Simplifié/Détaillé. À nettoyer dans le même passage que le point 3.

## 5. Migration des six surfaces à onglets vers `SegmentedTabs`

`components/shared/SegmentedTabs.tsx` a été créé en 1.4.1 (Lot D4b) comme
composant **partagé**, mais n'est branché que sur la fiche athlète mobile.

Six autres fichiers bricolent leurs propres onglets :
`CoachAthletesMobile`, `MessagesToolbar`, `RecruteurListeDetailMobile`,
`RecruteurRechercheMobile`, `app/athlete/messages/page.tsx`,
`app/recruteur/parametres/_components/NotificationsSection.tsx`.

## 6. `DetailedTag` — mort en pratique, encore référencé

`components/shared/wizard/rows.tsx:42` définit `DetailedTag`, rendu en 7
endroits du même fichier sous `{detailed && <DetailedTag />}`.

**Aucun appelant ne passe jamais `detailed`** (`grep "detailed={"` → 0
résultat). La pilule « Détaillé » ne s'affiche donc nulle part, mais sa chaîne
survit dans le bundle. En 1.4.1, seul l'**import orphelin** de
`AthleteWizardMobile.tsx:72` a été retiré — le reste est hors périmètre.

---

## 7. La branche école de la politique UPDATE est trop large

`team_coaches scoped update` s'ouvre sur :

```sql
team_id IN (select t.id from teams t
             where t.school_id IN (select u.school_id from users u
                                    where u.id = auth.uid()))
```

**Tout** utilisateur dont `users.school_id` correspond à celui de l'équipe peut
donc modifier les rôles — y compris un **assistant**, qui peut rétrograder son
propre entraîneur-chef. Aucun test de rôle, aucun test d'appartenance à
l'équipe : la seule appartenance à l'école suffit.

À resserrer (responsable de l'équipe + direction d'école + admin), en gardant
à l'esprit que c'est **cette branche** qui fait aujourd'hui fonctionner le
select de rôle pour un intérimaire — la resserrer sans corriger
`is_team_head_coach()` d'abord le casserait.

## 8. La section « Entraîneurs » du web n'est gardée par rien

`app/coach/equipes/[teamId]/PageClient.tsx` — le bloc Section A rend
`<CoachRoleLine … canEdit />` (littéralement `true`), un bouton « + Ajouter »
et un « Retirer » par ligne, **sans aucune condition de droits**. `myRole` n'y
sert qu'à un libellé (`:673`).

Conséquence : un simple assistant voit les mêmes contrôles qu'un responsable.
Le select fonctionne pour lui (cf. point 7), « Ajouter » et « Retirer »
échouent en silence sur la RLS.

Non traité en 1.4.1 : garder ces contrôles pour tout le monde est le
comportement actuel, et les restreindre retirerait des capacités à des usagers
qui les ont aujourd'hui par d'autres branches (direction d'école). À reprendre
avec le point 7, d'un seul tenant.

---

## 9. LOT MIGRATION (session D6) — `is_team_head_coach()` doit nommer REFERENT_ROLES

**À ajouter au périmètre de la session D6**, avec le dédoublonnage des
conversations et l'index unique `RECRUTEUR_COACH`.

Décision produit actée (BP, 2026-09-10) : **l'entraîneur-chef par intérim a
les pleins pouvoirs du responsable.** Écrite en toutes lettres en tête de
`lib/coach/teamRoles.ts`, au-dessus de `REFERENT_ROLES`.

État actuel en prod :

```sql
CREATE OR REPLACE FUNCTION public.is_team_head_coach(p_team uuid, p_uid uuid)
  RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
  SET row_security TO 'off' SET search_path TO 'public'
AS $$
  SELECT EXISTS (SELECT 1 FROM public.team_coaches tc
                  WHERE tc.team_id = p_team AND tc.coach_id = p_uid
                    AND tc.role = 'head_coach');     -- ← intérim omis
$$;
```

Elle garde `team_coaches scoped insert` (avec `is_director_of_team_school`) —
donc **« Ajouter un entraîneur » est refusé à un intérimaire**.

**Ce que la correction débloque :** le drapeau `canManageStaff`
(`lib/queries/coach/useCoachTeamDetail.ts`) pourra disparaître, et « Ajouter »
redeviendra visible pour un intérimaire sur l'écran équipe mobile.

**⚠️ Le ✕ « Retirer » ne sera PAS débloqué pour autant.** La politique DELETE
ne mentionne `is_team_head_coach` **nulle part** :

```
coach_id = auth.uid()  OR  is_director_of_team_school(team_id)  OR  is_admin()
```

Un entraîneur-chef **titulaire** ne peut donc pas non plus retirer un autre
entraîneur — il ne peut que se retirer lui-même. C'est peut-être voulu (seule
la direction d'école défait un staff), peut-être un oubli. **À trancher dans la
même session**, en écrivant la réponse quelle qu'elle soit.

---

## 10. Source de vérité unique du gating — chantier nommé

**Relevé 2026-09-10, pendant la recette recruteur mobile.**

Le gating par palier a **deux sources de vérité**, et la moins visible décide.

**Ce qui est déclaré et jamais lu** — `RECRUITER_FEATURES` dans
`lib/context/SubscriptionProvider.tsx`. Aucun consommateur hors du fichier
pour `search_results_limit`, `can_use_advanced_filters`, `can_use_pipeline`,
`can_see_activity_feed`.

**Ce qui décide réellement** — des `requiredTier` écrits à la main :
`<FeatureGate>` page par page (18 occurrences), plus `RecruiterSidebar` et
`MobileTabBar` item par item.

**Le désaccord est déjà à l'écran :** `free.can_use_pipeline: false` dans la
table, alors que « Mon processus » s'affiche en démo pour un compte gratuit —
et que la navigation, elle, le reverrouille (`requiredTier: "pro"`). Le lien
est bloqué, la route ne l'est pas.

**Le chantier :** faire lire la table, retirer les `requiredTier` manuels
divergents, et **statuer sur le palier Starter** — décrit dans CLAUDE.md
(9,99 $/mois, pipeline à 2 statuts) mais **absent de la taxonomie**, qui ne
connaît que `free | pro | all_star`.

**Ce qui n'est PAS à corriger**, décisions de lancement prises (BP,
2026-09-10) et écrites dans le code :

| surface | décision |
|---|---|
| Mon processus | démo Free **assumée** — levier de conversion, écritures bloquées par RLS |
| Calendrier | reste **ouvert** aux gratuits pour le lancement — **gating à trancher ici** |
| `search_results_limit` | **non appliqué** au lancement — à trancher ici |

**Le filet réel, à ne pas défaire :** `user_has_pro()` garde le `with_check`
en INSERT **et** en UPDATE sur `recruiter_pipeline`, `recruiter_lists`,
`recruiter_list_members`, `recruiter_athlete_grades`, `recruiter_favorites`,
`conversations`, `messages`, `athletes`. C'est lui qui rend la démo
lecture-seule par construction — pas le client.

---

## 11. Redirection inexpliquée `/recruteur/recherche` → `/recruteur/tableau-de-bord`

**Rencontrée 2026-09-10** en pilotant la WebView par CDP sur le build 1.4.1.

Toute navigation programmatique vers `https://localhost/recruteur/recherche/`
— `Page.navigate` comme `location.href = …` — **rebondit systématiquement**
vers `/recruteur/tableau-de-bord/`. Trois tentatives, même résultat, avec une
session recruteur valide.

L'écran de recherche s'atteint donc normalement **par l'onglet**, mais pas par
URL. Ça bloque l'inspection outillée de cet écran, et surtout : si un
**deep-link push** pointe un jour vers la recherche, il atterrira ailleurs sans
rien dire.

Piste non vérifiée : une garde de route, un `redirect()` de layout, ou le
routeur client qui réécrit au montage. **Non élucidé — à instruire.**

## 12. Barres système Android — corrigé en 1.4.1, mais la leçon est à garder

Symptôme : deux **bandes blanches**, en haut et en bas, sur une app par
ailleurs sombre.

Cause : depuis **targetSdk 35+**, `android:statusBarColor` et
`android:navigationBarColor` sont **dépréciés et ignorés** — l'edge-to-edge est
imposé et les deux barres deviennent transparentes. Ce qui transparaît alors
est le **fond de fenêtre**, que les parents AppCompat `*.Light.*` et
`*.DayNight` posent **clair**.

Correctif appliqué : `android:windowBackground` + `android:colorBackground`
déclarés à `#111317` dans `AppTheme.NoActionBar`. Les deux anciens attributs
restent pour les appareils plus anciens, où ils peignent encore.

**À vérifier au premier build iOS** : le même raisonnement ne s'applique pas,
mais l'équivalent (couleur de fond de fenêtre sous les safe areas) mérite un
contrôle avant soumission.

---

## 13. `.fixed.bottom-0` masqués par TRANSLATION — audit complet

**Relevé 2026-09-10.** La règle globale de `globals.css` remonte **tout**
`.fixed.bottom-0` / `.sticky.bottom-0` de `var(--kbd-h)` quand le clavier
s'ouvre. Une surface qui se masque par **translation en restant montée** est
donc **repoussée dans le champ visible** au lieu de rester cachée.

**34 surfaces** portent `fixed`/`sticky bottom-0`. La forme dangereuse —
`translate-y-full` **sans** garde de montage — n'en touche que **deux** :

| surface | saisie propre | clavier possible ? | état |
|---|---|---|---|
| `app/_components/mobile/MorePanel.tsx` | aucune | oui (champ de recherche) | ✅ **corrigé 1.4.1** (`nx-kbd-immobile`) |
| `components/shared/CoachAthleteThreadMobile.tsx:222` | aucune | **oui, en permanence** | 🔴 **NON corrigé** — voir ci-dessous |

**Les 32 autres sont saines** : elles se démontent à la fermeture (`open &&`,
`if (!open) return null`), ou n'ont pas de translation. Une surface démontée ne
peut pas être repoussée dans le champ.

### Le cas non corrigé, et pourquoi il est plus grave

`CoachAthleteThreadMobile` est un **fil de messagerie**. Il monte
`MessageThreadShell` avec un composer (`composerPlaceholder="Message…"`), donc
**le clavier s'ouvre à chaque fois que le coach écrit** — pas seulement quand il
cherche. Sa feuille d'actions a exactement la même forme que celle du
MorePanel :

```
fixed bottom-0 inset-x-0 z-[70] … ${sheetOpen ? "translate-y-0" : "translate-y-full"}
```

**Le correctif est le même mot** : ajouter `nx-kbd-immobile`. Non appliqué en
1.4.1 faute de GO — la consigne était de rapporter avant de toucher une
deuxième surface.

### La leçon, pour les prochaines

Un sheet sans saisie doit **soit se démonter à la fermeture, soit porter
`nx-kbd-immobile`**. La translation seule ne suffit pas à le cacher sur une
plateforme où le clavier déplace tout ce qui est collé en bas.

---

## 14. Icône Hudl — remplacer le PNG par le SVG officiel

**Swap trivial, une seule branche de `switch` à changer.**

`components/shared/PlateformeIcone.tsx` rend toutes les plateformes en SVG
inline **sauf Hudl**, qui est un `<img>` vers `public/brand/platforms/hudl.png`.

Pourquoi : le fichier officiel fourni était un **PNG** (2814 px, 40 Ko),
redimensionné à 72 px / 2,6 Ko — quatre fois l'usage 18 px, de quoi tenir les
écrans haute densité. Redessiner le triskèle de mémoire aurait produit une
rendition approximative d'une marque tierce ; ça a été écarté.

**Ce que le PNG coûte tant qu'il est là :** il ne se recolore pas (les autres
icônes héritent d'une teinte par `stroke`/`fill`), et il ajoute une requête
d'image là où le reste du jeu est inline.

**Le remplacement** : poser le SVG officiel dans la branche `case "hudl"`, sur
le modèle des autres (`fill={teinte}` ou `stroke={teinte}`), et supprimer
`public/brand/platforms/hudl.png`. Rien d'autre ne bouge — le contrat du
composant est inchangé.

---

## 15. Retrait du trigger de transition — PRÉREQUIS à respecter

`trg_suggestion_transition` (migration `20260909191744`) porte écrit :

> `⚠ TEMPORAIRE — À RETIRER AU 1.4.2, quand le parc mobile aura tourné.`

**Son retrait a DEUX prérequis, pas un.** Il intercepte les propositions des
vieux clients et les applique (ou les rejette) sur-le-champ. Le retirer alors
qu'un client écrit encore dans `athlete_suggestions` rouvre exactement le trou
de 237 propositions orphelines que la migration a bouché — en silence, puisque
rien ne lève.

| client | état |
|---|---|
| **Wizard MOBILE** (`AthleteEditWizardMobile`) | ✅ **migré en 1.4.1** — écrit en direct via `lib/athlete/champVersColonne.ts` |
| **Profil WEB** (`app/athlete/profil/page.tsx:1455`) | 🔴 **écrit encore des propositions** |
| **Parc installé** (binaires 1.2 / 1.4.0 en magasin) | 🔴 par construction — ils ne changeront pas |

**Donc :** le trigger ne peut pas partir avant que le web soit migré **ET**
que le parc installé ait tourné. Le second point est une condition de
CALENDRIER, pas de code — elle ne se coche pas en relisant le dépôt.

### Migrer le web : ce qui existe déjà

`lib/athlete/champVersColonne.ts` est utilisable tel quel — il ne dépend que
du client Supabase et d'un `athleteId`. La migration web consiste à remplacer
l'`insert` de `:1455` par `ecrireChampAthlete`, puis à retirer le vocabulaire
de proposition, comme sur mobile.

### Le mapping est prouvé par exécution (2026-09-10)

Sur le compte démo `b880e4ba-…` (majeur, sans courriel, créé pendant la
recette) : 14 colonnes écrites avec une valeur distincte chacune, vérifiées
une par une, **aucune contamination croisée**, puis état restauré à
l'identique. Les deux recherches de clé étrangère (sport par nom, position
par nom **dans le sport de l'athlète**) résolvent vers les mêmes ids que le
moteur SQL.

Les transformations non triviales, reproduites du moteur et vérifiées :
`Taille` se découpe sur l'apostrophe en `taille_pieds` / `taille_pouces`,
`Poids` perd son « lbs », `Numéro` perd son « # ».

---

## 16. LOT MIGRATION (session D6, volet 5) — l'onboarding rend l'école et le coach à l'athlète

**DDL déjà écrit et commenté : `docs/d6-volet5-perimetre-onboarding.sql`.**
Non appliqué, à reprendre tel quel dans la migration D6.

Décision produit actée (BP, 2026-09-11) : **pendant l'onboarding — tant que
`users.onboarding_complete` est faux — l'athlète peut choisir son école et son
coach. La garde `enforce_athlete_self_edit_perimeter` s'applique pleinement
après.** Le reste du périmètre n'est jamais ouvert.

**Ce que ça corrige, et pourquoi ça n'a pas été fait en 1.4.1 :** la recette du
2026-09-11 a buté sur « Échec de sauvegarde » à la finalisation d'une
inscription. Cause réelle (logs Supabase, `PATCH /rest/v1/athletes` → 400) : le
trigger posé par `20260909191744_edition_directe_athlete` refusait
`coach_id, school_id`. Deux règles vraies se contredisaient — le trigger dit
« l'école appartient à l'entraîneur », l'onboarding dit « l'athlète choisit son
école ». Il manquait la frontière.

1.4.1 a reçu le **correctif client** (`lib/athlete/perimetreProtege.ts`) : les
colonnes protégées ne partent plus si elles n'ont pas changé, donc l'athlète qui
GARDE l'école héritée finalise. Celui qui en CHANGE reste refusé jusqu'à ce
volet. Le client ne contourne pas la garde, il cesse de la réveiller pour rien.

**Six preuves par exécution sont listées en fin de DDL** — dont la vérification
que la policy `users read own` existe toujours : le SELECT d'exemption passe par
la RLS, et sa disparition ouvrirait l'exemption en permanence, en silence.

---

## 17. Annoncer l'héritage à l'inscription — et ressusciter la modale morte

**Assumé tel quel en 1.4.1** (décision BP, 2026-09-11) : la réclamation
silencieuse d'une fiche orpheline par courriel est le parcours coach → athlète
NLS, et elle reste. Ce qui est à corriger, c'est le **silence**, pas le
rattachement.

Le trigger `on_user_created_link_athlete` rattache la fiche dans la transaction
d'inscription. L'athlète arrive donc sur un wizard pré-rempli — école, sport,
position, numéro — sans qu'on lui ait dit d'où ça vient, et l'écran s'ouvre
directement à l'étape 2. Vécu en recette comme un bug ; c'est une
fonctionnalité qui ne se présente pas.

**Effet de bord à traiter dans le même lot :** `ClaimProfileModal` et la branche
`else if (user.email)` de `AthleteOnboardingMobile` (et son jumeau
`app/athlete/onboarding/page.tsx`) sont devenues **inatteignables** pour ce cas —
le trigger a posé `user_id` avant que la branche ne s'exécute, donc `existing`
n'est jamais null. Du code mort qui a l'air vivant. Deux sorties possibles :
la ressusciter (la modale nomme le coach et l'école, ce qui est exactement
l'annonce manquante), ou la supprimer au profit d'une bannière d'héritage sur
l'étape 1. À trancher en écrivant la réponse.

---

## 18. Le jumeau web de l'onboarding porte les deux mêmes défauts

`app/athlete/onboarding/page.tsx` envoie le même `athleteRecord` complet et
tombera sur le même 400 dans les mêmes conditions. Il n'a pas été touché en
1.4.1 : le protocole web-d'abord n'a pas été suivi ici parce que le chantier est
né d'une recette mobile sur branche gelée, et élargir au web aurait ouvert un
périmètre non demandé.

`lib/athlete/perimetreProtege.ts` est utilisable tel quel — il ne dépend que du
client Supabase. La migration web consiste à relever `instantaneProtege(existing)`
au chargement, puis à passer le patch dans `elaguerProtegees` avant l'`update`.
Même geste que pour `champVersColonne.ts` (§15).

`erreurLisible()` du même module est à propager partout où une erreur part vers
`console.*` dans du code qui tourne en WebView : le pont Capacitor passe ses
arguments à `String()`, donc tout objet d'erreur y devient `[object Object]`.
C'est ce qui a coûté vingt minutes le 2026-09-11 — le message réel était dans le
client, il a fallu aller le lire dans les logs Supabase.
