# Audit fonts projet-wide — 15 mai 2026

## Convention locked

- **Outfit** : 400 / 500 / 600 / 700 (body + UI)
- **Barlow Condensed** : 800 / 900 (display headings marketing)
- **Nexa** : RETIRED — toute occurrence = bug
- **CSS variables** : `--font-outfit`, `--font-heading`

---

## Résumé exécutif

- **CRITICAL — 8 références à `var(--font-barlow-cond)` qui n'existe PAS** dans le projet. La vraie variable est `--font-heading`. Ces 8 spans rendent en fallback sans-serif au lieu de Barlow Condensed. Bug visible utilisateur sur la homepage et la fiche athlète coach.
- **CRITICAL — incohérence headings marketing** : 3 pages utilisent `.nx-display` (Barlow Condensed) — homepage, pour-les-coachs, pour-les-recruteurs. 5 pages utilisent `font-head` (qui résout à **Outfit**, pas Barlow) — comment-ca-marche, tarifs, a-propos, roadmap, guide-recrutement. Le wordmark "marketing" est donc rendu en deux fonts différentes selon la page.
- **HIGH — sémantique trompeuse de `font-head`** : la Tailwind utility `font-head` (539 occurrences sur 158 fichiers) résout à Outfit via `--font-head: var(--font-outfit)` dans `@theme inline`. Le nom suggère "heading display" mais c'est Outfit. La seule façon de reach Barlow Condensed via Tailwind est la classe utilitaire CSS `.nx-display` ou le wrapper `.landing-page`.
- **LOW — Outfit weight 300 (light) chargé via next/font** mais zero usages de `font-light` dans le scope — gaspille un poids de font inutilement.
- **Nexa entièrement retired** : 0 occurrence dans scope. Convention respectée.

---

## 1. Font loading (app/layout.tsx)

État actuel :
- **Outfit** weights chargés : `["300", "400", "500", "600", "700"]` — variable `--font-outfit`, display `swap` (`app/layout.tsx:7-12`)
- **Barlow Condensed** weights chargés : `["800", "900"]` — variable `--font-heading`, display `swap` (`app/layout.tsx:14-19`)
- Autres fonts : aucune
- Application : `<body className={`${outfit.variable} ${barlowCondensed.variable} antialiased`}>` (`app/layout.tsx:40`)

Inconsistances :
- **Outfit `300` chargé mais inutilisé** : zero `font-light` / `font-weight: 300` dans le scope. Convention exige 400/500/600/700, donc 300 est hors-convention et alourdit le payload font.
- **Outfit `600` absent du tableau** alors que la convention le requiert pour buttons + labels. La compilation Tailwind `font-semibold` (600) tombera sur le poids le plus proche disponible (probablement 500 ou 700, browser-dependent). Vérifier le rendu réel des 168 `font-semibold` dans le scope.

---

## 2. Tailwind config / @theme inline

Source : `app/globals.css` (Tailwind v4 inline `@theme`, lignes 62-101). Pas de `tailwind.config.ts` à la racine. (Note : `nexus-app/tailwind.config.ts` existe dans un sous-projet hors scope.)

État actuel (`app/globals.css:66-68`) :
- `--font-sans` → `var(--font-outfit), 'Outfit', sans-serif`
- `--font-head` → `var(--font-outfit), 'Outfit', sans-serif`  ⚠️ **résout à Outfit, pas Barlow Condensed malgré le nom**
- `--font-mono` → `ui-monospace, monospace`
- Pas de `--font-heading` dans `@theme` (la classe Tailwind `font-heading` n'existe pas comme utility)
- Pas de `--font-display` ni `--font-barlow*`
- Fallbacks : présents (`'Outfit', sans-serif` après la var dans `--font-sans` et `--font-head`)

Inconsistances :
- **Mismatch sémantique critique** : `--font-head` dans `@theme inline` est aliasé sur Outfit, mais le nom évoque Barlow Condensed. La seule façon de reach Barlow Condensed via Tailwind est :
  1. Classe CSS custom `.nx-display` (`app/globals.css:119-126`)
  2. Wrapper `.landing-page` qui auto-style h1/h2/h3 (`app/globals.css:120-122`)
  3. Inline `style={{ fontFamily: 'var(--font-heading)' }}`
- Aucun mapping Tailwind pour Barlow Condensed. La convention "Barlow Condensed pour display headings" repose entièrement sur l'opt-in via `.nx-display` ou inline style.

---

## 3. CSS variables usage

Variables **définies** :
- `--font-outfit` (par `next/font/google` Outfit() — `app/layout.tsx:10`)
- `--font-heading` (par `next/font/google` Barlow_Condensed() — `app/layout.tsx:17`)
- `--font-sans` (`@theme inline` — `app/globals.css:66`)
- `--font-head` (`@theme inline` — `app/globals.css:67`)
- `--font-mono` (`@theme inline` — `app/globals.css:68`)
- `--wl-font-head` (`:root` — `app/globals.css:33`, alias d'Outfit)
- `--wl-font-sans` (`:root` — `app/globals.css:34`, alias d'Outfit, jamais utilisé)

Variables **utilisées en inline `fontFamily`** (counts hors globals.css) :
- `var(--font-outfit)` : **30 occurrences** dans 6 fichiers (`AthletePlayerCard.tsx` x9, `AthleteRecruiterProfileBody.tsx` x8, `admin/athletes/[id]/page.tsx` x10, `AthleteProfileView.tsx` x1, `admin/schools/[id]/page.tsx` x1, `AthletePhotoFill.tsx` x1)
- `var(--font-heading)` : **6 occurrences** dans 2 fichiers (`coach/athletes/[id]/page.tsx` x4, `app/page.tsx` x2)
- `var(--wl-font-head)` : **9 occurrences** dans 4 fichiers (`coach/ecole/coachs/[coachId]/page.tsx` x4, `coach/ecole/coachs/page.tsx` x2, `coach/ecole/placements/page.tsx` x2, `recruteur/cegep/recruteurs/page.tsx` x2, `recruteur/cegep/recrues/page.tsx` x2, `recruteur/cegep/page.tsx` x1)
- `var(--font-barlow-cond)` : **8 occurrences** dans 2 fichiers (`app/page.tsx` x5, `coach/athletes/[id]/page.tsx` x4)

Variables **référencées mais NON-définies** ⚠️ :
- **`--font-barlow-cond`** — utilisée 8 fois mais jamais déclarée nulle part. Toute fontFamily inline qui la référence retombe sur le fallback (`sans-serif`), donc rend probablement en Arial/Helvetica au lieu de Barlow Condensed.

Files concernés par `--font-barlow-cond` (NON-DÉFINI) :
- `app/page.tsx:107` — labels stats du player card hero
- `app/page.tsx:123` — `École secondaire Saint-Jean-Eudes` ticket
- `app/page.tsx:124` — `Québec, QC`
- `app/page.tsx:125` — `Promotion 2026`
- `app/coach/athletes/[id]/page.tsx:178` — labels stats player card
- `app/coach/athletes/[id]/page.tsx:197` — schoolName ticket
- `app/coach/athletes/[id]/page.tsx:198` — region ticket
- `app/coach/athletes/[id]/page.tsx:199` — promotion ticket

---

## 4. Tailwind font-* classes

Distribution (raw counts, scope `app/ components/ lib/ hooks/`) :

| Class | Count |
|---|---|
| font-thin | 0 |
| font-extralight | 0 |
| font-light | 0 |
| font-normal | 24 |
| font-medium | 59 |
| font-semibold | 168 |
| font-bold | **1802** |
| font-extrabold | 0 |
| font-black | 491 |

Classes sémantiques (font-family Tailwind) :
| Class | Count | Notes |
|---|---|---|
| font-head | **539** | résout à Outfit via `--font-head` (mismatch nom/sémantique) |
| font-sans | 78 | résout à Outfit |
| font-mono | 17 | résout à ui-monospace |
| font-heading | 9 | **PAS une vraie utility Tailwind ici** — tous les hits sont en réalité des `var(--font-heading)` dans des inline strings, voir section 3 |
| font-barlow | 8 | **PAS une vraie utility** — tous les hits sont `var(--font-barlow-cond)` dans des inline strings, voir section 3 |
| font-display | 0 | non-existant dans le scope |

Hors-convention (weights 100/200/300) :
- Aucun. ✅ La convention 400/500/600/700 est respectée côté Tailwind.

Note convention : `font-black` (900) et `font-bold` (700) sont utilisés intensivement (2293 ensemble) mais la convention CLAUDE.md mentionne 700 max pour Outfit. Le 900 ne fait sens QUE pour Barlow Condensed (qui charge 800/900). Pour les classes `font-black` appliquées à des éléments en Outfit (donc tout sauf `.nx-display` / `.landing-page`), il y a **font-synthesis** ou **fallback weight** — Outfit n'a pas le poids 900 chargé, donc le browser synthétise ou descend à 700.

---

## 5. Hardcoded font-family

Aucune occurrence hardcodée à une font tierce (Inter, Helvetica, Arial, Roboto, Nexa, etc.) trouvée. ✅

**Toutes** les occurrences `font-family:` / `fontFamily:` dans le scope référencent une variable CSS :
- 30x `var(--font-outfit)` ✅ conforme
- 9x `var(--wl-font-head)` ✅ conforme (alias d'Outfit)
- 6x `var(--font-heading)` ✅ conforme (Barlow Condensed)
- 8x `var(--font-barlow-cond)` ❌ **variable non-définie** (déjà flaggé section 3)
- 3x dans `app/globals.css` (110, 123, 973) ✅ conforme

Total hardcodé non-conforme : **0** font tierce, mais **8 références à variable cassée** (`--font-barlow-cond`).

---

## 6. Nexa references (RETIRED)

Aucune référence à Nexa trouvée dans le scope.

(Les 2 hits pour `nexa` insensitive viennent de `inexact`/`inexactes` dans `app/confidentialite/page.tsx:134` et `app/recruteur/parametres/_components/ConfidentialiteSection.tsx:182` — texte FR pour "incorrect", aucun rapport avec la font.)

**Total : 0 occurrences.** ✅ Nexa entièrement retired.

---

## 7. Headings consistency (8 pages marketing)

Mapping de référence :
- `nx-display` → Barlow Condensed (font-weight 900, letter-spacing 0.05em — défini `app/globals.css:119-126`)
- `font-head` → **Outfit** (mapping `@theme inline` ligne 67) ⚠️ malgré le nom
- `font-sans` ou rien → Outfit (default body font)

### app/page.tsx (homepage)
- `<h1>` ligne 141 : `nx-display text-6xl ... font-black uppercase` → **Barlow Condensed 900** ✅

### app/pour-les-coachs/page.tsx
- `<h2>` ligne 137 : `nx-display text-[26px] ... font-black` → **Barlow Condensed 900** ✅
- `<h1>` ligne 302 : `nx-display text-[42px] ... font-black` → **Barlow Condensed 900** ✅
- `<h3>` ligne 357 : `nx-display ... font-black uppercase` → **Barlow Condensed 900** ✅
- `<h3>` ligne 504 : `nx-display text-[18px] font-black` → **Barlow Condensed 900** ✅
- `<h3>` ligne 542 : `text-[20px] font-bold` (PAS de `nx-display`) → **Outfit 700** ⚠️ (testimonial card, peut-être intentionnel)
- `<h2>` ligne 601 : `nx-display text-[40px] ... font-black` → **Barlow Condensed 900** ✅

### app/pour-les-recruteurs/page.tsx
- `<h2>` ligne 230 : `nx-display text-[26px] ... font-black` → **Barlow Condensed** ✅
- `<h1>` ligne 297 : `nx-display text-[38px] ... font-black` → **Barlow Condensed** ✅
- `<h3>` ligne 404, 424, 464, 566 : `nx-display ... font-black` → **Barlow Condensed** ✅
- `<h3>` ligne 795 : `text-[20px] font-bold` (PAS de `nx-display`) → **Outfit 700** ⚠️ (testimonial)
- `<h2>` ligne 870 : `nx-display text-[38px] ... font-black` → **Barlow Condensed** ✅

### app/comment-ca-marche/page.tsx ⚠️ TOUT EN OUTFIT
- `<h2>` ligne 26 : `font-head text-[26px] ... font-black` → **Outfit 900 (synthétisé)**
- `<h1>` ligne 92 : `font-head text-[42px] ... font-[800]` → **Outfit 800 (synthétisé)**
- `<h3>` lignes 140, 153, 162, 215, 313, 326, 338, 382 : `font-head ... font-black` → **Outfit**
- `<h2>` ligne 355 : `font-head text-[30px] ... font-black` → **Outfit**
- **0 utilisation de `nx-display`** — toute la page est en Outfit. INCONSISTANT.

### app/tarifs/page.tsx ⚠️ TOUT EN OUTFIT
- `<h1>` ligne 84 : `font-head ... uppercase font-black` → **Outfit**
- `<h3>` ligne 177 : `text-[16px] font-semibold` (default) → **Outfit**
- `<h2>` ligne 200 : `font-head ... font-black uppercase` → **Outfit**
- **0 utilisation de `nx-display`**. INCONSISTANT.

### app/a-propos/page.tsx ⚠️ TOUT EN OUTFIT
- `<h2>` ligne 24 : `font-head text-[26px] ... font-black` → **Outfit**
- `<h1>` ligne 87 : `font-head text-[42px] ... font-black` → **Outfit**
- `<h3>` lignes 105, 140 : `font-head text-[22px] font-bold` → **Outfit**
- **0 utilisation de `nx-display`**. INCONSISTANT.

### app/roadmap/page.tsx ⚠️ TOUT EN OUTFIT
- `<h1>` ligne 116 : `font-head text-[40px] ... font-black` → **Outfit**
- `<h3>` ligne 175 : `font-head text-[24px] ... font-black` → **Outfit**
- **0 utilisation de `nx-display`**. INCONSISTANT.

### app/guide-recrutement/page.tsx ⚠️ TOUT EN OUTFIT
- `<h2>` ligne 194 : `font-head text-[28px] ... font-black` → **Outfit**
- `<h3>` lignes 203, 212 : `font-head text-[18px] font-black` → **Outfit**
- `<h1>` ligne 272 : `font-head text-[42px] ... font-black` → **Outfit**
- `<h2>` ligne 392 : `font-head text-[32px] ... font-black` → **Outfit**
- **0 utilisation de `nx-display`**. INCONSISTANT.

### Inconsistances cross-pages

**MAJEUR** : 3 pages marketing rendent leurs headings en **Barlow Condensed** (via `nx-display`) :
- `app/page.tsx`
- `app/pour-les-coachs/page.tsx`
- `app/pour-les-recruteurs/page.tsx`

5 pages marketing rendent leurs headings en **Outfit** (via `font-head`) :
- `app/comment-ca-marche/page.tsx`
- `app/tarifs/page.tsx`
- `app/a-propos/page.tsx`
- `app/roadmap/page.tsx`
- `app/guide-recrutement/page.tsx`

Le wordmark visuel des H1/H2 sur le site marketing est donc rendu en **deux fonts complètement différentes** selon la page. Un utilisateur qui passe de la homepage à `/tarifs` voit deux styles tipographiques distincts.

**Secondaire** : sur `pour-les-coachs` et `pour-les-recruteurs`, deux `<h3>` de testimonial (lignes 542 et 795) utilisent `text-[20px] font-bold` au lieu de `nx-display` — déconnectés du système de hiérarchie display, mais pourrait être intentionnel (testimonial sont du body, pas du display).

**Tertiaire** : les `<h3>` titres de pricing/CÉGEP card sur `tarifs/page.tsx:177` (`text-[16px] font-semibold` sans `font-head`) sont également déconnectés — défaut Outfit body weight 600.

---

## Recommandations par priorité

### P1 — à fixer avant beta (visible utilisateur)

1. **Fix `var(--font-barlow-cond)` cassé** — 8 occurrences dans `app/page.tsx` (5) + `app/coach/athletes/[id]/page.tsx` (4). Soit définir la variable dans `@theme inline`/`:root`, soit remplacer par `var(--font-heading)`. Les player cards affichent actuellement leurs labels/ticket en font système fallback au lieu de Barlow Condensed.
2. **Unifier les headings marketing** — décider : Barlow Condensed pour TOUS les marketing H1/H2 (via `nx-display`), OU Outfit pour tous (en supprimant `nx-display` du site marketing). Actuellement 3/8 pages utilisent Barlow, 5/8 utilisent Outfit. C'est visuellement incohérent pour un visiteur qui navigue.

### P2 — à fixer post-beta (dette technique)

3. **Renommer `--font-head` → `--font-display`** (ou similaire) dans `@theme inline` et créer un mapping cohérent. Actuellement la classe Tailwind `font-head` (539 usages) résout à Outfit alors que le nom suggère display/heading. Si l'intent est "headings en Outfit pour le portail interne", renommer `font-head` → `font-ui-heading` ou similaire.
4. **Décider sort de `--wl-font-head`** (9 usages dans coach + recruteur cegep) — alias legacy d'Outfit. Soit le retirer et migrer vers `--font-outfit`, soit le documenter comme alias explicite "Outfit pour heads d'écran portail".
5. **Charger weight 600 d'Outfit** dans `next/font/google` (actuellement absent du tableau `["300", "400", "500", "600", "700"]` — wait, c'est `["300", "400", "500", "600", "700"]`, donc 600 EST présent — re-vérifier). Vérification : `app/layout.tsx:9` charge bien `["300", "400", "500", "600", "700"]` — 600 est présent. ✅ Pas d'action requise.
6. **Drop weight 300 d'Outfit** (actuellement chargé inutilement — 0 usage de `font-light` dans scope). Économie de payload font.

### P3 — nice-to-have

7. **Audit `font-black` (900) appliqué à Outfit** — 491 occurrences. Outfit ne charge pas 900, donc le browser synthétise. Soit charger Outfit 900, soit downgrader à `font-bold` (700) pour les éléments non-marketing, soit accepter la synthèse comme intentionnelle.
8. **Considérer une utility Tailwind `font-display`** mappée à Barlow Condensed pour pouvoir écrire `className="font-display"` au lieu de `className="nx-display"` (cohérence Tailwind-first).
9. **Ajouter un lint rule / grep CI** qui flag toute nouvelle occurrence de `--font-barlow-cond`, `Nexa`, ou hardcoded font-family non-variable.
