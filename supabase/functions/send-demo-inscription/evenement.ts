// send-demo-inscription/evenement.ts — l'événement « démo du 12 octobre » en
// UN seul endroit, SANS aucun import : lu par la fonction (Deno : courriel,
// .ics joint) ET par la page Next (/12octobre/merci, /12octobre/demo-nexus.ics).
//
// « Ajouter à mon agenda » en un clic (retour BP 2026-09-30) :
//   · lienGoogleAgenda() — calendar.google.com/calendar/render?action=TEMPLATE,
//     l'événement pré-rempli, « Enregistrer » l'ajoute ;
//   · URL_ICS — le .ics servi par une URL, pour Apple Calendrier et Outlook ;
//   · ics() — METHOD:REQUEST + ORGANIZER info@ : les clients qui le
//     reconnaissent (Mail d'Apple, Gmail, Outlook) proposent « Ajouter ».
//     RSVP=FALSE : personne n'est invité à répondre, info@ ne reçoit pas de
//     réponses d'acceptation.

export const EVENEMENT = {
  titre: "Nexus — Démo recruteurs",
  // 12 h à 13 h HAE (UTC−4 : l'heure normale ne revient que le 1er novembre).
  debutUtc: "20261012T160000Z",
  finUtc: "20261012T170000Z",
  fuseau: "America/Toronto",
  meet: "https://meet.google.com/myi-efqn-kes",
  organisateur: "info@nexussports.ca",
  description:
    "Démo en direct de la plateforme Nexus : les outils, le processus, la recherche, et vos questions.\n" +
    "Lien de la rencontre : https://meet.google.com/myi-efqn-kes\n" +
    "Questions : info@nexussports.ca · 438-498-0494",
  // UID de l'événement servi par URL (le même pour tous) ; le courriel en a un
  // par inscrit.
  uidPublic: "demo-2026-10-12@nexussports.ca",
} as const;

/** Le .ics téléchargeable (route Next /12octobre/demo-nexus.ics). */
export const URL_ICS = "https://nexussports.ca/12octobre/demo-nexus.ics";

/** Google Agenda : l'événement pré-rempli, prêt à « Enregistrer ». */
export function lienGoogleAgenda(): string {
  const q = new URLSearchParams({
    action: "TEMPLATE",
    text: EVENEMENT.titre,
    dates: `${EVENEMENT.debutUtc}/${EVENEMENT.finUtc}`,
    ctz: EVENEMENT.fuseau,
    details: EVENEMENT.description,
    location: EVENEMENT.meet,
  });
  return `https://calendar.google.com/calendar/render?${q.toString()}`;
}

// ── .ics (RFC 5545) : CRLF, échappement, lignes pliées à 75 octets ──
const echapperIcs = (s: string): string =>
  s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
// Paramètre CN : entre guillemets, sans guillemets ni retours internes.
const echapperCn = (s: string): string => s.replace(/["\r\n]/g, " ").trim();

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

export interface OptionsIcs {
  uid: string;
  /** L'inscrit (courriel de confirmation) ; absent pour le .ics public. */
  participant?: { nom: string; courriel: string };
  maintenant?: Date;
}

export function ics({ uid, participant, maintenant = new Date() }: OptionsIcs): string {
  const stamp = maintenant.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Nexus//Demo recruteurs 12 octobre//FR",
    "CALSCALE:GREGORIAN",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${EVENEMENT.debutUtc}`,
    `DTEND:${EVENEMENT.finUtc}`,
    "SEQUENCE:0",
    "STATUS:CONFIRMED",
    "TRANSP:OPAQUE",
    `SUMMARY:${echapperIcs(EVENEMENT.titre)}`,
    `DESCRIPTION:${echapperIcs(EVENEMENT.description)}`,
    `LOCATION:${echapperIcs(EVENEMENT.meet)}`,
    `URL:${EVENEMENT.meet}`,
    `ORGANIZER;CN=Nexus:mailto:${EVENEMENT.organisateur}`,
    ...(participant
      ? [`ATTENDEE;CN="${echapperCn(participant.nom)}";CUTYPE=INDIVIDUAL;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=FALSE:mailto:${participant.courriel}`]
      : []),
    "END:VEVENT",
    "END:VCALENDAR",
  ].map(plier).join("\r\n") + "\r\n";
}
