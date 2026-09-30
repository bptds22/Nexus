/* ═══════════════════════════════════════════════════════════════
   fusions — lot E : accepter une proposition = fusionner la carte
   prospect avec le vrai profil.

   La base fait tout (migration lot_e_fusion) : fusionner_carte transfère
   le suivi par la ligne de l'acteur, masque la carte, écrit UNE ligne de
   journal ; annuler_fusion (7 jours) retire ce qui n'a pas bougé et garde
   ce qui a été modifié depuis, et le dit ; fusions_athlete rend les
   fusions de l'unité sur un athlète (Pro de l'unité seulement).
═══════════════════════════════════════════════════════════════ */

import { useQuery } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { useCurrentUser } from "@/lib/queries/shared/useCurrentUser";

export interface Fusion {
  id: string;
  carte_libelle: string;
  acteur: string | null;
  fusionnee_le: string;
  etat: "ACTIVE" | "ANNULEE" | "DEFINITIVE";
  annulable_jusqu_au: string;
  annulable: boolean;
  annulee_par: string | null;
  annulee_le: string | null;
  conserves: string[] | null;
}

export interface ResultatAnnulation {
  conserves: string[];
  retires: string[];
}

/** Message lisible pour une erreur des RPC de fusion. */
function messageErreur(message: string | undefined, defaut: string): string {
  if (!message) return defaut;
  if (message.includes("plus annulable")) return "Cette fusion n'est plus annulable (plus de 7 jours, ou déjà annulée).";
  if (message.includes("aucune proposition")) return "Cette proposition n'est plus ouverte.";
  if (message.includes("profil introuvable")) return "Ce profil n'est plus disponible.";
  if (message.includes("carte introuvable")) return "Cette carte n'est plus disponible.";
  return defaut;
}

/** Fusionne ; rend un message d'erreur, ou null si c'est fait. */
export async function fusionnerCarte(supabase: SupabaseClient, carteId: string, athleteId: string): Promise<string | null> {
  const { error } = await supabase.rpc("fusionner_carte", { p_carte: carteId, p_athlete: athleteId });
  if (!error) return null;
  console.error("[fusions] fusion :", error.message);
  return messageErreur(error.message, "La fusion n'a pas pu être faite. Réessaie.");
}

export async function annulerFusion(
  supabase: SupabaseClient, fusionId: string,
): Promise<{ resultat: ResultatAnnulation | null; erreur: string | null }> {
  const { data, error } = await supabase.rpc("annuler_fusion", { p_fusion: fusionId });
  if (error) {
    console.error("[fusions] annulation :", error.message);
    return { resultat: null, erreur: messageErreur(error.message, "L'annulation n'a pas pu être faite. Réessaie.") };
  }
  const r = (data ?? {}) as Partial<ResultatAnnulation>;
  return { resultat: { conserves: r.conserves ?? [], retires: r.retires ?? [] }, erreur: null };
}

/** Clé sous « pipeline-historique » : invalidée avec le tableau blanc. */
export function useFusionsAthlete(athleteId: string | null, enabled = true) {
  const { data: currentUser } = useCurrentUser();
  const moi = currentUser?.authUser.id ?? null;
  return useQuery<Fusion[]>({
    queryKey: ["pipeline-historique", "fusions", moi, athleteId],
    enabled: !!moi && !!athleteId && enabled,
    staleTime: 0,
    queryFn: async () => {
      const { data, error } = await createClient().rpc("fusions_athlete", { p_athlete: athleteId });
      if (error) throw error;
      return (data ?? []) as Fusion[];
    },
  });
}
