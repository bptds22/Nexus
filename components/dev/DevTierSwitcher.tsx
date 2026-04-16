"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useSubscription, type SubscriptionTier } from "@/lib/hooks/useSubscription";

/* ═══════════════════════════════════════════════════════════════
   DevTierSwitcher — dev-only floating pill.

   Renders nothing in production. In dev, shows three pills to
   switch the current user's subscriptions.tier to free/pro/all_star.
   Writes via upsert on subscriptions(user_id) and refreshes the
   hook state so gated UI reacts immediately.
═══════════════════════════════════════════════════════════════ */

const ALL_TIERS: { value: SubscriptionTier; label: string; bg: string; fg: string }[] = [
  { value: "free",     label: "Free",     bg: "bg-white/10",          fg: "text-white" },
  { value: "pro",      label: "Pro",      bg: "bg-[#F59E0B]",         fg: "text-black" },
  { value: "all_star", label: "All Star", bg: "bg-[#E63946]",         fg: "text-white" },
];

/**
 * Tier options per role:
 * - coach:    free, pro            (Coach has 2 tiers only)
 * - athlete:  free, pro            (Athlete has 2 tiers only)
 * - recruiter: free, pro, all_star (3 tiers)
 */
function tiersForRole(role: string): typeof ALL_TIERS {
  if (role === "recruiter") return ALL_TIERS;
  return ALL_TIERS.filter((t) => t.value !== "all_star");
}

export default function DevTierSwitcher() {
  const { tier, role, subscription, refresh, loading } = useSubscription();
  const [busy, setBusy] = useState(false);

  if (process.env.NODE_ENV !== "development") return null;
  if (loading) return null;
  if (!subscription) return null;

  async function setTier(next: SubscriptionTier) {
    if (busy || !subscription) return;
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("subscriptions")
      .upsert(
        {
          user_id: subscription.userId,
          tier: next,
          status: "active",
          billing_cycle: "monthly",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );
    if (error) {
      console.error("[DevTierSwitcher] upsert error:", error);
    }
    await refresh();
    setBusy(false);
  }

  return (
    <div className="fixed bottom-4 right-4 z-[100] pointer-events-none">
      <div className="pointer-events-auto bg-[#1A1D24]/95 backdrop-blur-sm border border-white/10 rounded-full px-3 py-1.5 shadow-2xl flex items-center gap-2 text-[11px]">
        <span className="text-white/50 uppercase tracking-wider font-bold">
          Dev · {role}
        </span>
        <span className="text-white/20">·</span>
        {tiersForRole(role).map((t) => {
          const active = tier === t.value;
          return (
            <button
              key={t.value}
              type="button"
              disabled={busy || active}
              onClick={() => setTier(t.value)}
              className={`px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider transition-opacity ${
                active ? `${t.bg} ${t.fg}` : "bg-white/5 text-white/60 hover:text-white"
              } ${busy ? "opacity-50 cursor-wait" : ""}`}
            >
              {t.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
