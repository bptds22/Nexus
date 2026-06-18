/**
 * Stripe price ID mapping — single source of truth for
 * price_id ↔ (role, tier, billing_cycle) resolution.
 *
 * Complements lib/config/pricing.ts (display prices/features).
 * This file is Stripe IDs only — no display amounts.
 *
 * All IDs are env-driven: test vs live is a .env.local swap, no code change.
 * Roles UPPERCASE (DB user_role enum). Tiers lowercase. Cycles match the
 * subscriptions.billing_cycle CHECK constraint ('monthly' | 'annual').
 */

export type StripePlanRole = "RECRUTEUR" | "COACH" | "ATHLETE";
export type StripePlanTier = "pro" | "all_star";
export type StripePlanCycle = "monthly" | "annual";

export interface StripePlan {
  role: StripePlanRole;
  tier: StripePlanTier;
  cycle: StripePlanCycle;
}

/* ── Env var names (10 prices) ──────────────────────────────── */

const ENV_KEYS = {
  RECRUTEUR_PRO_MONTHLY:      "STRIPE_PRICE_RECRUTEUR_PRO_MONTHLY",
  RECRUTEUR_PRO_ANNUAL:       "STRIPE_PRICE_RECRUTEUR_PRO_ANNUAL",
  RECRUTEUR_ALLSTAR_MONTHLY:  "STRIPE_PRICE_RECRUTEUR_ALLSTAR_MONTHLY",
  RECRUTEUR_ALLSTAR_ANNUAL:   "STRIPE_PRICE_RECRUTEUR_ALLSTAR_ANNUAL",
  COACH_PRO_MONTHLY:          "STRIPE_PRICE_COACH_PRO_MONTHLY",
  COACH_PRO_ANNUAL:           "STRIPE_PRICE_COACH_PRO_ANNUAL",
  COACH_ALLSTAR_MONTHLY:      "STRIPE_PRICE_COACH_ALLSTAR_MONTHLY",
  COACH_ALLSTAR_ANNUAL:       "STRIPE_PRICE_COACH_ALLSTAR_ANNUAL",
  ATHLETE_PRO_MONTHLY:        "STRIPE_PRICE_ATHLETE_PRO_MONTHLY",
  ATHLETE_PRO_ANNUAL:         "STRIPE_PRICE_ATHLETE_PRO_ANNUAL",
} as const;

/* ── Forward map: (role, tier, cycle) → price_id ────────────── */

const PLAN_TO_ENV: Record<string, string> = {
  "RECRUTEUR:pro:monthly":      ENV_KEYS.RECRUTEUR_PRO_MONTHLY,
  "RECRUTEUR:pro:annual":       ENV_KEYS.RECRUTEUR_PRO_ANNUAL,
  "RECRUTEUR:all_star:monthly": ENV_KEYS.RECRUTEUR_ALLSTAR_MONTHLY,
  "RECRUTEUR:all_star:annual":  ENV_KEYS.RECRUTEUR_ALLSTAR_ANNUAL,
  "COACH:pro:monthly":          ENV_KEYS.COACH_PRO_MONTHLY,
  "COACH:pro:annual":           ENV_KEYS.COACH_PRO_ANNUAL,
  "COACH:all_star:monthly":     ENV_KEYS.COACH_ALLSTAR_MONTHLY,
  "COACH:all_star:annual":      ENV_KEYS.COACH_ALLSTAR_ANNUAL,
  "ATHLETE:pro:monthly":        ENV_KEYS.ATHLETE_PRO_MONTHLY,
  "ATHLETE:pro:annual":         ENV_KEYS.ATHLETE_PRO_ANNUAL,
};

export function priceIdFor(role: StripePlanRole, tier: StripePlanTier, cycle: StripePlanCycle): string {
  const key = `${role}:${tier}:${cycle}`;
  const envKey = PLAN_TO_ENV[key];
  if (!envKey) throw new Error(`No Stripe price mapping for ${key}`);
  const id = process.env[envKey];
  if (!id) throw new Error(`Env var ${envKey} is not set`);
  return id;
}

/* ── Reverse map: price_id → { role, tier, cycle } ──────────── */

let reverseCache: Map<string, StripePlan> | null = null;

function buildReverseMap(): Map<string, StripePlan> {
  const map = new Map<string, StripePlan>();
  for (const [planKey, envKey] of Object.entries(PLAN_TO_ENV)) {
    const id = process.env[envKey];
    if (!id) continue;
    const [role, tier, cycle] = planKey.split(":") as [StripePlanRole, StripePlanTier, StripePlanCycle];
    map.set(id, { role, tier, cycle });
  }
  return map;
}

export function planFromPriceId(priceId: string): StripePlan | null {
  if (!reverseCache) reverseCache = buildReverseMap();
  return reverseCache.get(priceId) ?? null;
}

/* ── Startup validation ─────────────────────────────────────── */

export function assertAllPricesConfigured(): void {
  const missing: string[] = [];
  for (const envKey of Object.values(ENV_KEYS)) {
    if (!process.env[envKey]) missing.push(envKey);
  }
  if (missing.length > 0) {
    throw new Error(
      `Missing Stripe price env vars (${missing.length}/10):\n  ${missing.join("\n  ")}`
    );
  }
}
