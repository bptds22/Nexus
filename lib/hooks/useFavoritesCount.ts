"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/* ═══════════════════════════════════════════════════════════════
   useFavoritesCount — current count of `recruiter_favorites` rows
   owned by the signed-in user. The DB-level cap is the real
   enforcement; this hook only exists so the UI can disable the
   favorite button BEFORE the user hits the hard RLS block.
═══════════════════════════════════════════════════════════════ */

export function useFavoritesCount() {
  const [count, setCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) { setCount(0); setLoading(false); return; }
    const { count: c } = await supabase
      .from("recruiter_favorites")
      .select("id", { count: "exact", head: true })
      .eq("recruiter_id", session.user.id);
    setCount(c ?? 0);
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { count, loading, refresh, setCount };
}
