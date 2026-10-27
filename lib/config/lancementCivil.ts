/* Interrupteur du lancement civil soccer / futsal / basket (lot 7 civil, décision BP 2026-10-27).

   Une ligne d'`app_settings` : « lancement_civil » (BOOLEAN), posée à false par la migration
   20261027150000 et éditable dans /admin/settings. Elle commande :
     · côté base, le verrou : rejoindre une équipe civile importée est refusé tant qu'elle est OFF
       (trigger verrou_lancement_civil — c'est LUI qui protège, pas ce fichier) ;
     · côté web, ce qui ne doit pas se montrer avant le lancement : les destinations 18+ de
       « Trouve ton cégep ».

   OFF si la clé est absente, illisible ou si la lecture échoue : avant le lancement, le doute
   cache. Même lecture que lancement_civil_actif() en SQL (« true », casse et espaces ignorés). */

import type { SupabaseClient } from "@supabase/supabase-js";

export const CLE_LANCEMENT_CIVIL = "lancement_civil";

/** Valeur brute d'`app_settings.value` → ON seulement pour « true ». */
export function lancementCivilDepuisValeur(valeur: string | null | undefined): boolean {
  return typeof valeur === "string" && valeur.trim().toLowerCase() === "true";
}

/** Lit l'interrupteur. Jamais d'exception : toute erreur vaut OFF. */
export async function lireLancementCivil(supabase: SupabaseClient): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", CLE_LANCEMENT_CIVIL)
      .maybeSingle();
    if (error || !data) return false;
    return lancementCivilDepuisValeur((data as { value: string | null }).value);
  } catch {
    return false;
  }
}
