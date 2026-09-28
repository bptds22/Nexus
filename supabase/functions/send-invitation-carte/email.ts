// send-invitation-carte/email.ts — l'invitation envoyée à la CRÉATION d'une
// carte prospect (lot C). Séparé de index.ts pour être importable sans
// démarrer Deno.serve (test Node : lib/cartes/__tests__/invitationCarte.test.ts).
//
// Texte de BP, poli : « Un recruteur du [Cégep] utilise Nexus pour son
// recrutement et te recherche. Inscris-toi pour compléter ton profil et
// maximiser tes chances de te faire recruter. »

import { renderEmail, APP_URL } from "../_shared/emailLayout.ts";

/** renderEmail n'échappe rien (parité historique) : tout ce qui vient d'une
 *  saisie (prénom de la carte, nom du recruteur, nom du cégep) est échappé ICI. */
function echapper(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export interface DonneesInvitation {
  /** Prénom saisi sur la carte. */
  prenom: string | null;
  /** « Prénom Nom » du recruteur qui a créé la carte (null : inconnu). */
  recruteur: string | null;
  /** Nom du cégep de l'unité. */
  cegep: string;
  /** Adresse invitée — pré-remplit l'inscription. */
  courriel: string;
  /** URL absolue et signée de /desabonnement. */
  desabonnementUrl: string;
}

export function sujet(cegep: string): string {
  return `Un recruteur du ${cegep} te recherche`;
}

/** Lien d'inscription : le formulaire s'ouvre en mode inscription, l'adresse
 *  déjà posée (le même mécanisme que le lien partagé par un coach). */
export function lienInscription(courriel: string): string {
  return `${APP_URL}/auth?mode=signup&email=${encodeURIComponent(courriel)}`;
}

export function buildBody(d: DonneesInvitation): { html: string; text: string } {
  const prenom = d.prenom?.trim() || "";
  const recruteur = d.recruteur?.trim() || "";
  const cegep = d.cegep.trim();
  const p = (s: string, dernier = false) =>
    `<p style="margin:0${dernier ? "" : " 0 12px"};">${s}</p>`;

  const quiHtml = recruteur
    ? `<strong>${echapper(recruteur)}</strong>, recruteur du ${echapper(cegep)},`
    : `Un recruteur du ${echapper(cegep)}`;
  const quiTexte = recruteur ? `${recruteur}, recruteur du ${cegep},` : `Un recruteur du ${cegep}`;

  return renderEmail({
    preheader: "Crée ton profil Nexus : c'est lui que les recruteurs des cégeps consultent.",
    heading: echapper(sujet(cegep)),
    bodyHtml:
      p(prenom ? `Salut ${echapper(prenom)},` : "Salut,") +
      p(`${quiHtml} utilise Nexus pour son recrutement et te recherche.`) +
      p(`Inscris-toi pour compléter ton profil et maximiser tes chances de te faire recruter. ` +
        `C'est gratuit, et ça prend quelques minutes.`, true),
    ctaLabel: "Créer mon profil",
    ctaUrl: lienInscription(d.courriel),
    bodyText: [
      prenom ? `Salut ${prenom},` : "Salut,",
      "",
      `${quiTexte} utilise Nexus pour son recrutement et te recherche.`,
      "",
      "Inscris-toi pour compléter ton profil et maximiser tes chances de te faire recruter. " +
        "C'est gratuit, et ça prend quelques minutes.",
    ].join("\n"),
    lcap: {
      raison: `Tu reçois ce courriel parce qu'un recruteur du ${echapper(cegep)} a indiqué ton adresse ` +
        `en suivant ton parcours sportif. Tu ne recevras pas d'autre courriel automatique à ce sujet.`,
      desabonnementUrl: d.desabonnementUrl,
    },
  });
}
