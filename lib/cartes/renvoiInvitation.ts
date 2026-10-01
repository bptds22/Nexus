/* ═══════════════════════════════════════════════════════════════
   renvoiInvitation — le lien secondaire « Copier le texte », pour le
   recruteur qui préfère son propre téléphone (décisions BP 2026-09-30),
   pur et testé.

   Présent TOUJOURS quand la carte a un courriel, quel que soit l'état
   de l'invitation automatique : c'est ce qui ne révèle rien. Ce lien-là
   n'envoie rien — le texte part par le presse-papiers ; seule la trace
   est écrite (journaliser_renvoi_invitation). Le rappel ENVOYÉ PAR
   NEXUS, lui, est dans rappelInvitation.ts.

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

/** La phrase d'historique, conjuguée à qui la lit. */
export function phraseRenvoi(estMoi: boolean): string {
  return estMoi
    ? "a renvoyé l'invitation par ton propre canal"
    : "a renvoyé l'invitation par son propre canal";
}
