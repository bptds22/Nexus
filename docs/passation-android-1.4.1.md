# Passation Mac → Windows — rebuild Android 1.4.1

Le Mac a bâti et testé iOS. **L'APK Android n'a pas pu être produit ici** : ce
Mac n'a aucun SDK Android (voir §4). Tout le code est poussé — il ne manque
qu'un `gradlew assembleDebug` sur une machine équipée.

---

## 1. SHA à puller

```
release/1.4.1 → c05d68c   (poussé sur origin)
```

Deux commits depuis la passation précédente :

| SHA | Contenu |
|---|---|
| `22f36af` | MapTiler, rebond horizontal, couches WebKit, polish (1re passe) |
| `116a4e1` | Recadrages de cible : sheet pipeline, vert coach, vignettes WOW |
| `0e16c69` | Fix structurel du scroll — **REVERTÉ, ne pas recetter** |
| `617107d` | **Revert de `0e16c69`** — régression critique, voir §6 |
| `1f798d9` | Réponse à l'admin — composeur conditionné, boîte admin (§8) |
| `c05d68c` | Relance — tri par échéance + encart dashboard (§9) |

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

## 6. Le scroll de la fiche athlète — REVERTÉ, reporté en 1.4.2

Le correctif structurel (`0e16c69`) a été **annulé** (`617107d`). Il rendait la
fiche inutilisable : dès le premier geste, la page sautait en butée — tout en
bas, ou tout en haut selon le compte.

**Le mécanisme, à connaître avant d'y retoucher.** `expandedSlideProgress`
atteint 1 à `scrollTop = 140`, soit 60 px après `SCROLL_START`. Sur ces 60 px,
`marginBottom` passe de 0 à `-heroHeight` (~1015 px) — et un `marginBottom`
négatif sur un élément en flux retire cette hauteur au `scrollHeight` du
conteneur. 60 px de doigt suppriment donc ~1015 px de hauteur scrollable :
**amplification 17×**. Le contenu file vers le haut, le navigateur écrête
`scrollTop`, la page atterrit en butée. Contenu long → saut en bas ; contenu
court → `scrollHeight` tombe à ~`clientHeight` → saut en haut.

**La boucle n'est pas dans la mesure, elle est dans le design** : la position
de scroll retire de la hauteur scrollable. Elle existait déjà avec la constante
800 (13×). Elle n'avait jamais tourné parce que `window.scrollY` est gelé à 0
sous `.is-capacitor`. C'est le correctif de la source de scroll qui l'a
**armée**. Toute reprise en 1.4.2 devra compenser `scrollTop` à chaque
variation de hauteur du document — sinon la boucle revient.

### Conséquence pour Android : RIEN N'A CHANGÉ

La chorégraphie du hero reste **dormante** sur les deux plateformes, comme elle
l'a toujours été. `window.scrollY` vaut 0, `transitionProgress` reste à 0, le
hero ne glisse pas, `HeroCollapsed` n'apparaît pas. **Ne pas recetter la
chorégraphie du hero** — il n'y a rien à voir, et c'est l'état connu-bon.

Le bug d'origine (le bloc supérieur qui s'étire et passe sous la barre en
remontant) est **toujours présent**, sur les deux plateformes. Arbitrage BP :
cosmétique et vivable pour la 1.4.1. Ne pas le re-patcher — surtout pas par la
composition, trois tentatives ont déjà échoué : les couches vont bien, c'est la
position de scroll qui est fausse.

## 8. Le composeur « répondre à l'admin » — CONDITIONNÉ, dormant

Nouveau dans `1f798d9`, et il ne changera RIEN tant qu'on ne bascule pas un
drapeau en base. **Ne pas le recetter comme une feature vivante.**

Les fils ADMIN_USER portent désormais un composeur sur les trois rôles, mais
piloté par `app_settings.admin_reply_open`. Le défaut est FERMÉ : clé absente,
erreur de lecture ou chargement en cours laissent le bandeau de lecture seule
en place. **Comportement attendu sur l'APK : identique au build précédent** —
le fil Nexus reste en lecture seule, avec son renvoi vers
`support@nexussports.ca`.

Pour l'essayer en préprod, poser le drapeau ne suffit PAS : le trigger
`trg_admin_thread_readonly` refuse toujours l'insertion. Les deux vont
ensemble — voir `docs/registre-migration-reponse-admin.md`.

La boîte de réception admin (onglet « Conversations » de `/admin/messages`) est
du **web pur** : elle ne dépend d'aucun binaire et fonctionne dès le merge.

## 9. Relance — deux features VIVES sur Android aussi

Contrairement au composeur admin (§8), celles-ci sont **actives dès
l'installation**, sans interrupteur serveur. À recetter.

**Tri « Relance la plus proche »** — dans la feuille filtres/tri de
« Mon processus ». Ordre croissant sur `next_action_at` : les relances
**dépassées en tête**, les cartes sans relance à la fin. Le module de tri
(`lib/pipeline/sortPipelineCards.ts`) étant partagé, l'option apparaît aussi
dans le `<select>` du pipeline web — même passe, même comportement.

**Encart « Relances aujourd'hui »** — sur le dashboard recruteur, entre le hero
et le funnel « Mon processus ». Compte, trois premiers noms, retard et jour
distingués (ambre = en retard, rouge = aujourd'hui). Tap sur un nom → la fiche
athlète ; bouton → Mon processus.

**Gaté `canUsePipeline` (pro | all_star).** Sur un compte Free, l'encart
n'existe pas ET le pipeline n'est même pas chargé (`enabled: false`). Recetter
les deux cas : un Pro avec relances dues doit voir l'encart, un Free ne doit
rien voir du tout.

⚠️ **Le jeu de données de prod est mince** : deux relances posées au moment de
l'écriture, toutes deux dues. Pour recetter sérieusement, poser des dates
variées à la main (passée, aujourd'hui, future) depuis le sheet du joueur.

**Pas de migration**, pas de nouvelle requête : l'encart dérive du cache
`usePipelineCards` déjà chargé par Mon processus.

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
