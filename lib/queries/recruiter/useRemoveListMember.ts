/* ═══════════════════════════════════════════════════════════════
   useRemoveListMember — TanStack mutation (iter 7.17 Sprint 2)
   DELETE recruiter_list_members WHERE list_id + athlete_id (UNIQUE pair).
   Optimistic remove de l'athlète de ["list-athletes", listId]. Revert
   au snapshot si erreur. Invalidate aussi ["recruiter-lists", userId]
   pour rafraîchir le compteur affiché sur l'Index.
═══════════════════════════════════════════════════════════════ */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useCurrentUser } from "@/lib/queries/shared/useCurrentUser";
import type { ListMetadata, ListAthlete } from "@/lib/queries/recruiter/useListAthletes";

interface RemoveInput {
  listId: string;
  athleteId: string;
  /** memberId facultatif — si fourni, DELETE par id (plus fiable). Sinon DELETE par couple. */
  memberId?: string;
}

interface QueryCacheShape {
  list: ListMetadata;
  athletes: ListAthlete[];
}

export function useRemoveListMember() {
  const queryClient = useQueryClient();
  const { data: currentUser } = useCurrentUser();
  const userId = currentUser?.authUser.id;

  return useMutation({
    mutationFn: async (input: RemoveInput): Promise<void> => {
      const supabase = createClient();
      if (input.memberId) {
        const { error } = await supabase
          .from("recruiter_list_members")
          .delete()
          .eq("id", input.memberId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("recruiter_list_members")
          .delete()
          .eq("list_id", input.listId)
          .eq("athlete_id", input.athleteId);
        if (error) throw error;
      }
    },
    onMutate: async (input) => {
      const queryKey = ["list-athletes", input.listId];
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<QueryCacheShape | null>(queryKey);
      queryClient.setQueryData<QueryCacheShape | null>(queryKey, (prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          athletes: prev.athletes.filter((a) => a.athleteId !== input.athleteId),
        };
      });
      return { previous, queryKey };
    },
    onError: (_err, _input, context) => {
      if (context?.previous !== undefined && context?.queryKey) {
        queryClient.setQueryData(context.queryKey, context.previous);
      }
    },
    onSettled: (_data, _err, input) => {
      queryClient.invalidateQueries({ queryKey: ["list-athletes", input.listId] });
      // Rafraîchir le compteur d'athlètes sur l'Index (carte de la liste).
      queryClient.invalidateQueries({ queryKey: ["recruiter-lists", userId] });
    },
  });
}
