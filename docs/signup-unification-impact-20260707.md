# Fusion `/auth` + `/auth/pro` — analyse d'impact (2026-07-07)

Diagnostic **read-only** de l'impact d'une fusion des deux routes de signup web
(`/auth` athlète + `/auth/pro` coach/recruteur) en un flow unifié type mobile
(Option A). Aucune modification. Branche `feat/mobile-checkout` (post-merge).

---

## Executive summary

La fusion est **à risque FAIBLE-MOYEN**. **Zéro impact SEO** (les routes auth sont
exclues du `sitemap.ts` et de l'indexation — non publiques). Seulement **3 liens
de code fonctionnels** pointent vers `/auth/pro`, tous **internes** ; le reste
est du commentaire/doc périmé. Le seul point délicat est le **flux d'invitation**
(`/auth/invitation` forke athlète/pro en préservant `invitation_token`+`email`)
qu'il faut préserver. Aucun changement DB/trigger requis (le rôle continue de
passer via `signUp` metadata). Option A viable **avec précautions**.

---

## Phase 1 — Références à `/auth/pro`

### 1.1 — Liens FONCTIONNELS (à traiter si fusion)

| Fichier:ligne | Type | Contexte | À faire si fusion |
|---|---|---|---|
| `app/auth/page.tsx:354` | `<Link href="/auth/pro">` | Cross-link « TU N'ES PAS UN ATHLÈTE ? » depuis le signup athlète | → navigation interne (role picker) au lieu d'un changement de route |
| `app/auth/invitation/page.tsx:123` | `proHref = /auth/pro?invitation_token=…&email=…` | **Flux invitation** — carte « Comment vous décrivez-vous ? » forke athlète (`:122`) vs pro (`:123`) | **CRITIQUE** — router vers le flow unifié en préservant `invitation_token`+`email`+hint rôle |
| `lib/supabase/middleware.ts:38` | `publicRoutes = ['/', '/auth', '/auth/pro', …]` | Whitelist routes publiques (accès non authentifié) | nettoyer l'entrée si la route disparaît, OU garder si `/auth/pro` devient un redirect |

### 1.2 — Références NON fonctionnelles (commentaires / docs — aucun impact runtime)

- `components/mobile/auth/SignupMobile.tsx:10-12` — **commentaires PÉRIMÉS** (« Entraîneur école → router.push('/auth/pro?role=scolaire') »). Sur `feat/mobile-checkout`, `handlePickPro` fait un flow **natif** (`userType`/`setStep`), il ne route **plus** vers `/auth/pro`. Commentaires à corriger, zéro impact code.
- `app/auth/pro/page.tsx:83`, `app/auth/page.tsx:105`, `app/onboarding/page.tsx:340`, `lib/utils/translateAuthError.ts:4` — commentaires.
- `docs/post-launch-bugs.md`, `docs/phase-6*.md`, `docs/audits/*.md` — documentation historique.
- `supabase/migrations/20260520130000_*.sql:50` — commentaire dans une migration (immuable, aucun impact).

### 1.3 — SEO / marketing

- **`app/sitemap.ts`** : ne liste QUE les pages publiques marketing/légales. Commentaire `:5-6` : « Les routes auth, dashboard et app interne sont exclues via robots.ts ». → **`/auth/pro` n'est PAS dans le sitemap**.
- **`app/robots.ts`** : exclut les routes auth de l'indexation.
- **`/auth/pro`** n'a **pas de `layout.tsx`/metadata dédié** (glob : seul `page.tsx`) → pas de title/og propre à préserver.
- **Aucun lien externe** : les emails d'invitation pointent vers `/auth/invitation?token=…` (qui forke ensuite), **pas** vers `/auth/pro` directement. Aucun template email trouvé référençant `/auth/pro`.
- → **Impact SEO d'une fusion : NUL.**

---

## Phase 2 — Logique unique à `/auth/pro`

Ce qui existe **seulement** sur `/auth/pro` (pas sur `/auth` athlète) :

1. **Role picker** — `selectedRole` (`:78`), 3 cartes `scolaire`/`collegial`/`ligue_civile` (`:40-54`).
2. **`ROLE_MAP`** (`:121-123`) : `scolaire→COACH`, `collegial→RECRUTEUR`, `ligue_civile→COACH`.
3. **Champ date de naissance** (`birthdate:101`) — requis (`signupValid:116`). `/auth` athlète **n'a pas** ce champ (DOB captée à l'onboarding athlète).
4. **Pré-sélection `?role=`** (`:87`) — carte pré-cochée depuis un lien externe.
5. **`invitation_token` + `lockedEmail`** (`:76-77`, `:102`) — email verrouillé sur invitation.
6. **Redirect post-signup** → `/onboarding` (wizard coach/recruteur) vs `/athlete/onboarding` côté `/auth`.
7. **Label CTA par rôle** (`:60-62`).
8. **PAS d'OAuth** sur `/auth/pro` (à l'inverse de `/auth` qui a Google/Apple).

Logique **commune** (déjà en double, à consolider) : consentements génériques
(policy/data/marketing), champs identité/email/password, `persistInitialConsents`,
`translateAuthError`.

---

## Phase 3 — Impact d'une fusion

### 3.1 — Liens à mettre à jour

| Fichier:ligne | Ancien | Nouveau | Effort |
|---|---|---|---|
| `app/auth/page.tsx:354` | `<Link href="/auth/pro">` | navigation interne (role picker) ou `/auth?mode=pro` | trivial |
| `app/auth/invitation/page.tsx:123` | `/auth/pro?invitation_token=…&email=…` | flow unifié préservant token+email+rôle | **moyen** (préserver l'UX invitation) |
| `lib/supabase/middleware.ts:38` | `'/auth/pro'` dans publicRoutes | retirer OU garder si redirect | trivial |
| `SignupMobile.tsx:10-12` | commentaires périmés | corriger le commentaire | trivial (cosmétique) |

### 3.2 — Composants à consolider

- Les **deux formulaires de signup** (`/auth` athlète + `/auth/pro` pro) → **un seul flow** avec role picker (4 cartes type mobile) puis form conditionnel.
- **Consentements** (dupliqués `page:478-497` ⇄ `pro:110-112`) → un seul bloc.
- **Boutons OAuth** (présents `/auth`, absents `/auth/pro`) → les rendre disponibles **pour tous les rôles** (gap identifié).
- **Champ birthdate** conditionnel (requis pro + athlète mineur).
- **Context chooser** athlète (scolaire/civile) à préserver dans la branche athlète.

### 3.3 — Cas d'usage à PRÉSERVER (ne pas régresser)

1. **Invitation** : `invitation_token` + `email` verrouillé + fork rôle → doit survivre au flow unifié.
2. **Pré-sélection `?role=`** (deep-link vers un rôle).
3. **Routing rôle→onboarding** (`/onboarding` vs `/athlete/onboarding`).
4. **DOB pro** (requis adulte) + **DOB/parental athlète mineur**.
5. **Parité consentements** (policy/data obligatoires, marketing opt) — déjà OK, ne pas perdre.
6. **OAuth athlète** existant (ne pas casser) + l'étendre aux pros.

### 3.4 — Risque global de fusion

**FAIBLE-MOYEN.** Justification : (a) zéro impact SEO (routes non indexées, pas de
lien externe) ; (b) seulement 3 liens code internes à mettre à jour, aucun changement
DB/trigger (le rôle passe toujours par `signUp` metadata) ; (c) le seul point moyen
est de **préserver le flux invitation** (token+email+rôle) et de **consolider deux
formulaires** sans régresser consentements/context/birthdate/OAuth.

---

## Phase 4 — Recommandation finale

**Option A (fusion) VIABLE avec précautions.** Risque FAIBLE-MOYEN → plan avec
points de STOP :

**Ordre recommandé :**
1. Construire le flow unifié sur `/auth` (role picker 4 cartes → form conditionnel
   selon rôle, OAuth pour tous, consents communs, birthdate conditionnel). Garder
   `/auth/pro` **temporairement comme redirect** vers `/auth?role=…` (zéro casse des
   liens existants pendant la transition). **STOP — valider le flow unifié.**
2. Mettre à jour le **flux invitation** (`invitation/page.tsx:123`) vers le flow
   unifié en préservant `invitation_token`+`email`+rôle. **STOP — tester une
   invitation pro de bout en bout.**
3. Mettre à jour `app/auth/page.tsx:354` (cross-link → navigation interne) et
   nettoyer `middleware.ts:38` + les commentaires périmés.
4. Retirer `/auth/pro` (ou laisser le redirect en filet).

**Effort total estimé** : **moyen** — ~1 flow web à réécrire (fusion de 2 pages +
role picker + OAuth pro + birthdate conditionnel) + 3 liens + le flux invitation.
Pas de DB, pas de SEO, pas d'externe. Réutilisation possible du `RolePicker` mobile
(`SignupMobile.tsx:691`) comme référence UX (mais composant natif — à porter web).

**Alternatives** (si on ne veut pas fusionner) : **Option B** — garder 2 routes mais
**ajouter l'OAuth à `/auth/pro`** (ferme le gap principal sans réarchitecture) ;
**Option C** — un role picker en amont qui route vers l'une des 2 pages existantes
(compromis, garde les formulaires séparés). Option A donne la meilleure parité mobile
mais coûte le plus ; Option B est le minimum pour combler le gap OAuth pro.

---

*Diagnostic read-only — aucune modification. Doc = seul livrable. Prochaine étape =
ta décision Option A/B/C.*
