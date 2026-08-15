"use client";

/* ═══════════════════════════════════════════════════════════════
   SubscriptionProvider — shared, single-source subscription state.

   Holds ONE copy of the DB-backed subscription + feature-flag state
   for the whole app, so every consumer reads the same value and a
   single refresh() updates all of them at once (fixes the divergence
   where independent useSubscription() instances drifted out of sync).

   Logic is MOVED verbatim from lib/hooks/useSubscription.ts (the fetch,
   normalizeTier/normalizeRole, the no-session → null case, the feature
   tables and the derived helpers). Mirrors the canonical Context pattern
   of lib/i18n/LanguageContext.tsx: createContext<…|null>(null) + a
   Provider({ children }) + a consumer hook that throws outside it.

   Canonical tier taxonomy: "free" | "pro" | "all_star".
   normalizeTier() defensively coerces any odd DB value (casing drift,
   stray separators) back to one of the three canonical strings; a
   DB-level CHECK constraint enforces lowercase on writes, so this is
   belt-and-braces.

   NOTE: not mounted anywhere yet — pure creation. The existing
   lib/hooks/useSubscription.ts and its 26 call sites are untouched;
   wiring comes in the next step.
═══════════════════════════════════════════════════════════════ */

import { createClient } from "@/lib/supabase/client";
import { useCurrentUser } from "@/lib/queries/shared/useCurrentUser";
import {
  createContext, useContext, useCallback, useEffect, useState, type ReactNode,
} from "react";

export type SubscriptionTier = "free" | "pro" | "all_star";
export type SubscriptionRole = "recruiter" | "coach" | "athlete";
export type SubscriptionStatus = "active" | "trialing" | "past_due" | "canceled";

interface Subscription {
  tier: SubscriptionTier;
  role: SubscriptionRole;
  status: SubscriptionStatus;
  billing: "monthly" | "annual" | null;
  userId: string;
  isSchoolAdmin: boolean;
  periodEnd: string | null;
  trialEndsAt: string | null;
  trialDaysRemaining: number | null;
  cancelAtPeriodEnd: boolean;
  /** True UNIQUEMENT pour un vrai abo géré par Stripe : customer + subscription
   *  ids présents ET tier_source ≠ 'admin_grant'. Pilote l'affichage du bloc
   *  portail/dates (un admin_grant n'a pas de portail ni de dates → 400). */
  isStripeManaged: boolean;
}

/* ── Feature flag tables ──────────────────────────────────── */

/* ⚠️ RETIRÉS DE LA MATRICE RECRUTEUR (Lot A) :
   can_see_athlete_name / can_see_athlete_photo / can_see_jersey_number.

   Ils n'ont jamais été branchés — aucun composant ne les lisait — et il ne
   faut PAS les brancher : le client ne peut pas exprimer la règle qu'ils
   prétendent porter. La visibilité d'une identité dépend de la date de
   naissance et du consentement parental (Loi 25), deux colonnes qui ne sont
   jamais projetées à un recruteur. Un drapeau par tier aurait montré le nom
   d'un mineur non consentant à tout recruteur Pro.

   La décision est prise par ligne, côté serveur, et arrive dans
   `identity_visible` des RPC recruteur. Un drapeau client par-dessus ne
   pourrait que diverger.

   `search_results_limit` survit ici mais n'est plus lu par la Recherche
   (p_limit NULL = illimité). Laissé en place : il n'est pas à moi de
   trancher son sort dans ce lot. */

type FeatureValue = boolean | number;
type FeatureSet = Record<string, FeatureValue>;

const RECRUITER_FEATURES: Record<SubscriptionTier, FeatureSet> = {
  free: {
    can_search: true,
    can_use_advanced_filters: false,
    search_results_limit: 10,
    can_see_highlights: false,
    can_see_coach_comments: false,
    can_see_academic_full: false,
    can_see_detailed_eval: false,
    can_see_recruitment_status: false,
    can_see_who_viewed: false,
    can_see_coach_contact: false,
    can_message_coach: false,
    message_limit: 0,
    can_use_auto_intro: false,
    favorites_limit: 10,
    can_use_pipeline: false,
    pipeline_limit: 0,
    can_see_pipeline_analytics: false,
    can_use_custom_lists: false,
    can_see_activity_feed: false,
    can_see_response_rates: false,
    can_see_competition_signals: false,
    can_read_coach_reviews: false,
    can_write_coach_reviews: false,
    can_manage_cegep: false,
  },
  pro: {
    can_search: true,
    can_use_advanced_filters: true,
    search_results_limit: -1,
    can_see_highlights: true,
    can_see_coach_comments: true,
    can_see_academic_full: true,
    can_see_detailed_eval: false,
    can_see_recruitment_status: false,
    can_see_who_viewed: false,
    can_see_coach_contact: true,
    can_message_coach: true,
    message_limit: 10,
    can_use_auto_intro: true,
    favorites_limit: -1,
    can_use_pipeline: true,
    pipeline_limit: 50,
    can_see_pipeline_analytics: false,
    can_use_custom_lists: true,
    can_see_activity_feed: true,
    can_see_response_rates: false,
    can_see_competition_signals: false,
    can_read_coach_reviews: true,
    can_write_coach_reviews: true,
    can_manage_cegep: false,
  },
  all_star: {
    can_search: true,
    can_use_advanced_filters: true,
    search_results_limit: -1,
    can_see_highlights: true,
    can_see_coach_comments: true,
    can_see_academic_full: true,
    can_see_detailed_eval: true,
    can_see_recruitment_status: true,
    can_see_who_viewed: true,
    can_see_coach_contact: true,
    can_message_coach: true,
    message_limit: -1,
    can_use_auto_intro: true,
    favorites_limit: -1,
    can_use_pipeline: true,
    pipeline_limit: -1,
    can_see_pipeline_analytics: true,
    can_use_custom_lists: true,
    can_see_activity_feed: true,
    can_see_response_rates: true,
    can_see_competition_signals: true,
    can_read_coach_reviews: true,
    can_write_coach_reviews: true,
    can_manage_cegep: true,
  },
};

const COACH_FEATURES: Record<SubscriptionTier, FeatureSet> = {
  free: {
    can_create_profiles: true,
    can_evaluate: true,
    can_verify: true,
    can_receive_messages: true,
    can_join_school: true,
    can_see_mon_ecole: false,
    can_see_stats_ecole: false,
    can_see_placement: false,
    can_see_reputation: false,
    can_see_analytics: false,
    can_see_recruiter_views: false,
    can_see_interest_notifications: false,
    can_multi_team: false,
  },
  pro: {
    can_create_profiles: true,
    can_evaluate: true,
    can_verify: true,
    can_receive_messages: true,
    can_join_school: true,
    can_see_mon_ecole: true,
    can_see_stats_ecole: true,
    can_see_placement: true,
    can_see_reputation: true,
    can_see_analytics: true,
    can_see_recruiter_views: true,
    can_see_interest_notifications: true,
    can_multi_team: true,
  },
  // Coach has 2 tiers only (free / pro). `all_star` is kept here solely
  // for type-safety (the SubscriptionTier union is shared across roles);
  // any legacy DB value that reads as "all_star" collapses to the same
  // feature set as Pro.
  all_star: {
    can_create_profiles: true,
    can_evaluate: true,
    can_verify: true,
    can_receive_messages: true,
    can_join_school: true,
    can_see_mon_ecole: true,
    can_see_stats_ecole: true,
    can_see_placement: true,
    can_see_reputation: true,
    can_see_analytics: true,
    can_see_recruiter_views: true,
    can_see_interest_notifications: true,
    can_multi_team: true,
  },
};

const ATHLETE_FEATURES: Record<SubscriptionTier, FeatureSet> = {
  free: {
    can_manage_profile: true,
    can_upload_videos: true,
    can_upload_match_complet: true,
    can_see_view_count: true,
    can_see_favorites_count: true,
    can_see_weekly_chart: true,
    can_see_regions: true,
    can_see_recruiter_names: false,
    can_see_cegep_names: false,
    can_see_who_favorited: false,
    can_see_views_per_cegep: false,
    can_see_notifications_with_names: false,
    can_consent_parental: true,
    can_see_recruitment_status: true,
    can_confirm_engagement: true,
  },
  pro: {
    can_manage_profile: true,
    can_upload_videos: true,
    can_upload_match_complet: true,
    can_see_view_count: true,
    can_see_favorites_count: true,
    can_see_weekly_chart: true,
    can_see_regions: true,
    can_see_recruiter_names: true,
    can_see_cegep_names: true,
    can_see_who_favorited: true,
    can_see_views_per_cegep: true,
    can_see_notifications_with_names: true,
    can_consent_parental: true,
    can_see_recruitment_status: true,
    can_confirm_engagement: true,
  },
  all_star: {
    // Athletes only have Free/Pro — all_star here only for type safety.
    can_manage_profile: true,
    can_upload_videos: true,
    can_upload_match_complet: true,
    can_see_view_count: true,
    can_see_favorites_count: true,
    can_see_weekly_chart: true,
    can_see_regions: true,
    can_see_recruiter_names: true,
    can_see_cegep_names: true,
    can_see_who_favorited: true,
    can_see_views_per_cegep: true,
    can_see_notifications_with_names: true,
    can_consent_parental: true,
    can_see_recruitment_status: true,
    can_confirm_engagement: true,
  },
};

/* ── Normalizers ──────────────────────────────────────────── */

export function normalizeTier(raw: string | null | undefined): SubscriptionTier {
  if (!raw) return "free";
  const s = raw.toLowerCase().replace(/[\s_-]/g, "");
  if (s.includes("allstar")) return "all_star";
  if (s.includes("pro")) return "pro";
  return "free";
}

export function normalizeRole(raw: string | null | undefined): SubscriptionRole {
  const s = (raw || "").toUpperCase();
  if (s === "COACH") return "coach";
  if (s === "RECRUTEUR") return "recruiter";
  if (s === "ATHLETE") return "athlete";
  return "athlete";
}

/* ── Context value — the exact 18-key shape consumers depend on ── */

interface SubscriptionContextValue {
  subscription: Subscription | null;
  tier: SubscriptionTier;
  role: SubscriptionRole;
  status: SubscriptionStatus;
  billing: "monthly" | "annual" | null;
  periodEnd: string | null;
  trialDaysRemaining: number | null;
  cancelAtPeriodEnd: boolean;
  isStripeManaged: boolean;
  loading: boolean;
  features: FeatureSet;
  canSee: (feature: string) => boolean;
  getLimit: (feature: string) => number;
  isUnlimited: (feature: string) => boolean;
  tierLabel: () => string;
  requiredTierFor: (feature: string) => SubscriptionTier;
  refresh: () => Promise<void>;
  isSchoolAdmin: boolean;
  maxSearchResults: number;
  maxFavorites: number;
}

const SubscriptionContext = createContext<SubscriptionContextValue | null>(null);

/* ── Provider ─────────────────────────────────────────────── */

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  // SINGLE auth source: userId comes from useCurrentUser (the shared
  // React Query auth hook). The Provider no longer calls supabase.auth
  // itself — its own cold-start getSession() contended with
  // useCurrentUser's getUser() on the singleton GoTrueClient and stalled
  // the profile read chain. We wait for userId, then fetch subscription.
  const { data: currentUser, isLoading: userLoading } = useCurrentUser();
  const userId = currentUser?.authUser.id;

  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [subLoading, setSubLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!userId) {
      // Not authenticated (or auth still resolving) → no subscription.
      // No auth call here; the exposed `loading` still reflects userLoading.
      setSubscription(null);
      setSubLoading(false);
      return;
    }
    setSubLoading(true);
    const supabase = createClient();

    // Two parallel queries: the user row (for role + is_school_admin) + the subscription row
    const [userRes, subRes] = await Promise.all([
      supabase.from("users").select("role, is_school_admin").eq("id", userId).maybeSingle(),
      supabase
        .from("subscriptions")
        .select("tier, status, billing_cycle, current_period_end, trial_ends_at, cancel_at_period_end, tier_source, stripe_customer_id, stripe_subscription_id")
        .eq("user_id", userId)
        .maybeSingle(),
    ]);

    const role = normalizeRole(userRes.data?.role as string | undefined);
    const isSchoolAdmin = Boolean(userRes.data?.is_school_admin);
    const tier = normalizeTier(subRes.data?.tier as string | undefined);
    const rawStatus = (subRes.data?.status as string | undefined) || "active";
    const status: SubscriptionStatus =
      rawStatus === "trialing" || rawStatus === "past_due" || rawStatus === "canceled"
        ? rawStatus
        : "active";
    const rawBilling = (subRes.data?.billing_cycle as string | undefined) || null;
    const billing: "monthly" | "annual" | null =
      rawBilling === "monthly" || rawBilling === "annual" ? rawBilling : null;
    const periodEnd = (subRes.data?.current_period_end as string | undefined) || null;
    const trialEndsAt = (subRes.data?.trial_ends_at as string | undefined) || null;
    const cancelAtPeriodEnd = Boolean(subRes.data?.cancel_at_period_end);
    const tierSource = (subRes.data?.tier_source as string | undefined) || null;
    const stripeCustomerId = (subRes.data?.stripe_customer_id as string | undefined) || null;
    const stripeSubscriptionId = (subRes.data?.stripe_subscription_id as string | undefined) || null;
    // Vrai abo Stripe = les deux ids présents ET pas un octroi admin/comp.
    const isStripeManaged = !!stripeCustomerId && !!stripeSubscriptionId && tierSource !== "admin_grant";

    const trialDaysRemaining = trialEndsAt
      ? Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / 86_400_000))
      : null;

    const next: Subscription = {
      tier,
      role,
      status,
      billing,
      userId,
      isSchoolAdmin,
      periodEnd,
      trialEndsAt,
      trialDaysRemaining,
      cancelAtPeriodEnd,
      isStripeManaged,
    };
    setSubscription(next);
    setSubLoading(false);
  }, [userId]);

  // refresh() depends on userId, so this re-runs when userId goes from
  // undefined → defined (auth resolved) — no one-shot [] that would miss it.
  useEffect(() => {
    refresh();
  }, [refresh]);

  // Exposed loading stays true while auth is resolving OR the subscription
  // query is in flight — so consumers/gates never read a premature "free".
  const loading = userLoading || subLoading;

  const tier: SubscriptionTier = subscription?.tier || "free";
  const role: SubscriptionRole = subscription?.role || "athlete";

  const features: FeatureSet = (() => {
    switch (role) {
      case "recruiter": return RECRUITER_FEATURES[tier];
      case "coach":     return COACH_FEATURES[tier];
      case "athlete":   return ATHLETE_FEATURES[tier];
      default:          return {};
    }
  })();

  const canSee = (feature: string): boolean => {
    const v = features[feature];
    if (typeof v === "boolean") return v;
    if (typeof v === "number") return v !== 0;
    return false;
  };

  const getLimit = (feature: string): number => {
    const v = features[feature];
    if (typeof v === "number") return v;
    if (v === true) return -1;
    return 0;
  };

  const isUnlimited = (feature: string): boolean => getLimit(feature) === -1;

  const tierLabel = (): string => {
    if (tier === "all_star") return "All Star";
    if (tier === "pro") return "Pro";
    return "Gratuit";
  };

  const requiredTierFor = (feature: string): SubscriptionTier => {
    const table = role === "recruiter"
      ? RECRUITER_FEATURES
      : role === "coach"
      ? COACH_FEATURES
      : ATHLETE_FEATURES;
    const proVal = table.pro[feature];
    const proEnabled = proVal === true || (typeof proVal === "number" && proVal !== 0);
    if (proEnabled) return "pro";
    const asVal = table.all_star[feature];
    const asEnabled = asVal === true || (typeof asVal === "number" && asVal !== 0);
    if (asEnabled) return "all_star";
    return "free";
  };

  const isSchoolAdmin: boolean = Boolean(subscription?.isSchoolAdmin);
  const status: SubscriptionStatus = subscription?.status ?? "active";
  const billing = subscription?.billing ?? null;
  const periodEnd: string | null = subscription?.periodEnd ?? null;
  const trialDaysRemaining: number | null = subscription?.trialDaysRemaining ?? null;
  const cancelAtPeriodEnd: boolean = Boolean(subscription?.cancelAtPeriodEnd);
  const isStripeManaged: boolean = Boolean(subscription?.isStripeManaged);

  // Recruiter search-result cap. -1 = unlimited. Non-recruiters don't
  // search athletes, so expose -1 to avoid accidentally capping them.
  const maxSearchResults: number =
    role === "recruiter" ? getLimit("search_results_limit") : -1;

  // Recruiter favorites cap. -1 = unlimited. Non-recruiters don't use the
  // recruiter_favorites table, so expose -1.
  const maxFavorites: number =
    role === "recruiter" ? getLimit("favorites_limit") : -1;

  const value: SubscriptionContextValue = {
    subscription,
    tier,
    role,
    status,
    billing,
    periodEnd,
    trialDaysRemaining,
    cancelAtPeriodEnd,
    isStripeManaged,
    loading,
    features,
    canSee,
    getLimit,
    isUnlimited,
    tierLabel,
    requiredTierFor,
    refresh,
    isSchoolAdmin,
    maxSearchResults,
    maxFavorites,
  };

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
}

/* ── Consumer hook ────────────────────────────────────────── */

export function useSubscription(): SubscriptionContextValue {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) {
    throw new Error("useSubscription must be used inside <SubscriptionProvider>");
  }
  return ctx;
}
