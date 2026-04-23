# Tier Gating Audit — Nexus
**Date:** 2026-04-18
**Scope:** Free / Pro / All Star enforcement across UI, API, and DB layers
**Auditor:** Claude (read-only review)
**Commit reviewed:** `f4ccbaa` (head of `main`, post-Phase-4)

---

## Executive summary

**TL;DR — tier gating has moved from "cosmetic" to "enforced on the writes that matter." The security boundary is now the DB (RLS), not the browser.**

- **API layer:** Still ZERO. Confirmed with a fresh sweep: no `app/api/` directory, zero `"use server"` directives anywhere in `.ts`/`.tsx`. Every write still goes from the browser via the Supabase JS client. **This has not changed since 2026-04-17.**
- **DB layer:** Partial and targeted. Two new migrations ship tier-aware RLS on the highest-leverage tables:
  - `supabase/migrations/20260418090000_phase2a_rls_tier_gates_p0.sql` → `messages` (Pro+ insert), `conversations` (Pro+ insert, split ALL → per-command), `recruiter_pipeline` (Free stage-limited to IDENTIFIE/CONTACTE).
  - `supabase/migrations/20260418093000_phase2b_rls_tier_gates_p1.sql` → `recruiter_favorites` (Free cap=10 via `count_user_favorites()`), `recruiter_lists` + `recruiter_list_members` (Pro+ only), `athletes` INSERT (Free coach cap=30 via `count_coach_athletes()`).
  - Helpers from `20260417150000_tier_helper_functions.sql` (`get_user_tier`, `user_has_pro`, `user_has_all_star`, `count_user_favorites`, `count_coach_athletes`) are SECURITY DEFINER STABLE with locked search_path.
  - `20260418080000_scope_global_status_trigger.sql` prevents Free pipeline writes from propagating into the shared `athletes.recruitment_status` field.
- **UI layer:** Materially improved. `FeatureGate`, `SchoolGate`, `CegepGate` **no longer render children blurred** — they early-return `<UpgradePlaceholder>` instead, so gated children are not mounted, their `useEffect`s never fire, and no Supabase calls for gated data leave the browser. All three gates now read from the DB-backed `useSubscription()` hook; the localStorage parallel system (`lib/utils/subscription.ts`) has been **deleted**. Search/favorites pages pass `.limit(maxSearchResults)` to the Supabase query itself (not post-filter), and favorites UI shows a "X / 10" cap badge + disables the heart button at the cap.
- **Fail-open:** The three blur-leak gates (Features 2, 4, 22 in the previous audit) now truly replace children; the data never reaches the browser. The remaining leaks come from the fact that many recruiter pages still have no gate at all at the UI level (pipeline, messages, activities, lists) — but all writes from those pages are now rejected at the DB.

**Two parallel subscription systems → ONE.** Only `lib/hooks/useSubscription.ts` remains. `lib/utils/subscription.ts` is deleted (no source references). Tier taxonomy is now single: `"free" | "pro" | "all_star"`.

**Bottom line:** the paywall is no longer purely cosmetic. A Free recruiter can still load the pipeline UI in the browser, but they cannot write a stage beyond CONTACTE, cannot add an 11th favorite, cannot create a custom list, and cannot send a message — the DB refuses. The remaining open gaps are read-side gates on the recruiter profile view (Features 7-12: Free should see anonymized athletes) and the dormant spec-mismatches flagged last time (Features 3, 6, 21) that are still unimplemented.

---

## Layer-by-layer findings

### API Gate layer — **still fully absent**
- No `app/api/` directory exists.
- Grep for `^["']use server["']` across all `.ts`/`.tsx` → 0 files.
- All Supabase writes happen via `createClient()` → `.insert() / .update() / .delete()` directly in client components.
- **Implication:** browser-side enforcement is still cosmetic. The belt that now holds up the trousers is RLS.

### DB Gate layer — **partial, targeted, correct where applied**
New tier-aware policies landed on the P0/P1 tables:

| Table | Command | Gate |
|---|---|---|
| `messages` | INSERT | `sender_id = auth.uid()` AND (role='COACH' OR (role='RECRUTEUR' AND `user_has_pro()`)) AND conversation participant |
| `conversations` | INSERT | `recruiter_id = auth.uid()` AND `user_has_pro()` |
| `conversations` | SELECT/UPDATE/DELETE | ownership (split from prior permissive ALL) |
| `recruiter_pipeline` | INSERT | ownership + (Free → stage IN IDENTIFIE/CONTACTE) OR Pro+ |
| `recruiter_pipeline` | UPDATE | ownership + same stage gate via WITH CHECK |
| `recruiter_favorites` | INSERT | ownership + (Pro+ OR (Free AND `count_user_favorites() < 10`)) |
| `recruiter_lists` | INSERT/UPDATE | ownership + `user_has_pro()` |
| `recruiter_list_members` | INSERT | Pro+ AND list owned by caller |
| `athletes` | INSERT (coach path) | ownership + (Pro+ OR (Free AND `count_coach_athletes() < 30`)) |

What is **not** yet gated at DB: reads of athlete PII (name, photo, jersey, coach comments, academic detail) for Free recruiters — the "anonymized Free view" business rule (Features 7-11) still has no server-side enforcement. The existing SELECT on `athletes` is still column-uniform for any recruiter role.

### UI Gate layer — **consolidated, early-return, DB-backed**
Three gate components, all now using `useSubscription()` (DB-backed):

| Component | Source of truth | Gated-child behavior | Used on |
|---|---|---|---|
| `components/subscription/FeatureGate.tsx` | `useSubscription` | **Early-returns `<UpgradePlaceholder>`; children never mount** | `app/recruteur/recherche/page.tsx`, `app/athlete/visibilite/page.tsx` (2 Pro sub-components) |
| `components/subscription/SchoolGate.tsx` | `useSubscription` | Early-returns; children never mount | all 7 `/coach/ecole/*` pages |
| `components/subscription/CegepGate.tsx` | `useSubscription` | Early-returns; children never mount | all 7 `/recruteur/cegep/*` pages |

`components/subscription/UpgradePlaceholder.tsx` is the new replacement UI (lock icon, feature description, CTA to `/tarifs`). Because the gated subtree is no longer in the React tree, `useEffect` in the child never fires and no Supabase fetch for the gated content happens — this closes the "blur-leaks-data" class of bug.

`hooks/useAthleteVisibility.ts` was split into `useAthleteVisibility()` (Free aggregates, region-only, no PII) and `useAthleteVisibilityPro()` (recruiter / CÉGEP names). The Pro hook is called only inside components that sit inside a passing `FeatureGate`, so names never reach a Free browser.

`app/recruteur/recherche/page.tsx` now calls `.limit(maxSearchResults)` directly on the Supabase query after filters/sort (line 431-433). Free recruiters literally get 10 rows from the server, not 10-of-many rendered over a full fetch.

`app/recruteur/favoris/page.tsx` shows `Favoris: {n} / {cap}` with red text at cap (line 425); `app/recruteur/athletes/[id]/page.tsx` disables the heart button + surfaces a tooltip at cap (lines 551-553, 759, 1267, 1293).

---

## Feature matrix

Legend:
- ✓ = enforced at this layer
- ✗ = not enforced at this layer
- ? = unclear / worth human review
- **Fail-Open Safe?** = would a bypassed UI gate still leak data? "Yes" means the data never reaches the client; "No" means there's a revenue/data leak.

| # | Feature | UI Gate | API Gate | DB Gate | Fail-Open Safe? | Enforcement file(s) | Notes |
|---|---|---|---|---|---|---|---|
| **1** | Athlete — views/likes TREND chart (Pro+) | ✗ | ✗ | ✗ | **No** | [`app/athlete/visibilite/page.tsx`](app/athlete/visibilite/page.tsx) | Unchanged since 2026-04-17. Chart still renders unconditionally for all tiers. Trend is computed from `viewsThisMonth / viewsLastMonth` aggregates returned by the Free hook. Low-severity read leak — no PII. Still open. |
| **2** | Athlete — WHO viewed/liked/favorited (Pro+) | ✓ DB-backed | ✗ | ✗ | **Yes** (UI level) | [`app/athlete/visibilite/page.tsx`](app/athlete/visibilite/page.tsx) L174-181; [`hooks/useAthleteVisibility.ts`](hooks/useAthleteVisibility.ts) L156-243 | **Flipped ✗→✓ in Phase 3.** The two Pro sections are wrapped in `FeatureGate` which now early-returns. Hook split into free + pro; `useAthleteVisibilityPro()` only runs inside the gated children, so recruiter/CÉGEP names never fetch for Free. DB RLS on `athlete_view_details` unchanged — the UI-level omission is the gate. |
| **3** | Athlete — programs search / blog / CÉGEP map / recruiting guide (All Star) | N/A | N/A | N/A | **n/a** | Not implemented | Unchanged. Still no UI for these flags. [`app/guide-recrutement/page.tsx`](app/guide-recrutement/page.tsx) is a public marketing page. |
| **4** | Coach — Mon École + `/coach/ecole/*` (Pro+) | ✓ DB-backed | ✗ | ✗ | **Yes** (UI level) | [`components/subscription/SchoolGate.tsx`](components/subscription/SchoolGate.tsx); all 7 `/coach/ecole/*` `page.tsx` | **Flipped ✗→✓ (fail-open column) in Phase 3.** `SchoolGate` now early-returns `<UpgradePlaceholder>`. The school-page children never mount, their Supabase fetches never fire. Fail-open leak closed. DB still relies on the coach being joined to a school via existing ownership RLS. |
| **5** | Coach — create athlete beyond free cap (Pro+) | ✗ | ✗ | ✓ | **Yes** (DB level) | RLS: `athletes_insert` in `supabase/migrations/20260418093000_phase2b_rls_tier_gates_p1.sql` L163-174; [`app/coach/athletes/create/page.tsx`](app/coach/athletes/create/page.tsx) L574 | **Flipped ✗→✓ (DB) in Phase 2b.** Free coach is DB-capped at 30 athletes via `count_coach_athletes() < 30`. UI still has no pre-submit cap check or "upgrade" prompt — a Free coach hitting the cap will see a raw RLS error. UI polish open; DB leak closed. |
| **6** | Coach — advanced analytics (All Star) | ✗ (gated at Pro instead) | ✗ | ✗ | **No** | [`app/coach/ecole/analytics/page.tsx`](app/coach/ecole/analytics/page.tsx) | Unchanged. Still spec-mismatch: hook has `COACH_FEATURES[pro].can_see_analytics === true`, CLAUDE.md says All Star. Per `useSubscription.ts` L160-163 the coach `all_star` row is a type-safety placeholder (folded into Pro). Product decision pending, not a security fix. |
| **7** | Recruteur — athlete name / photo / jersey / highlights (Pro+) | ✗ | ✗ | ✗ | **No** | [`app/recruteur/recherche/page.tsx`](app/recruteur/recherche/page.tsx), [`app/recruteur/athletes/[id]/page.tsx`](app/recruteur/athletes/[id]/page.tsx) | Unchanged. No element-level gate for `can_see_athlete_name / _photo / _jersey / _highlights`. Free recruiters still see full PII. This is the largest remaining spec deviation (CLAUDE.md: Free = anonymized). |
| **8** | Recruteur — coach comments (Pro+) | ✗ | ✗ | ✗ | **No** | `app/recruteur/athletes/[id]/page.tsx` | Unchanged. `can_see_coach_comments` never consulted. Coach report + 8-criteria eval + distinctions render for Free. |
| **9** | Recruteur — full academic info (Pro+) | ✗ | ✗ | ✗ | **No** | `app/recruteur/athletes/[id]/page.tsx` | Unchanged. `can_see_academic_full` never consulted. |
| **10** | Recruteur — detailed profile sections (All Star) | ✗ | ✗ | ✗ | **No** | `app/recruteur/athletes/[id]/page.tsx` | Unchanged. `can_see_detailed_eval` never consulted. |
| **11** | Recruteur — global recruitment status (All Star) | ✗ | ✗ | ~ | **Partial** | `app/recruteur/athletes/[id]/page.tsx`; trigger in `supabase/migrations/20260418080000_scope_global_status_trigger.sql` | Read-side unchanged (status pill still shows for all tiers). **Write-side closed in Phase 1:** the `sync_global_recruitment_status` trigger now returns early if `NOT user_has_pro(NEW.recruiter_id)`, so Free pipeline writes cannot pollute the shared field. Read gate still ✗. |
| **12** | Recruteur — who else viewed (All Star) | ✗ | ✗ | ✗ | **No** | — | Feature still not implemented on the profile page. If added, currently no gate exists. |
| **13** | Recruteur — max favorites = 10 (Free) | ✓ | ✗ | ✓ | **Yes** (DB level) | RLS: `recruiter_favorites_insert` in `20260418093000_phase2b_rls_tier_gates_p1.sql` L31-42; UI: [`app/recruteur/favoris/page.tsx`](app/recruteur/favoris/page.tsx) L423-425, [`app/recruteur/recherche/page.tsx`](app/recruteur/recherche/page.tsx) L851-856, [`app/recruteur/athletes/[id]/page.tsx`](app/recruteur/athletes/[id]/page.tsx) L551-553 | **Flipped ✗→✓ (UI+DB) in Phases 2b + 3.** DB enforces `count_user_favorites() < 10` on INSERT for Free. UI shows `{n} / 10` counter on favoris page (red at cap), heart disabled at cap on recherche cards + profile page with tooltip explaining the cap. |
| **14** | Recruteur — max search results = 10 (Free) | ✓ | ✗ | ~ | **Yes** (server-side cap) | [`app/recruteur/recherche/page.tsx`](app/recruteur/recherche/page.tsx) L431-433; [`lib/hooks/useSubscription.ts`](lib/hooks/useSubscription.ts) L378-379 | **Flipped ✗→✓ in Phase 3.** `.limit(maxSearchResults)` is now on the Supabase query itself (after filters/sort), not a post-fetch blur. Free recruiters get exactly 10 rows over the wire. UpgradeMoreBanner shown when cap is hit (L887-889). Note: DB column marked `~` because there is no RLS `LIMIT`-style policy (Supabase `.limit()` is server-side via PostgREST, good enough), but a raw REST call without `.limit=10` would return everything Free can see — so technically a tampered client could still pull more. Effective fail-open safe for the app UX. |
| **15** | Recruteur — coaches per team limit (1 Free, 1 Pro, ∞ All Star) | ✓ (page gate) | ✗ | ✗ | **No** (within page) | [`app/recruteur/cegep/inviter/page.tsx`](app/recruteur/cegep/inviter/page.tsx) wrapped in `CegepGate` | Page is fully replaced by `<UpgradePlaceholder>` for non-All-Star thanks to Phase 3. But within the page (i.e. for an All Star user), there is still no per-team count check on the invite action. Not a paywall leak (only All Star reaches this code path), but a business-rule gap. |
| **16** | Recruteur — Pipeline Kanban (Pro+) | ✗ | ✗ | ✓ | **Yes** (DB level — partial) | RLS: `recruiter_pipeline_insert/update` in `20260418090000_phase2a_rls_tier_gates_p0.sql`; [`app/recruteur/pipeline/page.tsx`](app/recruteur/pipeline/page.tsx) | **Flipped ✗→✓ (DB) in Phase 2a.** Page still renders for Free, but any write to pipeline is DB-checked. Free can only INSERT/UPDATE rows with stage IN (IDENTIFIE, CONTACTE). Pro+ is unrestricted. The page UI would still let a Free user click through stage changes → DB returns an error — a clean UX would require wrapping the page in `FeatureGate requiredTier="pro"`. DB leak closed. |
| **17** | Recruteur — pipeline stages ≥ EN_DISCUSSION (Pro+) | ✗ | ✗ | ✓ | **Yes** (DB level) | RLS: `recruiter_pipeline_update` WITH CHECK in `20260418090000_phase2a_rls_tier_gates_p0.sql` L115-121; [`app/recruteur/pipeline/page.tsx`](app/recruteur/pipeline/page.tsx) L919-929 `handleStatusChange` | **Flipped ✗→✓ (DB) in Phase 2a.** `.update({ stage: "ENGAGE" })` from a Free user is rejected by RLS WITH CHECK clause. `handleStatusChange` itself has no tier check and will surface the error; cleaner UX would be to pre-check and disable drag targets. |
| **18** | Recruteur — send messages to coach (Pro+) | ✗ | ✗ | ✓ | **Yes** (DB level) | RLS: `messages_insert` + `conversations_insert` in `20260418090000_phase2a_rls_tier_gates_p0.sql`; [`app/recruteur/messages/nouveau/page.tsx`](app/recruteur/messages/nouveau/page.tsx) L317, L326 | **Flipped ✗→✓ (DB) in Phase 2a.** Free recruiters cannot insert into `conversations` or `messages` — both policies require `user_has_pro()`. UI has no gate; a Free user would see the compose form and hit an error on send. UX polish remaining; revenue leak closed. |
| **19** | Recruteur — full inbox (All Star) | ✗ | ✗ | ✗ | **No** | [`app/recruteur/messages/page.tsx`](app/recruteur/messages/page.tsx) | Unchanged. Thread list loads all conversations owned by the user. `has_full_inbox` still never checked. Since Free cannot send new messages (Feature 18), they have nothing in the inbox to look at, which hides the issue — but Pro users (who also shouldn't have the All-Star "full inbox") still see everything. |
| **20** | Recruteur — activity feed (Pro+) | ✗ | ✗ | ✗ | **No** | [`app/recruteur/activites/page.tsx`](app/recruteur/activites/page.tsx) | Unchanged. `ActivityFeedFull` renders for Free; `recruiter_activity_log` fetch has no tier filter, and the table has no new tier-aware SELECT policy. Still a read-leak. |
| **21** | Recruteur — athlete trend analytics (All Star) | ? | ✗ | ✗ | **No** | Unclear — still no dedicated page located | Unchanged. |
| **22** | Recruteur — full CÉGEP portal `/recruteur/cegep/*` (All Star) | ✓ DB-backed | ✗ | ✗ | **Yes** (UI level) | [`components/subscription/CegepGate.tsx`](components/subscription/CegepGate.tsx) wraps all 7 pages | **Flipped ✗→✓ (source of truth + fail-open) in Phase 3.** `CegepGate` now reads from DB-backed `useSubscription()` (no longer localStorage) and early-returns — pages never mount for non-All-Star, their Supabase fetches never fire. LocalStorage bypass is gone. |
| **23** | Recruteur — custom prospect lists `/recruteur/listes` (All Star) | ✗ | ✗ | ✓ | **Yes** (DB level) | RLS: `recruiter_lists_insert/update`, `recruiter_list_members_insert` in `20260418093000_phase2b_rls_tier_gates_p1.sql`; [`app/recruteur/listes/page.tsx`](app/recruteur/listes/page.tsx) | **Flipped ✗→✓ (DB) in Phase 2b.** Note: policy gates lists behind `user_has_pro()` (Pro+), but CLAUDE.md says lists are **exclusively Pro** (not All Star). Current RLS matches "Pro or All Star" which is more permissive than spec — Starter tier would not qualify, which is correct, and All Star would qualify, which CLAUDE.md explicitly states should not be the case ("Custom prospect lists are EXCLUSIVELY Pro — Free and Starter have no access"). Worth a product decision: is the intent "Pro-or-higher" or "Pro-only-not-AllStar"? Current code implements the former. No UI gate; lists page loads for everyone but writes fail at the DB for non-Pro+. |

---

## CRITICAL GAPS

Only gaps that are **still open** after Phases 1-4. Ordered by severity.

### Severity 1 — unimplemented product contract

| # | Feature | Why critical |
|---|---|---|
| **7-11** | Recruiter sees full athlete identity + coach comments + academics + global status on Free | CLAUDE.md states **Free = anonymized profiles** ("stats, school, sport, rating visible; name, photo, position, jersey hidden"). No UI masking, no RLS column-level gate. This is the single largest departure from the product spec and the most commercially sensitive remaining leak. |

### Severity 2 — Pro-tier features open to Free via read path

| # | Feature | Why critical |
|---|---|---|
| **16** | Pipeline page renders for Free even though writes are DB-blocked | UX is broken (Free sees an interactive Kanban they can't use). Recommendation: wrap the page in `<FeatureGate requiredTier="pro" feature="unlimited_pipeline">`. |
| **18** | Messages inbox renders for Free; compose form renders but send fails at DB | Same UX issue as #16. |
| **19** | Full inbox (All Star) still shows everything to Pro | Read-side gate never consulted. No DB distinction between Pro-inbox-scope vs All-Star-inbox-scope. |
| **20** | Activity feed open to Free | No DB filter on `recruiter_activity_log`, no UI gate. |
| **23** | Lists page renders for non-Pro+ (writes blocked at DB) | UX same as #16. Also: product decision needed on "Pro-only vs Pro+" scope. |

### Severity 3 — low-value / cosmetic / spec mismatches

| # | Feature | Why critical |
|---|---|---|
| **1** | Athlete trend chart renders for Free | Low-severity read leak; no PII. Defer until Feature 2's layout is final. |
| **3** | Athlete programs search / blog / map / recruiting guide | Not implemented at all. Build-when-shipped. |
| **6** | Coach analytics gated at Pro not All Star | Spec mismatch flagged last time; still unresolved. Product decision. |
| **10** | Recruteur detailed profile sections (All Star) | Part of the broader Features 7-11 problem. |
| **12, 21** | Who-else-viewed / trend analytics | Neither feature is implemented. |
| **15** | Coaches-per-team cap for All Star | Business-rule gap, but only reachable by All Star users. |

---

## UNEXPECTED FINDINGS

### 1. `useSubscription` is the single source of truth — consolidation complete
The old `lib/utils/subscription.ts` and its `"free" | "coach_pro" | ... | "athlete_pro"` tier taxonomy are gone. The only references that survive are in the two old audit reports and a tier-normalization report. All three gate components (`FeatureGate`, `SchoolGate`, `CegepGate`) and the sidebar now read from `useSubscription()`. One tier taxonomy, one data source.

### 2. RLS helper `count_user_favorites()` counts ALL rows, not just writable ones
`public.count_user_favorites(uid)` counts `WHERE recruiter_id = uid` without filtering by any soft-delete or archive flag. If a future feature introduces soft-deleted favorites, the cap could falsely hit. Not a bug today — worth a comment in a future migration.

### 3. Phase 2b lists policy is "Pro+" but CLAUDE.md is "Pro-only"
`recruiter_lists_insert` uses `user_has_pro()`, which returns true for both `pro` and `all_star`. CLAUDE.md states "Custom prospect lists are EXCLUSIVELY Pro — Free and Starter have no access", implying All Star recruiters should not have access either (since All Star gets CÉGEP management, lists is explicitly a Pro-not-All-Star differentiator). This is the literal opposite of what one would expect — worth a product review.

### 4. `recruiter_pipeline` SELECT policy doesn't distinguish Free vs Pro
A Free recruiter can still READ any pipeline rows they created (legit). They can also still READ rows written before they downgraded, including rows with stages beyond CONTACTE. No tier gate on SELECT — which is fine for "read your own data" but may surprise a user who expects stage data to be "locked out" post-downgrade.

### 5. Sidebar still reads `localStorage.nexus_user` for name / initials / institution
[`app/recruteur/_components/RecruiterSidebar.tsx`](app/recruteur/_components/RecruiterSidebar.tsx) L115-133 reads `nexus_user` from localStorage for display purposes (not tier). Comment at L113-114 acknowledges this is safe because it's not a tier-gated read, but if that localStorage bag is ever repurposed for a tier hint, it could leak. Keep tier reads in `useSubscription()`; the bag should die eventually.

### 6. `messages_insert` RLS allows COACH inserts without tier check
The policy is: `COACH OR (RECRUTEUR AND user_has_pro())`. This is correct per the "coaches always free" design, but means any coach can message anyone, with no abuse-prevention gate (rate limit, conversation cap). Out of scope for tier audit, but worth a note.

### 7. `sync_global_recruitment_status` trigger now SECURITY DEFINER with locked search_path
Phase 1 migration (`20260418080000_scope_global_status_trigger.sql`) added `SET search_path = public` which is the correct hardening for `SECURITY DEFINER` — prevents search-path-based privilege escalation. Nice quiet fix bundled in.

### 8. No pricing-column reconciliation since 2026-04-17
Findings 5, 6, 7 from the previous audit (recruiter table has no price columns; athlete Pro price mismatch; coach Pro price mismatch in tarifs page) are unchanged. Phase 4 "pricing matrix locked" commit message suggests the tarifs page was updated, but I did not re-verify the exact numbers — worth a fresh diff of `app/tarifs/page.tsx` against the DB.

### 9. New pattern worth noting — early-return FeatureGate is clearly documented
The inline comments in `FeatureGate.tsx`, `SchoolGate.tsx`, `CegepGate.tsx`, and `UpgradePlaceholder.tsx` all explicitly call out the blur-leak rationale and the "children never mount" guarantee. That level of in-code documentation on a security-sensitive boundary is a genuine improvement — future contributors will have a harder time accidentally reverting the pattern.

### 10. DB cap constants are hardcoded in the migration, not read from feature-flag tables
`recruiter_favorites_insert` hardcodes `< 10` and `athletes_insert` hardcodes `< 30`. The `subscription_features_recruteur` / `subscription_features_coach` tables have `max_favorites` / `max_athletes` columns the hook reads. If a product decision changes the caps, both places must move. A future helper `public.tier_cap(feature TEXT, tier TEXT) → INTEGER` would centralize this.

---

## Recommended remediation order

Remaining work, ordered by leverage:

1. **Implement the anonymized-Free recruiter view (Features 7-11)** — this is the single largest spec deviation left and the most commercially sensitive. Either column-level RLS on `athletes` for recruiter SELECT, or a server-side view that strips PII columns when `get_user_tier() = 'free'`.
2. **Wrap Pro-tier recruiter pages in `FeatureGate`** — `/recruteur/pipeline`, `/recruteur/messages`, `/recruteur/listes`, `/recruteur/activites`. DB rejects writes; the UI should reject reads + show `<UpgradePlaceholder>`. Pure UX polish on top of existing DB enforcement.
3. **Pick one scope for lists (Pro-only vs Pro+)** and align CLAUDE.md, `subscription_features_recruteur`, `recruiter_lists_insert`, and (eventually) Stripe products.
4. **Move writes behind Server Actions or Route Handlers** — belt-and-braces with RLS. Single audit trail. Opportunity to add rate limits.
5. **Read-tier gates on `recruiter_activity_log` and `recruiter_athlete_views`** — currently SELECT is ownership-only; add tier-aware policies so a Free recruiter's activity feed query is actually empty, not "everything I own."
6. **Centralize numeric caps** — add `public.tier_cap(feature, tier)` returning the correct limit from `subscription_features_*` and rewrite `recruiter_favorites_insert` and `athletes_insert` to call it. Single place to edit when caps change.
7. **Reconcile tarifs page prices with the DB** — deferred from 2026-04-17; verify Phase 4 closed this.

---

*End of audit.*
