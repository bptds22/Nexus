/* Recruteur universitaire (chantier cégep, lots D2b et D3b — décisions BP 2026-10-28) : les règles web de
   son inscription et de son portail, regroupées ici pour être testées. La base reste l'autorité :
   claim_signup_role et finish_recruiter_onboarding refusent l'université sous OFF (D2a). Il voit tous les
   athlètes, comme un recruteur collégial, plus les cégépiens sous ON (Q8 annulée, D3c).

   Le formulaire universitaire ne montre que les universités (RPC universites_inscription) et les équipes de
   l'université choisie (RPC equipes_universite_inscription) : les policies, elles, ne lui montrent que SA
   propre université, une fois inscrit.

   Portail (D3b, décisions Q1-Q3) : « Mon université » = Recruteurs + Réassignation ; carte des matchs : même
   défaut que le recruteur collégial (Q1 revue). « Ma page » rouverte au lot D5b : la page de SON université
   (/universite/[école]), sans pages d'équipes (Q5) — la base n'accepte l'écriture que sous ON (D5a). */

/** Le compte est-il un recruteur universitaire (users.context) ? */
export function estRecruteurUniversitaire(profil: { context?: string | null } | null | undefined): boolean {
  return profil?.context === "universitaire";
}

/** Pages du portail recruteur propres au cégep, fermées au recruteur universitaire (Q2, Q3). */
const PAGES_CEGEP_SEULEMENT = ["/recruteur/cegep/stats", "/recruteur/cegep/recrues", "/recruteur/cegep/entraineurs"];

/** La page (pathname déjà sans « / » final) est-elle fermée au recruteur universitaire ? */
export function pageFermeeUniversitaire(chemin: string): boolean {
  if (chemin === "/recruteur/cegep") return true;
  return PAGES_CEGEP_SEULEMENT.some((p) => chemin === p || chemin.startsWith(p + "/"));
}

/** Contexte du recruteur demandé par l'URL (callback OAuth) : universitaire seulement sous ON. */
export function contexteRecruteurDemande(param: string | null | undefined, lancementUniversitaire: boolean): "universitaire" | "collegial" {
  return param === "universitaire" && lancementUniversitaire ? "universitaire" : "collegial";
}

/** Page d'arrivée d'un recruteur inscrit : son portail (adapté au recruteur universitaire depuis D3b). */
export function destinationRecruteur(_context: string | null | undefined): string {
  return "/recruteur/tableau-de-bord";
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
