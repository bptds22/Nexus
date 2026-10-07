/* ═══════════════════════════════════════════════════════════════
   useAddPipelineNote — TanStack mutation (iter 6.1a)
   Insert d'une note dans recruiter_notes (table partagée avec le
   profil athlète). La note est signée (recruiter_id = soi) et lue par
   toute l'unité ; toute écriture relit le tableau blanc.
═══════════════════════════════════════════════════════════════ */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useCurrentUser } from "@/lib/queries/shared/useCurrentUser";
import { invaliderTableauBlanc } from "@/lib/queries/tableauBlanc";

export function useAddPipelineNote() {
  const queryClient = useQueryClient();
  const { data: currentUser } = useCurrentUser();

  return useMutation({
    mutationFn: async ({ athleteId, content }: { athleteId: string; content: string }) => {
      const userId = currentUser?.profile.id;
      if (!userId) throw new Error("Not authenticated");
      const trimmed = content.trim();
      if (!trimmed) throw new Error("Note vide");
      const supabase = createClient();

      const { error } = await supabase
        .from("recruiter_notes")
        .insert({
          recruiter_id: userId,
          athlete_id: athleteId,
          content: trimmed,
        });

      if (error) throw error;
    },
    // Tableau blanc (lot 2 de la 1.4.4) : la note est lue par toute l'unité
    // (fil signé, colonne « dernière note », historique) — tout est relu.
    onSuccess: () => { void invaliderTableauBlanc(queryClient); },
  });
}
