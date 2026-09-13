# Passation Mac → Windows — rebuild Android 1.4.1

Le Mac a bâti et testé iOS. **L'APK Android n'a pas pu être produit ici** : ce
Mac n'a aucun SDK Android (voir §4). Tout le code est poussé — il ne manque
qu'un `gradlew assembleDebug` sur une machine équipée.

---

## 1. SHA à puller

```
release/1.4.1 → 0e16c69   (poussé sur origin)
```

Deux commits depuis la passation précédente :

| SHA | Contenu |
|---|---|
| `22f36af` | MapTiler, rebond horizontal, couches WebKit, polish (1re passe) |
| `116a4e1` | Recadrages de cible : sheet pipeline, vert coach, vignettes WOW |
| `0e16c69` | **Fix structurel du scroll de la fiche athlète — cause racine trouvée** |

---

## 2. ⚠️ La clé MapTiler — À VÉRIFIER AVANT DE BÂTIR

C'est le piège de ce rebuild. `NEXT_PUBLIC_MAPTILER_KEY` est lue **au build**
et inlinée dans le bundle. Le `.env.local` n'est pas au dépôt (gitignore l.36),
donc **chaque machine a le sien**.

Symptôme si elle manque : la carte CÉGEP affiche « Invalid key » partout.
MapTiler renvoie la MÊME tuile d'erreur pour une clé vide et une clé invalide
(md5 `6e6a4d0f5a9070289b4399ae9aa319f2`) — impossible de distinguer les deux
à l'œil.

```
NEXT_PUBLIC_MAPTILER_KEY=MiFISmUXg5HRz18rZJwD
```

**Contrôle après build, avant d'installer l'APK :**

```bash
grep -rc 'NEXT_PUBLIC_MAPTILER_KEY' android/app/src/main/assets/public/_next/static/chunks/
# 0 attendu → la clé a été inlinée en littéral
grep -rl 'MiFISmUXg5HRz18rZJwD' android/app/src/main/assets/public/_next/static/chunks/
# doit renvoyer un fichier
```

Si `NEXT_PUBLIC_MAPTILER_KEY` apparaît encore dans les chunks, c'est que Next
n'a rien eu à inliner : la variable était absente. Ne pas installer, corriger
le `.env.local` et rebâtir.

Note : cette clé n'a **aucune restriction de domaine** aujourd'hui (vérifié :
un GET sans `Origin` ni `Referer` renvoie 200). Elle est donc réutilisable par
n'importe qui. À restreindre côté console MapTiler — et ce jour-là, l'origine
Android est `https://localhost` (`androidScheme: 'https'`), iOS
`capacitor://localhost`. Les tuiles étant des `<img>`, aucun en-tête `Origin`
n'est envoyé : MapTiler retombe sur le `Referer`.

---

## 3. Séquence de build

```bash
git checkout release/1.4.1 && git pull        # doit donner 116a4e1
npm install
npm run mobile:sync                            # build:mobile + cap sync
cd android && ./gradlew assembleDebug
```

APK attendu : `android/app/build/outputs/apk/debug/app-debug.apk`

---

## 4. Pourquoi le Mac n'a pas pu le faire

Trois manques, cumulés :

- **`gradlew` n'a pas le bit exécutable** (séquelle de l'origine Windows —
  `permission denied`). Contourné avec `sh gradlew`. Sous Windows, sans objet.
- **Aucun runtime Java sur le PATH.** Android Studio embarque un JBR utilisable
  (`/Applications/Android Studio.app/Contents/jbr/Contents/Home`).
- **Aucun SDK Android**, nulle part : ni `~/Library/Android/sdk`, ni
  `ANDROID_HOME`, ni `android/local.properties`.

Les assets web Android **sont** synchronisés dans le dépôt et vérifiés — le
côté Android est prêt à builder, il ne l'est juste pas sur cette machine.

---

## 5. Ce qui change pour Android dans ces deux commits

Tout ce qui suit touche les deux plateformes et arrive donc dans l'APK.

### Le WOW est VERROUILLÉ côté produit

Décision BP : « parfait, on n'y touche plus ». Le tempo, les tailles du défilé
et la chorégraphie sont figés. Une seule exception appliquée : les 5 vignettes
de la rangée finale passent de 44 à 56 px (gouttière 12 → 8).

L'état verrouillé du WOW, tel qu'il part dans l'APK :

- cadence du défilé **700 ms**, calée sur `T_PILL_GAP` — la cadence des statuts
  de recrutement qui suivent. Les deux séquences battent la même mesure.
- `T_BADGE_SETTLE` 520 ms, `T_PIPELINE_LEAD` 4500 ms (préserve les 1180 ms de
  contemplation ; **à recalculer si la cadence rebouge**, sinon la pipeline
  démarre sur le défilé)
- badge central en `xl` (140 px), scène centrale portée à 172 px
- rangée finale en `md` (56 px)

⚠️ Recette WOW : exige un **compte neuf**. L'écran ne se rejoue pas une fois
`onboarding_complete` posé.

### Le reste

- **Carte CÉGEP** — voir §2.
- **Rebond horizontal** : `overscroll-behavior-x: none` sur les trois `<main>`
  (recruteur, coach, athlète) + verrou sur les conteneurs scroll des deux
  sheets du pipeline. Sans effet visible sur Android, qui ne rebondit pas
  comme WebKit — c'est du durcissement, à vérifier que rien n'a régressé.
- **Barre collante de la fiche athlète** promue (`translateZ(0)`). Neutre sur
  Android. **Ne règle PAS le symptôme de chevauchement** (voir §6).
- **Espace mort « Mon processus »** : `.nx-safe-top` retiré de
  `StageTabsSticky`, safe-area réservée seulement quand la rangée est épinglée.
  **Invisible sur Android** (inset = 0) — c'était un bug iOS pur. Vérifier
  quand même qu'aucun décalage n'apparaît.
- **Bouton Filtrer** : pile pleine rouge, encre blanche, pastille inversée.
- **Bulle Message du duo flottant coach** : vert plein #22C55E.
  « Écrire à son entraîneur » est **resté rouge**.

---

## 6. Le scroll de la fiche athlète — RÉGLÉ (`0e16c69`)

**À lire avant de conclure quoi que ce soit sur Android.** La cause racine
n'avait rien à voir avec le compositing, et elle est de la même famille que le
`scrolled` mort documenté en §7 — donc **elle frappe Android autant qu'iOS**.

`window.scrollY` vaut **0 en permanence** sous `.is-capacitor` : `html`/`body`
sont `position: fixed; overflow: hidden` et le scroll vit dans le `<main>` du
layout. Deux conséquences dans `AthleteRecruiterProfileBodyMobile.tsx` :

1. **Les gardes du pull-to-refresh** (« n'autorise le pull que tout en haut »)
   étaient donc TOUJOURS vraies. Glisser le doigt vers le bas — le geste pour
   remonter — alimentait `pullDistance` à n'importe quelle position ;
   `pullDistance` pilote `overscrollTranslate` et `overscrollScale` sur le
   hero. Tout le bloc supérieur descendait et s'étirait par-dessus la barre
   collante. **C'était ça, le symptôme des quatre itérations.**
2. **L'écouteur de scroll de la fiche** était lui aussi sur `window` : toute la
   chorégraphie (glissement du hero, entrée de HeroCollapsed, flou de la top
   bar) était **inerte dans l'application** et ne s'animait que sur le web.

Les deux passent désormais par `trouverScroller()`, qui remonte au premier
ancêtre réellement scrollable.

**Ce que ça implique pour la recette Android :** la chorégraphie du hero va
s'animer pour la PREMIÈRE FOIS sur Android. Ce n'est pas une régression à
signaler, c'est le comportement prévu qui n'avait jamais tourné. À recetter
comme du neuf : descente, remontée, favori on/off, vue coach avec alertes,
athlète à 1 badge et à 5.

Par-dessus, le fix structurel demandé : `EXPANDED_SLIDE_DISTANCE = 1200` et
`HERO_LAYOUT_HEIGHT = 800` sont supprimées au profit d'une hauteur unique
mesurée par `ResizeObserver` dont dérivent le déplacement visuel ET la
compensation de flux ; le `top` collant est devenu continu (le saut de 80 px a
disparu) ; le `willChange` permanent de `HeroCollapsed` est retiré.
Plus aucun littéral 80/124/800/1200 dans la chorégraphie.

---

## 7. Dette connue, inchangée

- `git log --all -S'overscroll-behavior-x'` ne renvoyait rien avant ces
  commits : le « fix perdu » d'une session antérieure n'avait jamais été
  commité.
- `AthleteRecruiterProfileBodyMobile.tsx` est en **CRLF**. Tout script qui le
  réécrit en LF produit un diff fantôme de ~3 700 lignes. Vérifier avant de
  commiter.
- `scrolled` dans `RecruteurPipelineMobile` est calculé sur `window.scrollY`,
  nul en permanence sous Capacitor (`body` fixed, scroll dans le `<main>`) :
  le flou et le liseré de la barre de pilules sont du **code mort côté
  mobile**. Non corrigé — MÊME RACINE que le bug de §6. À balayer sur tout le
  dépôt : `grep -rn 'window.scrollY\|window.pageYOffset' app components`
  liste les autres surfaces qui font le même pari faux.
- 95 erreurs `tsc` préexistantes (types Supabase/Stripe générés), intouchées.
- `MARKETING_VERSION` iOS est à **1.4.0** sur une branche `release/1.4.1`.
  À régler avant toute archive. Aucun bump n'a été fait.
