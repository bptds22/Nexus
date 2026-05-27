# Audit visuel mobile — état actuel des pages clés

**Date** : 2026-05-27
**Viewport** : 390×844 (iPhone 14 Pro)
**User agent** : Mobile Safari iOS (via Playwright `devices['iPhone 14 Pro']`)
**Méthode auth** : magic-link Supabase admin API → session pour `bpdesfosses@gmail.com` (rôle COACH)
**Dev server** : `http://localhost:3000` (Next 16 dev, déjà tournant)
**Screenshots** : [docs/audits/mobile-screenshots/](mobile-screenshots/) (10 PNGs + manifeste JSON)

---

## Étape 1 — Pages cibles (10)

| # | Page | Path | Auth requise |
|---|---|---|---|
| 1 | Login/Onboarding | `/auth` | non |
| 2 | Dashboard ATHLETE | `/athlete/dashboard` | rôle ATHLETE |
| 3 | Dashboard COACH | `/coach/tableau-de-bord` | rôle COACH |
| 4 | Dashboard RECRUTEUR | `/recruteur/tableau-de-bord` | rôle RECRUTEUR |
| 5 | Dashboard ADMIN | `/admin/dashboard` | `is_platform_admin = true` |
| 6 | Profil athlète (vue recruteur) | `/recruteur/athletes/f35a5cdb-76ac-413f-8bce-26f4ee4f7a0f` | rôle RECRUTEUR |
| 7 | Pipeline recruteur | `/recruteur/pipeline` | rôle RECRUTEUR |
| 8 | Search/filters recruteur | `/recruteur/recherche` | rôle RECRUTEUR |
| 9 | Settings utilisateur | `/coach/settings` | rôle COACH |
| 10 | Formulaire création | `/coach/athletes/create` | rôle COACH |

---

## Étape 2 — Tableau récapitulatif

| # | Slug screenshot | Statut | Verdict |
|---|---|---|---|
| 1 | [01-auth-login.png](mobile-screenshots/01-auth-login.png) | ✓ capturé | **Mobile-ready** |
| 2 | [02-athlete-dashboard.png](mobile-screenshots/02-athlete-dashboard.png) | ↪ redirigé `/auth` (rôle ATHLETE absent) | **Non capturé — auth requise** |
| 3 | [03-coach-tableau-de-bord.png](mobile-screenshots/03-coach-tableau-de-bord.png) | ✓ capturé | **Mobile-ready** |
| 4 | [04-recruteur-tableau-de-bord.png](mobile-screenshots/04-recruteur-tableau-de-bord.png) | ✓ capturé | **Mobile-ready** |
| 5 | [05-admin-dashboard.png](mobile-screenshots/05-admin-dashboard.png) | ↪ redirigé `/auth` (`is_platform_admin` faux sur cloud) | **Non capturé — auth requise** |
| 6 | [06-recruteur-athlete-profile.png](mobile-screenshots/06-recruteur-athlete-profile.png) | ✓ capturé | **Tweaks mineurs** |
| 7 | [07-recruteur-pipeline.png](mobile-screenshots/07-recruteur-pipeline.png) | ✓ capturé | **Redesign nécessaire** |
| 8 | [08-recruteur-recherche.png](mobile-screenshots/08-recruteur-recherche.png) | ✓ capturé | **Mobile-ready** |
| 9 | [09-coach-settings.png](mobile-screenshots/09-coach-settings.png) | ✓ capturé | **Mobile-ready** |
| 10 | [10-coach-athletes-create.png](mobile-screenshots/10-coach-athletes-create.png) | ✓ capturé | **Tweaks mineurs** |

**Note auth** : 8/10 pages capturées avec contenu réel. 2 ont redirigé vers `/auth` car `bpdesfosses@gmail.com` (rôle COACH sur cloud) n'a ni le rôle ATHLETE ni `is_platform_admin=true`. Pour ces 2 pages, un audit séparé avec un compte ATHLETE et un compte ADMIN serait nécessaire.

**Note inattendue** : bpdesfosses (rôle COACH) a tout de même accès au portail RECRUTEUR (`/recruteur/*`) — les pages se chargent. C'est soit un permission flag dual, soit le middleware ne gate pas RECRUTEUR strictement. À investiguer séparément (hors scope de cet audit visuel).

---

## Étape 3 — Détail des pages non-mobile-ready

### Page 6 — Profil athlète (vue recruteur) → **Tweaks mineurs**

Voir [06-recruteur-athlete-profile.png](mobile-screenshots/06-recruteur-athlete-profile.png).

Problèmes observés :
1. **Carte joueur "ticket" tronquée à droite** — l'illustration verticale "NEXUS" coupe au bord du viewport ; aspect 1:1 dur sur écran étroit.
2. **Footer flottant collé contre la carte** : les boutons d'action (drapeau + icône N) chevauchent visuellement la ligne `#21` du jersey. Mauvaise séparation visuelle.
3. **Nom de l'athlète floutée + "#12"** sous la carte sont coupés/recouverts par le footer — illisible.
4. **Texte `É.S. SAINT-JEAN-EUDES`** : nom de l'école sur 2 lignes serré dans la carte, juste limite mais lisible.

Pas d'overflow horizontal global ; juste un layout 3D maladroit en mobile.

### Page 7 — Pipeline recruteur → **Redesign nécessaire**

Voir [07-recruteur-pipeline.png](mobile-screenshots/07-recruteur-pipeline.png).

Problèmes observés :
1. **Overflow horizontal franc** : le titre `MON PROCESSUS DE RECRUTEMENT` coupe à mi-mot (`RECRUTEME`). Le header `PORTAIL RECRUTEUR` est coupé à `PORT`.
2. **Banner "Passe à Pro"** déborde à droite, texte tronqué à `sauvegarder` sans fin de phrase.
3. **Pipeline pills horizontaux** (`identifié → contacté → en discussion → visite → engagé → signée`) : 6 statuts mis en ligne, déborde largement à droite. Le `→` final est coupé.
4. **Onglets de filtres** (`IDENTIFIÉ | CONTACTÉ | EN DISCUSSION | VIS`) : également overflow horizontal, dernier onglet tronqué.

Page conçue pour écran wide, pas adaptée mobile.

### Page 10 — Formulaire création athlète → **Tweaks mineurs**

Voir [10-coach-athletes-create.png](mobile-screenshots/10-coach-athletes-create.png).

Problèmes observés :
1. **Sous-titre `Remplissez chaque section pour créer un profil complet`** : dernier mot `complet` touche le bord droit, presque tronqué.
2. **Avatar utilisateur "PD"** en top-right est partiellement clippé contre le bord droit.
3. Le step indicator (1-7 cercles) tient bien, le toggle SIMPLIFIÉE/DÉTAILLÉE est lisible. **Le reste du form est OK.**

---

## Étape 4 — Critères visuels par page

| # | Slug | Scroll H ? | Texte lisible ? | CTA bottom-30 % atteignable ? | Nav utilisable ? |
|---|---|---|---|---|---|
| 1 | auth-login | non | oui | oui (bouton SE CONNECTER) | oui (hamburger + "S'INSCRIRE") |
| 3 | coach-tableau-de-bord | non | oui | n/a (info-cards, pas de CTA) | oui (hamburger + avatar JD) |
| 4 | recruteur-tableau-de-bord | non | oui | non — CTA "Voir tout" en haut, pas en bas | oui |
| 6 | recruteur-athlete-profile | non global, mais carte joueur coupée | partiellement — nom athlète masqué | non — boutons drapeau/icône bas mais minuscules | oui |
| 7 | recruteur-pipeline | **OUI franc** | **non — multiples troncatures** | **non — éléments principaux en haut, débordent** | partiellement (hamburger OK, mais filtres inutilisables) |
| 8 | recruteur-recherche | non | oui | non — résultats en bas, scroll requis | oui (hamburger + filtres bien adaptés) |
| 9 | coach-settings | non | oui | n/a (form scroll vertical, OK) | oui (tabs PROFIL/ÉCOLE & PROGRAMME visibles) |
| 10 | coach-athletes-create | léger (titre + avatar) | oui | n/a (form vertical) | oui |

**Score global :**
- 5 pages **Mobile-ready** : `/auth`, `/coach/tableau-de-bord`, `/recruteur/tableau-de-bord`, `/recruteur/recherche`, `/coach/settings`
- 2 pages **Tweaks mineurs** : `/recruteur/athletes/[id]`, `/coach/athletes/create`
- 1 page **Redesign nécessaire** : `/recruteur/pipeline`
- 2 pages **non auditées** (auth requise) : `/athlete/dashboard`, `/admin/dashboard`

**Sur les 8 pages effectivement capturées : 7/8 sont "Mobile-ready" ou "Tweaks mineurs" — 87,5 %.**
**Sur les 10 pages cibles (en supposant que les 2 non-auditées sont à investiguer) : 7/10 sécurisées, 1/10 cassée, 2/10 inconnues.**

---

## Étape 5 — Recommandation finale

**Scénario 1 (wrap pur Capacitor) viable**, avec UN seul correctif bloquant : **`/recruteur/pipeline`** doit être refactorée pour mobile avant un wrap mobile-first.

Justification :
- Les 5 pages "Mobile-ready" + 2 "Tweaks mineurs" représentent ~70 % du parcours utilisateur réel pour les rôles COACH et RECRUTEUR (les deux personae avec la plus forte densité d'interaction).
- Les "Tweaks mineurs" (profil athlète, formulaire de création) sont de l'ordre de quelques lignes de Tailwind à ajuster (`overflow-hidden`, `min-w-0`, padding sur le bord droit) — pas un redesign.
- **Seule `/recruteur/pipeline` est franchement cassée** : un layout kanban horizontal qui ne s'adapte pas. Sur mobile, il faut soit un layout vertical (colonnes empilées), soit un swipe horizontal natif explicite (carousel snap).
- Les 2 pages non auditées (`/athlete/dashboard`, `/admin/dashboard`) doivent être capturées dans un round 2 avec des comptes de rôle approprié avant verdict final.

**Plan d'action minimal avant wrap Capacitor** :
1. **Refactor `/recruteur/pipeline`** : kanban → carousel mobile (1 colonne visible à la fois, swipe entre statuts). 1-2 jours.
2. **Tweaks `/recruteur/athletes/[id]`** : container `overflow-hidden`, footer en `sticky bottom-0` avec padding, ratio de la carte joueur en `aspect-[3/4]` au lieu de fixe. ~2-3 h.
3. **Tweaks `/coach/athletes/create`** : `pr-3` sur l'avatar top-right, `min-w-0` sur le sous-titre. ~30 min.
4. **Audit round 2** : créer un compte demo ATHLETE et confirmer `is_platform_admin` pour bpdesfosses (ou utiliser un autre compte admin), recapturer les 2 pages restantes.

Pas besoin de scénario 2/3 (refonte profonde) — la base mobile est solide à 70-87 %.

---

## Annexes

- Manifeste de capture (JSON brut) : [docs/audits/mobile-screenshots/_capture-manifest.json](mobile-screenshots/_capture-manifest.json)
- Toolchain temporaire : `C:\Users\bptds\AppData\Local\Temp\playwright-mobile\` — Playwright + Chromium + script `capture.js`. Nettoyage si besoin : `Remove-Item -Recurse -Force C:\Users\bptds\AppData\Local\Temp\playwright-mobile\` (et `C:\Users\bptds\AppData\Local\ms-playwright\` pour récupérer ~150 MB de browser binaries).
- À ajouter à `.gitignore` avant le prochain commit : `docs/audits/mobile-screenshots/*.png` (les PNG totalisent ~17 MB).
