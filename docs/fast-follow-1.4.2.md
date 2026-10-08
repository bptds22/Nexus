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

---

## 19. LOT MIGRATION (session D6, volet 6) — l'auto-évaluation redevient une proposition

**DDL écrit et commenté : `docs/d6-volet6-suggestion-evaluation.sql`.** Non
appliqué, à reprendre tel quel dans la migration D6.

`trg_suggestion_transition` résout aujourd'hui TOUTE suggestion dans la
transaction d'insertion : champs de profil → `APPROUVEE`, **tout le reste →
`REJETEE`**. Relevé prod du 2026-09-11 : **0 ligne `EN_ATTENTE`**, et 50 refus
automatiques sur les seuls champs d'évaluation (26 « Distinctions », 24 « Cote
globale »), plus 2 traits en snake_case le 2026-09-09.

Le volet 6 ouvre une **troisième sortie** : une liste blanche explicite
(`champs_autoevaluation_athlete()`) laisse ces lignes en `EN_ATTENTE`, donc dans
la boîte du coach. Les champs de profil continuent de s'auto-approuver ; les
champs inconnus continuent d'être refusés, avec un motif qui ne parle plus
d'évaluations.

**La liste blanche porte les DEUX écritures des 14 critères** — `'Leadership'`
et `'leadership'`. Les deux existent en base selon l'âge du client (découplage
libellé/clé du lot 3). N'en prendre qu'une refuse la moitié des clients en
silence. Elle ne se dérive **pas** des libellés de grille : depuis `fd31bab`
ceux-ci dépendent de la position de l'athlète, et une liste blanche dynamique
n'est pas une liste blanche.

### ⚠️ Le volet est INDISSOCIABLE de son prérequis RLS

Politiques actuelles d'`athlete_suggestions` :

```
Athletes insert own suggestions   INSERT  WITH CHECK (auth.uid() IS NOT NULL)
Authenticated users update ...    UPDATE  USING/CHECK (auth.uid() IS NOT NULL)
```

**N'importe quel compte authentifié peut passer n'importe quelle suggestion à
`APPROUVEE`.** `apply_approved_suggestion` est `SECURITY DEFINER` +
`row_security=off` : elle écrit alors `cote_globale_entraineur` et
`evaluations.cote_globale` en contournant la RLS **et**
`enforce_athlete_self_edit_perimeter` (sous DEFINER, `current_user` n'est plus
`authenticated`, donc la garde rend `NEW` sans rien tester).

Le trou est **latent aujourd'hui par accident** : la garde d'application est
`OLD.status = 'EN_ATTENTE'`, et plus rien n'atteint cet état. **Le volet 6 le
rend exploitable** — l'athlète propose 5/5, puis approuve sa propre proposition.
Les deux gestes partent ensemble ou ne partent pas. Le DDL porte les deux, avec
le pré-vol règle 3 et 9 preuves par exécution, dont la n°3 (« l'athlète ne peut
pas approuver sa propre ligne ») sans laquelle le volet est une régression.

### Question produit à trancher AU MOMENT du volet 6 — l'athlète sans coach

`athlete_suggestions.coach_id` est renseigné depuis `athletes.coach_id` au
moment du dépôt, et la boîte du coach lit les suggestions des athlètes **qu'il
possède** (`loadCoachTaskCounts`, jointure sur `athletes.coach_id`). Un athlète
**sans coach rattaché** dépose donc dans le vide : la ligne reste `EN_ATTENTE`
pour toujours, personne ne la voit, et il attend un verdict qui ne viendra pas.
C'est le même mensonge qu'aujourd'hui, déplacé d'un cran — le refus instantané
deviendrait un silence éternel, ce qui est pire parce qu'il ne se mesure pas.

**Position par défaut, à confirmer :** l'UI de suggestion **ne s'affiche pas**
sans coach. À la place, un état vide qui dit quoi faire —
« Rejoins ton équipe pour proposer ton évaluation ». L'athlète comprend le
prérequis au lieu de découvrir l'absence de réponse.

**Alternative, à peser :** la **file d'attente** — on accepte le dépôt, la ligne
reste `EN_ATTENTE`, et elle devient visible le jour où un coach le réclame.
Séduisant (rien n'est perdu, et le rattachement récompense), mais trois choses à
régler avant de la retenir : (a) l'athlète voit-il « en attente » indéfiniment
sans explication ? (b) un coach qui réclame une fiche hérite-t-il d'un historique
de propositions qu'il n'a pas sollicité ? (c) quelle péremption — une cote
proposée il y a huit mois n'a plus de sens.

**À trancher en écrivant la réponse**, et le cas se teste : parmi les comptes
athlètes existants, plusieurs n'ont pas de `coach_id`.

---

## 20. Le flux de suggestion d'évaluation WEB est encore actif — et menti en prod

**Le retrait du 2026-09-10 était MOBILE seulement.**
`app/athlete/profil/page.tsx` porte toujours `EvaluationSuggest` — cote globale
+ 14 traits — qui insère dans `athlete_suggestions`. Chaque envoi est
auto-rejeté par le trigger de transition, en silence, avec un motif que
l'athlète reçoit en notification. Les lignes `esprit_equipe` /
`competitivite` du 2026-09-09 et les « Distinctions » du 2026-09-11 viennent
de là.

C'est exactement le mensonge retiré côté mobile, toujours vivant côté web.

**AUCUN retrait d'UI web à faire.** La surface est correcte ; c'est le trigger
qui la dément. Le volet 6 (§19) la rend vraie sans toucher une ligne de
`page.tsx` — coût côté application : **zéro**. C'est la moitié du flux qui
revit le plus tôt, parce qu'elle ne dépend d'aucun binaire expédié.

**Corollaire de séquencement :** le volet 6 ne doit pas partir en prod pendant
qu'un binaire mobile expédié (1.2 / 1.4.0 / 1.4.1) est le seul client — leurs
suggestions resteraient `EN_ATTENTE` sans qu'aucune UI athlète expédiée ne sache
l'afficher. Web d'abord, mobile en 1.4.2. Cf. la décision consignée dans
`CLAUDE.md` → « Auto-évaluation athlète → coach ».

---

## 21. Boîte coach — distinguer une auto-évaluation d'une correction de profil

**Question ouverte, à trancher dans le lot 1.4.2**, en même temps que la
restauration de l'UI mobile (§19-20).

`CoachATraiterMobile` met tout dans la même liste : « Poids : 185 lbs » et
« Cote globale : 5/5 » arrivent avec la même carte, la même densité, le même
poids visuel. Le seul signal existant est la carte de filtre « Évaluation » en
gold, qui n'est qu'un filtre — pas une distinction dans la liste.

Ce ne sont pourtant pas les mêmes gestes : corriger son poids est une
**donnée déclarative** que le coach valide d'un coup d'œil ; se mettre 5/5 en
leadership est une **demande de reconnaissance** qui appelle un jugement, et
potentiellement une conversation. Les traiter à la même vitesse, c'est garantir
que l'un des deux sera mal traité.

Pistes, non tranchées : section séparée ; accent gold sur la carte elle-même ;
affichage systématique de l'écart (« tu as 3, tu proposes 5 ») ; ou exiger un
message de l'athlète pour les seuls champs d'auto-évaluation.

---

## 22. §EBUSY — assainir l'environnement AVANT le build AAB final

**Constat BP, 2026-09-11.** Deux symptômes qui vont ensemble sur cette machine :

- **`cap sync android` échoue en EBUSY** sur `rmdir assets/public`, de façon
  récurrente. L'hypothèse « Android Studio tient le dossier » est **INFIRMÉE** :
  le 2026-09-11, `studio64` ne tournait pas et l'EBUSY est survenu quand même.
  Contournement en place : `robocopy out assets\public /E` (sans `/MIR`, qui
  emporterait `cordova.js`). Il fonctionne, mais il masque la cause.
- **Accumulation de processus `adb` zombies** — jusqu'à 6 clients simultanés
  relevés, dont des `adb logcat` de captures de recette laissées ouvertes. Un
  `adb devices` a fini par ne plus répondre du tout (28 min d'attente morte),
  puis l'émulateur est passé `offline`, puis le daemon a refusé de redémarrer
  (`protocol fault (couldn't read status): connection reset`).

**Les deux se nourrissent :** un client adb qui tient des poignées sur le
dossier de l'app, et un `cap sync` qui veut le supprimer.

**À faire avant le build AAB de release, et pas pendant :**
1. redémarrage de la machine — pas seulement des processus ;
2. un `npx cap sync android` **propre**, sans robocopy, pour vérifier que
   l'EBUSY a bien disparu (s'il persiste après reboot, la cause est ailleurs
   qu'un verrou transitoire, et ça se diagnostique à froid) ;
3. **un seul build**, sans émulateur lancé, sans capture logcat en cours.

**Règle de conduite adoptée le 2026-09-11 :** toute commande `adb` porte un
timeout explicite. Plus jamais de `adb wait-for-device` sans limite — c'est
lui qui a transformé un daemon coincé en attente silencieuse. Au-delà de
60 secondes, on interrompt et on nomme l'étape bloquée.

**Séquence de reset qui a fonctionné**, à reprendre telle quelle :
`Get-Process adb,qemu*,emulator* | Stop-Process -Force` (⚠️ tue aussi la VM),
puis `adb start-server`, puis `emulator -avd Pixel_6 -no-snapshot-load`,
puis vérifier `sys.boot_completed = 1` avant tout `install`.

---

## 23. Aligner web et iOS sur les deux règles d'évaluation du 2026-09-12

Android a été corrigé le 2026-09-12. Les deux autres clients portent encore
les mêmes défauts, et les règles sont désormais consignées en tête de
`components/shared/wizard/modeIcons.tsx`.

### a) « Proposer ne présuppose pas d'avoir été noté » — **WEB d'abord**

`app/athlete/profil/page.tsx:559` porte le prédicat identique :

```js
const isDetailedMode = !!traitRatings && TRAIT_CHAMPS.some((t) => (traitRatings[t.camel] || 0) > 0);
```

et la grille des 14 traits est gardée par `{editing && isDetailedMode && …}`
(:681). Conséquence : **un athlète jamais évalué ne peut pas proposer de note
sur un trait**, sur le web comme sur l'Android d'avant-correctif. C'est le
défaut qui a fait échouer la recette du 2026-09-12.

Le web se déploie vite (push sur `main` → Vercel), et le correctif est du même
ordre que côté mobile : retirer la garde sur le rendu de la grille, garder
`isDetailedMode` pour la seule cote (miroir de `v_is_detailed`), et vérifier
qu'un trait non noté rend « — » et non cinq étoiles vides.

### b) iOS — au prochain binaire

Le binaire 1.4 en production porte les deux défauts. Rien à faire dans
l'immédiat : il n'y a pas de canal de correctif hors nouveau build. À inclure
dans le prochain, avec la restauration du reste de la parité.

### c) L'affichage de statut

Android lit maintenant la dernière suggestion **quel que soit son statut** et
rend « ⏳ En attente / ✓ Approuvée / ✕ Refusée » + motif. Le web a déjà son
panneau « Mes suggestions » à trois onglets (:1980-2026), donc il affiche
correctement les refus ; c'est iOS qui est aveugle, avec la même pastille
EN_ATTENTE-seulement qu'Android avait.

**Attention au séquencement avec le volet 6 (§19).** Une fois le volet 6
appliqué, les propositions d'évaluation resteront `EN_ATTENTE` : les trois
clients passeront alors de « ✕ Refusée » à « ⏳ En attente » **sans un seul
changement de code**, puisqu'ils rendent le statut du serveur. C'est
exactement ce que cette forme achète — et la raison de ne plus jamais câbler
un état côté client.

---

## 24. PROGRAMME AMBASSADEUR — l'activation du badge est COUPLÉE au ship 1.4.2

**Décision BP, 2026-09-15.** Consignée ici plutôt que laissée à la mémoire de
qui aura appliqué les migrations : le backend est **déjà en production** depuis
ce jour (M1→M9, neuf migrations appliquées), et rien à l'écran ne le montre.
C'est un état intermédiaire volontaire, pas un travail inachevé.

### La règle

> **Activation du badge = jour du ship 1.4.2. Les deux ensemble.**

`public.badges` porte la ligne `ambassadeur` en **`actif = false`**. Tant que ce
booléen est faux, `badgesPourSport()` (`lib/config/badgeCatalogue.ts:209`) le
filtre et **aucun des sept pickers ne le propose** — coach web, admin, athlète,
et surtout **le binaire mobile en magasin**, qui lit ce catalogue à chaque
ouverture et que personne ne peut corriger à distance.

Le passer à `true` est un `update` d'une ligne. **Ne pas le faire avant le ship
1.4.2**, et le faire **le même jour**, pas la veille.

### Pourquoi le couplage, et pas « dès que c'est prêt »

L'UI mobile Ambassadeur entre au lot 1.4.2. Activer le badge avant que ce
binaire soit en magasin donnerait un badge que des athlètes peuvent gagner et
voir sur leur fiche, mais dont l'écran qui l'explique n'existe pas encore sur
leur téléphone. Le badge arriverait sans son mode d'emploi.

### Ce qui est DÉJÀ en production (ne pas le refaire)

- Les 4 tables `ambassadeur_*`, RLS activée, **zéro droit pour `anon`**.
- Les 5 fonctions : `ambassadeur_revendiquer`, `ambassadeur_mon_tableau`,
  `ambassadeur_basculer_badge`, `ambassadeur_admin_trancher`,
  `ambassadeur_recalculer_paliers` (+ `nexus_normaliser_nom`,
  `masquer_courriel`).
- Les extensions `fuzzystrmatch` et `unaccent` dans le schéma `extensions`.
- Le trigger `trg_ambassadeur_paliers` et le job `ambassadeur-purge-hebdo`
  (lundi 08:10 UTC).
- `athlete_notifications.type` accepte `AMBASSADEUR_PALIER_3` et `_5`.
- `athlete_badges.origine` accepte `'systeme'`, et `appliquer_badges_saisie`
  **exclut cette origine de son remplacement** — sans quoi le picker admin
  retirerait le badge au premier enregistrement.

### Le contrat solidaire à ne pas casser

`lib/queries/shared/athleteBadges.ts` verse `'systeme'` dans `autres`
(verrouillé, non éditable). **Ce fichier et la clause `ab.origine <> 'systeme'`
de `appliquer_badges_saisie` ne se séparent pas** : l'un sans l'autre perd le
badge, silencieusement, au premier enregistrement du picker. C'est le piège
payé le 2026-08-26 puis le 2026-08-27, et évité d'avance la troisième fois.

### Le lot 1.4.2 tel qu'il se dessine

UI mobile Ambassadeur · deep-link push relance · fix scroll · pastille coach
web ×2 · archivage par participant · §15 · f3.

### ⚠ AMENDEMENT DU 2026-09-16 — `actif = false` NE GARDE PLUS LE BADGE DORMANT

Ce qui précède a été écrit la veille de la migration **M10**
(`ambassadeur_badge_auto_palier5`, appliquée en production le 2026-09-16). M10
change la donne, et la règle du couplage doit se relire à sa lumière.

**Ce que M10 fait :** au palier 5, le trigger `ambassadeur_recalculer_paliers`
**pose le badge tout seul**, en `origine = 'systeme'`, dès qu'il reste une
place sur la ligne de cinq. Ligne pleine : pas de pose, et la notification du
palier invite l'athlète à libérer une place.

**Ce que `actif = false` masque, et ce qu'il ne masque pas.** Vérifié le
2026-09-16, code à l'appui :

| | |
|---|---|
| Les 7 pickers (coach, admin, athlète, **binaire mobile**) | **masqué** — `badgesPourSport()` filtre sur `b.actif` (`badgeCatalogue.ts:213`) |
| La pose automatique de M10 | **PAS masquée** — le trigger ne lit jamais `badges.actif` |
| `ambassadeur_basculer_badge()` | **PAS masquée** — `select id from badges where code='ambassadeur'`, sans clause sur `actif` |
| L'affichage sur la fiche et l'aperçu recruteur | **PAS masqué** — `badgesDepuisRaw()` ne filtre que `retire_le` |

**Conséquence, et elle est ASSUMÉE (décision BP, 2026-09-16) : un athlète qui
atteint 5 recrues confirmées AVANT le ship 1.4.2 reçoit son badge, le voit sur
sa fiche, et les recruteurs le voient aussi.** Rien ne l'en empêche, et on ne
cherche pas à l'en empêcher — un badge gagné est un badge gagné.

**Ce que devient « l'activation du jour J » :** une **annonce marketing + la
mise en magasin de l'UI mobile**, pas un interrupteur technique. Le `update`
de `badges.actif` à `true` ne fait plus qu'une chose — rouvrir le badge aux
pickers, c'est-à-dire permettre à un coach ou à un admin de l'attribuer à la
main. Ce n'est plus lui qui décide si le badge existe pour les athlètes.

La règle du §24 reste donc utile, mais pour une autre raison qu'annoncée : ne
pas ouvrir l'attribution manuelle avant que l'écran qui l'explique soit en
magasin. Le badge, lui, est déjà vivant.

---

## 25. Les 20 recruteurs non vérifiés — REVUE FONDATEUR, clos sans code

**Décision BP, 2026-09-15. Ce point est CLOS : il ne donne lieu à aucun
développement.**

### Le constat, pour mémoire

`trg_check_recruiter_domain` (actif sur `public.users`) écrit une ligne
`admin_notifications` de type `RECRUITER_VERIFICATION` à chaque inscription de
recruteur dont le domaine n'est pas dans `cegep_email_domains` — et **ne bloque
rien** : `RETURN NEW` dans tous les cas. La « vérification manuelle requise »
n'est donc pas une porte, c'est une note.

Mesuré le 2026-09-15 : **35 lignes, toutes non lues**, du 2026-05-26 au
2026-09-02 ; 24 pointent un compte supprimé (`related_user_id` n'a aucune FK).
Côté population : **21 recruteurs ACTIF, dont 20 sur un domaine non reconnu**.

Aucune de ces 35 lignes n'est une demande d'accès Loi 25 ni un transfert —
contrairement à ce qu'un premier diagnostic avait supposé en lisant le code
sans regarder le contenu.

### La décision

Les 20 comptes sont **revus à la main par BP** (revue fondateur). Le
mini-chantier `admin_notifications` — policy `is_admin()`, écran de lecture,
FK sur `related_user_id` — **n'est pas ouvert**.

### Ce qui reste vrai et qu'il faudra savoir si le sujet rouvre

`public.admin_notifications` est **écrite par trois chemins** (le trigger
ci-dessus, `ConfidentialiteSection.tsx:37`, `TransfertSection.tsx:113`) et
**lue par aucun écran**. En prod, RLS activée + zéro policy : même un écran
admin ne pourrait pas la lire sous `authenticated`. Le trigger continue de la
remplir. Si un jour quelque chose de conséquent doit y atterrir — une demande
Loi 25, par exemple — **il faudra ouvrir la boîte avant d'y écrire**.

C'est d'ailleurs pour cette raison que la trace du palier 10 ambassadeur
(§24) ne repose PAS dessus : ce qui tient la promesse faite à l'athlète est le
marqueur « À faire » de `/admin/ambassadeurs`, qui lit `ambassadeur_paliers`.

---

## 26. Environnement de test local Ambassadeur — laissé en place, clos

**Décision BP, 2026-09-15.** Aucun nettoyage requis.

Restent volontairement en vie sur la machine de BP :
- le serveur Next de test sur **3007**, branché sur le **Docker local** par des
  variables de shell (`.env.local.docker`), `.env.local` non modifié ;
- les fixtures **`@demo.local`** de la base locale (9 athlètes, une école et
  une équipe de démo, une identité de service) ;
- la pile Docker Supabase.

Ces fixtures sont **locales et jetables**. Elles ne touchent pas le cloud.
Les scripts qui les posent et les retirent sont au dépôt :
`scripts/seed-demo-ambassadeur.sql` et `scripts/recette-ambassadeur.sql` — ce
dernier est **étanche** (il ne touche que ses propres lignes `@recette.local`)
et peut donc tourner à côté du jeu de démo sans l'effacer.

---

## 27. « Confirm email » reste OFF — l'item #34 de l'audit est CLOS, pas reporté

**Décision produit BP, 2026-09-16.** La confirmation de courriel à
l'inscription **ne sera pas activée**. Ce n'est pas un report, pas une dette
en attente de fenêtre : c'est un arbitrage assumé. Toute note antérieure
présentant l'item **#34** de l'audit sécurité comme une dette « HAUTE » est
**périmée** — l'item est clos par cette décision.

Conséquence directe, et elle est visible en base : GoTrue auto-confirme.
Relevé du 2026-09-16 sur `auth.users`, 45 derniers jours :

```
comptes_recents                   : 203
jamais_confirmes                  : 0
confirmes_instantanement (< 2 s)  : 203
confirmes_plus_tard               : 0
```

**Le SMTP est DÉJÀ branché — et le goulot n'était pas là.** Vérifié au
dashboard le 2026-09-16 : *Enable Custom SMTP* est actif depuis ~juillet 2026,
sur `smtp.resend.com:465`, username `resend`, expéditeur `info@nexussports.ca`.
Les courriels d'auth ne sont donc pas partis par le SMTP intégré depuis des
mois.

Ce qui plafonnait réellement était **le limiteur de Supabase, pas celui de
Resend** : `Auth → Rate Limits → Emails sent per hour` était resté à son
défaut de **30/h**, indépendant de la capacité du transporteur. **Relevé à
80/h le 2026-09-16.** La leçon vaut au-delà de ce cas : brancher un SMTP
performant ne sert à rien tant que le limiteur en amont n'est pas relevé — le
plafond effectif est le **minimum des deux**, et seul celui de Supabase est
silencieux.

⚠ Toute note antérieure de ce registre ou d'un rapport de session présentant
le branchement Resend comme « à faire » est **périmée**. L'ancienne rédaction
de ce paragraphe en faisait partie.

### Le filet `identities` reste en place — inerte, et correct

Les fixes posés le 2026-09-16 sur `/claim` et `/parent/claim` détectent le cas
« compte déjà existant » par **deux chemins**, parce que GoTrue en rend deux
selon ce réglage (JSDoc de `signUp`, `@supabase/auth-js`) :

| réglage | ce que rend `signUp` | chemin qui sert |
|---|---|---|
| Confirm email **OFF** — aujourd'hui | erreur `user_already_exists` | le chemin d'erreur |
| Confirm email **ON** | user obfusqué, `identities` vide | le test `identities` |

Le second est **mort tant que la décision tient**. Il reste au code
délibérément : il ne coûte rien, il documente le comportement réel de GoTrue,
et il évite qu'une réactivation future — la décision peut changer, les
décisions changent — rouvre en silence un trou où l'athlète voit un message
neutre suivi d'une redirection vers l'onboarding d'un compte qui n'est pas le
sien. **Ne pas le retirer en croyant nettoyer du code mort.**

### La page `/auth/verification-email` n'a jamais eu d'appelant

Constat du balayage du 2026-09-16, à ne pas confondre avec une conséquence de
la décision : cette page est orpheline **depuis sa création**. Aucun
`router.push`, aucun lien, aucun `emailRedirectTo` ne l'a jamais visée — le
seul commit qui mentionne sa route (`d5073cb`) ne fait qu'ajouter une ligne
d'inventaire dans `docs/audits/mobile-scope-inventory.md`. Les six surfaces
d'inscription redirigent toutes directement vers l'onboarding ou le tableau de
bord.

Son sort est traité à part ; la décision ci-dessus ne fait que retirer la
dernière raison hypothétique de la garder.

---

## 28. Lot 2a pipeline — l'indicateur « contactés » du tableau de bord coach MOBILE tombe à 0

**Décision BP, 2026-09-17 — régression acceptée jusqu'au lot mobile.**

**Contexte.** Le Lot 2a des frontières du pipeline
(`docs/pipeline-recruteur-frontieres.md`) rend `next_action_note`, `visit_at`
et `flagged` privés au recruteur. La RLS filtrant des lignes et non des
colonnes, le coach ne lit plus `recruiter_pipeline` en direct : il passe par la
RPC `coach_pipeline_for_my_athletes` (athlete_id, recruiter_id, stage,
updated_at). Les écrans coach **web** ont basculé. La policy
`coaches read pipeline for own athletes` est retirée dans un second geste,
**après** le déploiement du web.

**Ce qui casse, et seulement ça.**
`components/shared/CoachDashboardMobile.tsx:621` compte encore les dossiers au
stade CONTACTE par lecture directe :

```ts
supabase.from("recruiter_pipeline")
  .select("id", { count: "exact", head: true })
  .eq("stage", "CONTACTE")
  .in("athlete_id", coachAthleteIds)
```

Une fois la policy retirée, la RLS ne lui rend plus aucune ligne : **l'indicateur
affiche 0**, sans erreur ni plantage, dans **tous les binaires coach publiés** et
dans tout build mobile qui n'aurait pas basculé. Aucune autre surface mobile coach
ne lit le pipeline.

**À faire au lot mobile (1 appel, même forme que le web) :**

```ts
const { data } = await supabase.rpc("coach_pipeline_for_my_athletes", {
  p_athlete_ids: coachAthleteIds,
  p_stages: ["CONTACTE"],
});
const count = (data ?? []).length;
```

Référence web identique : `app/coach/tableau-de-bord/page.tsx` (bannière 1).

**Hors de cette entrée — le Lot 2b**, reporté lui aussi au lot mobile :
déplacement physique des trois colonnes privées vers une table propriétaire
seul, avec trigger d'interception pour les binaires qui les écrivent encore.
Le Lot 2a suffit à la garantie « ni le coach ni l'admin cégep, même par
l'API » ; le 2b est une défense en profondeur.

---

## 29. Environnement local — trois défauts relevés le 2026-09-18, NON corrigés

Relevés en préparant le lot 1 de la veille RSEQ secondaire. **Consignés sur
décision BP, pas corrigés** : aucun ne concerne la veille, et chacun mérite son
propre geste. Ils survivront à ce chantier.

### 29.1 `20260909202525_calc_cote_globale_commentaire.sql` est CASSÉ dans le dépôt

Le `COMMENT ON FUNCTION public.calc_cote_globale() IS` est sur une ligne
**commentée** (`--   \`COMMENT ON …`), puis la chaîne `'Cote globale : …';` suit
sur la ligne d'après, **orpheline** :

```
psql: ERROR:  syntax error at or near "'Cote globale : moyenne des critères notés. …"
```

La prod n'est pas touchée : le commentaire y est posé (appliqué par MCP le
2026-09-09). Mais **le prochain `supabase db reset` s'arrêtera sur ce fichier.**
Correction : décommenter la ligne `COMMENT ON` (le texte exact est celui de la
prod, `obj_description('public.calc_cote_globale()'::regprocedure)`).
En local, le 2026-09-18, le commentaire a été posé à la main depuis le texte
prod et la version inscrite dans `schema_migrations` — le fichier, lui, est
resté tel quel.

### 29.2 Ports Docker 54321 / 54322 injoignables — RÉGLÉ le 2026-09-18

**Cause réelle : Windows, pas Docker.** WinNAT (Hyper-V / WSL) avait réservé
la plage **54291–54390**, qui englobe 54321–54327. Diagnostic :

```powershell
netsh interface ipv4 show excludedportrange protocol=tcp
```

Symptôme au démarrage d'un conteneur : `bind: An attempt was made to access a
socket in a way forbidden by its access permissions`. Tant que les conteneurs
étaient relancés par leur politique de redémarrage, l'erreur restait
invisible — ils tournaient simplement sans ports publiés
(`NetworkSettings.Ports` vide). Ni redémarrer Docker Desktop, ni
`wsl --shutdown` n'y font rien.

**Remède (admin requis)** : `net stop winnat` puis `net start winnat` dans un
PowerShell élevé — les plages dynamiques disparaissent. Depuis une session non
élevée : `Start-Process powershell -Verb RunAs -ArgumentList '-NoProfile','-Command','net stop winnat; net start winnat'`
(invite UAC). Puis `docker start` des conteneurs `*_Nexus`. Les plages
pouvant être re-tirées au redémarrage de Windows, le défaut peut revenir.

Constat d'origine, conservé :

Les conteneurs sont `healthy`, `docker inspect` montre bien la liaison
`5432/tcp → 54322`, mais rien n'écoute côté hôte (`Test-NetConnection` échoue
sur 54321, 54322, 54323 ; `supabase migration list --local` →
`ECONNREFUSED 127.0.0.1:54322`). Un `docker restart` de `supabase_db_Nexus` et
`supabase_kong_Nexus` n'y change rien : c'est la redirection de ports de
Docker Desktop elle-même.

Contournement en place : **tout passe par `docker exec` dans le conteneur**
(`docker cp` + `psql -f`, la règle UTF-8 du projet). Ça suffit pour le SQL.
**Ça ne suffit pas pour servir une edge function en local**
(`supabase functions serve` a besoin de Kong sur 54321) — donc bloquant pour le
lot 4 de la veille RSEQ s'il n'est pas réglé d'ici là. Piste : redémarrer
Docker Desktop entièrement (ou WSL : `wsl --shutdown`), pas seulement les
conteneurs.

### 29.3 La base locale est dans un état MIXTE — objets présents, historique absent

`supabase_migrations.schema_migrations` s'arrêtait au **20260909191916**, soit
22 migrations de retard sur le dépôt. Or une partie de ces migrations était
**déjà appliquée à la main**, sans inscription :
- les tables ambassadeur (`ambassadeur_revendications`…) existent — cf. §26,
  environnement de test Ambassadeur posé le 2026-09-15 ;
- `games_source_tracabilite` (20260917203126) était entièrement présente
  (3 colonnes, contrainte, RPC au md5 identique à la prod) — ses gates ont été
  rejoués et passent ; elle a été **inscrite** le 2026-09-18.

Conséquence : `supabase migration up` rejouerait des migrations déjà passées et
échouerait (`relation "ambassadeur_revendications" already exists`). Et
`20260911200000_d6_volet1_dedoublonnage_conversations.sql` refuse **par
construction** de tourner hors prod (« conversation survivante … introuvable —
mauvais environnement ») : un `db reset` complet bute dessus aussi.

État d'inscription local au 2026-09-18, pour reprendre :
- **inscrites et appliquées** : `20260909202525` (commentaire posé à la main,
  cf. 29.1), `20260911200100_d6_volet2`, `20260914020335_resurrection_fil_archive`,
  `20260915090000_ambassadeur_notifications_types`, `20260917203126`,
  `20260918192044_rseq_veille_secondaire_lot1` ;
- **sautée, non inscrite** : `20260911200000_d6_volet1` (prod-only par design) ;
- **non appliquées, non inscrites** : les 16 autres de `20260915090100` à
  `20260917184623` (ambassadeur, recherche, télémétrie, pipeline lot 2a) —
  certaines partiellement présentes, à inventorier objet par objet.

Deux sorties possibles, à trancher : (a) inventaire + inscription manuelle des
migrations dont les objets sont présents ; (b) `db reset` complet, une fois
29.1 corrigé et 29.2 réglé, avec un contournement pour `d6_volet1`.
Divergence associée : **cinq fonctions RSEQ locales ne correspondaient pas à la
prod** (apply_standings, detect_teams, detect_familles, detect_mapping,
detect_matchs_retires) — le lot 1 les a réécrites depuis les définitions prod,
l'écart est donc résorbé pour elles, pas pour le reste de la base.

### 29.4 La base LOCALE porte un travail cron qui appelle la fonction de PROD

`cron.job` local contient `rseq-veille-hebdo` (`55 7 * * 3`, actif), rejoué
depuis `20260902210200_rseq_cron_hebdomadaire.sql` : son URL est celle de la
prod (`nrloizyemulbhujrqhgx.supabase.co/functions/v1/rseq-weekly-sync`). Chaque
mercredi où Docker tourne, la base locale appelle donc la fonction de prod.

**Sans effet aujourd'hui** : l'en-tête porte le secret du Vault LOCAL, différent
de celui de la prod → `rseq_verifie_secret` rend faux → 403. Mais c'est du bruit
dans les journaux de la fonction de prod, et c'est un fil tendu entre les deux
environnements. Toute future migration cron (dont `20260918200033`) le reproduit
si elle est rejouée en local — c'est pourquoi celle-ci ne se teste qu'en
transaction annulée.

Correction simple, locale : `select cron.unschedule('rseq-veille-hebdo');` sur la
base Docker. Plus durable : faire lire l'URL cible dans le Vault (une URL par
environnement) plutôt que de l'écrire dans la migration.

## 30. Date de naissance verrouillée — le verrou MOBILE reste à faire

**Décision BP, 2026-09-21 — option A du diagnostic consentement.**

**Ce qui est fait (web + base).** `date_naissance` entre dans
`enforce_athlete_self_edit_perimeter` (migration
`20260921173234_date_naissance_protegee_et_vues_partenaire_actif`) : libre tant
que `users.onboarding_complete` n'est pas vrai, **refusée à l'athlète ensuite**,
dans les deux sens. Coach et admin la modifient toujours. `/athlete/profil`
(web) affiche la date en lecture seule avec « Pour corriger ta date de
naissance, écris à info@nexussports.ca », et ne l'envoie plus.

**Pourquoi.** Se rajeunir après `/consentements` contournait le consentement
parental (cas réel `58c57cb7`, masqué en `EN_ATTENTE` le 2026-09-21) ; se
vieillir à 18 ans rendait l'identité d'un mineur non consentant visible des
recruteurs via `athlete_identity_ok()`.

**Ce qui reste — lot mobile.** `AthleteEditWizardMobile` écrit encore
`date_naissance` en direct (champ « DIRECT », l.92). Dans les binaires publiés :
- date **inchangée** → passe (la garde compare `IS DISTINCT FROM`) ;
- date **modifiée** → la base refuse avec « ces informations ne se modifient pas
  depuis ton profil (date_naissance). Elles sont tenues par ton entraîneur ou
  par Nexus. » — un refus clair, pas une corruption, mais un champ qui a l'air
  modifiable et ne l'est pas.

À faire au lot mobile : champ en lecture seule + le même renvoi vers
info@nexussports.ca, et retirer `date_naissance` du patch. Même traitement à
vérifier dans `AthleteParametresMobile` (lecture seule aujourd'hui, relevé
2026-09-21).

## 31. Option B — consentement parental APRÈS l'onboarding (au registre, pas commencé)

**Décision BP, 2026-09-21 : plus tard.** L'option A ferme le trou pour
l'athlète ; deux pièces restent ouvertes.

**31.1 Les écritures coach / admin.** Un coach ou l'admin qui fait passer une
date sous 18 ans (correction légitime ou non) recrée le cas `58c57cb7` : mineur,
fiche active, aucun consentement parental. Piste retenue au diagnostic : un
trigger qui, au passage sous 18 ans sans `consentement_parental`, passe la
fiche en `EN_ATTENTE` et le signale à l'admin — PAS un refus (une vraie
correction doit rester possible).

Prérequis déjà posés le 2026-09-21 : `top_athletes_view` et
`trending_athletes_view` filtrent `status = 'ACTIF'` (une fiche `EN_ATTENTE`
n'y remonte plus) ; les RPC et la RLS recruteur le faisaient déjà.

**31.2 La pièce qui manque vraiment : une voie de sortie.** Rien en base ne
repose `consentement_parental = true` après l'onboarding — `set_child_consent`
(portail parent) écrit d'autres clés (`marketing`, `image_partenaire`). Toute
fiche masquée pour défaut de consentement ne peut donc être rouverte QU'À LA
MAIN par l'admin. À construire : le parent consent au profil depuis son portail
→ `consentement_parental = true` + date, trace dans `consent_audit_trail`,
fiche remise en `ACTIF`.

Sans 31.2, 31.1 masquerait des jeunes sans chemin de retour — et `athletes.status`
n'est lu nulle part côté athlète : il ne saurait pas pourquoi plus aucun
recruteur ne le voit. Construire 31.2 AVANT ou AVEC 31.1, jamais après.

**Cas ouvert : `58c57cb7`** (16 ans, `EN_ATTENTE` depuis le 2026-09-21, aucun
parent déclaré ni lié). Sortie manuelle d'ici là : obtenir l'adresse du parent,
invitation depuis la fiche admin, consentement, puis
`update athletes set status = 'ACTIF' where id = '58c57cb7-…'` — ou correction
de la date si 2006 était la vraie, sur preuve.

## 32. Ambassadeur — l'ancien formulaire de déclaration dans l'app 1.4.2

**Décision BP, 2026-09-21 — invitation par lien ; déclaration par COURRIEL
EXACT seulement.** Migration `20260921182205_ambassadeur_invitation_par_lien`.

**Ce que la 1.4.2 publiée garde.** `/athlete/ambassadeur` n'a pas de branche
mobile : le binaire embarque l'ANCIEN formulaire (prénom, nom, courriel, école,
équipe) et ses messages (`MESSAGES`, `lib/queries/athlete/ambassadeur.ts`,
compilés dans l'app — le serveur ne peut pas les changer).

**Ce que le serveur fait pour qu'il ne mente pas.** `ambassadeur_revendiquer`
garde sa signature (contraction interdite sous un binaire publié) et ignore
prénom, nom, école et équipe. Sans courriel, il rend `introuvable` — texte
embarqué : « On ne trouve personne avec ces informations. Vérifie
l'orthographe, ou essaie avec son courriel. », ce qui est juste — et ne rend
PLUS JAMAIS `discriminant_requis` (« Ajoute son courriel, son école ou son
équipe »), qui mentirait. Un appel sans courriel ne consomme aucun essai.
`mon_tableau` garde la clé `nom` (chaîne vide) : l'app affiche
`{r.prenom} {r.nom}`.

**Ce qui part TOUT SEUL au prochain build mobile.** `/athlete/ambassadeur` est
une page PARTAGÉE (aucune branche mobile) : la version web livrée le
2026-09-22 (L4-L6, `4988646`) — bouton « Inviter mes coéquipiers »,
« Régénérer mon lien », déclaration réduite au seul courriel, « Mes recrues »
au prénom seul — sera embarquée telle quelle dans l'app au prochain build.
La cascade de partage (`lib/partage/partagerLien.ts`) essaie déjà
`@capacitor/share` en premier dans l'app. Rien à recoder.

**Ce qui reste au lot mobile — deux gestes seulement :**
1. **Vérifier sur un VRAI téléphone** (iOS et Android) que la feuille de
   partage native s'ouvre avec le bon titre, le bon texte et le lien
   `https://nexussports.ca/i/<jeton>`, qu'une annulation ne déclenche pas de
   copie, et que la copie de repli fonctionne si le partage échoue. Jamais
   testé que dans un navigateur de bureau (partage simulé).
2. **Retirer l'ancien formulaire de l'app 1.4.2** — c'est le build qui le fait :
   tant que la 1.4.2 reste en circulation, son formulaire prénom / nom / école
   / équipe et ses messages morts (`en_attente`, `discriminant_requis`,
   `saisie_incomplete`) restent en magasin. Le serveur l'empêche déjà de mentir
   (voir ci-dessus) ; la mise à jour de l'app le fait disparaître.

Le lien, lui, reste web : `https://nexussports.ca/i/<jeton>` — une recrue qui
s'inscrit DANS l'app n'est pas attribuée (pas de liens universels, décision
BP) ; il lui reste la déclaration par courriel.

---

## 33. Rattachements `school_programs.program_id` douteux (au registre, pas commencé)

**Décision BP, 2026-09-22 : plus tard.** Relevé pendant le diagnostic des
doublons de « Trouver mon cégep ». Le rail et le filtre comparent désormais
`program_id` (1.4.3) : un rattachement faux ne crée plus de doublon visible,
mais il place un cégep sous le mauvais programme — ou l'en retire.

Tout vient du seed du 2026-07-24 (`source = 'seed'` sur les 1 263 lignes,
aucune retouche d'école). Cas relevés :

- le libellé **« Sciences humaines »** pointe vers `300.A1` dans certains
  cégeps et vers `300.M1` (avec mathématiques) dans d'autres ;
- les profils de **Maisonneuve** portent `code = 200.B0` mais sont rattachés à
  `200.B1` ; sa ligne générique n'a pas de code ;
- « DEC Sciences humaines : profil **Psychologie** et relations humaines » est
  rattaché à `300.A2` « Sciences humaines gestion plus » ; « Relations et
  développement international » à `300.A4` « gestion » ;
- `cegep_programs` porte des entrées « canoniques » qui ressemblent à des noms
  maison (« Sciences humaines gestion plus », « Arts, lettres et communication
  Xtra ») — à confronter à la nomenclature officielle du Ministère.

**Avant d'y toucher :** `cegep_programs` sert aussi aux recruteurs
(« Programme offert chez nous ») et au score « Pour moi » (`programmes_vises`
→ `cegep_program_labels.program_id`). Corriger un rattachement déplace des
cégeps dans ces trois surfaces à la fois. Et l'éditeur de page école réécrit
la liste d'un bloc (`replace_school_programs`) : une correction en base peut
être défaite par la prochaine édition de l'école.

---

## 34. `log_new_athlete` triple chaque ligne `NEW_ATHLETE` (au registre, pas commencé)

Relevé le **2026-09-22** en préparant le lot 4A (bouton « tout marquer comme
lu » + nettoyage unique des non-lues du flux recruteur). **La cause du
compteur qui se resalit, à corriger avant que le nettoyage ait un sens
durable.**

Le trigger `log_new_athlete()` (AFTER INSERT sur `athletes`) fait un éventail
sans périmètre :

```sql
INSERT INTO recruiter_activity_log (recruiter_id, athlete_id, action_type, details)
SELECT DISTINCT rf.recruiter_id, NEW.id, 'NEW_ATHLETE',
       jsonb_build_object('first_name', NEW.first_name, 'last_name', NEW.last_name)
  FROM recruiter_favorites rf;     -- ← aucune clause WHERE
```

Il écrit **une ligne par recruteur ayant AU MOINS UN favori, quel qu'il
soit** — pas par recruteur concerné par cet athlète. Aucun lien de sport, de
région, de cégep ou de favori avec l'athlète créé.

**Mesuré en prod au 2026-09-22 :**

| | |
|---|---|
| Lignes `NEW_ATHLETE` | **287** sur 669 lignes du journal (43 %) |
| Lignes par athlète créé | **3, systématiquement** (3 recruteurs avaient un favori) |
| Non lues `NEW_ATHLETE` | **181** sur 250 non lues au total (**72 %**) |

Conséquences en chaîne :

1. **La pastille de la barre latérale recruteur est saturée par du doublon.**
   Les deux plus gros porteurs (112 et 70 non lues) cumulent 73 % du total et
   sont **tous deux au tier gratuit** — donc incapables de vider le compteur,
   puisque le marquage en lu n'a lieu qu'en visitant `/recruteur/activites`,
   page Pro. Le lot 4A corrige l'effacement ; il ne corrige pas la source.
2. **Le coach voyait le même événement trois fois.** La policy
   `Coaches read activity for their claimed athletes` laissait passer
   `NEW_ATHLETE` (51 lignes lisibles par 5 coachs), rendu avec le libellé
   générique de repli de l'UI. **Fermé par la liste blanche du lot 4A** —
   mais les lignes continuent d'être écrites.
3. Le facteur de multiplication **croît avec le nombre de recruteurs ayant un
   favori**. À 3 aujourd'hui ; à 30 recruteurs actifs, chaque inscription
   d'athlète écrira 30 lignes.

**À décider quand le lot s'ouvrira** (rien n'est tranché) : scoper l'éventail
(même sport ? même région ? recruteurs Pro seulement ?), ou remplacer le
journal par une lecture à la volée (« athlètes créés depuis ta dernière
visite »), qui ne stocke rien et ne peut pas se désynchroniser. Noter aussi
que `details` y recopie `first_name`/`last_name` — le même motif que le lot 4A
interdit désormais aux nouveaux journaliseurs, pour que l'affichage suive un
retrait de consentement.

## 35. Filtres client de la recherche recruteur — deux limites à connaître (au registre)

Relevé le **2026-09-23** en choisissant le chemin du lot 5 (« Me ciblent »).

**1. Le jour où la pagination revient, « Me ciblent » passe par la RPC.**
La recherche charge tout : `useAthleteSearch` appelle
`recruiter_search_athletes` avec `p_limit: null` (LIMIT ALL, aucun offset —
migration `20260812100000`). C'est ce qui rend juste un filtre **client** :
« Me ciblent » croise le jeu complet avec les ids de
`athletes_targeting_my_cegep()`, comme « Masquer favoris » le fait déjà.
Avec un LIMIT/OFFSET, ce croisement ne porterait plus que sur la page
chargée, sans erreur. Il faudra alors un paramètre dans la RPC — donc un
`DROP`/`CREATE` de `recruiter_search_athletes`, gate d'ACL par comparaison
intégrale et preuves par rôle (règle transverse du 2026-09-07) — **dans le
même lot** que la RPC d'agrégat déjà prévue pour les menus Organisation /
Ligue / Division (en-tête de `useAthleteSearch.ts`), qui ont exactement le
même défaut.

**2. Le plafond PostgREST de 1 000 lignes vaut pour TOUS les filtres client.**
`max_rows = 1000` (`supabase/config.toml` ; défaut Supabase, valeur prod non
relevée). Au-delà, la réponse de la RPC est tronquée **sans erreur** :
« Masquer favoris », « Me ciblent », les menus de taxonomie et le compte de
résultats ne porteraient que sur les 1 000 premières lignes. **121** athlètes
actifs en prod au relevé — loin du seuil, mais c'est ce seuil, et non un
changement de code, qui déclenchera le point 1.

## 36. Loi 25 — notes de recruteurs et demande d'accès d'un athlète (décision produit REPORTÉE)

Relevé le **2026-09-23** en cadrant le chantier « feuille Excel » (lot D, avis
d'équipe signés). **Décision BP du même jour : reportée, à trancher plus tard.**

**La question.** Un athlète (ou son parent) qui exerce son droit d'accès doit-il
recevoir ce que les recruteurs ont écrit sur lui ?

**Ce qui existe aujourd'hui.**
- `recruiter_notes` — notes privées, propriétaire seul (Lot 2a, 2026-09-17).
  1 ligne en prod au relevé.
- `recruiter_athlete_grades` — grade privé A+…D. 5 lignes.
- `recruiter_pipeline.next_action_note` — note de relance, privée depuis le
  2026-09-17.
- **Aucune** de ces surfaces n'est incluse dans l'export `/admin/loi25`
  (vérifié par grep : `recruiter_notes` n'apparaît que dans des migrations,
  dont la suppression de compte).

**Ce qui la rend pressante.** Le lot D1 (avis d'équipe signés,
`recruiter_team_notes`, proposé le 2026-09-23) ajouterait des jugements
**signés et partagés** sur des athlètes majoritairement mineurs (111 sur 121
ACTIF au relevé). Et le lot B (export CSV du pipeline) sortira la note privée
du recruteur de la plateforme (décision BP : oui, dans une seule case).

**À trancher avant la mise en prod de D1**, pas avant son développement :
inclusion ou non dans l'export d'accès, durée de conservation, et sort des avis
quand l'athlète supprime son compte (la cascade sur `athlete_id` les emporte
aujourd'hui pour `recruiter_notes`).

## 37. Sport du recruteur — listes mobiles à aligner sur `sports` (lot A, 2026-09-24, pour 1.4.4)

Le lot A pose `users.sport_id` (unité = cégep × sport) et le **déduit du
texte** `users.sport` par trigger (`trg_users_sport_id`) : l'app 1.4.3 continue
de fonctionner sans connaître la colonne. Mais la déduction se fait **par nom** :
un libellé absent de `public.sports` laisse `sport_id` à NULL — **sans erreur**,
et le recruteur sort de toute unité sans le savoir.

Deux listes du binaire publié posent ce problème :

| Écran 1.4.3 | Liste | Écart |
|---|---|---|
| `RecruteurProfilMobile` (profil) | 27 sports en dur | **6 n'existent pas** en base : Danse, Escrime, Gymnastique, Karaté, Softball, Tennis de table. Handball manque. Choisir l'un des six = quitter son unité. |
| `RecruiterOnboardingMobile` (inscription) | 16 sports en dur | tous en base, **mais « Autre » est proposé** : il crée une unité « cégep × Autre » qui ne regroupe personne de sens. Le sport y est déjà obligatoire (`canProceedSlide1`). |

Au web, les deux écrans lisent désormais `lib/config/sportsProposes.ts`
(22 libellés, tous vérifiés en base, ni « Autre » ni « Soccer intérieur ») et
le profil ne permet plus de vider le sport.

**À faire au lot mobile 1.4.4 :** brancher les deux écrans sur
`SPORTS_PROPOSES`, retirer l'option de vidage du profil mobile. Rien à faire en
base : le trigger absorbe déjà les deux chemins.

## 38. Tableau blanc par unité — ce que l'app 1.4.3 ne fait pas (lot B1, 2026-09-24, pour 1.4.4)

Le lot B1 rend dossiers, grades, notes, favoris et listes **communs à l'unité**
(cégep × sport ; `docs/pipeline-recruteur-frontieres.md` §0). La base est prête
et l'app 1.4.3 continue d'écrire normalement (prouvé : `recruiter_id` = soi,
unité posée par trigger, création de liste qui relit sa ligne, upsert du
processus). Mais le binaire publié **ne connaît pas l'unité**. Limites
**acceptées par BP jusqu'à la 1.4.4** (décision du 2026-09-24, question 6) :

| Geste sur mobile 1.4.3 | Ce qui se passe | Attendu en 1.4.4 |
|---|---|---|
| Retirer un favori | ne retire que **sa** ligne ; l'athlète reste favori de l'unité si un collègue l'a, **et reste dans le processus** | retirer pour l'unité, **et du processus** (confirmation au-delà de Contacté — comportement web du 2026-09-28) |
| Retirer du processus | ne supprime que **sa** ligne ; le dossier reste dans l'unité par les lignes des collègues | retirer pour l'unité (avec confirmation) |
| Changer d'étape hors VISITE_PLANIFIEE | l'ancien `persistPipelineStage` met `visit_at` à NULL ; la synchronisation **efface la visite de l'unité** | règle `regleVisite` (la visite survit au changement d'étape) |
| Voir « Mon processus », « Mes favoris », « Mes listes » | lectures filtrées `recruiter_id = soi` : **seulement ses propres lignes** (leurs étapes, grades et relances suivent toutefois l'unité par synchronisation) | lectures par unité (`unite_pipeline`, `unite_favoris`, listes de l'unité) |
| « X recruteurs intéressés » (recherche) | compte désormais **aussi les favoris des collègues de l'unité** — exact, mais nouveau pour un recruteur non admin | inchangé (c'est la bonne donnée) |

Aucun de ces écarts n'expose une donnée hors de l'unité : ce sont des gestes
**moins partagés** que le web, jamais plus.

**Notes de LISTE (`recruiter_list_notes`) — ajout du 2026-09-28 (lot C).**
Décision BP : **un seul fil de notes par joueur**, celui de `recruiter_notes`
(ou de la carte prospect). Le web n'écrit plus `recruiter_list_notes` : le
panneau de notes d'une liste lit et écrit le fil de suivi du joueur
(`FilNotesSuivi`, le même composant que Mon processus). **L'app 1.4.3, elle,
y écrit encore** (`RecruteurListeDetailMobile` → `useAddListNote`, onglet
« Notes » d'une liste). Tant que ce binaire circule, le web **affiche** ces
lignes en lecture seule dans la vue d'une liste, marquées « depuis l'app ».
Relevé prod du 2026-09-28 : **0 ligne**. En 1.4.4 : retirer l'onglet Notes de
la liste mobile (ou le brancher sur le fil du joueur), puis retirer
l'affichage web ; la table pourra être contractée après vérification qu'aucun
binaire publié ne l'écrit plus.

## 39. Retrait d'unité par un admin cégep sur un AUTRE sport — la ligne de journal va dans son unité (B2-0, à corriger à l'étape 3 de B2)

> **CORRIGÉ en base et APPLIQUÉ EN PROD le 2026-09-28** (GO BP) — migration
> `20260928172039_b2_3_unite_journal_calendrier`. Prouvé en prod sous identité
> réelle, tout annulé : l'admin `a0000000-…a1` range une ligne dans un autre
> sport de SON cégep (gardée) ; l'admin d'un autre cégep qui force cette unité
> est ramené à la sienne. Les deux retraits
> fournissent l'unité visée ; `unite_poser_journal` la garde si l'appelant y a
> accès (`acces_unite_pro`), sinon la dérive de l'acteur comme avant. Un non-admin
> ne peut donc ranger une ligne que dans son unité. Preuves locales 8/8 ; le
> rollback reproduit le défaut.

`unite_retirer_favori` et `unite_retirer_du_processus` acceptent `p_sport_id`
(un admin cégep agit sur un autre sport de son cégep). Les lignes retirées sont
bien celles de l'unité visée, mais **la ligne de journal unique** est insérée
par la fonction (SECURITY INVOKER, rôle `authenticated`) : le trigger
`unite_poser_journal` ne fait pas confiance à une unité fournie par un client
et range la ligne dans **l'unité du signataire** — celle de l'admin, pas celle
du dossier retiré.

Effet : les collègues du sport visé ne voient pas ce retrait dans leur
historique d'unité ; les collègues de l'admin le voient à tort. Aucun accès
élargi : c'est une ligne mal rangée, pas une fuite.

**À corriger à l'étape 3 de B2** (Calendrier, Tableau de bord, Mon CÉGEP —
c'est là que l'admin agit sur les autres sports) : écrire cette ligne depuis
une fonction serveur qui fournit l'unité du dossier (le trigger la garde quand
l'appelant n'est pas un client), sur le modèle de `log_pipeline_change`.
Registre de décision : BP, 2026-09-24.

## 40. Admin cégep : les dossiers d'un AUTRE sport sont en lecture seule (B2, étape 1 — à trancher à l'étape 3)

> **TRANCHÉ à l'étape 3 (décision BP 2026-09-28)** : lecture seule, **affichée**.
> Avis `AvisLectureSeule` en tête de Mon CÉGEP (tableau de bord, stats,
> recrues) et de Mon processus dès que le filtre sport n'est pas celui de
> l'admin. Pas d'écriture inter-unités.
>
> **Réassignation — décision BP 2026-09-28 : GARDÉE ouverte à tout le cégep.**
> `reassign_pipeline` (Mon CÉGEP) reste possible entre deux recruteurs de
> n'importe quel sport du cégep de l'admin : c'est un outil de gestion
> d'équipe, pas un geste du tableau blanc. La lecture seule du §40 ne s'y
> applique pas.

Le filtre sport de « Mon processus » laisse l'admin cégep **voir** les autres
sports de son cégep (décision BP, question 4 : lecture ET modification). La
modification n'est pas livrée à l'étape 1, volontairement :

- toute écriture passe par la **ligne de l'acteur** (`unite_ecrire_dossier`,
  `unite_ecrire_grade`, notes), et cette ligne naît dans **l'unité de
  l'acteur** (B1 : l'unité se pose d'après l'auteur) ;
- un admin Football qui déplacerait un dossier Basketball créerait donc un
  **second dossier, en Football**, au lieu de faire avancer le dossier
  Basketball ; une note ou un grade y seraient invisibles pour ce sport.

Ce qui est livré : ces dossiers s'ouvrent en **lecture seule** (avis dans le
panneau, champs d'écriture absents, gestes refusés avec un toast ; aucune
ligne n'est créée — prouvé en local). En « tout le cégep », un athlète suivi
par deux unités n'a qu'une carte (celle de l'unité de l'admin si elle existe).

**À trancher à l'étape 3** (Mon CÉGEP, où l'admin agit sur les autres sports),
avec le §39 : une écriture inter-unités par fonction serveur qui écrit dans le
dossier de l'unité VISÉE (ligne existante, journal signé par l'admin et rangé
dans cette unité) — et décider si un admin peut **ouvrir** un dossier dans un
sport qu'il ne recrute pas.

## 41. Notes de liste — n'importe quel recruteur pouvait écrire dans la liste d'une autre unité — ✅ APPLIQUÉ EN PROD (version `20260928143738`)

> **Appliqué le 2026-09-28** (GO BP), migration
> `20260928143738_list_notes_policy_liste`. La policy FOR ALL est remplacée
> par `list_notes_select / insert / update / delete` ; l'INSERT exige Pro et
> `liste_ouverte_a_moi(list_id)` (sa liste ou celle de son unité). Contre-
> vérifié en prod : nouvelle policy en place, ancienne retirée, ACL de la
> table identique au caractère près, fonction à `{authenticated, postgres,
> service_role}`. **Identité réelle** : un Pro d'un autre cégep est refusé
> (42501), l'auteur de la liste (témoin) accepté, tout annulé. Local : 14/14,
> rollback testé.
>
> **Reste ouvert — incohérence, pas une fuite :** la policy `unite_update`
> (B2-0) laisse un Pro de l'unité **déplacer sa propre note** vers la liste
> d'une AUTRE unité (`list_id` modifiable ; seule l'unité est figée par
> `unite_figer`). La note garde l'unité d'origine : le propriétaire de l'autre
> liste ne la lit pas (prouvé en local, N9b). **À fermer avec le retrait des
> policies propriétaire, sur GO séparé** — p. ex. figer `list_id` dans
> `unite_figer`, ou ajouter `liste_ouverte_a_moi(list_id)` au `with check` de
> `unite_update`.

*Historique — le constat d'origine :*

La policy propriétaire `Recruiters manage their own list notes` (commande ALL)
n'exige que `recruiter_id = auth.uid()` — **jamais** que la liste soit la
sienne ou celle de son unité. Avant B1, une note glissée dans la liste d'un
autre restait invisible pour lui (lectures filtrées par `recruiter_id`).
Depuis B1, `unite_poser` range la note dans l'unité **de la liste**, et
`unite_select` la rend lisible à toute cette unité.

**Prouvé en local le 2026-09-28** (script de preuves de l'étape 2, sonde
hors périmètre de l'app) : r4, Pro d'un **autre cégep**, insère une note dans
une liste de l'unité de r1/r3 → **acceptée**. Condition : connaître l'UUID de
la liste (non devinable, et exposé à la seule unité). Aucune fuite en lecture :
c'est une **injection d'écriture**.

**Correctif proposé (non appliqué)** : remplacer la policy par quatre policies
propriétaire dont l'INSERT exige aussi `user_has_pro()` et que la liste soit
lisible par l'acteur (la sienne, ou `acces_unite_pro` sur l'unité de la liste),
via une fonction `SECURITY DEFINER` (checklist, règle 4). C'est un
**remplacement de policy** : migration séparée, sur GO de BP, preuves par rôle
et rollback avant apply. L'app 1.4.3 n'écrit des notes que dans ses propres
listes : le resserrage ne casse aucun client livré.


## 42. Palette — le vert marque aussi les visites, l'ambre les relances (décision BP 2026-09-28)

**Ce qui change.** Jusqu'ici le vert `#22C55E` était tenu pour réservé aux
**messages**. Décision BP du 2026-09-28, au calendrier recruteur à trois types :
- **rouge `#E63946`** = matchs à recruter (la couleur du produit) ;
- **vert `#22C55E`** = **visites planifiées** — le vert n'est plus réservé aux
  messages ;
- **ambre `#F59E0B`** = **relances** dans le calendrier (déjà la teinte des
  étoiles et de l'étape « En discussion » ; ici, l'« à faire »).
Le **bleu `#3B82F6`** reste au badge vérifié, sans exception.

**Où c'est appliqué.** `app/recruteur/calendrier/page.tsx` (constante
`COULEUR`, pastilles de filtre, libellés de la vue mois, cartes Visite /
Relance, étiquette d'étape « Visite planifiée »). Une proposition violette pour
les visites a été écartée.

**À faire ensuite.** CLAUDE.md (section Design System) décrit encore le vert
comme « positive status, active » et les couleurs d'étape de recrutement
(VISITE = violet) : à réaligner si la palette du calendrier doit s'étendre aux
autres écrans. Tant que ce n'est pas tranché, la décision ci-dessus vaut pour
le calendrier.

## 43. Non-lus recruteur — une seule définition (bug du « 8 », 2026-09-28)

**Constat (test prod BP).** La pastille Messages affichait « 8 », le filtre
« Non lu » de la page Messages ne montrait rien. Les deux avaient tort :
- la page lisait `conversations.unread_count`, colonne **morte** (rien ne
  l'incrémente ; `mark_conversation_read` ne fait que la remettre à 0) — le
  filtre n'aurait jamais rien montré, même un vrai nouveau message ;
- le fil web du recruteur ne posait jamais `messages.read_at` (il remettait
  seulement `unread_count` à 0) : la pastille, qui compte `read_at IS NULL`,
  comptait tous les messages reçus depuis toujours. Les « 8 » de BP = 3 + 2 +
  1 + 1 + 1 messages reçus dans 5 conversations, jamais marqués lus.

**Règle unique (web, `lib/messaging/nonLusRecruteur.ts`)** : un message est non
lu s'il est reçu (`sender_id <> moi`) et `read_at IS NULL`, dans une conversation
non archivée ; on le marque lu par la RPC `mark_conversation_read`. Pastille,
compte par fil et filtre « Non lu » l'appliquent tous. Les pastilles (Messages,
Activités) se relisent à chaque geste (événement `notifications-updated`), au
retour sur l'onglet et chaque minute ; ni elles ni la liste des conversations ne
sont persistées.

**À savoir au déploiement.** Les messages déjà reçus et jamais marqués lus
(`read_at` vide) restent comptés jusqu'à l'ouverture de leur fil — c'est la
vérité de la base, pas un nouveau bug. Pour BP : ouvrir les 5 fils concernés
remet sa pastille à 0.

**Lot mobile.** La barre d'onglets (`MobileTabBar`, branche recruteur) compte
déjà `read_at IS NULL` mais sans exclure les archivées, et ne se relit qu'au
changement de page ; le fil mobile marque lu par `useMarkConversationRead`, qui
passe désormais par la RPC (tronc partagé) — effectif au prochain build mobile.
À aligner sur `nonLusRecruteur.ts` au lot mobile.

## 44. Cartes prospect — ce que l'app 1.4.3 ne montre pas (lot C, 2026-09-28, pour le lot mobile)

Les cartes prospect vivent dans cinq tables nouvelles
(`cartes_prospect*`, dont la liaison aux listes `cartes_prospect_listes`) que
l'app 1.4.3 ne lit pas. **Rien ne casse** (prouvé : ses
lectures de processus, favoris, listes, activité et `unite_pipeline` rendent
exactement la même chose avant et après la création de cartes). Mais l'app ne
les **montre** pas : Mon processus mobile, le tableau de bord et le calendrier
mobiles n'affichent que les athlètes Nexus, et une liste mobile n'affiche pas
les cartes qu'elle contient. À ajouter au lot mobile : lecture des cartes (et
de leurs liaisons de listes), marqueur par fond rouge (11 %) + légende en haut,
panneau Infos/Historique de la carte (dont « Invitation envoyée le … »),
création (équipe en deux temps, recherche sans accents, taille/poids en champ
unique avec la règle sous le champ, doublons par nom et par courriel), fil de
notes unique (`FilNotesSuivi`), pastille de relance dans le corps de la carte,
vue liste du calendrier chronologique. L'invitation automatique part de la
base (trigger) : une carte créée depuis le mobile déclenchera l'envoi sans
rien changer au binaire.

## 48. Visibilité partenaires — un consentement SÉPARÉ, opt-in, jamais déduit (décision BP 2026-09-28)

**Décision.** La visibilité auprès des partenaires média
(`athletes.partner_visibility_opt_in`, lue par `is_partner_eligible_athlete()`)
est un **consentement distinct**. Il est **opt-in** (colonne à `false` par
défaut, case **décochée** partout) et **n'est jamais déduit** d'un autre
consentement — ni du consentement parental de profil
(`consentement_parental`), ni de la visibilité recruteurs, ni de l'âge.
Un parent qui a dit oui aux recruteurs CÉGEP n'a rien dit aux médias.

Conséquence assumée : au 2026-09-28, 79 des 150 athlètes ACTIF sont visibles
des partenaires. Élargir en déduisant le consentement de profil porterait le
chiffre à ~147 — **exclu** par cette décision.

**Qui consent :**
- **mineur** → le parent (case de `ParentalBlock` / `/consentements`, clé
  `consent_parental_partner_visibility`, ou `set_child_consent('image_partenaire')`
  au portail parent) ;
- **majeur** → l'athlète lui-même, dans SA propre étape de consentement, avec
  la même explication (`PartnerVisibilityConsentCard audience="adult"`, clé
  `consent_partner_visibility`). **Jamais** la clé parentale pour un majeur.

**Trace.** GoTrue supprime les clés à `null` de `raw_user_meta_data` (rejoué
en local le 2026-09-28) : une case décochée ne laisse AUCUNE trace. L'absence
de clé ne prouve donc ni un refus ni un oubli. Seul `consent_audit_trail`
(via une RPC) fait preuve d'un choix, avec `policy_version`.

## 49. Visibilité partenaires — MOBILE (lot 1.4.4)

Branche web `feat/partenaires-consentement-majeurs` (2026-09-28) : la case est
proposée aux majeurs dans `/auth` (écran 2) et dans `/consentements`, et
`/consentements` la propose enfin aux **mineurs** inscrits par Google/Apple.
Reste au lot mobile 1.4.4 :
1. **`SignupMobile`** — ajouter la carte `audience="adult"` à l'écran 2 d'un
   athlète majeur (clé `partnerVisibility` de `buildConsentMetadata`).
2. **`AthleteOnboardingMobile`** — traduire `meta.consent_partner_visibility`
   (majeur) en `partner_visibility_opt_in = true` + `opted_in_at` = ISO du
   signup, SANS `partner_visibility_parental_consent`. Aujourd'hui, un majeur
   qui coche au signup web puis termine son onboarding dans l'app perd son
   consentement (la fiche reste à `false`).
3. `/consentements` est une route partagée : le correctif mineur/majeur
   n'atteint l'app qu'au prochain binaire.

## 50. Paramètres athlète — l'interrupteur partenaires est REFUSÉ par la base depuis le 2026-09-09

`partner_visibility_opt_in`, `…_opted_in_at` et `…_parental_consent` sont dans
`enforce_athlete_self_edit_perimeter()` (migration `20260909191744`). Or
`/athlete/parametres` (web) et `AthleteParametresMobile` les écrivent par un
`update` direct sous l'identité de l'athlète → **exception**. Donc :
- un majeur qui n'a pas coché à l'inscription ne peut plus s'inscrire ensuite ;
- **personne ne peut RETIRER** ce consentement depuis ses paramètres, alors que
  le texte affiché promet « Vous pouvez retirer ce consentement en tout temps »
  (Loi 25).

À faire (migration, GO BP) : une RPC `set_my_partner_visibility(p_granted,
p_policy_version)` SECURITY DEFINER, calquée sur `set_child_consent` — majeur :
accorde/retire ; mineur : **retire seulement** (l'accord passe par le parent) ;
écrit les 3 colonnes + `privacy_preferences` + une ligne `consent_audit_trail`
(`acting_role = 'ATHLETE'`, `policy_version`). ACL complète à vérifier après
création (règle des gates d'ACL). Puis brancher les deux écrans dessus.

**Limite connue de la branche du 2026-09-28, liée à ce §.** L'onboarding web
n'écrit l'opt-in d'un majeur qu'à l'INSERT de sa fiche. Sur une fiche
**réclamée** (orpheline semée par un coach, rattachée par
`link_athlete_on_signup`), le chemin est un UPDATE : l'écrire lèverait la garde
et ferait échouer l'étape entière. On ne l'envoie donc pas — le consentement
reste dans `privacy_preferences.consent_partner_visibility` mais la fiche reste
à `false`. La RPC ci-dessus le réglera (la rejouer depuis la trace). Même
mécanique, par lecture du code (non rejouée) : un mineur qui coche la case
parentale sur une fiche réclamée encore à `false` prend un 400.

**Statut §50 — RPC ✅ APPLIQUÉE EN PROD le 2026-09-29 (version `20260929130822`).**
Contre-vérifications prod : empreinte de la fonction identique au local, ACL
`{authenticated, postgres, service_role}`, garde de périmètre inchangée ; appels
sans écriture (bloc annulé) : coach → `not_found`, mineur qui accorde →
`parent_required`, sans `policy_version` → refus, `anon` → refusé, 0 ligne de
journal ajoutée. Branche `feat/partenaires-rpc-parametres` : migration
`20260929130822_set_my_partner_visibility` + rollback
`supabase/rollback/20260929130822_rollback_…`. `/athlete/parametres`
(web) passe par elle ; la case « J'ai reçu le consentement parental »
(auto-attestation d'un mineur) est retirée. Un mineur non inscrit voit un
verrou qui renvoie à son parent ; inscrit, il peut retirer. Les appels REFUSÉS
(sans `policy_version`, mineur qui accorde, compte sans fiche) n'écrivent rien,
journal compris ; tout appel abouti écrit une ligne, même répété.
`AthleteParametresMobile` écrit toujours en direct → refusé : lot 1.4.4.

**Onboarding web** : décocher à l'étape 1 la case parentale d'un consentement
donné au signup (ou d'une fiche déjà inscrite) appelle la RPC en retrait puis
efface la clé de metadata — la trace ne peut plus dire oui quand la fiche dit
non (cas `da26917a`). Correction de ce cas en prod :
`scripts/alignement-trace-partenaire-da26917a-prod.sql` (GO BP requis).

## 51. `set_child_consent` — ACL ouverte à `anon` et `PUBLIC` en prod (relevé 2026-09-29, non corrigé)

> **CORRIGÉ EN PROD le 2026-09-29** (GO BP, étape 3) — migration
> `20260929153755_acl_set_child_consent` : `REVOKE EXECUTE … FROM public, anon`,
> corps inchangé. ACL relevée après : `{authenticated, postgres, service_role}`
> (liste complète). Preuves locales 4/4 (anon refusé 42501 ; le parent passe ;
> un authentifié non-parent reçoit `not_parent`) ; simulation prod annulée :
> anon refusé (42501). Rollback en place (rouvre l'ACL d'avant).

`{anon, authenticated, postgres, PUBLIC, service_role}`. Sans conséquence
aujourd'hui — la fonction commence par `is_parent_of()`, un anonyme reçoit
`not_parent` — mais c'est exactement la forme que la règle des gates d'ACL
interdit. À refermer (révoquer `PUBLIC`/`anon`, gate par comparaison complète)
dans la prochaine migration qui touche la fonction.

## 52. Relance des parents — visibilité partenaires (construite 2026-09-29, rien envoyé, rien en prod)

> **EN PROD le 2026-09-29, AUCUN ENVOI** (GO BP, étape 4) — migration
> `20260929154405_relance_partenaires_parents` appliquée (contre-vérifié : 6
> fonctions `{postgres, service_role}`, 3 tables RLS sans droit anon,
> contrainte du journal élargie à `REFUSED`, cibles `partenaires_parents_v1` =
> **33** — 12 Apple, 20 Google, 1 courriel) ; secret `RELANCE_PARTENAIRES_SECRET`
> posé (empreinte vérifiée, jamais affiché) ; fonction `send-relance-partenaires`
> déployée (v1, JWT vérifié, 401 sans secret). Reste : fusion de la branche (les
> pages `/consentement-partenaires` et `/desabonnement-parent` en ligne AVANT
> tout lien), aperçu, test, puis envoi sur GO séparé avec le nombre recopié.

Branche `feat/relance-partenaires`. Procédure complète, preuves et ordre de
mise en prod : `docs/relance-partenaires.md`. Cibles : les inscrits
Google/Apple et les cas isolés (33 au relevé), **pas** les 22 inscrits par
courriel. Les deux réponses (accepter / refuser) sont journalisées — la
contrainte d'action de `consent_audit_trail` gagne `REFUSED` (élargissement
additif). **Aucun envoi sans GO séparé de BP, nombre exact recopié.**

## 53. Connexion OAuth PAR-DESSUS une session existante — atterrit sur l'ANCIEN compte (relevé 2026-09-29, amélioration)

**Constat (logs prod, 2026-09-29 13:37 UTC).** Navigateur connecté en
« Rémi Test » (`16809ad4`) ; BP lance une connexion Apple sans se déconnecter.
L'échange du code (`/auth/callback`, côté serveur) réussit pour le compte Apple
(`b79de13d`, token 200), mais dans la même seconde le serveur RAFRAÎCHIT la
session précédente (`token_refreshed` de `16809ad4`), et le navigateur continue
de charger le tableau de bord de Rémi Test. Une seconde tentative, une minute
plus tard, atterrit bien sur le compte Apple.

**Pas une régression.** Aucun commit du 2026-09-29 ne touche le chemin OAuth
(`app/auth/callback`, middleware, clients Supabase : 0 fichier modifié entre
`c1fa601` et `5dea3b4`). Par courriel, la connexion par-dessus une session
BASCULE correctement sur le nouveau compte dans les deux versions (prouvé en
local : connecté en r3, connexion r1 sans déconnexion → « Bienvenue, Robin »).
C'est donc un comportement ancien, propre au chemin OAuth avec cookie de
session préexistant.

**Amélioration à faire.** Une nouvelle connexion doit d'abord FERMER la session
en cours : sur `/auth`, avant `signInWithOAuth` (et `signInWithPassword` par
cohérence), appeler `deconnexion()` si une session existe — ou, côté
`/auth/callback`, remplacer les cookies de session existants avant
d'échanger le code. À prouver sur un déploiement de prévisualisation avec
Google et Apple (les fournisseurs ne sont pas configurés sur la pile locale).

## 54. Aiguillage des rôles figés — correctif APPLIQUÉ EN PROD, et compte d11e2688 rétabli (2026-09-29)

**Défaut (depuis `claim_signup_role`, 2026-07-13).** `needs_signup_role()`
ignorait le rôle : un PARENT créé par le claim d'invitation (ni
`role_claimed_at`, ni onboarding, ni fiche athlète) était déclaré « rôle à
choisir ». Connexion Google/Apple sur le web → `/auth/callback` l'envoyait sur
`/inscription/role` au lieu de `/parent` ; y choisir un rôle (RPC
`claim_signup_role`, ou `?role=` repris en service_role par
`maybeApplySignupRole`) ÉCRASAIT le rôle PARENT. Exposés en prod : les 44
parents (admin et partenaires : onboarding terminé, non exposés).

**Correctif.** Migration `20260929150639_roles_figes_parent_partner_admin`,
appliquée en prod le 2026-09-29 à 11 h 06 (GO BP) : les deux fonctions ouvrent
sur la liste explicite PARENT/PARTNER/ADMIN (règle 11). Contre-vérifié : ACL
= `{authenticated, postgres, service_role}` (liste complète), empreintes des
deux fonctions identiques au local, rollback en place
(`supabase/rollback/20260929150639_…`). Simulation prod annulée : le parent
`bptds17` → `needs_signup_role = false`, réclamer ATHLETE refusé (55000),
rôle toujours PARENT. Garde web jumelle dans `/auth/callback`
(`lib/auth/rolesFiges.ts`) — **active seulement après la fusion de
`fix/aiguillage-roles-figes`** : d'ici là, un `?role=` sur une connexion OAuth
peut encore écraser un parent côté serveur.

**Correction de données — `d11e2688-9e0e-455f-92de-7039c69bb592`.** Créé
PARENT le 2026-08-25 à 01:28 par le claim d'invitation (enfant `31871c83`,
16 ans) ; dix minutes plus tard, identité Google ajoutée puis rôle réclamé
ATHLETE — le défaut ci-dessus. Aucune fiche athlète à son nom, dernière
connexion le 2026-08-25.
- **Geste (GO BP, 2026-09-29 15:07 UTC)** : `role` ATHLETE → PARENT, en une
  instruction avec comparaison de la ligne entière avant/après. **Seuls
  `role` et `updated_at` (trigger automatique) ont changé** ;
  `role_claimed_at` (2026-08-25 01:38:59) laissé tel quel, aucun autre champ.
- **Motif** : rétablir le rôle attribué par le claim d'invitation, écrasé par
  un défaut d'aiguillage — pas un choix de l'utilisateur éclairé par l'écran.
- **Vérifié (simulation prod annulée)** : rôle PARENT, 1 lien,
  `needs_signup_role = false`, voit son enfant ; la répartition envoie un
  PARENT sur `/parent`.

## 56. Rapprochement carte ↔ profil — ce que l'app 1.4.3 ne montre pas (lot D, 2026-09-29, pour le lot mobile)

Les propositions vivent dans `rapprochements` / `notifications_unite`, que
l'app 1.4.3 ne lit pas : sur mobile, ni pastille, ni bandeau, ni fenêtre.
**Rien ne casse** : les triggers ajoutés sur `athletes`, `users`,
`team_athletes` et `cartes_prospect` sont SECURITY DEFINER et n'écrivent
qu'une ligne de file — prouvé sous l'identité d'un coach qui ajoute un
athlète à son équipe. À ajouter au lot mobile : lecture de
`rapprochements_unite()`, pastille, fenêtre côte à côte, refus.

Tolérance aux fautes (2026-09-30) : les critères EQUIPE_PROCHE / ECOLE_PROCHE
et l'avertissement « nom proche » de la création de carte (RPC
`athletes_nom_proche`) sont web seulement, comme le reste du lot D. Le mobile
1.4.3 ne crée pas de cartes : rien à rattraper avant le lot mobile.

**Téléphone des cartes (2026-09-30)** — web seulement, comme toute la carte
prospect : l'app 1.4.3 ne lit pas `cartes_prospect`. Limite connue : un
athlète qui AJOUTE ou CHANGE son téléphone (ou celui de son parent) n'est pas
ré-évalué sur-le-champ — comme pour le courriel, aucun déclencheur sur ces
colonnes ; il le sera au prochain événement (équipe, onboarding, identité)
ou quand la carte change.

**Lettres inversées — reporté (décision BP 2026-09-30).** La similarité de
trigrammes (seuil 0,5) retrouve une lettre ajoutée (100 %), oubliée (78 %) ou
remplacée (63 %), mais deux lettres INVERSÉES seulement une fois sur trois
(29 % sur les noms de la prod ; « Nguyen » ~ « Ngyuen » = 0,27). Piste : une
distance d'édition (fuzzystrmatch, `levenshtein ≤ 1` sur le nom normalisé) en
complément du seuil, dans `noms_proches()`. Pas maintenant.

## 57. Fusion carte → profil — ce que l'app 1.4.3 voit et ne voit pas (lot E, 2026-09-29, pour le lot mobile)

Accepter une proposition (`fusionner_carte`, web seulement) produit des objets
**ordinaires** : une ligne `recruiter_pipeline` écrite par l'acteur (les sœurs
de l'unité suivent par la synchronisation), une cote, des `recruiter_notes`
(date d'origine gardée), des `recruiter_list_members`, et UNE ligne
`recruiter_activity_log` de type **`PIPELINE_CHANGED`** — aucun type nouveau,
la contrainte du journal n'est pas touchée. **Rien ne casse sur 1.4.3** : le
dossier né d'une fusion s'affiche comme un dossier ajouté à la main, et le
fil d'activité mobile lit la ligne comme « X → étape » (il ignore
`details.fusion`).

Ce que le mobile ne montre pas : la phrase « a fusionné la carte prospect… »,
l'encadré **« Annuler la fusion »** (7 jours) et la ligne d'annulation
(`details.fusion_annulee`, lue « Processus de X mis à jour »). À ajouter au lot
mobile : `fusions_athlete()` + `annuler_fusion()` dans l'Historique du dossier.

Deux conséquences à connaître :
- **Lot D retouché par E** : un athlète déjà dans le processus de l'unité
  n'est plus exclu des propositions (sinon « dossier existant, étape la plus
  avancée » était inatteignable). E ré-enfile une fois ces athlètes.
- **Avis au parent** : une fusion qui fait avancer le dossier d'un mineur
  déclenche l'avis « Le dossier de votre enfant a progressé », comme tout
  dossier. L'annulation, elle, n'avise pas (c'est une correction) et remet le
  statut global (« Recruté à… ») d'aplomb s'il n'a pas été posé à la main.

## 58. Carte sans équipe, rattachée à l'établissement — l'app 1.4.3 (2026-09-30, pour le lot mobile)

Web seulement (protocole web-d'abord). Migration `carte_etablissement` :
`cartes_prospect.school_id`, équipe facultative quand l'établissement n'a
aucune équipe du sport de l'unité. Côté mobile, à vérifier au lot mobile :
- une carte sans équipe arrive avec `team_id` NULL — toute vue mobile qui la
  lit par `teams!team_id(...)` n'aura ni équipe ni école ; lire aussi
  `schools!school_id(...)` (voir `SELECT_CARTE`, `lib/cartes/carteProspect.ts`) ;
- le critère de rapprochement ETABLISSEMENT (niveau « même nom, même
  établissement ») est nouveau : un `switch` mobile sur `critere` sans cas par
  défaut n'affichera rien ;
- « Préciser l'équipe » (panneau Infos web) n'a pas d'équivalent mobile.

## 59. Mention neutre d'invitation écartée — l'app 1.4.3 (2026-09-30, pour le lot mobile)

Web seulement. Migration `carte_invitation_etat` : `cartes_prospect.invitation_etat`
(`ENVOYEE` / `NON_ENVOYEE`) et une ligne de journal `INVITATION_NON_ENVOYEE`,
sans acteur. À reprendre au lot mobile :
- la mention neutre n'existe pas sur mobile (texte : `MENTION_INVITATION_NON_ENVOYEE`,
  `lib/cartes/invitationEtat.ts`) ;
- un historique mobile qui signe chaque ligne par son acteur rendra celle-ci
  avec un sujet vide : elle se rend SANS sujet (voir `OngletHistoriqueCarte`).
- Limite connue (même patron que `carte_fusion_garde`) : la garde se lève par
  `set_config('nexus.invitation_carte','on',true)`, inaccessible par PostgREST
  mais pas en SQL direct.
- « Renvoyer l'invitation » est devenu un RAPPEL ENVOYÉ PAR NEXUS
  (migration `carte_rappel_invitation`) ; « Copier le texte » reste en lien
  secondaire. Web seulement : au lot mobile, le bouton appelle la même RPC
  `demander_rappel_invitation` et lit `renvois_invitation` / `dernier_renvoi_le`
  (`etatRappel`, `lib/cartes/rappelInvitation.ts`) ; la copie passe par le
  presse-papiers natif.
- Mise en prod du rappel : DÉPLOYER `send-invitation-carte` AVANT la migration.
  La nouvelle version garde le chemin `{invitation_id}` à l'identique ;
  l'inverse (migration d'abord) laisserait des demandes à l'ancienne fonction,
  qui répond 400 à `{rappel_id}` — la ligne resterait A_ENVOYER (sans dégât :
  elle cesse de bloquer après 15 minutes).

## 60. Le parent sur la carte prospect — l'app 1.4.3 (2026-09-30, pour le lot mobile)

Web seulement. Migration `carte_parent` : `cartes_prospect.parent_nom`,
`.parent_courriel` ; critère de rapprochement COURRIEL_PARENT_CARTE (niveau
« confirmée par le courriel »). À reprendre au lot mobile :
- création et fiche de carte mobiles : les deux champs n'existent pas ;
- un `switch` mobile sur `critere` sans cas par défaut n'affichera rien pour
  COURRIEL_PARENT_CARTE ;
- le tableau web n'affiche plus le Téléphone (Infos et export seulement) :
  garder la même règle sur mobile.

## 61. Cégep et sport d'un recruteur verrouillés après l'onboarding — l'app 1.4.3 (2026-10-01, pour le lot mobile)

Migration `recruteur_rattachement_verrou` : la base refuse au recruteur onboardé
tout changement de `school_id` / `sport` / `sport_id` (42501). Web : Paramètres en
lecture seule. **Mobile** : `RecruteurProfilMobile` écrit encore ces champs — un
recruteur qui les change dans l'app reçoit une erreur. Au lot mobile : mêmes champs
en lecture seule, même phrase (« Pour changer de cégep ou de sport, écris à
info@nexussports.ca »), et ne plus les renvoyer dans le payload.

## 62. Mon profil et Paramètres recruteur — ce que le web a corrigé, et que l'app 1.4.3 garde (2026-10-01, pour le lot mobile)

Le web (branche `fix/recruteur-profil-parametres`) a corrigé ce qui suit ; le mobile
garde chaque défaut. Au lot mobile, réutiliser `lib/recruteur/parametres.ts` (pur,
testé) et `lib/recruteur/exporterMesDonnees.ts` plutôt que recopier.

- **Loi 25 — `RecruteurParametresMobile.tsx` l.174-199** reconstruit
  `privacy_preferences` à partir de ses seules clés (les autres sont perdues) et
  **pose « maintenant » comme date de politique et de collecte** quand elles
  manquent (l.193-194). Remplacer par `fusionnerConsentementMarketing()` sur la
  valeur relue en base juste avant. Vérifié en prod le 2026-10-01 : 0 date
  fabriquée à ce jour (toutes les dates collent à la trace d'inscription à < 1 s),
  2 consentements marketing perdus, comptes de test Nexus seulement.
- **`RecruteurProfilMobile.tsx`** : cégep et sport encore modifiables et renvoyés
  (l.407-410) → refus 42501 de TOUT l'enregistrement (cf. §61). Lecture seule +
  `MESSAGE_CHANGEMENT_RATTACHEMENT`, payload = `payloadMonProfil()`.
- **Photo** (`RecruteurProfilMobile` l.374 et l.389) : l'erreur de l'UPDATE est
  ignorée ; un échec d'envoi Storage s'affiche brut → `messagePhoto()`.
- **Erreurs** : jamais le texte PostgREST brut → `messageErreurSauvegarde()`.
- **Cache** : `useCurrentUser` et `SubscriptionProvider` sont partagés — la relecture
  au retour sur l'onglet (web) se déclenche aussi dans la WebView au retour au
  premier plan ; à vérifier sur appareil au lot mobile, pas à recoder.
- Web seulement, sans équivalent mobile à faire : sections Recrutement et
  Notifications masquées (rien ne les lit), Transfert CÉGEP retiré, « Désactiver »
  retiré, « Exporter » branché sur l'export réel.

## 63. Flux d'agenda du recruteur Pro — web seulement (2026-10-01, pour le lot mobile)

Web (branche `feat/flux-agenda`, migration `20261001205732_flux_agenda`, APPLIQUÉE en prod le 2026-10-01) : une
adresse d'abonnement privée par recruteur Pro (`/api/agenda/<jeton>.ics`, jeton
`nxa_…` haché en sha256, régénérable/révocable), RELANCES + VISITES de l'unité,
pas de matchs. Paramètres › Agenda et bouton « S'abonner à mon agenda » du
Calendrier. Gratuit : aucun flux ; Pro perdu ou unité changée : flux vide.
Noms complets (décision BP), sauf identité non visible (Loi 25) → « Identité
réservée », comme dans l'app.

**Mobile** : rien à faire pour que le flux marche (il est servi par le web et lu
par Google/Outlook). Au lot mobile : exposer le même panneau dans
`RecruteurParametresMobile` / `RecruteurCalendrierMobile` (composant
`AbonnementAgenda`, ouverture des liens via le navigateur système). Le
`IS_CAPACITOR` du Calendrier sort AVANT l'en-tête : le bouton n'y est pas.

## 64. Lot 0 de la 1.4.4 — compatibilité et Loi 25, FAIT sur la branche `fix/mobile-lot0` (2026-10-01)

Décision BP 2026-10-01 : la 1.4.4 = lot 0 seul ; lots 1 à 6 (cadrage
`docs/cadrage-1.4.4.md`) en 1.4.5. Prouvé sur appareil simulé (Pixel 7, mode
Capacitor, base locale), avant le build de publication.

- **§61/§62 Mon profil** (`RecruteurProfilMobile`) : cégep et sport en lecture
  seule + phrase info@, hors charge utile (`payloadMonProfil`) ; erreurs
  lisibles ; photo : envoi raté et suppression vérifiés (`messagePhoto`).
- **§62 Paramètres** (`RecruteurParametresMobile`) : `privacy_preferences`
  relue puis FUSIONNÉE (`fusionnerConsentementMarketing`), aucune date inventée ;
  la bascule marketing compte enfin dans « modifié » (la retirer seule ne
  proposait jamais d'enregistrer).
- **§50 Visibilité partenaires** (`AthleteParametresMobile`) : RPC
  `set_my_partner_visibility` ; la case « Consentement parental » que le
  mineur cochait lui-même est retirée ; mineur : retrait seulement.
- **§49 Case partenaires du majeur** : écran 2 de `SignupMobile` (+ correctif :
  la valeur manquait aux dépendances du `useCallback` de soumission — elle
  partait toujours à `false`) ; `/consentements` (Google/Apple) l'avait déjà ;
  `AthleteOnboardingMobile` la traduit : INSERT à la date du signup, fiche
  réclamée par la RPC (journalisée).
- **Règle de visite** (`useUpdatePipelineStage`, feuille du processus) :
  `regleVisite` ; poser une date sur Engagé ne fait plus reculer l'étape ;
  pastille et section visite de « Visite planifiée » à « Lettre signée ».
- **§37 Sports** : `SPORTS_PROPOSES` à l'onboarding recruteur, sans « Autre ».
- **Refus d'évaluation** (`AthleteEditWizardMobile`) : affichés « Refusée »
  avec leur motif, comme le web (volet 6 en prod).
- **Export** : « Exporter mon processus — Bientôt » retiré (décision BP).

Relevés en passant, NON traités (hors lot 0) :
- `profile_completion` : la fin d'onboarding (web ET mobile) l'écrit sous
  l'identité de l'athlète, la garde de périmètre refuse (400 P0001), l'erreur
  est ignorée — la valeur n'est jamais posée. Silencieux pour l'usager.
- `RecruteurParametresMobile` garde « Désactiver mon compte » (retiré du web
  le 2026-10-01) — à aligner ou non : décision BP.

## 65. Onboarding 1.4.4 — volet 5, « Mon école n'est pas listée », sauvegarde par écran (branche `feat/onboarding-1-4-4`, 2026-10-01)

Décisions BP du 2026-10-01. **Les deux migrations sont en prod depuis le 2026-10-02** (volet 5 puis école non listée).

- **Volet 5** (`20261002130635`, APPLIQUÉ en prod le 2026-10-02) : pendant l'onboarding, `school_id` et
  `coach_id` sont ouverts à l'athlète ; tout le reste du périmètre reste fermé.
  Rebasé sur le corps PROD (md5 `e92ffb4a…`) — le DDL préparé
  `docs/d6-volet5-perimetre-onboarding.sql` est PÉRIMÉ (il effaçait la règle
  `date_naissance`). Rollback testé à l'aller-retour (md5 restitué à l'octet).
  Preuves : `scripts/d6-volet5-preuves-par-role.sql`, 13/13.
- **École non listée** (`20261002131439`, APPLIQUÉE en prod le 2026-10-02) : colonne `athletes.ecole_non_listee`
  + trigger `trg_notifier_ecole_non_listee` → `admin_notifications`. Ce qui se
  VOIT : la carte « Écoles non listées » de `/admin/dashboard`.
  Preuves : `scripts/ecole-non-listee-preuves.sql`.
- **Mobile** : la fiche est écrite à l'écran 1 (complète, consentements
  compris), puis à l'écran 2 ; la reprise renvoie à l'écran d'arrêt.
- **`profile_completion`** : l'écriture client de fin d'onboarding est retirée
  (web ET mobile) — `trg_profile_completion` la calcule déjà (cf. §64).

Limite assumée, parité web : `users.context` n'est posé qu'au submit (RPC
one-shot `set_initial_role_and_context` — la poser à l'écran 0 interdirait de
revenir changer de contexte). La reprise le DÉDUIT de la fiche : école
LIGUE_CIVILE → civil ; école scolaire ou école non listée → scolaire. Seul
l'athlète **civil sans club** retombe à l'écran 0 — pré-rempli, une tape.

**Ordre de déploiement (expand-then-contract)** : `20261002131439` AVANT le
web, et AVANT toute publication de la 1.4.4 — le client écrit
`ecole_non_listee`, une colonne absente rendrait un 400 à l'écran 1.
`20261002130635` est indépendant — appliqué en prod le 2026-10-02.

Dérive locale corrigée en passant : `admin_notifications` avait la RLS
**inactive** en local (lisible par anon/authenticated) ; active en prod, 0
policy. La migration l'active (sans effet en prod) et l'asserte.

## 66. Demande d'accès Loi 25 du recruteur — PERDUE en silence (relevé 2026-10-01, non corrigé)

`app/recruteur/parametres/_components/ConfidentialiteSection.tsx` insère la
demande dans `admin_notifications` **depuis le client**. En prod la table a la
RLS active et AUCUNE policy : l'insert est refusé, l'erreur n'est pas lue, et
l'écran affiche « Votre demande a été envoyée… 30 jours ». Aucune demande
n'arrive nulle part. C'est un droit d'accès Loi 25 : à traiter avant toute
communication publique sur la conformité. Piste : RPC `SECURITY DEFINER` qui
journalise + courriel à confidentialite@ (même patron que send-contact).

## 67. Lien de consentement parental — visibilité recruteurs (décision BP 2026-10-01 : pas maintenant)

Relevé pendant la segmentation de la relance `inscription_inachevee_v2` : un
mineur dont le parent n'a pas donné le consentement de visibilité reste
invisible des recruteurs, et aucun lien ne permet au parent de le donner
depuis le courriel. BP : « pas maintenant, note au registre ». La relance
parent v2 reste donc **informative**, sans lien de connexion.


## 69. Paquet A de la 1.4.4 — branche `feat/1-4-4-paquet-a` (2026-10-02)

Décision BP 2026-10-02 : tout entre dans la 1.4.4 ; paquet A d'abord.

- **Visibilité partenaires dès 14 ans** — migration
  `20261002172656_partenaires_consentement_14_ans` (**APPLIQUÉE en prod le 2026-10-02**,
  empreintes identiques au local, 96 éligibles avant = 96 après). Seuil 18 → 14 dans `set_my_partner_visibility`,
  `is_partner_eligible_athlete` et `emit_five_star_on_eligibility_flip`. Sous
  14 ans ou date inconnue : inchangé (retrait seulement, accord parental).
  Relevé prod : aucun 14-17 opt-in sans accord parental → personne ne devient
  visible à l'application (pré-contrôle bloquant dans la migration).
  Inscription web / mobile / `/consentements` : la case de l'athlète
  (« J'autorise… ») remplace la case parentale de l'écran parents. Paramètres
  web et mobile : interrupteur ouvert dès 14 ans.
  ✅ Tranché le 2026-10-02 (politique 2026-10-v1, ci-dessous). Était : `/confidentialite` (contenu verbatim,
  `content/legal/confidentialite.ts`) dit pour les 14-17 « L'athlète ET le
  parent doivent consentir ». Règle générale du tableau, pas la §7.5 — mais un
  lecteur peut y voir une contradiction avec le consentement seul aux
  partenaires. Non modifié.
- **Détection cégep** — `lib/athlete/detecterCegep.ts` : phrase d'aide dédiée
  sous « Mon école n'est pas listée » (web + mobile) et pastille « Cégep ? »
  dans la carte admin. Ne bloque rien. `admin_notifications` inchangée (aucun
  lecteur).
- **Mobile, renvois au web en texte simple** (Apple 3.1.1) : Gestion CÉGEP
  (une phrase au lieu de 5 liens), Abonnement (une mention en tête de section,
  plus de pied par carte), Export Loi 25 (la ligne était muette dans l'app :
  `rightChevron="none"` la rend non touchable, le toast ne partait jamais).
- **Filtre relances du tableau de bord (mobile)** : « Tout voir » ouvrait
  Mon processus sur l'onglet Identifié — les relances des autres étapes
  étaient filtrées et invisibles. L'onglet se place maintenant sur la première
  étape qui en contient. Même passe : `?athlete=` rouvrait la feuille à chaque
  rechargement des cartes.
- **Avis au parent** (complément BP du 2026-10-02) : quand un 14-17 ans active
  lui-même sa visibilité, le trigger `trg_aviser_parent_partenaires` (même
  migration) écrit `avis_parent_partenaires` et appelle
  `send-avis-parent-partenaires` (secret `PARENT_NOTICE_SECRET`, LCAP parent).
  Courriel « [Prénom] a autorisé la visibilité partenaires médias » + lien vers
  l'espace parent (compte lié → `/parent/consentements`, sinon `/parent/claim`).
  Pas d'avis : accord du parent, 18+, parent désabonné, sans courriel, ou un
  avis déjà parti dans les 24 h. Preuves `scripts/avis-parent-partenaires-preuves.sql`.
- **Politique 2026-10-v1** : encadré mineurs, tableau 6.1 et §7.5 alignés sur la
  règle (14+ consent seul, parent avisé, retrait possible).
- **Carte « LIGUE CIVILE »** pour une école non listée : `mapToRecruiterView`
  traite ce cas en scolaire, libellé « École à confirmer ».
- **Promesses retirées** des forfaits : « 10 résultats par recherche »,
  « Résultats de recherche illimités », « Filtres avancés » (gratuit : faux, ils
  sont ouverts à tous ; Pro : « taille, poids, cote » n'existe pas) — mobile,
  `/tarifs` FR/EN, `subscriptionTiers.ts` (inutilisé).
- **Compte `nexus.testonboarding@nexussports.ca` supprimé** en prod (fiche,
  2 lignes de journal, 1 avis admin, compte auth).

## 70. Lot 2 de la 1.4.4 — tableau blanc mobile, branche `feat/1-4-4-lot2-tableau-blanc` (2026-10-02)

Ferme les écarts du §38. Aucune migration : tout ce qui est lu ou écrit
était déjà en prod.

- **Mon processus (app)** : un Pro lit l'UNITÉ (`useProcessusUnite`, comme le
  web), un gratuit ses lignes (démo). Les cartes prospect sont écartées (pas
  encore ouvrables dans l'app) avec une phrase « N cartes prospect … visibles
  sur la version web ». Fiche : « Suivi aussi par … », « Grade de l'unité »,
  fil de notes signé (`FilNotesSuiviMobile` : les miennes supprimables, celles
  des collègues en lecture seule), retrait avec confirmation qui nomme les
  collègues (8 s pour lire). Sheet sous `useSheetKeyboardGeometry`.
- **Écritures** : `useUpdatePipelineStage`, `useTogglePipelinePriority`,
  `useUpdateNextAction` → `unite_ecrire_dossier` ; `useUpsertAthleteGrade` →
  `unite_ecrire_grade` ; `useRemoveFromPipeline` → `unite_retirer_du_processus`.
  Avant, un UPDATE de « ma ligne » ne touchait rien sur le dossier d'un
  collègue. Optimiste dans tous les caches `["pipeline"]` (`cacheDossiers.ts`).
- **Fiche athlète, web ET app** : `persistPipelineStage` passait par un upsert
  / DELETE de « ma ligne » — « Retiré » ne retirait que ma ligne, le dossier
  revenait. Désormais les fonctions d'unité ; lecture par `lireDossierActeur`
  (le dossier de l'unité, sinon ma ligne). Retrait mobile : deux touchers,
  phrase qui nomme les collègues. **Le web est donc touché aussi** (part avec
  la prochaine fusion dans `main`).
- **Favoris (app)** : Mes favoris, cœur de la recherche et de la fiche passent
  par `useBasculeFavori` (favoris de l'unité, retrait pour l'unité et du
  processus, confirmation). « Favori de … » sous la carte. Boutons de la
  modale à 44 px sur écran tactile (web inchangé au pointeur).
- **Listes (app)** : `useRecruiterLists` rend les listes de l'unité pour un
  Pro, avec « Créée par … ». Suppression et retrait d'un athlète : mêmes
  phrases que le web, confirmation avant le retrait d'un membre (le balayage
  ne retire plus directement). **Onglet « Notes » de liste retiré** : la
  bulle d'une carte ouvre le fil du joueur. `recruiter_list_notes` n'est plus
  écrite par l'app 1.4.4 — contraction possible quand plus aucune 1.4.3 ne
  circule.
- **Reste** : filtre sport de l'admin cégep (lot 3) ; avertissement React
  préexistant « button dans button » sur la ligne d'une liste (le « ⋮ ») ;
  « annuler » d'un retrait de favori retiré en mode unité (il ne rendrait que
  son propre cœur).
- Preuves sur iPhone simulé (base locale, r1 Robin et r3 Rémi, même unité) :
  lecture du dossier, note signée en lecture seule, favoris et listes de
  l'unité, retrait d'unité (0 ligne restante, celle de Rémi comprise).
  Scénario et nettoyage : `scripts/lot2-tableau-blanc-*.sql`.


## 71. Lots 3 et 4 de la 1.4.4 — Mon processus et tableau de bord mobiles (2026-10-02)

Aucune migration. Fusionnés dans `release/1.4.4` (`8be71357`, `4968ca7a`).

- **Lot 3 — Mon processus (app)** : feuille du dossier en onglets
  Actions / Infos / Historique (composants du web : `OngletInfosPanneau`,
  `OngletHistoriquePanneau`, historique signé de l'unité) ; grade A-D SOUS la
  cote, sur la carte et dans la feuille ; filtres rapides à l'écran, sous les
  étapes (Avec grade, 4+ étoiles, Avec vidéo, À relancer, Visites à venir —
  `QUICK_FILTERS`, mêmes prédicats que le web) ; directeur (admin cégep) :
  sélecteur de sport (`FiltreSportUnite`) et `AvisLectureSeule`, dossiers
  d'un autre sport en lecture seule (balayage, étapes, grade, relance,
  visite, notes et retrait refusés ; registre §40).
- **Lot 4 — Tableau de bord (app)** : « Mon activité », quatre tuiles dans
  l'ordre décidé par BP — Nouveaux athlètes, Relances, Visites planifiées,
  Athlètes qui te ciblent — chacune comptée avec la définition de sa
  destination et ouvrant l'écran filtré (`?nouveau=true`,
  `?filtre=relances`, `?filtre=visites`, `?me_ciblent=true`). Pour un Pro,
  relances, tuiles et entonnoir lisent le processus de l'UNITÉ.
  ⚠ « Nouveaux athlètes » = profils créés depuis **10 jours** (fenêtre du
  filtre de recherche, côté serveur), pas une semaine civile : le chiffre de
  la tuile est celui de l'écran d'arrivée. Le bandeau « N nouveaux talents
  cette semaine » du haut garde son propre calcul (7 jours) — deux chiffres
  différents à l'écran, à trancher (aligner la fenêtre du filtre, ou le
  bandeau).
- **Build** : Android `versionCode 15` / `1.4.4` (le 14 a pu être vu par
  Play ; un numéro sauté ne coûte rien, un numéro réutilisé bloque l'envoi).

## 72. (ex-§70 sur main, `c954df22`) Club civil sur deux régions — la région d'un athlète est celle de son club (relevé 2026-10-05, non corrigé)

Demande BP 2026-10-05 : passer Anthony Babin (athlète `9f3796f6-…`) de
Laurentides à Lanaudière. **Rien n'a été écrit** : la fiche n'a pas de région
à elle.

- **`athletes` n'a AUCUNE colonne de région.** `regions_cegep_preferees` et
  `pret_changer_region` sont des préférences de cégep, pas un lieu.
- **Toutes les surfaces recruteur/partenaire lisent `schools.region`** du
  `school_id`, renvoyée sous le nom `school_region` par quatre RPC
  `SECURITY DEFINER` : `recruiter_search_athletes`, `recruiter_athlete_cards`,
  `recruiter_athlete_profile`, `partner_athlete_profile`. Le filtre Région de
  `/recruteur/recherche` est côté client (`a.region === region`) sur cette
  même valeur. Côté coach, `loadAthleteFromSupabase.ts` lit aussi
  `schools!school_id(region)`.
- **`users.region` n'est PAS une région d'athlète** : 0 des 245 comptes ATHLETE
  la portent (COACH 11/23, RECRUTEUR 9/28). Seul `/coach/equipes/[teamId]`
  s'en sert, en repli pour les clubs civils — il y rend donc une région
  **vide** pour tout athlète de club civil (défaut à part, même famille).
- **Le club `Wildcats Laurentides-Lanaudière`** (`d4b92629-…`,
  `LIGUE_CIVILE`) porte `region = 'Laurentides'` pour ses 18 athlètes. Son
  nom couvre deux régions ; le modèle n'en permet qu'une. Changer celle du
  club déplacerait les 18.
- **Doublon d'équipe Wildcats** (connu) : `Wildcats Laurentides-Lanaudière
  Midget D1` (`090e0ce0-…`, créée 2026-05-25, **0 athlète**) et `Wildcats
  Midget D1` (`786a82d7-…`, créée 2026-08-15, 11 athlètes dont Anthony).
  Même club. Rien fusionné.
- **Variante `'Lanaudière '`** (espace final) : 4 comptes RECRUTEUR dans
  `users.region`. Non nettoyée, puisque la correction ne passe pas par cette colonne.

**Plus petite correction proposée (non appliquée, attend GO BP) :**
1. Colonne additive `athletes.region text null`, contrainte par les valeurs
   de `schools.region` (liste fermée, pas de texte libre).
2. Dans les 4 RPC : `coalesce(a.region, sc.region)` à la place de
   `sc.region`. **Même nom et même type de colonne en sortie** → `CREATE OR
   REPLACE` suffit, pas de `DROP` ; l'ACL est quand même relevée avant et
   comparée intégralement après (règle des gates d'ACL).
3. `loadAthleteFromSupabase.ts` (3 mappers) et `/coach/equipes/[teamId]` :
   même ordre, athlète d'abord, club sinon.
4. Périmètre : décider si l'athlète peut écrire `athletes.region` lui-même ou
   seulement coach/admin (`enforce_athlete_self_edit_perimeter`). Aucune UI
   d'édition dans ce lot : la valeur d'Anthony s'écrit à la main, avec
   `admin_operations` `CORRECTION_REGION`.
5. Mobile : les RPC servent aussi l'app ; le coalesce s'y applique sans
   binaire neuf. Rien d'autre côté mobile avant le lot mobile.

## 73. (ex-§71 sur main, `c954df22`) Shorts YouTube sans miniature — CORRIGÉ web (`124b6049`, 2026-10-05), mobile au binaire 1.4.2

`getYouTubeId` ne lisait que `watch?v=` et `youtu.be/` : un lien
`youtube.com/shorts/<id>` (celui que donne « Partager » sur un Short, donc
le plus probable chez un athlète qui vient d'IG) s'affichait dans Faits
saillants **sans miniature ni lecteur**. Relevé en tournant le tuto « faits
saillants ».

- Décision sortie dans `lib/video/youtube.ts` (shorts/, live/, embed/,
  watch?v=, youtu.be ; www., m., music.), test `lib/video/__tests__/youtube.test.ts`.
  `VideoEmbed` la réexporte (carrousel campus inchangé) ; `/api/video/resolve`
  abandonne sa copie, qui avait le même trou.
- **Mobile : pas de correction avant le binaire 1.4.2.** Le parseur est dans
  le bundle statique ; les apps en circulation continuent de rendre un Short
  sans miniature. Rien à faire au lot que reconstruire — le code est partagé.

## 74. (ex-§72 sur main, `c954df22`) Trois défauts vus en tournant le tuto « faits saillants » (relevé 2026-10-05, non corrigés)

**(a) « MOYENNE 4.5 4.5 » — la moyenne s'affiche deux fois.** Vue recruteur
mobile, Rapport, sous les traits : `AthleteRecruiterProfileBodyMobile.tsx`
l.2656–2657 rend `<StarRating rating={traitAvg} />` **puis** un `<span>`
`{traitAvg.toFixed(1)}`. Or `StarRating` affiche déjà sa valeur
(`components/ui/StarRating.tsx`, `displayValue`). Correction : retirer le
`<span>` (ou passer l'option d'affichage de valeur à faux si elle existe).
Vérifier la même paire ailleurs avant de corriger.

**(b) La tab bar reste visible par-dessus le clavier à l'étape Médias**
(`AthleteEditWizardMobile`, mobile). `MobileTabBar` ne se masque clavier
ouvert que sur les routes de thread (`isThreadRoute` → `kbdOpen`, l.396) ;
partout ailleurs elle reste affichée au-dessus du clavier et mange une
bande de l'écran de saisie. Piste : étendre le masquage `kbdOpen` à toute
route, ou au moins à `/athlete/profil` — à arbitrer, le masquage global
change le comportement de chaque formulaire mobile.

**(c) Ticket UX — aucun retour au collage d'un lien dans l'éditeur.** À
l'étape Médias, coller un lien et valider l'enregistre aussitôt, mais
l'écran ne montre que le texte de l'URL : ni ✓ « enregistré », ni logo de
plateforme, ni miniature. Logo et miniature n'existent que dans la vue
recruteur (`plateformeDeUrl` / `PlateformeIcone` / `VideoEmbed`). Proposé :
à la validation, un ✓ bref + l'icône de plateforme dans la ligne, et pour
YouTube la miniature (`getYouTubeId`, cf. §73). Le tuto a dû le dire en
overlay (« s'enregistre tout seul ✓ ») faute de le montrer.

**Note de recette — deux émulateurs, deux bases.** `Pixel_6_Play`
(emulator-5556) porte un **APK debug construit contre la base LOCALE**
(Docker, `adb reverse 54321`), laissé là par le tournage du 2026-10-05.
`Pixel_6` (emulator-5554) porte le **1.4.4 prod**. Ne pas recetter la prod
sur `Pixel_6_Play` sans y réinstaller un build prod : sans le relais de
port, l'app y échoue à se connecter.

## 75. Lot 1 cartes — parent restauré, prénom à une lettre près, invitation à l'ajout du courriel (2026-10-07, pour le lot mobile)

Branche `fix/cartes-lot1-base`, migration `20261007193918_cartes_lot1_parent_prenom_invitation`
— ✅ **APPLIQUÉE en prod le 2026-10-07** (19:39 UTC, GO BP), `send-invitation-carte`
v6 déployée juste après (runbook : `docs/runbook-cartes-lot1.md`).
Web et base seulement (protocole web-d'abord). Ce que le mobile doit reprendre :

- **`differences()`** (`lib/cartes/niveauRapprochement.ts`) rend désormais une
  ligne « Prénom : Mathis sur la carte, Mathys sur Nexus » quand le nom de
  famille est identique et le prénom normalisé diffère. Une fenêtre de
  rapprochement mobile qui recopierait la liste des écarts au lieu d'appeler
  `differences()` ne la montrerait pas. Décision BP : **aucun autre indice**
  quand « Possible » vient du prénom — cette ligne suffit.
- **`COURRIEL_PARENT_CARTE`** : critère restauré par ce lot (il avait été
  perdu en prod le 2026-10-05 par `carte_sport_athlete`). Un `switch` mobile
  sur `critere` sans cas par défaut n'affichera rien pour lui (déjà noté §60) ;
  niveau « Correspondance confirmée par le courriel ».
- **Prénom proche** : EQUIPE_PROCHE / ECOLE_PROCHE peuvent maintenant naître
  d'un prénom à une lettre près (≥ 4 lettres, `prenoms_proches`) ; jamais
  plus haut que « Possible », jamais par le parent (garde fratrie). Aucun
  critère nouveau : rien à ajouter au `switch`.
- **Signataire de l'invitation** : `cartes_prospect_invitations.signataire`
  (nouvelle colonne). À la création : le créateur ; courriel AJOUTÉ plus tard
  à une carte qui n'en avait pas : celui qui l'ajoute — l'invitation part
  alors automatiquement (trigger `trg_carte_z_inviter_ajout`), une seule fois
  par carte. Le journal INVITATION est signé par le même. **Rien à changer
  dans le binaire** pour que l'envoi parte (la base décide), mais :
  · un écran mobile qui permet d'ajouter un courriel à une carte déclenche
    une vraie invitation — l'interface web prévue (fenêtre « Envoyer
    l'invitation ? ») n'a pas d'équivalent mobile ;
  · un historique mobile qui suppose « INVITATION = créateur » se trompe.
- Les **rappels** restent au nom de celui qui les demande (`demande_par`),
  inchangés.

## 76. Lot 2 cartes — courriel modifiable, fenêtre d'invitation, texte à copier pour le téléphone seul (2026-10-07, pour le lot mobile)

Branche `feat/cartes-lot2-web` (partie de `fix/cartes-lot1-base`). **Web seulement.**
Dépend du trigger du lot 1 (`trg_carte_z_inviter_ajout`, en prod depuis
`20261007193918`). Une migration : `20261007201544_carte_renvoi_telephone`
(`journaliser_renvoi_invitation` accepte « courriel OU téléphone ») — ✅ **APPLIQUÉE
en prod le 2026-10-07 sous `20261007201544`** (runbook `docs/runbook-cartes-lot2.md`).
Web : mergé dans `main` local le 2026-10-07 — **à pousser et promouvoir par BP** (promotion manuelle de main, jamais un preview).

Ce que l'app 1.4.4 ne fait pas (à reprendre au lot mobile) :
- **Courriel modifiable** dans Infos : sur l'app, la ligne reste en lecture
  (`OngletInfosCarte` est partagé ; garde `NEXT_PUBLIC_CAPACITOR_BUILD`).
  · ajout → fenêtre « Envoyer l'invitation ? » (texte : `texteConfirmation`,
    `lib/cartes/courrielCarte.ts`), puis relecture de `invitation_etat` →
    « Nexus envoie l'invitation à … » ou `MENTION_INVITATION_NON_ENVOYEE` ;
  · changement → pas de fenêtre, ligne `AIDE_COURRIEL_CHANGE` ;
  · retrait → refusé (`REGLE_RETRAIT`) ;
  · mêmes avertissements qu'à la création : `doublonsCourriel()`
    (`lib/cartes/doublonsCarte.ts`, extrait de `chercherDoublonsCarte`, que
    `CreerProspectMobile` appelle toujours — comportement inchangé).
- **Téléphone seulement** : web = « Copier le texte » (lien sans adresse,
  `/auth?mode=signup`) + ligne `INVITATION_RENVOYEE` au journal ; à la
  création (modale), dans le panneau (`etatRappel` → `COPIE_SEULE`) et après
  l'ajout d'un numéro. **Sur mobile ce sera Messages** (`lienSms`, déjà utilisé
  par `CreerProspectMobile`) — et l'app devra appeler la même RPC pour laisser
  la trace (possible seulement après la migration du lot 2).
- **Message de création aligné** (web, BP 2026-10-07 16 h 05) : la carte est
  relue après l'insertion — « Carte prospect créée : X. Nexus envoie
  l'invitation à … » ou la mention neutre (`messageCreationCarte`,
  `lib/cartes/courrielCarte.ts`). L'app le fait déjà (`CreerProspectMobile`,
  « Carte créée : … ») ; au lot mobile, appeler `messageCreationCarte` pour un
  texte identique au web.
- **Retirer le courriel : REFUSÉ** (décision BP finale, `REGLE_RETRAIT`) — même
  règle à reprendre sur mobile quand le courriel y deviendra modifiable.
- Historique (partagé) : « a invité l'athlète par courriel (envoi
  automatique) » — « à la création » retiré, l'invitation pouvant naître d'un
  ajout. Seul changement visible dans l'app, au prochain binaire.

## 77. Carte des matchs, lot A (web) — `/recruteur/carte-matchs` (2026-10-07, pour le lot mobile)

Branche `feat/carte-matchs-lot-a`. **Web seulement, aucune migration.** Pro
(`FeatureGate` `recruiting_calendar`), entrée de menu après « Calendrier ».
Sous Capacitor, la route renvoie vers `/recruteur/calendrier`. Mergé dans
`main` local le 2026-10-07 — **à pousser et promouvoir par BP**.

Ce que fait l'écran (décisions BP 2026-10-07) :
- les matchs d'**une journée** où joue au moins un athlète **suivi par l'unité**
  (cibles de `useCalendrierUnite`, appariées par `buildMatches`), collégial
  exclu ; sport de l'unité par défaut ; catégorie, division, ligue filtrables,
  **grisés** quand une seule valeur (jamais cachés) ;
- **modèle visuel = « Trouve ton cégep »** (`CegepSearch.tsx`, repris à
  l'identique : `CS_CSS`, `FiltreBtn`, `ListeCases` exportés) ; liste à gauche,
  carte à droite ; en dessous de 1000 px, bascule liste ↔ carte (celle de
  `RechercheMobile`) ;
- clic sur une ligne ou un point → zoom (flyTo) + **bulle** (`MapPane`, props
  facultatives `bulle` / `contenuBulle` / `onFermerBulle` / `onHover`) :
  heure « 9 h 30 », équipes, catégorie et division en clair, ligue, suivis
  (« Identité réservée » si l'identité n'est pas visible), « Itinéraire »,
  « Ajouter à mon agenda » (Google, Outlook, .ics). Plusieurs matchs au même
  terrain : tous, le cliqué en premier ; les lignes du terrain sont mises en
  évidence ;
- match **sans heure** → événement **journée entière**, « A vs B (heure à
  confirmer) » (`allDay`, ajout facultatif à `generateCalendarLinks` et
  `buildIcs`) ; **lieu inexploitable** → liste seulement, « Lieu non précisé » ;
- **aucune distance** affichée (`distanceKm` gardée et testée, non rendue),
  **aucun regroupement** de points.

Laissé tel quel, faute de source dans le dépôt :
- **libellés de ligue** : codes RSEQ bruts (« Football C M D3 ») — aucune table
  de correspondance n'existe ; seule la division est mise en clair
  (`libelleDivision` : « D3 » → « Division 3 »).

**Lot mobile — reprendre le MÊME écran avec les MÊMES fonctions**
(`lib/carteMatchs/carteMatchs.ts`, pur et testé) : `matchsDuJour`,
`optionsFiltres`, `terrainsDuJour`, `terrainDuMatch`, `matchsBulle`,
`heureQuebec`, `libelleDivision`, `lienItineraire`, `evenementMatch`,
`nomSuivi`, `jourDecale` ; sport par défaut via `useOrigineCarte`. Côté app :
retirer la redirection Capacitor de la page, ouvrir l'itinéraire et les liens
d'agenda dans le navigateur in-app, et écrire le .ics par le chemin Capacitor
(Filesystem + Share), `downloadIcs` ne marchant pas dans la WebView.

**Lot A+ — « profils Nexus dans ce match »** (branche `feat/carte-matchs-profils`,
BP 2026-10-07). Sur chaque match, les joueurs des DEUX équipes qui ont un profil
Nexus, suivis ou non : pastille « N profils Nexus » (+ « dont X suivi(s) »),
rien si 0 ; dans la bulle, sous chaque match, prénom nom (lien vers la fiche),
position, promotion, équipe, suivis d'abord avec la pastille « Suivi ».
- **RPC `matchs_profils_nexus(p_games uuid[])`** (SECURITY DEFINER, STABLE,
  `search_path` épinglé) — ✅ **APPLIQUÉE en prod le 2026-10-08 sous
  `20261008020241`** (GO BP ; runbook `docs/runbook-carte-matchs-profils.md`).
  Web : mergé dans `main` local — **à pousser et promouvoir par BP**.
  Seulement `status = 'ACTIF'` ET `athlete_identity_ok()` (vérifiés ou non :
  un mineur sans consentement n'apparaît ni dans le compte ni dans la liste).
  Recruteur Pro seulement (même test que les écritures de Mon processus : rôle
  `RECRUTEUR` + `user_has_pro()`), 42501 sinon ; 500 matchs au plus par appel.
  Rend game_id, athlete_id, prénom, nom, position, promotion, côté — rien
  d'autre. Les policies de `team_athletes` ne sont PAS touchées.
- **Écran web** : UN appel par journée (`useProfilsMatchs`, les game_id du jour
  avant les filtres de catégorie / division / ligue) ; un échec rend une carte
  vide, donc aucune pastille.
- **Lot B** : la fonction et `profilsParMatch` ne savent rien du mode « suivis »
  (l'ensemble des suivis est un paramètre, vide possible) ; elles serviront
  telles quelles sur « tous les matchs ».
- **Lot mobile — reprendre** `useProfilsMatchs` (`lib/carteMatchs/`),
  `profilsParMatch`, `libelleProfils`, `libelleDontSuivis` ; le lien de fiche
  vers l'écran athlète natif du recruteur.

**Lot B — moteur de recherche de TOUS les matchs + ajout au calendrier +
terrains civils** (branche `feat/carte-matchs-lot-b`, BP 2026-10-07 22 h 24 ;
runbook `docs/runbook-carte-matchs-lot-b.md`). ✅ **Base APPLIQUÉE en prod le
2026-10-08 (GO BP)** : `20261008134823` (lieux_geocodes), `20261008134902`
(matchs_ajoutes), `20261008134939` (matchs_recherche), `20261008135031`
(journal) ; 31 terrains écrits + 1 ligne `admin_operations`. Web : mergé dans
`main` local — **à pousser et promouvoir par BP**.
Le mode « suivis » des lots A / A+ disparaît : la carte sert à TROUVER des
matchs, le Calendrier reste l'endroit des matchs des athlètes suivis.
- **Base (4 migrations additives)** : `lieu_normalise` + `lieux_geocodes`
  (terrains sans GPS dans `games`, écrits après revue de BP, jamais dans
  `games`) ; `matchs_ajoutes` (calendrier PARTAGÉ de l'unité ; unité et auteur
  posés par un trigger ; RLS des cartes prospect + `is_admin()` en lecture ;
  doublon refusé) ; RPC `matchs_recherche` (plage de 7 jours au plus, sport,
  types SECONDAIRE / COLLEGIAL / CIVIL, texte par mots sans accents ; rend
  nb_profils selon la règle Loi 25, `cible`, `ajoute`, lat / lon de `games`
  sinon de `lieux_geocodes`).
- **`cible` = la définition du Calendrier** (pipeline et favoris de l'unité dans
  SON sport, listes, cartes prospect), pas `athlete_suivi_par_mon_unite` (qui,
  pour un admin cégep, couvre tous les sports) : un match « cible » est
  exactement un match déjà au Calendrier, d'où le ✓ non retirable.
- **Journal d'activité (migration 4, décision BP 2026-10-08)** : deux types
  neufs, `MATCH_AJOUTE` / `MATCH_RETIRE`, SANS athlète (le match — équipes, jour,
  heure, terrain — est dans `details`), écrits par un trigger sur
  `matchs_ajoutes`, signés par l'acteur, rangés dans l'unité de la ligne,
  lisibles par l'unité (ajoutés à `unite_journal_select` et à `GESTES_UNITE`).
  Un retrait qui n'est le geste d'aucun recruteur (cascade, service_role) ne
  s'écrit pas. Web : fil du tableau de bord, Activités (filtre « Calendrier »,
  exclu côté coach), Mon CÉGEP — libellé unique `libelleGesteMatch`.
  Comme pour tous les types, un recruteur peut écrire une ligne de journal à son
  propre nom (policy préexistante « Recruiters see their own activity », FOR ALL) ;
  l'unité reste posée par la base.
- **Panneau : « Autres matchs à ce terrain »** (décision BP 2026-10-08) — les
  autres matchs du même terrain dans les résultats affichés, lignes du modèle
  (`.lc`) avec leur « + » ; un clic ouvre ce match. Absent si le match est seul
  à son terrain.
- **Calendrier** : `construireCalendrier` reçoit les matchs ajoutés
  (`useCalendrierUnite`, ceux de SON unité), rendus comme les autres ;
  `buildMatches` garde un match ajouté à 0 cible au seuil par défaut seulement
  (« 2+ cibles » l'écarte). Sans match ajouté : rendu identique (md5 avant / après).
- **Code retiré (mort)** : le mode « suivis » de `lib/carteMatchs`
  (`matchsDuJour`, `terrainsDuJour`, `matchsBulle`, distances, `evenementMatch`…),
  la bulle Leaflet et `onHover` de `MapPane`, `outlookUrl` et « journée entière »
  de `generateCalendarLinks` / `buildIcs` (revenus à leur état d'avant le lot A).
- **Terrains civils** : `scripts/carte-matchs-lot-b/` — géocodage Nominatim
  (`geocoder-terrains.mjs`), CSV de revue annoté (`terrains-civils-revue.csv`),
  générateur du SQL gardé (`ecrire-lieux.mjs`). Même normalisation que la base
  (32/32 libellés identiques, preuve). **Revue de BP du 2026-10-08** appliquée par
  `geocoder-corrections.mjs` → `terrains-civils-final.csv` : 21 validés tels quels
  (dont 2 en Ontario, gardés), 10 corrigés : adresse donnée par BP géocodée
  (Pierre-Laporte à Boucherville, Ducharme à Sainte-Thérèse, Martin Charpentier
  à Drummondville, D'Arcy McGee à Aylmer/Gatineau, confirmé), ou POINT RSEQ
  (Kirkland, Dollard-des-Ormeaux, Stade Hébert, Claude-Robillard, Gerry-Dattilio
  sous ses deux libellés). `ecrire-lieux.sql` : 31 lignes, écrites en prod.
- **Lot mobile — reprendre** `lib/carteMatchs/carteMatchs.ts` (plage, groupement
  par jour, terrains, `etatCalendrier`, libellés, profils) et
  `lib/carteMatchs/useMatchsRecherche.ts` (`useMatchsRecherche`,
  `useBasculerCalendrier`, `useSportsCarte`) ; le panneau de détails devient une
  feuille (sheet) comme dans `RechercheMobile` ; le Calendrier mobile devra
  passer les matchs ajoutés à `construireCalendrier` (il n'en passe pas
  aujourd'hui : un match ajouté sur le web n'y apparaît pas). Le fil
  `RecruteurActivitesMobile` affiche ses propres `MATCH_*` par sa branche par
  défaut (« Activité : match ajoute ») : brancher `libelleGesteMatch` et le
  lien vers le Calendrier.
