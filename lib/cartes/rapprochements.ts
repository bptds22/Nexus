/* ═══════════════════════════════════════════════════════════════
   rapprochements — lot D : « ce profil semble être ta carte ».

   La base décide et cloisonne (migration lot_d_rapprochement) :
   rapprochements_unite() ne rend que les propositions OUVERTES de l'unité
   de l'appelant (Pro), identité relue au moment de l'affichage, jamais un
   athlète masqué ni déjà dans le processus de l'unité. Refuser marque la
   paire pour toujours, pour toute l'unité (refuser_rapprochement).
═══════════════════════════════════════════════════════════════ */

import { useQuery } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { useCurrentUser } from "@/lib/queries/shared/useCurrentUser";

export interface Rapprochement {
  id: string;
  force: "FORTE" | "MOYENNE" | "FAIBLE";
  critere: "COURRIEL" | "COURRIEL_PARENT" | "EQUIPE" | "EQUIPE_PROCHE" | "ECOLE" | "ECOLE_PROCHE";
  promotion_concorde: boolean | null;
  cree_le: string;
  carte_id: string;
  carte_prenom: string;
  carte_nom: string;
  carte_equipe: string | null;
  carte_ecole: string | null;
  carte_promotion: number | null;
  carte_position: string | null;
  carte_courriel_present: boolean;
  athlete_id: string;
  athlete_prenom: string;
  athlete_nom: string;
  athlete_ecole: string | null;
  athlete_equipes: string | null;
  athlete_promotion: number | null;
  athlete_position: string | null;
  athlete_photo_url: string | null;
}

/** Clé sous « rapprochements » : dans CLES_TABLEAU_BLANC, jamais persistée,
 *  relue par toute écriture du tableau blanc. */
export const CLE_RAPPROCHEMENTS = "rapprochements";

export async function lireRapprochements(supabase: SupabaseClient): Promise<Rapprochement[]> {
  const { data, error } = await supabase.rpc("rapprochements_unite");
  if (error) throw error;
  return (data ?? []) as Rapprochement[];
}

export async function refuserRapprochement(supabase: SupabaseClient, id: string) {
  const { error } = await supabase.rpc("refuser_rapprochement", { p_id: id });
  if (error) console.error("[rapprochements] refus :", error.message);
  return error;
}

/** Libellé de la raison, pour le recruteur. */
export function raisonRapprochement(r: Pick<Rapprochement, "critere">): string {
  switch (r.critere) {
    case "COURRIEL": return "Même courriel";
    case "COURRIEL_PARENT": return "Même courriel de parent, prénom compatible";
    case "EQUIPE": return "Même nom, même équipe";
    case "EQUIPE_PROCHE": return "Nom proche, prénom compatible, même équipe";
    case "ECOLE": return "Même nom, même école, même sport";
    case "ECOLE_PROCHE": return "Nom proche, prénom compatible, même école, même sport";
  }
}

/** Les propositions ouvertes de l'unité. Rien pour un compte gratuit (la
 *  base rend zéro ligne) ; on n'interroge même pas sans utilisateur. */
export function useRapprochements(enabled = true) {
  const { data: currentUser } = useCurrentUser();
  const moi = currentUser?.authUser.id ?? null;
  return useQuery<Rapprochement[]>({
    queryKey: [CLE_RAPPROCHEMENTS, moi],
    enabled: !!moi && enabled,
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchInterval: 60 * 1000,
    queryFn: () => lireRapprochements(createClient()),
  });
}
