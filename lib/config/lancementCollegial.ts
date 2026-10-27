/* Interrupteur du lancement collégial (chantier cégep, lot C0 en base, lot C1 au web — décisions BP
   2026-10-27).

   Une ligne d'`app_settings` : « lancement_collegial » (BOOLEAN), posée à false par la migration
   20261027210000 et éditable dans /admin/settings. Elle commande :
     · côté base, le verrou : un nouvel ancrage à un cégep et un nouveau rattachement à une équipe de
       cégep sont refusés tant qu'elle est OFF (trigger verrou_lancement_collegial — c'est LUI qui
       protège, pas ce fichier) ;
     · côté web, ce qui ne doit pas se montrer avant le lancement : les cégeps dans le sélecteur d'école
       de l'inscription athlète, la question « Année où tu finis ton cégep », le bandeau « Les cégeps
       sont maintenant sur Nexus ! ».

   OFF si la clé est absente, illisible ou si la lecture échoue : avant le lancement, le doute cache.
   Même lecture que lancement_collegial_actif() en SQL (« true », casse et espaces ignorés). */

import type { SupabaseClient } from "@supabase/supabase-js";
import { lancementCivilDepuisValeur } from "@/lib/config/lancementCivil";

export const CLE_LANCEMENT_COLLEGIAL = "lancement_collegial";

/** Valeur brute d'`app_settings.value` → ON seulement pour « true » (même règle que le civil). */
export const lancementCollegialDepuisValeur = lancementCivilDepuisValeur;

/** Lit l'interrupteur. Jamais d'exception : toute erreur vaut OFF. */
export async function lireLancementCollegial(supabase: SupabaseClient): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", CLE_LANCEMENT_COLLEGIAL)
      .maybeSingle();
    if (error || !data) return false;
    return lancementCollegialDepuisValeur((data as { value: string | null }).value);
  } catch {
    return false;
  }
}
