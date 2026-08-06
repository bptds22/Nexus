// send-team-invitation/email.ts — courriel « un coach t'invite dans son équipe ».
//
// À NE PAS CONFONDRE avec send-invitation/email.ts, qui est le courriel de
// RÉCLAMATION : celui-là s'adresse à un athlète SANS compte et le mène à /claim
// pour qu'il en crée un. Ici l'athlète a DÉJÀ un compte et une équipe — on lui
// propose un TRANSFERT, et le lien mène au portail de transfert, préremplí.
//
// Séparé de index.ts pour être importable sans démarrer Deno.serve, comme son
// jumeau.

import { renderEmail } from "../_shared/emailLayout.ts";

/** Ligne « Sport · Catégorie · Division · Genre », vides retirés. Miroir de
 *  formatTeamLabel côté client — les deux surfaces ne doivent pas diverger. */
function detailsEquipe(
  sport: string, ageGroup: string, division: string, gender: string,
): string {
  return [sport, ageGroup, division, gender]
    .map((v) => (v ?? "").trim())
    .filter((v) => v.length > 0)
    .join(" · ");
}

export function buildBody(
  coachName: string,
  teamName: string,
  schoolName: string,
  details: { sport: string; ageGroup: string; division: string; gender: string },
  transferUrl: string,
): { html: string; text: string } {
  const ligneDetails = detailsEquipe(details.sport, details.ageGroup, details.division, details.gender);

  /* ── UN SEUL OBJECTIF, UNE SEULE PORTE ────────────────────────────────────
     Pas de boutons App Store / Google Play ici, contrairement au courriel de
     réclamation. Raison : ce lien mène au WEB, et l'écran de transfert
     n'existe pas dans l'application. Un athlète qui l'installerait pour
     accepter son invitation ne trouverait rien — une seconde porte qui ne mène
     nulle part.

     Le lien ouvre Safari, jamais l'app : un apple-app-site-association est
     publié sur le domaine mais l'application ne le réclame pas (ni entitlement
     associated-domains, ni écouteur d'URL). Configuration morte, consignée
     dans capacitor.config.ts. Ce n'est pas un repli dégradé — l'athlète a un
     compte, il se connecte sur le web, et le transfert s'y termine.
     ─────────────────────────────────────────────────────────────────────── */

  return renderEmail({
    preheader: `${coachName} t'invite dans ${teamName}`,
    heading: "Un coach t'invite dans son équipe",
    bodyHtml:
      `<p style="margin:0 0 14px;font-size:17px;"><strong>${coachName}</strong>${schoolName ? ` — ${schoolName}` : ""}</p>` +
      `<p style="margin:0 0 12px;">t'invite à rejoindre <strong>${teamName}</strong>${ligneDetails ? ` — ${ligneDetails}` : ""}.</p>` +
      // On DIT que ça remplace l'équipe actuelle. L'écran le redira, mais un
      // athlète qui décide dans sa boîte de réception doit déjà le savoir.
      `<p style="margin:0 0 12px;">Si tu acceptes, cette équipe remplacera ton équipe actuelle. Ton ancienne équipe restera dans ton parcours — tu ne perds rien.</p>` +
      `<p style="margin:0 0 12px;">C'est toi qui décides : tant que tu n'as pas confirmé, rien ne change.</p>`,
    ctaLabel: "Voir l'invitation",
    ctaUrl: transferUrl,
    bodyText: [
      `${coachName}${schoolName ? ` — ${schoolName}` : ""}`,
      "",
      `t'invite à rejoindre ${teamName}${ligneDetails ? ` — ${ligneDetails}` : ""}.`,
      "",
      "Si tu acceptes, cette équipe remplacera ton équipe actuelle.",
      "Ton ancienne équipe restera dans ton parcours — tu ne perds rien.",
      "",
      "C'est toi qui décides : tant que tu n'as pas confirmé, rien ne change.",
    ].join("\n"),
  });
}
