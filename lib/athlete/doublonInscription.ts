/* Doublon probable à l'inscription athlète (D1, 2026-10-15) — tronc partagé web / mobile.

   `inscription_doublon_possible` : même nom normalisé + même date de naissance
   qu'une fiche active. La base ne rend qu'un code, rien de l'autre fiche. On
   avertit une fois, on ne bloque jamais : le second « Suivant » enregistre (et
   le trigger `trg_doublons_probables_noter` note la paire pour l'admin). */

import type { SupabaseClient } from "@supabase/supabase-js";
import { erreurLisible } from "@/lib/athlete/perimetreProtege";

export type DoublonInscription = "COMPTE" | "FICHE_COACH";

/** Une erreur de la vérification n'arrête jamais l'inscription : null. */
export async function verifierDoublonInscription(
  supabase: SupabaseClient,
  prenom: string,
  nom: string,
  dateNaissance: string | null,
): Promise<DoublonInscription | null> {
  const { data, error } = await supabase.rpc("inscription_doublon_possible", {
    p_prenom: prenom.trim(),
    p_nom: nom.trim(),
    p_date_naissance: dateNaissance || null,
  });
  if (error) {
    console.error(`[Onboarding doublon] ${erreurLisible(error)}`);
    return null;
  }
  return data === "COMPTE" || data === "FICHE_COACH" ? data : null;
}

export const TEXTES_DOUBLON: Record<DoublonInscription, { titre: string; detail: string }> = {
  COMPTE: {
    titre: "Tu as peut-être déjà un compte.",
    detail: "Connecte-toi avec ton autre adresse, ou continue.",
  },
  FICHE_COACH: {
    titre: "Ton entraîneur a peut-être déjà créé ta fiche.",
    detail: "Demande-lui le lien d'invitation pour la récupérer, ou continue.",
  },
};

export const TEXTE_AUTRE_ADRESSE = "Me connecter avec mon autre adresse";

/* Un compte par sport faisait un doublon (cas relevé en prod le 2026-10-15) :
   une même fiche porte plusieurs équipes, dans « Parcours d'équipes » du profil. */
export const PHRASE_PLUSIEURS_SPORTS = {
  phrase: "Tu joues dans plusieurs sports ? Ajoute une équipe à ta fiche, pas un 2e compte.",
  ou: "Après ton inscription : Profil → Parcours d'équipes.",
} as const;
