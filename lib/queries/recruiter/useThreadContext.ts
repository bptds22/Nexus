/* ═══════════════════════════════════════════════════════════════
   useThreadContext — TanStack hook (iter 7.8b)
   Contexte minimal d'un thread mobile : coach (nom + initiales + photo)
   + athlète (id + nom + photo + position) + status. Sert au header du
   thread mobile (coach centré + barre athlète épinglée). Le reste du
   contexte riche (régions, distinctions, etc.) n'est pas chargé ici
   pour rester léger.
═══════════════════════════════════════════════════════════════ */

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

export interface ThreadContextMobile {
  conversationId: string;
  /** RECRUTEUR_ATHLETE = direct (athlete is the counterparty, no coach panels). */
  isDirect: boolean;
  status: string;
  coachId: string;
  coachName: string;
  coachInitials: string;
  coachPhotoUrl: string | null;
  athleteId: string;
  athleteName: string;
  athleteFirstName: string;
  athleteLastName: string;
  athletePhotoUrl: string | null;
  athletePosition: string;
}

export function useThreadContext(conversationId: string | null) {
  return useQuery<ThreadContextMobile | null>({
    queryKey: ["thread-context", conversationId],
    queryFn: async () => {
      if (!conversationId) return null;
      const supabase = createClient();
      const { data, error } = await supabase
        .from("conversations")
        .select(`
          id, conversation_type, status, coach_id, athlete_id,
          coach:users!coach_id(id, first_name, last_name, avatar_url, photo_url),
          athlete:athletes!athlete_id(
            id, first_name, last_name, photo_url,
            positions!position_id(abreviation)
          )
        `)
        .eq("id", conversationId)
        .single();
      if (error) throw error;
      if (!data) return null;

      const coachRaw = data.coach;
      const coach = (Array.isArray(coachRaw) ? coachRaw[0] : coachRaw) as Record<string, unknown> | null;
      const athleteRaw = data.athlete;
      const athlete = (Array.isArray(athleteRaw) ? athleteRaw[0] : athleteRaw) as Record<string, unknown> | null;
      const posRaw = athlete?.positions;
      const pos = (Array.isArray(posRaw) ? posRaw[0] : posRaw) as { abreviation?: string } | null;

      const cf = (coach?.first_name as string) || "";
      const cl = (coach?.last_name as string) || "";
      const af = (athlete?.first_name as string) || "";
      const al = (athlete?.last_name as string) || "";
      const coachPhoto = (coach?.photo_url as string) || (coach?.avatar_url as string) || null;

      return {
        conversationId: data.id as string,
        isDirect: (data.conversation_type as string) === "RECRUTEUR_ATHLETE",
        status: (data.status as string) || "ACTIVE",
        coachId: (coach?.id as string) || "",
        coachName: `${cf} ${cl}`.trim() || "Coach",
        coachInitials: `${cf[0] || ""}${cl[0] || ""}`.toUpperCase(),
        coachPhotoUrl: coachPhoto,
        athleteId: (athlete?.id as string) || "",
        athleteName: `${af} ${al}`.trim() || "Athlète",
        athleteFirstName: af,
        athleteLastName: al,
        athletePhotoUrl: (athlete?.photo_url as string) || null,
        athletePosition: pos?.abreviation || "",
      };
    },
    enabled: !!conversationId,
    staleTime: 5 * 60 * 1000,
  });
}
