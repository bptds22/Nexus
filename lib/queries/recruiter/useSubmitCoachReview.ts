/* ═══════════════════════════════════════════════════════════════
   useSubmitCoachReview — TanStack mutation (iter 7.8e — modèle A)
   UNE review par couple (recruteur, coach). Upsert :
    - existingId fourni  → UPDATE cette row (incluant athlete_id de contexte
      mis à jour avec l'athlète du thread courant).
    - existingId null    → INSERT, avec athlete_id de contexte. La contrainte
      UNIQUE(recruiter_id, coach_id) protège contre 2 inserts ; l'erreur
      Postgres 23505 surface dans le caller.
   Optimistic update sur ["my-coach-review", coachId, userId].
   Invalidate la réputation globale ["coach-reputation", coachId] au settle.
═══════════════════════════════════════════════════════════════ */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useCurrentUser } from "@/lib/queries/shared/useCurrentUser";
import type { MyCoachReview } from "@/lib/queries/recruiter/useMyCoachReview";

export interface SubmitReviewInput {
  coachId: string;
  /** Contexte (athlète du thread courant). Stocké comme dernière review faite "à propos de" — N'ENTRE PAS dans l'unicité. */
  athleteId: string | null;
  qualite_profils: number;
  reactivite: number;
  honnetete_evaluations: number;
  professionnalisme: number;
  recommande: boolean;
  commentaire: string;
  existingId: string | null;
}

export function useSubmitCoachReview() {
  const queryClient = useQueryClient();
  const { data: currentUser } = useCurrentUser();
  const userId = currentUser?.authUser.id;

  return useMutation({
    mutationFn: async (input: SubmitReviewInput) => {
      if (!userId) throw new Error("Not authenticated");
      const supabase = createClient();
      const avg =
        (input.qualite_profils +
          input.reactivite +
          input.honnetete_evaluations +
          input.professionnalisme) / 4;
      const payload = {
        recruiter_id: userId,
        coach_id: input.coachId,
        athlete_id: input.athleteId,
        qualite_profils: input.qualite_profils,
        reactivite: input.reactivite,
        honnetete_evaluations: input.honnetete_evaluations,
        professionnalisme: input.professionnalisme,
        note_globale: Math.round(avg * 10) / 10,
        recommande: input.recommande,
        commentaire: input.commentaire.trim() || null,
      };
      if (input.existingId) {
        const { error } = await supabase
          .from("coach_reviews")
          .update(payload)
          .eq("id", input.existingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("coach_reviews").insert(payload);
        if (error) throw error;
      }
    },
    onMutate: async (input) => {
      const queryKey = ["my-coach-review", input.coachId, userId];
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<MyCoachReview | null>(queryKey);
      const avg =
        (input.qualite_profils +
          input.reactivite +
          input.honnetete_evaluations +
          input.professionnalisme) / 4;
      const optimistic: MyCoachReview = {
        id: previous?.id ?? `temp-${Date.now()}`,
        qualite_profils: input.qualite_profils,
        reactivite: input.reactivite,
        honnetete_evaluations: input.honnetete_evaluations,
        professionnalisme: input.professionnalisme,
        note_globale: Math.round(avg * 10) / 10,
        recommande: input.recommande,
        commentaire: input.commentaire.trim() || null,
        athlete_id: input.athleteId,
        created_at: previous?.created_at ?? new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      queryClient.setQueryData<MyCoachReview | null>(queryKey, optimistic);
      return { previous, queryKey };
    },
    onError: (_err, _input, context) => {
      if (context?.previous !== undefined && context?.queryKey) {
        queryClient.setQueryData(context.queryKey, context.previous);
      }
    },
    onSettled: (_data, _err, input) => {
      const queryKey = ["my-coach-review", input.coachId, userId];
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ["coach-reputation", input.coachId] });
    },
  });
}
