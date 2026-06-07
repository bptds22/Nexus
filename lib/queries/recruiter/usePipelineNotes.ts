/* ═══════════════════════════════════════════════════════════════
   usePipelineNotes — TanStack hook (iter 5.3b)
   Notes du recruteur courant sur un athlète donné, on-demand
   (enabled uniquement quand athleteId est fourni). staleTime 30s
   pour permettre la collaboration entre recruteurs.
═══════════════════════════════════════════════════════════════ */

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useCurrentUser } from "@/lib/queries/shared/useCurrentUser";

export interface PipelineNoteRow {
  id: string;
  content: string;
  created_at: string;
}

export function usePipelineNotes(athleteId: string | null) {
  const { data: currentUser } = useCurrentUser();
  const userId = currentUser?.authUser.id;

  return useQuery<PipelineNoteRow[]>({
    queryKey: ["pipeline-notes", userId, athleteId],
    queryFn: async (): Promise<PipelineNoteRow[]> => {
      if (!userId || !athleteId) return [];
      const supabase = createClient();
      const { data, error } = await supabase
        .from("recruiter_notes")
        .select("id, content, created_at")
        .eq("recruiter_id", userId)
        .eq("athlete_id", athleteId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as PipelineNoteRow[];
    },
    enabled: !!userId && !!athleteId,
    staleTime: 30 * 1000,
  });
}
