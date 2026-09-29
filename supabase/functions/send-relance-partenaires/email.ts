// send-relance-partenaires/email.ts — le courriel au PARENT : « une
// autorisation à vous demander » (visibilité partenaires, registre §52).
// Séparé de index.ts pour être importable sans démarrer Deno.serve.
//
// LE MÊME GABARIT pour l'envoi de test et pour la campagne.
// Vouvoiement : on écrit au parent, pas à l'athlète.

import { renderEmail } from "../_shared/emailLayout.ts";

/** renderEmail n'échappe rien : les prénoms viennent de la base (saisis par
 *  des humains) — on les échappe ICI. */
function echapper(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/** « de Marc » / « d’Alex » — élision devant voyelle ou h. */
function de(nom: string): string {
  return /^[aeiouyhàâäéèêëîïôöûüœ]/i.test(nom) ? `d’${nom}` : `de ${nom}`;
}

export function sujet(prenomAthlete: string | null): string {
  const p = prenomAthlete?.trim();
  return p ? `Nexus : une autorisation à vous demander pour ${p}` : "Nexus : une autorisation à vous demander";
}

export interface DonneesRelanceParent {
  prenomAthlete: string | null;
  prenomParent: string | null;
  consentementUrl: string;    // absolue, porte le jeton à usage unique
  desabonnementUrl: string;   // absolue, signée
}

export function buildBody(d: DonneesRelanceParent): { html: string; text: string } {
  const enfant = d.prenomAthlete?.trim() || "votre enfant";
  const enfantH = echapper(enfant);
  const parent = d.prenomParent?.trim();
  const salutH = parent ? `Bonjour ${echapper(parent)},` : "Bonjour,";
  const salutT = parent ? `Bonjour ${parent},` : "Bonjour,";
  const p = (s: string, dernier = false) =>
    `<p style="margin:0${dernier ? "" : " 0 12px"};">${s}</p>`;

  const l1 = (e: string) =>
    `${e.charAt(0).toUpperCase()}${e.slice(1)} a un profil athlète sur Nexus, la plateforme qui relie les athlètes du secondaire ` +
    `aux recruteurs des cégeps.`;
  const l2 = (e: string) =>
    `Nous avons une autorisation distincte et facultative à vous demander : permettre à nos ` +
    `partenaires médias approuvés (journalistes sportifs, pages de contenu sportif, balados) de ` +
    `publier la carte Nexus ${de(e)} — son nom, son école, sa position, sa cote et sa photo. ` +
    `Aucun partenaire ne peut contacter ${e} directement.`;
  const l3 = "Cette question ne vous a pas encore été posée. Vous pouvez accepter ou refuser en un clic ; " +
    "si vous ne faites rien, rien ne change : la carte n'est pas communiquée.";
  const l4 = "Le lien est personnel et valable 60 jours. Vous pourrez changer d'avis en tout temps " +
    "en écrivant à confidentialite@nexussports.ca.";

  return renderEmail({
    preheader: `Accepter ou refuser, en un clic — rien ne change si vous ne faites rien.`,
    heading: "Une autorisation à vous demander",
    bodyHtml:
      p(salutH) + p(l1(enfantH)) + p(l2(enfantH)) + p(l3) + p(l4, true),
    ctaLabel: "Donner ma réponse",
    ctaUrl: d.consentementUrl,
    // renderEmail ajoute lui-même « Donner ma réponse : <url> » au texte brut.
    bodyText: [salutT, "", l1(enfant), "", l2(enfant), "", l3, "", l4].join("\n"),
    lcap: {
      raison: "Vous recevez ce courriel parce que votre adresse a été indiquée comme celle du parent ou tuteur d'un athlète inscrit sur Nexus.",
      desabonnementUrl: d.desabonnementUrl,
    },
  });
}
