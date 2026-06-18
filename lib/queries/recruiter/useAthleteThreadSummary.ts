/* ═══════════════════════════════════════════════════════════════
   useAthleteThreadSummary — iter 7.8e-UI Section E
   Charge un résumé léger de l'athlète pour le bottom sheet "À propos
   de {athlète}" du thread Messages mobile. Pas de fetch des données
   pipeline (Prio/Notes) — ce sheet est en mode READ-ONLY.
   queryKey ["athlete-thread-summary", athleteId].
═══════════════════════════════════════════════════════════════ */

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

export interface AthleteThreadSummary {
  id: string;
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

interface AthleteRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  photo_url: string | null;
  annee_diplomation: number | null;
  verified: boolean | null;
  statut_recrutement_override: string | null;
  cote_globale_entraineur: number | null;
  profile_completion: number | null;
  schools: { name: string | null } | { name: string | null }[] | null;
  sports: { nom: string | null } | { nom: string | null }[] | null;
  positions: { nom: string | null; abreviation: string | null } | { nom: string | null; abreviation: string | null }[] | null;
}

function pickOne<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

export function useAthleteThreadSummary(athleteId: string | null) {
  return useQuery<AthleteThreadSummary | null>({
    queryKey: ["athlete-thread-summary", athleteId],
    queryFn: async () => {
      if (!athleteId) return null;
      const supabase = createClient();
      const { data, error } = await supabase
        .from("athletes")
        .select(`
          id, first_name, last_name, photo_url, annee_diplomation,
          verified, statut_recrutement_override, cote_globale_entraineur, profile_completion,
          schools!school_id(name),
          sports!sport_id(nom),
          positions!position_id(nom, abreviation)
        `)
        .eq("id", athleteId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const row = data as AthleteRow;
      const pos = pickOne(row.positions);
      return {
        id: row.id,
        firstName: row.first_name ?? "",
        lastName: row.last_name ?? "",
        photoUrl: row.photo_url,
        promotion: row.annee_diplomation,
        schoolName: pickOne(row.schools)?.name ?? null,
        sportName: pickOne(row.sports)?.nom ?? null,
        positionName: pos?.nom ?? null,
        positionAbbr: pos?.abreviation ?? null,
        verified: row.verified === true,
        recruitmentStatus: row.statut_recrutement_override,
        coteGlobaleEntraineur: row.cote_globale_entraineur,
        profileCompletion: row.profile_completion,
      };
    },
    enabled: !!athleteId,
    staleTime: 60 * 1000,
  });
}
