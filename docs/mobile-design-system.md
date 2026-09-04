# Nexus — Mobile Design System

Référence canon pour toutes les pages mobile de Nexus (iOS + Android via Capacitor).
Audience cible primaire : iOS premium. Toute décision design se valide contre les standards
Apple (Photos.app, Apple Music, Instagram iOS, Linear).

Version : 1.1 — établie à partir de la page profil athlète recruteur (iter 3.0 → 3.6),
étendue avec patterns transversaux (iter 5.4 : AnimatedRoute, MobilePicker, HeartButton).
Dernière mise à jour : 2026-05-31.

---

## 1. Palette officielle

### Couleurs primaires (4 max)
- **Rouge Nexus** `#E63946` — CTA primaire, pill statut recrutement actif, indicateur tab actif, KPI cube favoris, icônes iconiques, actions destructives
- **Or** `#F59E0B` — étoiles de cote, et signal d'attention NON critique : statut EN PROCESSUS, badge « Recruté ailleurs », stages ambre du pipeline, échéance dépassée (relance en retard). JAMAIS une alerte critique — c'est le rouge.
- **Vert** `#22C55E` — checkmarks de validation, statuts finalisés positifs (ENGAGE/LETTRE_SIGNEE), toast Success
- **Gris neutre** `#6B7280` — statuts passifs (IDENTIFIE, CONTACTE), texte secondaire actif

### Backgrounds
- Page : `#111317`
- Cards et blocs : `#1A1D24` (LIGHTER que le fond — pattern card classique, pas creusé)
- Surfaces interactives (textarea, input) : `#1A1D24` ou `#0C0E12` selon contraste requis (ex: dans une sheet `#1A1D24`, les inputs passent en `#0C0E12` pour contraste interne)
- Bordures fines : `0.5px solid rgba(255,255,255,0.08)`

### Couleurs interdites
- Bleu Material `#3B82F6` (sauf badges de vérification spécifiques type checkmark bleu Twitter)
- Orange Material
- Toute couleur non listée sans validation explicite

---

## 2. Typographie

Police unique : **Outfit** (Google Fonts).

| Usage | Weight | Size mobile |
|---|---|---|
| KPI numbers | 700-900 | text-3xl à text-4xl, `tabular-nums` |
| Nom principal (athlète, titre hero) | 700-900 | text-2xl à text-3xl uppercase |
| Titres de section | 600-700 | text-xs à text-sm, uppercase, tracking-wider |
| CTA boutons | 600-700 | text-sm à text-base uppercase |
| Body content | 400-500 | text-sm à text-base |
| Labels uppercase | 500-700 | text-xs (10-11px), tracking-widest (0.15em-0.2em) |

Barlow Condensed : réservé aux displays massifs web. Pas utilisé mobile.

---

## 3. Spacing — grille 4pt

- Padding entre sections : 16px
- Padding intérieur card : 16-20px
- Gap entre 2 cards : 8-12px
- Gap label uppercase → contenu : 8px (`mb-2`)
- Safe area bottom : `env(safe-area-inset-bottom)` partout où contenu collé au bas
- Border radius cards : 12-16px (rounded-xl à rounded-2xl Tailwind)

---

## 4. Composants canon

### Card
```
backgroundColor: #1A1D24
borderRadius: 12-16px (rounded-xl à rounded-2xl)
padding: 16-20px
No border, no shadow — le contraste positif suffit
```

### Pill statut
```
rounded-full
padding: 12px horizontal, 6-8px vertical
height: ~28px
fond coloré subtle : rgba(color, 0.10-0.15)
texte : couleur pleine de la palette
optional dot indicateur à gauche (8×8px)
```

### Toggle segmented (Simplifié/Détaillé)
Pattern iOS segmented control. Fond `#1A1D24`, indicateur actif rouge plein avec texte blanc, inactif texte gris. Transitions 200ms.

### Sticky action bar bottom
- backgroundColor: `rgba(17,19,23,0.85)`
- backdropFilter: `blur(20px) saturate(180%)` (+ WebkitBackdropFilter)
- borderTop: 0.5px rgba(255,255,255,0.08)
- Hide-on-scroll-down après 200px de scroll, show-on-scroll-up
- Disabled (toujours show) quand scrollY < 100
- Caché complètement quand modal ou action sheet ouvert
- 1 CTA principal (large rouge) + max 1 action secondaire icon-only
- Transition `translateY(${visible ? 0 : 120}px)` 280ms `cubic-bezier(0.4, 0, 0.2, 1)`

### Bottom Sheet Modal
**Toujours via React Portal vers `document.body`** (pour échapper aux transforms ancêtres).
- Backdrop : opacity 0.6, fade-in 200ms
- Sheet : slide-up 280ms `cubic-bezier(0.34, 1.56, 0.64, 1)` (overshoot)
- Handle iOS : `w-10 h-1 rounded-full bg-white/20`, zone tap élargie `pt-3 pb-3`
- Background sheet : `#1A1D24`
- Swipe-down dismiss : seuil 100px, < 100 retour overshoot, > 100 close + haptic Light
- Backdrop opacity dynamique pendant drag : `max(0.2, 0.6 - drag/300)`
- z-[60] (au-dessus de MobileTabBar z-50)
- paddingBottom: `env(safe-area-inset-bottom)`, maxHeight: 85vh

### MobilePicker (iter 5.4)
Remplace **systématiquement** les `<select>` HTML natifs. Pattern Bottom Sheet identique aux modals.
- Composant : `components/mobile/MobilePicker.tsx` + hook `useMobilePicker<T>(initialValue)`
- Rendu via React Portal vers `document.body` (z-[60])
- Backdrop fade-in 200ms, sheet slide-up 280ms `cubic-bezier(0.34, 1.56, 0.64, 1)` overshoot
- Handle iOS w-10 h-1 rounded-full bg-white/20 en haut + swipe-down dismiss (seuil 100px)
- Items : touch-target **56px**, séparateurs 0.5px white/8, icône optionnelle 20px à gauche du label
- Indicateur sélection : **check rouge** `#E63946` à droite (PAS de radio vide gris — minimaliste iOS)
- Bouton "Annuler" : card séparée en bas (`mt-2`), full-width 56px, texte rouge `#E63946` font-weight 600
- Haptic Light à l'ouverture, au tap item, au dismiss
- Title optionnel en haut (text-xs uppercase tracking-wider gris)
- `maxHeight: 70vh`, `overflow-y: auto` pour longues listes

API :
```ts
type PickerOption = { value: string | number | null; label: string; icon?: ReactNode };
<MobilePicker open onClose options={[...]} value={selected} onChange={setSelected} title="..." />
```

Trigger UI à utiliser dans les pages : un `<button>` custom qui affiche `selectedLabel || placeholder` + un `<ChevronDown />` à droite. Pas de wrapper de style fourni par le composant.

### HeartButton (iter 5.4)
Toggle favori premium déployé partout (profil athlète mobile, cards Recherche, cards Favoris).
- Composant : `components/mobile/HeartButton.tsx`
- API : `<HeartButton isFavorited onToggle size? disabled? />`
- Tailles : `sm` (32px touch / 16px icon), `md` (44/24, default), `lg` (56/32)

Animations :
- **Tap inactif → actif** : haptic Light + scale `1 → 1.15 → 1` en 280ms cubic-bezier(0.34, 1.56, 0.64, 1) + color `#9CA3AF → #E63946` 200ms + icon outline → filled + halo `box-shadow 0 0 12px 2px rgba(230,57,70,0.5)` keyframe 400ms
- **Tap actif → inactif** : haptic Light + scale `1 → 0.9 → 1` en 200ms (subtle press, pas de bounce up) + color rouge → gris + filled → outline + **pas de halo**

Référence : Apple Music / Linear. **PAS Instagram** — zéro particule, zéro burst. Subtle, confident, premium.

### Action Sheet (variante du Bottom Sheet)
- Items : touch-target 56px, icône 20px à gauche, label à droite, séparateur 0.5px white/8 entre items
- Item destructif en rouge `#E63946`
- Bouton "Annuler" séparé en card distincte sous la sheet principale (gap `mt-2`), full-width 56px, texte rouge font-weight 600

### KPI cube
```
~100×100px carré minimum
fond #1A1D24
icône colorée optionnelle en haut (24px)
gros chiffre au milieu (text-3xl à 32px, font-700-900, tabular-nums)
label uppercase tracking-wider en bas (text-xs, gris)
animation count-up à l'arrivée (hook useCountUp)
```

### Top bar
- `position: fixed top-0 z-40` (ou sticky selon contexte)
- État repos (scrollY ≤ 20) : transparent, backdrop-filter 0, border transparente
- État scrolled (scrollY > 20) : `rgba(17,19,23,0.72)` + `blur(20px) saturate(180%)` + border-bottom 0.5px white/8
- Transition CSS 200ms ease-out sur les 3 propriétés
- Contenu (back, titre, menu) toujours visible — pas de fade

---

## 5. Animations

### Courbes d'easing canon
- `cubic-bezier(0.34, 1.56, 0.64, 1)` → overshoots (arrivées, retours après drag, slides-up modal)
- `cubic-bezier(0.4, 0, 0.2, 1)` → transitions neutres Material-like (hide/show, fades latéraux)
- Ease-out cubic `t => 1 - Math.pow(1 - t, 3)` → count-ups

### Durées standards
- 200ms : transitions rapides (fades, blur transitions, indicateur toggle)
- 220ms : toast slidedown
- 280ms : transitions principales (slide-up modal, slide-down, tab fade, slide indicator)
- 350ms : transitions dramatiques (arrivée hero card)
- 600-800ms : count-ups, séquences orchestrées

### À l'arrivée de page
1. Skeleton fade-pulse pendant le fetch
2. Skeleton fade-out 200ms quand data arrive (`pointer-events: none` immédiat)
3. Player card : opacity + scale + translateY, 350ms overshoot
4. Éléments en série pop one-by-one (étoiles ticket 50ms, badges distinctions 80ms)
5. KPI count-up démarre à +600ms après data
6. Total séquence : < 1200ms après fetch

### Aux interactions
- Tap CTA primaire : haptic Medium + active state CSS
- Tap card : scale 0.98 + opacity 0.9 brève (effet `active:` Tailwind)
- Tab switch : indicateur rouge slide horizontal 280ms + tab content key-remount fade
- Toggle binaire : indicateur rouge slide entre positions, 200ms
- Long-press : pas encore utilisé, à formaliser

### AnimatedRoute (iter 5.4) — slide horizontal entre tabs
Wrapper Client Component qui applique un slide horizontal natif iOS entre les tabs MobileTabBar.
- Composant : `app/recruteur/_components/AnimatedRoute.tsx`
- Stack technique : `framer-motion` (déjà installé), `<AnimatePresence mode="sync" initial={false}>`
- Direction du slide : `Math.sign(currentIndex - prevIndex)` calculé via `usePathname()` + `useRef` (index précédent)
  - `direction > 0` (nouveau tab à droite) → entre par la droite, ancien sort à gauche
  - `direction < 0` (nouveau tab à gauche) → inverse
  - `direction === 0` (même tab, drill-down) → fade simple 200ms (pas de slide horizontal)
- Durée : **280ms** (slide) ou **200ms** (fade), ease `cubic-bezier(0.4, 0, 0.2, 1)` Material standard
- `willChange: transform, opacity` pour hint GPU
- Wrappé dans le `<main>` du layout recruteur avec `position: relative; overflow-x: hidden`

**Capacitor only** : retourne `children` direct si `!IS_CAPACITOR` → zéro impact desktop.

**Limitations connues (V1)** :
- Pas de slide sur drill-down profil athlète (`/recruteur/recherche` → `/recruteur/athletes/[id]`) — fade simple uniquement, le retour est un push iOS classique
- Pas de slide hors tabs (`/recruteur/parametres`, `/recruteur/profil`) — render direct
- À étendre à `/coach` et `/athlete` dans une iter dédiée si validé sur recruteur

### Pulse dot (statut pipeline)
Keyframe `nx-breathe` 1.6s ease-in-out infinite :
```css
0%, 100% { opacity: 1; transform: scale(1); }
50% { opacity: 0.4; transform: scale(0.85); }
```

### Overscroll stretch (iOS rubber band)
```js
overscrollTranslate = pullDistance * 0.3       // friction 30%
overscrollScale = 1 + Math.min(pullDistance / 800, 0.05)  // max 5%
transformOrigin: "top center"
```
Désactivé pendant les transitions de slide et pendant les modals/sheets.

### Photo mask gradient
```css
maskImage: linear-gradient(to bottom, black 0%, black 75%, transparent 100%)
WebkitMaskImage: same
```
Sur la photo elle-même, pas sur les overlays (étoiles, nom, ticket).

### Heart burst (favori)
- Scale up overshoot du cœur principal (1 → 1.4 → 1) en 280ms `cubic-bezier(0.34, 1.56, 0.64, 1)`
- 4 mini-cœurs particules qui s'envolent en éventail (x: -22/-8/+8/+22, dy: -40px), opacity 1 → 0, scale 0.5 → 1.2, sur 600ms ease-out, décalés 0/50/100/150ms

---

## 6. Haptic feedback

Plugin : `@capacitor/haptics`. Helper module-level `triggerHaptic(intensity)` no-op silencieux si plugin absent.

| Intensité | Usage |
|---|---|
| **Light** | tap onglet, tap toggle Simple/Détaillé, tap raison signalement, ouverture modal/sheet, déplier section, item Action Sheet, swipe-down dismiss, tap raison radio |
| **Medium** | CTA primaire (Contacter), favoris (ajout), pull-to-refresh déclenché, soumission action importante (Signaler envoyé) |
| **Heavy** | Réservé erreurs/actions critiques (delete account, etc.) — pas encore utilisé |
| **Success/Warning/Error** | À utiliser pour les notifications Toast correspondantes (composant Toast unifié à venir) |

**Règle d'or** : un haptic à chaque action utilisateur qui modifie l'état ou navigue. Jamais sur scroll/hover.

---

## 7. Statuts pipeline — sémantique visuelle

| Statut | Couleur dot | Animation | Halo box-shadow |
|---|---|---|---|
| IDENTIFIE | Gris `#6B7280` | Aucune | Non |
| CONTACTE | Gris `#6B7280` | Aucune | Non |
| EN_DISCUSSION | Rouge `#E63946` | `nx-breathe` 1.6s | Oui (`rgba(230,57,70,0.15)`) |
| VISITE_PLANIFIEE | Rouge `#E63946` | `nx-breathe` 1.6s | Oui (`rgba(230,57,70,0.15)`) |
| ENGAGE | Vert `#22C55E` | Aucune | Non |
| LETTRE_SIGNEE | Vert `#22C55E` | Aucune | Non |
| Autres (DECLINE, ARCHIVE, etc.) | Pas de dot affiché | — | — |

Implémentation : constante `PIPELINE_DOT_MAP` en haut du fichier qui retourne `{ color, animated, halo }` ou `undefined`.

---

## 8. États

### Loading
Skeleton fade-pulse : blocs `#1A1D24` avec `animation: nx-pulse 1.4s ease-in-out infinite`, opacity 0.35↔0.65. Décalage `animationDelay` par bloc pour effet vague descendante (0ms, 100ms, 200ms, 300ms, 400ms). Fade-out 200ms quand `loadingData` passe à false, avec `pointer-events: none` immédiat.

```css
@keyframes nx-pulse {
  0%, 100% { opacity: 0.35; }
  50% { opacity: 0.65; }
}
```

### Empty
À formaliser. Pattern proposé : icône grise centrée 64px + titre + sous-titre explicatif + CTA optionnel.

### Error
À formaliser quand attaqué.

---

## 9. Z-index hiérarchie

| Élément | z-index |
|---|---|
| Tab content (default) | auto |
| Sticky wrappers (TabBar+Toggle) | 20-25 |
| Hero collapsed sticky | 25 |
| Top bar | 40 |
| Action bar bottom | 30 |
| MobileTabBar | 50 |
| Pull-to-refresh indicator | [55] |
| Modal Signaler / Action Sheet (Portal) | [60] |
| Toast épuré (Portal) | [100] |

---

## 10. Architecture rendering

### Containing block rules (CRITIQUE)
Tout élément qui doit se positionner par rapport au **viewport** (modals, sheets, toasts) **DOIT être rendu via React Portal vers `document.body`**. Sinon, tout ancêtre avec `transform` ou `will-change: transform` casse `position: fixed` (l'élément devient relatif à cet ancêtre).

Pattern type :
```tsx
{showModal && typeof document !== "undefined" && createPortal(
  <ModalContent />,
  document.body
)}
```

### Capacitor-specific
- Détection : `process.env.NEXT_PUBLIC_CAPACITOR_BUILD === "true"` → constante `IS_CAPACITOR`
- Rendu conditionnel composants mobile : `if (IS_CAPACITOR && viewerMode === "recruiter") return <ComposantMobile />`
- `backdrop-filter` : supporté iOS Safari et Android Chrome récents. Toujours dupliquer en `WebkitBackdropFilter`.
- Safe areas : `env(safe-area-inset-bottom)`, `env(safe-area-inset-top)` partout où contenu touche les bords
- Share API : `@capacitor/share` Share.share() en priorité, fallback `navigator.share` Web Share API, fallback `navigator.clipboard.writeText` + toast "Lien copié"
- Haptics : `@capacitor/haptics` Haptics.impact({ style }) — helper `triggerHaptic` factorisé

### Layout flow collapsibles
Quand un élément flow doit "slider hors écran ET libérer sa place" :
- `transform: translateY(-X)` pour le slide visuel
- `marginBottom: -X_layout` pour libérer la place (plafonné à la hauteur réelle de flux, ex `HERO_LAYOUT_HEIGHT=800`)
- Découpler les 2 valeurs : translate peut dépasser pour garantir le hors-écran, marginBottom reste à la hauteur réelle pour ne pas casser le scroll global

---

## 10.5. Patterns interdits ❌

Patterns à NE PAS introduire — chacun a une alternative canon :

| Interdit | Pourquoi | Alternative |
|---|---|---|
| `<select>` HTML natif | Look/feel système incohérent entre iOS/Android, accessibilité douteuse, non-stylable | **MobilePicker** (§4) |
| Particules / burst animations sur boutons d'action (style Instagram heart burst) | "Kids feeling", over-engineered, dégrade le ressenti premium | Animation subtle scale + glow (cf. **HeartButton** §4) |
| `<dialog>` HTML natif sans portal | Containing-block trap quand wrappé dans un ancêtre `transform` | **Bottom Sheet Modal** via `createPortal` vers `document.body` (§4) |
| `position: fixed` direct dans un composant page | Casse si un layout/wrapper ancêtre a `transform`/`will-change` | Toujours `createPortal` vers `document.body` |
| Couleurs hors palette (bleu Material, orange Material, etc.) | Conflit identité de marque | Palette officielle §1 (rouge/or/vert/gris uniquement) |
| Animations `width`/`height`/`top`/`left` | Force layout reflow → janky sur device bas de gamme | `transform` + `opacity` uniquement (GPU-friendly) |

## 11. Patterns parkés pour V2

- Pinch-to-zoom + long-press menus sur photos
- Reflet EA Sports sur player card
- Vidéos auto-play en silent dans le feed
- Transitions inter-pages avancées (shared element)
- Skeleton variants par type de page (search, pipeline, dashboard)

---

## 12. Patterns à introduire (roadmap court terme)

- **Composant Toast unifié Dynamic Island style** (success/error/warning/info) — prochaine itération
- **Transitions inter-pages** entre tabs MobileTabBar (slide horizontal natif)
- **Empty states formalisés** sur les listes vides
- **Error states formalisés** avec retry CTA
- **Composant `<MobileBottomSheet />`** générique réutilisable (extraction du pattern de la modal Signaler)
- **Composant `<MobileActionSheet />`** générique réutilisable (extraction du pattern du menu 3-points)
- **Composant `<MobileTopBar />`** générique réutilisable (dynamic blur intégré)

---

## 13. Référence d'implémentation

Page de référence canonique : `components/shared/AthleteRecruiterProfileBodyMobile.tsx`.
Tous les patterns décrits ici y sont implémentés et validés à travers les itérations 3.0 → 3.6.

À consulter en priorité avant d'introduire un nouveau pattern sur une autre page mobile.

---

## 14. Patterns prouvés (iter 7.x — sprint Capacitor)

Ajout : itérations 7.0 → 7.10 — canon mobile recruteur. Mise à jour : 2026-06-03.

### 14.1 FADE PHOTO single-surface
Mécanisme hero / cards / trending. Composition à 3 z dans **UN seul container** :
1. Photo raw : `<img>` plein bleed (sans gradient mask).
2. Gradient overlay : `absolute inset-x-0 bottom-0 h-2/3` avec `linear-gradient(to top, <surface-color> 0%, <surface-rgba .85> 35%, transparent 70%)`. **Le bas du gradient finit OPAQUE sur la couleur de la surface parent** (pas transparent).
3. Texte / overlay : `z-10` au-dessus.

Vertical (athlete cards, trending) ET horizontal (Pipeline photo-gauche). **Jamais 2 boîtes empilées** (= dilution + ligne perceptible à la jonction). Implémentation canonique : [AthleteCardMobile](../components/shared/RecruteurRechercheMobile.tsx).

### 14.2 Type scale carte athlète
- **Nom** : 16px `font-bold` (text-base font-bold)
- **Position / meta** : 13px
- **Cote** : 14px `font-bold tabular-nums`
- **Labels section** : 11–12px uppercase tracking-wider

### 14.3 Terminologie
Toujours **« processus »** en UI. Jamais « pipeline » (terme interne dev/DB). La table reste `recruiter_pipeline`, l'UI dit « processus ».

### 14.4 Funnel survival%
Modèle cold-call (canon Iter 7.3) :
- Pour stage k : `survival_k = (sum counts[k..N]) / total`, donc monotone décroissant.
- Visualisation : barres rétrécissantes vers la droite (chaque stage plus court que le précédent).
- **Pas de ratio adjacent** (count[k]/count[k-1]) — visuellement bruité et faux modèle.

### 14.5 Hero Dashboard recruteur
- Card alignée aux **marges page** (`px-4`), pas full-bleed.
- Background : `linear-gradient(135deg, #E63946 0%, #B82834 60%, #7F1B25 100%)`, `minHeight: 260`.
- Marque X : **2 couches pleines** (canon Iter 7.10) :
  - icon-black.svg, opacité 0.95, position HAUT-GAUCHE
  - icon-red.svg, opacité 0.95, position BAS-DROITE (offset +12 top, +12 right vs noir)
  - Même taille (~300px), `overflow-hidden` card → cut bas-droite
  - Pointe haute du noir affleure la pill CÉGEP top-right
- Headline + bloc contenu : `max-w-[62%]` → jamais croisé par le X.
- **Pas de blanc, pas de liseré fin** : 2 logos pleins offset = profondeur banner FCB.

### 14.6 Bulles thread Messages (exception couleurs)
**SEULE exception** au rouge Nexus dans l'app :
- Recruteur (moi) : **`#0A84FF`** (iOS Messages blue)
- Coach (interlocuteur) : **`#262628`** (iOS dark grey)
- Tout le reste de l'app reste rouge Nexus action/marque.
- Justification : volume de bulles plein rouge fatigant + rouge dans `bg` perd sa charge sémantique d'action.

### 14.7 Review coach — modèle A
- Contrainte UNIQUE : `coach_reviews(recruiter_id, coach_id)` — **une éval par coach par recruteur**, peu importe l'athlète.
- `athlete_id` reste colonne de contexte (dernière review faite à propos de) mais n'entre PAS dans l'unicité.
- Hook : `useMyCoachReview(coachId)` → scoped (recruteur, coach) uniquement.
- Mutation : `useSubmitCoachReview` upsert sur (recruteur, coach), `existingId` détermine UPDATE vs INSERT.
- Migration de référence : `supabase/migrations/20260603150000_coach_reviews_revert_to_unique_per_coach.sql`.

### 14.8 Sheets — pattern coach + athlète
- **Sheet coach** : `top-down` (initial/exit `y: "-100%"`, ancré `top-0`, `rounded-b-3xl`). Bouton fermer = icône X dans cercle `bg-white/[0.06]`. Action d'édition (Modifier/Annuler/Enregistrer) dans la **barre titre** (à droite), pas dans le corps de section. Édition INLINE (pas de 2e sheet) : seed-on-entry depuis l'existant, reset-on-close. Pattern panneau iOS Settings.
- **Sheet athlète** : `bottom-up` (initial/exit `y: "100%"`, ancré `bottom-0`, `rounded-t-3xl`), handle iOS top, `maxHeight: 85vh`. **READ-ONLY** (option α) : photo, nom, position acronyme, école, promo, status, cote, profil complété %, CTA « Voir le profil complet ». **Pas d'auto-insert pipeline** sans accord explicite.
- **Re-tap toggle** : tap sur l'élément qui ouvre le sheet → ferme s'il est déjà ouvert (`setOpen(v => !v)`). Pattern iOS standard.

### 14.9 Verified
- Badge **CHECK ✓ dans cercle bleu `#3B82F6`**, inline `next-to-name`.
- **JAMAIS** une étoile (étoile ambre `#F59E0B` = cote/rating uniquement).
- Implémentation : `<span class="rounded-full bg-[#3B82F6]"> <svg polyline="20 6 9 17 4 12" stroke="#fff" /> </span>`.

### 14.10 Carte athlète — composant partagé
- `AthleteCardMobile` (export depuis `components/shared/RecruteurRechercheMobile.tsx`).
- **Réutilisé** : Recherche, Favoris, Trending (Dashboard).
- Props `lastTabKey` pour back-nav contextuelle (Section 14.13).
- Pas de duplication : étendre les props avant de répliquer.

### 14.11 LEÇON bordures — 4 registres à auditer
Une « ligne » qui résiste à plusieurs itérations peut venir de **4 registres** :
1. Classes Tailwind `border-t` / `border-b` / `border-{color}` 
2. Styles inline `borderTop` / `borderBottom`
3. `box-shadow` (notamment `0 1px 0` ou `inset 0 -1px 0`)
4. Pseudo-éléments `::after` / `::before` avec `content` + `border`

Auditer LES 4, pas seulement les classes Tailwind. Sticky avec `backdrop-blur` peut aussi paraître comme une ligne (Iter 7.10 — diag profil).

### 14.12 Animation retrait liste (favoris, etc.)
- Grille wrappée en `<AnimatePresence mode="popLayout">`.
- Chaque carte en `<motion.div layout key={id}>` avec :
  - `initial={{ opacity: 0, scale: 0.92 }}`
  - `animate={{ opacity: 1, scale: 1 }}`
  - `exit={{ opacity: 0, scale: 0.85 }}`
  - `transition={{ duration: 0.25, ease: [0.34, 1.56, 0.64, 1] }}` (cubic-bezier canon)
- L'optimistic remove (via `setQueryData`) déclenche l'exit ; `layout` provoque le reflow des restantes.

### 14.13 Back-nav contextuelle
- Avant `router.push` vers un profil athlète : poser `sessionStorage.setItem("lastRecruiterTab", "<key>")`.
- Le profil athlète back lit la clé et route en conséquence :
  - `"pipeline"` → `/recruteur/pipeline`
  - `"favoris"` → `/recruteur/favoris`
  - default → `/recruteur/recherche`
- Implémentation côté carte : prop `lastTabKey` (Iter 7.10 Section 3).
- Implémentation côté profil : [AthleteRecruiterProfileBodyMobile.tsx](../components/shared/AthleteRecruiterProfileBodyMobile.tsx) handler du bouton retour (cherche `lastRecruiterTab`).
