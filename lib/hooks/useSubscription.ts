"use client";

import { createClient } from "@/lib/supabase/client";
import { useCallback, useEffect, useState } from "react";

/* ═══════════════════════════════════════════════════════════════
   useSubscription — DB-backed subscription + feature flags.

   Reads from the existing `subscriptions` table (user_id, tier,
   status, billing_cycle) + joins `users.role` to determine persona.

   Normalizes every historical tier string the DB might hold:
     ALL_STAR / all_star / allstar / coach_allstar / recruteur_allstar
       → "all_star"
     PRO / pro / coach_pro / recruteur_pro / athlete_pro
       → "pro"
     anything else → "free"
═══════════════════════════════════════════════════════════════ */

export type SubscriptionTier = "free" | "pro" | "all_star";
export type SubscriptionRole = "recruiter" | "coach" | "athlete";

interface Subscription {
  tier: SubscriptionTier;
  role: SubscriptionRole;
  status: string;
  billing: string | null;
  userId: string;
  isSchoolAdmin: boolean;
}

/* ── Feature flag tables ──────────────────────────────────── */

type FeatureValue = boolean | number;
type FeatureSet = Record<string, FeatureValue>;

const RECRUITER_FEATURES: Record<SubscriptionTier, FeatureSet> = {
  free: {
    can_search: true,
    can_use_advanced_filters: false,
    search_results_limit: 10,
    can_see_athlete_name: false,
    can_see_athlete_photo: false,
    can_see_jersey_number: false,
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
    can_see_athlete_name: true,
    can_see_athlete_photo: true,
    can_see_jersey_number: true,
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
    can_use_custom_lists: false,
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
    can_see_athlete_name: true,
    can_see_athlete_photo: true,
    can_see_jersey_number: true,
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

/* ── Hook ─────────────────────────────────────────────────── */

export function useSubscription() {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      setSubscription(null);
      setLoading(false);
      return;
    }

    // Two parallel queries: the user row (for role + is_school_admin) + the subscription row
    const [userRes, subRes] = await Promise.all([
      supabase.from("users").select("role, is_school_admin").eq("id", session.user.id).maybeSingle(),
      supabase
        .from("subscriptions")
        .select("tier, status, billing_cycle")
        .eq("user_id", session.user.id)
        .maybeSingle(),
    ]);

    const role = normalizeRole(userRes.data?.role as string | undefined);
    const isSchoolAdmin = Boolean(userRes.data?.is_school_admin);
    const tier = normalizeTier(subRes.data?.tier as string | undefined);
    const status = (subRes.data?.status as string | undefined) || "active";
    const billing = (subRes.data?.billing_cycle as string | undefined) || null;

    const next: Subscription = {
      tier,
      role,
      status,
      billing,
      userId: session.user.id,
      isSchoolAdmin,
    };
    console.log("[Subscription] Hook loaded:", { tier: next.tier, role: next.role });
    setSubscription(next);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

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

  return {
    subscription,
    tier,
    role,
    loading,
    features,
    canSee,
    getLimit,
    isUnlimited,
    tierLabel,
    requiredTierFor,
    refresh,
    isSchoolAdmin,
  };
}
