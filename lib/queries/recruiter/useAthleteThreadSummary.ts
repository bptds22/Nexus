/* ═══════════════════════════════════════════════════════════════
   useAthleteThreadSummary — iter 7.8e-UI Section E
   Charge un résumé léger de l'athlète pour le bottom sheet "À propos
   de {athlète}" du thread Messages mobile. Pas de fetch des données
   pipeline (Prio/Notes) — ce sheet est en mode READ-ONLY.
   queryKey ["athlete-thread-summary", athleteId].
═══════════════════════════════════════════════════════════════ */

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { fetchRecruiterAthleteCards, displayFullName } from "@/lib/queries/shared/recruiterAthleteCards";

export interface AthleteThreadSummary {
  id: string;
  /** false = identité masquée par le serveur (Loi 25 ou tier FREE). */
  identityVisible: boolean;
  /** Déjà résolu par displayFullName() — à afficher tel quel, ne jamais
   *  reconcaténer firstName + lastName, qui sont vides sous masquage. */
  fullName: string;
  firstName: string;
  lastName: string;
  photoUrl: string | null;
  promotion: number | null;
  schoolName: string | null;
  sportName: string | null;
  positionName: string | null;
  /** Acronyme position (ex: "ILB" pour Inside Linebacker) — préféré à positionName pour l'affichage compact. */
  positionAbbr: string | null;
  verified: boolean;
  recruitmentStatus: string | null;
  coteGlobaleEntraineur: number | null;
  profileCompletion: number | null;
}

export function useAthleteThreadSummary(athleteId: string | null) {
  return useQuery<AthleteThreadSummary | null>({
    queryKey: ["athlete-thread-summary", athleteId],
    queryFn: async () => {
      if (!athleteId) return null;
      const supabase = createClient();

      /* Lot d'un seul ID : la RPC porte déjà la projection Loi 25 +
         tier, les jointures sport/position/école, et rend NULL sur un
         athlète inactif — soit exactement ce que faisait le
         `.maybeSingle()` d'avant, masquage en plus. */
      const cards = await fetchRecruiterAthleteCards(supabase, [athleteId]);
      const card = cards.get(athleteId) ?? null;
      if (!card) return null;

      return {
        id: card.id,
        identityVisible: card.identity_visible,
        fullName: displayFullName(card),
        firstName: card.first_name ?? "",
        lastName: card.last_name ?? "",
        photoUrl: card.photo_url,
        promotion: card.annee_diplomation,
        schoolName: card.school_name,
        sportName: card.sport_nom,
        positionName: card.position_nom,
        positionAbbr: card.position_abbr,
        verified: card.verified === true,
        recruitmentStatus: card.statut_recrutement_override,
        coteGlobaleEntraineur: card.cote_globale,
        profileCompletion: card.profile_completion,
      };
    },
    enabled: !!athleteId,
    staleTime: 60 * 1000,
  });
}
