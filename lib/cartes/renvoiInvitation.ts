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

/** Sans courriel (texto de l'app, recette 1.4.4) : le formulaire
 *  d'inscription, sans adresse pré-remplie. */
export function lienInscription(courriel: string | null | undefined): string {
  const c = courriel?.trim();
  return c
    ? `${URL_NEXUS}/auth?mode=signup&email=${encodeURIComponent(c)}`
    : `${URL_NEXUS}/auth?mode=signup`;
}

export interface ElementsRenvoi {
  prenom: string | null | undefined;
  /** Absent pour un texto envoyé au téléphone (création mobile). */
  courriel: string | null | undefined;
}

/** Règle RSEQ (correctif BP 2026-10-16) : le texte ne nomme NI le recruteur,
 *  NI le cégep, NI un coach collégial — même envoyé du téléphone du recruteur.
 *  « Salut [prénom], un recruteur collégial s'intéresse à ton profil. Crée ton
 *  compte Nexus pour qu'il puisse te suivre : [lien] ». */
export function texteRenvoi(e: ElementsRenvoi): string {
  const prenom = e.prenom?.trim();
  const salut = prenom ? `Salut ${prenom},` : "Salut,";
  return `${salut} un recruteur collégial s'intéresse à ton profil. Crée ton compte Nexus pour qu'il puisse te suivre : ${lienInscription(e.courriel)}`;
}

/** Lien qui ouvre l'app Messages, numéro et texte posés : le recruteur n'a
 *  plus qu'à appuyer sur Envoyer (création mobile, recette 1.4.4). iOS lit
 *  le corps après « & », Android après « ? ». Nexus n'envoie RIEN au numéro. */
export function lienSms(telephone: string, corps: string, ios: boolean): string {
  return `sms:${telephone}${ios ? "&" : "?"}body=${encodeURIComponent(corps)}`;
}

/** La phrase d'historique, conjuguée à qui la lit. */
export function phraseRenvoi(estMoi: boolean): string {
  return estMoi
    ? "a renvoyé l'invitation par ton propre canal"
    : "a renvoyé l'invitation par son propre canal";
}
