// send-demo-access/email.ts — les deux courriels d'une demande d'accès à
// l'enregistrement de la démo (/12octobre). Pur (aucun réseau) : testé sous Node.
//
// · courriel A, au demandeur : son lien PERSONNEL /12octobre/video?t=<jeton>
//   (texte final de BP, 2026-10-13) ; + la phrase 1:1 si wants_1on1.
// · avis à info@ : « Nouvelle demande démo — … » + lien vers /admin/demo-access.
// Toute valeur saisie est ÉCHAPPÉE avant d'entrer dans le HTML.

import { renderEmail, APP_URL, ADRESSE_POSTALE, SUPPORT } from "../_shared/emailLayout.ts";

export const RESERVATION_1A1 = "https://calendar.app.google/RUBKQe4k5ySpa6Be8";

export interface DemandeAcces {
  id: string;
  prenom: string;
  nom: string;
  courriel: string;
  cegep: string | null;
  role: string | null;
  wants_1on1: boolean;
  token: string;
}

export const esc = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const ROLES: Record<string, string> = {
  RECRUTEUR: "Recruteur",
  ENTRAINEUR_CHEF: "Entraîneur-chef",
  DIRECTEUR_SPORTS: "Directeur des sports",
  AUTRE: "Autre",
};
export const libelleRole = (r: string | null): string => (r ? ROLES[r] ?? r : "—");

/** Le lien personnel. Le jeton est la SEULE donnée dans l'URL. */
export const lienVideo = (token: string): string =>
  `${APP_URL}/12octobre/video?t=${encodeURIComponent(token)}`;

export const SUJET_ACCES = "Votre accès à la démo Nexus";

const PIED = `Vous recevez ce courriel parce que vous avez demandé l'accès à l'enregistrement de la démo Nexus. Nexus — ${ADRESSE_POSTALE} · ${SUPPORT} · 438-498-0494`;

const POINTS = [
  "Mon processus : votre pipeline, vos notes, votre cote personnelle. Il remplace votre Excel.",
  "Le calendrier : les parties de vos cibles, quand le calendrier de leur ligue est publié.",
  "Le profil complet du joueur, avec l'évaluation validée par son coach.",
  "Les listes partagées à votre staff, la messagerie encadrée, votre page de programme.",
];

/** Courriel A — texte final de BP (2026-10-13), mot pour mot. */
export function courrielAcces(d: DemandeAcces): { sujet: string; html: string; text: string } {
  const lien = lienVideo(d.token);
  const p = (s: string) => `<p>${s}</p>`;

  const avantHtml = [
    p(`Bonjour ${esc(d.prenom)},`),
    p("Voici votre accès personnel à l'enregistrement de la démo recruteurs du 12 octobre. Nexus, c'est votre outil de recrutement — pas une banque de joueurs."),
  ].join("\n");
  const apresHtml = [
    p("En 35 minutes, vous allez voir :"),
    `<ul style="margin:0 0 16px;padding-left:20px;">${POINTS.map((x) => `<li style="margin:0 0 6px;">${x}</li>`).join("")}</ul>`,
    p("Ce lien vous est réservé ; merci de ne pas le partager."),
    ...(d.wants_1on1
      ? [p(`Vous avez aussi demandé une présentation 1:1 avec Nexus. Choisissez votre moment : <a href="${RESERVATION_1A1}">${RESERVATION_1A1}</a>`)]
      : []),
    p("Accès complet gratuit jusqu'au 31 octobre. Vous avez déjà une liste de recrutement? Répondez à ce courriel avec votre fichier, je la migre dans votre processus avec vous."),
    p("Une question? Répondez simplement à ce courriel."),
    p(`Bruno-Philippe<br>Co-fondateur, Nexus<br><a href="https://nexussports.ca">nexussports.ca</a>`),
  ].join("\n");

  const avantText = `Bonjour ${d.prenom},\n\nVoici votre accès personnel à l'enregistrement de la démo recruteurs du 12 octobre. Nexus, c'est votre outil de recrutement — pas une banque de joueurs.`;
  const apresText = [
    "En 35 minutes, vous allez voir :\n" + POINTS.map((x) => `– ${x}`).join("\n"),
    "Ce lien vous est réservé ; merci de ne pas le partager.",
    ...(d.wants_1on1 ? [`Vous avez aussi demandé une présentation 1:1 avec Nexus. Choisissez votre moment : ${RESERVATION_1A1}`] : []),
    "Accès complet gratuit jusqu'au 31 octobre. Vous avez déjà une liste de recrutement? Répondez à ce courriel avec votre fichier, je la migre dans votre processus avec vous.",
    "Une question? Répondez simplement à ce courriel.",
    "Bruno-Philippe\nCo-fondateur, Nexus\nnexussports.ca",
  ].join("\n\n");

  const { html, text } = renderEmail({
    preheader: "Votre lien personnel vers l'enregistrement de la démo Nexus.",
    heading: "Votre accès à la démo",
    bodyHtml: avantHtml,
    bodyText: avantText,
    ctaLabel: "Regarder la démo",
    ctaUrl: lien,
    // Même typographie que le corps : le gabarit insère extraHtml tel quel.
    extraHtml: `<div style="font-family:'Outfit','Segoe UI',Helvetica,Arial,sans-serif;font-size:16px;line-height:1.55;color:#27272A;">${apresHtml}</div>`,
    // Le gabarit écrit déjà « Regarder la démo : <lien> » dans la partie texte.
    extraText: apresText,
    footerNote: PIED,
  });
  return { sujet: SUJET_ACCES, html, text };
}

export function avisAcces(d: DemandeAcces): { sujet: string; html: string; text: string } {
  const ligne = `${d.prenom} ${d.nom}, ${d.cegep ?? "cégep non précisé"}, ${d.courriel}, ${libelleRole(d.role)}`;
  const admin = `${APP_URL}/admin/demo-access`;
  const sujet = `Nouvelle demande démo — ${ligne}`;
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:#1a1d24;">
<p><strong>Nouvelle demande démo</strong> — ${esc(ligne)}</p>
<p>Présentation 1:1 : ${d.wants_1on1 ? "oui" : "non"}</p>
<p><a href="${admin}">${admin}</a></p>
</div>`;
  const text = `Nouvelle demande démo — ${ligne}\nPrésentation 1:1 : ${d.wants_1on1 ? "oui" : "non"}\n\n${admin}`;
  return { sujet, html, text };
}
