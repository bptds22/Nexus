/* ═══════════════════════════════════════════════════════════════
   Lectures des cartes prospect pour le panneau (lot C) : notes signées et
   journal. Clés sous ["pipeline-notes"] et ["pipeline-historique"] : dans
   la liste tableauBlanc.ts, donc jamais persistées et invalidées par toute
   écriture du tableau blanc.
═══════════════════════════════════════════════════════════════ */

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

export interface NoteCarte {
  id: string;
  content: string;
  created_at: string;
  recruiter_id: string | undefined;
}

export function useNotesCarte(carteId: string | null) {
  return useQuery<NoteCarte[]>({
    queryKey: ["pipeline-notes", "carte", carteId],
    enabled: !!carteId,
    staleTime: 0,
    queryFn: async () => {
      const { data, error } = await createClient()
        .from("cartes_prospect_notes")
        .select("id, contenu, created_at, auteur")
        .eq("carte_id", carteId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return ((data ?? []) as { id: string; contenu: string; created_at: string; auteur: string | null }[])
        .map((n) => ({ id: n.id, content: n.contenu, created_at: n.created_at, recruiter_id: n.auteur ?? undefined }));
    },
  });
}

export interface GesteCarte {
  id: string;
  action: string;
  details: Record<string, unknown>;
  acteur: string | null;
  created_at: string;
}

export function useJournalCarte(carteId: string | null) {
  return useQuery<GesteCarte[]>({
    queryKey: ["pipeline-historique", "carte", carteId],
    enabled: !!carteId,
    staleTime: 0,
    queryFn: async () => {
      const { data, error } = await createClient()
        .from("cartes_prospect_journal")
        .select("id, action, details, acteur, created_at")
        .eq("carte_id", carteId!)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as GesteCarte[];
    },
  });
}
