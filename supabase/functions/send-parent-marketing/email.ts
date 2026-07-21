// send-parent-marketing/email.ts — corps de l'avis parental « consentement à
// l'utilisation de l'image » (marketing) pour un athlète mineur 14-17.
// PII minimisée : ne nomme JAMAIS l'enfant. N'attend que parent_first_name.
// Séparé de index.ts pour être importable sans démarrer Deno.serve.

import { renderEmail, APP_URL } from "../_shared/emailLayout.ts";

export function buildBody(parentFirstName: string): { html: string; text: string } {
  const heading = parentFirstName ? `Bonjour ${parentFirstName},` : "Bonjour,";

  return renderEmail({
    preheader: "Consentement à l'utilisation de l'image de votre enfant",
    heading,
    bodyHtml:
      `<p style="margin:0 0 12px;">Lors de son inscription sur Nexus, votre enfant a accepté le consentement marketing.</p>` +
      `<p style="margin:0 0 12px;">Cela signifie que Nexus et ses partenaires pourraient utiliser son image (photo ou vidéo) dans du contenu promotionnel — par exemple des articles, des publications ou des activités avec nos partenaires.</p>` +
      `<p style="margin:0;"><strong>Vous pouvez retirer ce consentement en tout temps directement dans le compte de votre enfant sur la plateforme.</strong> Pour toute question, écrivez-nous à confidentialite@nexussports.ca.</p>`,
    ctaLabel: "En savoir plus",
    ctaUrl: APP_URL,
    footerNote:
      "Vous recevez ce courriel parce que votre enfant a accepté le consentement marketing lors de son inscription sur Nexus.",
    bodyText: [
      "Lors de son inscription sur Nexus, votre enfant a accepté le consentement marketing.",
      "",
      "Cela signifie que Nexus et ses partenaires pourraient utiliser son image (photo ou vidéo) dans du contenu promotionnel — par exemple des articles, des publications ou des activités avec nos partenaires.",
      "",
      "Vous pouvez retirer ce consentement en tout temps directement dans le compte de votre enfant sur la plateforme. Pour toute question, écrivez-nous à confidentialite@nexussports.ca.",
    ].join("\n"),
  });
}
