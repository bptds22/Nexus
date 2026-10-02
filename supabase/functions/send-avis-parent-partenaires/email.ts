// send-avis-parent-partenaires/email.ts — l'AVIS au parent quand un athlète
// de 14 à 17 ans active lui-même sa visibilité partenaires médias
// (décision BP 2026-10-02, politique 2026-10-v1, section 7.5).
// Séparé de index.ts pour être importable sans démarrer Deno.serve.
//
// Vouvoiement : on écrit au parent. Le prénom de l'athlète est NOMMÉ — c'est
// l'objet même de l'avis (BP : « [Prénom] a autorisé la visibilité
// partenaires médias »), à la différence de l'avis d'inscription.

import { renderEmail } from "../_shared/emailLayout.ts";

/** renderEmail n'échappe rien : les prénoms viennent de la base. */
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
  return p
    ? `${p} a autorisé la visibilité partenaires médias`
    : "Votre enfant a autorisé la visibilité partenaires médias";
}

export interface DonneesAvisParent {
  prenomAthlete: string | null;
  prenomParent: string | null;
  /** Lien vers l'espace parent : /parent/consentements (compte existant) ou
   *  /parent/claim?token=… (création de l'espace, liée à l'enfant). */
  portailUrl: string;
  /** Vrai si le parent a déjà son espace : change le libellé du bouton. */
  espaceExistant: boolean;
  desabonnementUrl: string;
}

export function buildBody(d: DonneesAvisParent): { html: string; text: string } {
  const enfant = d.prenomAthlete?.trim() || "votre enfant";
  const enfantH = echapper(enfant);
  const Maj = (e: string) => `${e.charAt(0).toUpperCase()}${e.slice(1)}`;
  const parent = d.prenomParent?.trim();
  const salutH = parent ? `Bonjour ${echapper(parent)},` : "Bonjour,";
  const salutT = parent ? `Bonjour ${parent},` : "Bonjour,";
  const p = (s: string, dernier = false) => `<p style="margin:0${dernier ? "" : " 0 12px"};">${s}</p>`;

  const l1 = (e: string) =>
    `${Maj(e)} a activé, depuis son compte Nexus, la visibilité auprès de nos partenaires médias ` +
    `approuvés (journalistes sportifs, pages de contenu sportif, balados). Ils peuvent désormais publier ` +
    `la carte Nexus ${de(e)} — son nom, son école, sa position, sa cote et sa photo. ` +
    `Aucun partenaire ne peut contacter ${e} directement.`;
  const l2 = "À partir de 14 ans, la loi québécoise permet à un jeune de donner ce consentement lui-même. " +
    "Nous vous en avisons, comme le prévoit notre politique de confidentialité.";
  const l3 = d.espaceExistant
    ? "Si vous n'êtes pas d'accord, vous pouvez retirer cette visibilité en tout temps depuis votre espace parent."
    : "Si vous n'êtes pas d'accord, vous pouvez retirer cette visibilité en tout temps depuis votre espace parent. " +
      "Le bouton ci-dessous vous permet de le créer en quelques secondes ; il est lié au compte de votre enfant.";
  const l4 = "Si vous êtes d'accord, vous n'avez rien à faire.";

  return renderEmail({
    preheader: `Vous pouvez la retirer en tout temps depuis votre espace parent.`,
    heading: "Visibilité partenaires médias activée",
    bodyHtml: p(salutH) + p(l1(enfantH)) + p(l2) + p(l3) + p(l4, true),
    ctaLabel: d.espaceExistant ? "Ouvrir mon espace parent" : "Créer mon espace parent",
    ctaUrl: d.portailUrl,
    bodyText: [salutT, "", l1(enfant), "", l2, "", l3, "", l4].join("\n"),
    footerNote:
      "Ce courriel vous est envoyé conformément à la Loi 25 (protection des renseignements personnels). " +
      "Pour toute question : confidentialite@nexussports.ca",
    lcap: {
      raison: "Vous recevez ce courriel parce que votre adresse a été indiquée comme celle du parent ou tuteur d'un athlète inscrit sur Nexus.",
      desabonnementUrl: d.desabonnementUrl,
    },
  });
}
