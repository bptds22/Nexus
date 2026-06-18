/* ═══════════════════════════════════════════════════════════════
   useAthleteListMembership — TanStack hook (iter 7.23 Sprint 4)
   Retourne le Set<list_id> des listes du recruteur courant contenant
   cet athlète. Sert à pré-cocher les checkboxes dans AddToListSheet.
   Query : SELECT recruiter_list_members WHERE athlete_id=X scoped au
   recruteur via inner join recruiter_lists. RLS gère le filtre côté
   serveur, on ajoute la jointure pour ne lire que les listes de me.
   queryKey ["athlete-list-membership", athleteId, userId], staleTime 30s.
═══════════════════════════════════════════════════════════════ */

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useCurrentUser } from "@/lib/queries/shared/useCurrentUser";

export function useAthleteListMembership(athleteId: string | null) {
  const { data: currentUser } = useCurrentUser();
  const userId = currentUser?.authUser.id;

  return useQuery<Set<string>>({
    queryKey: ["athlete-list-membership", athleteId, userId],
    queryFn: async (): Promise<Set<string>> => {
      if (!userId || !athleteId) return new Set();
      const supabase = createClient();
      // RLS sur recruiter_list_members filtre déjà via la jointure list.recruiter_id = me.
      // On retourne uniquement les list_id.
      const { data, error } = await supabase
        .from("recruiter_list_members")
        .select("list_id")
        .eq("athlete_id", athleteId);
      if (error) throw error;
      return new Set((data ?? []).map((r) => r.list_id as string));
    },
    enabled: !!userId && !!athleteId,
    staleTime: 30 * 1000,
  });
}
