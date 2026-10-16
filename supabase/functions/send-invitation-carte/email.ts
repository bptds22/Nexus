// send-invitation-carte/email.ts — l'invitation envoyée à la CRÉATION d'une
// carte prospect (lot C). Séparé de index.ts pour être importable sans
// démarrer Deno.serve (test Node : lib/cartes/__tests__/invitationCarte.test.ts).
//
// Règle RSEQ (correctif BP 2026-10-16) : le courriel et ses rappels ne nomment
// NI le recruteur, NI le cégep, NI un coach collégial. Texte neutre :
// « Un recruteur collégial s'intéresse à ton profil. Crée ton compte Nexus
// pour qu'il puisse te suivre. » Les données ne portent donc plus ces noms :
// ce qui n'arrive pas ici ne peut pas s'afficher.

import { renderEmail, APP_URL } from "../_shared/emailLayout.ts";

/** renderEmail n'échappe rien (parité historique) : ce qui vient d'une saisie
 *  (le prénom de la carte) est échappé ICI. */
function echapper(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export interface DonneesInvitation {
  /** Prénom saisi sur la carte. */
  prenom: string | null;
  /** Adresse invitée — pré-remplit l'inscription. */
  courriel: string;
  /** URL absolue et signée de /desabonnement. */
  desabonnementUrl: string;
  /** Rappel demandé par un recruteur (décision BP 2026-09-30) : « Rappel : »
   *  dans l'objet et le titre, même corps, même désabonnement. */
  rappel?: boolean;
}

/** Au plus trois rappels par carte (demander_rappel_invitation). */
export const RAPPELS_MAX = 3;

export function sujet(rappel = false): string {
  return `${rappel ? "Rappel : " : ""}Un recruteur collégial s'intéresse à ton profil`;
}

/** Lien d'inscription : le formulaire s'ouvre en mode inscription, l'adresse
 *  déjà posée (le même mécanisme que le lien partagé par un coach). */
export function lienInscription(courriel: string): string {
  return `${APP_URL}/auth?mode=signup&email=${encodeURIComponent(courriel)}`;
}

export function buildBody(d: DonneesInvitation): { html: string; text: string } {
  const prenom = d.prenom?.trim() || "";
  const p = (s: string, dernier = false) =>
    `<p style="margin:0${dernier ? "" : " 0 12px"};">${s}</p>`;

  const qui = "Un recruteur collégial s'intéresse à ton profil. Crée ton compte Nexus pour qu'il puisse te suivre.";
  const profil = "Ton profil lui donne accès à tes infos, tes vidéos et ton évaluation : " +
    "c'est ce qui facilite et maximise ton recrutement. C'est gratuit, et ça prend quelques minutes.";

  return renderEmail({
    preheader: "Crée ton profil Nexus : c'est gratuit, et ça prend quelques minutes.",
    // Objet et phrase : des constantes, sans saisie — rien à échapper (et la
    // version texte du courriel garderait sinon « &#39; » à la place de l'apostrophe).
    heading: sujet(!!d.rappel),
    bodyHtml:
      p(prenom ? `Salut ${echapper(prenom)},` : "Salut,") +
      p(qui) +
      p(echapper(profil), true),
    ctaLabel: "Créer mon profil",
    ctaUrl: lienInscription(d.courriel),
    bodyText: [
      prenom ? `Salut ${prenom},` : "Salut,",
      "",
      qui,
      "",
      profil,
    ].join("\n"),
    lcap: {
      // Plus de « pas d'autre courriel » : un recruteur peut demander un rappel
      // (au plus trois, sept jours d'écart) — le désabonnement les arrête tous.
      raison: d.rappel
        ? `Tu reçois ce rappel parce qu'un recruteur collégial t'a invité sur Nexus ` +
          `et a demandé à te le rappeler. Au plus ${RAPPELS_MAX} rappels ; le lien ci-dessous les arrête.`
        : `Tu reçois ce courriel parce qu'un recruteur collégial a indiqué ton adresse ` +
          `en suivant ton parcours sportif. Il peut t'envoyer au plus ${RAPPELS_MAX} rappels ; le lien ci-dessous les arrête.`,
      desabonnementUrl: d.desabonnementUrl,
    },
  });
}
