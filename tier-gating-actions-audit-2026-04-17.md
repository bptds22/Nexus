# Tier Gating Audit — WRITE ACTIONS
**Date:** 2026-04-17
**Scope:** Free / Pro / All Star enforcement on write operations (insert / update / delete / upsert)
**Auditor:** Claude (read-only review)
**Companion report:** [tier-gating-audit-2026-04-17.md](tier-gating-audit-2026-04-17.md) — features-level audit

---

## Executive summary

**Every revenue-sensitive write in Nexus is unprotected at the enforcement boundary.** The features audit already established that the API and DB layers have no tier awareness. This audit confirms the same pattern at the action level, with one important addition: **no usage-limit check exists anywhere in the codebase**. Favorites, athletes, search results, pipeline stages, messages — all of them can be performed without limit, from any tier, by any authenticated user.

Three universal facts apply to all 27 actions:

1. **API gate layer is empty.** No `app/api/` directory. Zero files contain a `"use server"` directive (verified: `grep -l "^['\"]use server['\"]"` returns 0 files across `app/`, `components/`, `lib/`). Every write goes **browser → Supabase client → database directly**.
2. **DB gate layer is tier-blind.** All 131 RLS policies enforce ownership (`auth.uid() = recruiter_id`, `auth.uid() = coach_id`, etc.) and occasionally role (`users.role = 'RECRUTEUR'`), but **no policy references `subscriptions`, `tier`, row counts, or any tier-checking helper function**. A Free user cannot write rows owned by another user — that's the only real server-side gate.
3. **No count-based limit is ever checked before a write.** Searched `app/` for `canSee(`, `getLimit(`, `max_favorites`, `favorites_limit`, `pipeline_statuses`, `message_limit`, `max_free_athletes`, `count >=`, `.length >=` near Supabase write calls → **zero matches that actually gate a write**. Some `.length >=` hits exist but they're all for UI display (showing badge counts, password rules) or conditional rendering, never before an insert/update/delete.

**What this means in practice:** a Free user with a working login can, today, using devtools or a simple HTTP client:
- Create unlimited athletes as a coach
- Favorite unlimited athletes as a recruiter
- Move pipeline entries to any stage, including `LETTRE_SIGNEE`
- Send unlimited messages to any coach of any athlete
- Create unlimited custom prospect lists
- Invite unlimited users to their CÉGEP / school
- Reassign athletes between recruiters within their CÉGEP

The only things preventing this today are: (a) the UI doesn't show the buttons (but the buttons can be bypassed) and (b) the user has to know which Supabase table name to target (which is discoverable via network-tab inspection).

The paywall is purely cosmetic at the action layer. Until Server Actions or RLS tier-checks ship, billing **cannot** be launched without accepting that Free users will consume the full Pro/All-Star feature set.

---

## Methodology

- Greped for `.insert(`, `.update(`, `.delete(`, `.upsert(` across all `app/**/*.tsx`.
- For each write found, read the ±5 lines of surrounding code looking for any of: `tier`, `canSee`, `isPro`, `isAllStar`, `hasCegepAccess`, `hasSchoolAccess`, `getLimit`, `favorites_limit`, `pipeline_statuses`, a `.select("*", { count: "exact" })` count check followed by `.length >=`, an `isUnlimited(…)`, or a conditional based on `useSubscription().tier`.
- For each target table, read the RLS policies from [`supabase/migrations/20260417120000_baseline.sql`](supabase/migrations/20260417120000_baseline.sql).
- Cross-referenced findings with [`components/subscription/FeatureGate.tsx`](components/subscription/FeatureGate.tsx), [`components/subscription/SchoolGate.tsx`](components/subscription/SchoolGate.tsx), [`components/subscription/CegepGate.tsx`](components/subscription/CegepGate.tsx), [`lib/hooks/useSubscription.ts`](lib/hooks/useSubscription.ts).

**Columns glossary:**
- **UI Gate** — does a FeatureGate/SchoolGate/CegepGate wrap the trigger, or is the trigger hidden via `canSee()` / `isPro()`? ✓ = yes, ✗ = not at all, ? = unclear.
- **API Gate** — is there a server-side enforcement layer (Server Action or Route Handler) that checks tier before the write? ✓ = yes, ✗ = no gate, ? = unclear. (Spoiler: it's ✗ for all 27.)
- **DB Gate** — does RLS reference the user's tier before allowing the INSERT/UPDATE/DELETE? ✓ = tier-aware RLS, ✗ = ownership-only or missing. (Spoiler: ✗ for all 27.)
- **Limit Enforced?** — for actions with numeric limits, is the usage count actually verified before the write? ✓ = yes, ✗ = no enforcement despite a documented limit, — = action has no numeric limit.
- **Fail-Open Safe?** — if the UI gate is bypassed, does the write still succeed at the server? **No** = write still lands, revenue leak. **Yes** = write is blocked. (Spoiler: **No** for every gated action.)

---

## Feature matrix — 27 actions

### Coach actions

| # | Action | Min Tier | UI Gate | API Gate | DB Gate | Limit Enforced? | Fail-Open Safe? | Enforcement file(s) | Notes |
|---|---|---|---|---|---|---|---|---|---|
| **1** | Create athlete when under cap | Free | ✗ | ✗ | ✗ (ownership only) | — | — (no limit exists for Free) | [`app/coach/athletes/create/page.tsx`](app/coach/athletes/create/page.tsx) L572-576 `.insert(athleteRecord)`; RLS: `"coaches can insert athletes" ... WITH CHECK (coach_id = auth.uid())` | This is the baseline action. Ownership RLS is correct; it prevents cross-coach writes. No issue here. |
| **2** | **Create athlete when AT/ABOVE cap** | Pro | ✗ | ✗ | ✗ | **✗** | **No** | Same file as #1. L572-576 — `.insert()` runs with no count preamble, no tier check. | **Revenue leak.** No `max_free_athletes` column exists in `subscription_features_coach` and no client or server check counts the coach's current `athletes` rows before inserting. Free coaches can create unlimited profiles. |
| **3** | Evaluate athlete (traits) | Free | — | — | ✗ (ownership only) | — | — | [`app/coach/athletes/[id]/modifier/page.tsx`](app/coach/athletes/%5Bid%5D/modifier/page.tsx) L664 `.upsert(evalRecord, { onConflict: "coach_id,athlete_id" })`; RLS `"evaluations coach" USING (coach_id = auth.uid())` | Always Free per CLAUDE.md. No gate needed. DB constraint allows coach to evaluate any athlete they own. Correct. |
| **4** | Verify athlete profile | Free | — | — | ✗ (ownership only) | — | — | Coach modify page — updates `athletes.verified = true`. RLS: `"coaches can update own athletes" USING (coach_id = auth.uid())` | Always Free. No gate needed. |
| **5** | Invite coach to school | Pro | ✓ DB-backed | ✗ | ✗ | — | **No** | [`app/coach/settings/page.tsx`](app/coach/settings/page.tsx) AdminEcoleSection `.insert({...})` into `director_invitations`; wrapped in `<SchoolGate>` which reads `useSubscription().canSee("can_see_mon_ecole")` | SchoolGate is the **only** UI gate in the whole app backed by the DB-authoritative hook. But children render blurred → data queries still execute, and if someone lifts the blur or crafts the direct Supabase call, the `.insert()` goes through with no server-side tier check. |
| **6** | Access Mon École data via direct query | Pro | ✓ DB-backed | ✗ | ✗ | — | **No** | [`app/coach/ecole/*/page.tsx`](app/coach/ecole/) — all 7 pages wrapped in `<SchoolGate>`. Underlying `.select()` on `school_coaches`, `school_directors`, `athletes` etc. has no tier filter. | Data fetches live **inside** the gated children. If the gate blur is stripped, data is already in the DOM / React state. |
| **7** | Modify athlete as school-admin coach | Pro | ✗ | ✗ | ✗ (ownership only) | — | — | [`app/coach/athletes/[id]/modifier/page.tsx`](app/coach/athletes/%5Bid%5D/modifier/page.tsx) L607 `.update(updateData).eq("id", id)`; RLS: `"coaches can update own athletes"` | RLS limits to coach's own athletes regardless of tier. "Modify someone else's athlete via school admin" is an `is_school_admin` feature; I could not find a distinct RLS policy granting school admins cross-coach write access. If school admin expects cross-coach write, **it's not possible today** at the DB layer (unrelated to tier gating, but worth flagging). |

### Recruteur — search and favorites

| # | Action | Min Tier | UI Gate | API Gate | DB Gate | Limit Enforced? | Fail-Open Safe? | Enforcement file(s) | Notes |
|---|---|---|---|---|---|---|---|---|---|
| **8** | Search athletes — first 10 results | Free | — | — | ✗ (`recruiters can read active athletes`) | — | — | [`app/recruteur/recherche/page.tsx`](app/recruteur/recherche/page.tsx) L308-342 `.from("athletes").select(...)` | Intended: always available. The RLS policy `"recruiters can read active athletes" FOR SELECT USING (status = 'ACTIF')` does return everything to every authenticated recruiter. |
| **9** | **Search — retrieve 11th+ result** | Pro | ✓ (FeatureGate wraps results 7+) | ✗ | ✗ | **✗** | **No** | [`app/recruteur/recherche/page.tsx`](app/recruteur/recherche/page.tsx) L822-838 (blur overlay); L308-342 (fetch all) | **Usage gap.** The Supabase query has no `.limit(10)` based on tier. It returns **every** active athlete in a single call. UI blurs beyond position 6 with `FeatureGate` but the payload is already in the browser. Open DevTools → Network → see full list. Additionally, the spec says "10 results" but UI cut-off is at **6** not 10 → code/spec mismatch. |
| **10** | Favorite an athlete — up to 10 | Free | — | — | ✗ (ownership only) | — | — | [`app/recruteur/recherche/page.tsx`](app/recruteur/recherche/page.tsx) L513-550 `toggleFav`; RLS: `"Recruiters manage own favorites" ... recruiter_id = auth.uid() AND role = 'RECRUTEUR'` | Works correctly for up-to-limit case. |
| **11** | **Favorite the 11th+ athlete** | Pro | ✗ | ✗ | ✗ | **✗** | **No** | Same `toggleFav` as #10. | **Revenue leak + usage gap.** No count check on favorites before insert. Also: `toggleFav` auto-inserts a `recruiter_pipeline` row at stage `IDENTIFIE` (L538-549) → favoriting silently bypasses the pipeline gate too. |

### Recruteur — pipeline

| # | Action | Min Tier | UI Gate | API Gate | DB Gate | Limit Enforced? | Fail-Open Safe? | Enforcement file(s) | Notes |
|---|---|---|---|---|---|---|---|---|---|
| **12** | Add athlete to pipeline at `IDENTIFIE` | Free (per DB `subscription_features_recruteur.free.pipeline_enabled = false`) | ✗ | ✗ | ✗ (ownership only) | — | **No** | [`app/recruteur/recherche/page.tsx`](app/recruteur/recherche/page.tsx) L545-548 auto-insert on favorite; [`app/recruteur/pipeline/page.tsx`](app/recruteur/pipeline/page.tsx) | DB table says Free has `pipeline_enabled = false` and `pipeline_statuses = {}`. Code inserts `IDENTIFIE` regardless. **The DB feature-flag column is advisory only — the code ignores it entirely.** |
| **13** | Move to `CONTACTE` | Free-Starter+ per DB (`starter` has `{IDENTIFIE, CONTACTE}`) | ✗ | ✗ | ✗ | — | **No** | [`app/recruteur/pipeline/page.tsx`](app/recruteur/pipeline/page.tsx) L919-930 `handleStatusChange` → `.update({ stage: newStatus.toUpperCase() })` | `subscription_features_recruteur.pipeline_statuses` array is never consulted before the write. |
| **14** | **Move to `EN_DISCUSSION`** | Pro | ✗ | ✗ | ✗ | — | **No** | Same handler as #13. | **Critical workflow leak.** The whole paywall premise of "pipeline stages 3-8 are Pro" collapses; Free user can write any stage via the same drag-drop UI. |
| **15** | **Move to `VISITE_PLANIFIEE` / `ENGAGE` / `LETTRE_SIGNEE`** | Pro | ✗ | ✗ | ✗ | — | **No** | Same handler. Also [`app/recruteur/athletes/[id]/page.tsx`](app/recruteur/athletes/%5Bid%5D/page.tsx) writes stage via `StatusChangeDropdown`. | Trigger for `trg_sync_global_status` fires on any pipeline update and propagates `status` to `athletes.statut_recrutement_override` — a Free user toggling to `LETTRE_SIGNEE` also mutates the athlete's global override. **Data-integrity impact, not just revenue.** |

### Recruteur — messaging

| # | Action | Min Tier | UI Gate | API Gate | DB Gate | Limit Enforced? | Fail-Open Safe? | Enforcement file(s) | Notes |
|---|---|---|---|---|---|---|---|---|---|
| **16** | **Send message to coach** | Pro | ✗ | ✗ | ✗ (`messages_insert`: `sender_id = auth.uid()` + participant-of-conversation) | **✗** | **No** | [`app/recruteur/messages/nouveau/page.tsx`](app/recruteur/messages/nouveau/page.tsx) L291-337 → `.insert(conversation) + .insert(message)` | **Core revenue leak.** DB flag `subscription_features_recruteur.free.can_send_messages = false` but the code never checks it. `message_limit` is `-1` (unlimited) in the hook for Pro — also never enforced. The RLS only ensures you're a participant in the conversation (and you're allowed to create the conversation as long as you're the `recruiter_id`). |
| **17** | Send auto/template message | Pro (`can_send_auto_message = true` for starter, `false` for pro — anomaly) | ✗ | ✗ | ✗ | — | **No** | Template pickers present in `/messages/nouveau` — no separate gate distinguishes auto vs manual. | Note: DB has `can_send_auto_message = true` for `starter` and `false` for `pro`. Likely wrong-way-around relative to CLAUDE.md's "Starter unlocks auto-messaging" statement. Worth a human review. |
| **18** | Read message thread | Open (parties in conversation) | — | — | ✓ (`messages_select`: must be participant) | — | — | [`app/recruteur/messages/[id]/page.tsx`](app/recruteur/messages/%5Bid%5D/page.tsx) | Read-side is correct — RLS limits to participants. This is the ONLY row in this audit where the DB layer genuinely blocks unauthorized access. Not tier-based, but the participant check is correct. |

### Recruteur — CÉGEP management (All Star)

| # | Action | Min Tier | UI Gate | API Gate | DB Gate | Limit Enforced? | Fail-Open Safe? | Enforcement file(s) | Notes |
|---|---|---|---|---|---|---|---|---|---|
| **19** | **Invite another recruiter to CÉGEP** | All Star | ✓ localStorage | ✗ | ✗ | — | **No** | [`app/recruteur/parametres/page.tsx`](app/recruteur/parametres/page.tsx) AdminCegepSection `handleInvite` → `.insert(invitations)`; wrapped in CegepGate semantics but CegepGate reads `localStorage.nexus_user` | Bypassable: edit localStorage `subscription.tier = "recruteur_allstar"`, UI unlocks, invite inserts with no server-side check. |
| **20** | **Reassign athletes between recruiters** | All Star | ✓ localStorage (CegepGate wrapper on page) | ✗ | ✗ | — | **No** | [`app/recruteur/cegep/reassignation/page.tsx`](app/recruteur/cegep/reassignation/page.tsx) L438-470 — loops `.update(recruiter_id)` on `recruiter_pipeline`, `.upsert` on `recruiter_favorites`, `.insert` notes | CegepGate reads localStorage only. RLS on `recruiter_pipeline` requires `recruiter_id = auth.uid()` — the source recruiter can only reassign **their own** rows. So effectively Free can still reassign their own data anywhere they want. The All Star gate is UI-only. |
| **21** | Access CÉGEP stats | All Star | ✓ localStorage (CegepGate) | ✗ | ✗ (read-only — see note) | — | **No** | [`app/recruteur/cegep/stats/page.tsx`](app/recruteur/cegep/stats/page.tsx) | This is a read, not a write. Included because reading CÉGEP aggregate data without paying is part of the cost. |
| **22** | **Create custom prospect list** | All Star | ✗ | ✗ | ✗ | — | **No** | [`app/recruteur/listes/page.tsx`](app/recruteur/listes/page.tsx) L1042 `.insert({ recruiter_id, name, description })`; RLS `"Recruiters manage their own lists"` | **Severity-1 revenue leak.** CLAUDE.md states custom lists are **"EXCLUSIVELY Pro"** — actually All Star per the DB flag `has_list_access = true` only for `pro` (DB shows `has_list_access` is Pro-only; CLAUDE.md phrasing conflates). Either way, zero gate in the UI or server. |
| **23** | Add athlete to custom list | All Star | ✗ | ✗ | ✗ | — | **No** | Same file, L1089 `.insert({ list_id, athlete_id })` into `recruiter_list_members`. RLS: `"Recruiters manage their own list members"` (list must belong to them). | Same leak as #22. |

### Athlete actions

| # | Action | Min Tier | UI Gate | API Gate | DB Gate | Limit Enforced? | Fail-Open Safe? | Enforcement file(s) | Notes |
|---|---|---|---|---|---|---|---|---|---|
| **24** | Update own profile | Free | — | — | ✓ (ownership) | — | — | [`app/athlete/profil/page.tsx`](app/athlete/profil/page.tsx); RLS `"athletes can update own profile" USING (user_id = auth.uid())` | Correct. |
| **25** | Toggle visibility settings | Free | — | — | ✓ (ownership) | — | — | [`app/athlete/visibilite/page.tsx`](app/athlete/visibilite/page.tsx) | Correct. |
| **26** | View "who viewed me" / recruiter names | Pro | ✓ localStorage | ✗ | ✗ | — | **No** | [`app/athlete/visibilite/page.tsx`](app/athlete/visibilite/page.tsx) L174, L220 FeatureGate wraps "who viewed" sections. Data is fetched unconditionally by `useAthleteVisibility()` before blurring. | This is a read, not a write — but the gate pattern is the same as Action 5/6: data reaches the client, gate blur is cosmetic. |
| **27** | Access recruiting guide | All Star (per DB flag) | N/A (guide is public marketing) | — | — | — | — | [`app/guide-recrutement/page.tsx`](app/guide-recrutement/page.tsx) | Marketing page, publicly accessible to everyone. The DB flag `can_access_recruiting_guide` exists but is never checked. No gated athlete-specific guide exists. Not a leak — it's a spec/implementation mismatch. |

---

## CRITICAL REVENUE LEAKS

Actions where **UI + API + DB + Limit all fail and "Fail-Open Safe = No"**. These are writes where a Free user can consume paid capacity today with no friction beyond "find the HTTP endpoint". Prioritized from highest to lowest severity (by blast radius + how obvious the exploit is).

### P0 — Pipeline workflow leaks

These are high-severity because they mutate *shared* data (the athlete's global recruitment status updates via the `trg_sync_global_status` trigger) and because the pipeline is the single most visible Pro feature:

1. **#14 — Move to `EN_DISCUSSION`** (`app/recruteur/pipeline/page.tsx` L919-930). Free user drags a card past IDENTIFIE→CONTACTE. DB flag ignored.
2. **#15 — Move to `VISITE_PLANIFIEE` / `ENGAGE` / `LETTRE_SIGNEE`**. Same handler. Hitting `LETTRE_SIGNEE` fires `trg_sync_global_status` which writes `athletes.statut_recrutement_override` — a Free user can silently mark an athlete as "signed" across the whole platform.
3. **#12 — Auto-create pipeline entry on favorite** (`toggleFav` in recherche L545-548). Free users can't see the pipeline UI, but their favorites silently create pipeline rows that a coach dashboard will count as "this recruiter is interested". Fake signal.

### P0 — Messaging

4. **#16 — Send message to coach.** Biggest paid-feature in the messaging quadrant, zero gate. Free users can message indefinitely.

### P0 — Counted limits (the "unlimited" taxonomy)

5. **#2 — Create athlete beyond free cap.** CLAUDE.md doesn't specify a numeric cap for Free coaches, but the implication of a paywall is that one exists. Today, no cap exists in code. If Product wants a cap, they have to add both the DB column and the insert-side check.
6. **#11 — Favorite beyond 10.** DB column `max_favorites = 10` for Free is never consulted. No `.limit()`, no count check. Revenue leak + DB/code disagreement.
7. **#9 — Retrieve search results beyond 10.** DB column `max_search_results = 10` for Free, never consulted. The *entire athlete index* is returned by the initial fetch and then client-sliced.

### P1 — All Star gated actions

Smaller user base so smaller absolute dollar impact, but each leak is more valuable per user:

8. **#19 — Invite another recruiter** (All Star). CegepGate is localStorage-only.
9. **#20 — Reassign athletes** (All Star). CegepGate is localStorage-only. Note: RLS does limit reassignment to rows owned by the source recruiter, so the blast radius is smaller than it could be, but no tier check exists.
10. **#22, #23 — Custom prospect lists + members** (All Star or Pro, depending on which source you trust). Zero UI gate. Zero server gate.

### P2 — Paywall-adjacent but lower-impact

- **#5 — Invite coach to school** (Pro). SchoolGate is the best gate in the app but still UI-only.
- **#26 — "Who viewed me"** (Pro, athlete read). Read-side leak; data reaches the browser even when the FeatureGate blurs.

---

## USAGE LIMIT GAPS

Every numeric limit in the subscription spec is currently **advisory only** — the database stores the limit, but no client-side or server-side code consults it before a write. These are not "wrong-tier" leaks but "wrong-quantity" leaks:

| Limit | Spec value (Free) | Actually enforced? | Where it's stored |
|---|---|---|---|
| `max_search_results` | 10 | **No** — client fetches all | [`subscription_features_recruteur.free.max_search_results = 10`](supabase/seed/reference_data.sql) |
| `max_favorites` | 10 | **No** — no count check before `.insert` | `subscription_features_recruteur.free.max_favorites = 10` |
| `coaches_per_team` | 1 (Free & Pro) | **No** — no check on school_coaches invite flow | `subscription_features_recruteur.*.coaches_per_team` |
| `pipeline_limit` | 0 Free / 50 Pro | **No** — pipeline insert is unconditional | `RECRUITER_FEATURES[pro].pipeline_limit = 50` in `useSubscription.ts` L86 |
| `message_limit` | 0 Free / 10 Pro / ∞ All Star | **No** — message insert is unconditional | `RECRUITER_FEATURES[pro].message_limit = 10` in `useSubscription.ts` L82 |
| `max_free_athletes` (coach) | Not specified anywhere | **No** — and the column/constant doesn't exist | — (gap in both spec and implementation) |

**Every one of these limits will need a paired count query + check** before the write, OR an RLS policy that does the count inside the database. The simplest pattern is a Postgres function:

```sql
-- illustrative, not applied
CREATE FUNCTION check_favorites_cap() RETURNS trigger AS $$
BEGIN
  IF get_user_tier(auth.uid()) = 'free'
     AND (SELECT COUNT(*) FROM recruiter_favorites WHERE recruiter_id = auth.uid()) >= 10
  THEN RAISE EXCEPTION 'favorites cap reached';
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
```

Currently no such function or trigger exists (verified with grep — neither `get_user_tier`, `check_`, `cap`, nor any `RAISE EXCEPTION` tied to subscription exists in the baseline migration).

---

## DEFENSE-IN-DEPTH WINS

To call a row a "win" it has to have meaningful enforcement at all three layers. In this audit, **zero rows qualify as full defense-in-depth**. The closest candidates and why they fall short:

- **Action #5 — Invite coach to school.** UI ✓ (SchoolGate with DB-backed hook — best UI gate in the app). API ✗ (no server action). DB ✗ for tier, but ✓ for ownership. → **UI-only gate with a solid UI gate. One layer, not three.**
- **Action #18 — Read message thread.** UI — (open). API ✗. DB ✓ for participant check. → **Correct access control via RLS, but not a tier gate.** Worth documenting as "how RLS participant checks should look"; not a tier pattern to replicate.
- **Action #1 — Create athlete within cap.** UI — (no limit for this case). API ✗. DB ✓ for ownership (coach can only insert athletes with `coach_id = auth.uid()`). → **Good ownership RLS. Not tier-aware.**

### Pattern to replicate when fixing
The closest thing to a gold-standard in the current code is the **ownership RLS pattern** used on `recruiter_favorites`, `recruiter_pipeline`, `messages`, `conversations`:

```sql
CREATE POLICY "Recruiters manage own pipeline" ON "public"."recruiter_pipeline"
  USING (auth.uid() = recruiter_id AND EXISTS(... role = 'RECRUTEUR' ...))
  WITH CHECK (auth.uid() = recruiter_id AND EXISTS(... role = 'RECRUTEUR' ...));
```

This pattern is sound for the ownership axis. It needs a second axis — tier — added to the `WITH CHECK` clauses to close the gaps.

---

## UNEXPECTED FINDINGS

Things found during the audit that don't fit the matrix but are worth flagging.

### 1. Favoriting silently creates a pipeline row
[`app/recruteur/recherche/page.tsx`](app/recruteur/recherche/page.tsx) L537-549: `toggleFav` → on favorite, also inserts a `recruiter_pipeline` row at stage `IDENTIFIE` (no-op if it already exists). This bypasses the pipeline paywall even if the pipeline UI itself were gated. Anyone who can favorite can populate the pipeline table.

### 2. `trg_sync_global_status` propagates pipeline stage to `athletes.statut_recrutement_override`
At the database level, an update to `recruiter_pipeline.stage` fires a trigger (line 3199 of the baseline migration) that writes to the athlete row. **This is not just a revenue leak — it's a data-integrity risk.** A Free user with no business touching an athlete's global recruitment status can mutate it by writing any stage they want into their own pipeline row for that athlete. Every other recruiter viewing that athlete then sees the faked global status.

### 3. Template/auto-message flag appears inverted
DB table `subscription_features_recruteur`:
- `starter.can_send_auto_message = true`
- `pro.can_send_auto_message = false`

CLAUDE.md says Starter "auto-messaging" is the Starter upsell. That matches the Starter = true row. But the Pro = false is weird — usually higher tiers have strict superset of lower tiers. This is either (a) intentional "Starter gets auto-replies to save time, Pro writes manually with templates", in which case Pro has `templates` via `has_list_access`/other — or (b) a data-entry bug. Worth a 5-minute review with Product.

### 4. Recruiter tier taxonomy in the DB is Free/Starter/Pro; in the codebase it's Free/Pro/All-Star
- DB: `subscription_features_recruteur` has `free`, `starter`, `pro` rows (no `all_star`).
- Codebase: `useSubscription.RECRUITER_FEATURES` has `free`, `pro`, `all_star` tiers.
- Utils: `lib/utils/subscription.ts` uses `recruteur_pro` and `recruteur_allstar`.

**Three different taxonomies for the same role.** The DB's `starter` tier has no counterpart in the hook. The hook's `all_star` tier has no counterpart in the DB table. Whatever shipping plan exists, the data model is not aligned with the code.

### 5. "Unlimited" is represented inconsistently
- Hook (`useSubscription.ts`): `-1` for unlimited (e.g. `search_results_limit: -1`).
- DB (`subscription_features_recruteur`): **NULL** for unlimited (`max_favorites IS NULL` for Pro).

A naive consumer doing `features.max_favorites >= 10` will get `null >= 10` which is `false` — treating unlimited as 0. If anyone writes a limit-check against the DB column directly they will accidentally enforce a 0-favorites cap for Pro users. Landmine.

### 6. Both "inviter" landing pages are stubs
- [`app/coach/ecole/inviter/page.tsx`](app/coach/ecole/inviter/page.tsx) — 1.5 KB, plain text, **no write logic**.
- [`app/recruteur/cegep/inviter/page.tsx`](app/recruteur/cegep/inviter/page.tsx) — similar stub.

The actual invite writes live in `/coach/settings` (AdminEcoleSection) and `/recruteur/parametres` (AdminCegepSection). If any future audit reads `/inviter` to check the invite flow, they'll miss the actual code. Worth renaming/redirecting or adding a comment pointing to the real location.

### 7. `prospect_list_athletes` vs `recruiter_list_members`
Two parallel tables exist for the "custom list member" concept:
- `prospect_list_athletes` — schema exists, has unique constraint, has FKs, **no RLS policies referenced in the grep**.
- `recruiter_list_members` — the one the code uses, RLS-protected.

`prospect_list_athletes` looks like a deprecated twin. Left unenforced at RLS it could be write-accessible to arbitrary authenticated users. Worth a human review.

### 8. Direct-query read leak through the blur pattern (reiterated from features audit)
All three gate components (FeatureGate, SchoolGate, CegepGate) render the protected children *into the DOM* with a blur filter. Every data fetch the child kicks off still executes. **At the action layer this matters for reads, not writes** — but combined with the fact that writes are uncontrolled, it means a non-paying user can both (a) read the gated data and (b) replay any write the gated UI would have exposed.

### 9. Coach Pro pricing column in `subscription_features_coach` doesn't match `app/tarifs/page.tsx`
Previously noted in the features audit. Relevant here because: if billing is wired from `tarifs` page values rather than the DB table, the displayed tier (Pro @ $14.99) won't match the unlocked feature set (Pro's `subscription_features_coach` at $5.99 grants full Pro features). A buyer paying $14.99 will get the $5.99 tier's permissions.

### 10. No action route is idempotent-guarded anywhere
None of the write handlers I inspected use an idempotency token, request-id, or retry guard. A user can hit "favorite" or "send message" repeatedly to fill tables with dupes (UNIQUE constraints prevent exact dupes on some, but messages has no natural unique key). This isn't a tier leak per se, but it makes the enforcement surface bigger — if you later add a limit check, you have to also dedupe.

---

## Remediation priority (suggested, not prescriptive)

The features audit recommended a remediation order. This audit refines it specifically for actions:

1. **Block writes with tier-aware RLS on the top 5 tables**: `recruiter_pipeline`, `recruiter_favorites`, `conversations` + `messages` (pair), `recruiter_lists` + `recruiter_list_members` (pair), `athletes` (the insert case). A single `get_user_tier(auth.uid())` helper + a per-policy `WITH CHECK` clause closes 80% of the bleeding in one pass.
2. **Add count-check triggers for the numeric limits** (favorites=10, pipeline=50/unlimited, message=10/unlimited, max_free_athletes=TBD). Triggers fire on INSERT and `RAISE EXCEPTION` if over cap. Scoped to user's tier via the same helper.
3. **Fix the silent pipeline insert in `toggleFav`** — either gate it behind tier or remove it. It's the single biggest invisible leak.
4. **Fix the `trg_sync_global_status` cascade** — restrict it to only propagate stage when the writer is Pro or above, OR when they are the athlete's coach OR the current recruiter-of-record.
5. **Consolidate the three recruiter tier taxonomies** to one canonical source (propose: DB table is source of truth; delete `lib/utils/subscription.ts` once the hook covers all usage sites).
6. **Move to Server Actions for at least the P0 writes** (pipeline stage update, message send, list create) — belt-and-braces with RLS.
7. **Fix the blur-renders-data-anyway architectural flaw in FeatureGate / SchoolGate / CegepGate** — conditionally render children based on a boolean, not via CSS filter.

---

*End of actions audit.*
