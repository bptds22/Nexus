/* ═══════════════════════════════════════════════════════════════
   useMarkAllCoachActivitiesRead — TanStack mutation (Phase 2)
   UPDATE activities SET read=true WHERE coach_id=me AND read=false.
   Mirror of useMarkAllActivitiesRead (recruiter side) ; same
   "visite = lu" pattern. Fires once on mount of CoachActivitesMobile
   to clear the unread badge.

   Invalidates ["activity-feed"] (prefix → catches both
   ["activity-feed", "coach", userId] and the recruiter key) so
   future renders fetch fresh.
═══════════════════════════════════════════════════════════════ */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useCurrentUser } from "@/lib/queries/shared/useCurrentUser";

export function useMarkAllCoachActivitiesRead() {
  const queryClient = useQueryClient();
  const { data: currentUser } = useCurrentUser();
  const userId = currentUser?.authUser.id;

  return useMutation({
    mutationFn: async (): Promise<void> => {
      if (!userId) return;
      const supabase = createClient();
      const { error } = await supabase
        .from("activities")
        .update({ read: true })
        .eq("coach_id", userId)
        .eq("read", false);
      if (error) throw error;
    },
    onSettled: () => {
      // Prefix invalidation — catches the coach feed key + any other
      // ["activity-feed", …] keys without forking.
      queryClient.invalidateQueries({ queryKey: ["activity-feed"] });
      // Also clear any tab-bar unread badge tied to the coach.
      queryClient.invalidateQueries({ queryKey: ["unread-activity-count", userId] });
    },
  });
}
