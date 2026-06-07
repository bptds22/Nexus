/* ═══════════════════════════════════════════════════════════════
   useMyCoachReview — TanStack hook (iter 7.8e — modèle A restauré)
   Charge LA review du recruteur courant sur ce coach — UNE seule,
   indépendante de l'athlète (modèle A = UNIQUE(recruiter_id, coach_id)).
   athlete_id reste en DB comme contexte (dernière review faite à propos
   de) mais ne sert plus de clé.
   maybeSingle → null si pas de review pour ce coach.
   queryKey ["my-coach-review", coachId, userId].
═══════════════════════════════════════════════════════════════ */

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useCurrentUser } from "@/lib/queries/shared/useCurrentUser";

export interface MyCoachReview {
  id: string;
  qualite_profils: number | null;
  reactivite: number | null;
  honnetete_evaluations: number | null;
  professionnalisme: number | null;
  note_globale: number | null;
  recommande: boolean | null;
  commentaire: string | null;
  athlete_id: string | null;
  created_at: string;
  updated_at: string;
}

export function useMyCoachReview(coachId: string | null) {
  const { data: currentUser } = useCurrentUser();
  const userId = currentUser?.authUser.id;

  return useQuery<MyCoachReview | null>({
    queryKey: ["my-coach-review", coachId, userId],
    queryFn: async () => {
      if (!coachId || !userId) return null;
      const supabase = createClient();
      const { data, error } = await supabase
        .from("coach_reviews")
        .select("id, qualite_profils, reactivite, honnetete_evaluations, professionnalisme, note_globale, recommande, commentaire, athlete_id, created_at, updated_at")
        .eq("recruiter_id", userId)
        .eq("coach_id", coachId)
        .maybeSingle();
      if (error) throw error;
      return (data as MyCoachReview | null) ?? null;
    },
    enabled: !!coachId && !!userId,
    staleTime: 60 * 1000,
  });
}
