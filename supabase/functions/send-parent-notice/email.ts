// send-parent-notice/email.ts — corps de l'avis parental Loi 25 (14-17).
// PII minimisée : ne nomme JAMAIS l'enfant. N'attend que parent_first_name.
// Séparé de index.ts pour être importable sans démarrer Deno.serve.

import { renderEmail, CONTACT } from "../_shared/emailLayout.ts";

export function buildBody(parentFirstName: string): { html: string; text: string } {
  const heading = parentFirstName ? `Bonjour ${parentFirstName},` : "Bonjour,";

  return renderEmail({
    preheader: "Votre enfant s'est inscrit sur Nexus",
    heading,
    bodyHtml:
      `<p style="margin:0 0 12px;">Votre enfant vient de s'inscrire sur Nexus, une plateforme québécoise de recrutement sportif qui connecte les jeunes athlètes aux recruteurs collégiaux.</p>` +
      `<p style="margin:0 0 12px;">Comme votre enfant a entre 14 et 17 ans, son inscription requiert votre consentement parental. En s'inscrivant, votre enfant a déclaré que vous aviez donné ce consentement — son compte est donc actif.</p>` +
      `<p style="margin:0;"><strong>Si vous n'avez pas donné votre consentement</strong>, ou si vous avez un problème avec la création de ce compte, contactez-nous rapidement à confidentialite@nexussports.ca et nous le désactiverons.</p>`,
    ctaLabel: "Nous contacter",
    ctaUrl: `mailto:${CONTACT}`,
    footerNote:
      "Vous recevez ce courriel parce que votre enfant s'est inscrit sur Nexus et a déclaré avoir votre consentement parental.",
    bodyText: [
      "Votre enfant vient de s'inscrire sur Nexus, une plateforme québécoise de recrutement sportif qui connecte les jeunes athlètes aux recruteurs collégiaux.",
      "",
      "Comme votre enfant a entre 14 et 17 ans, son inscription requiert votre consentement parental. En s'inscrivant, votre enfant a déclaré que vous aviez donné ce consentement — son compte est donc actif.",
      "",
      "Si vous n'avez pas donné votre consentement, ou si vous avez un problème avec la création de ce compte, contactez-nous rapidement à confidentialite@nexussports.ca et nous le désactiverons.",
    ].join("\n"),
  });
}
