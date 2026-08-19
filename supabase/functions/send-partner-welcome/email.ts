// send-partner-welcome/email.ts — construit le courriel de bienvenue envoyé au
// partenaire média à la création de son compte par l'admin. Séparé de index.ts
// pour être importable sans démarrer Deno.serve (preview HTML local).

import { renderEmail } from "../_shared/emailLayout.ts";

/** Échappe le HTML. Les noms d'organisation viennent d'une saisie admin libre
    (« Sports & Cie », « <RDS> ») et renderEmail n'échappe rien. Le mot de passe
    est du base64url (A-Za-z0-9-_) donc déjà sûr, mais on l'échappe aussi par
    uniformité. */
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const FONT = "'Outfit','Segoe UI',Helvetica,Arial,sans-serif";

export function buildBody(
  organizationName: string,
  contactName: string,
  email: string,
  tempPassword: string,
  loginUrl: string,
): { html: string; text: string } {
  // Bloc identifiants — cadre gris, valeurs en monospace sélectionnables.
  const credsHtml =
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:18px 0 4px;background:#FAFAFA;border:1px solid #E4E4E7;border-radius:10px;">` +
    `<tr><td style="padding:16px 18px;font-family:${FONT};">` +
    `<p style="margin:0 0 8px;font-size:13px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:#71717A;">Tes accès</p>` +
    `<p style="margin:0 0 6px;font-size:15px;color:#27272A;">Courriel : <span style="font-family:Consolas,Menlo,monospace;color:#111317;">${esc(email)}</span></p>` +
    `<p style="margin:0;font-size:15px;color:#27272A;">Mot de passe temporaire : <span style="font-family:Consolas,Menlo,monospace;font-weight:700;color:#111317;">${esc(tempPassword)}</span></p>` +
    `</td></tr></table>`;

  return renderEmail({
    preheader: `Ton accès partenaire Nexus pour ${organizationName} est prêt`,
    heading: "Bienvenue sur Nexus",
    bodyHtml:
      `<p style="margin:0 0 12px;">Bonjour <strong>${esc(contactName)}</strong>,</p>` +
      `<p style="margin:0 0 12px;">Ton compte partenaire média pour <strong>${esc(organizationName)}</strong> vient d'être créé. Tu as maintenant accès aux classements, aux tendances et à la salle de presse Nexus.</p>` +
      credsHtml +
      `<p style="margin:16px 0 0;font-size:14px;color:#52525B;">À ta première connexion, tu devras remplacer ce mot de passe temporaire et accepter les conditions d'utilisation éditoriale.</p>`,
    ctaLabel: "Me connecter",
    ctaUrl: loginUrl,
    footerNote:
      "Ce mot de passe temporaire ne sert qu'une fois. Si tu n'attendais pas ce courriel, ignore-le ou écris-nous.",
    bodyText: [
      `Bonjour ${contactName},`,
      "",
      `Ton compte partenaire média pour ${organizationName} vient d'être créé.`,
      "Tu as maintenant accès aux classements, aux tendances et à la salle de presse Nexus.",
      "",
      "TES ACCÈS",
      `Courriel : ${email}`,
      `Mot de passe temporaire : ${tempPassword}`,
      "",
      "À ta première connexion, tu devras remplacer ce mot de passe temporaire",
      "et accepter les conditions d'utilisation éditoriale.",
    ].join("\n"),
  });
}
