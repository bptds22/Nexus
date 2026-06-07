/* ═══════════════════════════════════════════════════════════════
   useRemoveFromPipeline — TanStack mutation (iter 6.1a)
   DELETE de la row pipeline. Remplace l'UPDATE stage='RETIRE' qui
   échouait silencieusement à cause de chk_recruiter_pipeline_stage
   (qui exclut RETIRE de l'enum des stages valides).

   ⚠️ NE TOUCHE PAS à recruiter_favorites — favorites ↔ pipeline sont
   décorrélés sur le DELETE (cf. migration 20260516120000). L'athlète
   reste en favori si l'utilisateur veut le re-ajouter au pipeline
   plus tard, ce sera via le re-favori (qui re-crée une row pipeline
   à IDENTIFIE via le trigger trg_fav_insert_to_pipeline).
═══════════════════════════════════════════════════════════════ */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useCurrentUser } from "@/lib/queries/shared/useCurrentUser";

export function useRemoveFromPipeline() {
  const queryClient = useQueryClient();
  const { data: currentUser } = useCurrentUser();

  return useMutation({
    mutationFn: async ({ cardId }: { cardId: string }) => {
      const userId = currentUser?.profile.id;
      if (!userId) throw new Error("Not authenticated");
      const supabase = createClient();

      const { error } = await supabase
        .from("recruiter_pipeline")
        .delete()
        .eq("athlete_id", cardId)
        .eq("recruiter_id", userId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pipeline"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard", "kpi"] });
    },
  });
}
