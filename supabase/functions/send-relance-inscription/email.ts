// send-relance-inscription/email.ts — le courriel « ton profil n'est pas
// terminé ». Séparé de index.ts pour être importable sans démarrer Deno.serve.
// Brouillon validé : docs/relance-inscription-inachevee.md.
//
// LE MÊME GABARIT pour l'envoi de test et pour la campagne : le test ne vaut
// que s'il rend exactement ce que recevront les destinataires.

import { renderEmail, APP_URL } from "../_shared/emailLayout.ts";

export const SUJET = "Ton profil Nexus n'est pas terminé";

/** Le moyen de connexion utilisé à l'inscription. La phrase qui le nomme est
 *  la plus utile du courriel : revenir par un autre moyen crée un second
 *  compte ATHLETE vide — le doublon naîtrait de la relance elle-même. */
function moyenConnexion(fournisseur: string | null): { html: string; text: string } {
  switch (fournisseur) {
    case "apple":  return { html: "Apple", text: "Apple" };
    case "google": return { html: "Google", text: "Google" };
    default:       return { html: "ton adresse courriel", text: "ton adresse courriel" };
  }
}

/** renderEmail n'échappe rien (parité historique). Le prénom vient de
 *  l'utilisateur : on l'échappe ICI, sinon un prénom contenant du HTML
 *  s'injecterait dans le courriel. */
function echapper(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function dateInscription(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-CA", {
    day: "numeric", month: "long", year: "numeric", timeZone: "America/Montreal",
  });
}

export interface DonneesRelance {
  prenom: string | null;
  fournisseur: string | null;
  inscritLe: string;          // ISO
  desabonnementUrl: string;   // absolue, signée
}

export function buildBody(d: DonneesRelance): { html: string; text: string } {
  const prenom = d.prenom?.trim() || "";
  const salut = prenom ? `Salut ${echapper(prenom)},` : "Salut,";
  const salutTexte = prenom ? `Salut ${prenom},` : "Salut,";
  const quand = dateInscription(d.inscritLe);
  const moyen = moyenConnexion(d.fournisseur);
  const p = (s: string, dernier = false) =>
    `<p style="margin:0${dernier ? "" : " 0 12px"};">${s}</p>`;

  return renderEmail({
    preheader: "Quelques minutes pour que les recruteurs puissent te trouver.",
    heading: SUJET,
    bodyHtml:
      p(salut) +
      p(`Tu as créé ton compte Nexus le ${quand}, mais ton profil n'est pas terminé. ` +
        `Tant qu'il ne l'est pas, les recruteurs des cégeps ne peuvent pas te trouver.`) +
      p(`Ça ne prend que quelques minutes.`) +
      p(`Pour être franc : ton profil n'a pas été enregistré en cours de route, donc tu ` +
        `repars du début. Tes consentements, eux, sont déjà faits — tu ne les referas pas.`) +
      p(`<strong>Connecte-toi avec ${moyen.html}</strong>, le même moyen que la première fois. ` +
        `Avec un autre, tu créerais un deuxième compte.`, true),
    ctaLabel: "Terminer mon profil",
    ctaUrl: `${APP_URL}/auth`,
    bodyText: [
      salutTexte,
      "",
      `Tu as créé ton compte Nexus le ${quand}, mais ton profil n'est pas terminé. ` +
        `Tant qu'il ne l'est pas, les recruteurs des cégeps ne peuvent pas te trouver.`,
      "",
      "Ça ne prend que quelques minutes.",
      "",
      "Pour être franc : ton profil n'a pas été enregistré en cours de route, donc tu " +
        "repars du début. Tes consentements, eux, sont déjà faits — tu ne les referas pas.",
      "",
      `Connecte-toi avec ${moyen.text}, le même moyen que la première fois. ` +
        "Avec un autre, tu créerais un deuxième compte.",
    ].join("\n"),
    lcap: {
      raison: "Tu reçois ce courriel parce que tu as créé un compte athlète sur Nexus.",
      desabonnementUrl: d.desabonnementUrl,
    },
  });
}
