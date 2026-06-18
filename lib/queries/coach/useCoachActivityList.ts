/* ═══════════════════════════════════════════════════════════════
   useCoachActivityList — TanStack hook (Phase 2 — coach mobile)
   Mirror of useActivityList but coach-side : reads public.activities
   WHERE coach_id = auth.uid(), joins athlete (name + position), and
   maps each row to a shell-friendly CoachActivityItem.

   Different table than the recruiter feed by design :
   - recruiter_activity_log  → recruiter-side rollup of athlete /
                                favorite / list / pipeline events
                                (18 action_types).
   - activities              → coach-side rollup of things happening
                                TO their roster (13 type values per
                                the CHECK constraint at baseline.sql:1184).

   Cache key prefix : ["activity-feed", "coach", userId]. Sharing the
   "activity-feed" prefix lets useMarkAllCoachActivitiesRead's
   invalidation catch both surfaces via the same pattern the recruiter
   side uses (prefix match on "activity-feed").
═══════════════════════════════════════════════════════════════ */

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useCurrentUser } from "@/lib/queries/shared/useCurrentUser";

export interface CoachActivityItem {
  id: string;
  /** action_type — one of activities.type CHECK values. */
  actionType: string;
  athleteId: string | null;
  athleteName: string | null;
  athletePosition: string | null;
  /** Meta fields hydrated from activities.metadata (jsonb). */
  recruiterName: string | null;
  cegepName: string | null;
  badgeName: string | null;
  newStatus: string | null;
  /** Only set for NEW_MESSAGE events — drives the tap destination. */
  conversationId: string | null;
  createdAt: string;
  isRead: boolean;
}

interface ActivityRow {
  id: string;
  type: string;
  athlete_id: string | null;
  metadata: Record<string, unknown> | null;
  read: boolean | null;
  created_at: string;
  athletes:
    | {
        first_name: string | null;
        last_name: string | null;
        positions: { abreviation: string | null; nom: string | null } | Array<{ abreviation: string | null; nom: string | null }> | null;
      }
    | Array<{
        first_name: string | null;
        last_name: string | null;
        positions: { abreviation: string | null; nom: string | null } | Array<{ abreviation: string | null; nom: string | null }> | null;
      }>
    | null;
}

function flatten<T>(rel: T | T[] | null | undefined): T | null {
  if (!rel) return null;
  return Array.isArray(rel) ? (rel[0] ?? null) : rel;
}

export function useCoachActivityList() {
  const { data: currentUser } = useCurrentUser();
  const userId = currentUser?.authUser.id;

  return useQuery<CoachActivityItem[]>({
    queryKey: ["activity-feed", "coach", userId],
    queryFn: async (): Promise<CoachActivityItem[]> => {
      if (!userId) return [];
      const supabase = createClient();
      const { data, error } = await supabase
        .from("activities")
        .select(`
          id, type, athlete_id, metadata, read, created_at,
          athletes!athlete_id(
            first_name, last_name,
            positions!position_id(abreviation, nom)
          )
        `)
        .eq("coach_id", userId)
        .order("created_at", { ascending: false })
        .limit(200);

      if (error) throw error;
      const rows = (data ?? []) as ActivityRow[];

      return rows.map((r): CoachActivityItem => {
        const meta = (r.metadata ?? {}) as Record<string, unknown>;
        const ath = flatten(r.athletes);
        const pos = flatten(ath?.positions ?? null);

        const athleteName = ath
          ? `${ath.first_name ?? ""} ${ath.last_name ?? ""}`.trim() || null
          : null;
        const athletePosition = pos?.abreviation || pos?.nom || null;

        return {
          id: r.id,
          actionType: r.type,
          athleteId: r.athlete_id,
          athleteName,
          athletePosition,
          recruiterName: (meta.recruiter_name as string | undefined) ?? null,
          cegepName: (meta.cegep_name as string | undefined) ?? null,
          badgeName: (meta.badge_name as string | undefined) ?? null,
          newStatus: (meta.new_status as string | undefined) ?? null,
          conversationId: (meta.conversation_id as string | undefined) ?? null,
          createdAt: r.created_at,
          isRead: !!r.read,
        };
      });
    },
    enabled: !!userId,
    staleTime: 30 * 1000,
    placeholderData: (prev) => prev,
  });
}
