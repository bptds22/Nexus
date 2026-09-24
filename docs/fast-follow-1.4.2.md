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
| Retirer un favori | ne retire que **sa** ligne ; l'athlète reste favori de l'unité si un collègue l'a | retirer pour l'unité |
| Retirer du processus | ne supprime que **sa** ligne ; le dossier reste dans l'unité par les lignes des collègues | retirer pour l'unité (avec confirmation) |
| Changer d'étape hors VISITE_PLANIFIEE | l'ancien `persistPipelineStage` met `visit_at` à NULL ; la synchronisation **efface la visite de l'unité** | règle `regleVisite` (la visite survit au changement d'étape) |
| Voir « Mon processus », « Mes favoris », « Mes listes » | lectures filtrées `recruiter_id = soi` : **seulement ses propres lignes** (leurs étapes, grades et relances suivent toutefois l'unité par synchronisation) | lectures par unité (`unite_pipeline`, `unite_favoris`, listes de l'unité) |
| « X recruteurs intéressés » (recherche) | compte désormais **aussi les favoris des collègues de l'unité** — exact, mais nouveau pour un recruteur non admin | inchangé (c'est la bonne donnée) |

Aucun de ces écarts n'expose une donnée hors de l'unité : ce sont des gestes
**moins partagés** que le web, jamais plus.

## 40. Admin cégep : les dossiers d'un AUTRE sport sont en lecture seule (B2, étape 1 — à trancher à l'étape 3)

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
