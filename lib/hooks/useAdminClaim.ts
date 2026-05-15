"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/* ─────────────────────────────────────────────────────────────────
   useAdminClaim — Item 11-Security

   Returns the most recent admin_claims row for the current session
   user (if any). The PendingAdminClaimBanner + ReadOnlyIfPending
   wrapper both consume this to decide whether the user is currently
   awaiting platform admin approval for a Directeur / Interim claim.

   The hook returns `claim = null` for:
   - unauthenticated visitors
   - coaches who picked "Entraîneur seulement" (no claim row)
   - civil coaches + cegep recruiters (claim workflow not in scope)
   - users whose claim is APPROVED or REJECTED *and* who have not
     since filed a new one
───────────────────────────────────────────────────────────────── */

export type AdminClaimStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface AdminClaim {
  id: string;
  claim_type: "DIRECTEUR" | "INTERIM";
  status: AdminClaimStatus;
  rejection_reason: string | null;
  created_at: string;
  school_name: string | null;
}

export function useAdminClaim() {
  const [claim, setClaim] = useState<AdminClaim | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        if (!cancelled) { setClaim(null); setLoading(false); }
        return;
      }
      const { data, error } = await supabase
        .from("admin_claims")
        .select("id, claim_type, status, rejection_reason, created_at, schools:school_id(name)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        console.error("[useAdminClaim] fetch error:", error.message);
        setClaim(null);
      } else if (!data) {
        setClaim(null);
      } else {
        const schoolRel = data.schools as { name?: string } | { name?: string }[] | null;
        const schoolName = Array.isArray(schoolRel) ? (schoolRel[0]?.name ?? null) : (schoolRel?.name ?? null);
        setClaim({
          id: data.id as string,
          claim_type: data.claim_type as "DIRECTEUR" | "INTERIM",
          status: data.status as AdminClaimStatus,
          rejection_reason: (data.rejection_reason as string | null) ?? null,
          created_at: data.created_at as string,
          school_name: schoolName,
        });
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  return { claim, loading };
}
