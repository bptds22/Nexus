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

## 2. Le saut des badges en remontant — vérifier si le correctif D4a a suffi

**Symptôme :** en scrollant vers le **haut** (jamais vers le bas), les
pastilles de distinction restent figées quelques frames puis sautent à leur
position.

**Correctif posé en 1.4.1 (D4a, option 1) :** le `will-change` du hero est
devenu **conditionnel** au lieu de permanent. Le bloc fait **412 × 1015 px**
(mesuré) ; promu en permanence sans que sa transformation ne bouge jamais, il
force le compositeur à garder une grande couche à pixeliser — et en remontant
à re-pixeliser des tuiles libérées.

**Hypothèse, pas mesure.** Verdict attendu au test de BP après le rebuild de
fin de session. **Si le saut persiste**, les pistes suivantes sont le
`will-change` permanent de `HeroCollapsed` (`:2431`, mais 80px seulement) et
la taille du hero lui-même.

*Deux hypothèses ont déjà été **réfutées par la mesure**, ne pas les reprendre :*

- *Composition/z-index* — expérience contrôlée dans la WebView réelle : trois
  badges (parent non promu / parent promu / transform animé en boucle) sous la
  même barre sticky `z-30` opaque, **tous masqués à l'identique**. Ce moteur
  compose correctement. `willChange: "transform"` sur le sticky ne corrigerait
  rien.
- *Re-render par frame* — voir le point 1 : le handler ne s'exécute pas.

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
