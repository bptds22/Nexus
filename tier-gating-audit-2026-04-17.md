# Tier Gating Audit — Nexus
**Date:** 2026-04-17
**Scope:** Free / Pro / All Star enforcement across UI, API, and DB layers
**Auditor:** Claude (read-only review)
**Commit reviewed:** `355792e` + uncommitted working tree (migrations + seed just added)

---

## Executive summary

**TL;DR — tier gating in Nexus is effectively non-existent at the security boundary.**

- **API layer:** ZERO enforcement. The codebase has **no `app/api/` directory** and **zero `"use server"` directives**. Every write goes directly from the browser via the Supabase JS client.
- **DB layer:** ZERO tier enforcement. RLS policies (131 total) only check **ownership** (`auth.uid() = user_id`) and admin flags. No policy references `subscriptions.tier`, no helper function like `get_user_tier()` exists.
- **UI layer:** Partial. Only 3 gate mechanisms ship: `FeatureGate` (2 usages), `SchoolGate` (wraps `/coach/ecole/*`), `CegepGate` (wraps all 7 `/recruteur/cegep/*` pages). Most revenue-sensitive features (favorites limit, pipeline access, messages, lists, visibility rules 7-12) have **no gate at all**.
- **Fail-open:** Of the gates that do exist, most render blurred children — the child components still fetch and hold the data in memory. A user can open DevTools, read the data from React state, or replay the network call. Every gate is bypassable by editing `localStorage.nexus_user` (except `SchoolGate`, which reads the DB).

**Two parallel subscription systems coexist**, which compounds the risk:

1. **DB-backed** — [`lib/hooks/useSubscription.ts`](lib/hooks/useSubscription.ts) reads `subscriptions` table, normalizes tier, exposes `canSee()`. Used by `SchoolGate` and a handful of pages.
2. **localStorage-backed** — [`lib/utils/subscription.ts`](lib/utils/subscription.ts) reads `nexus_user` from `localStorage`. Used by `FeatureGate` and `CegepGate`. Trivially bypassable.

The two systems don't share a tier taxonomy: the hook uses `"free" | "pro" | "all_star"`; the utils use `"free" | "coach_pro" | "coach_allstar" | "recruteur_pro" | "recruteur_allstar" | "athlete_pro"`.

**Bottom line:** any authenticated user with the Supabase anon key (exposed in the browser bundle) can write to `recruiter_pipeline`, `recruiter_favorites`, `recruiter_lists`, `conversations`, `messages`, etc. directly, regardless of their tier. The paywall is cosmetic.

---

## Layer-by-layer findings

### API Gate layer — **fully absent**
- No `app/api/` directory exists.
- Grep for `^["']use server["']` across all `.ts`/`.tsx` returns **0 files**.
- All Supabase writes happen via `createClient()` → `.insert() / .update() / .delete()` directly in client components.
- **Implication:** the browser is the only place any enforcement can live today. And the browser is under attacker control.

### DB Gate layer — **no tier-aware RLS**
Searched [`supabase/migrations/20260417120000_baseline.sql`](supabase/migrations/20260417120000_baseline.sql) for tier-related policies:
- `CREATE POLICY ... tier` → 0 matches
- `CREATE POLICY ... subscriptions` → 4 matches — **all of them are CRUD on the `subscriptions` table itself** (admins-read/insert/update + user-read-own). None of them gate other tables by tier.
- No `get_user_tier`, `has_tier`, `check_tier`, `requires_pro`, `is_pro_user`, `requires_allstar` function exists in the migration.

The only RLS pattern in use across 131 policies is ownership-based:
```sql
-- typical policy shape found throughout the baseline
FOR SELECT USING (recruiter_id = auth.uid())
```
This lets any authenticated recruiter read/write any of their own rows on any table — regardless of what their subscription row says.

### UI Gate layer — partial, fragmented
Three gate components exist:

| Component | Source of truth | Used on |
|---|---|---|
| [`FeatureGate`](components/subscription/FeatureGate.tsx) | `localStorage.nexus_user` | 2 files: `recherche`, `athlete/visibilite` |
| [`SchoolGate`](components/subscription/SchoolGate.tsx) | DB-backed `useSubscription` hook | all 7 `/coach/ecole/*` pages |
| [`CegepGate`](components/subscription/CegepGate.tsx) | `localStorage.nexus_user` | all 7 `/recruteur/cegep/*` pages |

All three render the **protected children inside the DOM** with a blur filter and a paywall overlay on top. This means any data the children fetch is still fetched, still lives in React state, and is visible in DevTools/Network/Memory. A motivated non-paying user can extract it.

---

## Feature matrix

Legend:
- ✓ = enforced at this layer
- ✗ = not enforced at this layer
- ? = unclear / worth human review
- **Fail-Open Safe?** = would a bypassed UI gate still leak data? "Yes" means the data never reaches the client; "No" means there's a revenue leak.

| # | Feature | UI Gate | API Gate | DB Gate | Fail-Open Safe? | Enforcement file(s) | Notes |
|---|---|---|---|---|---|---|---|
| **1** | Athlete — views/likes TREND chart (Pro+) | ✗ | ✗ | ✗ | **No** | [`app/athlete/visibilite/page.tsx`](app/athlete/visibilite/page.tsx) L91-94, L106-127, L131-133 | Chart renders unconditionally. Free users see the full 8-week trend. |
| **2** | Athlete — WHO viewed/liked/favorited (Pro+) | ✓ localStorage | ✗ | ✗ | **No** | [`app/athlete/visibilite/page.tsx`](app/athlete/visibilite/page.tsx) L174, L220 (FeatureGate wraps sections) | Hook fetches recruiter+CÉGEP names for all tiers. Blur is cosmetic — names are in React state and DOM. Edit localStorage → instant bypass. |
| **3** | Athlete — programs search / blog / CÉGEP map / recruiting guide (All Star) | N/A | N/A | N/A | **n/a** | Not implemented | No UI exists for any of these flags (`can_search_programs`, `can_access_blog`, `can_use_interactive_map`, `can_see_cegep_selling`, `can_access_recruiting_guide`). [`app/guide-recrutement/page.tsx`](app/guide-recrutement/page.tsx) is a public marketing page, not a gated athlete feature. |
| **4** | Coach — Mon École + `/coach/ecole/*` (Pro+) | ✓ DB-backed | ✗ | ✗ | **No** | [`components/subscription/SchoolGate.tsx`](components/subscription/SchoolGate.tsx), all 7 `/coach/ecole/*` `page.tsx` | Best gate in the app — uses real DB tier via `useSubscription`. But children are rendered (blurred). Supabase queries inside the gated content still execute. Data visible in Network/DevTools. |
| **5** | Coach — create athlete beyond free cap (Pro+) | ✗ | ✗ | ✗ | **No** | [`app/coach/athletes/create/page.tsx`](app/coach/athletes/create/page.tsx) L572-576 — `.insert()` unconditional | No count-check, no limit UI, no "upgrade" prompt. Free coaches can create unlimited athletes by hitting `/coach/athletes/create`. |
| **6** | Coach — advanced analytics (All Star) | ✗ (gated at Pro instead) | ✗ | ✗ | **No** | [`app/coach/ecole/analytics/page.tsx`](app/coach/ecole/analytics/page.tsx) L68 (SchoolGate) | SchoolGate unlocks at **Pro**, not All Star. `COACH_FEATURES[pro].can_see_analytics === true`. Header comment claims "Coach Analytics — PRO feature" — so feature spec itself is Pro, not All Star. CLAUDE.md says All Star. **Spec mismatch.** |
| **7** | Recruteur — athlete name / photo / jersey / highlights (Pro+) | ✗ | ✗ | ✗ | **No** | [`app/recruteur/recherche/page.tsx`](app/recruteur/recherche/page.tsx), [`app/recruteur/athletes/[id]/page.tsx`](app/recruteur/athletes/[id]/page.tsx) | No element-level gate. Free recruiters see everything. CLAUDE.md states profiles should be *anonymized* for Free — this is not implemented. |
| **8** | Recruteur — coach comments (Pro+) | ✗ | ✗ | ✗ | **No** | `app/recruteur/athletes/[id]/page.tsx` | `can_see_coach_comments` never checked. Coach report, 8-criteria eval, distinctions all render for Free. |
| **9** | Recruteur — full academic info (Pro+) | ✗ | ✗ | ✗ | **No** | `app/recruteur/athletes/[id]/page.tsx` | `can_see_academic_full` never checked. |
| **10** | Recruteur — detailed profile sections (All Star) | ✗ | ✗ | ✗ | **No** | `app/recruteur/athletes/[id]/page.tsx` | `can_see_detailed_eval` never checked. |
| **11** | Recruteur — global recruitment status (All Star) | ✗ | ✗ | ✗ | **No** | `app/recruteur/athletes/[id]/page.tsx` | `can_see_recruitment_status` never checked. Status pill displays for all tiers. |
| **12** | Recruteur — who else viewed (All Star) | ✗ | ✗ | ✗ | **No** | — | Feature not visibly implemented on the profile page; if added, currently no gate would exist. |
| **13** | Recruteur — max favorites = 10 (Free) | ✗ | ✗ | ✗ | **No** | [`app/recruteur/recherche/page.tsx`](app/recruteur/recherche/page.tsx) L513-550 `toggleFav()`; [`app/recruteur/favoris/page.tsx`](app/recruteur/favoris/page.tsx) | No count check before `.insert()` into `recruiter_favorites`. Free users can add unlimited. No UI "10 of 10" indicator. |
| **14** | Recruteur — max search results = 10 (Free) | ✓ (partial) | ✗ | ✗ | **No** | [`app/recruteur/recherche/page.tsx`](app/recruteur/recherche/page.tsx) L822-838 (FeatureGate on results 7+) | FeatureGate wraps results beyond 6 with blur. But the Supabase fetch (L308-342) pulls **all** athletes; filter is client-side. Open Network tab → full list. |
| **15** | Recruteur — coaches per team limit (1 Free, 1 Pro, ∞ All Star) | ? | ✗ | ✗ | **No** | [`app/recruteur/cegep/inviter/page.tsx`](app/recruteur/cegep/inviter/page.tsx) | Wrapped in CegepGate (All Star gate for the whole page). No count check on the invite itself. If Pro user somehow reaches the invite page, they can send unlimited invites. |
| **16** | Recruteur — Pipeline Kanban (Pro+) | ✗ | ✗ | ✗ | **No** | [`app/recruteur/pipeline/page.tsx`](app/recruteur/pipeline/page.tsx) | Entire page renders for Free. Fetch has no tier filter. |
| **17** | Recruteur — pipeline stages ≥ EN_DISCUSSION (Pro+) | ✗ | ✗ | ✗ | **No** | `app/recruteur/pipeline/page.tsx` L919-950 `handleStatusChange` | `.update({ stage: "ENGAGE" })` has no tier check. Free user can write any stage. `subscription_features_recruteur.pipeline_statuses` array is read from DB but never consulted before the write. |
| **18** | Recruteur — send messages to coach (Pro+) | ✗ | ✗ | ✗ | **No** | [`app/recruteur/messages/nouveau/page.tsx`](app/recruteur/messages/nouveau/page.tsx) L326 (send insert) | No tier check before insert into `conversations` / `messages`. Free user can message freely. |
| **19** | Recruteur — full inbox (All Star) | ✗ | ✗ | ✗ | **No** | [`app/recruteur/messages/page.tsx`](app/recruteur/messages/page.tsx) L137-217 | Thread list loads all conversations for the user. No tier filter. `has_full_inbox` never checked. |
| **20** | Recruteur — activity feed (Pro+) | ✗ | ✗ | ✗ | **No** | [`app/recruteur/activites/page.tsx`](app/recruteur/activites/page.tsx) L58-63, L237-243 | `ActivityFeedFull` renders for Free. Fetch of `recruiter_activity_log` has no tier filter. |
| **21** | Recruteur — athlete trend analytics (All Star) | ? | ✗ | ✗ | **No** | Unclear — no dedicated page located | If this feature is served as a component in the dashboard, it's not gated. |
| **22** | Recruteur — full CÉGEP portal `/recruteur/cegep/*` (All Star) | ✓ localStorage | ✗ | ✗ | **No** | [`components/subscription/CegepGate.tsx`](components/subscription/CegepGate.tsx) wraps all 7 pages (`cegep/page.tsx`, `inviter`, `recruteurs`, `recrues`, `reassignation`, `stats`, `entraineurs/[id]`) | Gate reads `localStorage.nexus_user.subscription.tier` — edit localStorage → bypass. Children render (blurred) so data still fetches. |
| **23** | Recruteur — custom prospect lists `/recruteur/listes` (All Star) | ✗ | ✗ | ✗ | **No** | [`app/recruteur/listes/page.tsx`](app/recruteur/listes/page.tsx) L937-951 | No gate at all. Entire lists feature is open. Pro users with `has_list_access=false` in DB can still create, edit, delete lists. |

---

## CRITICAL GAPS

These are features where `Fail-Open Safe? = No` and **at least one of UI / API / DB is ✗**. They represent revenue leaks or data exposure risks that should be fixed before paid launch. Ordered by severity (my subjective read — adjust to your monetization priorities):

### Severity 1 — fully ungated revenue-sensitive features

| # | Feature | Why critical |
|---|---|---|
| **5** | Coach — unlimited athlete creation on Free | Free coaches can create unlimited profiles. If any tier has an athlete cap, it's unenforced. Direct revenue leak. |
| **13** | Recruiter — unlimited favorites on Free | Favorite count is the one hard-cap in the CLAUDE.md spec (10 for Free). Unenforced anywhere. |
| **14** | Recruiter — search result count | FeatureGate blurs results 7+ but **the fetch returns all athletes**. Network tab leaks full list. |
| **16** | Recruiter — Pipeline Kanban open to Free | Pipeline is a core Pro upsell. No gate anywhere. |
| **17** | Recruiter — pipeline stage writes unrestricted | `.update({ stage })` accepts any stage for any tier. Fundamentals of the pipeline paywall collapse. |
| **18** | Recruiter — messaging coach open to Free | Messaging is a Pro feature. No gate. |
| **20** | Recruiter — activity feed open to Free | Pro feature per CLAUDE.md. No gate. |
| **23** | Recruiter — custom lists open to everyone | "Custom prospect lists are EXCLUSIVELY Pro" per CLAUDE.md. Page has zero gate. |

### Severity 2 — partial UI gate, data still leaks

| # | Feature | Why critical |
|---|---|---|
| **2** | Athlete — WHO viewed/liked/favorited | FeatureGate blurs, but recruiter/CÉGEP names are already in React state. DevTools reveals. Edit localStorage → instant bypass. |
| **4** | Coach — `/coach/ecole/*` school mgmt | Best-gated feature in the app (SchoolGate uses DB-backed hook). But queries still run inside the blurred child — data reaches the client. |
| **22** | Recruiter — `/recruteur/cegep/*` CÉGEP mgmt | CegepGate reads localStorage only — trivially bypassable. Children still fetch. |

### Severity 3 — recruiter visibility rules unimplemented

| # | Feature | Why critical |
|---|---|---|
| **7-12** | Recruiter sees full athlete identity + coach comments + academics + status on Free | CLAUDE.md business model states **Free = anonymized profiles** ("stats, school, sport, rating visible; name, photo, position, jersey hidden"). The current code shows everything to everyone. This is the single biggest departure from the spec. |

---

## UNEXPECTED FINDINGS

### 1. Two parallel subscription systems with different tier taxonomies
- [`lib/hooks/useSubscription.ts`](lib/hooks/useSubscription.ts) uses `"free" | "pro" | "all_star"` and reads from the DB.
- [`lib/utils/subscription.ts`](lib/utils/subscription.ts) uses `"free" | "coach_pro" | "coach_allstar" | "recruteur_pro" | "recruteur_allstar" | "athlete_pro"` and reads from `localStorage.nexus_user`.

`SchoolGate` uses the first. `FeatureGate` and `CegepGate` use the second. They disagree on tier names, can disagree on what tier the user is, and are driven by different sources of truth. At least one of these systems is dead weight or about to cause a bug.

### 2. Coach analytics gated at wrong tier
CLAUDE.md says coach analytics is an **All Star** feature. `subscription_features_coach.can_see_analytics` is `true` for both `pro` and `all_star` in the DB. `COACH_FEATURES[pro].can_see_analytics === true` in the hook. The comment in `app/coach/ecole/analytics/page.tsx` line 9 says "Coach Analytics — PRO feature". Per CLAUDE.md a recent commit said "coach 2-tier simplification" — so All Star may have been folded into Pro for coaches. If so, CLAUDE.md's "Feature 6 = All Star" description is stale. Confirm with product.

### 3. Coach `all_star` tier exists in DB but is effectively folded into Pro
`subscription_features_coach` has 3 rows (free/pro/all_star) and `COACH_FEATURES[all_star]` duplicates `COACH_FEATURES[pro]` in the hook with a comment "Coach has 2 tiers only". The `all_star` row in the DB is dormant and should probably be deleted to avoid confusion.

### 4. Athlete `all_star` tier exists but has no associated price
`subscription_features_athlete.all_star` has all features enabled but **both price columns are 0**. CLAUDE.md lists athletes as Free/Pro only. `ATHLETE_FEATURES[all_star]` in the hook comments "all_star here only for type safety". Dead row that may confuse Stripe integration.

### 5. Recruiter subscription features have no price columns
`subscription_features_recruteur` has no `price_monthly_cents` / `price_annual_cents`. Coach and athlete tables do. Pricing for recruiter lives only in [`app/tarifs/page.tsx`](app/tarifs/page.tsx) and (future) Stripe. This will need to be reconciled before billing goes live.

### 6. Athlete Pro price in `tarifs` doesn't match CLAUDE.md
`app/tarifs/page.tsx` shows Athlete Pro = $4.99/mo, $49/yr (L232-234). CLAUDE.md says $9.99/mo or $79/yr. Either the page is wrong or the spec is stale.

### 7. Coach Pro price in `tarifs` doesn't match CLAUDE.md or the DB
- `tarifs` page: Coach Pro = $14.99/mo, $139/yr (L167-169)
- CLAUDE.md: $5.99/mo, $29.99/yr
- `subscription_features_coach` table: $5.99/mo, $29.99/yr

The DB and CLAUDE.md agree, the page disagrees. The tarifs page is the stale source.

### 8. FeatureGate and CegepGate render children (blurred) inside the DOM
This is the single biggest architectural flaw in the paywall. The blur is a CSS filter, not a conditional render. Every byte of data that the child fetches reaches the browser — the user cannot see it **visually** but can see it in React DevTools, in the network tab, or by stripping the blur with a userscript. For this pattern to be a real paywall, children must be replaced (not blurred) when the gate is active, OR data fetches must be moved behind a server-side barrier.

### 9. Recruiter table `max_favorites` / `max_search_results` / `coaches_per_team` are NULL for Pro/All Star
pg_dump of `subscription_features_recruteur` showed `max_favorites = NULL` (not `-1` or `999999`) for Pro. Code treats `NULL` as unlimited in practice, but the DB schema has no such contract. If a client reads the value as a number it will get `null` — any strict-equals check against a number will fail unpredictably.

### 10. The `subscriptions` table has `stripe_price_id` but no amount columns
All pricing lives in Stripe (planned) or in the frontend (today). This is standard for Stripe integrations, but worth noting that **no server-side source of truth for price currently exists on Nexus infrastructure**.

### 11. Zero server-side code in the entire product
No `app/api/*`, no `"use server"` actions. This is unusual for a Next.js 14 app and means every piece of business logic (tier, limits, writes) lives in the browser. Until that changes, no amount of UI gating will produce a real paywall — it can only produce a better-looking frictional signup funnel.

---

## Recommended remediation order

Not part of the audit (and not implemented — this is a read-only report), but here's a suggested sequence for addressing the gaps above:

1. **Add tier-checking RLS helper function** — a single Postgres function `public.user_tier() → text` that reads `subscriptions.tier` for `auth.uid()`. Use it in every policy that should be tier-sensitive.
2. **Harden the 5 highest-leverage policies** — on `recruiter_favorites`, `recruiter_pipeline`, `recruiter_lists`, `messages`, `conversations`. Add tier checks in the `WITH CHECK` clause of INSERT/UPDATE policies.
3. **Move writes behind Server Actions or Route Handlers** — once RLS is tight, shift pipeline/list/message writes to `"use server"` functions that can check tier before touching Supabase. Belt-and-braces with RLS.
4. **Fix the data-leak-through-blur problem** — refactor FeatureGate + CegepGate to conditionally render children based on a boolean, not to blur them. Move data fetching into the gated child so it runs only when access is granted.
5. **Consolidate the two subscription systems** — pick one (the DB-backed `useSubscription` hook is the right one) and delete [`lib/utils/subscription.ts`](lib/utils/subscription.ts).
6. **Implement the anonymized-Free recruiter view** — Features 7-12. This is the core product contract.
7. **Reconcile tarifs page prices with the DB** — then (when Stripe is wired) with Stripe's products.

---

*End of audit.*
