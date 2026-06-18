/* ═══════════════════════════════════════════════════════════════
   useMarkAllActivitiesRead — TanStack mutation (iter 7.30b)
   UPDATE recruiter_activity_log SET is_read=true WHERE recruiter_id=me
   AND is_read=false. Pattern "visite = lu" canon, identique au desktop
   (auto-marqué au mount du feed). Invalide ["activity-feed"] +
   ["unread-activity-count"] au settle pour vider le badge sidebar.
═══════════════════════════════════════════════════════════════ */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useCurrentUser } from "@/lib/queries/shared/useCurrentUser";

export function useMarkAllActivitiesRead() {
  const queryClient = useQueryClient();
  const { data: currentUser } = useCurrentUser();
  const userId = currentUser?.authUser.id;

  return useMutation({
    mutationFn: async (): Promise<void> => {
      if (!userId) return;
      const supabase = createClient();
      const { error } = await supabase
        .from("recruiter_activity_log")
        .update({ is_read: true })
        .eq("recruiter_id", userId)
        .eq("is_read", false);
      if (error) throw error;
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["activity-feed", userId] });
      queryClient.invalidateQueries({ queryKey: ["unread-activity-count", userId] });
    },
  });
}
