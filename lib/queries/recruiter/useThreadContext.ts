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
import { fetchRecruiterAthleteCards, displayFullName } from "@/lib/queries/shared/recruiterAthleteCards";

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
  /** Déjà résolu par displayFullName() — ne jamais reconcaténer
   *  athleteFirstName + athleteLastName, vides sous masquage. */
  athleteName: string;
  athleteFirstName: string;
  athleteLastName: string;
  athletePhotoUrl: string | null;
  athletePosition: string;
  /** false = identité masquée par le serveur (Loi 25 ou tier FREE). */
  athleteIdentityVisible: boolean;
  /** Entraineur rattache a l'athlete — porte de sortie quand le fil direct
   *  est verrouille par une periode de silence RSEQ (RECRUTEUR_COACH n'est
   *  pas bloque). null = aucun entraineur, on ne propose alors rien. */
  athleteCoachId: string | null;
}

export function useThreadContext(conversationId: string | null) {
  return useQuery<ThreadContextMobile | null>({
    queryKey: ["thread-context", conversationId],
    queryFn: async () => {
      if (!conversationId) return null;
      const supabase = createClient();
      /* Temps 1 — la conversation seule. L'embed `coach:users` reste :
         il porte un utilisateur, pas un athlète, donc il n'est pas
         concerné par la projection Loi 25. Seul l'embed athletes part. */
      const { data, error } = await supabase
        .from("conversations")
        .select(`
          id, conversation_type, status, coach_id, athlete_id,
          coach:users!coach_id(id, first_name, last_name, avatar_url, photo_url)
        `)
        .eq("id", conversationId)
        .single();
      if (error) throw error;
      if (!data) return null;

      const coachRaw = data.coach;
      const coach = (Array.isArray(coachRaw) ? coachRaw[0] : coachRaw) as Record<string, unknown> | null;

      /* Temps 2 — la carte athlète projetée. */
      const athleteId = (data.athlete_id as string | null) ?? null;
      const cardMap = await fetchRecruiterAthleteCards(supabase, athleteId ? [athleteId] : []);
      const card = (athleteId ? cardMap.get(athleteId) : null) ?? null;

      /* Le coach de l'ATHLETE, distinct de `coach` (l'interlocuteur du fil,
         absent d'un fil direct). Lu a part : la carte projetee ne le porte
         pas. Echec silencieux — sans lui on n'affiche simplement pas la
         porte de sortie. */
      let coachAthlete: string | null = null;
      if (athleteId) {
        const { data: aRow } = await supabase
          .from("athletes").select("coach_id").eq("id", athleteId).maybeSingle();
        coachAthlete = ((aRow as { coach_id: string | null } | null)?.coach_id) ?? null;
      }

      const cf = (coach?.first_name as string) || "";
      const cl = (coach?.last_name as string) || "";
      const coachPhoto = (coach?.photo_url as string) || (coach?.avatar_url as string) || null;

      return {
        conversationId: data.id as string,
        isDirect: (data.conversation_type as string) === "RECRUTEUR_ATHLETE",
        status: (data.status as string) || "ACTIVE",
        coachId: (coach?.id as string) || "",
        coachName: `${cf} ${cl}`.trim() || "Coach",
        coachInitials: `${cf[0] || ""}${cl[0] || ""}`.toUpperCase(),
        coachPhotoUrl: coachPhoto,
        athleteId: card?.id ?? athleteId ?? "",
        athleteName: displayFullName(card, "Athlète"),
        athleteFirstName: card?.first_name ?? "",
        athleteLastName: card?.last_name ?? "",
        athletePhotoUrl: card?.photo_url ?? null,
        athletePosition: card?.position_abbr ?? "",
        athleteIdentityVisible: card?.identity_visible ?? false,
        athleteCoachId: coachAthlete,
      };
    },
    enabled: !!conversationId,
    staleTime: 5 * 60 * 1000,
  });
}
