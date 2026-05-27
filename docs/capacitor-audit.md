# Capacitor / static-export audit

## TL;DR
- **Blockers** : 6 (1 cookies SSR, 3 API routes, 1 middleware actif, 1 `force-dynamic`)
- **Warnings** : 3 (5 `<Image>` sans `unoptimized`, 9 server components avec fetch SSR, auth cookies → localStorage)
- **Info** : 1 (15 routes `[id]` sans `generateStaticParams`, mais 14/15 ne sont pas prerenderables — switch en client-fetch acceptable)
- **`next.config.ts`** : pas de `output: 'export'` configuré aujourd'hui ; build sert un Node server (Vercel/Coolify).
- **Verdict** : **Migration modérée — décisions stratégiques requises** (essentiellement : que faire de `/api/admin/partners/create` qui requiert la service-role).

---

## Section 5 — Blockers static export

### 5.1 `"use server"` (Server Actions)
**0 occurrences.** Grep `"use server"|'use server'` sur `{app,lib,components}/**/*.{ts,tsx}` : aucun fichier. Le code n'utilise pas de Server Actions. ✓

### 5.2 API routes (`app/api/**/route.ts`)
**3 routes.** Pour chacune :

| Route | Fait quoi | Migration possible |
|---|---|---|
| `app/api/admin/partners/create/route.ts` | Crée un compte partenaire : lit `SUPABASE_SERVICE_ROLE_KEY` (ligne 79), instancie un client `createSbClient` admin, génère un mot de passe temporaire, appelle `auth.admin.createUser`, insère dans `media_partners`. | **Doit rester serverless** (Edge Function Supabase, ou route web séparée). La service-role NE peut PAS être bundlée dans le client mobile. Alternative : retirer l'invitation partenaire du mobile (admin-only desktop). |
| `app/api/partner/cards/log-download/route.ts` | Audit Loi 25 : auth, vérifie `is_partner_eligible_athlete()`, insère dans `partner_card_downloads`. Aucun secret côté serveur — seulement de la validation. | **Convertible en appel Supabase direct** côté client. La RLS sur `partner_card_downloads` peut gérer la validation (en y intégrant `is_partner_eligible_athlete()` dans le WITH CHECK). |
| `app/api/partner/profile-views/log/route.ts` | Identique au pattern ci-dessus : auth, eligibility check, INSERT `partner_profile_views`. | **Convertible en appel Supabase direct** côté client, même approche. |

### 5.3 Middleware (`middleware.ts`)
**1 middleware actif.** Gate `/partenaire/*` (hors `/partenaire/bienvenue`) : si le user est PARTNER et que `terms_accepted_at` OU `password_reset_completed_at` est NULL, redirige vers `/partenaire/bienvenue`.

- **Peut-on s'en passer en mobile** : oui. La logique de gate est triviale (deux lectures DB, un redirect) et doit basculer dans `app/partenaire/layout.tsx` (client) avec un `useEffect` qui vérifie l'état et fait `router.replace('/partenaire/bienvenue')` si incomplet. Le `lib/supabase/middleware.ts` dormant (qui gate les portails par rôle) ne tourne pas en production — son contenu doit également migrer vers des guards de layout client.

### 5.4 `cookies()` / `headers()` de `next/headers`
**1 occurrence.** [`lib/supabase/server.ts:2`](lib/supabase/server.ts#L2) — import `cookies` pour instancier `createServerClient` avec un cookie adapter.

Conséquence : tout ce qui importe `@/lib/supabase/server` est un server component / API route et lit la session via les cookies HTTP. En mobile statique, il n'y a pas de cookies SSR. Il faut :
- Supprimer ou ignorer `lib/supabase/server.ts` pour la build mobile.
- Remplacer chaque consumer par `@/lib/supabase/client` (browser client, `localStorage`-based session).

### 5.5 Routes dynamiques sans `generateStaticParams`
**15 routes `[*]/page.tsx`, 0 avec `generateStaticParams`** :

```
app/cegeps/[id]/page.tsx
app/ecoles/[id]/page.tsx
app/partenaires/[id]/page.tsx              ← server component (createServerClient)
app/recruteur/athletes/[id]/page.tsx       ← client (thin wrapper)
app/admin/sports/[id]/page.tsx             ← client
app/coach/demandes/[id]/page.tsx           ← client
app/coach/ecole/coachs/[coachId]/page.tsx  ← client
app/recruteur/messages/[id]/page.tsx       ← client
app/coach/equipes/[teamId]/page.tsx        ← client
app/recruteur/cegep/entraineurs/[id]/page.tsx ← client
app/partenaire/athletes/[id]/page.tsx      ← client
app/admin/schools/[id]/page.tsx            ← client
app/coach/athletes/[id]/page.tsx           ← client
app/admin/athletes/[id]/page.tsx           ← client
app/admin/pipeline/[id]/page.tsx           ← client
```

Plus 2 sous-routes : `app/coach/athletes/[id]/modifier/page.tsx`, `app/coach/athletes/[id]/apercu/page.tsx` (toutes deux client).

Classification :

| Route | Type | Cardinalité | Verdict |
|---|---|---|---|
| `cegeps/[id]` | server (placeholder, await params) | ~69 CÉGEPs (DB) | **Prerenderable** via `generateStaticParams` listant les CÉGEPs au build. Bonus : reste un placeholder, donc générer 69 pages identiques coûte rien. |
| `ecoles/[id]` | server (placeholder, await params) | ~830 écoles secondaires | **Prerenderable**. 830 pages au build reste raisonnable. |
| `partenaires/[id]` | server (SSR fetch via createServerClient) | <30 partenaires | **Prerenderable** ou switch client-fetch — petite cardinalité, à choisir selon préférence. |
| `recruteur/athletes/[id]` | client | 5000+ athlètes | **Non-prerenderable**. Doit basculer en client-fetch par UUID (déjà la cas — déjà client). |
| `admin/athletes/[id]` | client | idem | **Non-prerenderable**. Déjà client. |
| `admin/sports/[id]` | client | 16 sports | **Prerenderable** trivial (16 pages). |
| `admin/schools/[id]` | client | ~1163 schools | **Non-prerenderable** pratiquement (volume), garder en client-fetch. |
| `admin/pipeline/[id]` | client | UUIDs internes | **Non-prerenderable**. |
| `coach/athletes/[id]` (+ `/modifier`, `/apercu`) | client | per-athlete | **Non-prerenderable**. |
| `coach/demandes/[id]` | client | per-demande | **Non-prerenderable**. |
| `coach/ecole/coachs/[coachId]` | client | per-coach | **Non-prerenderable**. |
| `coach/equipes/[teamId]` | client | 563 teams | **Non-prerenderable** pratiquement. |
| `partenaire/athletes/[id]` | client | per-athlete | **Non-prerenderable**. |
| `recruteur/cegep/entraineurs/[id]` | client | per-coach | **Non-prerenderable**. |
| `recruteur/messages/[id]` | client | per-conversation | **Non-prerenderable**. |

Pour les non-prerenderables sous `output: 'export'`, l'approche standard est `generateStaticParams` retournant `[]` + `dynamicParams = true` est **interdite en export**. Il faut soit :
- Utiliser un seul shell `app/recruteur/athletes/[id]/page.tsx` qui rend une coquille statique, et un client component qui lit `params.id` puis fetch — fonctionne tant que la coquille n'utilise pas `params` au render initial.
- OU rerouter ces vues via un router client (hash-based) qui ne dépend pas de path segments dynamiques au build.

### 5.6 `export const dynamic = 'force-dynamic'`
**1 occurrence.** [`app/maintenance/page.tsx:5`](app/maintenance/page.tsx#L5) — `export const dynamic = "force-dynamic";`. Incompatible avec `output: 'export'`. À retirer ou la page sera ignorée à la build.

---

## Section 6 — Warnings

### 6.1 `<Image>` sans `unoptimized`
**5 usages, 0 avec `unoptimized` prop, 0 avec `images: { unoptimized: true }` dans `next.config.ts`** :

- `components/ui/NexusLogo.tsx` (1 usage)
- `components/ui/BrowserMockup.tsx` (1 usage)
- `app/coach/settings/_components/ProfileSection.tsx` (3 usages)

Sous `output: 'export'`, `next/image` requiert `images: { unoptimized: true }` dans `next.config.ts` (sinon la build échoue avec `Image Optimization using the default loader is not compatible with export`). Ajouter le réglage couvre les 5 usages en une ligne.

### 6.2 `revalidatePath` / `revalidateTag`
**0 occurrences.** ✓ Rien à supprimer.

### 6.3 Auth via cookies SSR
[`lib/supabase/server.ts`](lib/supabase/server.ts) et [`lib/supabase/middleware.ts`](lib/supabase/middleware.ts) lisent `cookies()` pour persister la session côté serveur. [`lib/supabase/client.ts`](lib/supabase/client.ts) utilise `createBrowserClient` de `@supabase/ssr` qui partage le même cookie store (et écrit dans les cookies du document, lisible aussi côté serveur).

Pour mobile :
- Switch de `createBrowserClient` (`@supabase/ssr`) vers `createClient` directement de `@supabase/supabase-js` avec `auth: { persistSession: true, autoRefreshToken: true, storage: window.localStorage }` (ou Capacitor `Preferences`).
- Supprimer `lib/supabase/server.ts`, `lib/supabase/middleware.ts`, et la dépendance `@supabase/ssr` du bundle mobile.

### 6.4 `force-dynamic` / `revalidate`
Vu en 5.6 — uniquement `app/maintenance/page.tsx`.

---

## Section 7 — Env vars

| Variable | Public ? | Usage | Compatible static export ? |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ public | `lib/supabase/{client,server,middleware}.ts`, `lib/client.ts`, `app/api/admin/partners/create/route.ts` | ✅ Disponible au build, inclus dans le bundle |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ public | Mêmes fichiers | ✅ Idem |
| `SUPABASE_SERVICE_ROLE_KEY` | ❌ private | `app/api/admin/partners/create/route.ts:79` (uniquement server-side) | ⚠️ NON dispo au runtime mobile. La route entière doit migrer (Edge Function ou retrait). Le secret ne doit JAMAIS être bundlé dans le client. |
| `NEXT_PUBLIC_APP_URL` | ✅ public | `.env.local` (présent mais grep ne montre pas d'usage runtime — vérifier) | ✅ Si utilisé, OK |
| `NODE_ENV` | implicite | Dev-only guards : `components/subscription/SubscriptionSection.tsx`, `components/dev/DevTierSwitcher.tsx`, `app/recruteur/parametres/page.tsx` | ✅ Injecté au build par Next.js — vaut `production` dans le bundle final |

**Aucune variable non-public utilisée côté client.** ✓ La seule à risque, `SUPABASE_SERVICE_ROLE_KEY`, est confinée à la route API serverless qui de toute façon ne peut pas survivre à un static export.

---

## Section 8 — Dépendances suspectes

### 8.1 Libs requérant Node runtime côté client
Grep `fs\.readFile|require\(['"]fs['"]\)|child_process` sur `{app,components,lib}/**/*.{ts,tsx}` → **0 matches**. ✓ Aucun usage de modules Node-only côté client.

### 8.2 `package.json` — déps client-safe ?

```jsonc
"@dnd-kit/core": "^6.3.1",          // client-only, OK
"@dnd-kit/sortable": "^10.0.0",     // client-only, OK
"@supabase/ssr": "^0.10.0",         // ⚠️ sert le pattern cookie SSR — à retirer en mobile
"@supabase/supabase-js": "^2.100.1",// ✓ utilisable en pur client
"framer-motion": "^12.38.0",        // client-only, OK
"html-to-image": "^1.11.13",        // client-only (canvas API), OK
"jszip": "^3.10.1",                 // client-safe, OK
"lucide-react": "^1.8.0",           // SVG icons, OK
"next": "16.1.6",                   // doit supporter output: 'export' (vérifier docs Next 16)
"react": "19.2.3",                  // OK
"react-dom": "19.2.3",              // OK
"recharts": "^3.8.0"                // client-only charts, OK
```

`@supabase/ssr` est la seule dépendance qui ne sert qu'au mode SSR. En mobile elle peut rester installée (tree-shaking) mais ne doit plus être importée — `lib/supabase/client.ts` actuellement importe `createBrowserClient` de `@supabase/ssr`. À switcher.

### 8.3 `next/dynamic` avec `ssr: false`
**0 occurrences.** Pas de hints d'imports SSR-incompatibles. ✓

---

## Section 9 — Plan de remédiation (ordre recommandé)

### Étape 1 — Trivial : config `next.config.ts`
Ajouter `output: 'export'` (gaté sur env var `CAPACITOR_BUILD=true` pour ne pas casser la build web) + `images: { unoptimized: true }` + `trailingSlash: true` (recommandé pour Capacitor file:// URLs). **Résout 5.6 (déclenche le mode export) + 6.1 (Image)**. Complexité : trivial. Pas de dépendance.

### Étape 2 — Trivial : retirer `force-dynamic`
[`app/maintenance/page.tsx:5`](app/maintenance/page.tsx#L5) — supprimer `export const dynamic = "force-dynamic";`. La page reste statique sans cette ligne. **Résout 5.6**. Complexité : trivial.

### Étape 3 — Modéré : switch auth `@supabase/ssr` → `@supabase/supabase-js`
Réécrire `lib/supabase/client.ts` pour utiliser `createClient` de `@supabase/supabase-js` avec `auth.persistSession: true` + `storage: window.localStorage` (ou Capacitor Preferences plus tard). Supprimer les imports de `lib/supabase/server.ts` et `lib/supabase/middleware.ts` du bundle mobile (via env-guarded build ou conditional import). **Résout 5.4 + 6.3**. Complexité : modéré. Dépendance : aucune.

### Étape 4 — Modéré : éliminer le middleware
Migrer la logique du gate `/partenaire/*` vers `app/partenaire/layout.tsx` (client) : `useEffect` lit `media_partners.terms_accepted_at` + `password_reset_completed_at`, redirige vers `/partenaire/bienvenue` si NULL. Supprimer `middleware.ts`. **Résout 5.3**. Complexité : modéré. Dépendance : Étape 3.

### Étape 5 — Modéré : convertir les server components en client
9 server components consomment `lib/supabase/server` : `app/admin/layout.tsx`, `app/partenaire/{telechargements,athletes,newsroom,tendances,classements}/page.tsx`, `app/partenaires/[id]/page.tsx`, `app/maintenance/page.tsx`. Chacun doit devenir client (`"use client"`) avec `useEffect` pour le fetch + état `loading`. Les guards SSR (admin layout, partenaire layout) basculent en garde client (redirect via `router.replace` si pas autorisé). **Résout 5.4 (consumers de server.ts)**. Complexité : modéré, mécanique. Dépendance : Étape 3.

### Étape 6 — Modéré : remplacer les 2 API routes "log-only"
`/api/partner/cards/log-download` et `/api/partner/profile-views/log` : convertir en INSERT direct depuis le client. Tightening RLS sur `partner_card_downloads` et `partner_profile_views` pour inclure le check `is_partner_eligible_athlete(athlete_id)` dans le WITH CHECK (au lieu de la validation faite manuellement dans la route). **Résout 2/3 routes en 5.2**. Complexité : modéré, nécessite une migration SQL. Dépendance : aucune (peut être fait avant Capacitor).

### Étape 7 — Complexe : décision sur `/api/admin/partners/create`
Trois options selon Section 10 Q1 :
- (a) Edge Function Supabase (`supabase/functions/admin-create-partner/index.ts`) qui réplique la logique avec service-role. Le client mobile invoque `supabase.functions.invoke('admin-create-partner', {...})`.
- (b) Garder une route serverless séparée (ex. déployée sur Vercel/Coolify) appelable par le mobile via HTTPS. Le mobile devient hybride.
- (c) Retirer l'invitation partenaire du mobile et la garder admin-only desktop.

**Résout 5.2 dernière route**. Complexité : complexe. Dépendance : décision business.

### Étape 8 — Modéré : prerendering des routes prerenderables
Ajouter `generateStaticParams` aux 4 routes prerenderables : `cegeps/[id]` (69), `ecoles/[id]` (830), `partenaires/[id]` (<30), `admin/sports/[id]` (16). Pour les autres `[id]` non-prerenderables, basculer vers une coquille statique qui hydrate côté client à partir de `useParams()`. **Résout 5.5**. Complexité : modéré. Dépendance : Étape 1.

### Étape 9 — Trivial : nettoyer `force-dynamic` résiduel + auditer le build
Build complet `CAPACITOR_BUILD=true next build` → corriger toute erreur résiduelle. Tester sur Capacitor (iOS simulator + Android). Complexité : trivial à modéré selon les surprises de runtime mobile.

---

## Section 10 — Questions ouvertes (décision Bruno-Philippe requise)

### Q1 — `/api/admin/partners/create` : Edge Function, web séparé, ou retrait ?
- **Pourquoi ça compte** : c'est la seule route qui utilise `SUPABASE_SERVICE_ROLE_KEY`. La service-role ne peut PAS aller dans le bundle mobile. Cette route doit soit migrer vers un environnement serverless différent, soit être retirée du mobile.
- **Options** :
  - (a) **Edge Function Supabase** : `supabase functions deploy admin-create-partner`. Self-contained dans le projet Supabase, déjà infrastructuré, scale automatique, accessible via `supabase.functions.invoke()`. Recommandé.
  - (b) **Web app séparée** : garder une instance Next.js web déployée sur OVH/Coolify avec cette route, mobile l'appelle via HTTPS. Plus de surface à maintenir.
  - (c) **Retirer du mobile** : invitation partenaire reste admin-desktop uniquement. Pas d'impact si la création de partenaire est rare (1-2 fois par semaine).

### Q2 — Les pages `partenaire/*` doivent-elles être incluses dans le mobile ?
- **Pourquoi ça compte** : le portail partenaire est le module le plus dépendant du backend (5 server components qui font des SSR queries). Le migrer en client-fetch est mécanique mais ajoute du scope à la première version mobile.
- **Options** :
  - (a) Inclure tout le portail partenaire dans le mobile.
  - (b) Exclure partenaire du mobile v1 — coachs/recruteurs/athlètes seulement. Réduit le scope de l'Étape 5 de 9 → 1 server component (`admin/layout.tsx`) + ses sous-pages.
  - (c) Mobile v1 = athlètes/coachs uniquement (le use case "découverte"), recruteurs et partenaires sur desktop. Maximum de scope-cutting.

### Q3 — Cookies vs localStorage pour l'auth : impact sur le SSO Google ?
- **Pourquoi ça compte** : la migration vers `localStorage` casse le SSO Google si on l'active plus tard (le callback OAuth retourne via cookies). Aujourd'hui le SSO Google est désactivé (boutons `<button onClick={socialToast}>` qui ne font qu'un toast Phase 2), donc pas de blocker immédiat. Mais si l'objectif est "mobile + SSO Google plus tard", le pattern Capacitor pour OAuth devient un sujet à part (`@capacitor/browser` + custom URL scheme handler).
- **Options** :
  - (a) Migrer auth localStorage maintenant, OAuth Google reste désactivé. Décision OAuth séparée.
  - (b) Décider de l'architecture OAuth maintenant pour éviter de re-réécrire l'auth deux fois.

### Q4 — `cegeps/[id]` et `ecoles/[id]` placeholders : prerender ou retirer ?
- **Pourquoi ça compte** : ces 2 routes sont des placeholders (lisent juste `params.id`, rendent un icône + texte). 899 pages prerendered ajoutées pour zéro utilité fonctionnelle aujourd'hui. Aussi simple à supprimer qu'à prerender.
- **Options** :
  - (a) Retirer les 2 routes du build (les supprimer ou les wrap dans un `.gitignore-equivalent` côté build).
  - (b) Garder, ajouter `generateStaticParams`. Simple mais alourdit le bundle.

### Q5 — Coolify/Vercel vs Capacitor : un build, deux, ou trois ?
- **Pourquoi ça compte** : selon la stratégie, la même base de code peut produire :
  - 1 build web SSR (Coolify/OVH) — ce qui tourne aujourd'hui.
  - 1 build web static export (CDN / S3 / Capacitor-target).
  - 1 build Capacitor (iOS + Android).
- **Options** :
  - (a) Garder web SSR + ajouter Capacitor static — deux build configs, deux artifacts.
  - (b) Tout migrer en static (web + mobile) — un seul build, mais on perd les server components actuels (admin guard SSR, etc.) sur le web aussi.
  - (c) Garder web SSR comme source de vérité et faire le mobile en build static séparé via une env var gate (`CAPACITOR_BUILD=true`). Recommandé : zéro impact sur le web.
