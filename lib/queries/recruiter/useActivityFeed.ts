/* ═══════════════════════════════════════════════════════════════
   useActivityFeed — TanStack hook (iter 5.2)
   Dernières 20 entrées de recruiter_activity_log pour le user
   courant. staleTime 1 min — les events arrivent en temps réel
   mais on évite de spam la DB.
═══════════════════════════════════════════════════════════════ */

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useCurrentUser } from "@/lib/queries/shared/useCurrentUser";
import type { ActivityEvent } from "@/lib/types/activityEvents";

// Mapping action_type → event metadata (copié de tableau-de-bord/page.tsx pour
// que le hook soit autonome — duplication temporaire à factoriser plus tard).
const ACTION_TYPE_TO_EVENT: Record<string, { type: ActivityEvent["type"]; direction: "inbound" | "outbound"; priority: 1 | 2 | 3; icon: string; iconColor: string }> = {
  PIPELINE_CHANGED: { type: "status_engage", direction: "outbound", priority: 2, icon: "activity", iconColor: "#E63946" },
  FAVORITED: { type: "recruiter_favorited", direction: "outbound", priority: 2, icon: "heart", iconColor: "#E63946" },
  UNFAVORITED: { type: "recruiter_favorited", direction: "outbound", priority: 3, icon: "heart", iconColor: "#6B7280" },
  PROFILE_VIEWED: { type: "profile_updated_bulk", direction: "outbound", priority: 3, icon: "eye", iconColor: "#6B7280" },
  VIDEO_ADDED: { type: "video_added", direction: "inbound", priority: 2, icon: "video", iconColor: "#8B5CF6" },
  ATHLETE_VERIFIED: { type: "profile_verified", direction: "inbound", priority: 1, icon: "check-circle", iconColor: "#3B82F6" },
  PROFILE_UPDATED: { type: "profile_updated_bulk", direction: "inbound", priority: 2, icon: "edit", iconColor: "#6B7280" },
  NOTE_ADDED: { type: "scouting_report_updated", direction: "outbound", priority: 3, icon: "file-text", iconColor: "#F59E0B" },
  COACH_REPLY: { type: "coach_replied", direction: "inbound", priority: 1, icon: "message-circle", iconColor: "#22C55E" },
};

function getTimeGroup(iso: string): ActivityEvent["timeGroup"] {
  const now = new Date();
  const d = new Date(iso);
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0) return "Aujourd'hui";
  if (diffDays === 1) return "Hier";
  if (diffDays < 7) return "Cette semaine";
  return "Semaine dernière";
}

export function useActivityFeed() {
  const { data: currentUser } = useCurrentUser();
  const userId = currentUser?.authUser.id;

  return useQuery<ActivityEvent[]>({
    queryKey: ["dashboard", "activity", userId],
    queryFn: async (): Promise<ActivityEvent[]> => {
      if (!userId) return [];
      const supabase = createClient();
      const { data: activityData } = await supabase
        .from("recruiter_activity_log")
        .select("id, action_type, details, created_at, athlete_id")
        .eq("recruiter_id", userId)
        .order("created_at", { ascending: false })
        .limit(20);

      if (!activityData) return [];

      return activityData.map((a): ActivityEvent => {
        const details = (a.details as Record<string, unknown>) || {};
        const mapping = ACTION_TYPE_TO_EVENT[a.action_type] || {
          type: "profile_updated_bulk" as const,
          direction: "outbound" as const,
          priority: 3 as const,
          icon: "activity",
          iconColor: "#6B7280",
        };
        const athleteName = `${(details.first_name as string) || ""} ${(details.last_name as string) || ""}`.trim();

        // Relative time
        const diffMs = Date.now() - new Date(a.created_at).getTime();
        const diffMin = Math.floor(diffMs / 60000);
        let relativeTime = "À l'instant";
        if (diffMin >= 60) { const h = Math.floor(diffMin / 60); relativeTime = `Il y a ${h}h`; }
        else if (diffMin >= 1) { relativeTime = `Il y a ${diffMin} min`; }
        const diffDays = Math.floor(diffMs / 86400000);
        if (diffDays === 1) relativeTime = "Hier";
        else if (diffDays > 1 && diffDays < 7) relativeTime = `Il y a ${diffDays}j`;
        else if (diffDays >= 7) relativeTime = `Il y a ${Math.floor(diffDays / 7)} sem.`;

        return {
          id: a.id,
          type: mapping.type,
          direction: mapping.direction,
          priority: mapping.priority,
          icon: mapping.icon,
          iconColor: mapping.iconColor,
          timeGroup: getTimeGroup(a.created_at),
          timestamp: a.created_at,
          relativeTime,
          athleteId: a.athlete_id || undefined,
          athleteName: athleteName || undefined,
          message: `${athleteName || "Athlète"} — ${a.action_type.replace(/_/g, " ").toLowerCase()}`,
          actionLabel: "Voir",
          actionUrl: a.athlete_id ? `/recruteur/athletes/${a.athlete_id}` : undefined,
        };
      });
    },
    staleTime: 1 * 60 * 1000,
    enabled: !!userId,
  });
}
