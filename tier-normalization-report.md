# Tier Normalization Report
**Date:** 2026-04-17
**Scope:** Code paths that write or compare `subscriptions.tier` / `subscription_features_*.tier` after the DB migration to Free/Pro/All Star and the addition of `tier = LOWER(tier)` CHECK constraints.
**Auditor:** Claude
**Build status after changes:** ✓ Compiled successfully in 8.4s

---

## Summary

- **0** DB writes in the codebase pass an uppercased tier literal. The CHECK constraint will NOT fire on any existing code path.
- **2** files contained the wrong lowercase spelling `"allstar"` (no underscore) instead of the DB canonical `"all_star"`. These are admin-side files whose TIER_OPTIONS drives `AdminTable` writes and whose read-side comparisons render pill styles. Both have been fixed.
- **1** DB write uses a typed variable (`next: SubscriptionTier`) whose union type already constrains it to lowercase values. No change needed, reviewed as safe.
- **Many** other matches for `FREE` / `PRO` / `ALL_STAR` / `allstar` exist, but they are NOT DB-connected — they're athlete achievement badges (`allstar` as a sport distinction), local-only UI enums in marketing pages (`TierKey = "FREE" | "PRO"` for card tagging), a sports move abbreviation (freestyle = "FREE"), or the parallel `lib/utils/subscription.ts` taxonomy that reads localStorage. Each was reviewed and categorized in the "Reviewed, safe" section below.

The DB migration + CHECK constraints are compatible with the existing codebase after the two fixes below. Build passes.

---

## Files modified

### 1. [`app/admin/subscriptions/page.tsx`](app/admin/subscriptions/page.tsx)

| Line | Change type | Before | After |
|---|---|---|---|
| 21 | **Write — TIER_OPTIONS** | `{ value: "allstar", label: "All Star" }` | `{ value: "all_star", label: "All Star" }` |
| 163 | **Read — pill color branch** | `r.tier === "allstar"` | `r.tier === "all_star"` |
| 195 | **Read — count in header** | `r.tier === "allstar"` | `r.tier === "all_star"` |

Why this matters:
- Line 21 is the dropdown option that AdminTable writes back to `subscriptions.tier` when an admin changes a user's plan. Before: writing `"allstar"` would satisfy the CHECK constraint (lowercase) but would orphan the user — `subscription_features_recruteur.tier` has PK values `free / pro / all_star`, so a subscription row with `tier = "allstar"` has no matching feature row. After: writes go to `"all_star"` which matches the PK.
- Lines 163 and 195 are read-side. The DB now stores `"all_star"`; comparing to `"allstar"` would never match, so All-Star users would render with the default (gray) pill instead of the red All-Star pill, and the header count `"N All Star"` would always show 0. Rendering bugs, not write bugs — but part of the normalization.

### 2. [`app/admin/users/page.tsx`](app/admin/users/page.tsx)

| Line | Change type | Before | After |
|---|---|---|---|
| 64 | **Unused constant (consistency only)** | `{ value: "allstar", label: "All Star" }` | `{ value: "all_star", label: "All Star" }` |
| 243 | **Read — pill color branch** | `tier === "allstar"` | `tier === "all_star"` |

Why this matters:
- Line 64 is `TIER_OPTIONS` defined in this file, but the subscription-tier column on this page is `readonly: true` (line 239), so the options array is never passed to AdminTable as editable select options. The definition is effectively dead code, but updating it keeps the two admin pages consistent and removes a trap for a future developer who un-readonly's the column.
- Line 243 is a read-side pill styling bug identical to the admin/subscriptions one.

---

## Writes that were reviewed and are safe

### [`components/dev/DevTierSwitcher.tsx`](components/dev/DevTierSwitcher.tsx) lines 47-50

```tsx
.upsert({
  user_id: subscription.userId,
  tier: next,          // ← variable, not a literal
  status: "active",
  ...
}, { onConflict: "user_id" })
```

`next` is typed `SubscriptionTier` which is the union `"free" | "pro" | "all_star"` (see [`lib/hooks/useSubscription.ts`](lib/hooks/useSubscription.ts) line 20). The union is lowercase-only by construction. TypeScript won't allow `next` to hold `"ALL_STAR"` or similar. The ALL_TIERS constant at the top of the file (line 16-20) uses the same lowercase values as both the union and the DB PK. Safe.

Also: this component only renders in `process.env.NODE_ENV === 'development'` (line 37), so even if it were wrong, it wouldn't reach production.

### [`app/admin/subscriptions/page.tsx`](app/admin/subscriptions/page.tsx) line 104

```tsx
const { error } = await supabase.from("subscriptions").insert({
  user_id, tier: "free", status: "active",
});
```

Writes the literal `"free"`. Already lowercase. Matches the DB canonical. Safe.

---

## Reads that were reviewed — no DB-canonical mismatch

These compare tier against a string, but the string matches the DB canonical, or the read is against local-only UI state rather than DB tier. No changes needed.

| File | Line(s) | What's compared | Why it's safe |
|---|---|---|---|
| [`lib/hooks/useSubscription.ts`](lib/hooks/useSubscription.ts) | 239, 330, 346 | `s.includes("allstar")`, `tier === "all_star"` | Hook's `normalizeTier()` lowercases + strips separators first (`s.toLowerCase().replace(/[\s_-]/g, "")`), then checks `.includes("allstar")`. Handles every casing and separator variant. Returns canonical `"all_star"`. Safe. |
| [`lib/hooks/useSubscription.ts`](lib/hooks/useSubscription.ts) | 20 | `type SubscriptionTier = "free" \| "pro" \| "all_star"` | TypeScript union already canonical. This is the source of truth. |
| [`components/subscription/FeatureGate.tsx`](components/subscription/FeatureGate.tsx) | 21, 46, 48, 65, 75 | `requiredTier === "allstar"`, `tier.includes("allstar")` | Component reads from **localStorage `nexus_user`**, not from the DB. Values in localStorage use the legacy taxonomy (`coach_allstar`, `recruteur_allstar`, etc.) — `.includes("allstar")` matches those substrings. The DB migration did not touch localStorage keys. Safe as-is, but worth revisiting later — see "Out-of-scope cleanup" below. |
| [`components/subscription/SidebarUpgradeCard.tsx`](components/subscription/SidebarUpgradeCard.tsx) | 92, 105 | `state === "allstar"`, `tier.includes("allstar")` | Same as FeatureGate — reads from `lib/utils/subscription.ts` (localStorage-backed). Unchanged by the DB migration. |
| [`components/subscription/SubscriptionSection.tsx`](components/subscription/SubscriptionSection.tsx) | 58, 102, 120 | `tier.includes("allstar")` | Reads localStorage via demo mode helpers. Unaffected by DB migration. |
| [`lib/utils/subscription.ts`](lib/utils/subscription.ts) | 115, 119, 144 | `tier.includes("allstar")`, `SidebarState = "allstar" \| ...` | localStorage-backed parallel system. Uses tier strings like `coach_allstar` / `recruteur_allstar`. Unrelated to the DB canonical `all_star`. |
| [`app/admin/users/page.tsx`](app/admin/users/page.tsx) | 241-253 | Post-fix: `tier === "all_star"` | Fixed above. |
| [`app/admin/subscriptions/page.tsx`](app/admin/subscriptions/page.tsx) | 163, 195 | Post-fix: `r.tier === "all_star"` | Fixed above. |

---

## Matches that are NOT subscription-related (false positives)

The regex `FREE`, `PRO`, `ALL_STAR`, `allstar` catches a lot of things that have nothing to do with billing tiers. Cataloging them here so future audits don't re-investigate:

### 1. Athlete achievement badges — sport-level distinctions, not billing tier
- [`lib/mock/athleteProfileRecruiter.ts`](lib/mock/athleteProfileRecruiter.ts) lines 74, 253 — `{ badge: "allstar" }`
- [`lib/config/badges.ts`](lib/config/badges.ts) line 22 — `BADGE_ORDER = ["captain", "allstar", ...]`
- [`app/recruteur/_data/mockSearchAthletes.ts`](app/recruteur/_data/mockSearchAthletes.ts) lines 39, 87, 145
- [`app/recruteur/_data/mockPipelineData.ts`](app/recruteur/_data/mockPipelineData.ts) lines 62, 107, 172
- [`app/recruteur/_data/mockFavorites.ts`](app/recruteur/_data/mockFavorites.ts) lines 52, 99, 107
- [`app/coach/athletes/_data/mockAthleteProfiles.ts`](app/coach/athletes/_data/mockAthleteProfiles.ts) lines 97, 314
- [`app/comment-ca-marche/page.tsx`](app/comment-ca-marche/page.tsx) line 57 — `{ key: "allstar", name: "Étoile provinciale", ...}`

These use `"allstar"` as the identifier for an athlete accolade (the provincial "all-star" team selection). Nothing to do with subscriptions. Safe.

### 2. Marketing-page local types (TierKey for card tagging)
- [`app/pour-les-coachs/page.tsx`](app/pour-les-coachs/page.tsx) lines 41-53, 128-129 — `type TierKey = "FREE" | "PRO"`, used to label feature cards and render a pill
- [`app/pour-les-athletes/page.tsx`](app/pour-les-athletes/page.tsx) lines 44-54, 94-95 — `type TierKey = "FREE" | "PRO" | "ALLSTAR"`

These are completely local to the marketing page. The `tier` variable in the `TierPill` component comes from a local data object, not from the DB. Never written back. Safe as-is.

### 3. Recruiter pricing config (local ids for UI)
- [`app/recruteur/parametres/page.tsx`](app/recruteur/parametres/page.tsx) line 417 — `{ id: "allstar", name: "All Star", ... }`

Local pricing card config; `id` is used as a React key and to select CTA styling. Never used in a DB write. Safe.

### 4. Sports-data false positive
- [`lib/sports-data.ts`](lib/sports-data.ts) line 141 — `{ abbr: "FREE", label: "Style libre" }`

Swimming stroke abbreviation (freestyle). Completely unrelated. Safe.

### 5. Subscription_features_coach comment
- [`app/coach/settings/page.tsx`](app/coach/settings/page.tsx) line 25 — comment `// Any legacy DB value that reads as "all_star" is collapsed to "pro".`

It's a comment, not code. The actual logic is in `useSubscription` hook which we already verified. Safe.

---

## Patterns that were grepped but returned no hits

These are reassuring absences:

- `grep "tier\.toUpperCase"` → 0 matches. No code uppercases tier anywhere.
- `grep "tier: 'ALL_STAR'"` / `tier = 'ALL_STAR'` → 0 DB-write matches.
- `grep "tier = 'PRO'"` → 0 DB-write matches (only marketing-page TierKey uses in local state).
- `grep "Stripe.*webhook"` → no webhook handler file exists (confirmed by the companion audit — no `app/api/` directory at all).
- `grep "'use server'"` → 0 files. No server actions exist.

This means the only place the DB could receive an uppercase tier value is through the two admin pages I fixed above, or through a future Stripe webhook that doesn't exist yet. The CHECK constraint is now the backstop.

---

## Potentially risky — worth a human second-look

### Risk A — The parallel `lib/utils/subscription.ts` system
`lib/utils/subscription.ts` defines its own `SubscriptionTier` union: `"free" | "coach_pro" | "coach_allstar" | "recruteur_pro" | "recruteur_allstar" | "athlete_pro"`. None of these strings exist in `subscriptions.tier` after the migration (the DB now uses `free / pro / all_star`).

This file is **localStorage-backed**, not DB-backed, so the migration doesn't directly break it. But:
- `FeatureGate`, `SidebarUpgradeCard`, `SubscriptionSection` all read through this system.
- If any code path flows DB tier → localStorage sync (e.g., on login), the localStorage value will be the DB canonical `all_star`, which does NOT match `"coach_allstar"` or `"recruteur_allstar"` — so the `.includes("allstar")` check in those components can produce different results depending on what wrote localStorage last.

The prior features audit flagged this as "two parallel subscription systems" — recommended remediation was to delete `lib/utils/subscription.ts` entirely and migrate its callers to `useSubscription`. That work is larger than this task and was intentionally out of scope, but the CHECK-constraint migration increases the pressure to finish it.

### Risk B — Admin users page `TIER_OPTIONS` unused but present
After my fix, `TIER_OPTIONS` in [`app/admin/users/page.tsx`](app/admin/users/page.tsx) line 61-65 is correct. But the `subscription_tier` column on that page is `readonly: true` so the options are never offered to an admin. If someone un-readonly's the column later without reading this report, they'll get a working select — that's fine. But it does mean the constant is currently dead code. Worth either using it (make the column editable) or deleting it for clarity.

### Risk C — Future Stripe webhook
Stripe sends tier names based on `price.product.metadata.tier` or similar. If/when a webhook handler is added, it must lowercase the incoming tier before writing to `subscriptions.tier`. The CHECK constraint is the backstop, but it fails loudly (500 from the webhook endpoint) rather than silently. Worth adding a `.toLowerCase()` at the boundary plus a mapping step — the codebase has none today because no webhook exists.

### Risk D — `normalizeTier()` in the hook returns `"all_star"` but the DB-write paths still need manual care
The hook reads from DB → normalizes via `normalizeTier()` → exposes lowercase tier. But `normalizeTier` runs on READS, not writes. Every place that WRITES to `subscriptions.tier` is still responsible for passing a lowercase canonical value. Today that's:
1. Trigger `create_default_subscription` (DB-side, inserts `'free'`) — safe.
2. `DevTierSwitcher` (writes `next: SubscriptionTier`) — type-safe, canonical.
3. `admin/subscriptions` TIER_OPTIONS (writes via AdminTable) — fixed.
4. Any future Stripe webhook — does not exist, must handle at that time.

---

## Verification

After changes:

```bash
$ npm run build
✓ Compiled successfully in 8.4s
```

Also verified with grep that `"allstar"` now appears only in non-subscription contexts (badges, marketing UI, the localStorage-backed `lib/utils/subscription.ts` parallel system). The two DB-write sites that used `"allstar"` have been updated to `"all_star"`.

The CHECK constraints added earlier (`subscriptions_tier_lowercase`, `coach_features_tier_lowercase`, `athlete_features_tier_lowercase`, `recruteur_features_tier_lowercase`) will not fire on any write path in the current codebase.

---

*End of report.*
