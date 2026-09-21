// _shared/emailLayout.ts — gabarit courriel transactionnel Nexus (Resend).
//
// Un seul rendu partagé pour tous les courriels : corps clair, barre d'en-tête
// noire portant le logo Nexus (blanc + flamme rouge), CTA rouge. Pure Deno /
// concaténation de chaînes — AUCUNE dépendance npm (pas de react-email/resend
// SDK, pas de dossier emails/). Tables + styles inline pour compatibilité
// clients (Outlook, Gmail, Apple Mail, mobiles).
//
// Exports : renderEmail, FROM, APP_URL, CONTACT, LOGO_URL, ADRESSE_POSTALE,
// SUPPORT. Le pied LCAP (`lcap`) est optionnel : sans lui, le rendu est
// identique à celui d'avant le 2026-09-21 pour les six courriels existants.

/** Expéditeur unique (identique aux fonctions existantes). */
export const FROM = "Nexus <info@nexussports.ca>";

/** Base publique de l'app (mirroir du fallback des edge functions). */
export const APP_URL = Deno.env.get("APP_URL") ?? "https://nexussports.ca";

/** Adresse RPRP / contact Loi 25. */
export const CONTACT = "confidentialite@nexussports.ca";

/** Logo public blanc + rouge (déjà servi absolu dans app/layout.tsx JSON-LD).
    Va sur la barre noire → variante wordmark blanc + flamme rouge. */
export const LOGO_URL = "https://nexussports.ca/brand/logo-white-red.png";

/** Adresse postale de l'expéditeur — mention OBLIGATOIRE (LCAP) sur tout
 *  message électronique commercial, avec un moyen de contact valide 60 jours. */
export const ADRESSE_POSTALE = "856, rue Basile-Routhier, Repentigny (Québec)";

/** Adresse de support — répondre à un courriel de relance y arrive. */
export const SUPPORT = "info@nexussports.ca";

const FONT = "'Outfit','Segoe UI',Helvetica,Arial,sans-serif";

export interface RenderEmailOptions {
  /** Texte de prévisualisation (inbox) — masqué dans le corps. */
  preheader: string;
  /** Titre principal (h1). */
  heading: string;
  /** Corps HTML fourni par l'appelant (blocs <p> déjà interpolés). */
  bodyHtml: string;
  /** Libellé du bouton CTA principal. */
  ctaLabel: string;
  /** URL du CTA (http(s):// ou mailto:). */
  ctaUrl: string;
  /** Bloc HTML optionnel sous le CTA (ex. lien App Store). */
  extraHtml?: string;
  /** Note discrète optionnelle au-dessus de la ligne contact (footer). */
  footerNote?: string;
  /** Corps texte brut (obligatoire — partie text/plain de Resend). */
  bodyText: string;
  /** Texte brut optionnel ajouté après bodyText (ex. URL App Store). */
  extraText?: string;
  /** PIED LCAP — à fournir pour tout courriel de relance ou de marketing.
   *  Présent : le pied ajoute la raison de l'envoi, le lien de
   *  désabonnement, l'adresse postale et l'adresse de support. Absent : le
   *  pied est celui d'avant, à l'identique (les courriels transactionnels
   *  existants n'en ont pas besoin et ne changent pas). */
  lcap?: {
    /** « Tu reçois ce courriel parce que… » */
    raison: string;
    /** URL absolue et signée de /desabonnement. */
    desabonnementUrl: string;
  };
}

/**
 * Rend un courriel complet { html, text } à partir des morceaux fournis par
 * chaque fonction. L'appelant reste responsable d'interpoler ses données dans
 * bodyHtml/bodyText (parité avec l'ancien buildBody — pas d'échappement ajouté).
 */
export function renderEmail(opts: RenderEmailOptions): { html: string; text: string } {
  const {
    preheader,
    heading,
    bodyHtml,
    ctaLabel,
    ctaUrl,
    extraHtml,
    footerNote,
    bodyText,
    extraText,
    lcap,
  } = opts;

  const lcapHtml = lcap
    ? `<p style="margin:0 0 10px;font-family:${FONT};font-size:12px;line-height:1.5;color:#71717A;">${lcap.raison} <a href="${lcap.desabonnementUrl}" target="_blank" style="color:#71717A;text-decoration:underline;">Ne plus recevoir ces courriels</a></p>
              <p style="margin:0 0 10px;font-family:${FONT};font-size:12px;line-height:1.5;color:#A1A1AA;">Nexus — ${ADRESSE_POSTALE} · <a href="mailto:${SUPPORT}" style="color:#A1A1AA;text-decoration:none;">${SUPPORT}</a></p>`
    : "";

  const html = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
</head>
<body style="margin:0;padding:0;background:#F4F4F5;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#F4F4F5;">${preheader}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F4F4F5;">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:540px;background:#FFFFFF;border:1px solid #E4E4E7;border-radius:14px;overflow:hidden;">
          <tr>
            <td align="center" style="background:#111317;padding:22px 24px;">
              <img src="${LOGO_URL}" alt="Nexus" width="128" style="display:block;width:128px;max-width:55%;height:auto;border:0;outline:none;text-decoration:none;">
            </td>
          </tr>
          <tr>
            <td style="padding:32px 30px 6px;font-family:${FONT};color:#1A1D24;">
              <h1 style="margin:0 0 18px;font-family:${FONT};font-size:22px;line-height:1.28;font-weight:700;color:#111317;">${heading}</h1>
              <div style="font-family:${FONT};font-size:16px;line-height:1.55;color:#27272A;">${bodyHtml}</div>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:26px 0 4px;">
                <tr>
                  <td align="center" bgcolor="#E63946" style="border-radius:10px;">
                    <a href="${ctaUrl}" target="_blank" style="display:inline-block;font-family:${FONT};font-size:16px;font-weight:600;line-height:1;color:#FFFFFF;text-decoration:none;padding:14px 30px;border-radius:10px;">${ctaLabel}</a>
                  </td>
                </tr>
              </table>
              ${extraHtml ?? ""}
            </td>
          </tr>
          <tr>
            <td style="padding:22px 30px 30px;font-family:${FONT};">
              <hr style="border:none;border-top:1px solid #E4E4E7;margin:0 0 16px;">
              ${footerNote ? `<p style="margin:0 0 10px;font-family:${FONT};font-size:13px;line-height:1.5;color:#71717A;">${footerNote}</p>` : ""}
              ${lcapHtml}
              <p style="margin:0 0 4px;font-family:${FONT};font-size:13px;line-height:1.5;color:#71717A;">Des questions ? <a href="mailto:${CONTACT}" style="color:#E63946;text-decoration:none;">${CONTACT}</a></p>
              <p style="margin:0;font-family:${FONT};font-size:12px;color:#A1A1AA;">© Nexus — nexussports.ca</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const textParts = [heading, "", bodyText, "", `${ctaLabel} : ${ctaUrl}`];
  if (extraText) textParts.push("", extraText);
  if (footerNote) textParts.push("", footerNote);
  if (lcap) {
    textParts.push(
      "", lcap.raison,
      `Ne plus recevoir ces courriels : ${lcap.desabonnementUrl}`,
      `Nexus — ${ADRESSE_POSTALE} · ${SUPPORT}`,
    );
  }
  textParts.push("", `Des questions ? ${CONTACT}`, "© Nexus — nexussports.ca");
  const text = textParts.join("\n");

  return { html, text };
}
