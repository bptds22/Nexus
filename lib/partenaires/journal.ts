/* Journal Loi 25 du portail partenaire — vues de fiche et téléchargements de carte.

   Une seule porte, web ET appli : la fonction en base `partenaire_journaliser`
   (20261016150000). Elle remplace les routes Next /api/partner/*, qu'une appli
   en export statique n'embarque pas. Mêmes gardes que les routes : session,
   partenaire APPROUVÉ de la session, athlète admissible ; un refus n'écrit rien. */

import type { SupabaseClient } from "@supabase/supabase-js";

export type FormatCarte = "publication" | "story";

/** Vue de fiche : jamais bloquante (un journal qui échoue n'empêche pas de lire). */
export async function journaliserVue(supabase: SupabaseClient, athleteId: string): Promise<void> {
  const { error } = await supabase.rpc("partenaire_journaliser", { p_athlete_id: athleteId, p_action: "VUE" });
  if (error) console.warn(`[partenaire] journal de vue : ${error.message}`);
}

/** Téléchargement de carte : AVANT la carte. null = journalisé, sinon le message
 *  à montrer — on ne livre pas une carte qu'on ne peut pas tracer. */
export async function journaliserTelechargement(
  supabase: SupabaseClient,
  athleteId: string,
  format: FormatCarte,
): Promise<string | null> {
  const { error } = await supabase.rpc("partenaire_journaliser", {
    p_athlete_id: athleteId, p_action: "TELECHARGEMENT", p_format: format,
  });
  if (!error) return null;
  console.error(`[partenaire] journal de téléchargement : ${error.message}`);
  if (/athlète non disponible/.test(error.message)) return "Cet athlète n'est pas disponible pour les partenaires.";
  if (/partenaire non approuvé/.test(error.message)) return "Accès refusé — partenaire non approuvé.";
  return "Le téléchargement n'a pas pu être enregistré. Réessaie.";
}
