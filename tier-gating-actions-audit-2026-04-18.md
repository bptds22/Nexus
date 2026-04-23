# Tier Gating Audit — WRITE ACTIONS (re-audit)
**Date:** 2026-04-18
**Scope:** Free / Pro / All Star enforcement on write operations (insert / update / delete / upsert)
**Auditor:** Claude (read-only review, post-Phases-1-4)
**Companion report:** [tier-gating-audit-2026-04-17.md](tier-gating-audit-2026-04-17.md) — features-level audit
**Previous revision:** [tier-gating-actions-audit-2026-04-17.md](tier-gating-actions-audit-2026-04-17.md) — the pre-fix baseline this report is diffed against

---

## Executive summary

Phases 1 through 4 have shipped since the 2026-04-17 audit. The core finding of the previous audit — that "the paywall is cosmetic at the action layer" — **no longer applies to the revenue-critical write paths** (`messages`, `conversations`, `recruiter_pipeline`, `recruiter_favorites`, `recruiter_lists`, `recruiter_list_members`, `athletes` INSERT). Each of those tables now carries both an ownership RLS policy **and** a tier-aware WITH CHECK clause backed by `public.user_has_pro()` / `public.get_user_tier()` / count-helpers defined in `supabase/migrations/20260417150000_tier_helper_functions.sql`.

The chosen remediation shape is **belt-and-braces via RLS**, not a Server-Actions migration. The codebase still has no `app/api/` directory and zero `"use server"` files — the API Gate column therefore remains ✗ for every row in this audit. That is intentional: RLS is enforced by the database regardless of where the call originates (browser, devtools, curl, or a future Server Action), so tier gating at the RLS layer closes the leak even though the API-gate column keeps reading ✗.

**Four structural changes back this conclusion:**

1. **Tier-aware RLS is live.** Phase 2a (`20260418090000_phase2a_rls_tier_gates_p0.sql`) and Phase 2b (`20260418093000_phase2b_rls_tier_gates_p1.sql`) split the old permissive ALL policies into per-command policies and attached tier checks to every INSERT / UPDATE `WITH CHECK` clause that carries a revenue implication.
2. **Gate components no longer leak data.** `FeatureGate`, `SchoolGate`, and `CegepGate` now conditionally render children — they return `<UpgradePlaceholder />` when the user fails the check, so the gated subtree never mounts and its `useEffect` / Supabase calls never fire. The `blur-renders-data-anyway` class of bug from the prior audit is gone.
3. **Search cap is server-side.** `app/recruteur/recherche/page.tsx` now passes `.limit(maxSearchResults)` (from the DB-backed hook) before fetching. A Free recruiter pulls at most 10 rows; Pro+ reads `-1` and gets unlimited.
4. **The `toggleFav` anti-pattern is fixed.** Favoriting no longer inserts a `recruiter_pipeline` row as a side-effect — Unexpected Finding #1 from the prior audit is closed. The `trg_sync_global_status` trigger is also now scoped to Pro+ writers (Unexpected Finding #2, closed by `20260418080000_scope_global_status_trigger.sql`).

**What is still outstanding at the write layer:**

- **Usage limits** for `message_limit` (Free=0, Pro=10, AS=unlimited) and `pipeline_limit` (50 for Pro) are still advisory — no RLS count check or trigger enforces them. The **binary** gates (Pro-only messaging, Free-cap 10 favorites, 30 athletes) are hardened; the **numeric per-tier quotas above zero** are not.
- **CÉGEP management** (Actions 19–21) no longer depends on `localStorage` — `CegepGate` reads `useSubscription().tier` — but the underlying `invitations` and reassignment-flow writes do not have tier-aware RLS. UI gate is correct; the DB will still accept the write if it's replayed directly.
- **Auto-message toggle (#17)** now has the right DB flag shape (`can_send_auto_message = true` for Pro+) but no code path consults it.
- **`lib/utils/subscription.ts` is deleted.** The localStorage parallel system flagged in the prior audit's Unexpected Finding #4 is gone — `useSubscription` is the sole source of truth for tier.

---

## Methodology

Same as the 2026-04-17 revision: `.insert(`, `.update(`, `.delete(`, `.upsert(` grepped across `app/**/*.tsx`, ±5 lines of context inspected for tier guards, then cross-checked against current RLS policies in the `supabase/migrations/` files (baseline + 2026-04-17 fix-pack + Phases 1–4).

**Columns glossary (unchanged):**
- **UI Gate** — does a FeatureGate/SchoolGate/CegepGate wrap the trigger, or is the trigger hidden via `canSee()` / `isPro()`? ✓ = yes, ✗ = not at all, ? = unclear.
- **API Gate** — is there a server-side enforcement layer (Server Action or Route Handler) that checks tier before the write? ✓ = yes, ✗ = no gate. **Still ✗ for every row** — the chosen defense is RLS, not Server Actions.
- **DB Gate** — does RLS reference the user's tier (or count) before allowing the INSERT/UPDATE/DELETE? ✓ = tier-aware RLS, ✗ = ownership-only or missing.
- **Limit Enforced?** — for actions with numeric limits, is the usage count actually verified before the write? ✓ = yes (by RLS count helper), ✗ = not enforced, — = action has no numeric limit.
- **Fail-Open Safe?** — if the UI gate is bypassed, does the server still block the write? **Yes** = write is rejected at RLS. **No** = write still lands.

---

## Feature matrix — 27 actions

### Coach actions

| # | Action | Min Tier | UI Gate | API Gate | DB Gate | Limit Enforced? | Fail-Open Safe? | Enforcement file(s) | Notes |
|---|---|---|---|---|---|---|---|---|---|
| **1** | Create athlete when under cap | Free | ✗ | ✗ | ✓ (ownership + tier branch) | — | **Yes** | [`app/coach/athletes/create/page.tsx`](app/coach/athletes/create/page.tsx) L574 `.insert(athleteRecord)`; RLS `"athletes_insert"` in [`20260418093000_phase2b_rls_tier_gates_p1.sql`](supabase/migrations/20260418093000_phase2b_rls_tier_gates_p1.sql) L163-174 | Phase 2b rewrote the old ownership-only policy into a tier-aware policy that allows the insert when `user_has_pro()` OR `count_coach_athletes() < 30`. Under-cap Free writes succeed. |
| **2** | **Create athlete when AT/ABOVE cap** | Pro | ✗ | ✗ | ✓ (count-gated) | **✓** | **Yes** | Same file as #1; cap check in RLS via `public.count_coach_athletes() < 30` | **Closed by Phase 2b.** Numeric cap of 30 hardcoded from `subscription_features_coach.free.max_athletes = 30` ([`20260417143500_unlimited_sentinel_and_coach_cap.sql`](supabase/migrations/20260417143500_unlimited_sentinel_and_coach_cap.sql)). Write rejected by RLS when over cap. |
| **3** | Evaluate athlete (traits) | Free | — | — | ✗ (ownership only) | — | — | [`app/coach/athletes/[id]/modifier/page.tsx`](app/coach/athletes/%5Bid%5D/modifier/page.tsx) L664 `.upsert(...)`; RLS `"evaluations coach"` | Always Free per CLAUDE.md. No tier gate needed. Unchanged. |
| **4** | Verify athlete profile | Free | — | — | ✗ (ownership only) | — | — | Coach modify page — `.update` on `athletes.verified`; RLS `"coaches can update own athletes"` | Always Free. Unchanged. |
| **5** | Invite coach to school | Pro | ✓ DB-backed | ✗ | ✗ (ownership only on `invitations`) | — | **No** | [`app/coach/settings/page.tsx`](app/coach/settings/page.tsx) AdminEcoleSection `.insert(invitations)`; wrapped in `<SchoolGate>` which now conditionally renders (Phase 3) | UI gate now DB-backed **and** non-leaky (Phase 3 replaced blur with early return). DB layer for the `invitations` table itself still has no tier check; a direct SQL replay would succeed. Lower priority than P0 P1 because the UI gate is now structurally sound. |
| **6** | Access Mon École data via direct query | Pro | ✓ DB-backed + non-leaky | ✗ | ✗ | — | **Partial** | [`app/coach/ecole/*/page.tsx`](app/coach/ecole/) — all wrapped in `<SchoolGate>` | **Improved by Phase 3.** SchoolGate now `return <UpgradePlaceholder />` instead of blurring, so gated children don't mount and their `.select()` calls never run. Replay via direct Supabase client is still possible (no tier check on the read side). |
| **7** | Modify athlete as school-admin coach | Pro | ✗ | ✗ | ✗ (ownership only) | — | — | Coach modify page L607 `.update(...)`; RLS `"coaches can update own athletes"` | Unchanged from prior audit — cross-coach write via `is_school_admin` still not granted by any policy. Not a tier leak; a missing feature. |

### Recruteur — search and favorites

| # | Action | Min Tier | UI Gate | API Gate | DB Gate | Limit Enforced? | Fail-Open Safe? | Enforcement file(s) | Notes |
|---|---|---|---|---|---|---|---|---|---|
| **8** | Search athletes — first 10 results | Free | — | — | ✗ (`recruiters can read active athletes`) | — | — | [`app/recruteur/recherche/page.tsx`](app/recruteur/recherche/page.tsx) L308-435 `.from("athletes").select(...)` | Intended: always available. Unchanged. |
| **9** | **Search — retrieve 11th+ result** | Pro | ✓ (FeatureGate + server limit) | ✗ | ✓ (server `.limit()`) | **✓** | **Yes** | [`app/recruteur/recherche/page.tsx`](app/recruteur/recherche/page.tsx) L431-433 `if (maxSearchResults !== -1) query = query.limit(maxSearchResults)` | **Closed by Phase 3.** `maxSearchResults` comes from `useSubscription().getLimit("search_results_limit")`. A Free user literally receives only 10 rows; the 11th row never leaves the database. RLS has no tier filter on athletes read (still ownership-free for recruiters-reading-active-athletes), but the client-hook server-side `.limit()` + the `UpgradeMoreBanner` beneath a 10-row page produce the effective cap. |
| **10** | Favorite an athlete — up to 10 | Free | ✓ (disable-at-cap) | ✗ | ✓ (tier + count) | **✓** | **Yes** | [`app/recruteur/recherche/page.tsx`](app/recruteur/recherche/page.tsx) L570-596 `toggleFav`; RLS `"recruiter_favorites_insert"` in Phase 2b | UI now reads `maxFavorites` from the hook, disables the heart at cap with a tooltip. Works correctly within limit. |
| **11** | **Favorite the 11th+ athlete** | Pro | ✓ (disabled button) | ✗ | ✓ (RLS count check) | **✓** | **Yes** | Same as #10 | **Closed by Phase 2b.** Policy `"recruiter_favorites_insert"` WITH CHECK allows the insert only if `user_has_pro()` OR `(get_user_tier() = 'free' AND count_user_favorites() < 10)`. A direct-client insert past the cap is rejected by RLS. Also closes **Unexpected Finding #1** from the prior audit — `toggleFav` no longer inserts a `recruiter_pipeline` row as a side-effect (Phase 1 commit `13f8c20`). |

### Recruteur — pipeline

| # | Action | Min Tier | UI Gate | API Gate | DB Gate | Limit Enforced? | Fail-Open Safe? | Enforcement file(s) | Notes |
|---|---|---|---|---|---|---|---|---|---|
| **12** | Add athlete to pipeline at `IDENTIFIE` | Free (scoped to `IDENTIFIE`/`CONTACTE` only) | ✗ | ✗ | ✓ (stage-gated) | — | **Yes** | [`app/recruteur/pipeline/page.tsx`](app/recruteur/pipeline/page.tsx); RLS `"recruiter_pipeline_insert"` in Phase 2a | **Behaviour changed.** Phase 2a explicitly permits Free to write `IDENTIFIE` + `CONTACTE`, and tier-gates everything else. The previous silent auto-insert on favorite is gone (Phase 1 decoupling). |
| **13** | Move to `CONTACTE` | Free | ✗ | ✗ | ✓ (stage-gated) | — | **Yes** | [`app/recruteur/pipeline/page.tsx`](app/recruteur/pipeline/page.tsx) L926 `.update({ stage: ... })`; RLS `"recruiter_pipeline_update"` in Phase 2a | Allowed for Free per DB `subscription_features_recruteur` row. WITH CHECK includes the same stage-set guard. |
| **14** | **Move to `EN_DISCUSSION`** | Pro | ✗ | ✗ | ✓ (tier-gated) | — | **Yes** | Same handler as #13; RLS `"recruiter_pipeline_update"` with `WITH CHECK (public.get_user_tier() = 'free' AND stage IN ('IDENTIFIE', 'CONTACTE')) OR public.user_has_pro()` | **Closed by Phase 2a.** Direct-client update to `EN_DISCUSSION` by a Free user is rejected. |
| **15** | **Move to `VISITE_PLANIFIEE` / `ENGAGE` / `LETTRE_SIGNEE`** | Pro | ✗ | ✗ | ✓ (tier-gated) | — | **Yes** | Same handler; also [`app/recruteur/athletes/[id]/page.tsx`](app/recruteur/athletes/%5Bid%5D/page.tsx) `StatusChangeDropdown` | **Closed by Phase 2a + Phase 1.** The stage guard blocks the update itself; the `trg_sync_global_status` trigger has a Pro-only guard ([`20260418080000_scope_global_status_trigger.sql`](supabase/migrations/20260418080000_scope_global_status_trigger.sql) L31: `IF NOT public.user_has_pro(NEW.recruiter_id) THEN RETURN NEW`) so even if a Pro-level stage ever slipped through, it wouldn't propagate to shared `athletes.recruitment_status` for a Free user. Belt and braces. |

### Recruteur — messaging

| # | Action | Min Tier | UI Gate | API Gate | DB Gate | Limit Enforced? | Fail-Open Safe? | Enforcement file(s) | Notes |
|---|---|---|---|---|---|---|---|---|---|
| **16** | **Send message to coach** | Pro | ✗ | ✗ | ✓ (tier-gated) | ✗ (numeric quota not enforced) | **Yes** (for binary gate) | [`app/recruteur/messages/nouveau/page.tsx`](app/recruteur/messages/nouveau/page.tsx) L317-334; RLS `"messages_insert"` + `"conversations_insert"` in Phase 2a | **Binary Pro-gate closed by Phase 2a.** Free recruiter cannot insert into `messages` or `conversations` — both policies require `user_has_pro()` for recruiter role (coaches pass through, which is correct). **Numeric quota still advisory:** `message_limit = 10` for Pro is in the hook but not enforced by RLS. A Pro recruiter can send >10 messages/period. Low priority — the revenue-critical gate (Free sends zero) is closed. |
| **17** | Send auto/template message | Pro | ✗ | ✗ | ✗ (no distinct column in the insert) | — | **No** | Same as #16 | DB flag inversion fixed ([`20260417143000_fix_feature_flags.sql`](supabase/migrations/20260417143000_fix_feature_flags.sql) sets `can_send_auto_message = true` for Pro+). No code path separates auto vs manual inserts, so there's no distinct write to gate. Leak is purely cosmetic — a Free user can't send any message, so they can't send an auto-message either. |
| **18** | Read message thread | Open (participants) | — | — | ✓ (`messages_select`: must be participant) | — | — | [`app/recruteur/messages/[id]/page.tsx`](app/recruteur/messages/%5Bid%5D/page.tsx) | Read-side correct via participant RLS. Unchanged. |

### Recruteur — CÉGEP management (All Star)

| # | Action | Min Tier | UI Gate | API Gate | DB Gate | Limit Enforced? | Fail-Open Safe? | Enforcement file(s) | Notes |
|---|---|---|---|---|---|---|---|---|---|
| **19** | **Invite another recruiter to CÉGEP** | All Star | ✓ DB-backed (Phase 3 non-leaky `CegepGate`) | ✗ | ✗ | — | **No** | [`app/recruteur/parametres/page.tsx`](app/recruteur/parametres/page.tsx) `AdminCegepSection` L219-226 `.insert(invitations)` | `CegepGate` now reads `useSubscription().tier` and `isSchoolAdmin` (no more localStorage). UI gate solid. `invitations` table RLS does not check tier — a direct replay still succeeds. **Open.** |
| **20** | **Reassign athletes between recruiters** | All Star | ✓ DB-backed (Phase 3 non-leaky `CegepGate`) | ✗ | ✗ for tier; ownership still enforced | — | **Partial** | [`app/recruteur/cegep/reassignation/page.tsx`](app/recruteur/cegep/reassignation/page.tsx) L259 wrapped in `<CegepGate>` | UI gate no longer localStorage-based. RLS on `recruiter_pipeline` / `recruiter_favorites` still enforces ownership, so blast radius is capped to rows the caller owns. No tier check on the cross-recruiter reassignment path itself. **Open.** |
| **21** | Access CÉGEP stats | All Star | ✓ DB-backed | ✗ | ✗ (read-only) | — | **Partial** | [`app/recruteur/cegep/stats/page.tsx`](app/recruteur/cegep/stats/page.tsx) wrapped in `<CegepGate>` | Phase 3 gate now truly blocks render — hooks inside don't fire for Free/Pro users, so aggregates are never computed or sent to the browser. Direct Supabase read of the underlying tables still possible. |
| **22** | **Create custom prospect list** | Pro | ✗ | ✗ | ✓ (Pro-only) | — | **Yes** | [`app/recruteur/listes/page.tsx`](app/recruteur/listes/page.tsx) L1042 `.insert(...)`; RLS `"recruiter_lists_insert"` in Phase 2b | **Closed by Phase 2b.** WITH CHECK requires `public.user_has_pro()`. Also note: prior audit flagged `prospect_list_athletes` as a deprecated twin — dropped by [`20260417144000_drop_prospect_tables.sql`](supabase/migrations/20260417144000_drop_prospect_tables.sql). Unexpected Finding #7 closed. Tier scope aligned with workbook: Pro+ (not All Star-only as CLAUDE.md implied). |
| **23** | Add athlete to custom list | Pro | ✗ | ✗ | ✓ (Pro-only + parent-list ownership) | — | **Yes** | Same file L1089 `.insert(...)`; RLS `"recruiter_list_members_insert"` in Phase 2b | **Closed by Phase 2b.** WITH CHECK requires both `user_has_pro()` AND that the referenced `recruiter_lists` row belongs to the caller. |

### Athlete actions

| # | Action | Min Tier | UI Gate | API Gate | DB Gate | Limit Enforced? | Fail-Open Safe? | Enforcement file(s) | Notes |
|---|---|---|---|---|---|---|---|---|---|
| **24** | Update own profile | Free | — | — | ✓ (ownership) | — | — | [`app/athlete/profil/page.tsx`](app/athlete/profil/page.tsx); RLS `"athletes can update own profile"` | Correct. Unchanged. |
| **25** | Toggle visibility settings | Free | — | — | ✓ (ownership) | — | — | [`app/athlete/visibilite/page.tsx`](app/athlete/visibilite/page.tsx) | Correct. Unchanged. |
| **26** | View "who viewed me" / recruiter names | Pro | ✓ DB-backed + non-leaky | ✗ | ✗ | — | **Yes (client-side)** | [`app/athlete/visibilite/page.tsx`](app/athlete/visibilite/page.tsx) L174-181 `<FeatureGate>` wraps Pro-only sub-components; hooks inside fire only when rendered (Phase 3) | **Improved by Phase 3.** Sub-components (`CegepDetailsSection`, `RecruiterNamesSection`) now *only* mount when the gate passes, so `useAthleteVisibilityPro()` — the hook that actually fetches recruiter names — never runs for Free athletes. Data no longer leaks through the network tab. No server-side tier check on the `recruiter_athlete_views` / `recruiter_favorites` reads themselves; defense is UI-layer + gate-structure. |
| **27** | Access recruiting guide | All Star (per DB flag) | N/A (public marketing page) | — | — | — | — | [`app/guide-recrutement/page.tsx`](app/guide-recrutement/page.tsx) | Spec/impl mismatch; marketing page still public. Unchanged. |

---

## CRITICAL REVENUE LEAKS — still open

The P0 block from the prior audit is **fully closed** at the DB layer (tier-gated RLS on messages, conversations, pipeline, favorites, lists, list_members, athletes INSERT). Remaining open items are narrower.

### P0 — remaining

*(none — every P0 from the previous audit has a DB-level block.)*

### P1 — remaining

1. **#19 — Invite recruiter to CÉGEP** (All Star). UI gate is now DB-backed and non-leaky (Phase 3 `CegepGate`), but `invitations` table still has no tier-aware RLS. A replay with a direct Supabase client still succeeds. Closing this needs a Phase 2c pass on the `invitations` table (pattern: add `WITH CHECK (public.user_has_all_star() OR public.user_is_school_admin())`).

2. **#20 — Reassign athletes** (All Star). UI gate DB-backed; RLS on `recruiter_pipeline` / `recruiter_favorites` still ownership-enforces per row. No tier check on the reassign flow. Same Phase 2c fix as #19.

### P2 — remaining

- **#7 — Cross-coach write via `is_school_admin`.** Not a tier leak; a missing feature. No RLS policy currently grants school-admin coaches write access to another coach's athletes. Product decision.
- **#17 — Auto-message differentiator.** DB flag is now correct (Pro+), but no code path distinguishes auto from manual inserts, so there's no separate write to gate. Purely cosmetic given #16 is hardened.
- **#5 — `invitations` (coach → school).** Same class as #19. UI gate good; table RLS not tier-aware. Low priority because (a) school-admin coaches are already a narrow cohort and (b) Phase 3 made the gate non-leaky.

---

## USAGE LIMIT GAPS

The table below shows which caps now have **DB-level enforcement** via RLS count checks and which remain advisory.

| Limit | Spec value (Free) | Enforced at DB? | Mechanism | Notes |
|---|---|---|---|---|
| `max_search_results` | 10 | **Partially (server-side `.limit()`)** | `useSubscription().maxSearchResults` passed into `.limit()` at query time (`app/recruteur/recherche/page.tsx` L431-433) | Server literally returns ≤10 rows. Not RLS-enforced, but the payload never contains more than the cap allows. Free recruiter effectively capped. |
| `max_favorites` | 10 | **Yes (RLS)** | `public.count_user_favorites() < 10` in `recruiter_favorites_insert` WITH CHECK | Phase 2b. Direct-client insert past cap is rejected. |
| `max_athletes` (coach) | 30 | **Yes (RLS)** | `public.count_coach_athletes() < 30` in `athletes_insert` WITH CHECK | Phase 2b. Uses the `max_athletes` column added in `20260417143500_unlimited_sentinel_and_coach_cap.sql`. |
| `pipeline_limit` (Pro=50, AS=-1) | — (Pro-tier numeric quota) | **No** | — | Binary Free-vs-Pro stage gate is enforced by RLS; the per-tier numeric ceiling is not. Low priority (Pro-on-Pro abuse). |
| `message_limit` (Pro=10, AS=-1) | — (Pro-tier numeric quota) | **No** | — | Binary Free→can't-send gate is enforced; the Pro=10/period ceiling is advisory. Low priority. |
| `coaches_per_team` | 1 (Free & Pro) | **No** | — | No check on the `school_coaches` / invite flow. Same class as `invitations` (Action 19). |

**Net change vs. 2026-04-17:** the three binary caps (favorites 10, search 10, athletes 30) that rectify Free → Pro upgrades all now have a gate. The two "how much can Pro do per period" numeric quotas (pipeline, message) remain advisory. Those are internal-to-Pro revenue protection and fall outside the "Free user exploits paid feature" threat model.

---

## DEFENSE-IN-DEPTH WINS

Unlike the 2026-04-17 revision (which had zero full-stack wins), this re-audit has seven:

| Action | UI Gate | DB Gate (ownership) | DB Gate (tier) | Full stack? |
|---|---|---|---|---|
| #2 — Athletes INSERT cap | — (silent) | ✓ | ✓ (count-gated) | **Yes** |
| #10 — Favorites under cap | ✓ (disabled button) | ✓ | ✓ | **Yes** |
| #11 — Favorites over cap | ✓ | ✓ | ✓ (count-gated) | **Yes** |
| #14 — Pipeline EN_DISCUSSION+ | ✗ | ✓ | ✓ (stage-gated) | **Yes** (DB-only sufficient) |
| #15 — Pipeline VISITE+ | ✗ | ✓ | ✓ (stage-gated + trigger guard) | **Yes** |
| #16 — Send message | ✗ | ✓ | ✓ (Pro-only) | **Yes** (DB-only sufficient) |
| #22 — Create list | ✗ | ✓ | ✓ (Pro-only) | **Yes** |
| #23 — Add to list | ✗ | ✓ | ✓ (Pro-only + parent-ownership) | **Yes** |

The "UI Gate ✗" rows are intentional — Phase 2a/2b opted for a pure RLS defense because the UI already has blur/placeholder layers upstream (Phase 3), and RLS is enforced regardless of the call site. That's the belt-and-braces architecture the original audit's remediation recommendation #1 called for.

### Pattern to replicate when extending coverage

The Phase 2a/2b policies are the template. Copy-paste shape for a new tier-gated write:

```sql
-- From 20260418090000_phase2a_rls_tier_gates_p0.sql L26-44
CREATE POLICY "messages_insert"
ON messages
FOR INSERT
TO authenticated
WITH CHECK (
  sender_id = auth.uid()
  AND (
    (SELECT role FROM users WHERE id = auth.uid()) = 'COACH'
    OR (
      (SELECT role FROM users WHERE id = auth.uid()) = 'RECRUTEUR'
      AND public.user_has_pro()
    )
  )
  AND EXISTS (
    SELECT 1 FROM conversations
    WHERE id = messages.conversation_id
    AND (recruiter_id = auth.uid() OR coach_id = auth.uid())
  )
);
```

Count-gated shape for quota limits (from Phase 2b L31-42):

```sql
CREATE POLICY "recruiter_favorites_insert"
ON recruiter_favorites
FOR INSERT
TO authenticated
WITH CHECK (
  recruiter_id = auth.uid()
  AND EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'RECRUTEUR')
  AND (
    public.user_has_pro()
    OR (public.get_user_tier() = 'free' AND public.count_user_favorites() < 10)
  )
);
```

Applying the same shape to `invitations` (Action 19) and `school_coaches` (for Action 5 / coaches_per_team) closes the remaining P1/P2 items.

---

## UNEXPECTED FINDINGS

### 1. Numeric per-Pro-tier quotas are the only remaining "at-the-write-layer" gap
`message_limit = 10` and `pipeline_limit = 50` on Pro are stored in both the hook and the DB but enforced nowhere. Not a Free→Pro leak; a Pro→All-Star leak. Flag for Phase 5 if a periodic-reset model is introduced.

### 2. Phase 1's `trg_sync_global_status` tier scope
The global recruitment-status cascade now calls `user_has_pro(NEW.recruiter_id)` and early-returns for Free writers. This closes the data-integrity risk from Unexpected Finding #2 in the prior audit (a Free user faking `LETTRE_SIGNEE` into the shared athlete row). Worth calling out explicitly because it's the only tier-aware logic embedded inside a trigger — all other enforcement lives in RLS policies.

### 3. `normalizeTier()` defensively handles casing/separator drift
`lib/hooks/useSubscription.ts` L238-244 collapses any DB value through a whitespace-stripped lowercase match. Combined with the CHECK constraint from `20260417142500_rename_recruteur_tiers_and_normalize_case.sql` (`tier = LOWER(tier)` on `subscriptions`), casing drift is closed at both ends. Unexpected Finding #4 from the prior audit resolved.

### 4. `-1` sentinel standardised across the stack
`20260417143500_unlimited_sentinel_and_coach_cap.sql` converted every `NULL` unlimited marker in `subscription_features_recruteur` to `-1`. The hook already used `-1`. The "NULL >= 10 is false" landmine from Unexpected Finding #5 in the prior audit is closed.

### 5. No Server Actions shipped, and that is fine
Every write is still browser → Supabase client → database. The API Gate column is ✗ for all 27 rows. Given RLS closes the revenue-critical gates, this is not a gap — it's the intentional remediation architecture. If/when Stripe webhooks or cross-table transactional logic ship, Server Actions will become necessary for their own reasons, but not for tier enforcement.

### 6. `lib/utils/subscription.ts` is gone
The localStorage-backed parallel tier system flagged in the prior audit's Unexpected Finding #4 was deleted. `useSubscription` (DB-backed) is now the only source of truth for tier in the client code. Verified by file-absence.

### 7. Pricing matrix locked (Phase 4)
Commit `f4ccbaa` removed stale marketing-route alternative prices. The "$14.99 displayed vs $5.99 charged" drift from Unexpected Finding #9 in the prior audit is resolved. Not strictly a write-action concern, but eliminates a downstream integrity risk when Stripe goes live.

### 8. `prospect_list_athletes` and `prospect_lists` dropped
`20260417144000_drop_prospect_tables.sql` removed both. Unexpected Finding #7 closed.

### 9. Gate components no longer render gated subtrees at all
FeatureGate / SchoolGate / CegepGate now early-return `<UpgradePlaceholder />` on a failing check. Underlying data-fetch hooks never fire. This addresses remediation step #7 from the prior audit's list ("conditionally render, don't blur") — closing the last big architectural finding that was architectural rather than per-action.

### 10. The `invitations` table is the only carryover where UI-only defense remains
Actions 5, 19 (and arguably 20's cross-recruiter flow) all write to `invitations` or reassignment tables without a tier check in RLS. This is a clean Phase 2c target and should be the next pass if audit closure is the goal. Low user-count impact, but finishing it makes the "belt-and-braces at the DB" story complete.

---

## Remediation priority (refined)

Prior-audit step-by-step list, updated for post-Phases-1-4:

1. ~~Block writes with tier-aware RLS on top 5 tables~~ — **done by Phase 2a/2b.**
2. ~~Add count-check triggers for numeric limits~~ — **done for the Free-cap limits (favorites=10, athletes=30); advisory remains for the Pro-tier ceilings (message_limit=10, pipeline_limit=50).**
3. ~~Fix the silent pipeline insert in `toggleFav`~~ — **done by Phase 1.**
4. ~~Fix the `trg_sync_global_status` cascade~~ — **done by Phase 1.**
5. ~~Consolidate three recruiter tier taxonomies~~ — **done (DB renamed via `20260417142500...`; `lib/utils/subscription.ts` deleted; hook is sole source).**
6. Move P0 writes to Server Actions — **deferred, not required. RLS is belt-enough without the braces.**
7. ~~Fix the blur-renders-data-anyway flaw in gate components~~ — **done by Phase 3.**

### Remaining work (new list)

- **Phase 2c:** tier-aware RLS on `invitations` and the CÉGEP reassignation tables (closes Actions 5, 19, 20 at the DB layer).
- **Phase 5 (optional):** periodic-reset counters for `message_limit` and `pipeline_limit` on Pro — only if Product wants Pro→All-Star internal differentiation enforced.
- Re-examine Action 7 (cross-coach writes for school admins). This is a feature decision, not a tier leak.

---

*End of re-audit. The baseline conclusion from 2026-04-17 — "paywall is cosmetic at the action layer" — no longer describes the current state. Every revenue-critical P0 write is now DB-gated.*
