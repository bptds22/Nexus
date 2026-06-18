/* ═══════════════════════════════════════════════════════════════
   useCoachThreadContext — TanStack hook (Phase 2 — coach mobile)
   Mirror of useThreadContext. Coach thread header centre :
   RECRUITER photo + name + CÉGEP + chevron, sous-titre
   "Au sujet de {athlète} ›".
═══════════════════════════════════════════════════════════════ */

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

export interface CoachThreadContextMobile {
  conversationId: string;
  status: string;
  /** Recruiter — counterparty. */
  recruiterId: string;
  recruiterName: string;
  recruiterInitials: string;
  recruiterPhotoUrl: string | null;
  recruiterCegep: string;
  /** Athlete subject. */
  athleteId: string;
  athleteName: string;
  athleteFirstName: string;
  athleteLastName: string;
  athletePhotoUrl: string | null;
  athletePosition: string;
}

export function useCoachThreadContext(conversationId: string | null) {
  return useQuery<CoachThreadContextMobile | null>({
    queryKey: ["coach-thread-context", conversationId],
    queryFn: async () => {
      if (!conversationId) return null;
      const supabase = createClient();
      const { data, error } = await supabase
        .from("conversations")
        .select(`
          id, status, recruiter_id, athlete_id,
          recruiter:users!recruiter_id(
            id, first_name, last_name, avatar_url, photo_url, school_id,
            schools!school_id(name)
          ),
          athlete:athletes!athlete_id(
            id, first_name, last_name, photo_url,
            positions!position_id(abreviation)
          )
        `)
        .eq("id", conversationId)
        .single();
      if (error) throw error;
      if (!data) return null;

      const recRaw = data.recruiter;
      const rec = (Array.isArray(recRaw) ? recRaw[0] : recRaw) as Record<string, unknown> | null;
      const recSchoolRaw = rec?.schools;
      const recSchool = (Array.isArray(recSchoolRaw) ? recSchoolRaw[0] : recSchoolRaw) as { name?: string } | null;
      const athRaw = data.athlete;
      const ath = (Array.isArray(athRaw) ? athRaw[0] : athRaw) as Record<string, unknown> | null;
      const posRaw = ath?.positions;
      const pos = (Array.isArray(posRaw) ? posRaw[0] : posRaw) as { abreviation?: string } | null;

      const rf = (rec?.first_name as string) || "";
      const rl = (rec?.last_name as string) || "";
      const af = (ath?.first_name as string) || "";
      const al = (ath?.last_name as string) || "";

      return {
        conversationId: data.id as string,
        status: (data.status as string) || "ACTIVE",
        recruiterId: (rec?.id as string) || "",
        recruiterName: `${rf} ${rl}`.trim() || "Recruteur",
        recruiterInitials: `${rf[0] || ""}${rl[0] || ""}`.toUpperCase(),
        recruiterPhotoUrl: (rec?.photo_url as string) || (rec?.avatar_url as string) || null,
        recruiterCegep: recSchool?.name || "",
        athleteId: (ath?.id as string) || "",
        athleteName: `${af} ${al}`.trim() || "Athlète",
        athleteFirstName: af,
        athleteLastName: al,
        athletePhotoUrl: (ath?.photo_url as string) || null,
        athletePosition: pos?.abreviation || "",
      };
    },
    enabled: !!conversationId,
    staleTime: 5 * 60 * 1000,
  });
}
