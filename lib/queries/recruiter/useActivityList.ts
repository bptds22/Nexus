/* ═══════════════════════════════════════════════════════════════
   useActivityList — TanStack hook (iter 7.30b)
   Charge les 50 dernières entrées de recruiter_activity_log pour le
   feed mobile RecruteurActivitesMobile + résout les noms d'athlètes
   (jointure athletes) et de coachs (REVIEW_SUBMITTED via details.coach_id,
   COACH_REPLY directement depuis details.first/last_name loggé par
   trigger 7.30a).

   ⚠️ Distinct de useActivityFeed (iter 5.2, dashboard widget, shape
   ActivityEvent avec direction/priority/icon précalculés). Ici on
   expose les champs RAW (beforeStage, newStage, listName, etc.) pour
   que le composant mobile génère ses propres verbes/icônes/couleurs.

   queryKey ["activity-feed", userId], staleTime 30s, placeholderData
   keeps prev pour éviter le flash skeleton (canon 7.21).
═══════════════════════════════════════════════════════════════ */

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useCurrentUser } from "@/lib/queries/shared/useCurrentUser";

export interface ActivityListItem {
  id: string;
  actionType: string;
  athleteId: string | null;
  athleteName: string | null;
  listId: string | null;
  listName: string | null;
  coachName: string | null;
  /** PIPELINE_CHANGED — étape avant (NULL sur INSERT initial). */
  beforeStage: string | null;
  /** PIPELINE_CHANGED — nouvelle étape. */
  newStage: string | null;
  /** REVIEW_SUBMITTED — cote globale donnée au coach. */
  noteGlobale: number | null;
  /** COACH_REPLY — conversation cible pour la nav. */
  conversationId: string | null;
  createdAt: string;
  isRead: boolean;
}

interface LogRow {
  id: string;
  action_type: string;
  athlete_id: string | null;
  list_id: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
  is_read: boolean;
}

export function useActivityList() {
  const { data: currentUser } = useCurrentUser();
  const userId = currentUser?.authUser.id;

  return useQuery<ActivityListItem[]>({
    queryKey: ["activity-feed", userId],
    queryFn: async (): Promise<ActivityListItem[]> => {
      if (!userId) return [];
      const supabase = createClient();
      const { data, error } = await supabase
        .from("recruiter_activity_log")
        .select("id, action_type, athlete_id, list_id, details, created_at, is_read")
        .eq("recruiter_id", userId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      const rows = (data ?? []) as LogRow[];

      // Hydrate les noms d'athlètes en batch.
      const athleteIds = [...new Set(rows.map((r) => r.athlete_id).filter(Boolean))] as string[];
      const athleteMap = new Map<string, string>();
      if (athleteIds.length > 0) {
        const { data: ath } = await supabase
          .from("athletes")
          .select("id, first_name, last_name")
          .in("id", athleteIds);
        for (const a of (ath ?? []) as Array<{ id: string; first_name: string | null; last_name: string | null }>) {
          const name = `${a.first_name ?? ""} ${a.last_name ?? ""}`.trim();
          if (name) athleteMap.set(a.id, name);
        }
      }

      // Hydrate les noms de coachs pour REVIEW_SUBMITTED.
      // COACH_REPLY a déjà first/last_name dans details (trigger 7.30a) → pas de fetch.
      const coachIds = [
        ...new Set(
          rows
            .filter((r) => r.action_type === "REVIEW_SUBMITTED")
            .map((r) => (r.details as Record<string, unknown> | null)?.coach_id)
            .filter(Boolean),
        ),
      ] as string[];
      const coachMap = new Map<string, string>();
      if (coachIds.length > 0) {
        const { data: u } = await supabase
          .from("users")
          .select("id, first_name, last_name")
          .in("id", coachIds);
        for (const c of (u ?? []) as Array<{ id: string; first_name: string | null; last_name: string | null }>) {
          const name = `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim();
          if (name) coachMap.set(c.id, name);
        }
      }

      return rows.map((r): ActivityListItem => {
        const details = (r.details ?? {}) as Record<string, unknown>;
        const actionType = r.action_type;

        // Athlete name : table → fallback details.first/last
        // (sauf COACH_REPLY où first/last sont le COACH, pas l'athlète).
        let athleteName: string | null = null;
        if (r.athlete_id) {
          athleteName = athleteMap.get(r.athlete_id) ?? null;
          if (!athleteName && actionType !== "COACH_REPLY") {
            const fn = details.first_name as string | undefined;
            const ln = details.last_name as string | undefined;
            const fallback = `${fn ?? ""} ${ln ?? ""}`.trim();
            if (fallback) athleteName = fallback;
          }
        }

        // Coach name : COACH_REPLY → directement depuis details (trigger 7.30a
        // a stocké first/last du coach sender). REVIEW_SUBMITTED → coachMap.
        let coachName: string | null = null;
        if (actionType === "COACH_REPLY") {
          const fn = details.first_name as string | undefined;
          const ln = details.last_name as string | undefined;
          coachName = `${fn ?? ""} ${ln ?? ""}`.trim() || null;
        } else if (actionType === "REVIEW_SUBMITTED") {
          coachName = coachMap.get((details.coach_id as string) ?? "") ?? null;
        }

        return {
          id: r.id,
          actionType,
          athleteId: r.athlete_id,
          athleteName,
          listId: r.list_id,
          // list_name vient du trigger 7.30a (LIST_* actions le stockent dans details).
          listName: (details.list_name as string) || null,
          coachName,
          beforeStage: (details.before_stage as string) || null,
          newStage: (details.new_stage as string) || null,
          noteGlobale: typeof details.note_globale === "number" ? details.note_globale : null,
          conversationId: (details.conversation_id as string) || null,
          createdAt: r.created_at,
          isRead: r.is_read,
        };
      });
    },
    enabled: !!userId,
    staleTime: 30 * 1000,
    placeholderData: (prev) => prev,
  });
}
