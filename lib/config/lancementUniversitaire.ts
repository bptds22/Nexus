/* Interrupteur du lancement universitaire (chantier cégep, lot D0 en base, lot D2 au web — décisions BP
   2026-10-27 et 2026-10-28).

   Une ligne d'`app_settings` : « lancement_universitaire » (BOOLEAN), posée à false par la migration
   20261028000000 et éditable dans /admin/settings. Elle commande :
     · côté base, tout ce qui ouvre l'inscription du recruteur universitaire : contexte « universitaire »
       (claim_signup_role), fin d'inscription vers une université, listes du formulaire, vue de sa propre
       université (lots D0, D2a — c'est la BASE qui protège, pas ce fichier) ;
     · côté web, la carte « Recruteur universitaire » de /auth/pro : grisée « bientôt disponible » sous OFF,
       sélectionnable sous ON.

   OFF si la clé est absente, illisible ou si la lecture échoue : avant le lancement, le doute cache.
   Même lecture que lancement_universitaire_actif() en SQL (« true », casse et espaces ignorés). */

import type { SupabaseClient } from "@supabase/supabase-js";
import { lancementCivilDepuisValeur } from "@/lib/config/lancementCivil";

export const CLE_LANCEMENT_UNIVERSITAIRE = "lancement_universitaire";

/** Valeur brute d'`app_settings.value` → ON seulement pour « true » (même règle que le civil). */
export const lancementUniversitaireDepuisValeur = lancementCivilDepuisValeur;

/** Lit l'interrupteur. Jamais d'exception : toute erreur vaut OFF. */
export async function lireLancementUniversitaire(supabase: SupabaseClient): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", CLE_LANCEMENT_UNIVERSITAIRE)
      .maybeSingle();
    if (error || !data) return false;
    return lancementUniversitaireDepuisValeur((data as { value: string | null }).value);
  } catch {
    return false;
  }
}
