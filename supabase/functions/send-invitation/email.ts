// send-invitation/email.ts — courriel de RÉCLAMATION d'un profil d'athlète préparé sur Nexus.
// Séparé de index.ts pour être importable sans démarrer Deno.serve (preview HTML local).
//
// 2026-10-15 (décision BP) : AUCUN nom de coach ni d'école, ni « ton entraîneur ». Le texte dit
// ce qui est vrai — le nombre RÉEL de recruteurs de cégep qui suivent la fiche (calculé en base),
// jamais qui. En-tête et signature Nexus clairs, lien vers nexussports.ca.

import { renderEmail } from "../_shared/emailLayout.ts";
import { phraseRecruteurs } from "../_shared/messageRecruteurs.ts";

// Fiches store réelles (lib/carte/contact.ts + Play publié).
export const APP_STORE_URL = "https://apps.apple.com/ca/app/nexus/id6785596805";
export const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=ca.nexussports.app";

export const SUJET = "Ton profil d'athlète t'attend sur Nexus";

export function buildBody(nbRecruteurs: unknown, claimUrl: string): { html: string; text: string } {
  const phrase = phraseRecruteurs(nbRecruteurs);
  const extraHtml =
    `<p style="margin:22px 0 8px;font-family:'Outfit','Segoe UI',Helvetica,Arial,sans-serif;font-size:14px;color:#52525B;">Tu peux aussi télécharger l'application mobile :</p>` +
    `<a href="${APP_STORE_URL}" target="_blank" style="display:inline-block;font-family:'Outfit','Segoe UI',Helvetica,Arial,sans-serif;font-size:14px;font-weight:600;color:#E63946;text-decoration:none;border:1px solid #E4E4E7;border-radius:8px;padding:10px 18px;">Télécharger sur l'App Store</a>` +
    `<a href="${PLAY_STORE_URL}" target="_blank" style="display:inline-block;margin-left:8px;font-family:'Outfit','Segoe UI',Helvetica,Arial,sans-serif;font-size:14px;font-weight:600;color:#E63946;text-decoration:none;border:1px solid #E4E4E7;border-radius:8px;padding:10px 18px;">Télécharger sur Google Play</a>`;

  return renderEmail({
    preheader: phrase,
    heading: SUJET,
    bodyHtml:
      `<p style="margin:0 0 14px;font-size:17px;">${phrase}</p>` +
      `<p style="margin:0 0 12px;">Nexus est la plateforme québécoise qui relie les athlètes du secondaire aux recruteurs de cégep. C'est gratuit pour les athlètes.</p>` +
      `<p style="margin:0 0 12px;">L'équipe Nexus</p>`,
    ctaLabel: "Réclamer mon profil",
    ctaUrl: claimUrl,
    extraHtml,
    footerNote:
      "Tu reçois ce courriel parce qu'un profil d'athlète a été préparé pour toi sur Nexus. " +
      "Le bouton mène à nexussports.ca et le lien reste valide 30 jours. " +
      "Si ce profil n'est pas le tien, ignore simplement ce courriel.",
    bodyText: [
      phrase,
      "",
      "Nexus est la plateforme québécoise qui relie les athlètes du secondaire aux recruteurs de cégep.",
      "C'est gratuit pour les athlètes.",
      "",
      "L'équipe Nexus",
    ].join("\n"),
    extraText: [
      `Télécharger l'application mobile :`,
      `App Store : ${APP_STORE_URL}`,
      `Google Play : ${PLAY_STORE_URL}`,
    ].join("\n"),
  });
}
