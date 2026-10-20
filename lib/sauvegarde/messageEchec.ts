/* Message d'échec d'une sauvegarde de profil (BP 2026-10-19).

   Défaut corrigé : plusieurs écrans écrivaient en base sans lire l'erreur, puis
   affichaient « Mis à jour ! » quoi qu'il arrive. Règle : on ne dit « Mis à jour »
   qu'après une écriture SANS erreur ; sinon, ce message. Le détail technique part
   dans la console (sérialisé : le pont Capacitor rendrait « [object Object] »). */

import { erreurLisible } from "@/lib/athlete/perimetreProtege";

export const ECHEC_SAUVEGARDE = "La sauvegarde a échoué. Vérifie ta connexion et réessaie.";

type ErreurBase = { code?: string | null; message?: string | null } | null | undefined;

/** Le message à montrer pour une erreur Supabase (et la trace en console, avec `contexte`). */
export function messageEchecSauvegarde(error: ErreurBase, contexte: string): string {
  console.error(`[${contexte}] ${erreurLisible(error)}`);
  const code = error?.code ?? "";
  const message = error?.message ?? "";
  if (code === "23514") return "Cette valeur n'est pas acceptée. Vérifie le format (un lien doit commencer par https://).";
  if (code === "42501" || message.startsWith("NEXUS:")) return "Tu ne peux pas modifier ce champ ici.";
  return ECHEC_SAUVEGARDE;
}
