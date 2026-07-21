// send-invitation/email.ts — construit le courriel d'invitation coach→athlète
// à partir du gabarit partagé. Séparé de index.ts pour être importable sans
// démarrer Deno.serve (preview HTML local, cf. scripts/dump).

import { renderEmail } from "../_shared/emailLayout.ts";

// Fiches store réelles (lib/carte/contact.ts + Play publié).
export const APP_STORE_URL = "https://apps.apple.com/ca/app/nexus/id6785596805";
export const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=ca.nexussports.app";

export function buildBody(
  coachName: string,
  schoolName: string,
  claimUrl: string,
): { html: string; text: string } {
  const extraHtml =
    `<p style="margin:22px 0 8px;font-family:'Outfit','Segoe UI',Helvetica,Arial,sans-serif;font-size:14px;color:#52525B;">Tu peux aussi télécharger l'application mobile :</p>` +
    `<a href="${APP_STORE_URL}" target="_blank" style="display:inline-block;font-family:'Outfit','Segoe UI',Helvetica,Arial,sans-serif;font-size:14px;font-weight:600;color:#E63946;text-decoration:none;border:1px solid #E4E4E7;border-radius:8px;padding:10px 18px;">Télécharger sur l'App Store</a>` +
    `<a href="${PLAY_STORE_URL}" target="_blank" style="display:inline-block;margin-left:8px;font-family:'Outfit','Segoe UI',Helvetica,Arial,sans-serif;font-size:14px;font-weight:600;color:#E63946;text-decoration:none;border:1px solid #E4E4E7;border-radius:8px;padding:10px 18px;">Télécharger sur Google Play</a>`;

  return renderEmail({
    preheader: `${coachName} t'a invité sur Nexus`,
    heading: "Ton coach t'a invité sur Nexus",
    bodyHtml:
      `<p style="margin:0 0 14px;font-size:17px;"><strong>${coachName}</strong> — ${schoolName}</p>` +
      `<p style="margin:0 0 12px;">t'a invité à créer ton profil d'athlète sur Nexus.</p>` +
      `<p style="margin:0 0 12px;">Réclame ton profil et rends-toi visible auprès des recruteurs collégiaux. C'est gratuit — et c'est le premier pas de ton recrutement.</p>`,
    ctaLabel: "Sois le NEX",
    ctaUrl: claimUrl,
    extraHtml,
    bodyText: [
      `${coachName} — ${schoolName}`,
      "",
      "t'a invité à créer ton profil d'athlète sur Nexus.",
      "",
      "Réclame ton profil et rends-toi visible auprès des recruteurs collégiaux.",
      "C'est gratuit — et c'est le premier pas de ton recrutement.",
    ].join("\n"),
    extraText: [
      `Télécharger l'application mobile :`,
      `App Store : ${APP_STORE_URL}`,
      `Google Play : ${PLAY_STORE_URL}`,
    ].join("\n"),
  });
}
