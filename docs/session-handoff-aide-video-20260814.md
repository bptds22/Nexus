# Passation — Centre d'aide + lecture vidéo (14 août 2026)

Document de reprise pour une nouvelle session Claude Code.
Deux chantiers menés dans la même session : `/aide` (terminé, commité)
et la lecture vidéo (partiel, **non commité**).

---

## 0. Règles de travail — À LIRE EN PREMIER

**Worktree partagé entre 5 chantiers simultanés.** `C:\Users\bptds\Documents\Nexus`

- **Aucune commande git destructive** : pas de `reset`, `rebase`, `amend`,
  `git checkout -- <fichier>`, ni `git add .`
- **Aucun commit** — BP committe lui-même. Si un commit semble nécessaire,
  le signaler, ne pas l'exécuter.
- **Incident réel** : un `git reset HEAD~1` lancé par une autre session a effacé
  un commit du centre d'aide (`929a90c`) le 14 août. Il a fallu le refaire.
  Du travail non commité sur ce worktree est fragile.
- Vérifier la branche **avant** toute écriture — elle a changé en cours de
  session (`feat/bascule-rpc` → `feat/civil-football-discovery`).

**Branche actuelle : `feat/civil-football-discovery`**

---

## 1. CHANTIER A — Centre d'aide public `/aide`

### État : TERMINÉ ET COMMITÉ

| Commit | Contenu |
|---|---|
| `45d7f8d` | Le centre d'aide — 11 fichiers, 2 873 insertions |
| `e327d0c` | Section « dépendance de publication » dans le doc source |

### ⚠ NE PAS MERGER DANS `main` avant :

1. **Table blackout RSEQ peuplée** — conditionne `COACH-06` et `SECU-06`
2. **RLS recruteur fermé côté API directe** — conditionne `RECR-02` et `SECU-04`

`SECU-04` et `SECU-06` sortent de `draft` **en même temps**, à la livraison des deux.
L'avertissement est en tête de `content/aide/sections.ts` et dans `docs/aide-contenu.md`.

**Pourquoi la page entière attend** : le drapeau `draft` retire des *articles*,
pas des *affirmations*. Les deux revendications sous réserve subsistent dans des
articles publiés — COACH-06 porte les périodes de silence RSEQ, RECR-02 porte ce
qui n'est pas transmis au recruteur. Masquer SECU-04 et SECU-06 ne suffit donc pas.

### Fichiers

```
content/aide/types.ts        AideBlock / AideArticle / AideSection
content/aide/sections.ts     14 sections, 55 articles (transcription verbatim)
lib/aide/search.ts           normalisation, index, recherche, visibleSections
components/aide/AideBlocks.tsx        renderer dédié (palette #1A1D24 / #2D3748)
components/aide/AideArticleCard.tsx   carte article, ancre, copier-le-lien
app/aide/page.tsx            page cliente — recherche + sommaire
app/aide/layout.tsx          métadonnées + JSON-LD FAQPage
docs/aide-contenu.md         SOURCE DE VÉRITÉ du contenu
```

Plus 3 fichiers partagés modifiés : `scripts/build-mobile.mjs` (HIDE_PATTERNS),
`lib/build/mobile-excluded-routes.ts` (`/aide`), `app/sitemap.ts` (`"aide"`).

### Décisions structurantes à ne pas rejouer

- **Page unique `/aide` + ancres** (`/aide#secu-04`), pas `/aide/[section]`.
  La recherche a besoin du corpus entier en mémoire ; éclater en 14 pages
  n'économiserait rien et réduirait la recherche à la section courante.
- **Le contenu vit en TypeScript**, pas en base. Pas de back-office, se déploie
  avec le code, fonctionne hors ligne dans le bundle mobile.
- **`Block` est importé de `content/legal/types.ts` et JAMAIS modifié** — ce type
  alimente `scripts/generate-legal-pdfs.mjs`, qui exige un rendu byte-identique.
  Les extensions de l'aide (`steps`, `note`, `ref`) sont déclarées dans
  `content/aide/types.ts`.
- **Le renderer de l'aide est distinct** de `components/legal/BlockRenderer.tsx`.
  Ne jamais fusionner les deux.
- **Articles toujours dépliés**, pas d'accordéon : un article replié est invisible
  au Ctrl+F et une arrivée par ancre atterrirait sur un titre fermé.
- **Web seulement.** Sur mobile, l'aide viendra par un sheet natif relisant le même
  `content/aide/*` — modèle `components/legal/LegalSheetMobile.tsx`. Pas de route.

### Mécanismes à comprendre avant de toucher

**`visibleSections()` dans `lib/aide/search.ts` est le point de passage UNIQUE.**
La page, la recherche, le compteur et le JSON-LD lisent tous son résultat, jamais
`SECTIONS_AIDE` directement. Un seul filtre, aucune surface ne peut l'oublier.

**Blocs `ref` — renvois conditionnels.** `{ type: "ref", requires: "SECU-06", text: "…" }`
n'est rendu que si l'article cité est publié. Deux existent (VOIR-01 et COACH-06).
Ils disparaissent tant que SECU-06 est en brouillon et **reviennent seuls** à la
levée du drapeau. Vérifié dans les deux sens.

**Numérotation positionnelle.** Le sommaire numérote les sections 01→14 dans
l'ordre du tableau, et sept articles renvoient à « la section 6 », « la section 3 »…
**Réordonner ou vider une section casse ces sept renvois d'un coup.**

### Vérifications faites (à refaire si on y touche)

- `tsc --noEmit` : 70 erreurs préexistantes dans le dépôt, **0 sur `aide`**
- `npm run build` : exit 0, `/aide` en `○ (Static)`
- `rm -rf out && npm run build:mobile` : exit 0, 62 masquées / 62 restaurées,
  86 `.html`, `/aide` **absent** de `out/`
- Production servie : **53 articles, 14/14 sections**, brouillons exclus,
  JSON-LD à 53 questions
- Dev : 55 articles (brouillons visibles avec bandeau)
- Conversion : 55/55 articles, ordre identique, **55/55 questions verbatim**

---

## 2. CHANTIER B — Lecture vidéo

### État : PARTIEL, **NON COMMITÉ**

```
components/ui/VideoEmbed.tsx      modifié
app/api/video/resolve/route.ts    nouveau
```

Commande suggérée (BP la lance) :

```
git add components/ui/VideoEmbed.tsx app/api/video
git commit -m "fix(video): Hudl s'integre enfin + route de resolution des liens"
```

### Le problème d'origine

Fiche de **Piergrado Pretti** (`6c77efe3-bcbe-46ec-949b-5b26619e90c3`) :
sa vidéo YouTube ne se joue pas sur le site, seulement par le lien direct.

**Diagnostic — ce n'est pas un bug Nexus.** La vidéo (`lHVTno3hdVs`, chaîne
« Frank ») a `playableInEmbed = false` et son oEmbed rend **401**. Le propriétaire
a décoché « Autoriser l'intégration ». Aucun site au monde ne peut l'afficher.
Contrôle sur une vidéo intégrable : oEmbed 200, `playableInEmbed = true`.

Point structurel : l'athlète ne possède pas la vidéo (elle est à « Frank »), donc
il ne peut même pas corriger le réglage. Ce cas se reproduira.

### La découverte plus importante : Hudl

En mesurant, **seules 2 vidéos sur 5 en base se jouent réellement sur le site.**

| Athlète | Source | État |
|---|---|---|
| Vynne Kicata | YouTube | joue en ligne |
| Athlete Nexus | YouTube | joue en ligne |
| Piergrado Pretti | YouTube | cadre d'erreur (intégration refusée) |
| Piergrado Pretti | Hudl | carte-lien, sortie du site |
| Alexy Tremblay | Hudl | carte-lien, sortie du site |

**Hudl ne s'intégrait jamais, pour deux raisons cumulées :**

1. `getEmbedUrl` ne reconnaissait Hudl que si l'URL contenait `/video/` — or les
   liens stockés sont au format court `hudl.com/v/2U3ZFM`.
2. Même quand le test passait, le code renvoyait **l'URL de la page vidéo** comme
   source d'iframe. Cette page porte `X-Frame-Options: Deny` → cadre vide, en
   silence. Il manquait `/embed` dans le chemin.

### Les trois formes Hudl (vérifiées par requête réelle)

```
/v/2U3ZFM                          lien court        → non dérivable côté client
/video/3/26518191/6a64ce78…        page vidéo        → X-Frame-Options: Deny
/embed/video/3/26518191/6a64ce78…  intégration       → aucun XFO, frame-ancestors: *
```

Hudl déclare lui-même la troisième dans ses balises `twitter:player` et `embedUrl`.
C'est un point d'entrée assumé.

**Le lien court n'est pas dérivable** : `2U3ZFM` ne contient ni l'identifiant
utilisateur ni celui de la vidéo. Il faut suivre la redirection, ce que le
navigateur ne peut pas faire (CORS). D'où la route serveur.

### Ce qui a été livré

**`components/ui/VideoEmbed.tsx`**
- nouvelle fonction `getHudlEmbedUrl` : `/video/…` → `/embed/video/…`, et
  reconnaissance d'une URL déjà en forme d'intégration
- la condition d'iframe n'est plus `embedUrl.includes("youtube")` mais `embedUrl`
  tout court → Hudl s'affiche enfin en ligne

**`app/api/video/resolve/route.ts`** — POST authentifié
- rend `{ provider, embedUrl, playable, reason }`
- YouTube : oEmbed (200 = intégrable, 401 = intégration désactivée, 404 = absente)
- Hudl : forme longue = transformation de chaîne sans réseau ; forme courte =
  suivi de redirection puis lecture de la balise `embedUrl`
- **Allowlist stricte d'hôtes** (youtube.com / youtu.be / hudl.com). Sans elle
  c'est un SSRF — la route sort sur une URL fournie par l'utilisateur.

### Vérifications faites

`tsc` 70 → 70, aucune sur ces fichiers. `npm run build` exit 0 avec
`ƒ /api/video/resolve` dans la table. `build:mobile` exit 0, **pas de `out/api`**
(route POST seule → ignorée par l'export statique).

Logique de résolution prouvée contre les vraies URL de la base :

| Entrée | Résultat |
|---|---|
| Hudl court Pretti | → `…/embed/video/3/26518191/6a64ce78…` |
| Hudl court Tremblay | → `…/embed/video/3/20700447/6a550a0c…` |
| Hudl forme longue | → même URL, sans réseau |
| YouTube Pretti | `playable: false` + message utilisateur |
| YouTube Kicata / Nexus | `playable: true` |
| `169.254.169.254` (sonde SSRF) | `autre`, **aucun appel réseau** |

---

## 3. CE QUI RESTE À FAIRE

### 3.1 — Brancher la validation à la saisie **(bloqué sur une décision)**

La route `/api/video/resolve` **n'est appelée par personne**. C'est ce qui lui
donne sa valeur : au moment où l'athlète colle son lien, résoudre le Hudl court
(stocker la forme intégrable) et l'avertir si sa vidéo YouTube refuse l'intégration.

**BLOCAGE** : les formulaires sont `components/shared/AthleteEditWizardMobile.tsx`
et `components/shared/AthleteWizardMobile.tsx`. La consigne d'ouverture de session
interdisait `components/shared/Athlete*` (une autre session y travaillait).
**Demander à BP si la réserve tient**, ou se rabattre sur
`app/coach/athletes/create` / `app/athlete/profil`.

Helper existant pour l'appel côté mobile : `getApiBase()` dans
`components/shared/settings/utils.ts` (le bundle statique n'a pas d'origine serveur).

### 3.2 — Rattraper les deux liens Hudl existants **(feu vert requis)**

Deux `UPDATE` sur la base de **production** — jamais sans autorisation explicite :

```
6c77efe3-bcbe-46ec-949b-5b26619e90c3  video_faits_saillants_url
  https://www.hudl.com/v/2U3ZFM
  → https://www.hudl.com/embed/video/3/26518191/6a64ce78530f1379b0c47511

(Alexy Tremblay)                      video_faits_saillants_url
  https://www.hudl.com/v/2U1kAU
  → https://www.hudl.com/embed/video/3/20700447/6a550a0c95555e24cfe6a666
```

### 3.3 — Tests sur appareil réel

- **Hudl en WKWebView** : `frame-ancestors: *` dit que ça devrait marcher dans
  l'app, mais ce n'est pas vérifié sur device.
- **YouTube en ligne sur Android** : `capacitor.config.ts` déclare déjà
  `androidScheme: 'https'`, donc l'origine est `https://localhost`. Le code coupe
  l'iframe pour **toutes** les plateformes natives d'un bloc. On s'en prive
  peut-être pour rien sur Android.

### 3.4 — iOS : limite dure, ne pas chercher de réglage

La doc officielle Capacitor embarquée dans le dépôt
(`docs/capacitor-knowledge/references/capacitor/source-docs/main/reference/config.md`)
sur `iosScheme` :

> Can't be set to schemes that the WKWebView already handles, such as http or https

L'origine iOS sera toujours `capacitor://localhost`. YouTube refuse l'intégration
depuis une origine non-http (erreur 153). Aucun réglage ne contourne ça.
Contournements possibles : page relais hébergée sur `nexussports.ca`, ou lecteur
YouTube natif via plugin. **Hudl n'est pas concerné** — il ignore l'origine.

### 3.5 — Centre d'aide

Rien à faire avant la livraison des deux dépendances (§1).

---

## 4. Astuces d'outillage à réutiliser

- **Bâtir sans modifier `tsconfig.json`** : utiliser `NEXT_DIST_DIR=.next-web`
  (déjà déclaré dans les `include` du tsconfig). Un répertoire non déclaré force
  Next à modifier le fichier, qui est suivi par git — et le remettre en état
  demanderait un `git checkout --`, interdit.
- **Référence tsc** : 70 erreurs préexistantes dans le dépôt
  (`typescript.ignoreBuildErrors: true` dans `next.config.ts`). Filtrer sur ses
  propres fichiers, pas sur le total.
- **Vérifier l'intégrabilité d'une vidéo YouTube** :
  `https://www.youtube.com/oembed?url=https://youtu.be/<ID>&format=json`
  → 200 intégrable, 401 intégration désactivée, 404 absente.
  Confirmer avec `playableInEmbed` dans le HTML de la page watch.
- **Vérifier qu'une URL accepte l'iframe** : absence de `X-Frame-Options` et
  `frame-ancestors` permissif dans les en-têtes.
- **Projet Supabase cloud** : `nrloizyemulbhujrqhgx` (c'est la production).

---

## 5. Résumé en une page

| Sujet | État | Prochaine action | Qui |
|---|---|---|---|
| `/aide` | commité `45d7f8d` + `e327d0c` | attendre les 2 dépendances avant merge | — |
| `VideoEmbed` + route | **non commité** | commiter les 2 fichiers | BP |
| Validation à la saisie | non commencé | lever la réserve `components/shared/Athlete*` | BP |
| Rattrapage Hudl en base | non fait | autoriser les 2 UPDATE en prod | BP |
| Tests sur appareil | non fait | Hudl en WKWebView, YouTube sur Android | BP |
| iOS + YouTube en ligne | impossible | décider : page relais ou plugin natif | BP |
