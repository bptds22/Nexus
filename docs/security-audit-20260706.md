# Nexus — Audit sécurité pré-beta (2026-07-06)

Diagnostic **read-only** (aucune modification). Projet Supabase `nexus-prod`
(`nrloizyemulbhujrqhgx`, ca-central-1, Postgres 17.6), org `Nexus` plan **pro**.
Hébergement web = OVHcloud/Coolify (pas Vercel).

> ⚠️ Plusieurs items d'auth (JWT expiry, rotation refresh, Confirm email,
> templates) ne sont **pas interrogeables via l'API/MCP** — marqués
> `TO CONFIRM` (dashboard Supabase → Auth settings).

---

## 1. Executive summary

Le socle applicatif est **globalement sain** : les RPC critiques sont
paramétrées (aucune injection SQL), les `dangerouslySetInnerHTML` ne portent
que du contenu **statique** (aucun XSS UGC), les routes API sont **auth-gated**
avec vérification de rôle, et les tiers sont cohérents (`free/pro/all_star`,
lowercase). Les faiblesses sont surtout du **durcissement périmétrique et
opérationnel** : **aucun header de sécurité HTTP**, **vues `SECURITY DEFINER`**
signalées ERROR par l'advisor Supabase (risque de contournement RLS), **fuite
de `error.message` DB vers le client**, **aucun monitoring (Sentry)**, **pas de
Dependabot**, et une **énumération de compte au signup**. Rien de bloquant-
critique exploitable trivialement, mais un lot de correctifs à faible effort
avant d'ouvrir la beta.

---

## 2. Tableau consolidé — tous les findings

| Item | Finding | Status | Preuve | Sévérité | Effort |
|---|---|---|---|---|---|
| **#32** Spend cap Supabase | Plan `pro` ; cost-control non exposé via API | TO CONFIRM | `get_organization` (plan=pro), non exposé MCP | Medium | 5 min (dashboard) |
| **#32** Billing alerts Supabase | Non exposé via API | TO CONFIRM | — | Medium | 5 min |
| **#32** Spend cap Vercel | App = Coolify/OVH, pas Vercel | N/A / TO CONFIRM | CLAUDE.md hosting | Low | — |
| **#33** CSP | Absent | ❌ MANQUANT | `next.config.ts` — pas de `headers()` | **High** | 1-2 h |
| **#33** X-Frame-Options | Absent | ❌ MANQUANT | idem | **High** | inclus |
| **#33** X-Content-Type-Options | Absent | ❌ MANQUANT | idem | Medium | inclus |
| **#33** Strict-Transport-Security | Absent (config Next ; proxy Coolify ?) | ❌ / TO CONFIRM | idem | **High** | inclus |
| **#33** Referrer-Policy | Absent | ❌ MANQUANT | idem | Medium | inclus |
| **#33** Permissions-Policy | Absent | ❌ MANQUANT | idem | Medium | inclus |
| **#34** Confirm email | Non interrogeable via MCP | TO CONFIRM | Auth config hors DB | High | 5 min |
| **#34** Templates FR custom | Non interrogeable | TO CONFIRM | — | Low | 1-2 h |
| **#35** JWT expiry / rotation / inactivity | Non exposé via MCP | TO CONFIRM | GoTrue config | Medium | 15 min |
| **#36** Reset password (enum) | Flow **non implémenté** (stub Phase 2) | N/A | `mot-de-passe-oublie/page.tsx:27` TODO, `auth/page.tsx:582` "forgotPhase2" | Info | — |
| **#36** Signup enumeration | « Cet email est déjà utilisé » **leak l'existence** | ⚠️ PRÉSENT | `lib/utils/translateAuthError.ts:8-9` | Medium | 1 h |
| **#36** Password change (loggé) | Câblé, pas d'enum | ✅ OK | `PasswordChangeSheet.tsx:42`, `AccountSection.tsx:75` | — | — |
| **#37** Google OAuth | **Non configuré** | ❌ ABSENT (voulu) | aucun `signInWithOAuth`/`provider:"google"` ; CLAUDE.md TODO | Info | décision produit |
| **#38** Route `admin/partners/create` | auth ✅ + rôle ✅ + validation manuelle ✅ (pas de Zod) | ✅ Bon | `route.ts:44,50-57,70` | Low | — |
| **#38** Validation globale API | Manuelle partout, **pas de lib de schéma (Zod)** ; bornes non systématiques | 🟡 Partiel | 6 routes `app/api/**` | Medium | 3-4 h |
| **#39** RPC SQL dynamique | 1 seule (`rls_auto_enable`) : `format('%s', cmd.object_identity)` = **DDL event-trigger, PAS d'input user** | ✅ Safe | `pg_proc` scan | — | — |
| **#39** Autres RPC | Toutes paramétrées, aucun `EXECUTE || input` | ✅ Safe | scan complet | — | — |
| **#40** `dangerouslySetInnerHTML` | 3 hits, **tous statiques** (CSS glow + JSON-LD) — aucun UGC | ✅ Safe | `BadgeGrid.tsx:156`, `layout.tsx:169,176` | — | — |
| **#50** Feature gates reconciliation | Doc matrice **non fournie** | 🚫 BLOCKED | — | — | dépend doc |
| **#50** Résidu tier « Starter » | SEO metadata obsolète | ⚠️ MISMATCH | `app/tarifs/layout.tsx:6` « Free, Starter et Pro » | Low | 5 min |
| **#50** Casse tiers | `free/pro/all_star` lowercase partout | ✅ OK | `useSubscription.ts` normalizeTier | — | — |
| **#57** Deps pinning | `next`/`react` épinglés ; **`@supabase/*` + `stripe` en `^`** | 🟡 Partiel | `package.json` | Medium | 30 min |
| **#57** Dependabot | **Absent** (`.github/` inexistant) | ❌ MANQUANT | glob `.github/**` = vide | Medium | 30 min |
| **#58** `error.message` DB → client | Exposé dans plusieurs routes | ⚠️ PRÉSENT | `admin/partners/create/route.ts:105,131,156` | Medium-High | 2 h |
| **#58** Pages d'erreur | Seul `not-found.tsx` ; **pas de `error.tsx`/`global-error.tsx`** | ❌ MANQUANT | glob | Medium | 1-2 h |
| **#58** Monitoring | **Aucun Sentry / error tracking** | ❌ MANQUANT | grep `Sentry` = 0 | Medium-High | 2-4 h |
| **Advisor** Security Definer Views | ~6 vues `SECURITY DEFINER` (contourne RLS de l'appelant) | ⚠️ **ERROR** | `get_advisors(security)` | **High** | 2-4 h |
| **Advisor** Function search_path mutable | Fonctions sans `search_path` figé | ⚠️ WARN | idem | Medium | 1-2 h |
| **Advisor** RLS enabled no policy | ~10 tables RLS-on sans policy (deny-all) | ℹ️ INFO | idem | Low | 1 h |

---

## 3. Top 5 findings Critical/High + fix minimal

1. **Aucun header de sécurité HTTP (#33)** — *High.* Pas de CSP (mitigation XSS),
   X-Frame-Options (clickjacking), HSTS (downgrade), Referrer/Permissions-Policy.
   **Fix** : ajouter une fonction `headers()` dans `next.config.ts` (bloc
   web-only, hors `isCapacitorBuild`) posant les 6 headers ; commencer par une
   CSP en `report-only` pour ne rien casser, puis durcir. Confirmer HSTS au
   proxy Coolify.

2. **Vues `SECURITY DEFINER` (advisor ERROR)** — *High.* Ces vues s'exécutent
   avec les droits du créateur → un utilisateur peut lire au-delà de sa RLS.
   **Fix** : recréer chaque vue en `security_invoker = true` (Postgres 15+) OU
   confirmer que chaque vue ne renvoie que des données déjà publiques. Auditer
   les ~6 vues listées par l'advisor une par une.

3. **`error.message` DB exposé au client (#58)** — *Medium-High.* Les routes
   renvoient les messages Postgres bruts (noms de colonnes, contraintes).
   **Fix** : mapper toute erreur serveur vers un message générique (« Erreur
   serveur, réessaie ») + logguer le détail côté serveur uniquement. Un helper
   `apiError()` uniforme pour les 6 routes.

4. **Énumération de compte au signup (#36)** — *Medium.* « Cet email est déjà
   utilisé » confirme l'existence d'un compte.
   **Fix** : message neutre au signup (« Si un compte existe, un email a été
   envoyé » côté reset ; au signup, message générique + envoi d'email de
   récupération plutôt qu'erreur explicite). Comportement à décider (UX vs
   sécurité — souvent accepté en beta, à trancher).

5. **Aucun monitoring + Dependabot absent + deps `^` (#57/#58)** — *Medium.*
   Pas de visibilité sur les erreurs prod, pas d'alerte sur les CVE de deps.
   **Fix** : (a) `@sentry/nextjs` (ou équivalent) ; (b) `.github/dependabot.yml`
   (npm, weekly) ; (c) épingler `@supabase/*` et `stripe` en versions exactes.

---

## 4. Estimation effort total

| Lot | Items | Effort |
|---|---|---|
| Headers HTTP | #33 | 1-2 h |
| Security Definer Views + search_path | advisors | 3-6 h |
| Error handling uniforme + pages error.tsx | #58 | 3-4 h |
| Monitoring (Sentry) | #58 | 2-4 h |
| Dependabot + pinning | #57 | 1 h |
| Signup enumeration | #36 | 1 h |
| Confirmations dashboard (spend/email/JWT) | #32/#34/#35 | 30 min |
| Résidu Starter + RLS-no-policy | #50/advisor | 1 h |
| **Total** | | **~2-3 jours focus** |

---

## 5. Ordre d'exécution recommandé (impact × effort × dépendances)

1. **Confirmations dashboard** (#32/#34/#35) — 30 min, débloque le diagnostic.
2. **Security Definer Views** (advisor ERROR) — plus haut risque data, avant beta.
3. **Headers HTTP** (#33) — fort impact, faible effort, indépendant.
4. **Error handling générique + `error.tsx`/`global-error.tsx`** (#58).
5. **Dependabot + pinning** (#57) — rapide, préventif.
6. **Signup enumeration** (#36) — après décision produit.
7. **Monitoring Sentry** (#58) — avant d'ouvrir le trafic beta.
8. **search_path figé + RLS-no-policy** (advisors WARN/INFO) — nettoyage.
9. **Résidu Starter** (#50) — cosmétique.

---

## 6. Items nécessitant une DÉCISION PRODUIT

- **#37 Google OAuth** — non configuré (volontaire, deferred post-beta). Décider
  le **timing** d'activation + les scopes minimaux (email, profile) et les
  redirect URIs à whitelister (domaine prod + local dev).
- **#36 Signup enumeration** — trancher UX (« email déjà utilisé » explicite,
  meilleure conversion) vs sécurité (message neutre). Beta = acceptable, à
  documenter.
- **#35 refresh token mobile** — voir « Recommandations mobile » ci-dessous.

---

## 7. Items nécessitant une VALIDATION EXTERNE

- **#61 Loi 25** (hors scope de cette session) — conformité renseignements
  personnels de **mineurs** : nécessite validation par **conseil juridique**
  (RPRP désigné, ÉFVP, consentement parental, rétention). Ne pas s'auto-déclarer
  conforme.
- **#32 facturation** — confirmer spend cap + alertes dans le dashboard
  Supabase (et le proxy Coolify pour HSTS/#33) — hors périmètre API.

---

## Recommandations mobile (#35 — session/refresh pour l'app athlète)

L'app athlète est native (Capacitor, session persistée en `localStorage` via
`@supabase/supabase-js`). Recommandations à valider une fois la config JWT
confirmée :

- **Access token (JWT) court** (défaut Supabase 3600 s) — OK, ne pas allonger.
- **Refresh token rotation ACTIVÉE** (à confirmer #35) — révoque un refresh
  volé après usage.
- **Refresh token à durée longue** côté mobile pour éviter les re-logins
  fréquents (UX athlète), **compensé par un re-auth biométrique** (Face ID /
  empreinte via un plugin Capacitor) avant les actions sensibles et à la
  réouverture de l'app.
- **Inactivity timeout** serveur raisonnable ; le biometric gate côté client
  couvre le vol de device.
- Ne jamais stocker le service-role key côté client (vérifié : il n'est utilisé
  que côté serveur dans les routes API).

---

*Audit read-only — aucune modification appliquée. Items `TO CONFIRM` à valider
dans le dashboard Supabase / proxy Coolify.*
