# Inventaire scope mobile — toutes les pages de `app/`

**Date** : 2026-05-27
**Méthode** : READ-ONLY. Inventaire de tous les `page.tsx` sous `app/`. Pour chaque page : path exact, type server/client (présence ou non de `"use client"` en tête), titre/description, et auth requise (heuristique combinée — segment du path, présence d'imports `lib/supabase/server`, appels à `getSession`/`getUser`, redirects vers `/auth`).

**Légende type** : **S** = server component, **C** = client component (`"use client"`).
**Légende auth** : `oui` = role-gated ou session requise ; `non` = public.

---

## Section A — Pages publiques (racine, sans auth)

| Path | Type | Description | Auth |
|---|---|---|---|
| [app/page.tsx](app/page.tsx) | C | Landing principal — `Home` (hero, sections marketing) | non |
| [app/a-propos/page.tsx](app/a-propos/page.tsx) | C | « À propos » — page marketing fondateur/mission | non |
| [app/comment-ca-marche/page.tsx](app/comment-ca-marche/page.tsx) | C | « Comment ça marche » — explication produit | non |
| [app/pour-les-coachs/page.tsx](app/pour-les-coachs/page.tsx) | C | Landing dédié coachs | non |
| [app/pour-les-recruteurs/page.tsx](app/pour-les-recruteurs/page.tsx) | C | Landing dédié recruteurs | non |
| [app/pour-les-etudiant-athlete/page.tsx](app/pour-les-etudiant-athlete/page.tsx) | C | Landing dédié athlètes | non |
| [app/tarifs/page.tsx](app/tarifs/page.tsx) | C | Page de pricing (free/pro/all-star par persona) | non |
| [app/roadmap/page.tsx](app/roadmap/page.tsx) | C | Roadmap publique | non |
| [app/guide-recrutement/page.tsx](app/guide-recrutement/page.tsx) | C | Guide de recrutement (contenu éditorial) | non |
| [app/contact/page.tsx](app/contact/page.tsx) | C | Formulaire de contact | non |
| [app/confidentialite/page.tsx](app/confidentialite/page.tsx) | C | Politique de confidentialité (Loi 25) | non |
| [app/conditions/page.tsx](app/conditions/page.tsx) | C | Conditions d'utilisation | non |
| [app/collecte-donnees/page.tsx](app/collecte-donnees/page.tsx) | C | Avis collecte des données personnelles (Loi 25) | non |
| [app/communications-marketing/page.tsx](app/communications-marketing/page.tsx) | C | Politique communications marketing | non |
| [app/partenaires/[id]/page.tsx](app/partenaires/[id]/page.tsx) | S | Profil public partenaire (vue externe — pas `/partenaire/*`) | non |
| [app/test-animation/page.tsx](app/test-animation/page.tsx) | S | Page de test animation (dev-only, à retirer du build prod) | non |

**Total Section A : 16 pages**

---

## Section B — Auth

Pages d'authentification — accessibles sans session active. Quelques-unes (invitation, invite-admin, pending) sont semi-publiques (token URL).

| Path | Type | Description | Auth |
|---|---|---|---|
| [app/auth/page.tsx](app/auth/page.tsx) | C | Login + signup (tab toggle) | non |
| [app/auth/pro/page.tsx](app/auth/pro/page.tsx) | C | Signup flow Pro (Stripe à venir) — « Rejoins Nexus » | non |
| [app/auth/pending/page.tsx](app/auth/pending/page.tsx) | C | État d'attente après signup (vérif email / approbation admin) | non |
| [app/auth/verification-email/page.tsx](app/auth/verification-email/page.tsx) | C | Confirmation après envoi email de vérification | non |
| [app/auth/reinitialiser/page.tsx](app/auth/reinitialiser/page.tsx) | C | Reset password (lien email) | non |
| [app/auth/invite/page.tsx](app/auth/invite/page.tsx) | C | Accept invitation user (lien token) | non |
| [app/auth/invite-admin/page.tsx](app/auth/invite-admin/page.tsx) | C | Accept invitation admin (lien token) | non |
| [app/auth/invitation/page.tsx](app/auth/invitation/page.tsx) | C | « Invitation invalide » (fallback token expiré/cassé) | non |
| [app/mot-de-passe-oublie/page.tsx](app/mot-de-passe-oublie/page.tsx) | C | Formulaire « mot de passe oublié » (envoi du magic link reset) | non |

**Total Section B : 9 pages**

---

## Section C — Onboarding

Onboarding global + onboarding-spécifique athlète (post-signup, avant attribution complète du rôle).

| Path | Type | Description | Auth |
|---|---|---|---|
| [app/onboarding/page.tsx](app/onboarding/page.tsx) | C | Onboarding multi-étapes (profil, sport, école/ligue civile, équipe). Branche coach/recruteur via paramètre rôle | oui |
| [app/athlete/onboarding/page.tsx](app/athlete/onboarding/page.tsx) | C | Onboarding athlète post-signup (sport, école, parents, consentement) | oui |

**Total Section C : 2 pages**

---

## Section D — Athlètes

Portail athlète. Toutes auth-gated par convention (layout parent role-checked).

| Path | Type | Description | Auth |
|---|---|---|---|
| [app/athlete/page.tsx](app/athlete/page.tsx) | S | Index — redirect vers `/athlete/dashboard` | oui |
| [app/athlete/dashboard/page.tsx](app/athlete/dashboard/page.tsx) | C | Dashboard athlète (vue d'ensemble) | oui |
| [app/athlete/profil/page.tsx](app/athlete/profil/page.tsx) | C | « Mon profil » — édition profil complet | oui |
| [app/athlete/mon-parcours/page.tsx](app/athlete/mon-parcours/page.tsx) | C | « Mon parcours » — académique + sportif | oui |
| [app/athlete/visibilite/page.tsx](app/athlete/visibilite/page.tsx) | C | « Ma visibilité » — contrôle visibility | oui |
| [app/athlete/notifications/page.tsx](app/athlete/notifications/page.tsx) | C | Notifications athlète | oui |
| [app/athlete/parametres/page.tsx](app/athlete/parametres/page.tsx) | C | Paramètres compte athlète | oui |

**Total Section D : 7 pages**

---

## Section E — Coachs

Portail coach + sous-section école (`/coach/ecole/*`) pour les coachs `is_school_admin`.

| Path | Type | Description | Auth |
|---|---|---|---|
| [app/coach/page.tsx](app/coach/page.tsx) | C | Index — redirect vers `/coach/tableau-de-bord` | oui |
| [app/coach/tableau-de-bord/page.tsx](app/coach/tableau-de-bord/page.tsx) | C | Dashboard coach (KPI roster + vues recruteurs) | oui |
| [app/coach/activites/page.tsx](app/coach/activites/page.tsx) | C | Feed d'activités coach | oui |
| [app/coach/athletes/page.tsx](app/coach/athletes/page.tsx) | C | Roster (liste des athlètes du coach) | oui |
| [app/coach/athletes/[id]/page.tsx](app/coach/athletes/[id]/page.tsx) | C | Profil athlète vu par le coach | oui |
| [app/coach/athletes/[id]/apercu/page.tsx](app/coach/athletes/[id]/apercu/page.tsx) | C | `ApercuRedirect` — redirect vers profil simplifié | oui |
| [app/coach/athletes/[id]/modifier/page.tsx](app/coach/athletes/[id]/modifier/page.tsx) | C | Wizard édition athlète (7 étapes) | oui |
| [app/coach/athletes/create/page.tsx](app/coach/athletes/create/page.tsx) | C | Wizard création athlète (7 étapes) | oui |
| [app/coach/demandes/page.tsx](app/coach/demandes/page.tsx) | C | Liste des messages/demandes reçus de recruteurs | oui |
| [app/coach/demandes/[id]/page.tsx](app/coach/demandes/[id]/page.tsx) | C | Thread de conversation avec un recruteur | oui |
| [app/coach/demandes/nouveau/page.tsx](app/coach/demandes/nouveau/page.tsx) | C | Composer un message à un recruteur | oui |
| [app/coach/equipes/page.tsx](app/coach/equipes/page.tsx) | C | « Mes équipes » — listing | oui |
| [app/coach/equipes/[teamId]/page.tsx](app/coach/equipes/[teamId]/page.tsx) | C | Détail d'une équipe | oui |
| [app/coach/suggestions/page.tsx](app/coach/suggestions/page.tsx) | C | « Suggestions des athlètes » — modifs suggérées par les athlètes | oui |
| [app/coach/reputation/page.tsx](app/coach/reputation/page.tsx) | S | « Ma réputation » — page publique du coach (vue recruteur miroir) | oui |
| [app/coach/settings/page.tsx](app/coach/settings/page.tsx) | C | Paramètres compte coach | oui |
| [app/coach/ecole/page.tsx](app/coach/ecole/page.tsx) | C | Dashboard école (école-admin only) | oui |
| [app/coach/ecole/coachs/page.tsx](app/coach/ecole/coachs/page.tsx) | C | Liste des coachs de l'école | oui |
| [app/coach/ecole/coachs/[coachId]/page.tsx](app/coach/ecole/coachs/[coachId]/page.tsx) | C | Détail d'un coach (vue admin école) | oui |
| [app/coach/ecole/placements/page.tsx](app/coach/ecole/placements/page.tsx) | C | Placements (lettres signées) au niveau école | oui |
| [app/coach/ecole/stats/page.tsx](app/coach/ecole/stats/page.tsx) | C | Stats école (athlètes, vues, conversion) | oui |
| [app/coach/ecole/analytics/page.tsx](app/coach/ecole/analytics/page.tsx) | C | Analytique école (graphes, tendances) | oui |

**Total Section E : 22 pages**

---

## Section F — Recruteurs

Portail recruteur + sous-section CÉGEP (`/recruteur/cegep/*`) pour les recruteurs `is_school_admin` côté CÉGEP.

| Path | Type | Description | Auth |
|---|---|---|---|
| [app/recruteur/page.tsx](app/recruteur/page.tsx) | S | Index — redirect vers `/recruteur/tableau-de-bord` | oui |
| [app/recruteur/tableau-de-bord/page.tsx](app/recruteur/tableau-de-bord/page.tsx) | C | Dashboard recruteur (pipeline + messages) | oui |
| [app/recruteur/recherche/page.tsx](app/recruteur/recherche/page.tsx) | C | Recherche d'athlètes (filtres avancés) | oui |
| [app/recruteur/athletes/[id]/page.tsx](app/recruteur/athletes/[id]/page.tsx) | C | Profil athlète vue recruteur | oui |
| [app/recruteur/favoris/page.tsx](app/recruteur/favoris/page.tsx) | C | « Mes favoris » — athlètes mis en favori | oui |
| [app/recruteur/listes/page.tsx](app/recruteur/listes/page.tsx) | C | Listes de prospects custom (Pro only) | oui |
| [app/recruteur/pipeline/page.tsx](app/recruteur/pipeline/page.tsx) | C | « Mon processus de recrutement » — kanban (page cassée mobile) | oui |
| [app/recruteur/messages/page.tsx](app/recruteur/messages/page.tsx) | C | Inbox messages recruteur | oui |
| [app/recruteur/messages/[id]/page.tsx](app/recruteur/messages/[id]/page.tsx) | C | Thread de conversation avec un coach | oui |
| [app/recruteur/messages/nouveau/page.tsx](app/recruteur/messages/nouveau/page.tsx) | C | Composer un nouveau message | oui |
| [app/recruteur/activites/page.tsx](app/recruteur/activites/page.tsx) | C | Feed d'activités recruteur | oui |
| [app/recruteur/profil/page.tsx](app/recruteur/profil/page.tsx) | C | « Mon profil » recruteur | oui |
| [app/recruteur/parametres/page.tsx](app/recruteur/parametres/page.tsx) | C | Paramètres compte recruteur | oui |
| [app/recruteur/cegep/page.tsx](app/recruteur/cegep/page.tsx) | C | Dashboard CÉGEP (CÉGEP-admin only) | oui |
| [app/recruteur/cegep/recruteurs/page.tsx](app/recruteur/cegep/recruteurs/page.tsx) | C | Recruteurs au sein du CÉGEP | oui |
| [app/recruteur/cegep/entraineurs/[id]/page.tsx](app/recruteur/cegep/entraineurs/[id]/page.tsx) | C | Détail entraîneur (vue CÉGEP-admin) | oui |
| [app/recruteur/cegep/recrues/page.tsx](app/recruteur/cegep/recrues/page.tsx) | C | Recrues du CÉGEP | oui |
| [app/recruteur/cegep/reassignation/page.tsx](app/recruteur/cegep/reassignation/page.tsx) | C | Réassignation d'athlètes entre recruteurs | oui |
| [app/recruteur/cegep/stats/page.tsx](app/recruteur/cegep/stats/page.tsx) | C | Stats CÉGEP | oui |

**Total Section F : 19 pages**

---

## Section G — Partenaires (portail interne)

Portail partenaires médias — `app/partenaire/*` (singulier) auth-gated, vs `app/partenaires/[id]` (pluriel) en Section A (profil public).

| Path | Type | Description | Auth |
|---|---|---|---|
| [app/partenaire/page.tsx](app/partenaire/page.tsx) | C | Dashboard partenaire | oui |
| [app/partenaire/bienvenue/page.tsx](app/partenaire/bienvenue/page.tsx) | C | « Bienvenue sur Nexus » — landing post-onboarding partenaire | oui |
| [app/partenaire/athletes/page.tsx](app/partenaire/athletes/page.tsx) | S | Recherche athlètes (vue partenaire — accès media) | oui |
| [app/partenaire/athletes/[id]/page.tsx](app/partenaire/athletes/[id]/page.tsx) | C | Profil athlète vue partenaire | oui |
| [app/partenaire/classements/page.tsx](app/partenaire/classements/page.tsx) | S | Classements (média analytics) | oui |
| [app/partenaire/tendances/page.tsx](app/partenaire/tendances/page.tsx) | S | Tendances (média analytics) | oui |
| [app/partenaire/newsroom/page.tsx](app/partenaire/newsroom/page.tsx) | S | Newsroom partenaire | oui |
| [app/partenaire/telechargements/page.tsx](app/partenaire/telechargements/page.tsx) | S | Téléchargements (assets téléchargeables) | oui |
| [app/partenaire/profil/page.tsx](app/partenaire/profil/page.tsx) | C | Profil partenaire (édition) | oui |

**Total Section G : 9 pages**

---

## Section H — Admin

Portail admin platform (`is_platform_admin = true`).

| Path | Type | Description | Auth |
|---|---|---|---|
| [app/admin/page.tsx](app/admin/page.tsx) | S | Index — redirect vers `/admin/dashboard` | oui |
| [app/admin/dashboard/page.tsx](app/admin/dashboard/page.tsx) | C | Dashboard admin (KPI plateforme) | oui |
| [app/admin/users/page.tsx](app/admin/users/page.tsx) | C | Gestion utilisateurs | oui |
| [app/admin/athletes/page.tsx](app/admin/athletes/page.tsx) | C | Tous les athlètes (admin view) | oui |
| [app/admin/athletes/[id]/page.tsx](app/admin/athletes/[id]/page.tsx) | C | Détail athlète (admin view) | oui |
| [app/admin/recruteurs/page.tsx](app/admin/recruteurs/page.tsx) | C | Tous les recruteurs | oui |
| [app/admin/schools/page.tsx](app/admin/schools/page.tsx) | C | Liste écoles + CÉGEPs | oui |
| [app/admin/schools/[id]/page.tsx](app/admin/schools/[id]/page.tsx) | C | Détail école/CÉGEP | oui |
| [app/admin/sports/page.tsx](app/admin/sports/page.tsx) | C | Référentiel sports | oui |
| [app/admin/sports/[id]/page.tsx](app/admin/sports/[id]/page.tsx) | C | Détail d'un sport (positions, etc.) | oui |
| [app/admin/partenaires/page.tsx](app/admin/partenaires/page.tsx) | C | Gestion des partenaires médias | oui |
| [app/admin/pipeline/page.tsx](app/admin/pipeline/page.tsx) | C | Vue pipeline cross-recruteurs | oui |
| [app/admin/pipeline/[id]/page.tsx](app/admin/pipeline/[id]/page.tsx) | C | Détail recruteur (admin vue pipeline) | oui |
| [app/admin/approvals/page.tsx](app/admin/approvals/page.tsx) | C | File d'attente des approbations (admin claims) | oui |
| [app/admin/moderation/page.tsx](app/admin/moderation/page.tsx) | C | Modération (signalements, vidéos, etc.) | oui |
| [app/admin/desactivations/page.tsx](app/admin/desactivations/page.tsx) | C | Désactivations utilisateurs | oui |
| [app/admin/subscriptions/page.tsx](app/admin/subscriptions/page.tsx) | C | Subscriptions (tiers, billing) | oui |
| [app/admin/analytics/page.tsx](app/admin/analytics/page.tsx) | C | Analytique plateforme | oui |
| [app/admin/loi25/page.tsx](app/admin/loi25/page.tsx) | C | Console Loi 25 (incidents, RPRP, etc.) | oui |
| [app/admin/settings/page.tsx](app/admin/settings/page.tsx) | C | Paramètres système (app_settings) | oui |

**Total Section H : 20 pages**

---

## Section I — Autres (system pages)

| Path | Type | Description | Auth |
|---|---|---|---|
| [app/maintenance/page.tsx](app/maintenance/page.tsx) | S | Page maintenance globale (Loi 25, downtime planifié) | non |
| [app/compte-desactive/page.tsx](app/compte-desactive/page.tsx) | S | Landing affiché aux comptes désactivés | non |

**Total Section I : 2 pages**

---

## Tableau récapitulatif

| Section | Catégorie | Auth | Server | Client | Total |
|---|---|---|---|---|---|
| **A** | Publiques (marketing + légal + tests) | 0 | 2 | 14 | **16** |
| **B** | Auth (login, signup, reset, invites) | 0 | 0 | 9 | **9** |
| **C** | Onboarding | 2 | 0 | 2 | **2** |
| **D** | Athlètes | 7 | 1 | 6 | **7** |
| **E** | Coachs (+ école) | 22 | 1 | 21 | **22** |
| **F** | Recruteurs (+ CÉGEP) | 19 | 1 | 18 | **19** |
| **G** | Partenaires (portail) | 9 | 5 | 4 | **9** |
| **H** | Admin | 20 | 1 | 19 | **20** |
| **I** | System pages (maintenance, désactivé) | 0 | 2 | 0 | **2** |
| | **TOTAL** | **79** | **13** | **92** | **105** |

**Auth-gated** : 79 / 105 (75 %).
**Server components** : 13 / 105 (12 %). Concentrés en Section G (Partenaires : 5/9) — c'est la section avec le plus gros risque static export car les pages partenaires lisent les cookies SSR pour le rôle.
**Routes dynamiques `[id]`** : ~15 dans le code (`partenaires/[id]`, `partenaire/athletes/[id]`, `coach/athletes/[id]`, `coach/athletes/[id]/apercu`, `coach/athletes/[id]/modifier`, `coach/demandes/[id]`, `coach/equipes/[teamId]`, `coach/ecole/coachs/[coachId]`, `recruteur/athletes/[id]`, `recruteur/messages/[id]`, `recruteur/cegep/entraineurs/[id]`, `admin/athletes/[id]`, `admin/pipeline/[id]`, `admin/schools/[id]`, `admin/sports/[id]`).

---

## Recommandation cadrage scope mobile

Pour un wrap Capacitor mobile **MVP** (objectif : auth + parcours principal coach/recruteur), les sections à inclure :

- **Inclure** : Section B (auth), Section C (onboarding), Section D (athlètes), Section E (coachs hors `/ecole/*`), Section F (recruteurs hors `/cegep/*`), Section A (juste `/auth`, `/maintenance`, `/compte-desactive`).
- **Exclure** : Section H (admin — pas un workflow mobile-first), Section G (partenaires — niche), Section A marketing (`/`, `/tarifs`, `/comment-ca-marche`, `/pour-les-*`, `/a-propos`, `/contact`, `/roadmap`, `/guide-recrutement`, `/confidentialite`, `/conditions`, `/collecte-donnees`, `/communications-marketing` — vivent sur le web seulement, accédées via le navigateur depuis l'app si besoin via `@capacitor/browser`).
- **Cas à part** : `/coach/ecole/*` (5 pages) et `/recruteur/cegep/*` (6 pages) sont des admin-tools internes pour `is_school_admin` — pas critiques mobile MVP, à exclure aussi.

**Scope mobile MVP estimé** :
- B (9) + C (2) + D (7) + E sans ecole/* (17) + F sans cegep/* (13) + A système (`/auth`, `/maintenance`, `/compte-desactive`, `/mot-de-passe-oublie` — 4)
- **= ~52 pages** sur 105 (50 % du total)

Les autres 53 pages restent web-only via le wrap navigateur natif (`@capacitor/browser`) si l'utilisateur en a besoin (admin partner, marketing, pricing).
