/* ═══════════════════════════════════════════════════════════════
   useListNotes — TanStack hook (iter 7.18 Sprint 3)
   Feed des notes de liste (table recruiter_list_notes) pour la liste
   courante, scoped recruiter_id+list_id. ORDER created_at DESC (feed
   récent en haut). queryKey ["list-notes", listId, userId].
   staleTime 30s (cohérent avec usePipelineNotes).
═══════════════════════════════════════════════════════════════ */

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useCurrentUser } from "@/lib/queries/shared/useCurrentUser";

export interface ListNoteRow {
  id: string;
  content: string;
  created_at: string;
}

export function useListNotes(listId: string | null) {
  const { data: currentUser } = useCurrentUser();
  const userId = currentUser?.authUser.id;

  return useQuery<ListNoteRow[]>({
    queryKey: ["list-notes", listId, userId],
    queryFn: async (): Promise<ListNoteRow[]> => {
      if (!userId || !listId) return [];
      const supabase = createClient();
      const { data, error } = await supabase
        .from("recruiter_list_notes")
        .select("id, content, created_at")
        .eq("recruiter_id", userId)
        .eq("list_id", listId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ListNoteRow[];
    },
    enabled: !!userId && !!listId,
    staleTime: 30 * 1000,
  });
}
