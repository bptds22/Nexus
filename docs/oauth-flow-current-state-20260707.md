# OAuth — état actuel du flow (2026-07-07)

Audit **read-only** de l'authentification sociale (Google/Apple) sur la branche
**`feat/mobile-checkout`** (là où vit tout le code OAuth). Aucune modification.

> ⚠️ Contexte branches : `feat/mobile-checkout` est **+99 commits** devant `main`
> et **−17** derrière. **La prod (`main`, déployée par Coolify) n'a PAS ce code
> OAuth.** C'est la source de toute la confusion « OAuth cassé/placeholder ».

---

## 1. Executive summary

L'OAuth Google + Apple est **entièrement implémenté sur `feat/mobile-checkout`**,
web **et** natif, login **et** signup. Le natif (iOS) passe par le plugin
**`@capgo/capacitor-social-login`** + `signInWithIdToken` ; le web par
`supabase.auth.signInWithOAuth` → route callback `/auth/callback`. Le callback
gère l'échange de code **et** un gate de consentement Loi 25. **Le seul vrai
manque fonctionnel : aucune sélection de rôle au signup OAuth** → le trigger DB
défaut tout compte OAuth à `ATHLETE`. Le « toast Phase 2 » vu en prod vient
simplement du fait que **la prod tourne `main`** (placeholder), pas cette branche.

---

## 2. Matrice providers × plateformes × surfaces (sur `feat/mobile-checkout`)

| Surface | Plateforme | Google | Apple | Mécanisme |
|---|---|---|---|---|
| Login | Web | ✅ | ✅ | `auth/page.tsx:384/389` → `handleOAuth` → `signInWithOAuth` |
| Signup | Web | ✅ | ✅ | `auth/page.tsx:529/534` → `handleOAuth` → `signInWithOAuth` |
| Login/Signup | Natif (iOS) | ✅ | ✅ | `SocialButtonsMobile` → `signInWithGoogle/Apple` (Capgo) → `signInWithIdToken` |
| Callback web | Web | ✅ | ✅ | `app/auth/callback/route.ts` |

> Note : `SocialButtonsMobile.handleProvider` (:92) gère **aussi** un fallback web
> (`signInWithOAuth`) si rendu hors natif. Son **commentaire d'en-tête (:6-12)
> est PÉRIMÉ** (« UI uniquement, aucun OAuth réel ») — le code, lui, est câblé.

---

## 3. Flow diagrams (paths fonctionnels)

### 3a. Web (login ou signup) — Google/Apple
```
Clic bouton → handleOAuth(provider)
  → supabase.auth.signInWithOAuth({ provider, redirectTo: <origin>/auth/callback })
  → redirect navigateur vers Google/Apple
  → retour ?code=... sur GET /auth/callback
      → exchangeCodeForSession(code)  (client @supabase/ssr, pose cookies)
      → si user && !onboarding_complete && needsConsent(...) → redirect /consentements
      → sinon redirect <origin>/<next>  (défaut "/")
  → (erreur) redirect /auth?error=oauth
```

### 3b. Natif iOS — Google
```
handleProvider("google") [Capacitor.isNativePlatform()]
  → signInWithGoogle()  (lib/auth/social.ts)
    → initSocialLogin() (idempotent, SocialLogin.initialize google+apple)
    → authenticateWithGoogleSupabase() (supabaseAuthUtils.ts)
        · getNonce() → rawNonce + nonceDigest(SHA-256)
        · SocialLogin.login({provider:google, scopes:[email,profile], nonce:nonceDigest})
        · validateJWTToken(idToken) [audience ∈ clientIds, nonce match] — retry 1× si KO (cache iOS)
        · supabase.auth.signInWithIdToken({provider:google, token, nonce:rawNonce})
    → getSession()
  → postLoginDispatch(session.user)  → redirect par rôle
```

### 3c. Natif iOS — Apple
```
handleProvider("apple")
  → signInWithApple()
    → SocialLogin.login({provider:apple})
    → supabase.auth.signInWithIdToken({provider:apple, token})
    → appleProfile (nom/email) présent UNIQUEMENT au 1er login
  → persistAppleProfileOnce(userId, appleProfile)  [INSERT/UPDATE users si champs vides, best-effort]
  → postLoginDispatch
```

---

## 4. Gap analysis

| Path | État | Gap |
|---|---|---|
| Web login OAuth | ✅ complet sur la branche | **Non déployé** (prod = main) |
| Web signup OAuth | ✅ boutons présents (`:529/534`) | idem non déployé + **pas de sélection de rôle** |
| Natif Google/Apple | ✅ complet | fonctionne (rapport BP) |
| **Rôle au signup OAuth** | ❌ **MANQUANT** | trigger `handle_new_auth_user` défaut `ATHLETE` (voir §7) |
| Consentements Loi 25 OAuth | ⚠️ partiel | gate serveur `/consentements` existe (callback) mais **pas capturés au moment du clic** |
| Config dashboard Supabase | ⚠️ à vérifier | providers/redirect URLs/link_identities non interrogeables via MCP |

---

## 5. Cause racine du « toast Phase 2 » sur login web (prod)

**La prod déploie `main`.** Sur `main`, l'OAuth web est encore le **placeholder
pré-OAuth** : le bouton social déclenche un toast « Phase 2 / Bientôt disponible »
(canon `T.toasts.socialPhase2`), et le signup n'a pas de boutons. Le **vrai**
`handleOAuth` + `signInWithOAuth` + `/auth/callback` n'existent que sur
**`feat/mobile-checkout`** (99 commits non mergés/déployés).

→ **Ce n'est pas « cassé »** : c'est du code fonctionnel **sur une branche non
déployée**. Dès que `feat/mobile-checkout` sera mergée dans `main` et déployée,
le toast disparaît et l'OAuth web devient réel — **à condition** que la config
dashboard + les env vars soient en place (voir §6/§7).

---

## 6. Recommandations pour l'implémentation (Étape 3)

Le code web est **déjà écrit** → Étape 3 n'est PAS « implémenter de zéro », mais
**compléter + configurer + déployer** :

1. **Sélection de rôle au signup OAuth** (le vrai chantier code) — voir §7 pt.1.
   Sans ça, tout signup Google/Apple devient `ATHLETE`.
2. **Vérifier la config dashboard Supabase** (§7 pt.3) : providers Google+Apple
   activés, Redirect URLs whitelistant `https://nexussports.ca/auth/callback`
   (+ localhost dev), `link_identities`.
3. **Env vars prod** : `NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID`,
   `NEXT_PUBLIC_GOOGLE_IOS_CLIENT_ID` (natif). Le web `signInWithOAuth` s'appuie
   sur le provider Google configuré côté **dashboard** (pas d'ID en code), mais
   les env natifs doivent être présents.
4. **Merge `main` → `feat/mobile-checkout`** (Piste 3) AVANT de continuer : la
   branche n'a pas les 8 commits sécurité + le fix anti-énum signup. Puis, à
   terme, merge inverse `feat/mobile-checkout` → `main` pour déployer l'OAuth.
5. **Confirmer `trailingSlash`** : le callback note que `redirectTo` et
   l'allowlist dashboard doivent matcher exactement (slash inclus).

---

## 7. Points d'attention

### 1. Sélection de rôle post-OAuth OAuth (CRITIQUE)
`handle_new_auth_user` (trigger DB, SECURITY DEFINER) crée `public.users` avec :
```sql
role = COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'ATHLETE')
```
Le signup **email/password** passe `role` via `signUp(..., role, ...)` en
metadata. Le signup **OAuth** ne passe **aucune** metadata `role` → **défaut
`ATHLETE`**, `context` NULL. Un coach/recruteur qui s'inscrit via Google devient
donc un athlète. **À résoudre** : soit une étape de sélection de rôle avant/après
l'OAuth (page intermédiaire type `/consentements`), soit passer un `role` désiré
dans `signInWithOAuth` (via `queryParams`/state) puis le lire dans le callback.

### 2. Consentements Loi 25 au signup OAuth
Le callback (`route.ts:42-44`) redirige vers `/consentements` si
`onboarding_complete !== true && needsConsent(privacy_preferences, user_metadata)`.
→ Le consentement **est** capté côté serveur pour l'OAuth (bon), mais **après**
la création du compte, pas au clic. À valider : `/consentements` couvre bien le
cas OAuth mineur (14-17) + parental. Le flow email/password, lui, capte les
consentements **dans** le formulaire (`consentMeta` → metadata).

### 3. `link_identities` (anti-énumération + UX)
Si un utilisateur s'authentifie via Google avec un email **déjà** en
email/password : avec `link_identities=true` (défaut Supabase récent), Supabase
**auto-lie** silencieusement les identités → SAFE anti-énumération + pas de
doublon. **À VÉRIFIER dans le dashboard** (non accessible via MCP). Si OFF :
risque de compte dupliqué OU d'erreur révélant l'existence de l'email.

### 4. Vérifications dashboard Supabase (hors MCP — action BP)
- Auth → Providers → **Google** activé (+ client secret) ; **Apple** activé
  (Service ID, key). Le natif iOS qui « marche » suggère qu'ils **sont** activés.
- Auth → URL Configuration → **Redirect URLs** : `https://nexussports.ca/auth/callback`
  + URLs de dev.
- Auth → **link_identities** (cf. pt.3).
- `GoogleService-Info.plist` présent dans `ios/App/App/` (config Firebase/Google iOS).

---

*Audit read-only — aucune modification de code/DB. Prochaine étape = ta review,
puis Piste 3 (merge main → feat/mobile-checkout) avant tout travail OAuth.*
