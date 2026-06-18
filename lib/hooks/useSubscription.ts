/* ═══════════════════════════════════════════════════════════════
   useSubscription — re-export shim.

   The implementation now lives in lib/context/SubscriptionProvider.tsx,
   which holds ONE shared copy of the subscription state for the whole
   app (so a single refresh() updates every consumer at once). This file
   used to own the DB fetch + feature tables; that logic was MOVED to the
   Provider. It now only re-exports the public surface so the existing
   call sites importing from "@/lib/hooks/useSubscription" keep resolving
   unchanged — no fetch logic remains here.
═══════════════════════════════════════════════════════════════ */

export {
  useSubscription,
  normalizeTier,
  normalizeRole,
} from "@/lib/context/SubscriptionProvider";

export type {
  SubscriptionTier,
  SubscriptionRole,
  SubscriptionStatus,
} from "@/lib/context/SubscriptionProvider";
