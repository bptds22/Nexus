"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/* ─────────────────────────────────────────────────────────────────
   DeactivationGuard
   Drop inside each portal layout. On mount:
   1. If the user's `status` is DESACTIVE → signOut + /compte-desactive
   2. If `app_settings.maintenance_mode` = 'true' AND user is not
      ADMIN/SUPER_ADMIN → redirect to /maintenance
───────────────────────────────────────────────────────────────── */

export default function DeactivationGuard() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) return;

      const [profileRes, maintRes] = await Promise.all([
        supabase.from("users").select("status, role").eq("id", user.id).maybeSingle(),
        supabase.from("app_settings").select("value").eq("key", "maintenance_mode").maybeSingle(),
      ]);

      if (profileRes.error) {
        console.error("[DeactivationGuard] profile query error:", profileRes.error.message);
        return;
      }
      const profile = profileRes.data;
      const maintenanceOn = maintRes.data?.value === "true";

      if (cancelled) return;

      if (profile?.status === "DESACTIVE" && profile?.role !== "SUPER_ADMIN") {
        await supabase.auth.signOut();
        router.replace("/compte-desactive");
        return;
      }

      if (maintenanceOn && profile?.role !== "ADMIN" && profile?.role !== "SUPER_ADMIN") {
        router.replace("/maintenance");
      }
    })();
    return () => { cancelled = true; };
  }, [router]);

  return null;
}
