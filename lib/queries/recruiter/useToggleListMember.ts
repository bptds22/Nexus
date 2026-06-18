/* ═══════════════════════════════════════════════════════════════
   useToggleListMember — TanStack mutation (iter 7.23 Sprint 4)
   Toggle de la présence d'un athlète dans une liste :
    - isCurrentlyMember=true  → DELETE recruiter_list_members (couple).
    - isCurrentlyMember=false → INSERT recruiter_list_members.
   Optimistic update sur ["athlete-list-membership", athleteId, userId]
   (Set toggle). Revert si erreur. Au settle, invalidate aussi
   ["list-athletes", listId] (carte détail) + ["recruiter-lists", userId]
   (count sur l'Index).

   ⚠️ Garde anti-temp-id (leçon 7.22) : refuse les listId qui commencent
   par "temp-" (optimistic de useCreateList encore en vol). L'INSERT
   atteindrait sinon Postgres avec un UUID invalide.
═══════════════════════════════════════════════════════════════ */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useCurrentUser } from "@/lib/queries/shared/useCurrentUser";

export interface ToggleListMemberInput {
  listId: string;
  athleteId: string;
  isCurrentlyMember: boolean;
}

export function useToggleListMember() {
  const queryClient = useQueryClient();
  const { data: currentUser } = useCurrentUser();
  const userId = currentUser?.authUser.id;

  return useMutation({
    mutationFn: async (input: ToggleListMemberInput): Promise<void> => {
      if (!userId) throw new Error("Not authenticated");
      if (input.listId.startsWith("temp-")) {
        // Liste fraîchement créée pas encore persistée — useCreateList n'a pas
        // encore résolu et remplacé son temp-id par le vrai UUID. Refuser
        // gracieusement pour ne pas envoyer "temp-XXX" à Postgres.
        throw new Error("Liste en cours de création, réessaie dans un instant.");
      }
      const supabase = createClient();
      if (input.isCurrentlyMember) {
        const { error } = await supabase
          .from("recruiter_list_members")
          .delete()
          .eq("list_id", input.listId)
          .eq("athlete_id", input.athleteId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("recruiter_list_members")
          .insert({ list_id: input.listId, athlete_id: input.athleteId });
        if (error) throw error;
      }
    },
    onMutate: async (input) => {
      const queryKey = ["athlete-list-membership", input.athleteId, userId];
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<Set<string>>(queryKey);
      queryClient.setQueryData<Set<string>>(queryKey, (prev) => {
        const next = new Set(prev ?? []);
        if (input.isCurrentlyMember) {
          next.delete(input.listId);
        } else {
          next.add(input.listId);
        }
        return next;
      });
      return { previous, queryKey };
    },
    onError: (_err, _input, context) => {
      if (context?.previous !== undefined && context?.queryKey) {
        queryClient.setQueryData(context.queryKey, context.previous);
      }
    },
    onSettled: (_data, _err, input) => {
      queryClient.invalidateQueries({
        queryKey: ["athlete-list-membership", input.athleteId, userId],
      });
      // Rafraîchir la liste des athlètes dans la liste affectée + le compteur
      // sur l'Index Listes (utilise athleteCount calculé client dans Sprint 1).
      queryClient.invalidateQueries({ queryKey: ["list-athletes", input.listId] });
      queryClient.invalidateQueries({ queryKey: ["recruiter-lists", userId] });
    },
  });
}
