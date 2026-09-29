// send-demo-inscription/email.ts — les deux courriels de l'inscription à la
// démo du 12 octobre, et le .ics. Pur (aucun réseau) : testé sous Node.
//
// · confirmation à l'inscrit, selon son choix :
//     DIRECT         → détails de la démo, lien Meet, .ics joint ;
//     ENREGISTREMENT → « vous recevrez l'enregistrement après le 12 » ;
//   + si la case 1:1 est cochée (cumulable, retour BP 2026-09-29), le rappel
//     du lien de réservation s'ajoute, quel que soit le choix.
// · avis à info@ : tout ce qu'il a répondu.
// Toute valeur saisie est ÉCHAPPÉE avant d'entrer dans le HTML.

import { renderEmail, ADRESSE_POSTALE, SUPPORT } from "../_shared/emailLayout.ts";

export const DEMO = {
  libelle: "lundi 12 octobre 2026, de 12 h à 13 h (heure de Montréal)",
  // 12 h HAE (UTC−4 : l'heure normale ne revient que le 1er novembre).
  debutUtc: "20261012T160000Z",
  finUtc: "20261012T170000Z",
  meet: "https://meet.google.com/myi-efqn-kes",
  reservation: "https://calendar.app.google/YAiAYr4CgnMqLFDU6",
} as const;

export type Participation = "DIRECT" | "ENREGISTREMENT";

export interface Inscription {
  id: string;
  prenom: string;
  nom: string;
  courriel: string;
  cegep: string | null;
  sport: string | null;
  role: string | null;
  interets: string[];
  interet_autre: string | null;
  veut_compte: boolean;
  participation: Participation;
  presentation_1a1: boolean;
  nb_soumissions: number;
}

export const esc = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const ROLES: Record<string, string> = {
  RECRUTEUR: "Recruteur",
  ENTRAINEUR_CHEF: "Entraîneur-chef",
  DIRECTEUR_SPORTS: "Directeur des sports",
  AUTRE: "Autre",
};
const INTERETS: Record<string, string> = {
  OUTILS: "Les outils de recrutement",
  BASSIN: "Le bassin d'athlètes",
  AUTRE: "Autre",
};
const CHOIX: Record<Participation, string> = {
  DIRECT: "Démo en direct le 12 octobre",
  ENREGISTREMENT: "Recevoir l'enregistrement",
};

export const libelleRole = (r: string | null): string => (r ? ROLES[r] ?? r : "—");
export const libelleChoix = (p: Participation): string => CHOIX[p];
export function libelleInterets(i: Inscription): string {
  if (i.interets.length === 0) return "—";
  return i.interets
    .map((c) => (c === "AUTRE" && i.interet_autre ? `Autre : ${i.interet_autre}` : INTERETS[c] ?? c))
    .join(" · ");
}

const PIED = `Vous recevez ce courriel parce que vous vous êtes inscrit à la démo Nexus du 12 octobre. Nexus — ${ADRESSE_POSTALE} · ${SUPPORT} · 438-498-0494`;

const OFFRE = "Après la démo, vous recevrez un accès complet et gratuit à Nexus pendant deux semaines, pour tester avant la période intensive de recrutement.";

export function sujetConfirmation(p: Participation): string {
  switch (p) {
    case "DIRECT": return "Votre place à la démo Nexus — lundi 12 octobre, 12 h";
    case "ENREGISTREMENT": return "Démo Nexus du 12 octobre — l'enregistrement vous sera envoyé";
  }
}

/** Le rappel du 1:1 (case cochée), ajouté à l'un ou l'autre choix. */
const RAPPEL_1A1_HTML = `<p>Vous avez aussi demandé une <strong>présentation 1:1 avec Nexus</strong>. Si ce n'est pas déjà fait, choisissez votre moment : <a href="${DEMO.reservation}">${DEMO.reservation}</a></p>`;
const RAPPEL_1A1_TEXT = `Vous avez aussi demandé une présentation 1:1 avec Nexus. Si ce n'est pas déjà fait, choisissez votre moment : ${DEMO.reservation}`;

export function confirmation(i: Inscription): { sujet: string; html: string; text: string; ics: string | null } {
  const prenom = esc(i.prenom);
  let heading: string, corpsHtml: string, corpsText: string, cta: string, url: string;
  switch (i.participation) {
    case "DIRECT":
      heading = "Votre place est réservée";
      corpsHtml = `<p>Bonjour ${prenom},</p>
<p>Merci de votre inscription. On vous montre Nexus en direct le <strong>${DEMO.libelle}</strong> — les outils, le processus, la recherche — et on répond à vos questions.</p>
<p>Lien de la rencontre : <a href="${DEMO.meet}">${DEMO.meet}</a><br>L'invitation est jointe à ce courriel (fichier .ics) pour l'ajouter à votre agenda.</p>
${i.presentation_1a1 ? `${RAPPEL_1A1_HTML}\n` : ""}<p>${OFFRE}</p>`;
      corpsText = `Bonjour ${i.prenom},\n\nMerci de votre inscription. On vous montre Nexus en direct le ${DEMO.libelle} — les outils, le processus, la recherche — et on répond à vos questions.\n\nLien de la rencontre : ${DEMO.meet}\nL'invitation est jointe à ce courriel (fichier .ics).\n\n${i.presentation_1a1 ? `${RAPPEL_1A1_TEXT}\n\n` : ""}${OFFRE}`;
      cta = "Rejoindre la démo"; url = DEMO.meet;
      break;
    case "ENREGISTREMENT":
      heading = "L'enregistrement suivra";
      corpsHtml = `<p>Bonjour ${prenom},</p>
<p>Merci de votre intérêt. Vous ne pouvez pas être là le ${DEMO.libelle} : pas de problème, <strong>vous recevrez l'enregistrement de la démo par courriel après le 12 octobre</strong>.</p>
<p>${OFFRE.replace("Après la démo", "Après l'avoir visionné")}</p>
${i.presentation_1a1 ? RAPPEL_1A1_HTML : "<p>Vous préférez une présentation en tête-à-tête ? Choisissez un moment avec Nexus.</p>"}`;
      corpsText = `Bonjour ${i.prenom},\n\nMerci de votre intérêt. Vous recevrez l'enregistrement de la démo par courriel après le 12 octobre.\n\n${OFFRE.replace("Après la démo", "Après l'avoir visionné")}\n\n${i.presentation_1a1 ? RAPPEL_1A1_TEXT : `Vous préférez une présentation en tête-à-tête ? ${DEMO.reservation}`}`;
      cta = i.presentation_1a1 ? "Choisir un moment" : "Réserver une présentation 1:1"; url = DEMO.reservation;
      break;
  }
  const { html, text } = renderEmail({
    preheader: heading,
    heading,
    bodyHtml: corpsHtml,
    bodyText: corpsText,
    ctaLabel: cta,
    ctaUrl: url,
    footerNote: PIED,
  });
  return { sujet: sujetConfirmation(i.participation), html, text, ics: i.participation === "DIRECT" ? ics(i.id) : null };
}

export function avis(i: Inscription): { sujet: string; html: string; text: string } {
  const lignes: [string, string][] = [
    ["Nom", `${i.prenom} ${i.nom}`],
    ["Courriel", i.courriel],
    ["Cégep", i.cegep ?? "—"],
    ["Sport", i.sport ?? "—"],
    ["Rôle", libelleRole(i.role)],
    ["Intérêts", libelleInterets(i)],
    ["Veut un compte", i.veut_compte ? "Oui" : "Non"],
    ["Choix", libelleChoix(i.participation)],
    ["Présentation 1:1", i.presentation_1a1 ? "Oui (réservation dans Google Agenda)" : "Non"],
  ];
  if (i.nb_soumissions > 1) lignes.push(["Note", `Soumission n° ${i.nb_soumissions} (mise à jour d'une inscription existante)`]);
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:#1a1d24;">
<p><strong>Nouvelle inscription — démo du 12 octobre</strong></p>
<table cellpadding="4" cellspacing="0" border="0">${lignes
    .map(([k, v]) => `<tr><td style="color:#6b7280;vertical-align:top;">${esc(k)}</td><td>${esc(v)}</td></tr>`).join("")}</table>
</div>`;
  const text = `Nouvelle inscription — démo du 12 octobre\n\n${lignes.map(([k, v]) => `${k} : ${v}`).join("\n")}`;
  return { sujet: `Démo 12 oct. — ${i.prenom} ${i.nom} (${libelleChoix(i.participation)}${i.presentation_1a1 ? " + 1:1" : ""})`, html, text };
}

// ── .ics (RFC 5545) : CRLF, échappement, lignes pliées à 75 octets ──
const echapperIcs = (s: string): string =>
  s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

function plier(ligne: string): string {
  const octets = new TextEncoder().encode(ligne);
  if (octets.length <= 75) return ligne;
  const morceaux: string[] = [];
  let courant = "";
  let taille = 0;
  for (const car of ligne) {
    const t = new TextEncoder().encode(car).length;
    const limite = morceaux.length === 0 ? 75 : 74; // la suite commence par un espace
    if (taille + t > limite) { morceaux.push(courant); courant = ""; taille = 0; }
    courant += car; taille += t;
  }
  morceaux.push(courant);
  return morceaux.join("\r\n ");
}

export function ics(id: string, maintenant: Date = new Date()): string {
  const stamp = maintenant.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Nexus//Demo recruteurs 12 octobre//FR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:demo-2026-10-12-${id}@nexussports.ca`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${DEMO.debutUtc}`,
    `DTEND:${DEMO.finUtc}`,
    `SUMMARY:${echapperIcs("Nexus — Démo recruteurs")}`,
    `DESCRIPTION:${echapperIcs(`Démo en direct de la plateforme Nexus : les outils, le processus, la recherche, et vos questions.\nLien de la rencontre : ${DEMO.meet}\nQuestions : ${SUPPORT} · 438-498-0494`)}`,
    `LOCATION:${echapperIcs(DEMO.meet)}`,
    `URL:${DEMO.meet}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].map(plier).join("\r\n") + "\r\n";
}
