/* ═══════════════════════════════════════════════════════════════
   useUpsertAthleteGrade — TanStack mutation (Lot 2)
   Écrit `recruiter_athlete_grades` : pose/remplace un grade, ou le retire.

   UN SEUL HOOK POUR DEUX GESTES. `grade: null` supprime la ligne au lieu
   d'écrire une valeur nulle : la colonne est NOT NULL, et « pas de grade »
   se dit par l'absence de ligne, pas par un NULL. Deux hooks pour ça
   auraient partagé la même clé de cache, le même optimistic update et le
   même revert — c'est-à-dire tout sauf le verbe SQL.

   REQUÊTE DIRECTE SOUS RLS, aucune RPC — comme le pipeline. La table est
   propriétaire seul : `recruiter_id = auth.uid()` sur les quatre verbes,
   plus `user_has_pro()` en with check sur INSERT et UPDATE. Le `.eq(
   "recruiter_id", userId)` du DELETE est donc redondant avec la RLS ; il
   reste, comme sur useTogglePipelinePriority, pour que la requête dise
   elle-même ce qu'elle touche.

   `recruiter_id` est envoyé EXPLICITEMENT à l'upsert : la colonne n'a pas
   de DEFAULT auth.uid(), et la policy INSERT exige l'égalité. L'omettre
   ferait échouer l'écriture sur une violation NOT NULL avant même la RLS.

   `onConflict` cible la contrainte UNIQUE (recruiter_id, athlete_id) : le
   second grade sur le même athlète remplace le premier au lieu de lever
   23505. `updated_at` est reposé par le trigger trg_grades_updated_at, pas
   par le client.

   Calqué sur useUpdateNextAction / useTogglePipelinePriority : optimistic
   update du cache ["pipeline", userId] en onMutate, revert en onError,
   invalidation en onSettled.
═══════════════════════════════════════════════════════════════ */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useCurrentUser } from "@/lib/queries/shared/useCurrentUser";
import type { PipelineData } from "@/lib/queries/recruiter/usePipelineCards";
import type { Grade } from "@/lib/config/grades";

export function useUpsertAthleteGrade() {
  const queryClient = useQueryClient();
  const { data: currentUser } = useCurrentUser();
  const userId = currentUser?.profile.id;
  const queryKey = ["pipeline", userId];

  return useMutation({
    /** `grade: null` = retirer le grade (DELETE de la ligne). */
    mutationFn: async ({ athleteId, grade }: { athleteId: string; grade: Grade | null }) => {
      if (!userId) throw new Error("Not authenticated");
      const supabase = createClient();

      if (grade === null) {
        const { error } = await supabase
          .from("recruiter_athlete_grades")
          .delete()
          .eq("athlete_id", athleteId)
          .eq("recruiter_id", userId);
        if (error) throw error;
        return;
      }

      const { error } = await supabase
        .from("recruiter_athlete_grades")
        .upsert(
          { recruiter_id: userId, athlete_id: athleteId, grade },
          { onConflict: "recruiter_id,athlete_id" },
        );
      if (error) throw error;
    },
    onMutate: async ({ athleteId, grade }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<PipelineData>(queryKey);
      queryClient.setQueryData<PipelineData>(queryKey, (old) => {
        if (!old) return old;
        return {
          ...old,
          cards: old.cards.map((c) =>
            c.id === athleteId ? { ...c, grade } : c
          ),
        };
      });
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["pipeline"] });
    },
  });
}
