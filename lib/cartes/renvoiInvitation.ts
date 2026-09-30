/* ═══════════════════════════════════════════════════════════════
   renvoiInvitation — « Renvoyer l'invitation » par le canal du
   recruteur (décision BP 2026-09-30), pur et testé.

   Le bouton apparaît TOUJOURS quand la carte a un courriel, quel que
   soit l'état de l'invitation automatique : c'est ce qui ne révèle
   rien. Nexus n'envoie rien — le texte part par la feuille de partage
   (mobile) ou le presse-papiers (ordinateur) ; seule la trace est
   écrite (journaliser_renvoi_invitation).

   Le lien d'inscription est celui du courriel automatique
   (send-invitation-carte/email.ts) : adresse pré-remplie.
═══════════════════════════════════════════════════════════════ */

export const URL_NEXUS = "https://nexussports.ca";

export function lienInscription(courriel: string): string {
  return `${URL_NEXUS}/auth?mode=signup&email=${encodeURIComponent(courriel.trim())}`;
}

export interface ElementsRenvoi {
  prenom: string | null | undefined;
  recruteur: string | null | undefined;
  cegep: string | null | undefined;
  courriel: string;
}

/** « Salut [prénom], je suis [recruteur] du [cégep]. On utilise Nexus pour
 *  notre recrutement — crée ton profil ici : [lien] ». Chaque morceau absent
 *  se retire proprement, sans laisser de trou ni de crochet. */
export function texteRenvoi(e: ElementsRenvoi): string {
  const prenom = e.prenom?.trim();
  const recruteur = e.recruteur?.trim();
  const cegep = e.cegep?.trim();
  const salut = prenom ? `Salut ${prenom},` : "Salut,";
  const qui = recruteur ? `je suis ${recruteur}` : "je suis recruteur";
  const ou = cegep ? ` du ${cegep}` : "";
  return `${salut} ${qui}${ou}. On utilise Nexus pour notre recrutement — crée ton profil ici : ${lienInscription(e.courriel)}`;
}

export type CanalRenvoi = "PARTAGE" | "COPIE";

/** Feuille de partage sur un appareil tactile qui la propose ; sinon copie.
 *  (Chrome sur Windows expose navigator.share : le tactile départage.) */
export function choisirCanal(env: { partageDispo: boolean; tactile: boolean }): CanalRenvoi {
  return env.partageDispo && env.tactile ? "PARTAGE" : "COPIE";
}

/** La phrase d'historique, conjuguée à qui la lit. */
export function phraseRenvoi(estMoi: boolean): string {
  return estMoi
    ? "a renvoyé l'invitation par ton propre canal"
    : "a renvoyé l'invitation par son propre canal";
}
