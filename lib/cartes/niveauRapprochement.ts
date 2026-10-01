/* ═══════════════════════════════════════════════════════════════
   niveauRapprochement — les TROIS niveaux affichés d'une proposition
   (décision BP 2026-09-30), pur et testé.

   · courriel identique (de la fiche, du compte ou du parent), ou courriel
     du PARENT de la carte = courriel du parent de la fiche (prénom
     compatible, décision BP 2026-09-30)
       → « Correspondance confirmée par le courriel » ;
   · téléphone identique (de la fiche ou du parent), même niveau
       → « Correspondance confirmée par le téléphone » ;
   · nom exact + même équipe
       → « Correspondance : même nom, même équipe » ;
   · carte SANS équipe (établissement sans équipe du sport) + nom exact
     + même établissement + sport de l'unité, même niveau
       → « Correspondance : même nom, même établissement » ;
   · nom proche, ou même école sans la même équipe
       → « Possiblement le même athlète », avec ce qui diffère (nom,
         équipe, promotion).

   Dans tous les cas, la fenêtre côte à côte et « Accepter » restent
   obligatoires : le système propose, le recruteur confirme.
═══════════════════════════════════════════════════════════════ */

import { normaliserNom } from "@/lib/cartes/carteProspect";

export type NiveauRapprochement = "CONFIRMEE" | "CONFIRMEE_TELEPHONE" | "MEME_NOM_EQUIPE" | "MEME_NOM_ETABLISSEMENT" | "POSSIBLE";

type Critere = "COURRIEL" | "COURRIEL_PARENT" | "COURRIEL_PARENT_CARTE" | "TELEPHONE" | "TELEPHONE_PARENT" | "EQUIPE" | "ETABLISSEMENT" | "EQUIPE_PROCHE" | "ECOLE" | "ECOLE_PROCHE";

export function niveauRapprochement(critere: Critere): NiveauRapprochement {
  if (critere === "COURRIEL" || critere === "COURRIEL_PARENT" || critere === "COURRIEL_PARENT_CARTE") return "CONFIRMEE";
  if (critere === "TELEPHONE" || critere === "TELEPHONE_PARENT") return "CONFIRMEE_TELEPHONE";
  if (critere === "EQUIPE") return "MEME_NOM_EQUIPE";
  if (critere === "ETABLISSEMENT") return "MEME_NOM_ETABLISSEMENT";
  return "POSSIBLE";
}

export function libelleNiveau(n: NiveauRapprochement): string {
  switch (n) {
    case "CONFIRMEE": return "Correspondance confirmée par le courriel";
    case "CONFIRMEE_TELEPHONE": return "Correspondance confirmée par le téléphone";
    case "MEME_NOM_EQUIPE": return "Correspondance : même nom, même équipe";
    case "MEME_NOM_ETABLISSEMENT": return "Correspondance : même nom, même établissement";
    case "POSSIBLE": return "Possiblement le même athlète";
  }
}

export interface ElementsComparables {
  carte_prenom: string;
  carte_nom: string;
  carte_equipe: string | null;
  carte_promotion: number | null;
  athlete_prenom: string;
  athlete_nom: string;
  athlete_equipes: string | null;
  athlete_promotion: number | null;
  promotion_concorde: boolean | null;
}

/** Ce qui diffère entre la carte et le profil : nom, équipe, promotion. */
export function differences(r: ElementsComparables): string[] {
  const d: string[] = [];
  const nomCarte = `${r.carte_prenom} ${r.carte_nom}`.trim();
  const nomProfil = `${r.athlete_prenom} ${r.athlete_nom}`.trim();
  if (normaliserNom(r.carte_nom) !== normaliserNom(r.athlete_nom)) {
    d.push(`Nom : « ${nomCarte} » sur la carte, « ${nomProfil} » sur Nexus`);
  }
  const equipes = (r.athlete_equipes ?? "").split(" · ").map(normaliserNom).filter(Boolean);
  if (r.carte_equipe && !equipes.includes(normaliserNom(r.carte_equipe))) {
    d.push(`Équipe : ${r.carte_equipe} sur la carte, ${r.athlete_equipes ? r.athlete_equipes : "aucune équipe"} sur Nexus`);
  }
  if (r.promotion_concorde === false) {
    d.push(`Promotion : ${r.carte_promotion} sur la carte, ${r.athlete_promotion} sur Nexus`);
  }
  return d;
}
