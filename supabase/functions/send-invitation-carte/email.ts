// send-invitation-carte/email.ts — l'invitation envoyée à la CRÉATION d'une
// carte prospect (lot C). Séparé de index.ts pour être importable sans
// démarrer Deno.serve (test Node : lib/cartes/__tests__/invitationCarte.test.ts).
//
// Texte de BP (version du 2026-09-28, mot pour mot) : objet « Un recruteur
// du [Cégep] recrute sur Nexus » ; « [Recruteur], recruteur au [Cégep],
// utilise Nexus comme plateforme de recrutement et suit ton parcours. » ;
// « Crée ton profil pour qu'il ait accès à tes infos, tes vidéos et ton
// évaluation : c'est ce qui facilite et maximise ton recrutement. »

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
  return `Un recruteur du ${cegep} recrute sur Nexus`;
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
    ? `<strong>${echapper(recruteur)}</strong>, recruteur au ${echapper(cegep)},`
    : `Un recruteur du ${echapper(cegep)}`;
  const quiTexte = recruteur ? `${recruteur}, recruteur au ${cegep},` : `Un recruteur du ${cegep}`;
  const suite = "utilise Nexus comme plateforme de recrutement et suit ton parcours.";
  const profil = "Crée ton profil pour qu'il ait accès à tes infos, tes vidéos et ton évaluation : " +
    "c'est ce qui facilite et maximise ton recrutement. C'est gratuit, et ça prend quelques minutes.";

  return renderEmail({
    preheader: "Crée ton profil Nexus : c'est gratuit, et ça prend quelques minutes.",
    heading: echapper(sujet(cegep)),
    bodyHtml:
      p(prenom ? `Salut ${echapper(prenom)},` : "Salut,") +
      p(`${quiHtml} ${suite}`) +
      p(echapper(profil), true),
    ctaLabel: "Créer mon profil",
    ctaUrl: lienInscription(d.courriel),
    bodyText: [
      prenom ? `Salut ${prenom},` : "Salut,",
      "",
      `${quiTexte} ${suite}`,
      "",
      profil,
    ].join("\n"),
    lcap: {
      raison: `Tu reçois ce courriel parce qu'un recruteur du ${echapper(cegep)} a indiqué ton adresse ` +
        `en suivant ton parcours sportif. Tu ne recevras pas d'autre courriel automatique à ce sujet.`,
      desabonnementUrl: d.desabonnementUrl,
    },
  });
}
