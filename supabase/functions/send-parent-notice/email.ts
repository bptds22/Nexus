// send-parent-notice/email.ts — corps de l'avis parental Loi 25 (14-17) +
// invitation au portail parental.
// PII minimisée : ne nomme JAMAIS l'enfant. N'attend que parent_first_name.
// Séparé de index.ts pour être importable sans démarrer Deno.serve.
//
// CTA « Créer mon compte parent » TOUJOURS affiché (décision produit).
//   - claimToken présent  → ${APP_URL}/parent/claim?token=… (flux portail réel :
//     signUp rôle PARENT + claim_parent_invitation, lie le parent à l'enfant).
//   - claimToken absent    → ${APP_URL} (repli valide : /parent/claim sans token
//     affiche « Lien invalide », donc on ne génère JAMAIS d'URL cassée).
// Le token n'est pas garanti : le trigger notify_parent_on_minor v1
// (20260708120000) n'en envoie pas ; seul v2 (20260720170400) le fournit.

import { renderEmail, APP_URL } from "../_shared/emailLayout.ts";

export function buildBody(parentFirstName: string, claimToken: string): { html: string; text: string } {
  const heading = parentFirstName ? `Bonjour ${parentFirstName},` : "Bonjour,";

  // Toujours un CTA. Repli sur la home si aucun token (pas d'URL /parent/claim
  // sans token → éviterait l'écran « Lien invalide »).
  const ctaUrl = claimToken
    ? `${APP_URL}/parent/claim?token=${encodeURIComponent(claimToken)}`
    : APP_URL;

  return renderEmail({
    preheader: "Votre enfant s'est inscrit sur Nexus",
    heading,
    bodyHtml:
      `<p style="margin:0 0 12px;">Votre enfant s'est inscrit sur Nexus, une plateforme québécoise qui met en relation les athlètes du secondaire avec les recruteurs des CÉGEP (réseau RSEQ).</p>` +
      `<p style="margin:0 0 12px;">En créant votre compte parent, vous pouvez gérer les consentements, suivre l'activité du profil de votre enfant (vues et intérêt des recruteurs) et rester informé.</p>` +
      `<p style="margin:0 0 8px;font-weight:600;">Ce que vous devez savoir :</p>` +
      `<ul style="margin:0 0 12px;padding-left:20px;"><li style="margin:0 0 8px;">Les échanges avec les recruteurs passent par une messagerie encadrée sur la plateforme. Vous êtes notifié lorsqu'un recruteur entre en contact avec votre enfant.</li><li style="margin:0;">Le profil peut être supprimé à tout moment depuis les paramètres du compte.</li></ul>`,
    ctaLabel: "Créer mon compte parent",
    ctaUrl,
    footerNote:
      "Ce courriel vous est envoyé conformément à la Loi 25 (protection des renseignements personnels). Pour toute question : confidentialite@nexussports.ca",
    bodyText: [
      "Votre enfant s'est inscrit sur Nexus, une plateforme québécoise qui met en relation les athlètes du secondaire avec les recruteurs des CÉGEP (réseau RSEQ).",
      "",
      "En créant votre compte parent, vous pouvez gérer les consentements, suivre l'activité du profil de votre enfant (vues et intérêt des recruteurs) et rester informé.",
      "",
      "Ce que vous devez savoir :",
      "- Les échanges avec les recruteurs passent par une messagerie encadrée sur la plateforme. Vous êtes notifié lorsqu'un recruteur entre en contact avec votre enfant.",
      "- Le profil peut être supprimé à tout moment depuis les paramètres du compte.",
    ].join("\n"),
  });
}
