// send-team-invitation/email.ts — courriel « invitation à rejoindre une équipe » (sans coach).
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

/** 2026-10-15 (décision BP, règle RSEQ) : aucun nom de coach, ni « un coach » / « ton entraîneur ».
 *  L'équipe et son école ne sont nommées que si la BASE les a transmises — elle ne le fait que pour
 *  une équipe secondaire ou civile (notify_team_invitation_email). Sans nom : texte générique, rien
 *  qui permette de deviner l'équipe (ni détails, ni école). */
export const SUJET = "Invitation à rejoindre une équipe sur Nexus";

export function buildBody(
  teamName: string,
  schoolName: string,
  details: { sport: string; ageGroup: string; division: string; gender: string },
  transferUrl: string,
  desabonnementUrl: string,
): { html: string; text: string } {
  const nommee = teamName.trim().length > 0;
  // Pas d'équipe nommable → ni détails ni école, même s'ils arrivaient.
  const ligneDetails = nommee
    ? detailsEquipe(details.sport, details.ageGroup, details.division, details.gender)
    : "";
  const lcap = {
    raison: "Tu reçois ce courriel parce que tu as un compte d'athlète sur Nexus et qu'une équipe t'y a invité.",
    desabonnementUrl,
  };

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

  const equipe = nommee ? `${teamName.trim()}${schoolName.trim() ? ` — ${schoolName.trim()}` : ""}` : "";
  const invite = nommee
    ? `Tu es invité à rejoindre cette équipe sur Nexus${ligneDetails ? ` (${ligneDetails})` : ""}.`
    : "Tu es invité à rejoindre une nouvelle équipe sur Nexus. Ouvre l'invitation pour la voir.";
  return renderEmail({
    preheader: nommee ? `Invitation à rejoindre ${teamName.trim()}` : "Invitation à rejoindre une équipe",
    heading: "Tu es invité à rejoindre une équipe",
    bodyHtml:
      (nommee ? `<p style="margin:0 0 14px;font-size:17px;"><strong>${equipe}</strong></p>` : "") +
      `<p style="margin:0 0 12px;">${invite}</p>` +
      // On DIT que ça remplace l'équipe actuelle. L'écran le redira, mais un
      // athlète qui décide dans sa boîte de réception doit déjà le savoir.
      `<p style="margin:0 0 12px;">Si tu acceptes, cette équipe remplacera ton équipe actuelle. Ton ancienne équipe restera dans ton parcours — tu ne perds rien.</p>` +
      `<p style="margin:0 0 12px;">C'est toi qui décides : tant que tu n'as pas confirmé, rien ne change.</p>`,
    ctaLabel: "Voir l'invitation",
    ctaUrl: transferUrl,
    footerNote:
      "Le bouton mène à nexussports.ca. Si tu ne connais pas cette équipe, ignore simplement ce courriel.",
    bodyText: [
      ...(nommee ? [equipe, ""] : []),
      invite,
      "",
      "Si tu acceptes, cette équipe remplacera ton équipe actuelle.",
      "Ton ancienne équipe restera dans ton parcours — tu ne perds rien.",
      "",
      "C'est toi qui décides : tant que tu n'as pas confirmé, rien ne change.",
    ].join("\n"),
    lcap,
  });
}
