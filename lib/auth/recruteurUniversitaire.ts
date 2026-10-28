/* Recruteur universitaire (chantier cégep, lot D2b — décisions BP 2026-10-28) : les règles web de son
   inscription, regroupées ici pour être testées. La base reste l'autorité (lot D2a) : claim_signup_role
   refuse le contexte « universitaire » sous OFF, finish_recruiter_onboarding refuse une université sous OFF.

   Le formulaire universitaire ne montre que les universités (RPC universites_inscription) et les équipes de
   l'université choisie (RPC equipes_universite_inscription) : les policies, elles, ne lui montrent que SA
   propre université, une fois inscrit. Le masquage du secondaire pour lui est le lot D3. */

/** Contexte du recruteur demandé par l'URL (callback OAuth) : universitaire seulement sous ON. */
export function contexteRecruteurDemande(param: string | null | undefined, lancementUniversitaire: boolean): "universitaire" | "collegial" {
  return param === "universitaire" && lancementUniversitaire ? "universitaire" : "collegial";
}

/** Page d'arrivée d'un recruteur inscrit : le portail collégial, ou l'attente du recruteur universitaire. */
export function destinationRecruteur(context: string | null | undefined): string {
  return context === "universitaire" ? "/universitaire/en-validation" : "/recruteur/tableau-de-bord";
}

export const MESSAGE_UNIVERSITES_FERMEES = "Les universités ne sont pas encore ouvertes sur Nexus. Ça arrive bientôt.";

/** Message affiché quand finish_recruiter_onboarding refuse, selon la branche (collégiale ou universitaire). */
export function messageFinRecruteur(message: string, universitaire: boolean): string {
  const lieu = universitaire ? "Cette université" : "Ce CÉGEP";
  if (message.includes("Les universités ne sont pas encore ouvertes")) return MESSAGE_UNIVERSITES_FERMEES;
  if (message.includes("SCHOOL_REQUIRES_RESPONSABLE")) {
    return `${lieu} n'a pas encore de responsable. Choisis « C'est moi » ou « Je serai intérimaire ».`;
  }
  if (message.includes("RPRP_REQUIRED")) return "L'attestation RPRP est obligatoire pour devenir responsable.";
  if (message.includes("INVALID_UNIVERSITE")) return "Université invalide — réessaye.";
  if (message.includes("INVALID_TEAM")) return "Ce programme n'appartient pas à ton université — choisis-en un autre.";
  if (message.includes("INVALID_CEGEP")) return "CÉGEP invalide — réessaye.";
  if (message.includes("INVALID_DIRECTOR_CHOICE")) return "Choix de responsable invalide.";
  if (message.includes("NOT_AUTHENTICATED")) return "Session expirée — reconnecte-toi.";
  if (message.includes("WRONG_ROLE_OR_CONTEXT")) {
    return universitaire ? "Ce flux est réservé aux recruteurs universitaires." : "Ce flux est réservé aux recruteurs CÉGEP.";
  }
  return "Erreur lors de la finalisation — réessaye.";
}
