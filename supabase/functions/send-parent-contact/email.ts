// send-parent-contact/email.ts — avis au parent : un recruteur a contacté
// son enfant. Séparé de index.ts pour être importable sans démarrer Deno.serve.
//
// PII minimisée : ne nomme ni l'enfant, ni le recruteur, ni le cégep, ni le
// sport, ni le message (décision BP 2026-10-20 — une faute dans parent_email
// ne doit rien révéler à un tiers).
//
// CTA :
//   - claimToken présent → ${APP_URL}/parent/claim?token=… (compte pas encore
//     réclamé : le parent le crée, la notification portail l'y attend) ;
//   - sinon               → ${APP_URL}/parent/notifications.

import { renderEmail, APP_URL } from "../_shared/emailLayout.ts";

export type Langue = "fr" | "en";

interface Textes {
  subject: string;
  heading: string;
  phrase: string;
  suite: string;
  suiteReclamer: string;
  cta: string;
  ctaReclamer: string;
  footer: string;
  push: string;
}

const TEXTES: Record<Langue, Textes> = {
  fr: {
    subject: "Un recruteur a contacté votre enfant",
    heading: "Un recruteur a contacté votre enfant",
    phrase: "Un recruteur d'un programme collégial a contacté votre enfant.",
    suite: "Connectez-vous à votre espace parent pour voir l'activité.",
    suiteReclamer: "Créez votre espace parent pour voir l'activité.",
    cta: "Voir l'activité",
    ctaReclamer: "Créer mon compte parent",
    footer:
      "Ce courriel vous est envoyé conformément à la Loi 25 (protection des renseignements personnels). Pour toute question : confidentialite@nexussports.ca",
    push: "Un recruteur a contacté votre enfant.",
  },
  en: {
    subject: "A recruiter contacted your child",
    heading: "A recruiter contacted your child",
    phrase: "A recruiter from a college program contacted your child.",
    suite: "Sign in to your parent account to see the activity.",
    suiteReclamer: "Create your parent account to see the activity.",
    cta: "See the activity",
    ctaReclamer: "Create my parent account",
    footer:
      "This email is sent in accordance with Québec's Law 25 (protection of personal information). Questions: confidentialite@nexussports.ca",
    push: "A recruiter contacted your child.",
  },
};

export function langue(v: unknown): Langue {
  return v === "en" ? "en" : "fr";
}

export function textePush(l: Langue): string {
  return TEXTES[l].push;
}

export function buildCourriel(l: Langue, claimToken: string): { subject: string; html: string; text: string } {
  const t = TEXTES[l];
  const reclamer = claimToken !== "";
  const suite = reclamer ? t.suiteReclamer : t.suite;
  const ctaUrl = reclamer
    ? `${APP_URL}/parent/claim?token=${encodeURIComponent(claimToken)}`
    : `${APP_URL}/parent/notifications`;
  const { html, text } = renderEmail({
    preheader: t.phrase,
    heading: t.heading,
    bodyHtml: `<p style="margin:0 0 12px;">${t.phrase}</p><p style="margin:0 0 12px;">${suite}</p>`,
    ctaLabel: reclamer ? t.ctaReclamer : t.cta,
    ctaUrl,
    footerNote: t.footer,
    bodyText: [t.phrase, "", suite].join("\n"),
  });
  return { subject: t.subject, html, text };
}
