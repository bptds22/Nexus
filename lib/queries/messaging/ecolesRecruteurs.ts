/* École des recruteurs avec qui le compte connecté a une conversation (chantier cégep, lot D3d — décision BP
   2026-10-28, Q4). Les universités restent masquées en base (policies universites_masquees) : un athlète ou un coach
   ne lit pas l'école d'un recruteur universitaire, et ses messages afficheraient un nom vide. La RPC
   ecoles_recruteurs(ids) rend le nom de l'école des seuls recruteurs avec qui il parle.

   Appelée seulement pour les recruteurs dont l'école n'a pas pu être lue directement : un recruteur collégial
   garde sa lecture habituelle, aucun appel de plus. Jamais d'exception : en cas d'échec, la carte reste vide. */

import type { SupabaseClient } from "@supabase/supabase-js";

interface LigneEcoleRecruteur {
  recruiter_id: string;
  school_id: string;
  school_name: string | null;
}

/** Nom de l'école par recruteur (Map vide si rien à chercher ou si l'appel échoue). */
export async function ecolesRecruteurs(supabase: SupabaseClient, recruteurs: readonly string[]): Promise<Map<string, string>> {
  const ids = [...new Set(recruteurs.filter(Boolean))];
  const noms = new Map<string, string>();
  if (ids.length === 0) return noms;
  try {
    const { data, error } = await supabase.rpc("ecoles_recruteurs", { p_recruteurs: ids });
    if (error || !data) return noms;
    for (const l of data as LigneEcoleRecruteur[]) {
      if (l.school_name) noms.set(l.recruiter_id, l.school_name);
    }
  } catch {
    /* la carte reste vide */
  }
  return noms;
}
