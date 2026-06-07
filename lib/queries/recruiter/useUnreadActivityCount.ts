/* ═══════════════════════════════════════════════════════════════
   useUnreadActivityCount — TanStack hook (iter 7.30b)
   Count des recruiter_activity_log avec is_read=false pour le
   recruteur courant. Sert au badge sur l'onglet "Plus / Activités"
   ou à toute UI qui veut afficher le nombre d'activités non lues.
   queryKey ["unread-activity-count", userId], staleTime 30s.
═══════════════════════════════════════════════════════════════ */

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useCurrentUser } from "@/lib/queries/shared/useCurrentUser";

export function useUnreadActivityCount() {
  const { data: currentUser } = useCurrentUser();
  const userId = currentUser?.authUser.id;

  return useQuery<number>({
    queryKey: ["unread-activity-count", userId],
    queryFn: async (): Promise<number> => {
      if (!userId) return 0;
      const supabase = createClient();
      const { count, error } = await supabase
        .from("recruiter_activity_log")
        .select("*", { count: "exact", head: true })
        .eq("recruiter_id", userId)
        .eq("is_read", false);
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!userId,
    staleTime: 30 * 1000,
  });
}
